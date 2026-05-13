<?php
require_once 'backend-php/config.php';

$url_edit = 'http://localhost/mafatype/backend-php/admin-api.php?action=edit-user';
$edit_data = ['admin_id' => 1, 'user_id' => 2, 'status' => 'suspended', 'username' => 'rafli123']; // added username to be safe
$opts_edit = ['http' => [
    'method'  => 'POST',
    'header'  => 'Content-Type: application/json',
    'content' => json_encode($edit_data),
    'ignore_errors' => true
]];
echo "CALLING EDIT API...\n";
$res_edit = file_get_contents($url_edit, false, stream_context_create($opts_edit));
echo "EDIT RESPONSE: $res_edit\n\n";

$url_login = 'http://localhost/mafatype/backend-php/api.php?action=login';
$login_data = ['email' => 'rafli@email.com', 'password' => 'password'];
$opts_login = ['http' => [
    'method'  => 'POST',
    'header'  => 'Content-Type: application/json',
    'content' => json_encode($login_data),
    'ignore_errors' => true
]];
echo "CALLING LOGIN API...\n";
$res_login = file_get_contents($url_login, false, stream_context_create($opts_login));
echo "LOGIN RESPONSE: $res_login\n";
