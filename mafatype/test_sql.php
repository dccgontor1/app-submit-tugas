<?php
require_once 'backend-php/config.php';
try {
    $conn->exec("UPDATE Users SET status = 'suspended' WHERE id = 2");
    $status = $conn->query("SELECT status FROM Users WHERE id = 2")->fetchColumn();
    echo "Status of user 2 after direct SQL: $status\n";

    $conn->exec("UPDATE Users SET status = 'active' WHERE id = 2");
    $status = $conn->query("SELECT status FROM Users WHERE id = 2")->fetchColumn();
    echo "Status of user 2 after reset: $status\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
