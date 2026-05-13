<?php
ini_set('display_errors', '0');
error_reporting(E_ERROR);
ob_start(); // Buffer output to prevent PHP warnings from corrupting JSON
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') { http_response_code(200); exit; }

$action = isset($_GET['action']) ? trim($_GET['action'], '/') : '';

function sendResponse($data, $code = 200) {
    if (ob_get_length()) ob_clean(); // Discard any buffered PHP warnings/notices
    http_response_code($code);
    echo json_encode($data);
    exit;
}

// Global exception handler
set_exception_handler(function($e) {
    sendResponse([
        'error' => 'Server Error: ' . $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine()
    ], 500);
});

// Admin auth check — verify admin_id belongs to a user with role=admin
function requireAdmin($conn) {
    // Check various sources for admin_id
    $admin_id = 0;
    
    // 1. Check Query String (GET)
    if (isset($_GET['admin_id'])) {
        $admin_id = (int)$_GET['admin_id'];
    } 
    // 2. Check POST data (for multipart/form-data)
    else if (isset($_POST['admin_id'])) {
        $admin_id = (int)$_POST['admin_id'];
    }
    // 3. Check JSON Body
    else {
        $body = json_decode(file_get_contents('php://input'), true);
        if ($body && isset($body['admin_id'])) {
            $admin_id = (int)$body['admin_id'];
            // Store parsed body for reuse as global
            $GLOBALS['_BODY'] = $body;
        }
    }

    if (!$admin_id) sendResponse(['error' => 'Unauthorized: missing admin_id'], 401);
    $st = $conn->prepare("SELECT role FROM Users WHERE id=:id LIMIT 1");
    $st->execute([':id' => $admin_id]);
    $u = $st->fetch();
    if (!$u || $u['role'] !== 'admin') sendResponse(['error' => 'Forbidden: admin only'], 403);
    return $admin_id;
}

function body() {
    if (isset($GLOBALS['_BODY'])) return $GLOBALS['_BODY'];
    $GLOBALS['_BODY'] = json_decode(file_get_contents('php://input'), true) ?? [];
    return $GLOBALS['_BODY'];
}

global $conn;

