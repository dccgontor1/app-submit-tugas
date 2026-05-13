<?php
header('Content-Type: application/json');

// Check if port 3000 is in use
function isPortInUse($port) {
    $fp = @fsockopen('localhost', $port, $errno, $errstr, 0.1);
    if ($fp) {
        fclose($fp);
        return true;
    }
    return false;
}

$dir = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'node-server';
$appName = "mafatype-multiplayer";

// Command to start Node server using PM2
// We use --name to identify it easily
$cmd = "pm2 start server.js --name \"$appName\"";

// Check if directory exists
if (!is_dir($dir)) {
    echo json_encode(['status' => 'error', 'message' => 'Directory node-server not found: ' . $dir]);
    exit;
}

chdir($dir);

// Check if already running in PM2
$checkCmd = "pm2 describe \"$appName\"";
exec($checkCmd, $checkOutput, $checkReturn);

if ($checkReturn === 0) {
    // Already exists in PM2, just restart or start if stopped
    exec("pm2 start \"$appName\"", $output, $returnVar);
} else {
    // Try PM2 first
    exec($cmd, $output, $returnVar);
    
    // Fallback: If PM2 fails, try starting directly in background (Windows)
    if ($returnVar !== 0) {
        $manualCmd = "start /B node server.js > server_log.txt 2>&1";
        pclose(popen($manualCmd, "r"));
    }
}

// Give it a second to start before checking
sleep(2);

if (isPortInUse(3005)) {
    echo json_encode(['status' => 'success', 'message' => 'Server started successfully.']);
} else {
    $log = implode("\n", $output);
    echo json_encode(['status' => 'error', 'message' => 'Failed to start server. Try running "node server.js" manually in node-server folder.']);
}
