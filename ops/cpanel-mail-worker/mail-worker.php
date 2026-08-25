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
$maxJobs = max(1, min(10, (int)($config['max_jobs_per_run'] ?? 5)));

if ($functionUrl === '' || $workerToken === '' || $cpanelUser === '') {
    fwrite(STDERR, "[LENOY] Configuracao incompleta.\n");
    exit(2);
}

function logLine(string $message): void
{
    echo '[' . date('Y-m-d H:i:s') . '] ' . $message . PHP_EOL;
    @flush();
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
            'User-Agent: LENOY-Mail-Worker/1.2',
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

function cpanelLocalCall(string $user, string $token, string $module, string $function, array $params = []): array
{
    if (!function_exists('curl_init')) {
        return ['ok' => false, 'error' => 'Extensao cURL do PHP indisponivel.'];
    }

    $url = 'https://127.0.0.1:2083/execute/' . rawurlencode($module) . '/' . rawurlencode($function);
    if ($params !== []) {
        $url .= '?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986);
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Authorization: cpanel ' . $user . ':' . $token,
            'User-Agent: LENOY-Mail-Worker/1.2',
        ],
    ]);

    $raw = curl_exec($ch);
    $curlError = curl_error($ch);
    $statusCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false) {
        return ['ok' => false, 'error' => 'Falha na API local do cPanel: ' . $curlError];
    }

    $decoded = json_decode((string)$raw, true);
    if (!is_array($decoded)) {
        return ['ok' => false, 'error' => 'Resposta invalida da API local do cPanel (HTTP ' . $statusCode . ').'];
    }

    $apiStatus = (int)($decoded['status'] ?? ($decoded['result']['status'] ?? 0));
    if ($statusCode < 200 || $statusCode >= 300 || $apiStatus !== 1) {
        $errors = $decoded['errors'] ?? ($decoded['result']['errors'] ?? null);
        if (is_array($errors)) {
            $errors = implode(' | ', array_map('strval', $errors));
        }
        $message = trim((string)$errors);
        if ($message === '') {
            $message = 'API local do cPanel retornou HTTP ' . $statusCode . '.';
        }
        return ['ok' => false, 'error' => substr($message, 0, 900), 'data' => $decoded];
    }

    return ['ok' => true, 'data' => $decoded];
}

function decryptPassword(string $cipherB64, string $ivB64, string $workerToken): ?string
{
    if (!function_exists('openssl_decrypt')) return null;
    $blob = base64_decode($cipherB64, true);
    $iv = base64_decode($ivB64, true);
    if ($blob === false || $iv === false || strlen($blob) <= 16 || strlen($iv) !== 12) return null;
    $tag = substr($blob, -16);
    $ciphertext = substr($blob, 0, -16);
    $key = hash('sha256', $workerToken, true);
    $plain = openssl_decrypt($ciphertext, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    return is_string($plain) ? $plain : null;
}

logLine('Worker iniciado.');
logLine('Testando API local do cPanel...');
$localCheck = cpanelLocalCall($cpanelUser, $workerToken, 'Email', 'list_pops');
$localStatus = $localCheck['ok'] ? 'ok' : 'error';
$localMessage = $localCheck['ok']
    ? 'API local do cPanel respondeu corretamente.'
    : ('API local do cPanel indisponivel: ' . (string)($localCheck['error'] ?? 'erro desconhecido'));
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
    if (!is_array($job) || empty($job['id'])) break;

    $jobId = (string)$job['id'];
    $email = (string)($job['email_address'] ?? '');
    $password = decryptPassword((string)($job['password_cipher'] ?? ''), (string)($job['password_iv'] ?? ''), $workerToken);

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
        $created = cpanelLocalCall($cpanelUser, $workerToken, 'Email', 'add_pop', [
            'email' => (string)($job['local_part'] ?? ''),
            'domain' => (string)($job['domain'] ?? ''),
            'password' => $password,
            'quota' => (string)max(100, (int)($job['quota_mb'] ?? 1024)),
        ]);
        unset($password);

        $complete = edgeCall($functionUrl, $workerToken, [
            'action' => 'worker_complete',
            'job_id' => $jobId,
            'success' => (bool)$created['ok'],
            'provider_account_ref' => $created['ok'] ? $email : '',
            'error' => $created['ok'] ? '' : (string)($created['error'] ?? 'Falha ao criar conta pela API local do cPanel.'),
        ]);

        if ($created['ok'] && $complete['ok']) {
            logLine('Conta criada: ' . $email);
        } elseif (!$created['ok']) {
            logLine('Falha ao criar ' . $email . ': ' . (string)($created['error'] ?? 'erro desconhecido'));
        } else {
            logLine('Conta criada no cPanel, mas houve falha ao confirmar no Supabase: ' . (string)($complete['error'] ?? 'erro desconhecido'));
        }
    }

    $processed++;
    if ($processed >= $maxJobs) break;

    $pull = edgeCall($functionUrl, $workerToken, [
        'action' => 'worker_pull',
        'local_status' => 'ok',
        'local_message' => 'API local do cPanel respondeu corretamente.',
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
