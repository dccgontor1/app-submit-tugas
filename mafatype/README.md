# Mafatype.

A high-performance, modern typing speed testing platform with global leaderboards, dynamic languages, and real-time multiplayer races.

## Features
- **Standard Typing Test**: Measure WPM and Accuracy with 60-second typing tests.
- **Multiplayer Races**: Real-time Socket.IO powered races supporting up to 5 players per room.
- **Global Competitions**: Admin-created events users can join to compete on dedicated leaderboards.
- **Localization**: Full support for English, Indonesian, and Arabic (including proper RTL formatting).
- **Aesthetics**: Sleek interface with Dark Mode, tabular fonts, and micro-audio interactions.

## Stack
- **Frontend**: Vanilla HTML/CSS/JS
- **Backend**: PHP (REST API endpoints)
- **Database**: MySQL Server
- **Websockets**: Node.js + Express + Socket.IO

## Installation Guide

### 1. Database
Create the database and load the initial seed schemas containing user structures and dictionary words.
```bash
mysql -u root -p < database/typing_master.sql
```

Ensure `backend-php/config.php` has your correct MySQL hostname, username, and password.

### 2. Node.js WebSocket Server
Install dependencies and start the real-time server that handles the multiplayer connections.
```bash
cd node-server
npm install
node server.js
# Runs on Port 3000 by Default
```

### 3. Web Server
Ensure the root `mafatype` folder is served by your PHP web server (such as Laragon, XAMPP, or Nginx).

Alternatively, you can start a local PHP development server:
```bash
cd /path/to/mafatype
php -S localhost:80
```

### 4. Running the App
Load up the application inside your web browser:
`http://localhost/mafatype/frontend/index.html`

> **Note**: For multiplayer to work on separate machines across a network, ensure to replace the 'localhost' string references in `js/multiplayer.js` with your active machine's LAN IP Address.
