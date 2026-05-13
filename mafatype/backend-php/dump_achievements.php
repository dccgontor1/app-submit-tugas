<?php
require_once 'config.php';
$st = $conn->query("SELECT id, title, category, requirements_json FROM Achievements");
echo json_encode($st->fetchAll(), JSON_PRETTY_PRINT);
