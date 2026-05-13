class MultiplayerRace {
    constructor() {
        this.socket = io(`http://${window.location.hostname}:3005`, {
            reconnectionAttempts: 5,
            timeout: 5000
        });
        this.roomCode = null;
        this.username = '';
        this.language = 'en';
        this.isCreator = false;
        this.words = [];
        this.wordIndex = 0;
        this.correct = 0;
        this.wrong = 0;
        this.startTime = null;
        this.finished = false;
        this.timerInterval = null;
        this.afkTimer = null;
        this.afkLimit = 10000;

        this.$lobby = document.getElementById('view-lobby');
        this.$waiting = document.getElementById('view-waiting');
        this.$race = document.getElementById('view-race');
        this.$overlay = document.getElementById('countdown-overlay');
        this.$cdNum = document.getElementById('countdown-num');
        this.$progress = document.getElementById('opponent-progress');
        this.$display = document.getElementById('word-display');
        this.$input = document.getElementById('typing-input');
        this.$results = document.getElementById('race-results');
        this.$resultsList = document.getElementById('results-list');
        this.$btnStart = document.getElementById('btn-start');
        this.$timer = document.getElementById('race-timer');

        this._bindDOM();
        this._bindSocket();
        this._bindInput();
    }

    _bindDOM() {
        document.getElementById('btn-create').addEventListener('click', () => {
            const uname = document.getElementById('mp-username').value.trim();
            this.username = uname || App.t('guest') + Math.floor(Math.random() * 1000);
            this.language = document.getElementById('mp-lang').value;
            const maxPlayersInput = parseInt(document.getElementById('mp-max-players').value) || 5;
            this.maxPlayers = Math.min(100, Math.max(1, maxPlayersInput));
            document.getElementById('lobby-error').textContent = '';
            this.socket.emit('create_room', { username: this.username, language: this.language, maxPlayers: this.maxPlayers });
        });

        document.getElementById('btn-join').addEventListener('click', () => {
            const code = document.getElementById('mp-code').value.trim().toUpperCase();
            if (!code) { document.getElementById('lobby-error').textContent = App.t('enter_room_code'); return; }
            const uname = document.getElementById('mp-username').value.trim();
            this.username = uname || App.t('guest') + Math.floor(Math.random() * 1000);
            document.getElementById('lobby-error').textContent = '';
            this.socket.emit('join_room', { roomCode: code, username: this.username });
        });

        this.$btnStart.addEventListener('click', () => {
            if (this.roomCode) this.socket.emit('start_race', { roomCode: this.roomCode });
        });

        // Connect server button (to start node-server via PHP)
        const btnConnect = document.getElementById('btn-connect-server');
        if (btnConnect) {
            btnConnect.addEventListener('click', async () => {
                btnConnect.disabled = true;
                btnConnect.textContent = '⏳ Memulai Server…';
                try {
                    const res = await fetch('../backend-php/start-node-server.php');
                    const data = await res.json();
                    if (data.status === 'success') {
                        App.toast(data.message, 'success');
                        // Socket should automatically reconnect
                    } else {
                        App.toast(data.message, 'error');
                        btnConnect.disabled = false;
                        btnConnect.textContent = '🔌 Hubungkan Server';
                    }
                } catch (e) {
                    App.toast('Gagal menghubungi backend PHP.', 'error');
                    btnConnect.disabled = false;
                    btnConnect.textContent = '🔌 Hubungkan Server';
                }
            });
        }
    }

    _bindSocket() {
        // ── Connection status ───────────────────────────────────────────
        const setStatus = (connected) => {
            const badge = document.getElementById('server-status');
            const btns = [document.getElementById('btn-create'), document.getElementById('btn-join')];
            const btnConnect = document.getElementById('btn-connect-server');

            if (connected) {
                badge.innerHTML = `<span class="status-dot status-online"></span> ${App.t('server_online')}`;
                badge.className = 'server-badge server-online';
                btns.forEach(b => b && (b.disabled = false));
                document.getElementById('lobby-error').textContent = '';
                if (btnConnect) btnConnect.style.display = 'none';
            } else {
                badge.innerHTML = `<span class="status-dot status-offline"></span> ${App.t('server_offline')}`;
                badge.className = 'server-badge server-offline';
                btns.forEach(b => b && (b.disabled = true));
                document.getElementById('lobby-error').textContent =
                    '⚠️ Tidak dapat terhubung ke server multiplayer. Hubungkan server terlebih dahulu.';
                if (btnConnect) {
                    btnConnect.style.display = 'block';
                    btnConnect.textContent = '🔌 Hubungkan Server';
                    btnConnect.disabled = false;
                }
            }
        };

        this.socket.on('connect', () => setStatus(true));
        this.socket.on('disconnect', () => setStatus(false));
        this.socket.on('connect_error', () => setStatus(false));

        this.socket.on('room_created', ({ roomCode, room }) => {
            this.roomCode = roomCode;
            this.isCreator = true;
            this._showWaiting(room);
        });

        this.socket.on('player_joined', ({ room }) => {
            if (!this.roomCode) { this.roomCode = room.id; this.isCreator = false; }
            this._showWaiting(room);
        });

        this.socket.on('player_left', ({ room }) => {
            if (this.$waiting.style.display !== 'none') {
                this._showWaiting(room);
            }
        });

        this.socket.on('error', ({ message }) => {
            document.getElementById('lobby-error').textContent = message;
        });

        this.socket.on('race_starting', ({ duration }) => {
            this.$overlay.style.display = 'grid';
            // Transition from lobby/waiting to race view during countdown
            this.$waiting.style.display = 'none';
            this.$race.style.display = 'block';
            this.$input.disabled = true;
            this.$input.placeholder = App.t('pre_start_countdown');
            this.$display.innerHTML = `<span style="color:var(--text-muted)">${App.t('loading_words')}</span>`;

            let n = duration;
            this.$cdNum.textContent = n;
            const iv = setInterval(() => {
                n--;
                if (n > 0) { this.$cdNum.textContent = n; }
                else { clearInterval(iv); this.$overlay.style.display = 'none'; }
            }, 1000);
        });

        this.socket.on('race_started', ({ words }) => {
            this.words = words;
            this.wordIndex = 0;
            this.correct = 0;
            this.wrong = 0;
            this.finished = false;
            this.startTime = Date.now();
            this.$overlay.style.display = 'none';
            this.$input.disabled = false;
            this.$input.placeholder = App.translations.type_here || 'Type here...';
            this.$input.focus();
            this._renderWords();
            this._startTimer();
            this.startAfkTimer();
        });

        this.socket.on('update_progress', ({ players }) => {
            this._renderBars(players);
        });

        this.socket.on('player_finished', ({ playerId, username }) => {
            if (playerId !== this.socket.id) {
                App.toast(App.t('mp_finished_toast').replace('{username}', username), 'info');
            }
        });

        this.socket.on('broadcast_result', ({ results }) => {
            this._stopTimer();
            this._showResults(results);
        });
    }

    _bindInput() {
        // Handle Space to advance to next word
        this.$input.addEventListener('keydown', e => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (!this.finished && this.startTime) this._processWord();
            }
        });

        // Handle real-time active-word wrong/correct highlighting
        this.$input.addEventListener('input', () => {
            if (this.finished) return;
            this.resetAfkTimer();
            const val = this.$input.value;
            const target = this.words[this.wordIndex];
            const span = this.$display.children[this.wordIndex];
            if (span) {
                if (val && !target.startsWith(val)) span.classList.add('wrong');
                else span.classList.remove('wrong');
            }
        });
    }

    _processWord() {
        const typed = this.$input.value.trim();
        if (!typed) return; // Don't advance on empty input
        const target = this.words[this.wordIndex];
        const span = this.$display.children[this.wordIndex];

        // Word is incorrect: clear input so user retypes, stay on same word
        if (typed !== target) {
            span.classList.add('wrong');
            this.$input.value = '';
            this.$input.classList.add('input-shake');
            setTimeout(() => this.$input.classList.remove('input-shake'), 350);
            return;
        }

        // Correct word — advance
        span.classList.remove('active', 'wrong');
        span.classList.add('correct');
        this.correct++;
        this.wordIndex++;
        this.$input.value = '';

        this._emitProgress();

        if (this.wordIndex < this.words.length) {
            const next = this.$display.children[this.wordIndex];
            next.classList.add('active');
            const dispRect = this.$display.getBoundingClientRect();
            const nextRect = next.getBoundingClientRect();
            if (nextRect.bottom > dispRect.bottom - 40) {
                this.$display.scrollTop += nextRect.height + 8;
            }
        } else {
            this._finish();
        }
    }

    _renderWords() {
        this.$display.innerHTML = '';
        this.$display.scrollTop = 0;
        this.$display.setAttribute('lang', this.language);
        this.$input.setAttribute('lang', this.language);

        if (this.language === 'ar') {
            this.$display.setAttribute('dir', 'rtl');
            this.$input.setAttribute('dir', 'rtl');
        } else {
            this.$display.removeAttribute('dir');
            this.$input.removeAttribute('dir');
        }

        this.words.forEach((w, i) => {
            const span = document.createElement('span');
            span.className = 'word' + (i === 0 ? ' active' : '');
            span.textContent = w;
            this.$display.appendChild(span);
        });
    }

    _renderBars(players) {
        this.$progress.innerHTML = '';
        // Sort descending by progress so leader is always on top
        const sorted = [...players].sort((a, b) => b.progress - a.progress);
        sorted.forEach((p, i) => {
            const pos = i + 1;
            const mine = p.id === this.socket.id;
            const el = document.createElement('div');
            el.className = 'player-track';
            const finishedLabel = p.finished ? ` <span style="font-size:.65rem;color:var(--correct)">✓ ${App.t('finished')}</span>` : '';
            el.innerHTML = `
                <div class="pos-badge">${pos}</div>
                <div class="player-name" style="${mine ? 'color:var(--primary);font-weight:700' : ''}">${p.username}${finishedLabel}</div>
                <div class="progress-bar-wrap"><div class="progress-bar" style="width:${p.progress}%"></div></div>
                <div class="player-wpm">${p.wpm}<span style="font-size:.65rem;font-weight:400"> WPM</span></div>`;
            this.$progress.appendChild(el);
        });
    }

    _emitProgress() {
        if (!this.startTime) return;
        const progress = Math.round((this.wordIndex / this.words.length) * 100);
        // WPM = correct_words / elapsed_minutes  (falls if player stops typing)
        const elapsedMin = (Date.now() - this.startTime) / 60000;
        const wpm = elapsedMin > 0 ? Math.round(this.correct / elapsedMin) : 0;
        this.socket.emit('player_progress', { roomCode: this.roomCode, progress, wpm });
    }

    _startTimer() {
        if (!this.$timer) return;
        this.timerInterval = setInterval(() => {
            const secs = Math.floor((Date.now() - this.startTime) / 1000);
            const m = Math.floor(secs / 60).toString().padStart(2, '0');
            const s = (secs % 60).toString().padStart(2, '0');
            this.$timer.textContent = `⏱ ${m}:${s}`;
            // Broadcast WPM every second so others see real-time WPM decay
            this._emitProgress();
        }, 1000);
    }

    startAfkTimer() {
        if (this.finished || !this.startTime) return;
        clearTimeout(this.afkTimer);
        this.afkTimer = setTimeout(() => {
            this.showAfk();
        }, this.afkLimit);
    }

    resetAfkTimer() {
        if (this.finished || !this.startTime) return;
        this.startAfkTimer();
    }

    showAfk() {
        if (this.finished || !this.startTime) return;
        // Stop timer and finish state immediately without emitting result
        this._stopTimer();
        this.finished = true;
        this.$input.disabled = true;

        App.showAfkModal(() => {
            // For multiplayer, we probably want to reload or go back to lobby
            // but the request says "score has not been saved", so a reset/reload is best.
            window.location.reload(); 
        });
    }

    _stopTimer() {
        if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
        clearTimeout(this.afkTimer);
    }

    _finish() {
        if (this.finished) return;
        this.finished = true;
        this._stopTimer();
        this.$input.disabled = true;
        this.$input.placeholder = App.t('finished_wait');
        const elapsed = (Date.now() - this.startTime) / 60000;
        const wpm = elapsed > 0 ? Math.round(this.correct / elapsed) : 0;
        const total = this.correct + this.wrong;
        const accuracy = total > 0 ? Math.round((this.correct / total) * 100) : 100;
        this.socket.emit('finish_race', { roomCode: this.roomCode, wpm, accuracy });
        App.toast(App.t('finished_you_toast'), 'success');
    }

    _showWaiting(room) {
        this.$lobby.style.display = 'none';
        this.$waiting.style.display = 'block';
        this.language = room.language || 'en';
        document.getElementById('room-code-display').textContent = room.id;

        const listEl = document.getElementById('player-list');
        listEl.innerHTML = '';
        room.players.forEach(p => {
            const el = document.createElement('div');
            el.className = 'player-waiting-item';
            const isMe = p.id === this.socket.id;
            el.innerHTML = `
                <span>${p.isCreator ? '👑' : '👤'}</span>
                <strong>${p.username}</strong>
                ${isMe ? `<span class="you-badge">${App.t('you_label')}</span>` : ''}`;
            listEl.appendChild(el);
        });

        const me = room.players.find(p => p.id === this.socket.id);
        if (me) this.isCreator = me.isCreator;

        // Creator can start with 1+ players (solo for testing allowed)
        this.$btnStart.style.display = (this.isCreator && room.players.length >= 1) ? 'block' : 'none';

        // Show start hint with player count
        const hint = document.getElementById('start-hint');
        if (hint) {
            const cur = room.players.length;
            const max = room.maxPlayers || '?';
            const countLabel = `<span style="font-weight:700;color:var(--primary)">${cur}/${max}</span> ${App.t('player_count_label')}`;
            if (this.isCreator) {
                hint.innerHTML = cur < 2
                    ? countLabel + App.t('mp_creator_solo_hint')
                    : countLabel + App.t('mp_creator_ready_hint');
            } else {
                hint.innerHTML = countLabel + App.t('mp_wait_creator_hint');
            }
        }
    }

    _showResults(results) {
        this.$results.style.display = 'block';
        this.$results.scrollIntoView({ behavior: 'smooth', block: 'start' });
        this.$resultsList.innerHTML = '';
        results.forEach((r, i) => {
            const el = document.createElement('div');
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            const mine = r.id === this.socket.id;
            el.className = 'result-row' + (mine ? ' result-row-mine' : '');
            el.innerHTML = `
                <span>${medal} <strong>${r.username}</strong></span>
                <span style="color:var(--primary);font-weight:700">${r.finalWpm || 0} WPM 
                    <span style="font-weight:400;color:var(--text-muted)">(${r.finalAccuracy || 0}%)</span>
                </span>`;
            this.$resultsList.appendChild(el);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('view-lobby')) new MultiplayerRace();
});
