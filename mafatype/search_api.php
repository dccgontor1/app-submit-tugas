<?php
$content = file_get_contents('backend-php/admin-api.php');
$lines = explode("\n", $content);
foreach($lines as $i => $line) {
    if (str_contains($line, 'users-export')) {
        echo "Line " . ($i+1) . ": " . trim($line) . "\n";
    }
}
