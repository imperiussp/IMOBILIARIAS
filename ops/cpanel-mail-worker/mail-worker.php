<?php
declare(strict_types=1);

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    fwrite(STDERR, "[LENOY] config.php nao encontrado.\n");
    exit(2);
}

$config = require $configFile;
if (!is_array($config)) {
    fwrite(STDERR, "[LENOY] config.php invalido.\n");
    exit(2);
}

$functionUrl = trim((string)($config['function_url'] ?? ''));
$workerToken = trim((string)($config['worker_token'] ?? ''));
$cpanelUser = trim((string)($config['cpanel_user'] ?? ''));
$uapiPath = trim((string)($config['uapi_path'] ?? '/usr/local/cpanel/bin/uapi'));
$maxJobs = max(1, min(10, (int)($config['max_jobs_per_run'] ?? 5)));
$uapiTimeoutSeconds = max(5, min(60, (int)($config['uapi_timeout_seconds'] ?? 20)));

if ($functionUrl === '' || $workerToken === '' || $cpanelUser === '' || $uapiPath === '') {
    fwrite(STDERR, "[LENOY] Configuracao incompleta.\n");
    exit(2);
}

function logLine(string $message): void
{
    echo '[' . date('Y-m-d H:i:s') . '] ' . $message . PHP_EOL;
    if (function_exists('flush')) {
        @flush();
    }
}

$lockFile = __DIR__ . '/worker.lock';
$lockHandle = @fopen($lockFile, 'c');
if ($lockHandle === false) {
    fwrite(STDERR, "[LENOY] Nao foi possivel abrir o arquivo de lock.\n");
    exit(2);
}
if (!@flock($lockHandle, LOCK_EX | LOCK_NB)) {
    logLine('Execucao anterior ainda ativa; esta rodada foi ignorada.');
    fclose($lockHandle);
    exit(0);
}

register_shutdown_function(static function () use ($lockHandle): void {
    @flock($lockHandle, LOCK_UN);
    @fclose($lockHandle);
});

logLine('Worker iniciado.');

function edgeCall(string $url, string $token, array $payload): array
{
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'error' => 'Extensao cURL do PHP indisponivel.'];
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 40,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Accept: application/json',
            'User-Agent: LENOY-Mail-Worker/1.1',
            'X-Worker-Token: ' . $token,
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_SLASHES),
    ]);

    $raw = curl_exec($ch);
    $curlError = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false) {
        return ['ok' => false, 'error' => 'Falha HTTP para o Supabase: ' . $curlError];
    }

    $data = json_decode((string)$raw, true);
    if (!is_array($data)) {
        return ['ok' => false, 'error' => 'Resposta invalida do Supabase (HTTP ' . $status . ').'];
    }
    if ($status < 200 || $status >= 300 || !empty($data['error'])) {
        return ['ok' => false, 'error' => (string)($data['error'] ?? ('HTTP ' . $status)), 'data' => $data];
    }

    return ['ok' => true, 'data' => $data];
}

function runUapi(
    string $uapiPath,
    string $cpanelUser,
    string $module,
    string $function,
    array $params = [],
    int $timeoutSeconds = 20
): array {
    $command = escapeshellarg($uapiPath)
        . ' --user=' . escapeshellarg($cpanelUser)
        . ' --output=json '
        . escapeshellarg($module) . ' ' . escapeshellarg($function);

    foreach ($params as $key => $value) {
        $command .= ' ' . escapeshellarg((string)$key . '=' . (string)$value);
    }

    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    $process = @proc_open($command, $descriptors, $pipes);
    if (!is_resource($process)) {
        return ['ok' => false, 'error' => 'Nao foi possivel iniciar o comando UAPI local.'];
    }

    fclose($pipes[0]);
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);

    $stdout = '';
    $stderr = '';
    $startedAt = microtime(true);
    $lastStatus = null;
    $timedOut = false;

    while (true) {
        $stdout .= (string)stream_get_contents($pipes[1]);
        $stderr .= (string)stream_get_contents($pipes[2]);

        $lastStatus = proc_get_status($process);
        if (!is_array($lastStatus) || !$lastStatus['running']) {
            break;
        }

        if ((microtime(true) - $startedAt) >= $timeoutSeconds) {
            $timedOut = true;
            @proc_terminate($process);
            usleep(250000);
            $afterTerminate = proc_get_status($process);
            if (is_array($afterTerminate) && $afterTerminate['running']) {
                @proc_terminate($process, 9);
            }
            break;
        }

        usleep(100000);
    }

    $stdout .= (string)stream_get_contents($pipes[1]);
    $stderr .= (string)stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);

    $closeCode = proc_close($process);

    if ($timedOut) {
        return [
            'ok' => false,
            'error' => 'UAPI local excedeu ' . $timeoutSeconds . ' segundos e foi interrompida.',
        ];
    }

    $exitCode = $closeCode;
    if (is_array($lastStatus) && isset($lastStatus['exitcode']) && (int)$lastStatus['exitcode'] >= 0) {
        $exitCode = (int)$lastStatus['exitcode'];
    }

    $decoded = json_decode((string)$stdout, true);
    $status = is_array($decoded) ? (int)($decoded['result']['status'] ?? 0) : 0;
    if ($exitCode !== 0 || $status !== 1) {
        $errors = is_array($decoded) ? ($decoded['result']['errors'] ?? null) : null;
        if (is_array($errors)) {
            $errors = implode(' | ', array_map('strval', $errors));
        }
        $message = trim((string)$errors);
        if ($message === '') {
            $message = trim((string)$stderr);
        }
        if ($message === '' && trim((string)$stdout) !== '') {
            $message = trim((string)$stdout);
        }
        if ($message === '') {
            $message = 'UAPI retornou status de falha (codigo ' . $exitCode . ').';
        }
        return ['ok' => false, 'error' => substr($message, 0, 900)];
    }

    return ['ok' => true, 'data' => $decoded];
}

