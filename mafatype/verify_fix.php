<?php
require_once 'backend-php/config.php';

echo "1. Checking status column in Users table:\n";
$cols = $conn->query("DESCRIBE Users")->fetchAll(PDO::FETCH_ASSOC);
$found = false;
foreach($cols as $c) if ($c['Field'] === 'status') { $found = true; echo "OK: Status column exists (" . $c['Type'] . ")\n"; }
if (!$found) echo "FAIL: Status column missing\n";

echo "\n2. Testing individual user status update (user 2 to suspended):\n";
$url_edit = 'http://localhost/mafatype/backend-php/admin-api.php?action=edit-user';
$edit_data = ['admin_id' => 1, 'user_id' => 2, 'status' => 'suspended'];
$opts_edit = ['http' => [
    'method'  => 'POST',
    'header'  => 'Content-Type: application/json',
    'content' => json_encode($edit_data)
]];
file_get_contents($url_edit, false, stream_context_create($opts_edit));
$st = $conn->prepare("SELECT status FROM Users WHERE id = 2");
$st->execute();
$status = $st->fetchColumn();
echo $status === 'suspended' ? "OK: User 2 status is suspended in database\n" : "FAIL: User 2 status is $status\n";

echo "\n3. Testing login enforcement:\n";
$url_login = 'http://localhost/mafatype/backend-php/api.php?action=login';
$login_data = ['email' => 'rafli@email.com', 'password' => 'password123'];
$opts_login = ['http' => [
    'method'  => 'POST',
    'header'  => 'Content-Type: application/json',
    'content' => json_encode($login_data),
    'ignore_errors' => true
]];
$res_login = file_get_contents($url_login, false, stream_context_create($opts_login));
echo str_contains($res_login, 'ditangguhkan') ? "OK: Login blocked for suspended user\n" : "FAIL: Login NOT blocked\n";

echo "\n4. Testing reactivation:\n";
$edit_data['status'] = 'active';
$opts_edit['http']['content'] = json_encode($edit_data);
file_get_contents($url_edit, false, stream_context_create($opts_edit));
$st->execute();
$status = $st->fetchColumn();
echo $status === 'active' ? "OK: User 2 status is active in database\n" : "FAIL: User 2 status is $status\n";
