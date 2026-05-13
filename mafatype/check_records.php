<?php
require 'backend-php/config.php';
global $conn;
try {
    $count = $conn->query('SELECT COUNT(*) FROM Finger_Training_Results')->fetchColumn();
    echo "Finger Training Records: " . $count . "\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
