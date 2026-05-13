<?php
require 'backend-php/config.php';

$sql = "CREATE TABLE IF NOT EXISTS Finger_Training_Results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    finger_name VARCHAR(50) NOT NULL,
    wpm INT NOT NULL,
    accuracy DECIMAL(5,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
)";

try {
    $conn->exec($sql);
    echo "Table Finger_Training_Results created successfully.";
} catch (PDOException $e) {
    echo "Error creating table: " . $e->getMessage();
}
