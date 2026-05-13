class TypingTest {
    constructor() {
        this.words = [];
        this.duration = 60;
        this.timeLeft = this.duration;
        this.timer = null;
        this.isRunning = false;

        this.currentWordIndex = 0;
        this.correctWords = 0;
        this.wrongWords = 0;
        this.correctKeystrokes = 0;  // characters in correctly typed words
        this.wrongKeystrokes = 0;  // characters in wrongly typed words
        this.totalKeystrokes = 0;  // every key pressed
        this.isLoadingExtra = false; 
        
        this.afkTimer = null;
        this.afkLimit = 10000; // 10 seconds

        // DOM Elements
        this.displayEl = document.getElementById('word-display');
        this.inputEl = document.getElementById('typing-input');
        this.timerEl = document.getElementById('timer');
        this.statsEl = document.getElementById('stats');
        this.restartBtn = document.getElementById('restart-btn');
        this.langDisplay = null; // removed — now using #test-lang select
        this.testLangEl = document.getElementById('test-lang');

        // Sound
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadWords();
    }

    bindEvents() {
        this.inputEl.addEventListener('input', this.handleInput.bind(this));

        // Intercept keydown to track keystrokes accurately in real-time
        this.inputEl.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                const typedWord = this.inputEl.value.trim();
                if (typedWord.length === 0) return; // ignore leading space
                
                this.totalKeystrokes++;
                if (typedWord === this.words[this.currentWordIndex]) {
                    this.correctKeystrokes++;
                } else {
                    this.wrongKeystrokes++;
                }

                this.evaluateWord(typedWord);
                this.inputEl.value = '';
            } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                this.totalKeystrokes++;
                const currentVal = this.inputEl.value;
                const targetWord = this.words[this.currentWordIndex];
                
                if (targetWord && targetWord.startsWith(currentVal) && e.key === targetWord[currentVal.length]) {
                    this.correctKeystrokes++;
                } else {
                    this.wrongKeystrokes++;
                }
            } else if (e.code === 'Backspace') {
                this.totalKeystrokes++;
            }
        });

        this.restartBtn.addEventListener('click', () => this.reset());

        // Test-language selector: reload words without changing UI language
        if (this.testLangEl) {
            this.testLangEl.addEventListener('change', () => this.reset());
        }

        // Prevent copy-pasting to prevent cheating
        this.inputEl.addEventListener('paste', e => e.preventDefault());
        this.inputEl.addEventListener('copy', e => e.preventDefault());

        // UI language change (nav header) does NOT reset the test anymore
        // — it only affects page translations, not test content.
    }

    playSound(type) {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        if (type === 'type') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.05);
        } else if (type === 'error') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.05, this.audioContext.currentTime);
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.1);
        }
    }

    async loadWords() {
        try {
            // Use the test-specific language selector, NOT the UI language
            const lang = (this.testLangEl && this.testLangEl.value) || App.lang || 'en';

            const response = await fetch(`/mafatype/backend-php/api.php?action=words&lang=${lang}`);
            const data = await response.json();

            if (data.words && data.words.length > 0) {
                // Duplicate word list to ensure we don't run out during 60s
                this.words = [...data.words, ...data.words, ...data.words];
                // Set RTL and lang for Arabic
                this.displayEl.dir = lang === 'ar' ? 'rtl' : 'ltr';
                this.inputEl.dir = lang === 'ar' ? 'rtl' : 'ltr';
                this.displayEl.setAttribute('lang', lang);
                this.inputEl.setAttribute('lang', lang);
                this.renderWords();
            } else {
                this.displayEl.innerHTML = `<div style="color:red">${App.t('error_api_words')}</div>`;
            }
        } catch (error) {
            console.error('Error fetching words:', error);
            this.displayEl.innerHTML = `<div style="color:red">${App.t('error_connect_backend')}</div>`;
        }
    }

    renderWords() {
        this.displayEl.innerHTML = '';
        const inner = document.createElement('div');
        inner.className = 'words-inner';
        this.words.forEach((word, index) => {
            const span = document.createElement('span');
            span.className = 'word';
            if (index === 0) span.classList.add('active');
            span.textContent = word;
            inner.appendChild(span);
        });
        this.displayEl.appendChild(inner);
        this.wordsInner = inner;
    }

    handleInput(e) {
        const value = this.inputEl.value;

        // Start timer on first keystroke
        if (!this.isRunning && value.length > 0) {
            this.startTimer();
            this.startAfkTimer();
        }
        this.resetAfkTimer();

        // Realtime highlighting (space is handled separately in keydown)
        const currentWordSpan = this.wordsInner ? this.wordsInner.children[this.currentWordIndex] : null;
        const targetWord = this.words[this.currentWordIndex];
        if (!targetWord || !currentWordSpan) return;

        if (value.length > 0 && !targetWord.startsWith(value)) {
            currentWordSpan.classList.add('wrong');
            if (!currentWordSpan.dataset.errSound) {
                this.playSound('error');
                currentWordSpan.dataset.errSound = 'true';
            }
        } else {
            currentWordSpan.classList.remove('wrong');
            delete currentWordSpan.dataset.errSound;
            if (value.length > 0) this.playSound('type');
        }
    }

    evaluateWord(typedWord) {
        const currentWordSpan = this.wordsInner.children[this.currentWordIndex];
        const targetWord = this.words[this.currentWordIndex];

        currentWordSpan.classList.remove('active', 'wrong');

        if (typedWord === targetWord) {
            currentWordSpan.classList.add('correct');
            this.correctWords++;
        } else {
            currentWordSpan.classList.add('wrong');
            this.wrongWords++;
        }

        this.currentWordIndex++;

        // Load more words if we're getting close to the end (within 30 words)
        if (this.currentWordIndex > this.words.length - 30) {
            this.appendMoreWords();
        }

        if (this.currentWordIndex < this.words.length) {
            const nextWordSpan = this.wordsInner.children[this.currentWordIndex];
            nextWordSpan.classList.add('active');

            // Smooth slide: compute which row the next word is on, then
            // translateY the inner wrapper so the active word stays on row 2,
            // always leaving at least one full row visible below the cursor.
            const lineH = parseFloat(getComputedStyle(this.displayEl).lineHeight) || 46;
            const rowNum = Math.round(nextWordSpan.offsetTop / lineH);
            if (rowNum >= 2) {
                this.wordsInner.style.transform = `translateY(${-(rowNum - 1) * lineH}px)`;
            }
        } else {
            // This should rarely happen now with dynamic appending, but keep for safety
            this.endTest();
        }
    }

    async appendMoreWords() {
        if (this.isLoadingExtra) return;
        this.isLoadingExtra = true;
        try {
            const lang = (this.testLangEl && this.testLangEl.value) || App.lang || 'en';
            const response = await fetch(`/mafatype/backend-php/api.php?action=words&lang=${lang}`);
            const data = await response.json();
            if (data.words && data.words.length > 0) {
                // Filter out empty strings just in case
                const newWords = data.words.filter(w => w.trim().length > 0);
                this.words.push(...newWords);
                newWords.forEach((word) => {
                    const span = document.createElement('span');
                    span.className = 'word';
                    span.textContent = word;
                    this.wordsInner.appendChild(span);
                });
            }
        } catch (error) {
            console.error('Error fetching additional words:', error);
        } finally {
            this.isLoadingExtra = false;
        }
    }

    startTimer() {
        this.isRunning = true;

        // Ensure AudioContext is actively resumed internally (for strict browsers)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.inputEl.placeholder = ''; // Clear placeholder when starting

        this.timer = setInterval(() => {
            this.timeLeft--;
            this.timerEl.textContent = `${this.timeLeft}s`;

            if (this.timeLeft <= 0) {
                this.endTest();
            }
        }, 1000);
    }

    startAfkTimer() {
        if (!this.isRunning) return;
        clearTimeout(this.afkTimer);
        this.afkTimer = setTimeout(() => {
            this.showAfk();
        }, this.afkLimit);
    }

    resetAfkTimer() {
        if (!this.isRunning) return;
        this.startAfkTimer();
    }

    showAfk() {
        if (!this.isRunning) return;
        // Stop timer immediately
        clearInterval(this.timer);
        this.isRunning = false;
        
        App.showAfkModal(() => {
            this.reset();
        });
    }

    endTest() {
        clearInterval(this.timer);
        clearTimeout(this.afkTimer);
        this.isRunning = false;
        this.inputEl.disabled = true;

        const timeInMinutes = this.duration / 60; // always 60s = 1.0 min
        const totalWordsTyped = this.correctWords + this.wrongWords;

        // KPM = total karakter benar / 5 / waktu(menit)  [standar internasional]
        const kpm = this.correctKeystrokes > 0
            ? Math.round(this.correctKeystrokes / 5 / timeInMinutes)
            : 0;

        // Accuracy = karakter benar / (karakter benar + karakter salah)
        const totalChars = this.correctKeystrokes + this.wrongKeystrokes;
        const accuracy = totalChars > 0
            ? ((this.correctKeystrokes / totalChars) * 100).toFixed(2)
            : '100.00';

        // Keystrokes display: (correct | wrong) total
        const ksDisplay = `(${this.correctKeystrokes} | ${this.wrongKeystrokes}) ${this.totalKeystrokes}`;

        // Update DOM
        document.getElementById('res-wpm').textContent = kpm;
        document.getElementById('res-keystrokes').textContent = ksDisplay;
        document.getElementById('res-accuracy').textContent = `${accuracy}%`;
        document.getElementById('res-correct').textContent = this.correctWords;
        document.getElementById('res-wrong').textContent = this.wrongWords;

        // --- Dynamic Rating & Predicate ---
        const settings = JSON.parse(sessionStorage.getItem('global_settings') || '{}');
        let ratings = [];
        try {
            ratings = typeof settings.typing_ratings === 'string' 
                ? JSON.parse(settings.typing_ratings) 
                : (settings.typing_ratings || []);
        } catch(e) {}

        if (ratings.length === 0) {
            ratings = [
                { min_wpm: 0, rating: 'Poor', desc: 'Needs more practice' },
                { min_wpm: 40, rating: 'Good', desc: 'Average computer user' },
                { min_wpm: 61, rating: 'Very Good', desc: 'Fast and consistent' },
                { min_wpm: 81, rating: 'Excellent', desc: 'Professional level' },
                { min_wpm: 100, rating: 'Master', desc: 'Elite typing speed' }
            ];
        }
        
        // Find best rating
        const isArabic = ((this.testLangEl && this.testLangEl.value) || App.lang || 'en') === 'ar';
        let currentRating = ratings[0];
        for (const r of ratings) {
            const threshold = isArabic ? r.min_wpm * 0.5 : r.min_wpm;
            if (kpm >= threshold) currentRating = r;
            else break;
        }

        // Display Rating
        const ratingEl = document.getElementById('res-rating');
        const descEl = document.getElementById('res-desc');
        if (ratingEl) ratingEl.textContent = currentRating.rating;
        if (descEl) descEl.textContent = currentRating.desc;

        // --- Check Lang-specific Minimum Requirement ---
        const lang = (this.testLangEl && this.testLangEl.value) || App.lang || 'en';
        const minKey = `min_wpm_${lang}`;
        const minReq = parseInt(settings[minKey] || 0);
        const passMsgEl = document.getElementById('res-pass-msg');
        
        if (passMsgEl) {
            if (minReq > 0) {
                if (kpm >= minReq) {
                    passMsgEl.innerHTML = `<span style="color:var(--success)">✅ Lulus (Min. ${minReq} KPM)</span>`;
                } else {
                    passMsgEl.innerHTML = `<span style="color:var(--danger)">❌ Tidak Lulus (Min. ${minReq} KPM)</span>`;
                }
            } else {
                passMsgEl.innerHTML = '';
            }
        }

        document.getElementById('typing-card').classList.add('finished');
        this.statsEl.style.display = 'grid';

        // Save with KPM as the wpm field (backend agnostic)
        this.saveResult(kpm, parseFloat(accuracy), totalWordsTyped);
    }

    async saveResult(wpm, accuracy, totalWordsTyped) {
        // Hardcoded user_id for test since no auth is completely implemented locally in page
        // If Auth is used, we read from localStorage
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            console.log('User not logged in, result not explicitly saved to DB');
            return;
        }

        const payload = {
            user_id: user.id,
            language: (this.testLangEl && this.testLangEl.value) || App.lang || 'en',
            wpm: wpm,
            accuracy: accuracy,
            total_words: totalWordsTyped,
            correct_words: this.correctWords,
            wrong_words: this.wrongWords
        };

        const activeCompetition = localStorage.getItem('active_competition');
        if (activeCompetition) {
            payload.competition_id = activeCompetition;
            try {
                const r = await App.post('join-competition', payload);
                if (r.ok) {
                    App.toast(App.t('comp_result_sent'), 'success');
                    if (r.data.achievements_unlocked && Array.isArray(r.data.achievements_unlocked)) {
                        r.data.achievements_unlocked.forEach(ach => App.showAchievement(ach));
                    }
                }
                localStorage.removeItem('active_competition');
            } catch (e) {
                console.error('Failed to save to competition', e);
                App.toast(App.t('comp_result_failed'), 'error');
            }
        } else {
            try {
                const r = await App.post('save-result', payload);
                if (r.ok && r.data.achievements_unlocked && Array.isArray(r.data.achievements_unlocked)) {
                    r.data.achievements_unlocked.forEach(ach => App.showAchievement(ach));
                }
            } catch (e) {
                console.error('Failed to save result', e);
            }
        }
    }

    async reset() {
        clearInterval(this.timer);
        clearTimeout(this.afkTimer);
        this.isRunning = false;
        this.timeLeft = this.duration;
        this.currentWordIndex = 0;
        this.correctWords = 0;
        this.wrongWords = 0;
        this.correctKeystrokes = 0;
        this.wrongKeystrokes = 0;
        this.totalKeystrokes = 0;

        this.inputEl.disabled = false;
        this.inputEl.value = '';
        this.inputEl.placeholder = App.t('typing_input_placeholder'); // Restore placeholder
        this.inputEl.focus();

        this.timerEl.textContent = `${this.duration}s`;
        this.statsEl.style.display = 'none';
        document.getElementById('typing-card').classList.remove('finished');

        // Fetch new words and re-render
        await this.loadWords();
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Only init if we are on the typing page
    if (document.getElementById('typing-input')) {
        window.typingTest = new TypingTest();
    }
});