try {
    switch ($action) {

    case 'user-report-full':
        requireAdmin($conn);
        $uid = (int)($_GET['user_id'] ?? 0);
        if (!$uid) sendResponse(['error' => 'Missing user_id'], 400);

        // 1. Basic Profile & Aggregated Stats
        $st = $conn->prepare("SELECT id, username, email, role, kelas, daerah, created_at, status FROM Users WHERE id = :id");
        $st->execute([':id' => $uid]);
        $user = $st->fetch(PDO::FETCH_ASSOC);
        if (!$user) sendResponse(['error' => 'User not found'], 404);

        $statsSt = $conn->prepare("
            SELECT 
                COUNT(*) as total_tests,
                ROUND(AVG(wpm), 1) as avg_kpm,
                ROUND(AVG(accuracy), 1) as avg_accuracy,
                MAX(wpm) as best_kpm,
                MAX(CASE WHEN language = 'id' THEN wpm ELSE 0 END) as best_id,
                MAX(CASE WHEN language = 'en' THEN wpm ELSE 0 END) as best_en,
                MAX(CASE WHEN language = 'ar' THEN wpm ELSE 0 END) as best_ar
            FROM Typing_Tests WHERE user_id = :id
        ");
        $statsSt->execute([':id' => $uid]);
        $user['stats'] = $statsSt->fetch(PDO::FETCH_ASSOC);

        // Competition stats
        $compStats = $conn->prepare("
            SELECT 
                COUNT(DISTINCT user_stats.competition_id) as total_comp,
                SUM(CASE WHEN user_stats.user_best_wpm >= global_stats.max_wpm AND global_stats.p_count > 1 THEN 1 ELSE 0 END) as won_comp
            FROM (
                SELECT competition_id, MAX(wpm) as user_best_wpm
                FROM Competition_Results
                WHERE user_id = :id
                GROUP BY competition_id
            ) user_stats
            JOIN (
                SELECT competition_id, MAX(wpm) as max_wpm, COUNT(DISTINCT user_id) as p_count
                FROM Competition_Results
                GROUP BY competition_id
            ) global_stats ON user_stats.competition_id = global_stats.competition_id
        ");
        $compStats->execute([':id' => $uid]);
        $cs = $compStats->fetch(PDO::FETCH_ASSOC);
        $user['stats']['total_comp'] = (int)($cs['total_comp'] ?? 0);
        $user['stats']['won_comp'] = (int)($cs['won_comp'] ?? 0);

        // Practice Progress
        $totalPracTexts = (int)$conn->query("SELECT COUNT(*) FROM Practice_Texts WHERE is_active = 1")->fetchColumn();
        $upcSt = $conn->prepare("SELECT COUNT(DISTINCT practice_text_id) FROM Practice_Results WHERE user_id = :id");
        $upcSt->execute([':id' => $uid]);
        $userPracCount = (int)$upcSt->fetchColumn();
        $user['stats']['practice_perc'] = $totalPracTexts > 0 ? round(($userPracCount / $totalPracTexts) * 100, 1) : 0;
        $user['stats']['total_practice_texts'] = $totalPracTexts;

        // Finger Progress
        $totalFingers = 11; 
        $ufcSt = $conn->prepare("SELECT COUNT(DISTINCT finger_name) FROM Finger_Training_Results WHERE user_id = :id");
        $ufcSt->execute([':id' => $uid]);
        $userFingerCount = (int)$ufcSt->fetchColumn();
        $user['stats']['finger_perc'] = round(($userFingerCount / $totalFingers) * 100, 1);
        $user['stats']['total_finger_patterns'] = $totalFingers;

        // Overall Rank based on Best WPM
        $rankSt = $conn->prepare("
            SELECT COUNT(*) + 1 
            FROM (
                SELECT user_id, MAX(wpm) as best_wpm 
                FROM Typing_Tests 
                GROUP BY user_id
            ) as rankings 
            WHERE best_wpm > (SELECT COALESCE(MAX(wpm), 0) FROM Typing_Tests WHERE user_id = :id)
        ");
        $rankSt->execute([':id' => $uid]);
        $user['stats']['overall_rank'] = (int)$rankSt->fetchColumn();

        // 2. Typing Tests History (All)
        $testsSt = $conn->prepare("SELECT language, wpm, accuracy, correct_words, wrong_words, created_at FROM Typing_Tests WHERE user_id = :id ORDER BY created_at DESC");
        $testsSt->execute([':id' => $uid]);
        $user['typing_tests'] = $testsSt->fetchAll(PDO::FETCH_ASSOC);

        // 3. Competition Results (Grouped by Unique Competition)
        $compSt = $conn->prepare("
            SELECT 
                c.title, 
                c.language,
                COUNT(cr.id) as attempts,
                MAX(cr.wpm) as best_wpm,
                (SELECT accuracy FROM Competition_Results WHERE user_id = :uid AND competition_id = c.id ORDER BY wpm DESC LIMIT 1) as best_accuracy,
                (
                    SELECT COUNT(*) + 1 
                    FROM (
                        SELECT MAX(wpm) as user_best 
                        FROM Competition_Results 
                        WHERE competition_id = c.id 
                        GROUP BY user_id
                    ) rankings 
                    WHERE user_best > MAX(cr.wpm)
                ) as best_rank,
                (SELECT COUNT(DISTINCT user_id) FROM Competition_Results WHERE competition_id = c.id) as total_participants,
                MAX(cr.created_at) as last_date
            FROM Competition_Results cr
            JOIN Competitions c ON cr.competition_id = c.id
            WHERE cr.user_id = :uid
            GROUP BY cr.competition_id
            ORDER BY last_date DESC
        ");
        $compSt->execute([':uid' => $uid]);
        $user['competitions'] = $compSt->fetchAll(PDO::FETCH_ASSOC);

        // 4. Practice Results
        $pracSt = $conn->prepare("
            SELECT pt.title, pr.wpm, pr.accuracy, pr.time_seconds, pr.created_at, pt.language
            FROM Practice_Results pr
            JOIN Practice_Texts pt ON pr.practice_text_id = pt.id
            WHERE pr.user_id = :id ORDER BY pr.created_at DESC
        ");
        $pracSt->execute([':id' => $uid]);
        $user['practice'] = $pracSt->fetchAll(PDO::FETCH_ASSOC);

        // 5. Finger Training Results
        $fingerSt = $conn->prepare("
            SELECT finger_name, wpm, accuracy, created_at
            FROM Finger_Training_Results
            WHERE user_id = :id ORDER BY created_at DESC
        ");
        $fingerSt->execute([':id' => $uid]);
        $user['finger_training'] = $fingerSt->fetchAll(PDO::FETCH_ASSOC);

        // 6. Fetch achievements
        $achStmt = $conn->prepare("
            SELECT a.title, a.badge_icon, a.category, a.requirements_json
            FROM User_Achievements ua
            JOIN Achievements a ON ua.achievement_id = a.id
            WHERE ua.user_id = :uid
            ORDER BY a.category, a.id ASC
        ");
        $achStmt->execute([':uid' => $uid]);
        $user['achievements'] = $achStmt->fetchAll(PDO::FETCH_ASSOC);

        // 7. Settings for PDF (min wpm & ratings)
        $stSets = $conn->query("SELECT setting_key, setting_value FROM Settings");
        $sets = $stSets->fetchAll(PDO::FETCH_KEY_PAIR);
        foreach ($sets as $k => &$v) {
            if (is_numeric($v)) $v = (strpos($v, '.') !== false) ? (float)$v : (int)$v;
            if ($v === 'true' || $v === 'false') $v = ($v === 'true');
            if ($v !== '' && ($v[0] === '{' || $v[0] === '[')) {
                $decoded = json_decode($v, true);
                if (json_last_error() === JSON_ERROR_NONE) $v = $decoded;
            }
        }
        $user['report_settings'] = $sets;

        sendResponse(['report' => $user]);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // DASHBOARD STATS
    // ─────────────────────────────────────────────────────────────────────────
    case 'stats':
        requireAdmin($conn);
        $users      = $conn->query("SELECT COUNT(*) FROM Users")->fetchColumn();
        $tests      = $conn->query("SELECT COUNT(*) FROM Typing_Tests")->fetchColumn();
        $comps      = $conn->query("SELECT COUNT(*) FROM Competitions")->fetchColumn();
        $activeComp = $conn->query("SELECT COUNT(*) FROM Competitions WHERE end_date > NOW()")->fetchColumn();
        $avgKpm     = $conn->query("SELECT ROUND(AVG(wpm),1) FROM Typing_Tests")->fetchColumn() ?? 0;
        $topUser    = $conn->query(
            "SELECT u.username, MAX(t.wpm) as best_kpm
             FROM Typing_Tests t JOIN Users u ON t.user_id=u.id
             GROUP BY u.id ORDER BY best_kpm DESC LIMIT 1"
        )->fetch();
        sendResponse([
            'total_users'       => (int)$users,
            'total_tests'       => (int)$tests,
            'total_competitions'=> (int)$comps,
            'active_competitions'=> (int)$activeComp,
            'avg_kpm'           => (float)$avgKpm,
            'top_user'          => $topUser ?: ['username'=>'—','best_kpm'=>0],
        ]);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // DAILY ACTIVITY (last 14 days)
    // ─────────────────────────────────────────────────────────────────────────
    case 'daily-activity':
        requireAdmin($conn);
        $rows = $conn->query(
            "SELECT DATE(created_at) as day, COUNT(*) as count
             FROM Typing_Tests
             WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
             GROUP BY day ORDER BY day ASC"
        )->fetchAll();
        sendResponse(['data' => $rows]);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // USER GROWTH (last 8 weeks)
    // ─────────────────────────────────────────────────────────────────────────
    case 'user-growth':
        requireAdmin($conn);
        $rows = $conn->query(
            "SELECT week, COUNT(DISTINCT user_id) as count FROM (
                SELECT YEARWEEK(created_at, 1) as week, user_id FROM Typing_Tests
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
                UNION
                SELECT YEARWEEK(created_at, 1) as week, user_id FROM Competition_Results
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
                UNION
                SELECT YEARWEEK(created_at, 1) as week, user_id FROM Practice_Results
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK)
            ) as activity
            GROUP BY week ORDER BY week ASC"
        )->fetchAll();
        sendResponse(['data' => $rows]);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // USERS LIST
    // ─────────────────────────────────────────────────────────────────────────
    case 'users':
        requireAdmin($conn);
        $search = isset($_GET['search']) ? '%'.trim($_GET['search']).'%' : '%';
        $page   = max(1, (int)($_GET['page'] ?? 1));
        $limit  = 20;
        $offset = ($page - 1) * $limit;

        // Sorting
        $allowedSort = ['id', 'username', 'email', 'role', 'kelas', 'status', 'test_count', 'best_kpm', 'created_at'];
        $sort  = in_array($_GET['sort'] ?? '', $allowedSort) ? $_GET['sort'] : 'created_at';
        $order = strtoupper($_GET['order'] ?? '') === 'ASC' ? 'ASC' : 'DESC';
        
        // Map alias to real column if needed
        $sortCol = $sort;
        if ($sort === 'test_count') $sortCol = 'COUNT(t.id)';
        if ($sort === 'best_kpm')   $sortCol = 'COALESCE(MAX(t.wpm),0)';
        if ($sort === 'status')     $sortCol = "u.status";
        if ($sort === 'created_at') $sortCol = 'u.created_at';
        if ($sort === 'id')         $sortCol = 'u.id';

        // Exam Status Filtering
        $examStatus = $_GET['exam_status'] ?? 'all';
        $minWpm = $conn->query("SELECT setting_key, setting_value FROM Settings WHERE setting_key IN ('min_wpm_id', 'min_wpm_en', 'min_wpm_ar')")->fetchAll(PDO::FETCH_KEY_PAIR);
        $minId = (int)($minWpm['min_wpm_id'] ?? 0);
        $minEn = (int)($minWpm['min_wpm_en'] ?? 0);
        $minAr = (int)($minWpm['min_wpm_ar'] ?? 0);

        $having = "";
        if ($examStatus === 'passed') {
            $having = "HAVING best_id >= $minId AND best_en >= $minEn AND best_ar >= $minAr";
        } elseif ($examStatus === 'failed') {
            $having = "HAVING best_id < $minId OR best_en < $minEn OR best_ar < $minAr";
        }

        // Total count for pagination
        if ($having !== "") {
            $totalSt = $conn->prepare("SELECT COUNT(*) FROM (
                SELECT u.id,
                    COALESCE(MAX(CASE WHEN t.language = 'id' THEN t.wpm ELSE 0 END), 0) as best_id,
                    COALESCE(MAX(CASE WHEN t.language = 'en' THEN t.wpm ELSE 0 END), 0) as best_en,
                    COALESCE(MAX(CASE WHEN t.language = 'ar' THEN t.wpm ELSE 0 END), 0) as best_ar
                FROM Users u
                LEFT JOIN Typing_Tests t ON t.user_id = u.id
                WHERE u.username LIKE :s OR u.email LIKE :s OR u.kelas LIKE :s
                GROUP BY u.id
                $having
            ) as sub");
        } else {
            $totalSt = $conn->prepare("SELECT COUNT(*) FROM Users WHERE username LIKE :s OR email LIKE :s OR kelas LIKE :s");
        }
        $totalSt->execute([':s' => $search]);
        $totalCount = (int)$totalSt->fetchColumn();

        // Actual data with sorting and paging
        $limitQuery = "
            SELECT u.id, u.username, u.email, u.role, u.kelas, u.daerah, u.status, u.created_at,
                    COUNT(t.id) as test_count,
                    COALESCE(MAX(t.wpm),0) as best_kpm,
                    COALESCE(MAX(CASE WHEN t.language = 'id' THEN t.wpm ELSE 0 END), 0) as best_id,
                    COALESCE(MAX(CASE WHEN t.language = 'en' THEN t.wpm ELSE 0 END), 0) as best_en,
                    COALESCE(MAX(CASE WHEN t.language = 'ar' THEN t.wpm ELSE 0 END), 0) as best_ar
             FROM Users u
             LEFT JOIN Typing_Tests t ON t.user_id = u.id
             WHERE u.username LIKE :s OR u.email LIKE :s OR u.kelas LIKE :s
             GROUP BY u.id
             $having
             ORDER BY $sortCol $order
             LIMIT $limit OFFSET $offset
        ";
        $st = $conn->prepare($limitQuery);
        $st->execute([':s' => $search]);
        $users = $st->fetchAll(PDO::FETCH_ASSOC);

        sendResponse(['users' => $users, 'total' => $totalCount, 'page' => $page, 'limit' => $limit]);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // USER DETAIL
    // ─────────────────────────────────────────────────────────────────────────
    case 'user-detail':
        requireAdmin($conn);
        $uid = (int)($_GET['user_id'] ?? 0);
        $user = $conn->prepare("SELECT id,username,email,role,kelas,daerah,created_at FROM Users WHERE id=:id");
        $user->execute([':id' => $uid]);
        $u = $user->fetch();
        if (!$u) sendResponse(['error' => 'User not found'], 404);
        // Fetch overall stats
        $statsSt = $conn->prepare("
            SELECT COUNT(*) as total_tests, MAX(wpm) as best_wpm, AVG(accuracy) as avg_accuracy,
                   COALESCE(MAX(CASE WHEN language = 'id' THEN wpm ELSE 0 END), 0) as best_id,
                   COALESCE(MAX(CASE WHEN language = 'en' THEN wpm ELSE 0 END), 0) as best_en,
                   COALESCE(MAX(CASE WHEN language = 'ar' THEN wpm ELSE 0 END), 0) as best_ar
            FROM Typing_Tests WHERE user_id = :id
        ");
        $statsSt->execute([':id' => $uid]);
        $u['stats'] = $statsSt->fetch();

        // Fetch competition stats for modal
        $compStats = $conn->prepare("
            SELECT 
                COUNT(DISTINCT user_stats.competition_id) as total_comp,
                SUM(CASE WHEN user_stats.user_best_wpm >= global_stats.max_wpm AND global_stats.p_count > 1 THEN 1 ELSE 0 END) as won_comp
            FROM (
                SELECT competition_id, MAX(wpm) as user_best_wpm
                FROM Competition_Results
                WHERE user_id = :id
                GROUP BY competition_id
            ) user_stats
            JOIN (
                SELECT competition_id, MAX(wpm) as max_wpm, COUNT(DISTINCT user_id) as p_count
                FROM Competition_Results
                GROUP BY competition_id
            ) global_stats ON user_stats.competition_id = global_stats.competition_id
        ");
        $compStats->execute([':id' => $uid]);
        $cs = $compStats->fetch(PDO::FETCH_ASSOC);
        $u['stats']['total_comp'] = (int)($cs['total_comp'] ?? 0);
        $u['stats']['won_comp'] = (int)($cs['won_comp'] ?? 0);

        // Fetch settings for thresholds and ratings
        $sets = $conn->query("SELECT setting_key, setting_value FROM Settings WHERE setting_key IN ('min_wpm_id', 'min_wpm_en', 'min_wpm_ar', 'typing_ratings')")->fetchAll(PDO::FETCH_KEY_PAIR);
        $u['thresholds'] = [
            'id' => (int)($sets['min_wpm_id'] ?? 0),
            'en' => (int)($sets['min_wpm_en'] ?? 0),
            'ar' => (int)($sets['min_wpm_ar'] ?? 0)
        ];
        $u['ratings'] = !empty($sets['typing_ratings']) ? json_decode($sets['typing_ratings'], true) : [];

        // Fetch tests (20 latest)
        $tests = $conn->prepare(
            "SELECT language,wpm,accuracy,correct_words,wrong_words,created_at
             FROM Typing_Tests WHERE user_id=:id ORDER BY created_at DESC LIMIT 20"
        );
        $tests->execute([':id' => $uid]);
        $u['tests'] = $tests->fetchAll();

        // Fetch achievements
        $achStmt = $conn->prepare("
            SELECT a.title, a.badge_icon, a.category, a.requirements_json
            FROM User_Achievements ua
            JOIN Achievements a ON ua.achievement_id = a.id
            WHERE ua.user_id = :uid
            ORDER BY a.category, a.id ASC
        ");
        $achStmt->execute([':uid' => $uid]);
        $u['achievements'] = $achStmt->fetchAll();

        sendResponse(['user' => $u]);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // ADD USER
    // ─────────────────────────────────────────────────────────────────────────
    case 'add-user':
        requireAdmin($conn);
        $b = body();
        if (empty($b['username']) || empty($b['email']) || empty($b['password'])) {
            sendResponse(['error' => 'Missing fields'], 400);
        }
        $pw   = password_hash($b['password'], PASSWORD_BCRYPT);
        $role = in_array($b['role'] ?? 'user', ['user','admin']) ? $b['role'] : 'user';
        $kelas = $b['kelas'] ?? null;
        $daerah = $b['daerah'] ?? null;
        try {
            $st = $conn->prepare("INSERT INTO Users (username,email,password,role,kelas,daerah) VALUES (:u,:e,:p,:r,:k,:d)");
            $st->execute([':u'=>$b['username'],':e'=>$b['email'],':p'=>$pw,':r'=>$role,':k'=>$kelas,':d'=>$daerah]);
            sendResponse(['message'=>'User created.','id'=>$conn->lastInsertId()], 201);
        } catch(\Exception $e) {
            $code = str_contains($e->getMessage(),'Duplicate') ? 409 : 500;
            sendResponse(['error'=>$e->getMessage()], $code);
        }
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // EDIT USER
    // ─────────────────────────────────────────────────────────────────────────
    case 'edit-user':
        requireAdmin($conn);
        $b = body();
        $uid = (int)($b['user_id'] ?? 0);
        if (!$uid) sendResponse(['error'=>'Missing user_id'], 400);
        $sets = [];$params = [':id'=>$uid];
        if (!empty($b['username'])) { $sets[]='username=:u'; $params[':u']=$b['username']; }
        if (!empty($b['email']))    { $sets[]='email=:e';    $params[':e']=$b['email']; }
        if (!empty($b['role']) && in_array($b['role'],['user','admin'])) { $sets[]='role=:r'; $params[':r']=$b['role']; }
        if (isset($b['kelas']))     { $sets[]='kelas=:k';   $params[':k']=$b['kelas']; }
        if (isset($b['daerah']))    { $sets[]='daerah=:d';  $params[':d']=$b['daerah']; }
        if (!empty($b['status']) && in_array($b['status'],['active','inactive'])) { $sets[]='status=:st'; $params[':st']=$b['status']; }
        if (!empty($b['password'])) { $sets[]='password=:p'; $params[':p']=password_hash($b['password'],PASSWORD_BCRYPT); }
        if (!$sets) sendResponse(['error'=>'Nothing to update'], 400);
        try {
            $conn->prepare("UPDATE Users SET ".implode(',',$sets)." WHERE id=:id")->execute($params);
            sendResponse(['message'=>'User updated.']);
        } catch(\Exception $e) {
            sendResponse(['error'=>$e->getMessage()], 500);
        }
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE USER
    // ─────────────────────────────────────────────────────────────────────────
    case 'delete-user':
        requireAdmin($conn);
        $b = body();
        $uid = (int)($b['user_id'] ?? 0);
        if (!$uid) sendResponse(['error'=>'Missing user_id'], 400);
        $conn->prepare("DELETE FROM Users WHERE id=:id")->execute([':id'=>$uid]);
        sendResponse(['message'=>'User deleted.']);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // WORDS LIST (admin — all, paginated, filterable)
    // ─────────────────────────────────────────────────────────────────────────
    case 'admin-words':
        requireAdmin($conn);
        $lang  = isset($_GET['lang']) && in_array($_GET['lang'],['en','id','ar']) ? $_GET['lang'] : null;
        $page  = max(1, (int)($_GET['page'] ?? 1));
        $limit = 50;
        $offset= ($page-1)*$limit;
        $search = isset($_GET['search']) ? '%'.trim($_GET['search']).'%' : '%';
        $where = ["word LIKE :s"];
        $params = [':s' => $search];
        if ($lang) { $where[] = 'language=:l'; $params[':l'] = $lang; }
        $w = implode(' AND ', $where);
        $st = $conn->prepare("SELECT id,language,word,created_at FROM Word_Lists WHERE $w ORDER BY language,word LIMIT $limit OFFSET $offset");
        $st->execute($params);
        $ct = $conn->prepare("SELECT COUNT(*) FROM Word_Lists WHERE $w");
        $ct->execute($params);
        sendResponse(['words'=>$st->fetchAll(),'total'=>(int)$ct->fetchColumn(),'page'=>$page,'limit'=>$limit]);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // ADD WORD
    // ─────────────────────────────────────────────────────────────────────────
    case 'add-word':
        requireAdmin($conn);
        $b = body();
        if (empty($b['word']) || empty($b['language'])) sendResponse(['error'=>'Missing fields'], 400);
        if (!in_array($b['language'],['en','id','ar'])) sendResponse(['error'=>'Invalid language'], 400);
        $st = $conn->prepare("INSERT INTO Word_Lists (language,word) VALUES (:l,:w)");
        $st->execute([':l'=>$b['language'],':w'=>trim($b['word'])]);
        sendResponse(['message'=>'Word added.','id'=>$conn->lastInsertId()], 201);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // EDIT WORD
    // ─────────────────────────────────────────────────────────────────────────
    case 'edit-word':
        requireAdmin($conn);
        $b = body();
        $id = (int)($b['id'] ?? 0);
        if (!$id || empty($b['word'])) sendResponse(['error'=>'Missing fields'], 400);
        $conn->prepare("UPDATE Word_Lists SET word=:w WHERE id=:id")->execute([':w'=>trim($b['word']),':id'=>$id]);
        sendResponse(['message'=>'Word updated.']);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE WORD
    // ─────────────────────────────────────────────────────────────────────────
    case 'delete-word':
        requireAdmin($conn);
        $b = body();
        $id = (int)($b['id'] ?? 0);
        if (!$id) sendResponse(['error'=>'Missing id'], 400);
        $conn->prepare("DELETE FROM Word_Lists WHERE id=:id")->execute([':id'=>$id]);
        sendResponse(['message'=>'Word deleted.']);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // IMPORT WORDS (CSV text)
    // ─────────────────────────────────────────────────────────────────────────
    case 'import-words':
        requireAdmin($conn);
        $b = body();
        if (empty($b['language']) || empty($b['csv'])) sendResponse(['error'=>'Missing fields'], 400);
        if (!in_array($b['language'],['en','id','ar'])) sendResponse(['error'=>'Invalid language'], 400);
        $words = array_filter(array_map('trim', preg_split('/[\r\n,]+/', $b['csv'])));
        $added = 0;
        $st = $conn->prepare("INSERT IGNORE INTO Word_Lists (language,word) VALUES (:l,:w)");
        foreach ($words as $w) {
            if ($w) { 
                $st->execute([':l'=>$b['language'],':w'=>$w]); 
                $added += $st->rowCount();
            }
        }
        sendResponse(['message'=>"Imported $added words.",'count'=>$added]);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // TYPING RESULTS (all)
    // ─────────────────────────────────────────────────────────────────────────
    case 'results':
        requireAdmin($conn);
        $page  = max(1,(int)($_GET['page']??1));
        $limit = 30;
        $offset= ($page-1)*$limit;
        $lang  = isset($_GET['lang']) && in_array($_GET['lang'],['en','id','ar']) ? $_GET['lang'] : null;
        $where = $lang ? "WHERE t.language=:l" : "";
        $params= $lang ? [':l'=>$lang] : [];
        $st = $conn->prepare(
            "SELECT t.id, u.username, t.language, t.wpm, t.accuracy, t.correct_words, t.wrong_words, t.created_at
             FROM Typing_Tests t JOIN Users u ON t.user_id=u.id $where
             ORDER BY t.created_at DESC LIMIT $limit OFFSET $offset"
        );
        $st->execute($params);
        $ct = $conn->prepare("SELECT COUNT(*) FROM Typing_Tests t $where");
        $ct->execute($params);
        sendResponse(['results'=>$st->fetchAll(),'total'=>(int)$ct->fetchColumn(),'page'=>$page,'limit'=>$limit]);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE RESULT
    // ─────────────────────────────────────────────────────────────────────────
    case 'delete-result':
        requireAdmin($conn);
        $b = body();
        $id = (int)($b['id'] ?? 0);
        if (!$id) sendResponse(['error'=>'Missing id'], 400);
        $conn->prepare("DELETE FROM Typing_Tests WHERE id=:id")->execute([':id'=>$id]);
        sendResponse(['message'=>'Result deleted.']);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // LEADERBOARD (full admin view)
    // ─────────────────────────────────────────────────────────────────────────
    case 'admin-lb':
        requireAdmin($conn);
        $page  = max(1,(int)($_GET['page']??1));
        $limit = 30;
        $offset= ($page-1)*$limit;
        $st = $conn->prepare(
            "SELECT l.id, u.username, l.wpm, l.accuracy, l.language, l.created_at,
                    ROW_NUMBER() OVER (ORDER BY l.wpm DESC, l.accuracy DESC) as `rank`
             FROM Leaderboard l JOIN Users u ON l.user_id=u.id
             ORDER BY l.wpm DESC, l.accuracy DESC LIMIT $limit OFFSET $offset"
        );
        $st->execute();
        $total = $conn->query("SELECT COUNT(*) FROM Leaderboard")->fetchColumn();
        sendResponse(['leaderboard'=>$st->fetchAll(),'total'=>(int)$total,'page'=>$page,'limit'=>$limit]);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE LB ENTRY
    // ─────────────────────────────────────────────────────────────────────────
    case 'delete-lb-entry':
        requireAdmin($conn);
        $b = body();
        $id = (int)($b['id'] ?? 0);
        if (!$id) sendResponse(['error'=>'Missing id'], 400);
        $conn->prepare("DELETE FROM Leaderboard WHERE id=:id")->execute([':id'=>$id]);
        sendResponse(['message'=>'Entry deleted.']);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // MASS MANAGE USERS
    // ─────────────────────────────────────────────────────────────────────────
    case 'import-new-users':
        requireAdmin($conn);
        $b = body();
        if (empty($b['users']) || !is_array($b['users'])) sendResponse(['error' => 'No dataset provided'], 400);
        $imported = 0;
        try {
            $st = $conn->prepare("INSERT IGNORE INTO Users (username, email, password, role, kelas, daerah) VALUES (:un, :em, :pw, :r, :k, :d)");
            foreach ($b['users'] as $u) {
                if (count($u) < 3) continue;
                $un = trim($u[0]);
                $em = trim($u[1]);
                $pw = password_hash(trim($u[2]), PASSWORD_DEFAULT);
                $r  = isset($u[3]) && in_array(strtolower(trim($u[3])), ['admin', 'user']) ? strtolower(trim($u[3])) : 'user';
                $k  = isset($u[4]) ? trim($u[4]) : null;
                $d  = isset($u[5]) ? trim($u[5]) : null;
                if ($un && $em && $pw) {
                    if ($st->execute([
                        ':un' => $un, 
                        ':em' => $em, 
                        ':pw' => $pw, 
                        ':r' => $r, 
                        ':k' => $k !== '' ? $k : null,
                        ':d' => $d !== '' ? $d : null
                    ])) {
                        $imported += $st->rowCount();
                    }
                }
            }
            sendResponse(['message' => 'Import complete', 'imported' => $imported]);
        } catch (PDOException $e) {
            sendResponse(['error' => 'Database error: ' . $e->getMessage()], 500);
        } catch (Exception $e) {
            sendResponse(['error' => 'Error: ' . $e->getMessage()], 500);
        }
        break;

    case 'bulk-edit-users':
        requireAdmin($conn);
        $b = body();
        if (empty($b['ids']) || !is_array($b['ids']) || empty($b['field'])) sendResponse(['error' => 'Invalid payload'], 400);
        $ids = array_map('intval', $b['ids']);
        $idList = implode(',', $ids);
        $field = $b['field'];
        $val = $b['value'] ?? '';

        if ($field === 'role' && in_array(strtolower($val), ['admin', 'user'])) {
            $conn->query("UPDATE Users SET role = '{$val}' WHERE id IN ($idList)");
        } elseif ($field === 'kelas') {
            $st = $conn->prepare("UPDATE Users SET kelas = :v WHERE id IN ($idList)");
            $st->execute([':v' => $val !== '' ? $val : null]);
        } elseif ($field === 'status' && in_array(strtolower($val), ['active', 'inactive'])) {
            $conn->query("UPDATE Users SET status = '{$val}' WHERE id IN ($idList)");
        } else {
            sendResponse(['error' => 'Invalid field or value'], 400);
        }
        sendResponse(['message' => 'Users updated.']);
        break;

    case 'bulk-delete-users':
        requireAdmin($conn);
        $b = body();
        if (empty($b['ids']) || !is_array($b['ids'])) sendResponse(['error' => 'Invalid payload'], 400);
        $ids = implode(',', array_map('intval', $b['ids']));
        $conn->query("DELETE FROM Users WHERE id IN ($ids)");
        sendResponse(['message' => 'Users deleted.']);
        break;

    case 'users-export':
        requireAdmin($conn);
        $st = $conn->query("SELECT id, username, email, role, kelas, daerah, status FROM Users ORDER BY id ASC");
        sendResponse(['users' => $st->fetchAll(PDO::FETCH_ASSOC)]);
        break;

    case 'users-export-scores':
        requireAdmin($conn);
        // Fetch settings for thresholds and ratings
        $sets = $conn->query("SELECT setting_key, setting_value FROM Settings WHERE setting_key IN ('min_wpm_id', 'min_wpm_en', 'min_wpm_ar', 'typing_ratings')")->fetchAll(PDO::FETCH_KEY_PAIR);
        $minId = (int)($sets['min_wpm_id'] ?? 0);
        $minEn = (int)($sets['min_wpm_en'] ?? 0);
        $minAr = (int)($sets['min_wpm_ar'] ?? 0);
        
        $ratings = [];
        if (!empty($sets['typing_ratings'])) {
            $ratings = json_decode($sets['typing_ratings'], true) ?: [];
        }

        $sql = "SELECT u.id, u.username, u.email, u.kelas,
                       COUNT(t.id) as total_tests,
                       COALESCE(MAX(t.wpm), 0) as best_kpm,
                       COALESCE(MAX(CASE WHEN t.language = 'id' THEN t.wpm ELSE 0 END), 0) as best_id,
                       COALESCE(MAX(CASE WHEN t.language = 'en' THEN t.wpm ELSE 0 END), 0) as best_en,
                       COALESCE(MAX(CASE WHEN t.language = 'ar' THEN t.wpm ELSE 0 END), 0) as best_ar
                FROM Users u
                LEFT JOIN Typing_Tests t ON u.id = t.user_id
                GROUP BY u.id
                ORDER BY u.id ASC";
        $st = $conn->query($sql);
        $data = $st->fetchAll(PDO::FETCH_ASSOC);
        
        sendResponse([
            'data' => $data,
            'thresholds' => [
                'id' => $minId,
                'en' => $minEn,
                'ar' => $minAr
            ],
            'ratings' => $ratings
        ]);
        break;

    case 'bulk-sync-users':
        requireAdmin($conn);
        $b = body();
        if (empty($b['updates']) || !is_array($b['updates'])) sendResponse(['error' => 'No updates provided'], 400);
        
        $conn->beginTransaction();
        try {
            $allowedFields = ['username', 'email', 'role', 'kelas', 'daerah', 'password', 'status'];
            foreach ($b['updates'] as $upd) {
                $uid = (int)($upd['id'] ?? 0);
                if (!$uid) continue;
                
                $field = $upd['field'] ?? '';
                $val = $upd['value']; // could be null for classes/daerah

                if (!in_array($field, $allowedFields)) continue;

                if ($field === 'password') {
                    $val = password_hash($val, PASSWORD_DEFAULT);
                }

                $st = $conn->prepare("UPDATE Users SET $field = :v WHERE id = :id");
                $st->execute([':v' => ($val === '' ? null : $val), ':id' => $uid]);
            }
            $conn->commit();
            sendResponse(['message' => 'Sync complete']);
        } catch (Exception $e) {
            $conn->rollBack();
            sendResponse(['error' => 'Sync failed: ' . $e->getMessage()], 500);
        }
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // COMPETITIONS (admin — all including expired)
    // ─────────────────────────────────────────────────────────────────────────
    case 'admin-comps':
        requireAdmin($conn);
        $st = $conn->query(
            "SELECT c.*, COUNT(cr.id) as participants
             FROM Competitions c
             LEFT JOIN Competition_Results cr ON cr.competition_id=c.id
             GROUP BY c.id ORDER BY c.start_date DESC"
        );
        sendResponse(['competitions'=>$st->fetchAll()]);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // ADD COMPETITION
    // ─────────────────────────────────────────────────────────────────────────
    case 'add-competition':
        requireAdmin($conn);
        $b = body();
        if (empty($b['title'])||empty($b['language'])||empty($b['start_date'])||empty($b['end_date'])) {
            sendResponse(['error'=>'Missing required fields'], 400);
        }
        // Generate fixed word snapshot for this competition
        $lang = $b['language'];
        $ws = $conn->prepare("SELECT word FROM Word_Lists WHERE language=:l ORDER BY RAND() LIMIT 80");
        $ws->execute([':l' => $lang]);
        $wsWords = $ws->fetchAll(PDO::FETCH_COLUMN);
        $wsJson  = !empty($wsWords) ? json_encode(array_values($wsWords)) : null;
        $st = $conn->prepare(
            "INSERT INTO Competitions (title,description,language,start_date,end_date,words_snapshot)
             VALUES (:t,:d,:l,:s,:e,:w)"
        );
        $st->execute([':t'=>$b['title'],':d'=>$b['description']??'',':l'=>$lang,':s'=>$b['start_date'],':e'=>$b['end_date'],':w'=>$wsJson]);
        sendResponse(['message'=>'Competition created.','id'=>$conn->lastInsertId()], 201);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // EDIT COMPETITION
    // ─────────────────────────────────────────────────────────────────────────
    case 'edit-competition':
        requireAdmin($conn);
        $b = body();
        $id = (int)($b['id'] ?? 0);
        if (!$id) sendResponse(['error'=>'Missing id'], 400);
        // Regenerate word snapshot only if language changed
        $lang = $b['language'];
        $ws2 = $conn->prepare("SELECT word FROM Word_Lists WHERE language=:l ORDER BY RAND() LIMIT 80");
        $ws2->execute([':l' => $lang]);
        $wsW2  = $ws2->fetchAll(PDO::FETCH_COLUMN);
        $wsJson2 = !empty($wsW2) ? json_encode(array_values($wsW2)) : null;
        $conn->prepare(
            "UPDATE Competitions SET title=:t,description=:d,language=:l,start_date=:s,end_date=:e,words_snapshot=:w WHERE id=:id"
        )->execute([':t'=>$b['title'],':d'=>$b['description']??'',':l'=>$lang,':s'=>$b['start_date'],':e'=>$b['end_date'],':w'=>$wsJson2,':id'=>$id]);
        sendResponse(['message'=>'Competition updated.']);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE COMPETITION
    // ─────────────────────────────────────────────────────────────────────────
    case 'delete-competition':
        requireAdmin($conn);
        $b = body();
        $id = (int)($b['id'] ?? 0);
        if (!$id) sendResponse(['error'=>'Missing id'], 400);
        try {
            // Migrate FK to SET NULL if it still uses CASCADE (one-time, safe to run repeatedly)
            $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_SILENT);
            $conn->exec("ALTER TABLE Competition_Results DROP FOREIGN KEY competition_results_ibfk_1");
            $conn->exec("ALTER TABLE Competition_Results MODIFY COLUMN competition_id INT NULL");
            $conn->exec("ALTER TABLE Competition_Results ADD CONSTRAINT competition_results_ibfk_1 FOREIGN KEY (competition_id) REFERENCES Competitions(id) ON DELETE SET NULL");
            $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            // Now delete the competition — results will have competition_id set to NULL, not deleted
            $conn->prepare("DELETE FROM Competitions WHERE id=:id")->execute([':id'=>$id]);
            sendResponse(['message'=>'Competition deleted. Results history preserved.']);
        } catch (PDOException $e) {
            sendResponse(['error'=>'Delete failed: '.$e->getMessage()], 500);
        }
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // MULTIPLAYER STATS (polls Node server health endpoint)
    // ─────────────────────────────────────────────────────────────────────────
    case 'multiplayer-stats':
        requireAdmin($conn);
        // Load node URL from settings
        $settingsFile = __DIR__ . '/settings.json';
        $defaultUrl = 'http://localhost:3000';
        $nodeUrl = $defaultUrl;
        if (file_exists($settingsFile)) {
            $s = json_decode(file_get_contents($settingsFile), true);
            $nodeUrl = $s['node_server_url'] ?? $defaultUrl;
        }
        
        $healthUrl = rtrim($nodeUrl, '/') . '/health';
        $ctx = stream_context_create(['http'=>['timeout'=>2,'ignore_errors'=>true]]);
        $raw = @file_get_contents($healthUrl, false, $ctx);
        if ($raw !== false) {
            $data = json_decode($raw, true);
            sendResponse(['online'=>true,'data'=>$data]);
        } else {
            // Server offline — return recent multiplayer activity from DB
            $recent = $conn->query(
                "SELECT u.username, t.wpm, t.created_at
                 FROM Typing_Tests t JOIN Users u ON t.user_id=u.id
                 WHERE t.created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                 ORDER BY t.created_at DESC LIMIT 20"
            )->fetchAll();
            sendResponse(['online'=>false,'recent_activity'=>$recent]);
        }
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // STATISTICS
    // ─────────────────────────────────────────────────────────────────────────
    case 'statistics':
        requireAdmin($conn);
        // Tests per day (last 30 days)
        $daily = $conn->query(
            "SELECT DATE(created_at) as day, COUNT(*) as tests, ROUND(AVG(wpm),1) as avg_kpm
             FROM Typing_Tests WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
             GROUP BY day ORDER BY day ASC"
        )->fetchAll();
        // Language distribution
        $langDist = $conn->query(
            "SELECT language, COUNT(*) as count FROM Typing_Tests GROUP BY language"
        )->fetchAll();
        // Top 10 most active users
        $topUsers = $conn->query(
            "SELECT u.username, COUNT(t.id) as tests, ROUND(AVG(t.wpm),1) as avg_kpm, MAX(t.wpm) as best_kpm
             FROM Typing_Tests t JOIN Users u ON t.user_id=u.id
             GROUP BY u.id ORDER BY tests DESC LIMIT 10"
        )->fetchAll();
        // Avg KPM per language
        $avgPerLang = $conn->query(
            "SELECT language, ROUND(AVG(wpm),1) as avg_kpm FROM Typing_Tests GROUP BY language"
        )->fetchAll();
        sendResponse([
            'daily'      => $daily,
            'lang_dist'  => $langDist,
            'top_users'  => $topUsers,
            'avg_per_lang'=> $avgPerLang,
        ]);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // ACTIVITY LOGS (simulated from recent DB actions)
    // ─────────────────────────────────────────────────────────────────────────
    case 'activity-logs':
        requireAdmin($conn);
        $page  = max(1,(int)($_GET['page']??1));
        $limit = 30;
        $offset= ($page-1)*$limit;
        // Merge recent registrations + recent tests as activity log (union)
        $st = $conn->prepare("
            (SELECT 'User Registered' as event, username as actor, email as detail, created_at FROM Users ORDER BY created_at DESC LIMIT 50)
            UNION ALL
            (SELECT 'Test Completed' as event, u.username as actor, CONCAT('KPM: ',t.wpm,' | Lang: ',t.language) as detail, t.created_at FROM Typing_Tests t JOIN Users u ON t.user_id=u.id ORDER BY t.created_at DESC LIMIT 50)
            UNION ALL
            (SELECT 'Competition Created' as event, 'admin' as actor, title as detail, created_at FROM Competitions ORDER BY created_at DESC LIMIT 20)
            ORDER BY created_at DESC LIMIT $limit OFFSET $offset
        ");
        $st->execute();
        sendResponse(['logs'=>$st->fetchAll(),'page'=>$page,'limit'=>$limit]);
        break;

    // ─────────────────────────────────────────────────────────────────────────
    // SETTINGS (read/write to JSON file)
    // ─────────────────────────────────────────────────────────────────────────
    case 'settings':
        requireAdmin($conn);
        $defaults = [
            'site_name'        => 'Mafatype.',
            'max_room_players' => 4,
            'default_language' => 'id',
            'allow_register'   => true,
            'maintenance_mode' => false,
            'node_server_url'  => 'http://localhost:3001',
            'min_wpm_id'       => 0,
            'min_wpm_en'       => 0,
            'min_wpm_ar'       => 0,
            'min_attempts_practice' => 1,
            'min_attempts_finger'   => 1,
            'typing_ratings'   => '[]',
        ];

        if ($method === 'GET') {
            $st = $conn->query("SELECT setting_key, setting_value FROM Settings");
            $rows = $st->fetchAll(PDO::FETCH_KEY_PAIR);
            
            // Clean values (convert numeric strings back to numbers, "1"/"0" to bool)
            foreach ($rows as $k => &$v) {
                if (is_numeric($v)) $v = (strpos($v, '.') !== false) ? (float)$v : (int)$v;
                if ($v === 'true' || $v === 'false') $v = ($v === 'true');
                if ($v !== '' && ($v[0] === '{' || $v[0] === '[')) {
                    $decoded = json_decode($v, true);
                    if (json_last_error() === JSON_ERROR_NONE) $v = $decoded;
                }
            }
            
            sendResponse(['settings' => array_merge($defaults, $rows)]);
        } else {
            $b = body();
            unset($b['admin_id']);
            
            $stmt = $conn->prepare("INSERT INTO Settings (setting_key, setting_value) VALUES (:key, :val) 
                                    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
            
            foreach ($b as $k => $v) {
                $valToSave = is_string($v) ? $v : (is_bool($v) ? ($v ? 'true' : 'false') : json_encode($v));
                $stmt->execute([':key' => $k, ':val' => $valToSave]);
            }
            
            // Re-fetch everything to return as response
            $st = $conn->query("SELECT setting_key, setting_value FROM Settings");
            $refetched = $st->fetchAll(PDO::FETCH_KEY_PAIR);
            
            sendResponse(['message'=>'Settings saved.','settings'=>$refetched]);
        }
        break;

    // ── Admin: Practice Texts List ────────────────────────────────────────────
    case 'admin-practice-texts':
        requireAdmin($conn);
        $lang = isset($_GET['lang']) ? $_GET['lang'] : '';
        $where = ''; $params = [];
        if ($lang && in_array($lang, ['en','id','ar'])) {
            $where = 'WHERE language = :lang';
            $params[':lang'] = $lang;
        }
        $st = $conn->prepare("SELECT id, title, description, language, difficulty, is_active, created_at, LENGTH(content) AS char_count FROM Practice_Texts $where ORDER BY id DESC");
        $st->execute($params);
        sendResponse(['texts' => $st->fetchAll()]);
        break;

    // ── Admin: Save (Add/Edit) Practice Text ─────────────────────────────────
    case 'admin-save-practice-text':
        requireAdmin($conn);
        $b = body();
        if (empty($b['title']) || empty($b['content']) || empty($b['language'])) {
            sendResponse(['error' => 'title, content, language are required'], 400);
        }
        $title       = htmlspecialchars(strip_tags($b['title']));
        $description = trim($b['description'] ?? '');
        $content     = trim($b['content']);
        $language    = in_array($b['language'], ['en','id','ar']) ? $b['language'] : 'id';
        $diff        = in_array($b['difficulty'] ?? '', ['easy','medium','hard']) ? $b['difficulty'] : 'medium';
        $active      = isset($b['is_active']) ? (int)$b['is_active'] : 1;

        if (!empty($b['id'])) {
            // Edit
            $st = $conn->prepare("UPDATE Practice_Texts SET title=:t, description=:desc, content=:c, language=:l, difficulty=:d, is_active=:a WHERE id=:id");
            $st->execute([':t'=>$title,':desc'=>$description,':c'=>$content,':l'=>$language,':d'=>$diff,':a'=>$active,':id'=>(int)$b['id']]);
            sendResponse(['message' => 'Text updated.']);
        } else {
            // Add
            $st = $conn->prepare("INSERT INTO Practice_Texts (title, description, content, language, difficulty, is_active) VALUES (:t,:desc,:c,:l,:d,:a)");
            $st->execute([':t'=>$title,':desc'=>$description,':c'=>$content,':l'=>$language,':d'=>$diff,':a'=>$active]);
            sendResponse(['message' => 'Text added.', 'id' => $conn->lastInsertId()], 201);
        }
        break;

    // ── Admin: Delete Practice Text ───────────────────────────────────────────
    case 'admin-delete-practice-text':
        requireAdmin($conn);
        $b = body();
        $id = (int)($b['id'] ?? 0);
        if (!$id) sendResponse(['error' => 'Missing id'], 400);
        $conn->prepare("DELETE FROM Practice_Results WHERE practice_text_id=:id")->execute([':id'=>$id]);
        $conn->prepare("DELETE FROM Practice_Texts WHERE id=:id")->execute([':id'=>$id]);
        sendResponse(['message' => 'Text deleted.']);
        break;

    // ── Admin: Achievements List ──────────────────────────────────────────────
    case 'admin-achievements':
        requireAdmin($conn);
        $st = $conn->query("SELECT id, title, description, category, badge_icon, requirements_json, created_at FROM Achievements ORDER BY id DESC");
        sendResponse(['achievements' => $st->fetchAll(PDO::FETCH_ASSOC)]);
        break;

    // ── Admin: Save (Add/Edit) Achievement ───────────────────────────────────
    case 'admin-save-achievement':
        requireAdmin($conn);
        $b = body();
        if (empty($b['title']) || empty($b['description']) || empty($b['category']) || empty($b['requirements_json'])) {
            sendResponse(['error' => 'title, description, category, requirements_json are required'], 400);
        }
        $title       = htmlspecialchars(strip_tags($b['title']));
        $description = trim($b['description']);
        $category    = $b['category'];
        $badge_icon  = $b['badge_icon'] ?? '🏆';
        $reqs        = $b['requirements_json']; // Should be JSON string or array (body() handles json decode)
        
        // Ensure requirements_json is a valid JSON string if it's an array/object
        $reqsStr = is_string($reqs) ? $reqs : json_encode($reqs);

        if (!empty($b['id'])) {
            // Edit
            $st = $conn->prepare("UPDATE Achievements SET title=:t, description=:desc, category=:c, badge_icon=:b, requirements_json=:r WHERE id=:id");
            $st->execute([':t'=>$title, ':desc'=>$description, ':c'=>$category, ':b'=>$badge_icon, ':r'=>$reqsStr, ':id'=>(int)$b['id']]);
            sendResponse(['message' => 'Achievement updated.']);
        } else {
            // Add
            $st = $conn->prepare("INSERT INTO Achievements (title, description, category, badge_icon, requirements_json) VALUES (:t, :desc, :c, :b, :r)");
            $st->execute([':t'=>$title, ':desc'=>$description, ':c'=>$category, ':b'=>$badge_icon, ':r'=>$reqsStr]);
            sendResponse(['message' => 'Achievement added.', 'id' => $conn->lastInsertId()], 201);
        }
        break;

    // ── Admin: Delete Achievement ─────────────────────────────────────────────
    case 'admin-delete-achievement':
        requireAdmin($conn);
        $b = body();
        $id = (int)($b['id'] ?? 0);
        if (!$id) sendResponse(['error' => 'Missing id'], 400);
        
        // Note: User_Achievements entries will be deleted automatically due to ON DELETE CASCADE
        $conn->prepare("DELETE FROM Achievements WHERE id=:id")->execute([':id'=>$id]);
        sendResponse(['message' => 'Achievement deleted.']);
        break;

    case 'reset-data':
        $admin_id = requireAdmin($conn);
        $b = body();
        $targets = $b['targets'] ?? []; // Array of categories to reset
        
        if (empty($targets)) sendResponse(['error' => 'Pilih setidaknya satu kategori data untuk dibersihkan.'], 400);

        $conn->beginTransaction();
        try {
            $messages = [];
            
            // 1. TYPING RESULTS & LEADERBOARD
            if (in_array('results', $targets)) {
                $conn->exec("DELETE FROM Competition_Results");
                $conn->exec("DELETE FROM Practice_Results");
                $conn->exec("DELETE FROM Typing_Tests");
                $conn->exec("DELETE FROM Leaderboard");
                $messages[] = 'Hasil tes & leaderboard';
            }

            // 2. COMPETITIONS
            if (in_array('competitions', $targets)) {
                $conn->exec("DELETE FROM Competition_Results"); // Dependancy
                $conn->exec("DELETE FROM Competitions");
                $messages[] = 'Kompetisi';
            }

            // 3. PRACTICE TEXTS
            if (in_array('practice', $targets)) {
                $conn->exec("DELETE FROM Practice_Results"); // Dependancy
                $conn->exec("DELETE FROM Practice_Texts");
                $messages[] = 'Teks latihan';
            }

            // 4. WORD LISTS
            if (in_array('words', $targets)) {
                $conn->exec("DELETE FROM Word_Lists");
                $messages[] = 'Word list';
            }

            // 6. FINGER TRAINING
            if (in_array('finger_training', $targets)) {
                $conn->exec("DELETE FROM Finger_Training_Results");
                $messages[] = 'Riwayat finger training';
            }

            // 7. USER ACHIEVEMENTS
            if (in_array('user_achievements', $targets)) {
                $conn->exec("DELETE FROM User_Achievements");
                $messages[] = 'Capaian user (achievements)';
            }

            // 5. USERS (except admin)
            if (in_array('users', $targets)) {
                // Clear all related data first due to FKs if they exist
                $conn->exec("DELETE FROM Competition_Results");
                $conn->exec("DELETE FROM Practice_Results");
                $conn->exec("DELETE FROM Typing_Tests");
                $conn->exec("DELETE FROM Leaderboard");
                
                $conn->prepare("DELETE FROM Users WHERE role != 'admin' AND id != :aid")
                     ->execute([':aid' => $admin_id]);
                $messages[] = 'User (non-admin)';
            }

            $conn->commit();
            $msg = "Berhasil membersihkan: " . implode(', ', $messages) . ".";
            sendResponse(['message' => $msg]);
        } catch (Exception $e) {
            $conn->rollBack();
            sendResponse(['error' => 'Gagal meriset data: ' . $e->getMessage()], 500);
        }
        break;

    case 'upload-logo':
        requireAdmin($conn);
        if (empty($_FILES['logo'])) sendResponse(['error' => 'No file uploaded'], 400);
        
        $file = $_FILES['logo'];
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $allowed = ['jpg', 'jpeg', 'png', 'svg', 'webp'];
        if (!in_array(strtolower($ext), $allowed)) {
            sendResponse(['error' => 'Invalid file type. Allowed: ' . implode(', ', $allowed)], 400);
        }

        $uploadDir = __DIR__ . '/../uploads/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);

        $filename = 'logo_' . time() . '.' . $ext;
        $target = $uploadDir . $filename;
        
        if (move_uploaded_file($file['tmp_name'], $target)) {
            $logoPath = 'uploads/' . $filename;
            sendResponse(['message' => 'Logo uploaded', 'logo_path' => $logoPath]);
        } else {
            sendResponse(['error' => 'Failed to move uploaded file'], 500);
        }
        break;

    default:
        sendResponse(['error' => 'Unknown admin action: ' . htmlspecialchars($action)], 404);
        break;
    }
} catch (Exception $e) {
    sendResponse(['error' => $e->getMessage()], 500);
}