function decryptPassword(string $cipherB64, string $ivB64, string $workerToken): ?string
{
    if (!function_exists('openssl_decrypt')) {
        return null;
    }
    $blob = base64_decode($cipherB64, true);
    $iv = base64_decode($ivB64, true);
    if ($blob === false || $iv === false || strlen($blob) <= 16 || strlen($iv) !== 12) {
        return null;
    }

    $tag = substr($blob, -16);
    $ciphertext = substr($blob, 0, -16);
    $key = hash('sha256', $workerToken, true);
    $plain = openssl_decrypt($ciphertext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    return is_string($plain) ? $plain : null;
}

logLine('Testando UAPI local do cPanel...');
$localCheck = runUapi(
    $uapiPath,
    $cpanelUser,
    'Email',
    'list_pops',
    [],
    $uapiTimeoutSeconds
);
$localStatus = $localCheck['ok'] ? 'ok' : 'error';
$localMessage = $localCheck['ok']
    ? 'UAPI local do cPanel respondeu corretamente.'
    : ('UAPI local indisponivel: ' . (string)($localCheck['error'] ?? 'erro desconhecido'));
logLine($localMessage);

logLine('Comunicando com a fila no Supabase...');
$pull = edgeCall($functionUrl, $workerToken, [
    'action' => 'worker_pull',
    'local_status' => $localStatus,
    'local_message' => $localMessage,
]);

if (!$pull['ok']) {
    logLine('Falha ao comunicar com a fila: ' . (string)($pull['error'] ?? 'erro desconhecido'));
    exit(1);
}

if (!$localCheck['ok']) {
    exit(1);
}

$processed = 0;
while ($processed < $maxJobs) {
    $job = $pull['data']['job'] ?? null;
    if (!is_array($job) || empty($job['id'])) {
        break;
    }

    $jobId = (string)$job['id'];
    $email = (string)($job['email_address'] ?? '');
    $password = decryptPassword(
        (string)($job['password_cipher'] ?? ''),
        (string)($job['password_iv'] ?? ''),
        $workerToken
    );

    if ($password === null) {
        $error = 'Nao foi possivel descriptografar a senha temporaria da solicitacao.';
        edgeCall($functionUrl, $workerToken, [
            'action' => 'worker_complete',
            'job_id' => $jobId,
            'success' => false,
            'error' => $error,
        ]);
        logLine('Falha em ' . $email . ': ' . $error);
    } else {
        $created = runUapi(
            $uapiPath,
            $cpanelUser,
            'Email',
            'add_pop',
            [
                'email' => (string)($job['local_part'] ?? ''),
                'domain' => (string)($job['domain'] ?? ''),
                'password' => $password,
                'quota' => (string)max(100, (int)($job['quota_mb'] ?? 1024)),
            ],
            $uapiTimeoutSeconds
        );
        unset($password);

        $complete = edgeCall($functionUrl, $workerToken, [
            'action' => 'worker_complete',
            'job_id' => $jobId,
            'success' => (bool)$created['ok'],
            'provider_account_ref' => $created['ok'] ? $email : '',
            'error' => $created['ok'] ? '' : (string)($created['error'] ?? 'Falha ao criar conta pelo UAPI.'),
        ]);

        if ($created['ok'] && $complete['ok']) {
            logLine('Conta criada: ' . $email);
        } elseif (!$created['ok']) {
            logLine('Falha ao criar ' . $email . ': ' . (string)($created['error'] ?? 'erro desconhecido'));
        } else {
            logLine(
                'Conta criada no cPanel, mas houve falha ao confirmar no Supabase: '
                . (string)($complete['error'] ?? 'erro desconhecido')
            );
        }
    }

    $processed++;
    if ($processed >= $maxJobs) {
        break;
    }

    $pull = edgeCall($functionUrl, $workerToken, [
        'action' => 'worker_pull',
        'local_status' => 'ok',
        'local_message' => 'UAPI local do cPanel respondeu corretamente.',
    ]);
    if (!$pull['ok']) {
        logLine('Falha ao buscar proxima solicitacao: ' . (string)($pull['error'] ?? 'erro desconhecido'));
        break;
    }
}

if ($processed === 0) {
    logLine('Worker ativo; nenhuma solicitacao pendente.');
}
logLine('Worker finalizado.');
exit(0);
