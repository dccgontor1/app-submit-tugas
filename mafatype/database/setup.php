<?php
/**
 * Mafatype. — Interactive Database Seeder
 * Buka: http://localhost/mafatype/database/seed.php
 */

$seeded = false;
$errors = [];
$output = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $mysql_host     = $_POST['host']     ?? 'localhost';
    $mysql_user     = $_POST['db_user']  ?? 'root';
    $mysql_password = $_POST['db_pass']  ?? '';
    $mysql_db       = $_POST['db_name']  ?? 'typing_master';

    // Coba koneksi
    $conn = @new mysqli($mysql_host, $mysql_user, $mysql_password);
    if ($conn->connect_error) {
        $errors[] = "❌ Koneksi gagal: " . $conn->connect_error;
    } else {
        $conn->set_charset("utf8mb4");

        // Buat database
        $conn->query("CREATE DATABASE IF NOT EXISTS `$mysql_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $conn->select_db($mysql_db);

        // Drop & Create Tables
        $conn->query("SET FOREIGN_KEY_CHECKS = 0");
        foreach (['Competition_Results','Leaderboard','Typing_Tests','Competitions','Word_Lists','Users'] as $t) {
            $conn->query("DROP TABLE IF EXISTS `$t`");
        }
        $conn->query("SET FOREIGN_KEY_CHECKS = 1");

        $ddls = [
            "CREATE TABLE Users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(100) NOT NULL UNIQUE, email VARCHAR(255) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL, role ENUM('user','admin') DEFAULT 'user', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
            "CREATE TABLE Typing_Tests (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, language ENUM('en','id','ar') NOT NULL, wpm INT NOT NULL, accuracy DECIMAL(5,2) NOT NULL, total_words INT NOT NULL, correct_words INT NOT NULL, wrong_words INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE)",
            "CREATE TABLE Leaderboard (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, wpm INT NOT NULL, accuracy DECIMAL(5,2) NOT NULL, language ENUM('en','id','ar') NOT NULL, test_id INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE, FOREIGN KEY (test_id) REFERENCES Typing_Tests(id) ON DELETE CASCADE)",
            "CREATE TABLE Competitions (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, language ENUM('en','id','ar') NOT NULL, start_date DATETIME NOT NULL, end_date DATETIME NOT NULL, words_snapshot TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
            "CREATE TABLE Competition_Results (id INT AUTO_INCREMENT PRIMARY KEY, competition_id INT NOT NULL, user_id INT NOT NULL, wpm INT NOT NULL, accuracy DECIMAL(5,2) NOT NULL, `rank` INT DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (competition_id) REFERENCES Competitions(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE)",
            "CREATE TABLE Word_Lists (id INT AUTO_INCREMENT PRIMARY KEY, language ENUM('en','id','ar') NOT NULL, word VARCHAR(100) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
        ];
        foreach ($ddls as $ddl) {
            if (!$conn->query($ddl)) $errors[] = "DDL Error: " . $conn->error;
        }
        $output[] = "✅ Tabel berhasil dibuat.";

        // Users
        $pw = password_hash("password", PASSWORD_BCRYPT);
        $users = [
            ["admin","admin@typingmaster.com",$pw,"admin"],
            ["rafli123","rafli@email.com",$pw,"user"],
            ["speedking","speedking@email.com",$pw,"user"],
            ["typewizard","typewizard@email.com",$pw,"user"],
            ["fastfingers","fastfingers@email.com",$pw,"user"],
            ["novatyper","novatyper@email.com",$pw,"user"],
            ["keymaster","keymaster@email.com",$pw,"user"],
            ["dianputri","dian@email.com",$pw,"user"],
            ["ahmedali","ahmed@email.com",$pw,"user"],
            ["clickerz","clickerz@email.com",$pw,"user"],
        ];
        $st = $conn->prepare("INSERT INTO Users (username,email,password,role) VALUES (?,?,?,?)");
        foreach ($users as $u) { $st->bind_param("ssss",$u[0],$u[1],$u[2],$u[3]); $st->execute(); }
        $st->close();
        $output[] = "✅ " . count($users) . " user berhasil diinsert.";

        // Words
        $en=['the','be','to','of','and','a','in','that','have','it','for','not','on','with','he','as','you','do','at','this','but','his','by','from','they','we','say','her','she','or','an','will','my','one','all','would','there','their','what','so','up','out','if','about','who','get','which','go','me','when','make','can','like','time','no','just','him','know','take','people','into','year','your','good','some','could','them','see','other','than','then','now','look','only','come','its','over','think','also','back','after','use','two','how','our','work','first','well','way','even','new','want','because','any','these','give','day','most','us','between'];
        $id=['yang','di','dan','itu','dengan','untuk','tidak','ini','dari','dalam','akan','pada','juga','saya','ke','karena','tersebut','bisa','ada','mereka','oleh','telah','sudah','seperti','saat','kami','atau','lebih','menjadi','kita','ia','banyak','sangat','satu','orang','hanya','namun','bahkan','setelah','sampai','tahun','sebelum','kembali','harus','lain','beberapa','sebuah','baru','hari','tentang','kata','dua','tiga','empat','lima','dunia','waktu','tempat','cara','kerja','baik','besar','kecil','pertama','kedua','ketiga','akhir','awal','luar','depan','belakang','atas','bawah','kanan','kiri','tengah','punya','dapat','ingin','pergi','datang','ambil','taruh','buka','tutup','mulai','selesai','bicara','dengar','lihat','baca','tulis','buat','jual','beli','bayar','kirim','terima','kasih'];
        $ar=['في','من','على','إلى','أن','لا','هذا','عن','ما','هي','التي','كان','يا','هل','هو','مع','كل','إن','أو','إذا','قد','لم','لقد','ذلك','بين','حتى','أنه','وهو','فيه','الذي','كانت','أنا','قال','فإن','هذه','بما','عند','ثم','عليه','وفي','الذين','أنت','بعد','قبل','منذ','حين','كيف','لكن','ولكن','أيضا','جداً','هنا','هناك','الآن','اليوم','غداً','أمس','دائماً','أحياناً','كثيراً','جميع','بعض','نحن','هم','أنتم','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة','مئة','ألف','يوم','شهر','سنة','ساعة','دقيقة','ثانية','صباح','مساء','ليل','نهار','بيت','مدرسة','عمل','كتاب','قلم','ماء','طعام','حبيب','أهل','صديق'];
        $st = $conn->prepare("INSERT INTO Word_Lists (language,word) VALUES (?,?)");
        $wc = 0;
        foreach (['en'=>$en,'id'=>$id,'ar'=>$ar] as $lang=>$words) {
            foreach ($words as $word) { $st->bind_param("ss",$lang,$word); $st->execute(); $wc++; }
        }
        $st->close();
        $output[] = "✅ $wc kata berhasil diinsert (EN + ID + AR).";

        // Tests
        $tests=[[2,'en',112,97.50,115,112,3,'2026-03-10 08:00:00'],[3,'en',138,99.00,140,138,2,'2026-03-10 07:45:00'],[4,'id',98,96.00,102,98,4,'2026-03-10 06:30:00'],[5,'en',125,98.00,128,125,3,'2026-03-09 22:00:00'],[6,'ar',75,94.00,80,75,5,'2026-03-09 21:00:00'],[7,'en',148,99.50,150,148,2,'2026-03-09 20:00:00'],[8,'id',85,95.00,90,85,5,'2026-03-09 19:00:00'],[9,'ar',65,93.00,70,65,5,'2026-03-09 18:00:00'],[10,'en',102,97.00,105,102,3,'2026-03-09 17:30:00'],[2,'id',88,95.00,93,88,5,'2026-03-09 16:00:00'],[3,'en',145,99.00,147,145,2,'2026-03-08 10:00:00'],[4,'en',91,95.00,96,91,5,'2026-03-08 09:30:00'],[5,'ar',72,92.00,78,72,6,'2026-03-08 09:00:00'],[6,'id',90,95.00,95,90,5,'2026-03-08 08:30:00'],[7,'en',155,99.00,157,155,2,'2026-03-07 12:00:00']];
        $st = $conn->prepare("INSERT INTO Typing_Tests (user_id,language,wpm,accuracy,total_words,correct_words,wrong_words,created_at) VALUES (?,?,?,?,?,?,?,?)");
        foreach ($tests as $t) { $st->bind_param("isidiiis",$t[0],$t[1],$t[2],$t[3],$t[4],$t[5],$t[6],$t[7]); $st->execute(); }
        $st->close();
        $output[] = "✅ " . count($tests) . " hasil tes berhasil diinsert.";

        // Leaderboard
        $lbs=[[2,112,97.50,'en',1,'2026-03-10 08:00:00'],[3,138,99.00,'en',2,'2026-03-10 07:45:00'],[4,98,96.00,'id',3,'2026-03-10 06:30:00'],[5,125,98.00,'en',4,'2026-03-09 22:00:00'],[6,75,94.00,'ar',5,'2026-03-09 21:00:00'],[7,148,99.50,'en',6,'2026-03-09 20:00:00'],[8,85,95.00,'id',7,'2026-03-09 19:00:00'],[9,65,93.00,'ar',8,'2026-03-09 18:00:00'],[10,102,97.00,'en',9,'2026-03-09 17:30:00'],[2,88,95.00,'id',10,'2026-03-09 16:00:00'],[3,145,99.00,'en',11,'2026-03-08 10:00:00'],[4,91,95.00,'en',12,'2026-03-08 09:30:00'],[5,72,92.00,'ar',13,'2026-03-08 09:00:00'],[6,90,95.00,'id',14,'2026-03-08 08:30:00'],[7,155,99.00,'en',15,'2026-03-07 12:00:00']];
        $st = $conn->prepare("INSERT INTO Leaderboard (user_id,wpm,accuracy,language,test_id,created_at) VALUES (?,?,?,?,?,?)");
        foreach ($lbs as $lb) { $st->bind_param("iidsis",$lb[0],$lb[1],$lb[2],$lb[3],$lb[4],$lb[5]); $st->execute(); }
        $st->close();
        $output[] = "✅ " . count($lbs) . " entri leaderboard berhasil diinsert.";

        // Competitions
        $comps=[['March Speed Champion','Who can type the fastest in March?','en','2026-03-01 00:00:00','2026-03-31 23:59:59'],['Kompetisi Ketik Indonesia','Kompetisi mengetik Bahasa Indonesia untuk semua pengguna!','id','2026-03-05 00:00:00','2026-03-25 23:59:59'],['Arabic Typing Race','مسابقة الطباعة العربية - انضم الآن وتنافس!','ar','2026-03-10 00:00:00','2026-03-20 23:59:59'],['Weekly Lightning Round','A short, sharp, weekly contest. Fastest typist wins!','en','2026-03-08 00:00:00','2026-03-14 23:59:59'],['Beginner Friendly Cup','New to typing? This competition is for beginners. Accuracy over speed!','en','2026-03-12 00:00:00','2026-04-12 23:59:59']];
        $st = $conn->prepare("INSERT INTO Competitions (title,description,language,start_date,end_date) VALUES (?,?,?,?,?)");
        foreach ($comps as $c) { $st->bind_param("sssss",$c[0],$c[1],$c[2],$c[3],$c[4]); $st->execute(); }
        $st->close();
        $output[] = "✅ " . count($comps) . " kompetisi berhasil diinsert.";

        // Competition Results
        $cr=[[1,7,155,99.00,1],[1,3,145,99.00,2],[1,5,125,98.00,3],[1,10,102,97.00,4],[1,2,112,97.50,5],[2,4,98,96.00,1],[2,8,85,95.00,2],[2,6,90,95.00,3],[3,6,75,94.00,1],[3,9,65,93.00,2],[3,5,72,92.00,3]];
        $st = $conn->prepare("INSERT INTO Competition_Results (competition_id,user_id,wpm,accuracy,`rank`) VALUES (?,?,?,?,?)");
        foreach ($cr as $r) { $st->bind_param("iiidi",$r[0],$r[1],$r[2],$r[3],$r[4]); $st->execute(); }
        $st->close();
        $output[] = "✅ " . count($cr) . " hasil kompetisi berhasil diinsert.";

        // Update config.php
        $configCode = "<?php\nheader(\"Access-Control-Allow-Origin: *\");\nheader(\"Access-Control-Allow-Methods: GET, POST, OPTIONS\");\nheader(\"Access-Control-Allow-Headers: Content-Type, Authorization\");\nheader(\"Content-Type: application/json; charset=UTF-8\");\n\n\$host = \"$mysql_host\";\n\$db_name = \"$mysql_db\";\n\$username = \"$mysql_user\";\n\$password = \"$mysql_password\";\n\ntry {\n    \$conn = new PDO(\"mysql:host=\" . \$host . \";dbname=\" . \$db_name . \";charset=utf8mb4\", \$username, \$password);\n    \$conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);\n    \$conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);\n} catch(PDOException \$exception) {\n    http_response_code(500);\n    echo json_encode([\"status\" => \"error\", \"message\" => \"Database Connection Error: \" . \$exception->getMessage()]);\n    exit;\n}\n?>";
        file_put_contents(__DIR__ . '/../backend-php/config.php', $configCode);
        $output[] = "✅ config.php diperbarui dengan kredensial database yang benar.";

        $conn->close();
        $seeded = empty($errors);
    }
}
?>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Database Seeder — Mafatype.</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #0d1117; color: #e6edf3; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 2rem; max-width: 460px; width: 100%; box-shadow: 0 20px 40px rgba(0,0,0,.4); }
  h1 { font-size: 1.4rem; font-weight: 700; background: linear-gradient(135deg,#818cf8,#a78bfa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; margin-bottom: 0.25rem; }
  p.sub { color: #8b949e; font-size: 0.85rem; margin-bottom: 1.5rem; }
  label { display: block; font-size: .8rem; font-weight: 600; color: #8b949e; margin-bottom: .35rem; text-transform: uppercase; letter-spacing: .05em; }
  input { width: 100%; padding: .65rem .9rem; background: #0d1117; border: 1px solid #30363d; border-radius: 8px; color: #e6edf3; font-size: .9rem; margin-bottom: 1rem; outline: none; }
  input:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(129,140,248,.2); }
  button { width: 100%; padding: .75rem; background: linear-gradient(135deg,#818cf8,#a78bfa); color: white; font-size: 1rem; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; transition: filter .2s; }
  button:hover { filter: brightness(1.1); }
  .result { margin-top: 1.5rem; }
  .line { padding: .4rem .75rem; background: #0d1117; border-radius: 6px; margin-bottom: .4rem; font-family: monospace; font-size: .85rem; border-left: 3px solid #4ade80; }
  .line.err { border-left-color: #f87171; }
  .success-banner { margin-top: 1rem; padding: 1rem; background: rgba(74,222,128,.1); border: 1px solid #4ade80; border-radius: 8px; text-align: center; }
  .success-banner a { color: #818cf8; font-weight: 600; }
  .warn { font-size: .78rem; color: #f59e0b; margin-top: 1rem; text-align: center; }
</style>
</head>
<body>
<div class="card">
  <h1>⌨️ Mafatype.</h1>
  <p class="sub">Database Seeder — Isi semua data awal ke MySQL Laragon</p>

  <?php if (!$seeded): ?>
  <form method="POST">
    <label>MySQL Host</label>
    <input name="host" value="localhost">
    <label>Username</label>
    <input name="db_user" value="root">
    <label>Password</label>
    <input name="db_pass" type="password" placeholder="Kosongkan jika tidak ada password">
    <label>Database Name</label>
    <input name="db_name" value="typing_master">
    <button type="submit">🚀 Jalankan Seeder</button>
  </form>
  <?php if (!empty($errors)): ?>
  <div class="result">
    <?php foreach ($errors as $e): ?><div class="line err"><?= htmlspecialchars($e) ?></div><?php endforeach; ?>
  </div>
  <?php endif; ?>
  <?php else: ?>
  <div class="result">
    <?php foreach ($output as $o): ?><div class="line"><?= htmlspecialchars($o) ?></div><?php endforeach; ?>
  </div>
  <div class="success-banner">
    🎉 <strong>Seeder berhasil!</strong><br><br>
    <a href="/mafatype/frontend/index.html">→ Buka Mafatype.</a>
    <br><br>
    Login: <code>rafli@email.com</code> / <code>password</code>
  </div>
  <p class="warn">⚠️ Hapus file ini setelah selesai untuk keamanan.</p>
  <?php endif; ?>
</div>
</body>
</html>
