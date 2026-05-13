<?php
require_once 'backend-php/config.php';
try {
    // 1. Convert any 'suspended' to 'inactive' first to avoid issues with ENUM change
    // Note: If we just modify the column, values not in the new ENUM might become empty string or error depending on SQL mode.
    // It's safer to add the new value, migrate, then remove the old one.
    
    // First, allow both
    $conn->exec("ALTER TABLE Users MODIFY COLUMN status ENUM('active', 'suspended', 'inactive') DEFAULT 'active'");
    echo "Temporary ENUM set.\n";
    
    // Migrate
    $conn->exec("UPDATE Users SET status = 'inactive' WHERE status = 'suspended'");
    echo "Data migrated.\n";
    
    // Finalize
    $conn->exec("ALTER TABLE Users MODIFY COLUMN status ENUM('active', 'inactive') DEFAULT 'active'");
    echo "Final ENUM set.\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
