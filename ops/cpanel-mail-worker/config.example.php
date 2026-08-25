<?php
return [
    // Cole em config.php o MESMO token de API ativo do cPanel que foi salvo no Secret CPANEL_API_TOKEN do Supabase.
    // Nunca publique config.php no GitHub e mantenha esse arquivo fora de public_html.
    'worker_token' => 'COLE_AQUI_O_TOKEN_ATIVO_DO_CPANEL',

    'cpanel_user' => 'robs4905',
    'function_url' => 'https://rvjsonspplqelktzwusu.supabase.co/functions/v1/provision-professional-email',
    'uapi_path' => '/usr/local/cpanel/bin/uapi',
    'max_jobs_per_run' => 5,
];
