<?php
require_once 'backend-php/config.php';
try {
    echo "Tables:\n";
    $tables = $conn->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    print_r($tables);

    if (in_array('suspended_users', array_map('strtolower', $tables))) {
        echo "\nSuspended Users Data:\n";
        $data = $conn->query("SELECT * FROM Suspended_Users")->fetchAll();
        print_r($data);
    } else {
        echo "\nTable Suspended_Users NOT found.\n";
    }

    echo "\nUsers Column Status:\n";
    $cols = $conn->query("DESCRIBE Users")->fetchAll();
    foreach($cols as $c) echo $c['Field'] . " (" . $c['Type'] . ")\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
