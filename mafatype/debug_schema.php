<?php
require 'backend-php/config.php';
function getTableSchema($conn, $table) {
    try {
        $st = $conn->query("SHOW CREATE TABLE $table");
        return $st->fetch()[1];
    } catch (Exception $e) {
        return "Error: " . $e->getMessage();
    }
}
echo "--- Practice_Texts ---\n";
$st = $conn->query("DESCRIBE Practice_Texts");
print_r($st->fetchAll(PDO::FETCH_ASSOC));
echo "\n\n--- Practice_Results ---\n";
$st = $conn->query("DESCRIBE Practice_Results");
print_r($st->fetchAll(PDO::FETCH_ASSOC));
