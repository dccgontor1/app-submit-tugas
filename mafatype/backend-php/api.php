<?php
// Suppress PHP warnings/notices that would corrupt JSON output ONLY if entry point
if (basename($_SERVER['SCRIPT_FILENAME']) === 'api.php') {
    ini_set('display_errors', '0');
    error_reporting(E_ERROR);
    ob_start(); // Buffer all output so stray PHP warnings don't break JSON
}
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Support OPTIONS preflight
if ($method === 'OPTIONS') { http_response_code(200); exit; }

// Determine action: from ?action= or PATH_INFO fallback
$action = '';
if (isset($_GET['action']) && $_GET['action'] !== '') {
    $action = trim($_GET['action'], '/');
} else {
    // Fallback: try PATH_INFO (works if AllowEncodedSlashes On + AcceptPathInfo On)
    $pathInfo = isset($_SERVER['PATH_INFO']) ? $_SERVER['PATH_INFO'] : '';
    if ($pathInfo === '') {
        // Last resort: parse from REQUEST_URI
        $script   = $_SERVER['SCRIPT_NAME'] ?? ''; 
        $uri      = isset($_SERVER['REQUEST_URI']) ? parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) : '';
        $pathInfo = $script ? substr($uri, strlen($script)) : '';
    }
    $action = trim($pathInfo, '/');
}

function sendResponse($data, $code = 200) {
    ob_clean(); // Discard any PHP warnings/notices that got buffered
    http_response_code($code);
    echo json_encode($data);
    exit;
}

global $conn;

class AchievementManager {
    /**
     * Checks if any achievements can be unlocked for the user.
     * @param int $userId
     * @param string|null $type Hint about what just happened (typing_test, practice, competition, finger_training) to optimize checks.
     */
    public static function check($userId, ?string $type = null) {
        $userId = (int)$userId;
        global $conn;
        $unlockedAchievements = [];

        // Mapping trigger types to Achievement Categories
        $typeToCategory = [
            'typing_test'     => ['typing_speed', 'typing_activity', 'accuracy'],
            'practice'        => ['practice_training'],
            'competition'     => ['competition'],
            'finger_training' => ['finger_training']
        ];

        $categories = $type && isset($typeToCategory[$type]) ? $typeToCategory[$type] : [];
        
        // Build query to fetch only relevant achievements that are NOT yet unlocked
        $sql = "SELECT * FROM Achievements a 
                WHERE a.id NOT IN (SELECT achievement_id FROM User_Achievements WHERE user_id = :uid)";
        
        if (!empty($categories)) {
            $catPlaceholders = implode(',', array_map(fn($i) => ":c$i", range(0, count($categories)-1)));
            $sql .= " AND a.category IN ($catPlaceholders)";
        }

        $stmt = $conn->prepare($sql);
        $params = [':uid' => $userId];
        if (!empty($categories)) {
            foreach ($categories as $i => $cat) $params[":c$i"] = $cat;
        }
        $stmt->execute($params);
        $achievements = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($achievements)) return [];

