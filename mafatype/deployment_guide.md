# Panduan Instalasi Mafatype di Komputer Lain

Dokumen ini menjelaskan langkah-langkah untuk memindahkan dan menginstal aplikasi Mafatype ke komputer baru atau server lain.

## Prasyarat Software
Pastikan komputer target memiliki:
1. **PHP 7.4+** (Rekomendasi: Laragon atau XAMPP).
2. **MySQL / MariaDB**.
3. **Node.js & NPM** (Untuk fitur multiplayer).

## Langkah-langkah Instalasi

### 1. Transfer File
Salin seluruh folder `mafatype` ke folder public server target (contoh: `C:\laragon\www\` atau `C:\xampp\htdocs\`).

### 2. Setup Database
1. Buka MySQL Manager (seperti phpMyAdmin atau HeidiSQL).
2. Buat database baru dengan nama `typing_master`.
3. Import file SQL dari `database/typing_master.sql`.

### 3. Konfigurasi Backend
Edit file `backend-php/config.php` dan sesuaikan kredensial database:
- `$host`: Host database (biasanya `localhost`).
- `$db_name`: Nama database (`typing_master`).
- `$username`: Username database (default: `root`).
- `$password`: Password database (default Laragon: ` `).

### 4. Setup Node.js Server (Multiplayer)
Fitur multiplayer membutuhkan server Node.js dan PM2 (untuk manajemen proses):
1. Buka terminal/CMD.
2. Instal PM2 secara global (jika belum ada):
   ```bash
   npm install -g pm2
   ```
3. Buka folder `node-server` di terminal.
4. Jalankan perintah:
   ```bash
   npm install
   node server.js
   ```
   *(Opsional: Gunakan PM2 via Admin Panel Mafatype atau jalankan manual `pm2 start server.js --name mafatype-multiplayer`)*
5. Server multiplayer akan berjalan di port `3005`.

> [!IMPORTANT]
> Di dalam `node-server/server.js`, terdapat variabel `PHP_API` (baris 37) yang mengarah ke `http://localhost/mafatype/...`. Jika Anda menggunakan domain atau IP khusus, pastikan untuk menyesuaikan alamat tersebut agar server Node.js bisa mengambil data kata-kata dari backend PHP.

## 5. Troubleshooting (Error: Failed pm2 server)
Jika Anda mendapatkan error "Failed pm2 server" di Admin Panel, pastikan hal-hal berikut:
1. **PM2 Terinstal**: Jalankan `pm2 -v` di CMD. Jika perintah tidak dikenal, instal dengan `npm install -g pm2`.
2. **PHP Executable**: Pastikan PHP memiliki izin untuk menjalankan perintah shell (`exec`).
3. **Alternatif Manual**: Jika PM2 tetap bermasalah, Anda bisa mengabaikan tombol "Start Server" di Admin Panel dan cukup jalankan server Node secara manual melalui terminal (tetap biarkan terminal tersebut terbuka):
   ```bash
   cd node-server
   node server.js
   ```

## 6. Akses via Jaringan (Opsional)
Jika ingin diakses oleh komputer lain dalam satu WiFi/LAN:
1. Cari alamat IP lokal komputer server (contoh: `192.168.1.10`).
2. Di file `js/multiplayer.js`, pastikan baris koneksi socket menggunakan IP tersebut atau `window.location.hostname`.
   - Kode saat ini sudah menggunakan `window.location.hostname`, jadi seharusnya otomatis bekerja jika diakses via IP.

## 6. Konfigurasi Port Kustom (Contoh: Port 81)
Jika Apache atau web server Anda berjalan di port selain 80 (misalnya port 81), lakukan penyesuaian berikut:

### A. Akses Browser
Gunakan port tersebut pada alamat URL:
`http://localhost:81/mafatype/frontend/index.html`

### B. Update Server Node.js
Edit file `node-server/server.js` pada baris 37. Sesuaikan variabel `PHP_API` agar menyertakan port tersebut:
```javascript
const PHP_API = 'http://localhost:81/mafatype/backend-php/api.php';
```

### C. Update Port Node.js (Default: 3005)
Jika port `3005` sudah digunakan oleh aplikasi lain, Anda perlu mengubahnya di beberapa tempat:
1.  **`node-server/server.js`**: Ubah `const PORT = 3005;` (baris 17).
2.  **`js/multiplayer.js`**: Ubah angka `3005` pada baris koneksi socket (baris 3).
3.  **`backend-php/settings.json`**: Ubah `"node_server_url"` (baris 7).
4.  **`backend-php/start-node-server.php`**: Ubah angka `3005` pada pengecekan port (baris 47).

> [!NOTE]
> Frontend Mafatype menggunakan path relatif untuk API PHP, sehingga tidak perlu diubah. Namun untuk koneksi WebSocket (Node.js), port harus ditentukan secara eksplisit.

## 7. Panduan Instalasi Offline (Tanpa Internet)
Jika komputer target tidak memiliki koneksi internet, ikuti prosedur bundling berikut:

### A. Persiapan di Komputer yang Memiliki Internet
1.  **Bundling Node Modules**:
    - Di dalam folder `node-server`, jalankan `npm install`.
    - **PENTING**: Jangan hapus folder `node_modules`. Folder ini harus ikut disalin ke komputer target.
2.  **Download Installer Portable**:
    - Download **Laragon Portable** atau **XAMPP Portable** (format ZIP).
    - Download **Node.js Windows Binary (.zip)** dari situs resmi Node.js.
3.  **Siapkan Database**: Pastikan file `database/typing_master.sql` sudah ada di dalam folder.

### B. Langkah di Komputer Target (Offline)
1.  **Setup Server**: Ekstrak Laragon/XAMPP portable dan jalankan Apache & MySQL.
2.  **Copy Proyek**: Salin seluruh folder `mafatype` (termasuk `node_modules`) ke folder `www` atau `htdocs`.
3.  **Setup Node.js**: Ekstrak ZIP Node.js (misal ke `C:\node`).
    - **Opsi PATH**: Klik Start > ketik "Env" > "Edit the system environment variables" > "Environment Variables". Di bagian "System variables", cari "Path", klik Edit, lalu tambahkan path folder Node.js yang diekstrak (contoh: `C:\node`).
    - **Opsi Path Langsung**: Jika tidak ingin mengubah PATH, Anda bisa memanggil `node.exe` dengan alamat lengkapnya, contoh: `C:\node\node.exe server.js`.
4.  **Menjalankan Service**:
    - **Cara Mudah**: Buka halaman `http://localhost/mafatype/frontend/multiplayer.html` di browser. Jika muncul tombol **"Hubungkan Server"**, klik tombol tersebut untuk menjalankan server Node secara otomatis di latar belakang.
    - **Cara Manual**: Jika tombol tersebut gagal, buka CMD, masuk ke folder `node-server`, lalu jalankan: `node server.js` (biarkan terminal ini tetap terbuka).

## Verifikasi Akhir
Buka browser dan akses: `http://localhost/mafatype/frontend/index.html` (atau menyesuaikan port kustom jika ada).
