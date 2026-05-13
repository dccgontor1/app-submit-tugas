<?php
require_once 'backend-php/config.php';
require_once 'backend-php/api.php';

$userId = 1;
$achievementId = 1;

// Reset
$conn->prepare("DELETE FROM User_Achievements WHERE user_id = :uid AND achievement_id = :aid")
     ->execute([':uid' => $userId, ':aid' => $achievementId]);

// Add all except one finger (All Fingers)
$fingers = [
    'left_pinky', 'left_ring', 'left_middle', 'left_index',
    'right_index', 'right_middle', 'right_ring', 'right_pinky'
    // 'all_fingers' is missing
];

foreach ($fingers as $f) {
    // Ensure at least 1 result
    $conn->prepare("INSERT INTO Finger_Training_Results (user_id, finger_name, wpm, accuracy) VALUES (:uid, :f, 50, 95)")
         ->execute([':uid' => $userId, ':f' => $f]);
}

echo "Setup ready. Complete 'all_fingers' training to unlock 'Finger Beginner'.\n";
?>
