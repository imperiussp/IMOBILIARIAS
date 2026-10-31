<?php
declare(strict_types=1);
/**
 * LENOY IMOBILIÁRIAS — transportador de e-mail para ambiente cPanel/PHP.
 * Somente mensagens de um único uso previamente autorizadas no Supabase.
 * Não guarda senhas, tokens permanentes ou credenciais de SMTP.
 */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
function finish(array $result, int $code=200): void {
    http_response_code($code);
    echo json_encode($result, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    finish(['ok' => true, 'provider' => 'cpanel-php', 'mail_available' => function_exists('mail')]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') finish(['ok' => false, 'error' => 'method_not_allowed'], 405);
$raw = file_get_contents('php://input');
if (!is_string($raw) || strlen($raw) > 1024) finish(['ok' => false, 'error' => 'invalid_request'], 400);
$body = json_decode($raw, true);
$token = is_array($body) ? ($body['token'] ?? '') : '';
if (!is_string($token) || preg_match('/^[a-zA-Z0-9_-]{40,120}$/D', $token) !== 1) {
    finish(['ok' => false, 'error' => 'invalid_token'], 400);
}
$apiUrl = 'https://rvjsonspplqelktzwusu.supabase.co/functions/v1/auth-mail-bridge';
$payload = json_encode(['action' => 'consume', 'token' => $token], JSON_UNESCAPED_SLASHES);
if (!is_string($payload)) finish(['ok' => false, 'error' => 'encoding_failed'], 500);
$reply = null;
$status = 0;
if (function_exists('curl_init')) {
    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST => true,
      CURLOPT_POSTFIELDS => $payload,
      CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
      CURLOPT_CONNECTTIMEOUT => 5,
      CURLOPT_TIMEOUT => 15,
      CURLOPT_FOLLOWLOCATION => false
    ]);
    $reply = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
} elseif (ini_get('allow_url_fopen')) {
    $context = stream_context_create(['http' => [
      'method' => 'POST',
      'header' => "Content-Type: application/json\r\nAccept: application/json\r\n",
      'content' => $payload, 'timeout' => 15, 'ignore_errors' => true,
    ]]);
    $reply = @file_get_contents($apiUrl, false, $context);
    $status = isset($http_response_header[0]) && preg_match('/HTTP\/\S+\s+(\d{3})/', $http_response_header[0], $m)
      ? (int)$m[1] : 0;
}
if ($status !== 200 || !is_string($reply)) finish(['ok' => false, 'error' => 'mail_authorization_failed'], 502);
$message = json_decode($reply, true);
if (!is_array($message) || ($message['ok'] ?? false) !== true) {
    finish(['ok' => false, 'error' => 'mail_authorization_failed'], 502);
}
$to = $message['to'] ?? '';
$subject = $message['subject'] ?? '';
$html = $message['html'] ?? '';
if (!is_string($to) || !filter_var($to, FILTER_VALIDATE_EMAIL) ||
    !is_string($subject) || !is_string($html) ||
    strlen($subject) > 255 || strlen($html) > 100000) {
    finish(['ok' => false, 'error' => 'invalid_message'], 400);
}
$subject = str_replace(["\r", "\n"], '', $subject);
$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$headers = implode("\r\n", [
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'From: LENOY Imobiliarias <contato@lenoy.com.br>',
    'Reply-To: contato@lenoy.com.br',
    'X-Mailer: LENOY Billing',
]);
if (!function_exists('mail') || !@mail($to, $encodedSubject, $html, $headers)) {
    finish(['ok' => false, 'error' => 'server_mail_unavailable'], 502);
}
finish(['ok' => true, 'provider' => 'cpanel-php']);
