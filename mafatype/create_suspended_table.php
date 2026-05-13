<?php
require_once 'backend-php/config.php';
try {
    $conn->exec("CREATE TABLE IF NOT EXISTS Suspended_Users (
        user_id INT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
    echo "Table Suspended_Users created successfully.";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
