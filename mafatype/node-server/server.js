const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3005;

app.get('/health', (req, res) => {
    res.json({
        online: true,
        rooms: Object.values(rooms).map(r => ({
            id: r.id,
            status: r.status,
            language: r.language,
            players: r.players.map(p => ({ 
                username: p.username, 
                id: p.id,
                progress: p.progress,
                wpm: p.wpm,
                finished: p.finished
            }))
        }))
    });
});

const PHP_API = 'http://localhost/mafatype/backend-php/api.php';

// Fetch words from PHP backend (returns array of strings)
function fetchWords(lang) {
    return new Promise((resolve, reject) => {
        const url = `${PHP_API}?action=words&lang=${lang || 'en'}`;
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.words || []);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

// State management
const rooms = {};

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Create a new room
    socket.on('create_room', (data) => {
        const { username, language, maxPlayers } = data;
        const roomCode = Math.floor(1000 + Math.random() * 9000).toString();

        rooms[roomCode] = {
            id: roomCode,
            language: language || 'en',
            maxPlayers: Math.min(100, Math.max(1, parseInt(maxPlayers) || 5)),
            players: [],
            status: 'waiting',
            startTime: null,
            words: []
        };

        socket.join(roomCode);
        rooms[roomCode].players.push({
            id: socket.id,
            username,
            progress: 0,
            wpm: 0,
            finished: false,
            isCreator: true
        });

        socket.emit('room_created', { roomCode, room: rooms[roomCode] });
    });

    // Join an existing room
    socket.on('join_room', (data) => {
        const { roomCode, username } = data;

        if (!rooms[roomCode]) {
            socket.emit('error', { message: 'Room tidak ditemukan.' });
            return;
        }
        if (rooms[roomCode].players.length >= rooms[roomCode].maxPlayers) {
            socket.emit('error', { message: `Room sudah penuh (maks. ${rooms[roomCode].maxPlayers} pemain).` });
            return;
        }
        if (rooms[roomCode].status !== 'waiting') {
            socket.emit('error', { message: 'Balapan sudah dimulai atau selesai.' });
            return;
        }

        socket.join(roomCode);
        rooms[roomCode].players.push({
            id: socket.id,
            username,
            progress: 0,
            wpm: 0,
            finished: false,
            isCreator: false
        });

        io.to(roomCode).emit('player_joined', { room: rooms[roomCode] });
    });

    // Start race countdown (only creator can trigger)
    socket.on('start_race', async (data) => {
        const { roomCode } = data;
        const room = rooms[roomCode];
        if (!room || room.status !== 'waiting') return;

        // Check creator
        const player = room.players.find(p => p.id === socket.id);
        if (!player || !player.isCreator) return;

        room.status = 'countdown';
        io.to(roomCode).emit('race_starting', { duration: 3 });

        // Fetch words from PHP backend
        let words = [];
        try {
            words = await fetchWords(room.language);
        } catch (e) {
            console.error('Failed to fetch words:', e.message);
            // Fallback: some basic words
            words = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'it',
                'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this'];
        }

        // Ensure at least 50 words by repeating
        while (words.length < 50) words = [...words, ...words];
        words = words.slice(0, 60);
        room.words = words;

        // Wait 3 seconds then start
        setTimeout(() => {
            if (!rooms[roomCode]) return; // Room may have been deleted
            rooms[roomCode].status = 'playing';
            rooms[roomCode].startTime = Date.now();
            io.to(roomCode).emit('race_started', { words });
        }, 3000);
    });

    // Handle player progress
    socket.on('player_progress', (data) => {
        const { roomCode, progress, wpm } = data;
        const room = rooms[roomCode];
        if (!room || room.status !== 'playing') return;

        const player = room.players.find(p => p.id === socket.id);
        if (player) {
            player.progress = progress;
            player.wpm = wpm;
            io.to(roomCode).emit('update_progress', { players: room.players });
        }
    });

    // Handle player finish
    socket.on('finish_race', (data) => {
        const { roomCode, wpm, accuracy } = data;
        const room = rooms[roomCode];
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (player && !player.finished) {
            player.finished = true;
            player.finalWpm = wpm;
            player.finalAccuracy = accuracy;
            player.finishTime = Date.now() - room.startTime;
            player.progress = 100;

            io.to(roomCode).emit('player_finished', {
                playerId: socket.id,
                username: player.username,
                wpm,
                accuracy
            });

            // Update progress bars
            io.to(roomCode).emit('update_progress', { players: room.players });

            // Check if everyone is finished
            const allFinished = room.players.every(p => p.finished);
            if (allFinished) {
                _broadcastResults(roomCode);
            }
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const index = room.players.findIndex(p => p.id === socket.id);
            if (index === -1) continue;

            const wasPlaying = room.status === 'playing';
            room.players.splice(index, 1);

            if (room.players.length === 0) {
                delete rooms[roomCode];
            } else {
                // Reassign creator if needed
                if (!room.players.find(p => p.isCreator)) {
                    room.players[0].isCreator = true;
                }

                if (wasPlaying) {
                    // If race is in progress, check if remaining players all finished
                    const allFinished = room.players.every(p => p.finished);
                    if (allFinished) {
                        _broadcastResults(roomCode);
                    } else {
                        // Notify remaining players someone left
                        io.to(roomCode).emit('player_left', { room });
                        io.to(roomCode).emit('update_progress', { players: room.players });
                    }
                } else {
                    io.to(roomCode).emit('player_left', { room });
                }
            }
            break;
        }
    });
});

function _broadcastResults(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    room.status = 'finished';
    const results = [...room.players].sort((a, b) => (a.finishTime || Infinity) - (b.finishTime || Infinity));
    io.to(roomCode).emit('broadcast_result', { results });
}

server.listen(PORT, () => {
    console.log(`🚀 Multiplayer Socket.IO server running on port ${PORT}`);
});
