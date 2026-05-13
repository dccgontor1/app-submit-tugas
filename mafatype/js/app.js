// ============================================================
// app.js — Global utilities: theme, i18n, toast, auth state
// ============================================================
const App = {
    lang: localStorage.getItem('lang') || 'en',
    theme: localStorage.getItem('theme') || 'light',
    translations: {},
    apiBase: '/mafatype/backend-php/api.php',

    async init() {
        // If no language in localStorage, try to get from global settings
        if (!localStorage.getItem('lang')) {
            try {
                // Try from sessionStorage (filled by site-sync.js)
                let settings = JSON.parse(sessionStorage.getItem('global_settings') || 'null');
                
                // If not in sessionStorage, fetch it directly
                if (!settings) {
                    const response = await fetch(this.apiBase + '?action=global-settings');
                    const data = await response.json();
                    if (data.settings) {
                        settings = data.settings;
                        sessionStorage.setItem('global_settings', JSON.stringify(settings));
                    }
                }

                if (settings && settings.default_language) {
                    this.lang = settings.default_language;
                    // Don't save to localStorage yet, let the user decide later 
                    // or just keep it as the "session" default.
                    // Actually, for "Default Language" to work as expected, we should probably 
                    // use it if NOTHING else is there.
                }
            } catch (e) {
                console.warn('Failed to fetch default language:', e);
            }
        }

        this.applyTheme(this.theme);
        await this.loadTranslations(this.lang);

        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                this.theme = this.theme === 'light' ? 'dark' : 'light';
                localStorage.setItem('theme', this.theme);
                this.applyTheme(this.theme);
            });
        }

        const langSel = document.getElementById('lang-select');
        if (langSel) {
            langSel.value = this.lang;
            langSel.addEventListener('change', e => {
                this.lang = e.target.value;
                localStorage.setItem('lang', this.lang);
                this.loadTranslations(this.lang);
                window.dispatchEvent(new CustomEvent('languageChanged', { detail: this.lang }));
            });
        }

        this.syncNavbar();
        this.initInactivityTimer();
    },

    // ---- Inactivity Timer ----
    inactivityTimeout: null,
    inactivityLimit: 5 * 60 * 1000, // 5 minutes

    initInactivityTimer() {
        if (!this.getUser()) return;

        const resetTimer = () => {
            clearTimeout(this.inactivityTimeout);
            this.inactivityTimeout = setTimeout(() => {
                this.logout();
            }, this.inactivityLimit);
        };

        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(name => {
            document.addEventListener(name, resetTimer, true);
        });

        resetTimer();
    },

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    },

    async loadTranslations(lang) {
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
        try {
            const res = await fetch(`/mafatype/lang/${lang}.json`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            this.translations = await res.json();
            this.applyTranslations();
            this.syncNavbar();
            // Trigger a re-render for any components that might need it
            window.dispatchEvent(new CustomEvent('translationsLoaded', { detail: lang }));
        } catch (e) {
            console.error('Could not load translations for', lang, e);
        }
    },

    applyTranslations() {
        // Get custom settings (slogan & description) from sessionStorage
        const settings = JSON.parse(sessionStorage.getItem('global_settings') || '{}');
        const langCode = this.lang === 'id' ? 'id' : (this.lang === 'ar' ? 'ar' : 'en');
        
        const customSlogan = settings[`site_slogan_${langCode}`];
        const customDesc = settings[`site_description_${langCode}`];

        // Translate elements with data-i18n (default is textContent)
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            let text = this.translations[key];
            
            // Override with custom settings if key matches
            if (key === 'hero_title' && customSlogan) {
                text = customSlogan;
            } else if ((key === 'hero_subtitle' || key === 'login_brand_tagline' || key === 'practice_hero_subtitle' || key === 'competitions_desc') && customDesc) {
                text = customDesc;
            }

            if (!text) return;

            if (['INPUT', 'TEXTAREA'].includes(el.tagName)) {
                el.placeholder = text;
            } else {
                el.textContent = text;
            }
        });

        // Translate placeholders explicitly
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const text = this.translations[key];
            if (text) el.placeholder = text;
        });

        // Translate titles (tooltips)
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const text = this.translations[key];
            if (text) el.title = text;
        });
    },

    t(key) { return this.translations[key] || key; },

    // ---- Navbar Sync ----
    syncNavbar() {
        const user = this.getUser();
        const authLink = document.getElementById('nav-auth');
        const controls = document.querySelector('.nav-controls');
        const navLinks = document.querySelector('.nav-links');

        if (user) {
            // 1. Hide the standalone login link
            if (authLink) authLink.style.display = 'none';

            // 2. Insert "Profile" link into nav-links if not already there
            if (navLinks && !document.getElementById('nav-profile-link')) {
                const profileLink = document.createElement('a');
                profileLink.id = 'nav-profile-link';
                profileLink.href = 'profile.html';
                profileLink.setAttribute('data-i18n', 'nav_profile');
                profileLink.textContent = this.t('nav_profile') || 'Profile';

                // Add active class if currently on profile page
                if (window.location.pathname.includes('profile.html')) {
                    profileLink.classList.add('active');
                }

                navLinks.appendChild(profileLink);
            }

            // 3. Build small avatar + logout dropdown in controls (existing logic)
            if (controls && !document.getElementById('nav-user-dropdown')) {
                const dropdown = document.createElement('div');
                dropdown.id = 'nav-user-dropdown';
                dropdown.className = 'auth-dropdown';

                const initials = user.username ? user.username[0].toUpperCase() : 'U';
                dropdown.innerHTML = `
                    <div class="user-trigger">
                        <div class="user-avatar">${initials}</div>
                        <span style="font-size: 0.7rem; opacity: 0.5; margin-left: -0.25rem;">▼</span>
                    </div>
                    <div class="dropdown-content">
                        <div style="padding:0.5rem 0.75rem; font-size:0.8rem; color:var(--text-muted); border-bottom:1px solid var(--border); margin-bottom:0.25rem;">
                            👤 <strong>${user.username}</strong>
                        </div>
                        <a href="profile.html" class="dropdown-item">
                            <span>👤</span> <span data-i18n="nav_profile">${this.t('nav_profile') || 'Profile'}</span>
                        </a>
                        ${user.role === 'admin' ? `
                        <a href="admin.html" class="dropdown-item">
                            <span>⚙️</span> <span data-i18n="nav_admin">${this.t('nav_admin') || 'Admin'}</span>
                        </a>` : ''}
                        <div class="dropdown-divider"></div>
                        <a href="#" class="dropdown-item danger" id="logout-trigger">
                            <span>🚪</span> <span data-i18n="nav_logout">${this.t('nav_logout') || 'Logout'}</span>
                        </a>
                    </div>
                `;

                const themeBtn = document.getElementById('theme-toggle');
                if (themeBtn) {
                    controls.insertBefore(dropdown, themeBtn);
                } else {
                    controls.appendChild(dropdown);
                }

                dropdown.querySelector('#logout-trigger').onclick = (e) => {
                    e.preventDefault();
                    this.logout();
                };
            }
        } else {
            // Show login link
            if (authLink) {
                authLink.style.display = '';
                authLink.href = 'login.html';
                authLink.setAttribute('data-i18n', 'nav_login');
                authLink.textContent = this.t('nav_login') || 'Login';
            }

            // Remove user dropdown
            const dropdown = document.getElementById('nav-user-dropdown');
            if (dropdown) dropdown.remove();

            // Remove Profile link from nav-links
            const profileLink = document.getElementById('nav-profile-link');
            if (profileLink) profileLink.remove();
        }
    },

    // ---- Auth helpers ----
    getUser() { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } },
    logout() { localStorage.removeItem('user'); window.location.href = '/mafatype/frontend/login.html'; },

    // ---- Toast ----
    toast(msg, type = 'success', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = msg;
        container.appendChild(el);
        setTimeout(() => el.remove(), duration);
    },

    // ---- API helper ----
    // GET: endpoint = 'leaderboard?filter=all_time&lang=en'
    async get(endpoint) {
        const [action, qs] = endpoint.split('?');
        const url = `${this.apiBase}?action=${action}${qs ? '&' + qs : ''}`;
        const res = await fetch(url);
        return { ok: res.ok, data: await res.json() };
    },

    // POST: endpoint = 'login'  →  api.php?action=login
    async post(endpoint, body) {
        const url = `${this.apiBase}?action=${endpoint}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return { ok: res.ok, data: await res.json() };
    },

    // ---- Achievement Popup ----
    showAchievement(ach) {
        let container = document.getElementById('achievement-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'achievement-container';
            container.className = 'achievement-container';
            document.body.appendChild(container);
        }

        const popup = document.createElement('div');
        popup.className = 'achievement-popup';
        popup.innerHTML = `
            <div class="ach-pop-icon">${ach.badge_icon || '🏆'}</div>
            <div class="ach-pop-content">
                <div class="ach-pop-title">
                    <span class="ach-pop-badge">Unlocked</span>
                    ${ach.title}
                </div>
                <div class="ach-pop-desc">${ach.description}</div>
            </div>
        `;

        container.appendChild(popup);

        // Sound effect (optional, using a subtle built-in browser beep or just visual)
        // For now, let's just stick to the premium visual.

        // Remove after 5 seconds
        setTimeout(() => {
            popup.classList.add('removing');
            setTimeout(() => popup.remove(), 500);
        }, 5000);
    },
    
    // ---- AFK Modal ----
    showAfkModal(onClose) {
        if (document.getElementById('afk-overlay')) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'afk-overlay';
        overlay.className = 'afk-overlay';
        overlay.innerHTML = `
            <div class="afk-modal">
                <div class="afk-icon">😴</div>
                <h2 class="afk-title">Are you afk?</h2>
                <p class="afk-desc">Your score has not been saved.</p>
                <button class="btn btn-primary" id="afk-resume-btn">
                    🔄 Restart Test
                </button>
            </div>
        `;
        document.body.appendChild(overlay);
        
        const btn = overlay.querySelector('#afk-resume-btn');
        btn.onclick = () => {
            overlay.remove();
            if (onClose) onClose();
        };
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
