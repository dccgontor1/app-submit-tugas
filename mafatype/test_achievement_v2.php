<?php
require_once 'backend-php/config.php';
require_once 'backend-php/api.php';

// Verification script to trigger an achievement unlock for a test user
$userId = 1; // Assuming user ID 1 exists

// Force an achievement to be NOT unlocked yet by deleting it from User_Achievements if it exists
// Let's use Achievement ID 1 (Finger Beginner) as a test
$achievementId = 1;
$conn->prepare("DELETE FROM User_Achievements WHERE user_id = :uid AND achievement_id = :aid")
     ->execute([':uid' => $userId, ':aid' => $achievementId]);

echo "Reset achievement $achievementId for user $userId.\n";

// Now, simulate a save that triggers the check.
// We need to make sure the requirements are met.
// For Finger Beginner, we need 1 result for each finger.
$fingers = [
    'left_pinky', 'left_ring', 'left_middle', 'left_index',
    'right_index', 'right_middle', 'right_ring', 'right_pinky',
    'all_fingers'
];

foreach ($fingers as $f) {
    $conn->prepare("INSERT INTO Finger_Training_Results (user_id, finger_name, wpm, accuracy) VALUES (:uid, :f, 50, 95)")
         ->execute([':uid' => $userId, ':f' => $f]);
}

echo "Added 1 result for each finger for user $userId.\n";

// Now call the API action via AchievementManager directly to see if it returns the object
$results = AchievementManager::check($userId, 'finger_training');

echo "Achievement check results:\n";
print_r($results);

if (count($results) > 0 && isset($results[0]['title'])) {
    echo "SUCCESS: Achievement details returned correctly.\n";
} else {
    echo "FAILURE: Achievement details not returned as expected.\n";
}
?>
