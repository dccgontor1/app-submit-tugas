<?php
require_once 'config.php';
$st = $conn->query("SELECT id, title, category, requirements_json FROM Achievements WHERE category = 'competition'");
foreach ($st->fetchAll() as $row) {
    echo "ID: " . $row['id'] . " | Title: " . $row['title'] . " | Category: " . $row['category'] . " | Req: " . $row['requirements_json'] . "\n";
}
