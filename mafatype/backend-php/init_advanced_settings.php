<?php
require_once 'config.php';

$settings = [
    'min_wpm_id' => '0',
    'min_wpm_en' => '0',
    'min_wpm_ar' => '0',
    'min_attempts_practice' => '1',
    'min_attempts_finger' => '1',
    'typing_ratings' => json_encode([
        ['min_wpm' => 0, 'rating' => 'Poor', 'desc' => 'Needs more practice'],
        ['min_wpm' => 40, 'rating' => 'Good', 'desc' => 'Average computer user'],
        ['min_wpm' => 61, 'rating' => 'Very Good', 'desc' => 'Fast and consistent'],
        ['min_wpm' => 81, 'rating' => 'Excellent', 'desc' => 'Professional level'],
        ['min_wpm' => 100, 'rating' => 'Master', 'desc' => 'Elite typing speed']
    ])
];

echo "Initializing advanced settings...\n";

foreach ($settings as $key => $value) {
    try {
        $stmt = $conn->prepare("INSERT INTO Settings (setting_key, setting_value) VALUES (:key, :val) 
                                ON DUPLICATE KEY UPDATE setting_key = setting_key"); // Only insert if not exists
        $stmt->execute([':key' => $key, ':val' => $value]);
        if ($stmt->rowCount() > 0) {
            echo "Added setting: $key\n";
        } else {
            echo "Setting $key already exists.\n";
        }
    } catch (Exception $e) {
        echo "Error adding $key: " . $e->getMessage() . "\n";
    }
}

echo "Migration done.\n";
