<?php
require_once 'backend-php/config.php';

try {
    $conn->beginTransaction();

    // 1. Add status column to Users if it doesn't exist
    $cols = $conn->query("DESCRIBE Users")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('status', $cols)) {
        echo "Adding status column to Users table...\n";
        $conn->exec("ALTER TABLE Users ADD COLUMN status ENUM('active', 'suspended') DEFAULT 'active' AFTER daerah");
    } else {
        echo "Status column already exists in Users table.\n";
    }

    // 2. Migrate data from Suspended_Users if it exists
    $tables = $conn->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    $suspendedTable = null;
    foreach($tables as $t) if (strtolower($t) === 'suspended_users') $suspendedTable = $t;

    if ($suspendedTable) {
        echo "Migrating data from $suspendedTable...\n";
        $suspendedIds = $conn->query("SELECT user_id FROM $suspendedTable")->fetchAll(PDO::FETCH_COLUMN);
        if ($suspendedIds) {
            $ids = implode(',', array_map('intval', $suspendedIds));
            $conn->exec("UPDATE Users SET status = 'suspended' WHERE id IN ($ids)");
            echo "Migrated " . count($suspendedIds) . " users to suspended status.\n";
        }
        
        // 3. Drop Suspended_Users table
        echo "Dropping $suspendedTable table...\n";
        $conn->exec("DROP TABLE $suspendedTable");
    }

    $conn->commit();
    echo "Migration completed successfully.";
} catch (Exception $e) {
    if ($conn->inTransaction()) $conn->rollBack();
    echo "Error: " . $e->getMessage();
}
