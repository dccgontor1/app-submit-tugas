<?php
require_once 'backend-php/config.php';

echo "1. Current status of user 2:\n";
$st = $conn->prepare("SELECT id, email, status FROM Users WHERE id = 2");
$st->execute();
$user = $st->fetch();
print_r($user);

echo "\n2. Suspending user 2 via API:\n";
$url_edit = 'http://localhost/mafatype/backend-php/admin-api.php?action=edit-user';
$edit_data = ['admin_id' => 1, 'user_id' => 2, 'status' => 'suspended'];
$opts_edit = ['http' => [
    'method'  => 'POST',
    'header'  => 'Content-Type: application/json',
    'content' => json_encode($edit_data)
]];
$res_edit = file_get_contents($url_edit, false, stream_context_create($opts_edit));
echo "Edit API Response: $res_edit\n";

$st->execute();
$user = $st->fetch();
echo "Status after edit: " . $user['status'] . "\n";

echo "\n3. Testing login for user 2:\n";
$url_login = 'http://localhost/mafatype/backend-php/api.php?action=login';
$login_data = ['email' => $user['email'], 'password' => 'password123'];
$opts_login = ['http' => [
    'method'  => 'POST',
    'header'  => 'Content-Type: application/json',
    'content' => json_encode($login_data),
    'ignore_errors' => true
]];
$res_login = file_get_contents($url_login, false, stream_context_create($opts_login));
echo "Login API Response: $res_login\n";

$headers = $http_response_header ?? [];
echo "Headers:\n";
print_r($headers);

echo "\n4. Resetting user 2 to active:\n";
$edit_data['status'] = 'active';
$opts_edit['http']['content'] = json_encode($edit_data);
file_get_contents($url_edit, false, stream_context_create($opts_edit));
echo "Final status: " . $conn->query("SELECT status FROM Users WHERE id = 2")->fetchColumn() . "\n";
