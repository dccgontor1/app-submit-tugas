<?php
require_once 'backend-php/config.php';

$url_login = 'http://localhost/mafatype/backend-php/api.php?action=login';
$login_data = ['email' => 'rafli@email.com', 'password' => 'password'];
$opts_login = ['http' => [
    'method'  => 'POST',
    'header'  => 'Content-Type: application/json',
    'content' => json_encode($login_data),
    'ignore_errors' => true
]];
$res_login = file_get_contents($url_login, false, stream_context_create($opts_login));
echo "API RESPONSE:\n";
echo $res_login . "\n";
