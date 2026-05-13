<?php
require_once 'backend-php/config.php';

echo "1. Testing Suspended_Users table:\n";
$tables = $conn->query("SHOW TABLES LIKE 'Suspended_Users'")->fetchAll();
echo count($tables) > 0 ? "OK: Table exists\n" : "FAIL: Table missing\n";

echo "\n2. Testing admin-api.php status update (suspending user 2):\n";
$url = 'http://localhost/mafatype/backend-php/admin-api.php?action=edit-user';
$admin_id = 1; // Assuming 1 is admin
$data = ['admin_id' => $admin_id, 'user_id' => 2, 'status' => 'suspended'];
$opts = ['http' => [
    'method'  => 'POST',
    'header'  => 'Content-Type: application/json',
    'content' => json_encode($data)
]];
$context = stream_context_create($opts);
$res = file_get_contents($url, false, $context);
echo "Response: " . $res . "\n";

$sus = $conn->query("SELECT 1 FROM Suspended_Users WHERE user_id = 2")->fetch();
echo $sus ? "OK: User 2 is suspended\n" : "FAIL: User 2 not suspended\n";

echo "\n3. Testing api.php login for suspended user (user 2):\n";
// User 2 is rafli123, email rafli@email.com, password password123
$url_login = 'http://localhost/mafatype/backend-php/api.php?action=login';
$login_data = ['email' => 'rafli@email.com', 'password' => 'password123'];
$opts_login = ['http' => [
    'method'  => 'POST',
    'header'  => 'Content-Type: application/json',
    'content' => json_encode($login_data),
    'ignore_errors' => true
]];
$context_login = stream_context_create($opts_login);
$res_login = file_get_contents($url_login, false, $context_login);
echo "Response: " . $res_login . "\n";
echo str_contains($res_login, 'ditangguhkan') ? "OK: Login blocked\n" : "FAIL: Login not blocked\n";

echo "\n4. Testing admin-api.php status update (activating user 2):\n";
$data['status'] = 'active';
$opts['http']['content'] = json_encode($data);
$context = stream_context_create($opts);
file_get_contents($url, false, $context);
$sus = $conn->query("SELECT 1 FROM Suspended_Users WHERE user_id = 2")->fetch();
echo !$sus ? "OK: User 2 is active\n" : "FAIL: User 2 still suspended\n";
