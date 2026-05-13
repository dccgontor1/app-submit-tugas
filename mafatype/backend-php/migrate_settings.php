<?php
require_once 'config.php';

$settingsFile = __DIR__ . '/settings.json';
$defaults = [
    'site_name'        => 'Mafatype.',
    'max_room_players' => 4,
    'default_language' => 'id',
    'allow_register'   => true,
    'maintenance_mode' => false,
    'node_server_url'  => 'http://localhost:3001',
];

try {
    // 1. Create Settings table
    $sql = "CREATE TABLE IF NOT EXISTS Settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(255) UNIQUE NOT NULL,
        setting_value TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )";
    $conn->exec($sql);
    echo "Table 'Settings' checked/created.\n";

    // 2. Load current settings from file
    $data = file_exists($settingsFile) ? json_decode(file_get_contents($settingsFile), true) : [];
    $merged = array_merge($defaults, $data);

    // 3. Migrate data
    $stmt = $conn->prepare("INSERT INTO Settings (setting_key, setting_value) VALUES (:key, :val) 
                            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
    
    foreach ($merged as $key => $val) {
        // Convert boolean/number to string for storage if needed, or leave as JSON
        $valueToStore = is_scalar($val) ? $val : json_encode($val);
        $stmt->execute([':key' => $key, ':val' => $valueToStore]);
        echo "Migrated setting: $key = $valueToStore\n";
    }

    echo "Migration completed successfully.\n";

} catch (Exception $e) {
    echo "Error during migration: " . $e->getMessage() . "\n";
}
