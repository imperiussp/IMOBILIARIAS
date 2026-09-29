<?php
/**
 * Plugin Name: LENOY Auth Mailer
 * Description: Envia e-mails de acesso e recuperação da plataforma LENOY usando o wp_mail(), a partir de tokens descartáveis emitidos pelo backend.
 * Version: 1.0.0
 * Author: LENOY
 */

if (!defined('ABSPATH')) {
    exit;
}

define('LENOY_AUTH_MAIL_BRIDGE_URL', 'https://rvjsonspplqelktzwusu.supabase.co/functions/v1/auth-mail-bridge');

function lenoy_auth_mail_json_error($message, $status = 500) {
    return new WP_REST_Response(array(
        'ok' => false,
        'error' => $message,
    ), $status);
}

function lenoy_auth_mail_send(WP_REST_Request $request) {
    $token = sanitize_text_field((string) $request->get_param('token'));

    if (!$token || !preg_match('/^[A-Za-z0-9_-]{40,120}$/', $token)) {
        return lenoy_auth_mail_json_error('Token de envio inválido.', 400);
    }

    $bridge_response = wp_remote_post(LENOY_AUTH_MAIL_BRIDGE_URL, array(
        'timeout' => 20,
        'redirection' => 0,
        'headers' => array(
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ),
        'body' => wp_json_encode(array(
            'action' => 'consume',
            'token' => $token,
        )),
        'data_format' => 'body',
    ));

    if (is_wp_error($bridge_response)) {
        update_option('lenoy_auth_mail_last_status', array(
            'at' => current_time('mysql'),
            'ok' => false,
            'message' => $bridge_response->get_error_message(),
        ), false);
        return lenoy_auth_mail_json_error('Não foi possível consultar os dados do e-mail.', 502);
    }

    $http_code = (int) wp_remote_retrieve_response_code($bridge_response);
    $payload = json_decode((string) wp_remote_retrieve_body($bridge_response), true);

    if ($http_code < 200 || $http_code >= 300 || !is_array($payload) || empty($payload['ok'])) {
        $detail = is_array($payload) && !empty($payload['error'])
            ? sanitize_text_field((string) $payload['error'])
            : 'Resposta inválida do backend.';

        update_option('lenoy_auth_mail_last_status', array(
            'at' => current_time('mysql'),
            'ok' => false,
            'message' => $detail,
        ), false);

        return lenoy_auth_mail_json_error($detail, 502);
    }

    $to = sanitize_email((string) ($payload['to'] ?? ''));
    $subject = sanitize_text_field((string) ($payload['subject'] ?? ''));
    $html = (string) ($payload['html'] ?? '');

    if (!$to || !$subject || !$html) {
        return lenoy_auth_mail_json_error('Dados do e-mail incompletos.', 500);
    }

    $headers = array(
        'Content-Type: text/html; charset=UTF-8',
        'From: LENOY IMOBILIÁRIAS <contato@lenoy.com.br>',
        'Reply-To: contato@lenoy.com.br',
    );

    $sent = wp_mail($to, $subject, $html, $headers);

    update_option('lenoy_auth_mail_last_status', array(
        'at' => current_time('mysql'),
        'ok' => (bool) $sent,
        'recipient' => $to,
        'message' => $sent
            ? 'wp_mail aceitou a mensagem para envio.'
            : 'wp_mail retornou falha ao enviar a mensagem.',
    ), false);

    if (!$sent) {
        return lenoy_auth_mail_json_error('O WordPress não conseguiu entregar a mensagem ao serviço de e-mail configurado.', 502);
    }

    return new WP_REST_Response(array(
        'ok' => true,
        'provider' => 'wordpress',
        'recipient' => $to,
        'message' => 'O WordPress aceitou a mensagem para envio.',
    ), 200);
}

function lenoy_auth_mail_health(WP_REST_Request $request) {
    $bridge_response = wp_remote_post(LENOY_AUTH_MAIL_BRIDGE_URL, array(
        'timeout' => 12,
        'headers' => array(
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ),
        'body' => wp_json_encode(array('action' => 'health')),
        'data_format' => 'body',
    ));

    if (is_wp_error($bridge_response)) {
        return lenoy_auth_mail_json_error($bridge_response->get_error_message(), 502);
    }

    $code = (int) wp_remote_retrieve_response_code($bridge_response);
    $payload = json_decode((string) wp_remote_retrieve_body($bridge_response), true);

    if ($code < 200 || $code >= 300 || !is_array($payload) || empty($payload['ok'])) {
        return lenoy_auth_mail_json_error('A ponte com o backend não respondeu corretamente.', 502);
    }

    return new WP_REST_Response(array(
        'ok' => true,
        'wordpress' => true,
        'bridge' => true,
        'wp_mail_available' => function_exists('wp_mail'),
    ), 200);
}

add_action('rest_api_init', function () {
    register_rest_route('lenoy/v1', '/auth-mail', array(
        'methods' => WP_REST_Server::CREATABLE,
        'callback' => 'lenoy_auth_mail_send',
        'permission_callback' => '__return_true',
    ));

    register_rest_route('lenoy/v1', '/auth-mail-health', array(
        'methods' => WP_REST_Server::READABLE,
        'callback' => 'lenoy_auth_mail_health',
        'permission_callback' => function () {
            return current_user_can('manage_options');
        },
    ));
});

add_action('admin_menu', function () {
    add_management_page(
        'LENOY E-mails',
        'LENOY E-mails',
        'manage_options',
        'lenoy-auth-mailer',
        'lenoy_auth_mail_admin_page'
    );
});

function lenoy_auth_mail_admin_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $status = get_option('lenoy_auth_mail_last_status', array());
    ?>
    <div class="wrap">
        <h1>LENOY E-mails de acesso</h1>
        <p>Este plugin envia e-mails de criação e recuperação de senha da plataforma LENOY usando o sistema de e-mail do WordPress.</p>
        <p><strong>Backend:</strong> <?php echo esc_html(LENOY_AUTH_MAIL_BRIDGE_URL); ?></p>
        <p><strong>wp_mail disponível:</strong> <?php echo function_exists('wp_mail') ? 'Sim' : 'Não'; ?></p>

        <?php if (is_array($status) && !empty($status)) : ?>
            <h2>Último envio</h2>
            <table class="widefat striped" style="max-width:800px">
                <tbody>
                    <tr><td><strong>Data</strong></td><td><?php echo esc_html((string) ($status['at'] ?? '')); ?></td></tr>
                    <tr><td><strong>Status</strong></td><td><?php echo !empty($status['ok']) ? 'Aceito pelo WordPress' : 'Falhou'; ?></td></tr>
                    <tr><td><strong>Destinatário</strong></td><td><?php echo esc_html((string) ($status['recipient'] ?? '')); ?></td></tr>
                    <tr><td><strong>Detalhe</strong></td><td><?php echo esc_html((string) ($status['message'] ?? '')); ?></td></tr>
                </tbody>
            </table>
        <?php endif; ?>
    </div>
    <?php
}
