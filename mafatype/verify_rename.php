<?php
require_once 'backend-php/config.php';

echo "1. Checking database schema:\n";
$cols = $conn->query("DESCRIBE Users")->fetchAll(PDO::FETCH_ASSOC);
foreach($cols as $c) if ($c['Field'] === 'status') { echo "Status column type: " . $c['Type'] . "\n"; }

echo "\n2. Testing login enforcement for 'inactive' user:\n";
// Ensure user 2 is inactive
$conn->exec("UPDATE Users SET status = 'inactive' WHERE id = 2");

$url_login = 'http://localhost/mafatype/backend-php/api.php?action=login';
$login_data = ['email' => 'rafli@email.com', 'password' => 'password'];
$opts_login = ['http' => [
    'method'  => 'POST',
    'header'  => 'Content-Type: application/json',
    'content' => json_encode($login_data),
    'ignore_errors' => true
]];
$res_login = file_get_contents($url_login, false, stream_context_create($opts_login));
echo "Login Response: $res_login\n";

if (str_contains($res_login, 'Inactive')) {
    echo "OK: Login blocked with correct label.\n";
} else {
    echo "FAIL: Login not blocked or wrong label.\n";
}

// Reset
$conn->exec("UPDATE Users SET status = 'active' WHERE id = 2");
echo "\n3. Reset user 2 to active.\n";