        foreach ($achievements as $ach) {
            $req = json_decode($ach['requirements_json'], true);
            $unlock = false;

            switch ($req['type'] ?? '') {
                case 'wpm':
                    if (!isset($req['min'])) continue 2;
                    $st = $conn->prepare("SELECT MAX(wpm) FROM Typing_Tests WHERE user_id = :uid");
                    $st->execute([':uid' => $userId]);
                    $maxWpm = $st->fetchColumn();
                    if ($maxWpm >= $req['min']) $unlock = true;
                    break;

                case 'test_count':
                    if (!isset($req['min'], $req['min_wpm'])) continue 2;
                    $st = $conn->prepare("SELECT COUNT(*) FROM Typing_Tests WHERE user_id = :uid AND wpm >= :min_wpm");
                    $st->execute([':uid' => $userId, ':min_wpm' => (int)$req['min_wpm']]);
                    if ($st->fetchColumn() >= $req['min']) $unlock = true;
                    break;

                case 'accuracy':
                    if (!isset($req['min'])) continue 2;
                    $st = $conn->prepare("SELECT MAX(accuracy) FROM Typing_Tests WHERE user_id = :uid");
                    $st->execute([':uid' => $userId]);
                    if ($st->fetchColumn() >= $req['min']) $unlock = true;
                    break;

                case 'accuracy_count':
                    if (!isset($req['min'], $req['min_accuracy'])) continue 2;
                    $st = $conn->prepare("SELECT COUNT(*) FROM Typing_Tests WHERE user_id = :uid AND accuracy >= :min_acc");
                    $st->execute([':uid' => $userId, ':min_acc' => (float)$req['min_accuracy']]);
                    if ($st->fetchColumn() >= $req['min']) $unlock = true;
                    break;

                case 'practice_count':
                    if (!isset($req['min'])) continue 2;
                    // Count unique practice texts completed in 'general' category
                    $st = $conn->prepare("
                        SELECT COUNT(DISTINCT practice_text_id) 
                        FROM Practice_Results pr
                        JOIN Practice_Texts pt ON pr.practice_text_id = pt.id
                        WHERE pr.user_id = :uid AND pt.category = 'general'
                    ");
                    $st->execute([':uid' => $userId]);
                    if ($st->fetchColumn() >= $req['min']) $unlock = true;
                    break;

                case 'finger_count':
                    if (!isset($req['min'])) continue 2;
                    // FIX: Check Finger_Training_Results table instead of Practice_Results
                    $st = $conn->prepare("SELECT COUNT(*) FROM Finger_Training_Results WHERE user_id = :uid");
                    $st->execute([':uid' => $userId]);
                    if ($st->fetchColumn() >= $req['min']) $unlock = true;
                    break;

                case 'comp_count':
                    if (!isset($req['min'])) continue 2;
                    $st = $conn->prepare("SELECT COUNT(DISTINCT competition_id) FROM Competition_Results WHERE user_id = :uid");
                    $st->execute([':uid' => $userId]);
                    if ($st->fetchColumn() >= $req['min']) $unlock = true;
                    break;

                case 'flawless_streak':
                    if (!isset($req['min'], $req['min_wpm'])) continue 2;
                    $limit = (int)$req['min'];
                    $st = $conn->prepare("SELECT accuracy, wpm FROM Typing_Tests WHERE user_id = :uid ORDER BY id DESC LIMIT :lim");
                    $st->bindValue(':uid', $userId, PDO::PARAM_INT);
                    $st->bindValue(':lim', $limit, PDO::PARAM_INT);
                    $st->execute();
                    $recent = $st->fetchAll(PDO::FETCH_ASSOC);
                    if (count($recent) >= $limit) {
                        $isFlawless = true;
                        foreach ($recent as $r) {
                            if ((float)$r['accuracy'] < 100.0 || (int)$r['wpm'] < $req['min_wpm']) {
                                $isFlawless = false;
                                break;
                            }
                        }
                        if ($isFlawless) $unlock = true;
                    }
                    break;

                case 'comp_rank_one':
                    if (!isset($req['min_participants'], $req['min_count'])) continue 2;
                    // Count competitions where this user is at the top (highest WPM, then highest Acc)
                    // and competition has at least min_participants
                    $st = $conn->prepare("
                        SELECT COUNT(*) FROM (
                            SELECT cr.competition_id
                            FROM Competition_Results cr
                            JOIN (
                                SELECT competition_id, MAX(wpm) as max_wpm
                                FROM Competition_Results
                                GROUP BY competition_id
                            ) m ON cr.competition_id = m.competition_id AND cr.wpm = m.max_wpm
                            JOIN (
                                SELECT competition_id, wpm, MAX(accuracy) as max_acc
                                FROM Competition_Results
                                GROUP BY competition_id, wpm
                            ) ma ON cr.competition_id = ma.competition_id AND cr.wpm = ma.wpm AND cr.accuracy = ma.max_acc
                            WHERE cr.user_id = :uid
                            GROUP BY cr.competition_id
                            HAVING (SELECT COUNT(DISTINCT user_id) FROM Competition_Results crp WHERE crp.competition_id = cr.competition_id) >= :min_p
                        ) sub
                    ");
                    $st->execute([':uid' => $userId, ':min_p' => (int)$req['min_participants']]);
                    if ($st->fetchColumn() >= $req['min_count']) $unlock = true;
                    break;

                case 'comp_repeat_count':
                    if (!isset($req['min_repeats'], $req['min_comp_count'])) continue 2;
                    // Count competitions where user has at least min_repeats attempts
                    $st = $conn->prepare("
                        SELECT COUNT(*) FROM (
                            SELECT competition_id
                            FROM Competition_Results
                            WHERE user_id = :uid
                            GROUP BY competition_id
                            HAVING COUNT(*) >= :min_r
                        ) sub
                    ");
                    $st->execute([':uid' => $userId, ':min_r' => (int)$req['min_repeats']]);
                    if ($st->fetchColumn() >= $req['min_comp_count']) $unlock = true;
                    break;

                case 'finger_each_count':
                    if (!isset($req['min'])) continue 2;
                    $st = $conn->prepare("
                        SELECT finger_name
                        FROM Finger_Training_Results 
                        WHERE user_id = :uid
                        GROUP BY finger_name
                        HAVING COUNT(*) >= :min
                    ");
                    $st->execute([':uid' => $userId, ':min' => (int)($req['min'] ?? 1)]);
                    $completedFingers = $st->fetchAll(PDO::FETCH_COLUMN);
                    
                    // Standard fingers list (case-insensitive and hyphen/underscore flexible)
                    $expected = ['left-pinky', 'left-ring', 'left-middle', 'left-index', 'right-index', 'right-middle', 'right-ring', 'right-pinky', 'all-fingers'];
                    $found = 0;
                    foreach ($expected as $exp) {
                        $alt = str_replace('-', '_', $exp);
                        foreach ($completedFingers as $got) {
                            if (strtolower($got) === $exp || strtolower($got) === $alt) {
                                $found++;
                                break;
                            }
                        }
                    }
                    if ($found >= 9) $unlock = true;
                    break;
            }

            if ($unlock) {
                // Double check with INSERT IGNORE to handle concurrency
                $ins = $conn->prepare("INSERT IGNORE INTO User_Achievements (user_id, achievement_id) VALUES (:uid, :aid)");
                $ins->execute([':uid' => $userId, ':aid' => $ach['id']]);
                
                if ($ins->rowCount() > 0) {
                    $unlockedAchievements[] = [
                        'title' => $ach['title'],
                        'description' => $ach['description'],
                        'badge_icon' => $ach['badge_icon']
                    ];
                }
            }
        }
        return $unlockedAchievements;
    }
}


// --- Execute Action if this is the entry point ---
if (isset($action) && basename($_SERVER['SCRIPT_FILENAME']) === 'api.php') {
    switch ($action) {

    // ── Register ──────────────────────────────────────────────────────────────
    case 'register':
        $st_set = $conn->prepare("SELECT setting_value FROM Settings WHERE setting_key = 'allow_register'");
        $st_set->execute();
        $allow_reg = $st_set->fetchColumn();
        if ($allow_reg === 'false') {
            sendResponse(['error' => 'Registration is currently disabled.'], 403);
        }
        if ($method !== 'POST') { sendResponse(['error' => 'Method not allowed'], 405); }
        $data = json_decode(file_get_contents('php://input'));
        if (empty($data->username) || empty($data->email) || empty($data->password)) {
            sendResponse(['error' => 'Incomplete registration data.'], 400);
        }
        $username = htmlspecialchars(strip_tags($data->username));
        $email    = htmlspecialchars(strip_tags($data->email));
        $password = password_hash($data->password, PASSWORD_BCRYPT);
        try {
            $st = $conn->prepare("INSERT INTO Users (username,email,password) VALUES (:u,:e,:p)");
            $st->execute([':u' => $username, ':e' => $email, ':p' => $password]);
            sendResponse(['message' => 'Registered successfully.', 'user_id' => $conn->lastInsertId()], 201);
        } catch(PDOException $e) {
            $code = $e->errorInfo[1] == 1062 ? 409 : 500;
            $msg  = $code === 409 ? 'Username or email already exists.' : $e->getMessage();
            sendResponse(['error' => $msg], $code);
        }
        break;

    // ── Global Settings ───────────────────────────────────────────────────────
    case 'global-settings':
        $st = $conn->query("SELECT setting_key, setting_value FROM Settings WHERE setting_key IN ('site_name', 'site_logo', 'site_base_color', 'maintenance_mode', 'default_language', 'typing_ratings', 'min_wpm_id', 'min_wpm_en', 'min_wpm_ar', 'min_attempts_practice', 'min_attempts_finger', 'site_slogan_id', 'site_slogan_en', 'site_slogan_ar', 'site_description_id', 'site_description_en', 'site_description_ar')");
        $rows = $st->fetchAll(PDO::FETCH_KEY_PAIR);
        
        // Clean values (convert numeric strings back to numbers, "1"/"0" to bool, JSON strings to objects)
        foreach ($rows as $k => &$v) {
            if (is_numeric($v)) $v = (strpos($v, '.') !== false) ? (float)$v : (int)$v;
            if ($v === 'true' || $v === 'false') $v = ($v === 'true');
            if ($v !== '' && ($v[0] === '{' || $v[0] === '[')) {
                $decoded = json_decode($v, true);
                if (json_last_error() === JSON_ERROR_NONE) $v = $decoded;
            }
        }
        
        sendResponse(['settings' => $rows]);
        break;

    // ── Login ─────────────────────────────────────────────────────────────────
    case 'login':
        if ($method !== 'POST') { sendResponse(['error' => 'Method not allowed'], 405); }
        $data = json_decode(file_get_contents('php://input'));
        if (empty($data->email) || empty($data->password)) {
            sendResponse(['error' => 'Incomplete login data.'], 400);
        }
        $st = $conn->prepare("SELECT id,username,email,password,role,kelas,daerah,status FROM Users WHERE email=:e LIMIT 1");
        $st->execute([':e' => $data->email]);
        $user = $st->fetch();
        if (!$user || !password_verify($data->password, $user['password'])) {
            sendResponse(['error' => 'Invalid email or password.'], 401);
        }
        
        // Check if user is inactive
        if ($user['status'] === 'inactive') {
            sendResponse(['error' => 'Akun Anda sedang dinonaktifkan (Inactive). Silakan hubungi admin.'], 403);
        }
        sendResponse(['message' => 'Login successful.', 'user' => [
            'id'       => $user['id'],
            'username' => $user['username'],
            'email'    => $user['email'],
            'role'     => $user['role'],
            'status'   => $user['status'],
            'kelas'    => $user['kelas'],
            'daerah'   => $user['daerah'],
        ]]);
        break;

    case 'words':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $lang   = isset($_GET['lang']) && in_array($_GET['lang'], ['en','id','ar']) ? $_GET['lang'] : 'en';
        $seed   = isset($_GET['seed'])   ? (int)$_GET['seed']   : null;
        $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
        $limit  = 60;

        if ($seed !== null) {
            $st = $conn->prepare("SELECT word FROM Word_Lists WHERE language=:l ORDER BY RAND(:seed) LIMIT :limit OFFSET :offset");
            $st->bindValue(':l', $lang);
            $st->bindValue(':seed', $seed, PDO::PARAM_INT);
            $st->bindValue(':limit', $limit, PDO::PARAM_INT);
            $st->bindValue(':offset', $offset, PDO::PARAM_INT);
        } else {
            $st = $conn->prepare("SELECT word FROM Word_Lists WHERE language=:l ORDER BY RAND() LIMIT :limit");
            $st->bindValue(':l', $lang);
            $st->bindValue(':limit', $limit, PDO::PARAM_INT);
        }
        $st->execute();
        sendResponse(['words' => $st->fetchAll(PDO::FETCH_COLUMN)]);
        break;

    // ── Save Result ───────────────────────────────────────────────────────────
    case 'save-result':
        if ($method !== 'POST') { sendResponse(['error' => 'Method not allowed'], 405); }
        $d = json_decode(file_get_contents('php://input'));
        if (empty($d->user_id) || empty($d->language) || !isset($d->wpm)) {
            sendResponse(['error' => 'Incomplete result data.'], 400);
        }
        $st = $conn->prepare("INSERT INTO Typing_Tests
            (user_id,language,wpm,accuracy,total_words,correct_words,wrong_words)
            VALUES (:uid,:lang,:wpm,:acc,:tw,:cw,:ww)");
        $st->execute([
            ':uid'  => $d->user_id,
            ':lang' => $d->language,
            ':wpm'  => $d->wpm,
            ':acc'  => $d->accuracy,
            ':tw'   => $d->total_words   ?? 0,
            ':cw'   => $d->correct_words ?? 0,
            ':ww'   => $d->wrong_words   ?? 0,
        ]);
        $tid = $conn->lastInsertId();
        // Mirror into Leaderboard
        $lb = $conn->prepare("INSERT INTO Leaderboard (user_id,wpm,accuracy,language,test_id)
                               VALUES (:uid,:wpm,:acc,:lang,:tid)");
        $lb->execute([':uid'=>$d->user_id,':wpm'=>$d->wpm,':acc'=>$d->accuracy,':lang'=>$d->language,':tid'=>$tid]);
        sendResponse(['message' => 'Result saved.', 'test_id' => $tid, 'achievements_unlocked' => AchievementManager::check($d->user_id, 'typing_test')], 201);
        break;

    // ── Leaderboard ───────────────────────────────────────────────────────────
    case 'leaderboard':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $lang   = isset($_GET['lang'])   ? $_GET['lang']   : 'all';
        $filter = isset($_GET['filter']) ? $_GET['filter'] : 'all_time';

        // 1. Time filter — applied first
        $timeWhere = '';
        $timeWhereSub = '';
        switch ($filter) {
            case 'daily':
                $timeWhere = "AND DATE(l.created_at) = CURDATE()"; 
                $timeWhereSub = "AND DATE(l_sub.created_at) = CURDATE()";
                break;
            case 'weekly':
                $timeWhere = "AND YEARWEEK(l.created_at, 1) = YEARWEEK(CURDATE(), 1)"; 
                $timeWhereSub = "AND YEARWEEK(l_sub.created_at, 1) = YEARWEEK(CURDATE(), 1)";
                break;
            case 'monthly':
                $timeWhere = "AND YEAR(l.created_at) = YEAR(CURDATE()) AND MONTH(l.created_at) = MONTH(CURDATE())"; 
                $timeWhereSub = "AND YEAR(l_sub.created_at) = YEAR(CURDATE()) AND MONTH(l_sub.created_at) = MONTH(CURDATE())";
                break;
        }

        // 2. Language filter — applied after dedup
        $langWhere = '';
        $langWhereSub = '';
        $langParam = [];
        if ($lang !== 'all' && in_array($lang, ['en','id','ar'])) {
            $langWhere = 'AND l.language = :lang';
            $langWhereSub = 'AND l_sub.language = :lang2';
            $langParam[':lang'] = $lang;
            $langParam[':lang2'] = $lang;
        }

        $page   = isset($_GET['page'])   ? (int)$_GET['page']   : 1;
        $limit  = isset($_GET['limit'])  ? (int)$_GET['limit']  : 20;
        $offset = ($page - 1) * $limit;

        // 3. Count total players (for pagination)
        $countSql = "
            SELECT COUNT(*) FROM (
                SELECT 1
                FROM Leaderboard l
                JOIN Users u ON l.user_id = u.id
                WHERE 1=1 {$timeWhere} {$langWhere}
                GROUP BY l.user_id, u.username, l.language
            ) as sub
        ";
        $cst = $conn->prepare($countSql);
        $countParam = [];
        if (isset($langParam[':lang'])) $countParam[':lang'] = $langParam[':lang'];
        $cst->execute($countParam);
        $totalItems = (int)$cst->fetchColumn();
        $totalPages = ceil($totalItems / $limit);

        // 4. Main Query with LIMIT/OFFSET
        $sql = "
            SELECT u.username,
                   l.user_id,
                   l.language,
                   l.wpm,
                   MAX(l.accuracy) AS accuracy,
                   MAX(l.created_at) AS created_at
            FROM Leaderboard l
            JOIN (
                SELECT user_id, language, MAX(wpm) as best_wpm
                FROM Leaderboard l_sub
                WHERE 1=1 {$timeWhereSub} {$langWhereSub}
                GROUP BY user_id, language
            ) best ON l.user_id = best.user_id AND l.language = best.language AND l.wpm = best.best_wpm
            JOIN Users u ON l.user_id = u.id
            WHERE 1=1 {$timeWhere} {$langWhere}
            GROUP BY l.user_id, u.username, l.language, l.wpm
            ORDER BY l.wpm DESC, accuracy DESC
            LIMIT :limit OFFSET :offset
        ";

        $st = $conn->prepare($sql);
        foreach ($langParam as $k => $v) $st->bindValue($k, $v);
        $st->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
        $st->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
        $st->execute();
        
        $rows = $st->fetchAll();
        foreach ($rows as $i => &$r) {
            $r['rank'] = $offset + $i + 1;
        }

        sendResponse([
            'leaderboard' => $rows,
            'pages' => $totalPages,
            'current_page' => $page,
            'total' => $totalItems
        ]);
        break;

    // ── Competitions ──────────────────────────────────────────────────────────
    case 'competitions':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $page  = max(1, (int)($_GET['page']  ?? 1));
        $limit = min(50, max(5, (int)($_GET['limit'] ?? 12)));
        $offset = ($page - 1) * $limit;

        $total = (int)$conn->query("SELECT COUNT(*) FROM Competitions")->fetchColumn();
        $pages = (int)ceil($total / $limit);

        $st = $conn->prepare(
            "SELECT id, title, description, language, start_date, end_date, created_at
             FROM Competitions 
             ORDER BY (end_date < NOW()) ASC, start_date ASC
             LIMIT :lim OFFSET :off"
        );
        $st->bindValue(':lim', $limit, PDO::PARAM_INT);
        $st->bindValue(':off', $offset, PDO::PARAM_INT);
        $st->execute();

        sendResponse([
            'competitions' => $st->fetchAll(),
            'total' => $total,
            'page' => $page,
            'pages' => $pages
        ]);
        break;

    case 'competition':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) sendResponse(['error' => 'Missing id'], 400);

        $st = $conn->prepare("SELECT * FROM Competitions WHERE id=:id LIMIT 1");
        $st->execute([':id' => $id]);
        $row = $st->fetch();
        if (!$row) sendResponse(['error' => 'Competition not found'], 404);
        sendResponse(['competition' => $row]);
        break;

    // ── Join Competition ──────────────────────────────────────────────────────
    case 'join-competition':
        if ($method !== 'POST') { sendResponse(['error' => 'Method not allowed'], 405); }
        $d = json_decode(file_get_contents('php://input'));
        if (empty($d->competition_id) || empty($d->user_id) || !isset($d->wpm)) {
            sendResponse(['error' => 'Incomplete request.'], 400);
        }
        $st = $conn->prepare("INSERT INTO Competition_Results (competition_id,user_id,wpm,accuracy)
                               VALUES (:cid,:uid,:wpm,:acc)");
        $st->execute([':cid'=>$d->competition_id,':uid'=>$d->user_id,':wpm'=>$d->wpm,':acc'=>$d->accuracy]);
        sendResponse(['message' => 'Competition result saved.', 'achievements_unlocked' => AchievementManager::check($d->user_id, 'competition')], 201);
        break;

    // ── Competition Words (fixed snapshot) ────────────────────────────────────
    case 'competition-words':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $cid = (int)($_GET['competition_id'] ?? 0);
        if (!$cid) sendResponse(['error' => 'Missing competition_id'], 400);

        try {
            // Ensure words_snapshot column exists — suppress PDO errors for this statement
            $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_SILENT);
            $conn->exec("ALTER TABLE Competitions ADD COLUMN words_snapshot TEXT DEFAULT NULL");
            $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            // Fetch competition
            $st = $conn->prepare("SELECT id, language, words_snapshot FROM Competitions WHERE id=:id LIMIT 1");
            $st->execute([':id' => $cid]);
            $comp = $st->fetch();
            if (!$comp) sendResponse(['error' => 'Competition not found'], 404);

            // If snapshot already exists, return it
            if (!empty($comp['words_snapshot'])) {
                sendResponse(['words' => json_decode($comp['words_snapshot'], true), 'competition_id' => $cid]);
                break;
            }

            // Generate snapshot: pick 80 random words for the competition's language
            $lang = $comp['language'];
            // USE CID as SEED for Reproducible word list
            $ws = $conn->prepare("SELECT word FROM Word_Lists WHERE language=:l ORDER BY RAND(:seed) LIMIT 80");
            $ws->execute([':l' => $lang, ':seed' => $cid]);
            $words = $ws->fetchAll(PDO::FETCH_COLUMN);
            if (empty($words)) sendResponse(['error' => 'No words found for language: ' . $lang], 404);

            $snapshot = json_encode(array_values($words));
            $conn->prepare("UPDATE Competitions SET words_snapshot=:w WHERE id=:id")
                 ->execute([':w' => $snapshot, ':id' => $cid]);

            sendResponse(['words' => $words, 'competition_id' => $cid]);
        } catch (PDOException $e) {
            sendResponse(['error' => 'DB error: ' . $e->getMessage()], 500);
        }
        break;

    // ── Competition Leaderboard (best score per user) ─────────────────────────
    case 'competition-leaderboard':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $cid = (int)($_GET['competition_id'] ?? 0);
        if (!$cid) sendResponse(['error' => 'Missing competition_id'], 400);

        $st = $conn->prepare(
            "SELECT cr.user_id, u.username,
                    MAX(cr.wpm) as best_wpm,
                    MAX(cr.accuracy) as best_accuracy,
                    COUNT(cr.id) as attempts,
                    MAX(cr.created_at) as last_attempt
             FROM Competition_Results cr
             JOIN Users u ON cr.user_id = u.id
             WHERE cr.competition_id = :cid
             GROUP BY cr.user_id
             ORDER BY best_wpm DESC, best_accuracy DESC
             LIMIT 50"
        );
        $st->execute([':cid' => $cid]);
        $rows = $st->fetchAll();
        foreach ($rows as $i => &$r) $r['rank'] = $i + 1;
        sendResponse(['leaderboard' => $rows, 'competition_id' => $cid]);
        break;

    // ── Submit Competition Result (best score only) ───────────────────────────
    case 'submit-competition':
        if ($method !== 'POST') { sendResponse(['error' => 'Method not allowed'], 405); }
        $d = json_decode(file_get_contents('php://input'));
        if (empty($d->competition_id) || empty($d->user_id) || !isset($d->wpm)) {
            sendResponse(['error' => 'Incomplete data'], 400);
        }
        $cid = (int)$d->competition_id;
        $uid = (int)$d->user_id;
        $wpm = (int)$d->wpm;
        $acc = (float)($d->accuracy ?? 100);

        // Always record every attempt
        $ins = $conn->prepare(
            "INSERT INTO Competition_Results (competition_id,user_id,wpm,accuracy) VALUES (:cid,:uid,:wpm,:acc)"
        );
        $ins->execute([':cid'=>$cid,':uid'=>$uid,':wpm'=>$wpm,':acc'=>$acc]);

        // Check if this is the user's new best for feedback
        $bestQuery = $conn->prepare(
            "SELECT MAX(wpm) as best_wpm FROM Competition_Results WHERE competition_id=:cid AND user_id=:uid AND id != :last_id"
        );
        $lastId = $conn->lastInsertId();
        $bestQuery->execute([':cid' => $cid, ':uid' => $uid, ':last_id' => $lastId]);
        $bestRow = $bestQuery->fetch();
        $prevBest = $bestRow['best_wpm'] ?? 0;

        $achievements = AchievementManager::check($uid, 'competition');

        if ($wpm > $prevBest) {
            sendResponse([
                'message' => 'Skor baru lebih baik!', 
                'new_best' => true, 
                'wpm' => $wpm,
                'achievements_unlocked' => $achievements
            ], 201);
        } else {
            sendResponse([
                'message' => 'Hasil tersimpan (Upaya #' . ($conn->query("SELECT COUNT(*) FROM Competition_Results WHERE competition_id=$cid AND user_id=$uid")->fetchColumn()) . ')', 
                'new_best' => false, 
                'best_wpm' => $prevBest,
                'achievements_unlocked' => $achievements
            ]);
        }
        break;

    // ── Profile Stats ─────────────────────────────────────────────────────────
    case 'profile-stats':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $uid = (int)($_GET['user_id'] ?? 0);
        $range = $_GET['range'] ?? 'all'; // '7d', '30d', '90d', 'all'
        if (!$uid) sendResponse(['error' => 'Missing user_id'], 400);

        $dateFilter = "";
        if ($range === '7d') $dateFilter = "AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        else if ($range === '30d') $dateFilter = "AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        else if ($range === '90d') $dateFilter = "AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)";

        // Overall summary
        $st = $conn->prepare("SELECT MAX(wpm) AS best_wpm, AVG(accuracy) AS avg_accuracy, COUNT(*) AS total_tests FROM Typing_Tests WHERE user_id=:uid $dateFilter");
        $st->execute([':uid' => $uid]);
        $overall = $st->fetch();
        $overall['avg_accuracy'] = $overall['avg_accuracy'] !== null ? round((float)$overall['avg_accuracy'], 2) : null;

        // Competitions (distinct) - filtering competitions by their results' date if range is set
        $st2 = $conn->prepare("SELECT COUNT(DISTINCT competition_id) AS total_competitions FROM Competition_Results WHERE user_id=:uid $dateFilter");
        $st2->execute([':uid' => $uid]);
        $overall['total_competitions'] = (int)$st2->fetchColumn();

        // Per-language stats + WPM history for chart
        $byLang = [];
        foreach (['en','id','ar'] as $l) {
            $st3 = $conn->prepare("SELECT MAX(wpm) AS best_wpm, AVG(accuracy) AS avg_accuracy, COUNT(*) AS test_count FROM Typing_Tests WHERE user_id=:uid AND language=:lang $dateFilter");
            $st3->execute([':uid' => $uid, ':lang' => $l]);
            $row = $st3->fetch();
            if ((int)$row['test_count'] === 0) { $byLang[$l] = null; continue; }

            // Increased limit to 50 for better chart density on longer ranges
            $st4 = $conn->prepare("SELECT wpm, accuracy, correct_words, wrong_words, created_at FROM Typing_Tests WHERE user_id=:uid AND language=:lang $dateFilter ORDER BY created_at DESC LIMIT 50");
            $st4->execute([':uid' => $uid, ':lang' => $l]);
            $history = array_reverse($st4->fetchAll(PDO::FETCH_ASSOC));
            $byLang[$l] = [
                'best_wpm'     => (int)$row['best_wpm'],
                'avg_accuracy' => round((float)$row['avg_accuracy'], 2),
                'test_count'   => (int)$row['test_count'],
                'history'      => array_map(fn($r) => [
                    'wpm'           => (int)$r['wpm'],
                    'accuracy'      => round((float)$r['accuracy'], 1),
                    'correct_words' => (int)$r['correct_words'],
                    'wrong_words'   => (int)$r['wrong_words'],
                    'date'          => date('d/m/Y', strtotime($r['created_at'])),
                    'short_date'    => date('d/m',   strtotime($r['created_at']))
                ], $history),
                // Keep these for backward compatibility if needed, though 'history' is better
                'wpm_history'  => array_column($history, 'wpm'),
                'date_history' => array_map(fn($r) => date('d/m', strtotime($r['created_at'])), $history),
            ];
        }
        // Update last activity
        $conn->prepare("UPDATE Users SET last_activity = NOW() WHERE id = :uid")->execute([':uid' => $uid]);
        
        sendResponse(['overall' => $overall, 'by_language' => $byLang]);
        break;

    // ── Test History (paginated) ───────────────────────────────────────────────
    case 'test-history':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $uid   = (int)($_GET['user_id'] ?? 0);
        $page  = max(1, (int)($_GET['page']  ?? 1));
        $limit = min(50, max(5, (int)($_GET['limit'] ?? 10)));
        $lang  = (isset($_GET['lang']) && in_array($_GET['lang'], ['en','id','ar'])) ? $_GET['lang'] : null;
        if (!$uid) sendResponse(['error' => 'Missing user_id'], 400);

        $langWhere = $lang ? 'AND language=:lang' : '';
        $cntStmt = $conn->prepare("SELECT COUNT(*) FROM Typing_Tests WHERE user_id=:uid $langWhere");
        $cntStmt->bindValue(':uid', $uid, PDO::PARAM_INT);
        if ($lang) $cntStmt->bindValue(':lang', $lang, PDO::PARAM_STR);
        $cntStmt->execute();
        $total  = (int)$cntStmt->fetchColumn();
        $pages  = (int)ceil($total / $limit);
        $offset = ($page - 1) * $limit;

        $dataStmt = $conn->prepare("SELECT id, language, wpm, accuracy, correct_words, wrong_words, total_words, created_at FROM Typing_Tests WHERE user_id=:uid $langWhere ORDER BY created_at DESC LIMIT :lim OFFSET :off");
        $dataStmt->bindValue(':uid', $uid, PDO::PARAM_INT);
        $dataStmt->bindValue(':lim', $limit,  PDO::PARAM_INT);
        $dataStmt->bindValue(':off', $offset, PDO::PARAM_INT);
        if ($lang) $dataStmt->bindValue(':lang', $lang, PDO::PARAM_STR);
        $dataStmt->execute();
        sendResponse(['tests' => $dataStmt->fetchAll(), 'total' => $total, 'page' => $page, 'pages' => $pages, 'limit' => $limit]);
        break;

    // ── Practice Texts (list) ─────────────────────────────────────────────────
    case 'practice-texts':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $lang  = isset($_GET['lang'])       ? $_GET['lang']       : '';
        $diff  = isset($_GET['difficulty']) ? $_GET['difficulty'] : '';
        $uid   = isset($_GET['user_id'])    ? (int)$_GET['user_id'] : 0;

        $where = "WHERE pt.is_active = 1";
        $params = [];
        if ($lang && in_array($lang, ['en','id','ar'])) {
            $where .= " AND pt.language = :lang";
            $params[':lang'] = $lang;
        }
        if ($diff && in_array($diff, ['easy','medium','hard'])) {
            $where .= " AND pt.difficulty = :diff";
            $params[':diff'] = $diff;
        }

        $page  = max(1, (int)($_GET['page']  ?? 1));
        $limit = min(50, max(5, (int)($_GET['limit'] ?? 12)));
        $offset = ($page - 1) * $limit;

        $cntSql = "SELECT COUNT(*) FROM Practice_Texts pt $where";
        $cntStmt = $conn->prepare($cntSql);
        $cntStmt->execute($params);
        $total = (int)$cntStmt->fetchColumn();
        $pages = (int)ceil($total / $limit);

        $st = $conn->prepare("
            SELECT pt.id, pt.title, pt.language, pt.difficulty,
                   LENGTH(pt.content) AS char_count,
                   (SELECT MAX(pr.wpm) FROM Practice_Results pr WHERE pr.practice_text_id=pt.id AND pr.user_id=:uid) AS best_wpm,
                   (SELECT COUNT(*)   FROM Practice_Results pr WHERE pr.practice_text_id=pt.id AND pr.user_id=:uid2) AS attempts
            FROM Practice_Texts pt
            $where
            ORDER BY pt.language, pt.difficulty, pt.id
            LIMIT :lim OFFSET :off
        ");
        foreach ($params as $k => $v) $st->bindValue($k, $v);
        $st->bindValue(':uid',  $uid,  PDO::PARAM_INT);
        $st->bindValue(':uid2', $uid,  PDO::PARAM_INT);
        $st->bindValue(':lim',  $limit, PDO::PARAM_INT);
        $st->bindValue(':off',  $offset, PDO::PARAM_INT);
        $st->execute();
        
        sendResponse([
            'texts' => $st->fetchAll(),
            'total' => $total,
            'page'  => $page,
            'pages' => $pages,
            'limit' => $limit
        ]);
        break;

    // ── Practice Text (single) ────────────────────────────────────────────────
    case 'practice-text':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) sendResponse(['error' => 'Missing id'], 400);
        $st = $conn->prepare("SELECT * FROM Practice_Texts WHERE id=:id AND is_active=1 LIMIT 1");
        $st->execute([':id' => $id]);
        $row = $st->fetch();
        if (!$row) sendResponse(['error' => 'Text not found'], 404);
        sendResponse(['text' => $row]);
        break;

    // ── Save Practice Result ──────────────────────────────────────────────────
    case 'save-practice':
        if ($method !== 'POST') { sendResponse(['error' => 'Method not allowed'], 405); }
        $d = json_decode(file_get_contents('php://input'), true);
        if (empty($d['user_id']) || empty($d['practice_text_id'])) {
            sendResponse(['error' => 'Missing required fields'], 400);
        }
        $st = $conn->prepare("
            INSERT INTO Practice_Results (user_id, practice_text_id, wpm, accuracy, errors, time_seconds)
            VALUES (:uid, :tid, :wpm, :acc, :err, :sec)
        ");
        $st->execute([
            ':uid' => (int)$d['user_id'],
            ':tid' => (int)$d['practice_text_id'],
            ':wpm' => round($d['wpm'] ?? 0, 2),
            ':acc' => round($d['accuracy'] ?? 0, 2),
            ':err' => (int)($d['errors'] ?? 0),
            ':sec' => (int)($d['time_seconds'] ?? 0),
        ]);
        sendResponse(['message' => 'Result saved.', 'id' => $conn->lastInsertId(), 'achievements_unlocked' => AchievementManager::check((int)$d['user_id'], 'practice')], 201);
        break;

    // ── Practice History (for one text) ──────────────────────────────────────
    case 'practice-history':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $uid = (int)($_GET['user_id'] ?? 0);
        $tid = (int)($_GET['text_id'] ?? 0);
        $page  = max(1, (int)($_GET['page']  ?? 1));
        $limit = min(50, max(5, (int)($_GET['limit'] ?? 10)));
        if (!$uid || !$tid) sendResponse(['error' => 'Missing user_id or text_id'], 400);

        $cntStmt = $conn->prepare("SELECT COUNT(*) FROM Practice_Results WHERE user_id=:uid AND practice_text_id=:tid");
        $cntStmt->execute([':uid' => $uid, ':tid' => $tid]);
        $total  = (int)$cntStmt->fetchColumn();
        $pages  = (int)ceil($total / $limit);
        $offset = ($page - 1) * $limit;

        $st = $conn->prepare("
            SELECT wpm, accuracy, errors, time_seconds, created_at
            FROM Practice_Results
            WHERE user_id=:uid AND practice_text_id=:tid
            ORDER BY created_at DESC
            LIMIT :lim OFFSET :off
        ");
        $st->bindValue(':uid', $uid, PDO::PARAM_INT);
        $st->bindValue(':tid', $tid, PDO::PARAM_INT);
        $st->bindValue(':lim', $limit,  PDO::PARAM_INT);
        $st->bindValue(':off', $offset, PDO::PARAM_INT);
        $st->execute();
        $rows = $st->fetchAll();

        $best = $conn->prepare("
            SELECT MAX(wpm) as best_wpm, MIN(accuracy) as min_acc, MAX(accuracy) as best_acc
            FROM Practice_Results WHERE user_id=:uid AND practice_text_id=:tid
        ");
        $best->execute([':uid' => $uid, ':tid' => $tid]);

        sendResponse([
            'history' => $rows, 
            'summary' => $best->fetch(),
            'total' => $total,
            'page' => $page,
            'pages' => $pages,
            'limit' => $limit
        ]);
        break;

    // ── User Competitions ───────────────────────────────────────────────────
    case 'user-competitions':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $uid = (int)($_GET['user_id'] ?? 0);
        $page  = max(1, (int)($_GET['page']  ?? 1));
        $limit = min(50, max(5, (int)($_GET['limit'] ?? 10)));
        if (!$uid) sendResponse(['error' => 'Missing user_id'], 400);

        try {
            // Count total
            $cntStmt = $conn->prepare("SELECT COUNT(DISTINCT competition_id) FROM Competition_Results WHERE user_id = :uid");
            $cntStmt->execute([':uid' => $uid]);
            $total = (int)$cntStmt->fetchColumn();
            $pages = ceil($total / $limit);
            $offset = ($page - 1) * $limit;

            $st = $conn->prepare("
                SELECT c.id, c.title, c.language, c.start_date, c.end_date,
                       t.best_wpm, t.best_accuracy, t.attempts, t.first_joined,
                       (
                           SELECT COUNT(*) + 1
                           FROM (
                               SELECT user_id, MAX(wpm) as ub_wpm, MAX(accuracy) as ub_acc
                               FROM Competition_Results
                               WHERE competition_id = c.id
                               GROUP BY user_id
                           ) AS rankings
                           WHERE rankings.ub_wpm > t.best_wpm
                           OR (rankings.ub_wpm = t.best_wpm AND rankings.ub_acc > t.best_accuracy)
                       ) as `rank`,
                       (
                           SELECT COUNT(DISTINCT user_id)
                           FROM Competition_Results
                           WHERE competition_id = c.id
                       ) as total_participants
                FROM (
                    SELECT competition_id, MAX(wpm) as best_wpm, MAX(accuracy) as best_accuracy, COUNT(id) as attempts, MIN(created_at) as first_joined
                    FROM Competition_Results
                    WHERE user_id = :uid
                    GROUP BY competition_id
                ) AS t
                JOIN Competitions c ON t.competition_id = c.id
                ORDER BY t.first_joined DESC
                LIMIT :lim OFFSET :off
            ");
            $st->bindValue(':uid', $uid, PDO::PARAM_INT);
            $st->bindValue(':lim', $limit, PDO::PARAM_INT);
            $st->bindValue(':off', $offset, PDO::PARAM_INT);
            $st->execute();
            sendResponse(['competitions' => $st->fetchAll(), 'total' => $total, 'page' => $page, 'pages' => $pages]);
        } catch (PDOException $e) {
            sendResponse(['error' => 'DB error: ' . $e->getMessage()], 500);
        }
        break;

    // ── User Practice History ───────────────────────────────────────────────
    case 'user-practice-history':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $uid = (int)($_GET['user_id'] ?? 0);
        $page  = max(1, (int)($_GET['page']  ?? 1));
        $limit = min(50, max(5, (int)($_GET['limit'] ?? 10)));
        if (!$uid) sendResponse(['error' => 'Missing user_id'], 400);

        try {
            // Count total
            $cntStmt = $conn->prepare("SELECT COUNT(DISTINCT practice_text_id) FROM Practice_Results WHERE user_id = :uid");
            $cntStmt->execute([':uid' => $uid]);
            $totalItems = (int)$cntStmt->fetchColumn();
            $totalPages = (int)ceil($totalItems / $limit);
            $offset = ($page - 1) * $limit;

            $st = $conn->prepare("
                SELECT pt.id, pt.title, pt.language, pt.difficulty,
                       MAX(pr.wpm) as best_wpm,
                       MAX(pr.accuracy) as best_accuracy,
                       COUNT(pr.id) as attempts,
                       MAX(pr.created_at) as last_attempt
                FROM Practice_Results pr
                JOIN Practice_Texts pt ON pr.practice_text_id = pt.id
                WHERE pr.user_id = :uid
                GROUP BY pt.id, pt.title, pt.language, pt.difficulty
                ORDER BY last_attempt DESC
                LIMIT :lim OFFSET :off
            ");
            $st->bindValue(':uid', $uid, PDO::PARAM_INT);
            $st->bindValue(':lim', $limit,  PDO::PARAM_INT);
            $st->bindValue(':off', $offset, PDO::PARAM_INT);
            $st->execute();
            sendResponse(['practices' => $st->fetchAll(), 'total' => $totalItems, 'page' => $page, 'pages' => $totalPages]);
        } catch (PDOException $e) {
            sendResponse(['error' => 'DB error: ' . $e->getMessage()], 500);
        }
        break;

    // ── User Info (Public) ───────────────────────────────────────────────────
    case 'user-info':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $uid = (int)($_GET['user_id'] ?? 0);
        if (!$uid) sendResponse(['error' => 'Missing user_id'], 400);

        try {
            $st = $conn->prepare("SELECT id, username, role, kelas, daerah, last_activity FROM Users WHERE id = :uid LIMIT 1");
            $st->execute([':uid' => $uid]);
            $user = $st->fetch();
            if (!$user) sendResponse(['error' => 'User not found'], 404);
            $user['last_activity_fmt'] = date('d M Y, H:i', strtotime($user['last_activity']));
            sendResponse(['user' => $user]);
        } catch (PDOException $e) {
            sendResponse(['error' => 'DB error: ' . $e->getMessage()], 500);
        }
        break;

    // ── Record Profile Visit ──────────────────────────────────────────────────
    case 'record-profile-visit':
        if ($method !== 'POST') { sendResponse(['error' => 'Method not allowed'], 405); }
        $d = json_decode(file_get_contents('php://input'), true);
        if (empty($d['owner_id']) || empty($d['visitor_id'])) {
            sendResponse(['error' => 'Incomplete visit data.'], 400);
        }
        if ($d['owner_id'] == $d['visitor_id']) { sendResponse(['message' => 'Self-visit ignored.']); }

        try {
            $st = $conn->prepare("
                INSERT INTO Profile_Visits (profile_owner_id, visitor_id) 
                VALUES (:oid, :vid)
                ON DUPLICATE KEY UPDATE visited_at = CURRENT_TIMESTAMP
            ");
            $st->execute([':oid' => $d['owner_id'], ':vid' => $d['visitor_id']]);
            sendResponse(['message' => 'Visit recorded.']);
        } catch (PDOException $e) {
            sendResponse(['error' => 'DB error: ' . $e->getMessage()], 500);
        }
        break;

    // ── Get Profile Visitors ──────────────────────────────────────────────────
    case 'get-profile-visitors':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $uid = (int)($_GET['user_id'] ?? 0);
        $page  = max(1, (int)($_GET['page']  ?? 1));
        $limit = min(50, max(5, (int)($_GET['limit'] ?? 10)));
        if (!$uid) sendResponse(['error' => 'Missing user_id'], 400);

        try {
            // Count total
            $cnt = $conn->prepare("SELECT COUNT(*) FROM Profile_Visits WHERE profile_owner_id = :uid");
            $cnt->execute([':uid' => $uid]);
            $total = (int)$cnt->fetchColumn();
            $pages = ceil($total / $limit);
            $offset = ($page - 1) * $limit;

            $st = $conn->prepare("
                SELECT u.id, u.username, v.visited_at 
                FROM Profile_Visits v
                JOIN Users u ON v.visitor_id = u.id
                WHERE v.profile_owner_id = :uid
                ORDER BY v.visited_at DESC
                LIMIT :lim OFFSET :off
            ");
            $st->bindValue(':uid', $uid, PDO::PARAM_INT);
            $st->bindValue(':lim', $limit, PDO::PARAM_INT);
            $st->bindValue(':off', $offset, PDO::PARAM_INT);
            $st->execute();
            sendResponse(['visitors' => $st->fetchAll(), 'total' => $total, 'page' => $page, 'pages' => $pages]);
        } catch (PDOException $e) {
            sendResponse(['error' => 'DB error: ' . $e->getMessage()], 500);
        }
        break;

    // ── Get User Achievements ────────────────────────────────────────────────
    case 'get-user-achievements':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $uid = (int)($_GET['user_id'] ?? 0);
        if (!$uid) sendResponse(['error' => 'Missing user_id'], 400);

        try {
            // Get all achievements
            $st = $conn->prepare("SELECT id, title, description, category, badge_icon FROM Achievements ORDER BY id ASC");
            $st->execute();
            $all = $st->fetchAll(PDO::FETCH_ASSOC);

            // Get unlocked ones
            $st2 = $conn->prepare("SELECT achievement_id, unlocked_at FROM User_Achievements WHERE user_id = :uid");
            $st2->execute([':uid' => $uid]);
            $unlocked = $st2->fetchAll(PDO::FETCH_ASSOC);
            $unlockedM = [];
            foreach ($unlocked as $u) $unlockedM[$u['achievement_id']] = $u['unlocked_at'];

            foreach ($all as &$ach) {
                $ach['is_unlocked'] = isset($unlockedM[$ach['id']]);
                $ach['unlocked_at'] = $unlockedM[$ach['id']] ?? null;
            }

            sendResponse(['achievements' => $all]);
        } catch (PDOException $e) {
            sendResponse(['error' => 'DB error: ' . $e->getMessage()], 500);
        }
        break;

    // ── Save Finger Result ───────────────────────────────────────────
    case 'save-finger-result':
        if ($method !== 'POST') { sendResponse(['error' => 'Method not allowed'], 405); }
        $d = json_decode(file_get_contents('php://input'));
        if (empty($d->user_id) || empty($d->finger_name) || !isset($d->wpm)) {
            sendResponse(['error' => 'Incomplete result data.'], 400);
        }
        $st = $conn->prepare("INSERT INTO Finger_Training_Results 
            (user_id, finger_name, wpm, accuracy) 
            VALUES (:uid, :finger, :wpm, :acc)");
        $st->execute([
            ':uid'    => $d->user_id,
            ':finger' => $d->finger_name,
            ':wpm'    => $d->wpm,
            ':acc'    => $d->accuracy
        ]);
        sendResponse([
            'message' => 'Finger training result saved.', 
            'id' => $conn->lastInsertId(),
            'achievements_unlocked' => AchievementManager::check($d->user_id, 'finger_training')
        ], 201);
        break;

    // ── Get Finger Results (Best per Finger) ────────────────────────────
    case 'get-finger-results':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $uid = (int)($_GET['user_id'] ?? 0);
        if (!$uid) sendResponse(['error' => 'Missing user_id'], 400);
        
        $st = $conn->prepare("
            SELECT finger_name, MAX(wpm) as best_wpm, MAX(accuracy) as best_accuracy, COUNT(*) as training_count
            FROM Finger_Training_Results 
            WHERE user_id = :uid 
            GROUP BY finger_name
        ");
        $st->execute([':uid' => $uid]);
        sendResponse(['results' => $st->fetchAll(PDO::FETCH_ASSOC)]);
        break;

    // ── Get Finger History (Paginated & Filtered) ───────────────────────────
    case 'get-finger-history':
        if ($method !== 'GET') { sendResponse(['error' => 'Method not allowed'], 405); }
        $uid   = (int)($_GET['user_id'] ?? 0);
        $page  = max(1, (int)($_GET['page']  ?? 1));
        $limit = min(50, max(5, (int)($_GET['limit'] ?? 10)));
        $finger = isset($_GET['finger']) && $_GET['finger'] !== 'all' ? $_GET['finger'] : null;
        
        if (!$uid) sendResponse(['error' => 'Missing user_id'], 400);

        $where = "WHERE user_id = :uid";
        $params = [':uid' => $uid];
        if ($finger) {
            $where .= " AND finger_name = :finger";
            $params[':finger'] = $finger;
        }

        // Count total for pagination
        $cntStmt = $conn->prepare("SELECT COUNT(*) FROM Finger_Training_Results $where");
        foreach ($params as $k => $v) {
            $type = is_int($v) ? PDO::PARAM_INT : PDO::PARAM_STR;
            $cntStmt->bindValue($k, $v, $type);
        }
        $cntStmt->execute();
        $totalItems = (int)$cntStmt->fetchColumn();
        $totalPages = (int)ceil($totalItems / $limit);
        $offset = ($page - 1) * $limit;

        // Fetch data
        $st = $conn->prepare("
            SELECT finger_name, wpm, accuracy, created_at 
            FROM Finger_Training_Results 
            $where
            ORDER BY created_at DESC 
            LIMIT :lim OFFSET :off
        ");
        foreach ($params as $k => $v) {
            $type = is_int($v) ? PDO::PARAM_INT : PDO::PARAM_STR;
            $st->bindValue($k, $v, $type);
        }
        $st->bindValue(':lim', $limit,  PDO::PARAM_INT);
        $st->bindValue(':off', $offset, PDO::PARAM_INT);
        $st->execute();

        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        
        sendResponse([
            'history' => $rows,
            'total'   => $totalItems,
            'page'    => $page,
            'pages'   => $totalPages,
            'limit'   => $limit,
            'from'    => $totalItems > 0 ? $offset + 1 : 0,
            'to'      => min($offset + $limit, $totalItems)
        ]);
        break;

    // ── Unknown ───────────────────────────────────────────────────────────────
    default:
        sendResponse(['error' => 'Unknown action: ' . htmlspecialchars($action)], 404);
        break;
    }
}
