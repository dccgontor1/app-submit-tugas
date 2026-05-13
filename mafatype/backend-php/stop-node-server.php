<?php
header('Content-Type: application/json');

$appName = "mafatype-multiplayer";

// Use PM2 to stop the application
exec("pm2 stop \"$appName\"", $output, $returnVar);

if ($returnVar === 0) {
    echo json_encode(['status' => 'success', 'message' => "Server '$appName' stopped successfully via PM2."]);
} else {
    // Maybe it wasn't running or doesn't exist
    exec("pm2 describe \"$appName\"", $descOutput, $descReturn);
    if ($descReturn !== 0) {
        echo json_encode(['status' => 'success', 'message' => "Server '$appName' is not managed by PM2 or already stopped."]);
    } else {
        echo json_encode(['status' => 'error', 'message' => "Failed to stop server '$appName' via PM2. Error code: $returnVar"]);
    }
}
