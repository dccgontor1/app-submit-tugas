<?php
require_once 'config.php';
$st = $conn->query("SELECT id, title, category, requirements_json FROM Achievements");
$output = "";
foreach ($st->fetchAll() as $row) {
    $output .= "ID: " . $row['id'] . " | Title: " . $row['title'] . " | Category: " . $row['category'] . " | Req: " . $row['requirements_json'] . "\n";
}
file_put_contents('full_achievements.txt', $output);
echo "Full achievements written to full_achievements.txt\n";
