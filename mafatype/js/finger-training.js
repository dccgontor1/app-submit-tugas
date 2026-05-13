/**
 * Finger Training Module
 */
const FingerTraining = {
    fingers: [
        { id: 'left-pinky', name: App.t('left_pinky'), keys: 'qaz' },
        { id: 'left-ring', name: App.t('left_ring'), keys: 'wsx' },
        { id: 'left-middle', name: App.t('left_middle'), keys: 'edc' },
        { id: 'left-index', name: App.t('left_index'), keys: 'rtfgvb' },
        { id: 'right-index', name: App.t('right_index'), keys: 'yuhjnm' },
        { id: 'right-middle', name: App.t('right_middle'), keys: 'ik,' },
        { id: 'right-ring', name: App.t('right_ring'), keys: 'ol.' },
        { id: 'right-pinky', name: App.t('right_pinky'), keys: 'p;/' },
        { id: 'all-fingers', name: App.t('all_fingers'), keys: 'abcdefghijklmnopqrstuvwxyz' }
    ],

    currentFinger: null,
    targetText: '',
    currentIndex: 0,
    errors: 0,
    startTime: null,
    timer: null,
    isFinished: false,

    // History Pagination & Filter State
    historyPage: 1,
    historyFinger: 'all',
    historyLimit: 10,
    historyTotalPages: 1,
    historyTotalItems: 0,
    historyFrom: 0,
    historyTo: 0,
    isLoadingHistory: false,

    // Mapping for hand visuals
    keyToFinger: {
        'q': 'l-pinky', 'a': 'l-pinky', 'z': 'l-pinky',
        'w': 'l-ring', 's': 'l-ring', 'x': 'l-ring',
        'e': 'l-middle', 'd': 'l-middle', 'c': 'l-middle',
        'r': 'l-index', 't': 'l-index', 'f': 'l-index', 'g': 'l-index', 'v': 'l-index', 'b': 'l-index',
        'y': 'r-index', 'u': 'r-index', 'h': 'r-index', 'j': 'r-index', 'n': 'r-index', 'm': 'r-index',
        'i': 'r-middle', 'k': 'r-middle', ',': 'r-middle',
        'o': 'r-ring', 'l': 'r-ring', '.': 'r-ring',
        'p': 'r-pinky', ';': 'r-pinky', '/': 'r-pinky',
        ' ': 'thumb' // Space is thumb, but we don't visualize thumb yet
    },

    init() {
        this.renderSelector();
        this.bindEvents();
        this.loadProgress();
        this.loadHistory();
        this.initFingerTooltips();
        this.initKeyboardTooltips();

        // Listen for translation changes
        window.addEventListener('translationsLoaded', () => {
            this.fingers.forEach(f => {
                f.name = App.t(f.id.replace(/-/g, '_'));
            });
            this.renderSelector();
            this.loadProgress(); // Re-apply stats after re-rendering selector
            this.initFingerTooltips();
            this.initKeyboardTooltips();
        });

        // Default to first finger
        this.selectFinger(this.fingers[0].id);
    },

    initKeyboardTooltips() {
        const fingerNames = {
            'l-pinky': App.t('left_pinky'),
            'l-ring': App.t('left_ring'),
            'l-middle': App.t('left_middle'),
            'l-index': App.t('left_index'),
            'r-index': App.t('right_index'),
            'r-middle': App.t('right_middle'),
            'r-ring': App.t('right_ring'),
            'r-pinky': App.t('right_pinky'),
            'thumb': App.t('thumb_label')
        };

        document.querySelectorAll('.kb-key').forEach(keyEl => {
            const char = keyEl.getAttribute('data-key');
            if (char === ' ') {
                keyEl.setAttribute('data-finger', 'Thumb');
                return;
            }
            const fingerId = this.keyToFinger[char];
            if (fingerId && fingerNames[fingerId]) {
                keyEl.setAttribute('data-finger', fingerNames[fingerId]);
            }
        });
    },

    initFingerTooltips() {
        this.fingers.forEach(f => {
            if (f.id === 'all-fingers') return;

            // Map finger id to hand visual id
            let visualId = '';
            if (f.id.startsWith('left-')) visualId = 'hand-l-' + f.id.replace('left-', '');
            else if (f.id.startsWith('right-')) visualId = 'hand-r-' + f.id.replace('right-', '');

            if (visualId) {
                const el = document.getElementById(visualId);
                if (el) {
                    el.setAttribute('data-keys', f.keys.toUpperCase());
                    const name = el.getAttribute('title') || '';
                    el.setAttribute('data-label', `${name} • ${f.keys.toUpperCase()}`);
                    el.removeAttribute('title');
                }
            }
        });

        // Ensure thumbs have data-label and no native title
        ['hand-l-thumb', 'hand-r-thumb'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.setAttribute('data-keys', 'SPACE');
                el.setAttribute('data-label', `${App.t('thumb_label')} • SPACE`);
                el.removeAttribute('title');
            }
        });
    },

    renderSelector() {
        const container = document.getElementById('finger-selector');
        container.innerHTML = this.fingers.map(f => {
            const isActive = this.currentFinger && this.currentFinger.id === f.id;
            return `
                <button class="finger-btn ${isActive ? 'active' : ''}" id="btn-${f.id}" onclick="FingerTraining.selectFinger('${f.id}')">
                    <span class="name">${f.name}</span>
                    <span class="keys">${f.keys}</span>
                    <div class="stats-row">
                        <span class="best-wpm" id="best-${f.id}">${App.t('best_label')}: —</span>
                        <span class="trained-count" id="count-${f.id}">${App.t('trained_label') || 'Trained'}: 0</span>
                    </div>
                </button>
            `;
        }).join('');
    },

    async loadProgress() {
        const user = App.getUser();
        const localStats = JSON.parse(localStorage.getItem('mafatype_ft_stats') || '{}');
        const settings = JSON.parse(sessionStorage.getItem('global_settings') || '{}');
        const minReq = parseInt(settings.min_attempts_finger || 1);

        // Function to update single finger UI
        const updateUI = (fid, best, count) => {
            const bestEl = document.getElementById(`best-${fid}`);
            const countEl = document.getElementById(`count-${fid}`);
            if (bestEl) bestEl.textContent = `${App.t('best_label')}: ${Math.round(best)} WPM`;
            if (countEl) {
                const label = App.t('trained_label') || 'Trained';
                countEl.textContent = `${label}: ${count}/${minReq}`;
                if (count >= minReq) countEl.style.color = 'var(--success)';
            }
        };

        // Apply local stats first (works for guests)
        Object.keys(localStats).forEach(fingerId => {
            const s = localStats[fingerId];
            updateUI(fingerId, s.best_wpm, s.training_count);
        });

        if (!user) return;

        try {
            const res = await fetch(`/mafatype/backend-php/api.php?action=get-finger-results&user_id=${user.id}`);
            const data = await res.json();
            if (data.results) {
                data.results.forEach(r => {
                    // Prefer higher/more accurate value if local exists
                    const local = localStats[r.finger_name];
                    const bestWpm = local ? Math.max(r.best_wpm, local.best_wpm) : r.best_wpm;
                    const trainCount = local ? Math.max(r.training_count, local.training_count) : r.training_count;
                    updateUI(r.finger_name, bestWpm, trainCount);
                });
            }
        } catch (e) {
            console.error('Failed to load finger progress', e);
        }
    },

    bindEvents() {
        const input = document.getElementById('typing-input');
        input.addEventListener('input', (e) => this.handleInput(e));

        // Prevent focus loss but skip for certain elements to avoid jumps
        document.addEventListener('click', (e) => {
            if (this.isFinished) return;

            // Do not refocus if clicking on interactive elements like buttons, selects, or links
            const interactiveSelectors = 'button, select, input, a, .finger-btn, .badge-finger, .btn-sm';
            if (e.target.closest(interactiveSelectors)) return;

            input.focus({ preventScroll: true });
        });

        // Highlight keys on keydown physically (optional feedback)
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const modal = document.getElementById('result-modal');
                if (modal && modal.classList.contains('show')) {
                    this.nextFinger();
                    return;
                }
            }

            const key = e.key.toLowerCase();
            const keyEl = document.querySelector(`.kb-key[data-key="${key}"]`);
            if (keyEl) {
                keyEl.classList.add('active-press');
                setTimeout(() => keyEl.classList.remove('active-press'), 100);
            }
        });

        // Key hover effect to highlight associated finger
        document.querySelectorAll('.kb-key').forEach(keyEl => {
            keyEl.addEventListener('mouseenter', (e) => {
                const char = e.target.getAttribute('data-key');
                if (!char) return;
                const fingerId = this.keyToFinger[char];
                if (fingerId === 'thumb') {
                    const lThumb = document.getElementById('hand-l-thumb');
                    const rThumb = document.getElementById('hand-r-thumb');
                    if (lThumb) lThumb.classList.add('hover-active');
                    if (rThumb) rThumb.classList.add('hover-active');
                } else if (fingerId) {
                    const fEl = document.getElementById(`hand-${fingerId}`);
                    if (fEl) fEl.classList.add('hover-active');
                }
            });
            keyEl.addEventListener('mouseleave', (e) => {
                const char = e.target.getAttribute('data-key');
                if (!char) return;
                const fingerId = this.keyToFinger[char];
                if (fingerId === 'thumb') {
                    const lThumb = document.getElementById('hand-l-thumb');
                    const rThumb = document.getElementById('hand-r-thumb');
                    if (lThumb) lThumb.classList.remove('hover-active');
                    if (rThumb) rThumb.classList.remove('hover-active');
                } else if (fingerId) {
                    const fEl = document.getElementById(`hand-${fingerId}`);
                    if (fEl) fEl.classList.remove('hover-active');
                }
            });
        });

        // Finger hover effect to highlight associated keys
        document.querySelectorAll('.finger').forEach(fEl => {
            fEl.addEventListener('mouseenter', (e) => {
                const keysStr = e.target.getAttribute('data-keys');
                if (!keysStr) return;

                if (keysStr === 'SPACE') {
                    const spaceKey = document.querySelector('.kb-key[data-key=" "]');
                    if (spaceKey) spaceKey.classList.add('hover-active-key');
                } else {
                    const keys = keysStr.toLowerCase().split('');
                    keys.forEach(k => {
                        const keyEl = document.querySelector(`.kb-key[data-key="${k}"]`);
                        if (keyEl) keyEl.classList.add('hover-active-key');
                    });
                }
            });
            fEl.addEventListener('mouseleave', (e) => {
                const keysStr = e.target.getAttribute('data-keys');
                if (!keysStr) return;

                if (keysStr === 'SPACE') {
                    const spaceKey = document.querySelector('.kb-key[data-key=" "]');
                    if (spaceKey) spaceKey.classList.remove('hover-active-key');
                } else {
                    const keys = keysStr.toLowerCase().split('');
                    keys.forEach(k => {
                        const keyEl = document.querySelector(`.kb-key[data-key="${k}"]`);
                        if (keyEl) keyEl.classList.remove('hover-active-key');
                    });
                }
            });
        });
    },

    selectFinger(id) {
        this.currentFinger = this.fingers.find(f => f.id === id);

        // Update UI
        document.querySelectorAll('.finger-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`btn-${id}`).classList.add('active');

        this.resetInternal();
        this.generateText();
        this.renderText();
        this.updateKeyboard();
    },

    resetInternal() {
        this.currentIndex = 0;
        this.errors = 0;
        this.startTime = null;
        this.isFinished = false;
        if (this.timer) clearInterval(this.timer);

        // Ensure modal is closed
        const modal = document.getElementById('result-modal');
        if (modal) modal.classList.remove('show');

        document.getElementById('rt-wpm').textContent = '0';
        document.getElementById('rt-acc').textContent = '100%';
        document.getElementById('rt-time').textContent = '0';
        document.getElementById('typing-input').value = '';
        document.getElementById('typing-input').focus();
        
        // Hide next button on reset and show restart button
        const nextBtn = document.getElementById('btn-next-finger');
        if (nextBtn) nextBtn.style.display = 'none';
        const restartBtn = document.querySelector('button[onclick="FingerTraining.restartFromStart();"]');
        if (restartBtn) restartBtn.style.display = 'block';
    },

    wordLists: {
        'left-pinky': ['aqaz', 'qaza', 'zaqa'],
        'left-ring': ['swsx', 'xsws'],
        'left-middle': ['dedc', 'cded'],
        'left-index': ['frfv', 'vfrf', 'gtgb', 'bgtg'],
        'right-index': ['jujm', 'mjuj', 'hyhn', 'nhyh'],
        'right-middle': ['kik,', ',kik'],
        'right-ring': ['lol.', '.lol'],
        'right-pinky': [';p;/', '/;p;'],
        'all-fingers': [
            'aqaz', 'qaza', 'swsx', 'xsws', 'dedc', 'cded', 'frfv', 'vfrf', 'gtgb', 'bgtg',
            'jujm', 'mjuj', 'hyhn', 'nhyh', 'asdf', 'jkl;', 'asdf', 'jkl;', 'qwer', 'uiop',
            'zxcv', 'm,./', 'qwer', 'uiop', 'zxcv', 'm,./', 'abcdefg', 'hijklmnop', 'qrstuvwxyz',
            'abcdefg', 'hijklmnop', 'qrstuvwxyz', 'abcdefg', 'hijklmnop', 'qrstuvwxyz',
            'abcdefghijklmnopqrstuvwxyz', 'abcdefghijklmnopqrstuvwxyz', 'abcdefghijklmnopqrstuvwxyz'
        ]
    },

    generateText() {
        const words = this.wordLists[this.currentFinger.id] || ['error'];
        let text = '';

        if (this.currentFinger.id === 'all-fingers') {
            // No repetition for All Fingers
            text = words.join(' ');
        } else {
            // Repeat each word 10 times for individual fingers
            words.forEach(word => {
                for (let r = 0; r < 10; r++) {
                    text += word + ' ';
                }
            });
        }

        this.targetText = text.trim();
    },

    renderText() {
        const container = document.getElementById('word-display-inner');
        const words = this.targetText.split(' ');
        let charIndex = 0;

        // Custom Layout for All Fingers
        if (this.currentFinger.id === 'all-fingers') {
            container.style.display = 'flex';
            container.style.flexWrap = 'wrap';
            container.style.gap = '0.5rem 1rem';
            container.style.justifyContent = 'center';
        } else {
            container.style.display = 'grid';
            container.style.gridTemplateColumns = 'repeat(5, 1fr)';
            container.style.gap = '0.5rem 0';
            container.style.justifyContent = 'flex-start';
        }

        container.innerHTML = words.map((word, wordIdx) => {
            const wordChars = word.split('').map(c => {
                const i = charIndex++;
                return `<span class="char ${i === 0 ? 'current' : ''}" id="char-${i}">${c}</span>`;
            }).join('');

            // Add space character after the word if it's not the last word
            let spaceChar = '';
            if (wordIdx < words.length - 1) {
                const i = charIndex++;
                spaceChar = `<span class="char" id="char-${i}">&nbsp;</span>`;
            }

            return `<div class="word">${wordChars}${spaceChar}</div>`;
        }).join('');

        container.style.transform = 'translateY(0)';
    },

    handleInput(e) {
        if (this.isFinished) return;

        const typed = e.target.value;
        const char = typed[typed.length - 1];
        e.target.value = ''; // keep input clear

        if (!this.startTime) {
            this.startTime = Date.now();
            this.startTimer();
        }

        const targetChar = this.targetText[this.currentIndex];
        const charEl = document.getElementById(`char-${this.currentIndex}`);

        if (char === targetChar) {
            charEl.classList.add('correct');
            charEl.classList.remove('current', 'wrong');
            this.currentIndex++;

            if (this.currentIndex < this.targetText.length) {
                const nextEl = document.getElementById(`char-${this.currentIndex}`);
                nextEl.classList.add('current');

                // Optimized Scroll Logic for Grid
                const display = document.getElementById('word-display');
                const lineH = parseFloat(getComputedStyle(display).lineHeight) || 45;
                const rowNum = Math.floor(nextEl.offsetTop / lineH);

                if (rowNum >= 1) {
                    const inner = document.getElementById('word-display-inner');
                    inner.style.transform = `translateY(-${(rowNum) * lineH}px)`;
                }
            } else {
                this.finish();
            }
        } else {
            charEl.classList.add('wrong');
            // Don't increment index, user must correct it
            this.errors++;
        }

        this.updateStats();
        this.updateKeyboard();
    },

    updateStats() {
        const elapsed = (Date.now() - this.startTime) / 1000 / 60; // minutes
        const wpm = Math.round((this.currentIndex / 5) / elapsed) || 0;
        
        // Use total attempts (typed chars) for accurate accuracy if we wanted, 
        // but existing logic uses currentIndex (correct chars). 
        // Let's refine to handle the early error case better.
        const totalTyped = this.currentIndex + this.errors;
        const acc = totalTyped > 0 
            ? Math.max(0, Math.round((this.currentIndex / totalTyped) * 100)) 
            : 100;

        if (elapsed > 0) document.getElementById('rt-wpm').textContent = wpm;
        document.getElementById('rt-acc').textContent = acc + '%';
    },

    startTimer() {
        this.timer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            document.getElementById('rt-time').textContent = elapsed;
        }, 1000);
    },

    updateKeyboard() {
        if (this.isFinished || this.currentIndex >= this.targetText.length) {
            document.querySelectorAll('.kb-key').forEach(k => k.classList.remove('highlight'));
            document.querySelectorAll('.finger').forEach(f => f.classList.remove('active'));
            return;
        }

        // Highlight next key
        const nextChar = this.targetText[this.currentIndex].toLowerCase();

        document.querySelectorAll('.kb-key').forEach(k => k.classList.remove('highlight'));
        const keyEl = document.querySelector(`.kb-key[data-key="${nextChar}"]`);
        if (keyEl) keyEl.classList.add('highlight');

        // Highlight finger
        const fingerId = this.keyToFinger[nextChar];
        document.querySelectorAll('.finger').forEach(f => f.classList.remove('active'));
        if (fingerId) {
            if (fingerId === 'thumb') {
                const lThumb = document.getElementById('hand-l-thumb');
                const rThumb = document.getElementById('hand-r-thumb');
                if (lThumb) lThumb.classList.add('active');
                if (rThumb) rThumb.classList.add('active');
            } else {
                const fEl = document.getElementById(`hand-${fingerId}`);
                if (fEl) fEl.classList.add('active');
            }
        }
    },

    async finish() {
        this.isFinished = true;
        clearInterval(this.timer);

        const elapsed = (Date.now() - this.startTime) / 1000 / 60;
        const wpm = Math.round((this.targetText.length / 5) / elapsed) || 0;
        const totalTyped = this.targetText.length + this.errors;
        const acc = totalTyped > 0 
            ? Math.max(0, Math.round((this.targetText.length / totalTyped) * 100)) 
            : 100;

        // Update Modal UI
        const mWpm = document.getElementById('m-wpm');
        const mAcc = document.getElementById('m-acc');
        if (mWpm) mWpm.textContent = wpm;
        if (mAcc) mAcc.textContent = acc + '%';

        // Save to localStorage (Local session stats for both guest and logged-in)
        const localStats = JSON.parse(localStorage.getItem('mafatype_ft_stats') || '{}');
        const fingerId = this.currentFinger.id;
        if (!localStats[fingerId]) {
            localStats[fingerId] = { best_wpm: wpm, training_count: 1 };
        } else {
            localStats[fingerId].best_wpm = Math.max(localStats[fingerId].best_wpm, wpm);
            localStats[fingerId].training_count++;
        }
        localStorage.setItem('mafatype_ft_stats', JSON.stringify(localStats));

        this.openModal();

        const user = App.getUser();
        if (user) {
            try {
                const res = await App.post('save-finger-result', {
                    user_id: user.id,
                    finger_name: this.currentFinger.id,
                    wpm: wpm,
                    accuracy: acc
                });
                if (res.ok && res.data.achievements_unlocked) {
                    res.data.achievements_unlocked.forEach(ach => App.showAchievement(ach));
                }
                this.loadProgress(); // Refresh best scores from DB + Local
                this.loadHistory();  // Refresh full history
            } catch (e) {
                console.error('Failed to save result', e);
            }
        } else {
            // Guests still get to see their session progress
            this.loadProgress();
        }

        // Update Next button text and visibility (Outside user check)
        const nextBtn = document.getElementById('btn-next-finger');
        const restartBtn = document.querySelector('button[onclick="FingerTraining.restartFromStart();"]');
        
        if (nextBtn) {
            nextBtn.style.display = 'block';
            const isLast = this.currentFinger.id === this.fingers[this.fingers.length - 1].id;
            const btnSpan = nextBtn.querySelector('span');
            if (btnSpan) {
                btnSpan.textContent = isLast ? "Kembali ke awal" : "Lanjutkan ke latihan berikutnya";
                btnSpan.removeAttribute('data-i18n');
            }
            
            // Hide "Restart from Start" button as it's now redundant
            if (restartBtn) restartBtn.style.display = 'none';
        }

        this.openModal();
    },

    async loadHistory() {
        const user = App.getUser();
        if (!user) {
            document.getElementById('history-body').innerHTML = `
                <tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">${App.t('login_to_see_history')}</td></tr>
            `;
            return;
        }

        if (this.isLoadingHistory) return;
        this.isLoadingHistory = true;
        this.renderLoadingHistory();

        try {
            const url = `get-finger-history?user_id=${user.id}&page=${this.historyPage}&limit=${this.historyLimit}&finger=${this.historyFinger}`;
            const res = await App.get(url);

            if (res.ok && res.data.history) {
                this.historyTotalPages = res.data.pages || 1;
                this.historyTotalItems = res.data.total || 0;
                this.historyFrom = res.data.from || 0;
                this.historyTo = res.data.to || 0;
                this.renderHistory(res.data.history);
                this.updatePaginationUI();
            } else {
                this.historyTotalPages = 1;
                this.historyTotalItems = 0;
                this.historyFrom = 0;
                this.historyTo = 0;
                document.getElementById('history-body').innerHTML = `
                    <tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">${App.t('no_history_found_start')}</td></tr>
                `;
                this.updatePaginationUI();
            }
        } catch (e) {
            console.error('Failed to load history', e);
            document.getElementById('history-body').innerHTML = `
                <tr><td colspan="4" style="text-align:center; color:var(--wrong); padding:2rem;">Error loading history</td></tr>
            `;
        } finally {
            this.isLoadingHistory = false;
        }
    },

    renderLoadingHistory() {
        const body = document.getElementById('history-body');
        body.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; padding:2rem;">
                    <div style="display:inline-block; width:20px; height:20px; border:3px solid var(--border); border-top-color:var(--primary); border-radius:50%; animation:spin 1s linear infinite;"></div>
                    <div style="margin-top:0.5rem; color:var(--text-muted); font-size:0.8rem;">${App.t('loading_history')}</div>
                </td>
            </tr>
        `;
        // Ensure animation exists
        if (!document.getElementById('history-spin-style')) {
            const style = document.createElement('style');
            style.id = 'history-spin-style';
            style.innerHTML = `@keyframes spin { to { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }
    },

    renderHistory(history) {
        const body = document.getElementById('history-body');
        if (!history.length) {
            body.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:2rem;">${App.t('no_history_found')}</td></tr>`;
            return;
        }

        body.innerHTML = history.map(row => `
            <tr>
                <td><span class="badge-finger">${App.t(row.finger_name.replace('-', '_'))}</span></td>
                <td style="font-weight:700; color:var(--primary);">${row.wpm}</td>
                <td>${row.accuracy}%</td>
                <td style="color:var(--text-muted); font-size:0.8rem;">${this.formatDate(row.created_at)}</td>
            </tr>
        `).join('');
    },

    changeFilter(finger) {
        this.historyFinger = finger;
        this.historyPage = 1;
        this.loadHistory();
    },

    changePage(delta) {
        if (this.isLoadingHistory) return;
        const newPage = this.historyPage + delta;
        if (newPage >= 1 && newPage <= this.historyTotalPages) {
            this.historyPage = newPage;
            this.loadHistory();
        }
    },

    jumpToPage(page) {
        if (this.isLoadingHistory) return;
        if (page === 'first') page = 1;
        if (page === 'last') page = this.historyTotalPages;

        if (page >= 1 && page <= this.historyTotalPages && page !== this.historyPage) {
            this.historyPage = page;
            this.loadHistory();
        }
    },

    updatePaginationUI() {
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const firstBtn = document.getElementById('first-page');
        const lastBtn = document.getElementById('last-page');
        const pageInfo = document.getElementById('page-info');
        const dataInfo = document.getElementById('data-info');

        if (prevBtn) prevBtn.disabled = this.historyPage <= 1;
        if (nextBtn) nextBtn.disabled = this.historyPage >= this.historyTotalPages;
        if (firstBtn) firstBtn.disabled = this.historyPage <= 1;
        if (lastBtn) lastBtn.disabled = this.historyPage >= this.historyTotalPages;

        if (pageInfo) pageInfo.textContent = App.t('page_info').replace('{current}', this.historyPage).replace('{total}', this.historyTotalPages);
        if (dataInfo) {
            dataInfo.textContent = this.historyTotalItems > 0
                ? App.t('showing_info').replace('{start}', this.historyFrom).replace('{end}', this.historyTo).replace('{total}', this.historyTotalItems)
                : App.t('empty');
        }
    },

    formatDate(dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    openModal() {
        document.getElementById('result-modal').classList.add('show');
    },

    closeModal() {
        document.getElementById('result-modal').classList.remove('show');
        // Refocus input after closing modal
        setTimeout(() => document.getElementById('typing-input').focus(), 100);
    },

    nextFinger() {
        let nextIndex = this.fingers.findIndex(f => f.id === this.currentFinger.id) + 1;
        if (nextIndex >= this.fingers.length) nextIndex = 0; // Loop back to start

        const next = this.fingers[nextIndex];
        this.closeModal();
        this.selectFinger(next.id);
    },

    restartFromStart() {
        this.closeModal();
        this.selectFinger(this.fingers[0].id);
    }
};

FingerTraining.init();
