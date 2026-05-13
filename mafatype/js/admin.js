/* ============================================================
   ADMIN DASHBOARD — JavaScript SPA Controller
   admin.js — all sections, API calls, chart rendering
   ============================================================ */

const ADMIN_API = '../backend-php/admin-api.php?action=';

// ── Helpers ──────────────────────────────────────────────────────────────────
function adminId() {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return u ? u.id : null;
}

async function api(action, params = {}, method = 'GET') {
    const uid = adminId();
    let url = ADMIN_API + action;
    let opts = { headers: { 'Content-Type': 'application/json' } };
    if (method === 'GET') {
        const p = new URLSearchParams({ ...params, admin_id: uid });
        url += '&' + p.toString();
        opts.method = 'GET';
    } else {
        opts.method = method;
        opts.body = JSON.stringify({ ...params, admin_id: uid });
    }
    try {
        const r = await fetch(url, opts);
        const text = await r.text();
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (je) {
            throw new Error('Invalid JSON response: ' + text.slice(0, 100));
        }
        if (!r.ok) throw new Error(data.error || 'API error ' + r.status);
        return data;
    } catch (e) {
        toast(e.message, 'error');
        throw e;
    }
}

function toast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    t.innerHTML = `<span>${icons[type] || ''}</span> ${msg}`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; setTimeout(() => t.remove(), 300); }, 3500);
}

function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function langBadge(lang) {
    const labels = { en: 'EN', id: 'ID', ar: 'AR' };
    return `<span class="badge badge-${esc(lang)}">${esc(labels[lang] || lang)}</span>`;
}

function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function renderPagination(containerId, page, limit, total, onPageChange) {
    const totalPages = Math.ceil(total / limit);
    const el = document.getElementById(containerId);
    if (!el) return;
    const start = Math.min((page - 1) * limit + 1, total);
    const end = Math.min(page * limit, total);
    el.innerHTML = `
        <span>${App.t('showing_info').replace('{start}', start).replace('{end}', end).replace('{total}', total)}</span>
        <div class="page-btns">
            <button class="page-btn" onclick="${onPageChange}('prev')" ${page <= 1 ? 'disabled' : ''}>◀</button>
            <button class="page-btn active">${page}</button>
            <button class="page-btn" onclick="${onPageChange}('next')" ${page >= totalPages ? 'disabled' : ''}>▶</button>
        </div>
    `;
}

function showLoading(tbodyId) {
    const el = document.getElementById(tbodyId);
    if (el) el.innerHTML = `<tr><td colspan="20"><div class="loading"><div class="spinner"></div> ${App.t('loading_data')}</div></td></tr>`;
}

// ── Modal util ────────────────────────────────────────────────────────────────
function openModal(id) {
    document.getElementById(id).classList.add('open');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}
window.closeModal = closeModal;

// ── Global Data Registries (for safe editing) ─────────────────────────────────
let USER_DATA = {};
let WORD_DATA = {};
let COMP_DATA = {};
let PRACTICE_DATA = {};
let ACHIEVEMENT_DATA = {};

// ── Custom Confirm Delete (replaces window.confirm to avoid browser blocking) ──
function confirmDelete(message, onConfirm) {
    document.getElementById('confirm-delete-msg').textContent = message;
    const btn = document.getElementById('confirm-delete-btn');
    const fresh = btn.cloneNode(true); // Remove old listeners
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener('click', () => {
        closeModal('modal-confirm-delete');
        onConfirm();
    });
    openModal('modal-confirm-delete');
}

// ── Navigate ─────────────────────────────────────────────────────────────────
let currentSection = null;
let mpInterval = null;

function navigate(section) {
    if (currentSection === section) return;
    currentSection = section;

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(n => {
        n.classList.toggle('active', n.dataset.section === section);
    });

    // Show/hide sections
    document.querySelectorAll('.section').forEach(s => {
        s.classList.toggle('active', s.id === 'sec-' + section);
    });

    // Update page title
    const titles = {
        dashboard: '📊 ' + App.t('admin_nav_dashboard'),
        users: '👤 ' + App.t('admin_nav_users'),
        words: '📝 ' + App.t('admin_nav_words'),
        results: '⌨️ ' + App.t('admin_nav_results'),
        leaderboard: '🏆 ' + App.t('nav_leaderboard'),
        competitions: '🏁 ' + App.t('admin_nav_competitions'),
        multiplayer: '🎮 ' + App.t('admin_nav_multiplayer'),
        statistics: '📈 ' + App.t('admin_nav_statistics'),
        settings: '⚙️ ' + App.t('admin_nav_settings'),
        logs: '📋 ' + App.t('admin_nav_logs'),
        practice: '✍️ ' + App.t('admin_nav_practice'),
        achievements: '🏆 ' + App.t('admin_nav_achievements'),
    };
    document.getElementById('page-title').textContent = titles[section] || section;

    // Clear multiplayer poll
    if (mpInterval && section !== 'multiplayer') { clearInterval(mpInterval); mpInterval = null; }

    // Load section data
    const loaders = {
        dashboard: loadDashboard,
        users: () => loadUsers(1),
        words: () => loadWords(1, currentLang),
        results: () => loadResults(1),
        leaderboard: () => loadLeaderboard(1),
        competitions: loadCompetitions,
        multiplayer: loadMultiplayer,
        statistics: loadStatistics,
        settings: loadSettings,
        logs: () => loadLogs(1),
        practice: loadPracticeTexts,
        achievements: loadAchievements,
    };
    if (loaders[section]) loaders[section]();
}
window.navigate = navigate;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
let dashCharts = {};
async function loadDashboard() {
    try {
        const [stats, activity, growth] = await Promise.all([
            api('stats'),
            api('daily-activity'),
            api('user-growth'),
        ]);
        // KPIs
        document.getElementById('kpi-users').textContent = stats.total_users ?? '—';
        document.getElementById('kpi-tests').textContent = stats.total_tests ?? '—';
        document.getElementById('kpi-comps').textContent = stats.total_competitions ?? '—';
        document.getElementById('kpi-active').textContent = stats.active_competitions ?? '—';
        document.getElementById('kpi-kpm').textContent = stats.avg_kpm ?? '—';
        document.getElementById('kpi-top').textContent = stats.top_user?.username ?? '—';
        document.getElementById('kpi-topscore').textContent = (stats.top_user?.best_kpm ?? '—') + ' KPM';

        const style = getComputedStyle(document.documentElement);
        const primaryColor = style.getPropertyValue('--primary').trim() || '#f97316';
        const accentColor = style.getPropertyValue('--accent').trim() || '#fb923c';

        // Activity chart
        const actLabels = activity.data.map(r => r.day.slice(5));
        const actData = activity.data.map(r => parseInt(r.count));
        renderLineChart('chart-activity', actLabels, actData, 'Tes per Hari', primaryColor);

        // Growth chart
        const growLabels = growth.data.map(r => 'Week ' + String(r.week).slice(4));
        const growData = growth.data.map(r => parseInt(r.count));
        renderBarChart('chart-growth', growLabels, growData, 'User Aktif', accentColor);
    } catch (e) { }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: USERS
// ─────────────────────────────────────────────────────────────────────────────
let userPage = 1, userSearch = '', userSort = 'created_at', userOrder = 'desc';

async function loadUsers(page = 1, search = userSearch, sort = userSort, order = userOrder) {
    userPage = page; userSearch = search; userSort = sort; userOrder = order;
    const examFilter = document.getElementById('user-exam-filter')?.value || 'all';
    showLoading('users-tbody');
    try {
        const [{ users, total }, { settings }] = await Promise.all([
            api('users', { page, search, sort, order, exam_status: examFilter }),
            api('settings')
        ]);
        
        const minId = parseInt(settings.min_wpm_id || 0);
        const minEn = parseInt(settings.min_wpm_en || 0);
        const minAr = parseInt(settings.min_wpm_ar || 0);

        USER_DATA = {}; // Clear old data
        document.getElementById('users-tbody').innerHTML = users.length ? users.map(u => {
            USER_DATA[u.id] = u; // Store in registry
            
            // Calculate Exam Status
            const isLulus = u.best_id >= minId && u.best_en >= minEn && u.best_ar >= minAr;
            const statusBadge = isLulus 
                ? '<span class="badge badge-active">PASSED</span>' 
                : '<span class="badge badge-danger">NOT PASSED</span>';

            return `
            <tr>
                <td style="text-align:center;"><input type="checkbox" class="user-select-cb" value="${u.id}" onchange="updateBulkUserUI()"></td>
                <td class="td-mono">#${u.id}</td>
                <td><strong><a href="profile.html?user_id=${u.id}" class="user-link" target="_blank">${esc(u.username)}</a></strong></td>
                <td class="td-mono">${esc(u.email)}</td>
                <td>${u.role === 'admin' ? '<span class="badge badge-admin">Admin</span>' : '<span class="badge badge-user">User</span>'}</td>
                <td><span class="badge badge-info">${esc(u.kelas || '—')}</span></td>
                <td><span class="badge ${u.status === 'inactive' ? 'badge-inactive' : 'badge-active'}">${u.status === 'inactive' ? App.translations.inactive || 'Inactive' : App.translations.active || 'Active'}</span></td>
                <td class="td-mono">${u.test_count}</td>
                <td class="td-mono">${u.best_kpm}</td>
                <td style="text-align:center;">${statusBadge}</td>
                <td>
                    <div class="td-actions">
                        <button class="btn btn-sm" onclick="openUserDetail(${u.id})" title="Detail User">👁</button>
                        <button class="btn btn-sm" onclick="exportUserPDF(${u.id})" title="Export Raport (PDF)">📄</button>
                        <button class="btn btn-sm" onclick="openEditUser(${u.id})" title="Edit User">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})" title="Hapus User">🗑</button>
                    </div>
                </td>
            </tr>`;
        }).join('') : `<tr><td colspan="11"><div class="empty-state"><div class="empty-icon">👤</div><p>${App.t('no_users_found')}</p></div></td></tr>`;
        renderPagination('users-pagination', page, 20, total, 'usersPage');
        updateSortUI();
        updateBulkUserUI(); // Reset bulk UI state on reload
    } catch (e) { }
}
window.usersPage = (dir) => loadUsers(dir === 'next' ? userPage + 1 : userPage - 1, userSearch, userSort, userOrder);

function updateSortUI() {
    document.querySelectorAll('#sec-users th.sortable').forEach(th => {
        const s = th.dataset.sort;
        th.classList.remove('sort-asc', 'sort-desc');
        if (s === userSort) th.classList.add('sort-' + userOrder);
    });
}

// Add event listener for header sorting
document.addEventListener('click', e => {
    const th = e.target.closest('th.sortable');
    if (!th || !th.closest('#sec-users')) return;
    const sort = th.dataset.sort;
    const order = (sort === userSort && userOrder === 'asc') ? 'desc' : 'asc';
    loadUsers(1, userSearch, sort, order);
});

// --- Bulk Management ---
function toggleSelectAllUsers() {
    const isChecked = document.getElementById('user-select-all').checked;
    document.querySelectorAll('.user-select-cb').forEach(cb => cb.checked = isChecked);
    updateBulkUserUI();
}
window.toggleSelectAllUsers = toggleSelectAllUsers;

function updateBulkUserUI() {
    const checked = document.querySelectorAll('.user-select-cb:checked');
    const bar = document.getElementById('users-bulk-actions');
    if (checked.length > 0) {
        document.getElementById('users-selected-count').innerText = checked.length;
        bar.style.display = 'flex';
    } else {
        bar.style.display = 'none';
        document.getElementById('user-select-all').checked = false;
    }
}
window.updateBulkUserUI = updateBulkUserUI;

async function applyBulkUserAction() {
    const action = document.getElementById('users-bulk-action-select').value;
    if (!action) return toast(App.translations.select_action_first || 'Pilih aksi terlebih dahulu!', 'error');

    const selectedIds = Array.from(document.querySelectorAll('.user-select-cb:checked')).map(cb => cb.value);
    if (selectedIds.length === 0) return;

    if (action === 'delete') {
        if (!confirm(App.t('bulk_delete_confirm').replace('{count}', selectedIds.length))) return;
        try {
            await api('bulk-delete-users', { ids: selectedIds }, 'POST');
            toast(App.t('bulk_delete_success').replace('{count}', selectedIds.length), 'success');
            loadUsers();
        } catch (e) { toast(e.message, 'error'); }
        return;
    }

    // For other actions (role, kelas, status), prompt for the new value
    let promptMsg = '';
    let defaultValue = '';
    if (action === 'role') promptMsg = 'Masukkan role baru (admin/user):';
    if (action === 'kelas') promptMsg = 'Masukkan kelas baru (kosongkan jika tidak ada):';
    if (action === 'status') promptMsg = 'Masukkan status baru (active/inactive):';

    const newValue = prompt(promptMsg, defaultValue);
    if (newValue === null) return; // User cancelled

    try {
        await api('bulk-edit-users', { ids: selectedIds, field: action, value: newValue }, 'POST');
        toast(App.t('bulk_edit_success').replace('{count}', selectedIds.length), 'success');
        loadUsers();
    } catch (e) { toast(e.message, 'error'); }
}
window.applyBulkUserAction = applyBulkUserAction;

// --- Import Users CSV ---
async function importUsersCSV(e) {
    if (e) e.preventDefault();
    const csvData = document.getElementById('import-users-csv').value.trim();
    if (!csvData) return toast(App.t('csv_empty'), 'error');

    // Basic structure parsing
    const lines = csvData.split('\n').map(line => line.split(',').map(item => item.trim())).filter(l => l.length >= 3 && l[0]);

    if (lines.length === 0) return toast('Format tidak valid atau kosong', 'error');

    if (!confirm(`Import ${lines.length} user?`)) return;

    try {
        const res = await api('import-new-users', { users: lines }, 'POST');
        toast(App.t('import_success').replace('{count}', res.imported), 'success');
        closeModal('modal-import-users');
        loadUsers(1);
        document.getElementById('import-users-csv').value = '';
    } catch (err) {
        toast(App.t('import_failed') + err.message, 'error');
    }
}
window.importUsersCSV = importUsersCSV;

// --- Advanced Mass Edit ---
let massEditPendingUpdates = [];
let isExporting = false;

async function exportUsersCSV() {
    if (isExporting) return;
    isExporting = true;
    try {
        const { users } = await api('users-export');
        if (!users || users.length === 0) {
            isExporting = false;
            return toast('Tidak ada data user', 'error');
        }

        const headers = ['id', 'username', 'email', 'password', 'role', 'kelas', 'daerah', 'status'];
        // Add UTF-8 BOM for Excel compatibility
        let csvContent = '\uFEFF' + headers.join(',') + '\n';

        users.forEach(u => {
            const row = [
                u.id,
                u.username,
                u.email,
                '', // Leave password empty for template
                u.role,
                u.kelas || '',
                u.daerah || '',
                u.status || 'active'
            ].map(v => {
                const str = String(v || '').replace(/"/g, '""');
                return `"${str}"`;
            }).join(',');
            csvContent += row + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        // Use standard approach for naming
        const filename = `mafatype_users_export_${new Date().toISOString().split('T')[0]}.csv`;

        link.href = url;
        link.download = filename;
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            isExporting = false;
        }, 100);

    } catch (e) {
        toast('Gagal export: ' + e.message, 'error');
        isExporting = false;
    }
}
window.exportUsersCSV = exportUsersCSV;

async function exportUserScoresCSV() {
    if (isExporting) return;
    isExporting = true;
    try {
        const { data, thresholds } = await api('users-export-scores');
        if (!data || data.length === 0) {
            isExporting = false;
            return toast('Tidak ada data nilai', 'error');
        }

        const minId = thresholds?.id || 0;
        const minEn = thresholds?.en || 0;
        const minAr = thresholds?.ar || 0;

        const headers = ['id', 'username', 'email', 'kelas', 'total_tes', 'best_kpm', 'terbaik_indo', 'terbaik_inggris', 'terbaik_arab', 'status_kelulusan'];
        // Use UTF-8 BOM
        let csvContent = '\uFEFF' + headers.join(',') + '\n';

        data.forEach(u => {
            const isLulus = u.best_id >= minId && u.best_en >= minEn && u.best_ar >= minAr;
            const statusStr = isLulus ? 'PASSED' : 'NOT PASSED';

            const row = [
                u.id,
                u.username,
                u.email,
                u.kelas || '',
                u.total_tests,
                u.best_kpm,
                u.best_id,
                u.best_en,
                u.best_ar,
                statusStr
            ].map(v => {
                const str = String(v ?? '').replace(/"/g, '""');
                return `"${str}"`;
            }).join(',');
            csvContent += row + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const filename = `mafatype_user_scores_${new Date().toISOString().split('T')[0]}.csv`;

        link.href = url;
        link.download = filename;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            isExporting = false;
        }, 100);

    } catch (e) {
        toast('Gagal export nilai: ' + e.message, 'error');
        isExporting = false;
    }
}
window.exportUserScoresCSV = exportUserScoresCSV;

async function handleMassEditUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        let text = event.target.result;
        if (text.startsWith('\uFEFF')) text = text.slice(1);

        // Detect delimiter (comma or semicolon)
        const firstLine = text.split(/\r?\n|\r/)[0] || '';
        const commaCount = (firstLine.match(/,/g) || []).length;
        const semiCount = (firstLine.match(/;/g) || []).length;
        const delimiter = semiCount > commaCount ? ';' : ',';
        console.log(`Detected CSV delimiter: "${delimiter}" (commas: ${commaCount}, semis: ${semiCount})`);

        const parseCSVLine = (line, delim = ',') => {
            const result = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === delim && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        };

        const lines = text.split(/\r?\n|\r/).filter(l => l.trim().length > 0);
        const parsedLines = lines.map((l, i) => {
            const p = parseCSVLine(l, delimiter);
            console.log(`Row ${i + 1} [${l.length} chars] -> ${p.length} cols:`, p);
            return p;
        });

        const dataLines = parsedLines.filter((l, i) => {
            const first = (l[0] || '').toLowerCase().replace(/^"|"$/g, '');
            if (first === 'id') return false;

            if (l.length < 8) {
                console.warn(`Row ${i + 1} SKIPPED (cols=${l.length}):`, l);
                return false;
            }
            return true;
        });

        if (dataLines.length === 0) {
            return toast(`Gagal: 0 data valid ditemukan dari ${parsedLines.length} baris. Cek console (F12).`, 'error');
        }

        try {
            // Fetch current state from server to compare
            const { users: currentUsers } = await api('users-export');
            const userMap = {};
            currentUsers.forEach(u => userMap[u.id.toString()] = u);

            massEditPendingUpdates = [];
            const diffRows = [];

            dataLines.forEach(cols => {
                const id = cols[0];
                const serverUser = userMap[id];
                if (!serverUser) return; // User might have been deleted or wrong ID

                const fields = ['username', 'email', 'password', 'role', 'kelas', 'daerah', 'status'];
                fields.forEach((f, idx) => {
                    let newVal = cols[idx + 1];
                    let oldVal = (serverUser[f] || '').toString();

                    // Special case for password: only update if not empty
                    if (f === 'password') {
                        if (newVal !== '') {
                            massEditPendingUpdates.push({ id, field: f, value: newVal });
                            diffRows.push({ id, username: serverUser.username, field: f, old: '(Hashed)', new: '********' });
                        }
                        return;
                    }

                    if (newVal !== oldVal) {
                        massEditPendingUpdates.push({ id, field: f, value: newVal });
                        diffRows.push({ id, username: serverUser.username, field: f, old: oldVal, new: newVal });
                    }
                });
            });

            renderMassEditReview(diffRows);
        } catch (err) { toast('Error parsing: ' + err.message, 'error'); }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
}
window.handleMassEditUpload = handleMassEditUpload;

function renderMassEditReview(diffs) {
    const tbody = document.getElementById('mass-edit-diff-body');
    const noChanges = document.getElementById('mass-edit-no-changes');
    const btnApply = document.getElementById('btn-apply-mass-edit');

    tbody.innerHTML = '';
    if (diffs.length === 0) {
        noChanges.style.display = 'block';
        btnApply.style.disabled = true;
        btnApply.style.opacity = '0.5';
    } else {
        noChanges.style.display = 'none';
        btnApply.style.disabled = false;
        btnApply.style.opacity = '1';

        diffs.forEach(d => {
            const tr = document.createElement('tr');
            tr.className = 'diff-row';
            tr.innerHTML = `
                <td>${d.id}</td>
                <td>${esc(d.username)}</td>
                <td><span class="badge badge-user">${d.field}</span></td>
                <td><div class="diff-old">${esc(d.old)}</div></td>
                <td><div class="diff-value">${esc(d.new)}</div></td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('mass-edit-step-1').style.display = 'none';
    document.getElementById('mass-edit-step-2').style.display = 'block';
}

function resetMassEdit() {
    document.getElementById('mass-edit-step-1').style.display = 'block';
    document.getElementById('mass-edit-step-2').style.display = 'none';
    massEditPendingUpdates = [];
}
window.resetMassEdit = resetMassEdit;

async function applyMassEdit() {
    if (massEditPendingUpdates.length === 0) return;
    if (!confirm(`Terapkan ${massEditPendingUpdates.length} perubahan data?`)) return;

    try {
        await api('bulk-sync-users', { updates: massEditPendingUpdates }, 'POST');
        toast('Perubahan massal berhasil diterapkan', 'success');
        closeModal('modal-mass-edit');
        resetMassEdit();
        loadUsers();
    } catch (e) { toast('Sync gagal: ' + e.message, 'error'); }
}
window.applyMassEdit = applyMassEdit;

// Cache for the Arabic font to avoid re-downloading
let arabicFontBase64 = null;

async function exportUserPDF(uid) {
    const { jsPDF } = window.jspdf;
    try {
        toast(App.t('preparing_report'), 'info');
        const { report: r } = await api('user-report-full', { user_id: uid });

        // --- 1. Load Arabic Font if needed ---
        if (!arabicFontBase64) {
            try {
                // Fetch a lightweight Noto Sans Arabic font from CDN
                const fontUrl = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@master/hinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf';
                const response = await fetch(fontUrl);
                const arrayBuffer = await response.arrayBuffer();
                // Convert to Base64 using a modern method
                const bytes = new Uint8Array(arrayBuffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                arabicFontBase64 = window.btoa(binary);
            } catch (err) {
                console.error("Failed to load Arabic font:", err);
            }
        }

        const doc = new jsPDF();

        // Register font if loaded
        if (arabicFontBase64) {
            doc.addFileToVFS('NotoSansArabic.ttf', arabicFontBase64);
            doc.addFont('NotoSansArabic.ttf', 'NotoSansArabic', 'normal');
        }

        const orange = [249, 115, 22];
        const slate = [71, 85, 105];
        const green = [16, 185, 129];
        const red = [220, 38, 38];

        // --- CALCULATION FOR STATUS & PREDIKAT ---
        const sets = r.report_settings || {};
        const bId = r.stats.best_id || 0;
        const bEn = r.stats.best_en || 0;
        const bAr = r.stats.best_ar || 0;

        const hasId = r.typing_tests.some(t => t.language === 'id');
        const hasEn = r.typing_tests.some(t => t.language === 'en');
        const hasAr = r.typing_tests.some(t => t.language === 'ar');

        const isLulus = hasId && hasEn && hasAr &&
            (bId >= (sets.min_wpm_id || 0)) &&
            (bEn >= (sets.min_wpm_en || 0)) &&
            (bAr >= (sets.min_wpm_ar || 0));

        let ratings = sets.typing_ratings || [];
        if (ratings.length === 0) {
            ratings = [
                { min_wpm: 0, rating: 'Poor' },
                { min_wpm: 40, rating: 'Good' },
                { min_wpm: 61, rating: 'Very Good' },
                { min_wpm: 81, rating: 'Excellent' },
                { min_wpm: 100, rating: 'Master' }
            ];
        }

        const getBestRating = () => {
            let topRating = { rating: '—', tier: -1 };
            const langs = [
                { wpm: bId, code: 'id' },
                { wpm: bEn, code: 'en' },
                { wpm: bAr, code: 'ar' }
            ];
            langs.forEach(l => {
                const mult = (l.code === 'ar') ? 0.5 : 1.0;
                ratings.forEach((rt, idx) => {
                    if (l.wpm >= rt.min_wpm * mult) {
                        if (idx > topRating.tier) { topRating = { rating: rt.rating, tier: idx }; }
                    }
                });
            });
            return topRating.rating;
        };
        const predikat = getBestRating();


        // --- Helper: Strip Emojis but preserve Arabic ---
        const clean = (str) => {
            if (!str) return '';
            // Remove emojis but KEEP Arabic characters (\u0600-\u06FF)
            return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
        };

        // --- Helper: Dynamic Font Switching Hook ---
        // This hook detects Arabic text and swaps the font ONLY for those cells.
        // This prevents Latin labels from disappearing due to missing glyphs in the custom font.
        const dynamicFontHook = (data) => {
            if (!arabicFontBase64) return;
            const text = data.cell.raw || '';
            if (typeof text === 'string' && /[\u0600-\u06FF]/.test(text)) {
                data.cell.styles.font = 'NotoSansArabic';
            }
        };

        const defaultTableStyles = {
            fontSize: 10,
            cellPadding: 2,
            font: 'helvetica' // Use safe built-in font as default
        };

        // --- PAGE 1: RINGKASAN EKSEKUTIF ---

        // Header
        doc.setFillColor(249, 250, 251);
        doc.rect(0, 0, 210, 48, 'F');
        doc.setFontSize(26);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(orange[0], orange[1], orange[2]);
        doc.text('Mafatype.', 15, 22);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(slate[0], slate[1], slate[2]);
        doc.text('INDIVIDUAL PERFORMANCE REPORT', 15, 32);

        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
        doc.text(`Printed on: ${fmtDateTime(new Date())}`, 15, 40);

        // --- DRAW STATUS & GRADE (Top Right) ---
        const finalGrade = isLulus ? predikat : 'Poor';
        const gradeFullText = `GRADE: ${finalGrade}`.toUpperCase();
        const statusText = isLulus ? 'PASSED' : 'NOT PASSED';

        // Calculate required width based on text
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const stWidth = doc.getTextWidth(statusText);
        const gFullWidth = doc.getTextWidth(gradeFullText);
        
        const badgePadding = 8;
        const totalW = Math.max(stWidth, gFullWidth) + badgePadding;
        const rightMargin = 195;
        const badgeX = rightMargin - totalW;
        const badgeCenterX = badgeX + totalW / 2;

        // 1. Status Badge
        const statusColor = isLulus ? green : red;
        doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
        // Status Badge (Top half - rounded top only would be better but rect is safer for seamless join)
        doc.rect(badgeX, 12, totalW, 9, 'F'); 
        doc.setTextColor(255, 255, 255);
        doc.text(statusText, badgeCenterX - stWidth / 2, 18.5);

        // 2. Grade Badge
        doc.setFillColor(orange[0], orange[1], orange[2]);
        // Grade Badge (Bottom half - nempel)
        doc.rect(badgeX, 21, totalW, 9, 'F');
        doc.text(gradeFullText, badgeCenterX - gFullWidth / 2, 27.5);

        // --- 1. INFORMASI USER ---
        doc.setFontSize(13);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text('USER INFORMATION', 15, 60);
        doc.setDrawColor(226, 232, 240);
        doc.line(15, 62, 195, 62);
        doc.setFont('helvetica', 'normal');

        const profileData = [
            ['Username:', r.username, 'Role:', (r.role || 'user').toUpperCase()],
            ['Email:', r.email, 'Status:', r.status === 'active' ? 'Active' : 'Inactive'],
            ['Class:', r.kelas || '—', 'Join Date:', fmtDate(r.created_at)],
            ['Region:', r.daerah || '—', '', '']
        ];

        doc.autoTable({
            startY: 65,
            body: profileData,
            theme: 'plain',
            styles: defaultTableStyles,
            didParseCell: dynamicFontHook,
            columnStyles: {
                0: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 30 },
                2: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 30 }
            }
        });

        // --- 2. RINGKASAN HASIL TES ---
        let finalY = doc.lastAutoTable.finalY + 12;
        doc.setFontSize(13);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text('TEST RESULTS SUMMARY', 15, finalY);
        doc.line(15, finalY + 2, 195, finalY + 2);
        doc.setFont('helvetica', 'normal');

        const testStats = [
            ['Total Tests:', r.stats.total_tests || 0, 'Best WPM (ID):', (r.stats.best_id || 0) + ' WPM'],
            ['Avg WPM:', (r.stats.avg_kpm || 0), 'Best WPM (EN):', (r.stats.best_en || 0) + ' WPM'],
            ['Avg Accuracy:', (r.stats.avg_accuracy || 0) + '%', 'Best WPM (AR):', (r.stats.best_ar || 0) + ' WPM']
        ];

        doc.autoTable({
            startY: finalY + 5,
            body: testStats,
            theme: 'plain',
            styles: defaultTableStyles,
            didParseCell: dynamicFontHook,
            columnStyles: {
                0: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 30 },
                1: { fontStyle: 'bold', textColor: [30, 41, 59], cellWidth: 30 },
                2: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 35 },
                3: { fontStyle: 'bold', textColor: [30, 41, 59] }
            }
        });

        // --- 3. RINGKASAN AKTIVITAS & PERKEMBANGAN ---
        finalY = doc.lastAutoTable.finalY + 12;
        doc.setFontSize(13);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text('ACTIVITY & PROGRESS SUMMARY', 15, finalY);
        doc.line(15, finalY + 2, 195, finalY + 2);
        doc.setFont('helvetica', 'normal');

        const stats = r.stats || {};
        // Use the 'sets' variable defined earlier in the function scope
        
        // --- RECALCULATE PERCENTAGES BASED ON MIN_ATTEMPTS ---
        // 1. Practice Progress
        const minPrac = parseInt(sets.min_attempts_practice || 1);
        const totalPracTexts = stats.total_practice_texts || 0;
        let practiceProgress = 0;
        if (totalPracTexts > 0) {
            const pracCounts = {};
            (r.practice || []).forEach(p => {
                // p.title is used as unique key for grouping if PT ID isn't returned
                pracCounts[p.title] = (pracCounts[p.title] || 0) + 1;
            });
            let totalWeightedPoints = 0;
            Object.values(pracCounts).forEach(count => {
                totalWeightedPoints += Math.min(count, minPrac);
            });
            practiceProgress = (totalWeightedPoints / (totalPracTexts * minPrac)) * 100;
        }

        // 2. Finger training Progress
        const minFinger = parseInt(sets.min_attempts_finger || 1);
        const totalFingerPatterns = stats.total_finger_patterns || 11;
        let fingerProgress = 0;
        if (totalFingerPatterns > 0) {
            const fingerCounts = {};
            (r.finger_training || []).forEach(f => {
                fingerCounts[f.finger_name] = (fingerCounts[f.finger_name] || 0) + 1;
            });
            let totalWeightedPoints = 0;
            Object.values(fingerCounts).forEach(count => {
                totalWeightedPoints += Math.min(count, minFinger);
            });
            fingerProgress = (totalWeightedPoints / (totalFingerPatterns * minFinger)) * 100;
        }

        const statsData = [
            ['Total Competition Typing:', stats.total_comp || 0],
            ['Total Competitions Won:', stats.won_comp || 0],
            ['Practice Completion Percentage:', parseFloat(practiceProgress).toFixed(1) + '%'],
            ['Finger Training Progress:', parseFloat(fingerProgress).toFixed(1) + '%'],
            ['Global Ranking (Best WPM):', '#' + (stats.overall_rank || '—')]
        ];

        doc.autoTable({
            startY: finalY + 5,
            body: statsData,
            theme: 'grid',
            styles: { ...defaultTableStyles, cellPadding: 3, lineColor: [241, 245, 249] },
            didParseCell: dynamicFontHook,
            columnStyles: {
                0: { fontStyle: 'bold', textColor: [71, 85, 105], cellWidth: 120 },
                1: { fontStyle: 'bold', textColor: orange, halign: 'right' }
            }
        });

        // --- 4. PENGHARGAAN TERBAIK ---
        finalY = doc.lastAutoTable.finalY + 12;
        doc.setFontSize(13);
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.text('BEST ACHIEVEMENTS', 15, finalY);
        doc.line(15, finalY + 2, 195, finalY + 2);
        doc.setFont('helvetica', 'normal');

        // Filter Achievements (Highest per category/sub-category)
        const filteredAchievements = [];
        if (r.achievements && r.achievements.length > 0) {
            const groups = {};
            r.achievements.forEach(a => {
                const req = JSON.parse(a.requirements_json || '{}');
                const reqType = req.type || 'default';
                const groupKey = `${a.category}:${reqType}`; // Group by category and metric type
                if (!groups[groupKey]) groups[groupKey] = [];
                groups[groupKey].push(a);
            });

            for (const key in groups) {
                groups[key].sort((a, b) => {
                    const reqA = JSON.parse(a.requirements_json || '{}');
                    const reqB = JSON.parse(b.requirements_json || '{}');
                    const getWeight = (r) => (r.min || 0) + (r.min_wpm || 0) + (r.min_accuracy || 0) + (r.min_count || 0) + (r.min_comp_count || 0);
                    return getWeight(reqB) - getWeight(reqA);
                });
                filteredAchievements.push(groups[key][0]);
            }
        }

        if (filteredAchievements.length > 0) {
            const achRows = [];
            // Chunk into 2 columns for better layout
            for (let i = 0; i < filteredAchievements.length; i += 2) {
                const a1 = filteredAchievements[i];
                const a2 = filteredAchievements[i + 1];
                achRows.push([
                    clean(a1.title),
                    a2 ? clean(a2.title) : ''
                ]);
            }

            doc.autoTable({
                startY: finalY + 5,
                body: achRows,
                theme: 'plain',
                styles: defaultTableStyles,
                didParseCell: dynamicFontHook,
                columnStyles: {
                    0: { fontStyle: 'bold', textColor: [30, 41, 59] },
                    1: { fontStyle: 'bold', textColor: [30, 41, 59] }
                }
            });
        } else {
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text('No achievements earned yet.', 15, finalY + 10);
        }

        // --- ATTACHMENTS (LAMPIRAN) ---

        // 1. RIWAYAT TEST (Page 2)
        if (r.typing_tests && r.typing_tests.length > 0) {
            doc.addPage();
            doc.setFontSize(14);
            doc.setTextColor(orange[0], orange[1], orange[2]);
            doc.text('APPENDIX 1: TYPING TEST HISTORY', 15, 20);
            doc.autoTable({
                startY: 25,
                head: [['Language', 'WPM', 'Accuracy', 'Correct', 'Wrong', 'Date']],
                body: r.typing_tests.map(t => [
                    t.language.toUpperCase(),
                    t.wpm,
                    t.accuracy + '%',
                    t.correct_words,
                    t.wrong_words,
                    fmtDate(t.created_at)
                ]),
                styles: { ...defaultTableStyles, fontSize: 8 },
                didParseCell: dynamicFontHook,
                headStyles: { fillColor: [100, 116, 139] }
            });
        }

        // 2. RIWAYAT LATIHAN (New Page)
        if (r.practice && r.practice.length > 0) {
            doc.addPage();
            doc.setFontSize(14);
            doc.setTextColor(green[0], green[1], green[2]);
            doc.text('APPENDIX 2: PRACTICE HISTORY', 15, 20);
            doc.autoTable({
                startY: 25,
                head: [['Text Title', 'Language', 'WPM', 'Accuracy', 'Duration', 'Date']],
                body: r.practice.map(p => [
                    clean(p.title),
                    (p.language || 'id').toUpperCase(),
                    p.wpm,
                    p.accuracy + '%',
                    p.time_seconds + 's',
                    fmtDate(p.created_at)
                ]),
                styles: { ...defaultTableStyles, fontSize: 8 },
                didParseCell: dynamicFontHook,
                headStyles: { fillColor: green }
            });
        }

        // 3. RIWAYAT KOMPETISI (New Page)
        if (r.competitions && r.competitions.length > 0) {
            doc.addPage();
            doc.setFontSize(14);
            doc.setTextColor(orange[0], orange[1], orange[2]);
            doc.text('APPENDIX 3: COMPETITION HISTORY', 15, 20);
            doc.autoTable({
                startY: 25,
                head: [['Comp. Name', 'Language', 'Attempts', 'Best WPM', 'Accuracy', 'Ranking', 'Date']],
                body: r.competitions.map(c => [
                    clean(c.title) || 'Competition',
                    (c.language || 'id').toUpperCase(),
                    c.attempts + 'x',
                    c.best_wpm,
                    c.best_accuracy + '%',
                    'Rank ' + (c.best_rank || '—') + ' dari ' + (c.total_participants || 0),
                    fmtDate(c.last_date)
                ]),
                styles: { ...defaultTableStyles, fontSize: 8 },
                didParseCell: dynamicFontHook,
                headStyles: { fillColor: orange }
            });
        }

        // 4. RIWAYAT LATIHAN JARI (New Page)
        if (r.finger_training && r.finger_training.length > 0) {
            doc.addPage();
            doc.setFontSize(14);
            doc.setTextColor(30, 64, 175);
            doc.text('APPENDIX 4: FINGER TRAINING HISTORY', 15, 20);
            doc.autoTable({
                startY: 25,
                head: [['Finger / Pattern', 'WPM', 'Accuracy', 'Date']],
                body: r.finger_training.map(f => [
                    clean(f.finger_name).replace(/_/g, ' ').toUpperCase(),
                    f.wpm,
                    f.accuracy + '%',
                    fmtDate(f.created_at)
                ]),
                styles: { ...defaultTableStyles, fontSize: 8 },
                didParseCell: dynamicFontHook,
                headStyles: { fillColor: [30, 64, 175] }
            });
        }

        doc.save(`RAPOT_MAFATYPE_${r.username.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);
        toast(App.t('pdf_download_success'), 'success');
    } catch (e) {
        console.error("PDF Export Error:", e);
        toast('Gagal ekspor PDF: ' + e.message, 'error');
    }
}
window.exportUserPDF = exportUserPDF;

async function exportAllUsersPDF() {
    const { jsPDF } = window.jspdf;
    try {
        toast('Menyiapkan laporan semua user...', 'info');
        const { data, thresholds, ratings: apiRatings } = await api('users-export-scores');

        if (!data || data.length === 0) {
            return toast('Tidak ada data untuk diekspor', 'error');
        }

        const minId = thresholds?.id || 0;
        const minEn = thresholds?.en || 0;
        const minAr = thresholds?.ar || 0;
        
        // Define default ratings if not provided
        const ratings = (apiRatings && apiRatings.length > 0) ? apiRatings : [
            { min_wpm: 0, rating: 'Poor' },
            { min_wpm: 40, rating: 'Good' },
            { min_wpm: 61, rating: 'Very Good' },
            { min_wpm: 81, rating: 'Excellent' },
            { min_wpm: 100, rating: 'Master' }
        ];

        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for better table fit
        const orange = [249, 115, 22];

        // --- Header ---
        doc.setFillColor(249, 250, 251);
        doc.rect(0, 0, 297, 30, 'F');
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(orange[0], orange[1], orange[2]);
        doc.text('Mafatype.', 15, 18);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text('REKAPITULASI HASIL MENGETIK SEMUA USER', 15, 25);

        doc.setFontSize(9);
        doc.text(`Dicetak pada: ${fmtDateTime(new Date())}`, 230, 25);

        const blue = [30, 64, 175];
        // --- Table ---
        doc.autoTable({
            startY: 40,
            head: [['ID', 'Username', 'Kelas', 'Total Tes', 'Best KPM', 'Indo', 'English', 'Arabic', 'Status', 'Grade']],
            body: data.map(u => {
                const isLulus = u.best_id >= minId && u.best_en >= minEn && u.best_ar >= minAr;
                const statusStr = isLulus ? 'PASSED' : 'NOT PASSED';
                
                let predikat = '—';
                if (!isLulus) {
                    predikat = 'POOR';
                } else {
                    // Logic for Grade if passed
                    let topTier = -1;
                    const bId = u.best_id || 0, bEn = u.best_en || 0, bAr = u.best_ar || 0;
                    const uLangs = [{ wpm: bId, code: 'id' }, { wpm: bEn, code: 'en' }, { wpm: bAr, code: 'ar' }];
                    uLangs.forEach(l => {
                        const mult = (l.code === 'ar') ? 0.5 : 1.0;
                        ratings.forEach((rt, idx) => {
                            if (l.wpm >= rt.min_wpm * mult && idx > topTier) {
                                topTier = idx;
                                predikat = rt.rating.toUpperCase();
                            }
                        });
                    });
                }
                
                return [
                    '#' + u.id,
                    u.username,
                    u.kelas || '—',
                    u.total_tests,
                    u.best_kpm,
                    u.best_id,
                    u.best_en,
                    u.best_ar,
                    statusStr,
                    predikat
                ];
            }),
            styles: { fontSize: 8.5 },
            headStyles: { fillColor: blue },
            columnStyles: {
                0: { cellWidth: 15 },
                4: { fontStyle: 'bold' },
                8: { fontStyle: 'bold' },
                9: { fontStyle: 'bold' }
            }
        });

        doc.save(`Rekap_Mafatype_All_${new Date().toISOString().slice(0, 10)}.pdf`);
        toast('Rekap PDF berhasil diunduh', 'success');
    } catch (e) {
        toast('Gagal ekspor PDF: ' + e.message, 'error');
    }
}
window.exportAllUsersPDF = exportAllUsersPDF;

async function openUserDetail(uid) {
    try {
        const { user } = await api('user-detail', { user_id: uid });

        // Inject export button listener
        const btn = document.getElementById('btn-export-user-pdf');
        if (btn) {
            btn.onclick = () => exportUserPDF(uid);
        }

        // --- Achievement Filtering Logic ---
        const filteredAchievements = [];
        if (user.achievements && user.achievements.length > 0) {
            const groups = {};
            user.achievements.forEach(a => {
                const req = JSON.parse(a.requirements_json || '{}');
                const reqType = req.type || 'default';
                // Group by Category + Requirement Type (e.g., typing_activity:test_count vs typing_activity:flawless_streak)
                const groupKey = `${a.category}:${reqType}`;

                if (!groups[groupKey]) groups[groupKey] = [];
                groups[groupKey].push(a);
            });

            for (const key in groups) {
                // Find the "highest" achievement in this group
                groups[key].sort((a, b) => {
                    const reqA = JSON.parse(a.requirements_json || '{}');
                    const reqB = JSON.parse(b.requirements_json || '{}');

                    // Comprehensive metric calculation
                    const getWeight = (r) => {
                        return (r.min || 0) +
                            (r.min_wpm || 0) +
                            (r.min_accuracy || 0) +
                            (r.min_count || 0) +
                            (r.min_participants || 0) +
                            (r.min_repeats || 0) +
                            (r.min_comp_count || 0);
                    };

                    const valA = getWeight(reqA);
                    const valB = getWeight(reqB);

                    if (valB !== valA) return valB - valA;
                    // Tie-breaker: prefer higher ID (usually more special)
                    return b.id - a.id;
                });
                filteredAchievements.push(groups[key][0]);
            }
        }

        const stats = {
            tests: user.stats ? user.stats.total_tests : 0,
            bestWpm: user.stats ? user.stats.best_wpm : 0,
            avgAcc: user.stats ? parseFloat(user.stats.avg_accuracy || 0).toFixed(1) : 0,
            bestId: user.stats ? user.stats.best_id : 0,
            bestEn: user.stats ? user.stats.best_en : 0,
            bestAr: user.stats ? user.stats.best_ar : 0,
            wonComp: user.stats ? user.stats.won_comp : 0
        };

        const minId = user.thresholds?.id || 0;
        const minEn = user.thresholds?.en || 0;
        const minAr = user.thresholds?.ar || 0;
        const ratings = user.ratings || [];

        const isLulus = stats.bestId >= minId && stats.bestEn >= minEn && stats.bestAr >= minAr;
        const statusBadgeLabel = isLulus ? 'PASSED' : 'NOT PASSED';
        const statusBadgeClass = isLulus ? 'badge-active' : 'badge-danger';
        
        let predikat = 'POOR';
        if (isLulus) {
            let topTier = -1;
            const uLangs = [{ wpm: stats.bestId, code: 'id' }, { wpm: stats.bestEn, code: 'en' }, { wpm: stats.bestAr, code: 'ar' }];
            uLangs.forEach(l => {
                const mult = (l.code === 'ar') ? 0.5 : 1.0;
                ratings.forEach((rt, idx) => {
                    if (l.wpm >= rt.min_wpm * mult && idx > topTier) {
                        topTier = idx;
                        predikat = rt.rating.toUpperCase();
                    }
                });
            });
        }
        const gradeBadgeClass = isLulus ? 'badge-primary' : 'badge-danger';

        document.getElementById('detail-content').innerHTML = `
            <div class="user-report-card">
                <div class="report-header" style="flex-direction: column; align-items: stretch; gap: 1.25rem;">
                    <!-- Row 1: Profile & Badges -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div class="user-profile-summary">
                            <div class="user-avatar-lg">👤</div>
                            <div class="user-main-info">
                                <h2 class="report-user-name" style="font-size: 1.25rem;">${esc(user.username)}</h2>
                                <div class="report-user-meta" style="flex-wrap: nowrap;">
                                    <span class="badge badge-info">${esc(user.kelas || 'Umum')}</span>
                                    <span class="badge badge-secondary">${esc(user.daerah || 'No Location')}</span>
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end;">
                            <span class="badge ${statusBadgeClass}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; min-width: 100px; text-align: center;">${statusBadgeLabel}</span>
                            <span class="badge ${gradeBadgeClass}" style="padding: 0.4rem 0.8rem; font-size: 0.75rem; min-width: 100px; text-align: center;">${predikat}</span>
                        </div>
                    </div>

                    <!-- Row 2: Unified Stats Grid -->
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; border-top: 1px solid var(--border); padding-top: 1.25rem;">
                        <div class="qstat-item" style="background: rgba(var(--primary-rgb), 0.05); padding: 0.5rem; border-radius: 8px;">
                            <div class="qstat-label" style="font-size: 0.6rem;">Total Tes</div>
                            <div class="qstat-value" style="font-size: 1.1rem;">${stats.tests}</div>
                        </div>
                        <div class="qstat-item" style="background: rgba(var(--primary-rgb), 0.05); padding: 0.5rem; border-radius: 8px;">
                            <div class="qstat-label" style="font-size: 0.6rem;">Best WPM</div>
                            <div class="qstat-value highlighted" style="font-size: 1.1rem;">${stats.bestWpm}</div>
                        </div>
                        <div class="qstat-item" style="background: rgba(var(--primary-rgb), 0.05); padding: 0.5rem; border-radius: 8px;">
                            <div class="qstat-label" style="font-size: 0.6rem;">Akurasi</div>
                            <div class="qstat-value" style="font-size: 1.1rem;">${stats.avgAcc}%</div>
                        </div>
                        <div class="qstat-item" style="background: rgba(var(--primary-rgb), 0.05); padding: 0.5rem; border-radius: 8px;">
                            <div class="qstat-label" style="font-size: 0.6rem;">Won Comp</div>
                            <div class="qstat-value" style="font-size: 1.1rem; color: var(--accent);">${stats.wonComp}</div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
                        <div class="qstat-item" style="padding: 0.25rem;">
                            <div class="qstat-label" style="font-size: 0.6rem;">Best ID</div>
                            <div class="qstat-value" style="font-size: 1.05rem;">${stats.bestId} <small style="font-size: 0.6rem; font-weight: 400;">KPM</small></div>
                        </div>
                        <div class="qstat-item" style="padding: 0.25rem;">
                            <div class="qstat-label" style="font-size: 0.6rem;">Best EN</div>
                            <div class="qstat-value" style="font-size: 1.05rem;">${stats.bestEn} <small style="font-size: 0.6rem; font-weight: 400;">KPM</small></div>
                        </div>
                        <div class="qstat-item" style="padding: 0.25rem;">
                            <div class="qstat-label" style="font-size: 0.6rem;">Best AR</div>
                            <div class="qstat-value" style="font-size: 1.05rem;">${stats.bestAr} <small style="font-size: 0.6rem; font-weight: 400;">KPM</small></div>
                        </div>
                    </div>
                </div>

                <div class="report-section" style="margin-top: 0.5rem;">
                    <h3 class="report-section-title">🏆 Daftar Penghargaan</h3>
                    <div class="achievement-grid-compact">
                        ${filteredAchievements.map(a => `
                            <div class="achievement-pill" title="${esc(a.title)}">
                                <span class="pill-icon">${esc(a.badge_icon)}</span>
                                <span class="pill-text">${esc(a.title)}</span>
                            </div>
                        `).join('') || '<div class="empty-mini">Belum ada penghargaan</div>'}
                    </div>
                </div>

                <div class="report-section">
                    <h3 class="report-section-title">📊 Aktivitas Terbaru</h3>
                    <div class="mini-table-wrap">
                        <table class="mini-table">
                            <thead><tr><th>Bahasa</th><th>KPM</th><th>Akurasi</th><th>Tanggal</th></tr></thead>
                            <tbody>${(user.tests || []).slice(0, 10).map(t => `<tr>
                                <td>${langBadge(t.language)}</td>
                                <td class="td-mono font-bold">${t.wpm}</td>
                                <td class="td-mono">${t.accuracy}%</td>
                                <td class="td-date">${fmtDate(t.created_at)}</td>
                            </tr>`).join('') || '<tr><td colspan="4" class="text-center">Belum ada aktivitas</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>
                
                <div style="text-align: right; font-size: 0.75rem; color: var(--text-mut); margin-top: 1rem;">
                    Joined: ${fmtDate(user.created_at)}
                </div>
            </div>`;
        openModal('modal-user-detail');
    } catch (e) {
        console.error("Error opening user detail:", e);
        toast("Gagal memuat detail user", "error");
    }
}
window.openUserDetail = openUserDetail;

function openAddUser() {
    document.getElementById('user-form').reset();
    document.getElementById('edit-user-id').value = '';
    document.getElementById('user-modal-title').textContent = 'Tambah User';
    document.getElementById('user-pw-row').style.display = '';
    openModal('modal-user');
}
window.openAddUser = openAddUser;

function openEditUser(id) {
    const user = USER_DATA[id];
    if (!user) return;
    document.getElementById('edit-user-id').value = id;
    document.getElementById('user-modal-title').textContent = 'Edit User';
    document.getElementById('u-username').value = user.username;
    document.getElementById('u-email').value = user.email;
    document.getElementById('u-role').value = user.role;
    document.getElementById('u-kelas').value = user.kelas || '';
    document.getElementById('u-daerah').value = user.daerah || '';
    document.getElementById('u-status').value = user.status || 'active';
    document.getElementById('u-password').value = '';
    document.getElementById('user-pw-row').style.display = '';
    openModal('modal-user');
}
window.openEditUser = openEditUser;

async function saveUser(e) {
    e.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    const data = {
        username: document.getElementById('u-username').value,
        email: document.getElementById('u-email').value,
        role: document.getElementById('u-role').value,
        kelas: document.getElementById('u-kelas').value.trim(),
        daerah: document.getElementById('u-daerah').value.trim(),
        status: document.getElementById('u-status').value,
        password: document.getElementById('u-password').value || undefined,
    };
    try {
        if (id) {
            await api('edit-user', { user_id: parseInt(id), ...data }, 'POST');
            toast('User berhasil diperbarui', 'success');
        } else {
            await api('add-user', data, 'POST');
            toast('User berhasil ditambahkan', 'success');
        }
        closeModal('modal-user');
        loadUsers(userPage);
    } catch (e) { }
}
window.saveUser = saveUser;

async function deleteUser(id) {
    const user = USER_DATA[id];
    const name = user ? user.username : 'User';
    confirmDelete(`Hapus user "${name}"? Semua data terkait akan ikut terhapus.`, async () => {
        try {
            await api('delete-user', { user_id: id }, 'POST');
            toast('User dihapus', 'success');
            loadUsers(userPage);
        } catch (e) { }
    });
}
window.deleteUser = deleteUser;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: WORDS
// ─────────────────────────────────────────────────────────────────────────────
let currentLang = 'id', wordPage = 1, wordSearch = '';
async function loadWords(page = 1, lang = currentLang, search = wordSearch) {
    wordPage = page; currentLang = lang; wordSearch = search;
    showLoading('words-tbody');
    // Update tab active
    document.querySelectorAll('.lang-tab').forEach(t => t.classList.toggle('active', t.dataset.lang === lang));
    try {
        const { words, total } = await api('admin-words', { page, lang, search });
        WORD_DATA = {}; // Clear old data
        document.getElementById('words-tbody').innerHTML = words.length ? words.map(w => {
            WORD_DATA[w.id] = w; // Store in registry
            return `
            <tr>
                <td class="td-mono">#${w.id}</td>
                <td>${langBadge(w.language)}</td>
                <td><strong>${esc(w.word)}</strong></td>
                <td>${fmtDate(w.created_at)}</td>
                <td>
                    <div class="td-actions">
                        <button class="btn btn-sm" onclick="openEditWord(${w.id})">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteWord(${w.id})">🗑</button>
                    </div>
                </td>
            </tr>`;
        }).join('') : `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📝</div><p>Tidak ada kata</p></div></td></tr>`;
        renderPagination('words-pagination', page, 50, total, 'wordsPage');
    } catch (e) { }
}
window.loadWords = loadWords;
window.wordsPage = (dir) => loadWords(dir === 'next' ? wordPage + 1 : wordPage - 1, currentLang);

function openAddWord() {
    document.getElementById('word-form').reset();
    document.getElementById('edit-word-id').value = '';
    document.getElementById('w-language').value = currentLang;
    document.getElementById('word-modal-title').textContent = 'Tambah Kata';
    openModal('modal-word');
}
window.openAddWord = openAddWord;

function openEditWord(id) {
    const w = WORD_DATA[id];
    if (!w) return;
    document.getElementById('edit-word-id').value = id;
    document.getElementById('w-word').value = w.word;
    document.getElementById('w-language').value = w.language;
    document.getElementById('word-modal-title').textContent = 'Edit Kata';
    openModal('modal-word');
}
window.openEditWord = openEditWord;

async function saveWord(e) {
    e.preventDefault();
    const id = document.getElementById('edit-word-id').value;
    const word = document.getElementById('w-word').value.trim();
    const language = document.getElementById('w-language').value;
    try {
        if (id) {
            await api('edit-word', { id: parseInt(id), word }, 'POST');
            toast('Kata diperbarui', 'success');
        } else {
            await api('add-word', { word, language }, 'POST');
            toast('Kata ditambahkan', 'success');
        }
        closeModal('modal-word');
        loadWords(wordPage, currentLang);
    } catch (e) { }
}
window.saveWord = saveWord;

async function deleteWord(id) {
    const w = WORD_DATA[id];
    const word = w ? w.word : 'Kata';
    confirmDelete(`Hapus kata "${word}"?`, async () => {
        try {
            await api('delete-word', { id }, 'POST');
            toast('Kata dihapus', 'success');
            loadWords(wordPage, currentLang);
        } catch (e) { }
    });
}
window.deleteWord = deleteWord;

async function importWords(e) {
    if (e) e.preventDefault();
    const csvElem = document.getElementById('import-csv');
    const csv = csvElem.value.trim();
    const lang = document.getElementById('import-lang').value;
    if (!csv) { toast(App.t('csv_empty') || 'Masukkan kata-kata CSV', 'error'); return; }
    try {
        const { message } = await api('import-words', { csv, language: lang }, 'POST');
        toast(message, 'success');
        csvElem.value = '';
        closeModal('modal-import');
        loadWords(1, lang);
    } catch (e) { }
}
window.importWords = importWords;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: RESULTS
// ─────────────────────────────────────────────────────────────────────────────
let resultPage = 1, resultLangFilter = '';
async function loadResults(page = 1, lang = resultLangFilter) {
    resultPage = page; resultLangFilter = lang;
    showLoading('results-tbody');
    try {
        const { results, total } = await api('results', { page, ...(lang ? { lang } : {}) });
        document.getElementById('results-tbody').innerHTML = results.length ? results.map(r => `
            <tr>
                <td class="td-mono">#${r.id}</td>
                <td><strong>${esc(r.username)}</strong></td>
                <td>${langBadge(r.language)}</td>
                <td class="td-mono" style="color:var(--primary);font-weight:700">${r.wpm}</td>
                <td class="td-mono">${r.accuracy}%</td>
                <td class="td-mono">${r.correct_words}</td>
                <td class="td-mono">${r.wrong_words}</td>
                <td>${fmtDateTime(r.created_at)}</td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteResult(${r.id})">🗑</button></td>
            </tr>`).join('') : `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">⌨️</div><p>Tidak ada hasil</p></div></td></tr>`;
        renderPagination('results-pagination', page, 30, total, 'resultsPage');
    } catch (e) { }
}
window.resultsPage = (dir) => loadResults(dir === 'next' ? resultPage + 1 : resultPage - 1, resultLangFilter);

async function deleteResult(id) {
    confirmDelete('Hapus hasil tes ini?', async () => {
        try {
            await api('delete-result', { id }, 'POST');
            toast('Hasil dihapus', 'success');
            loadResults(resultPage, resultLangFilter);
        } catch (e) { }
    });
}
window.deleteResult = deleteResult;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: LEADERBOARD
// ─────────────────────────────────────────────────────────────────────────────
let lbPage = 1;
async function loadLeaderboard(page = 1) {
    lbPage = page;
    showLoading('lb-tbody');
    try {
        const { leaderboard, total } = await api('admin-lb', { page });
        document.getElementById('lb-tbody').innerHTML = leaderboard.length ? leaderboard.map(r => {
            const rank = parseInt(r.rank);
            const rc = rank <= 3 ? `rank-${rank}` : 'rank-n';
            return `<tr>
                <td><div class="rank-badge ${rc}">${rank}</div></td>
                <td><strong>${esc(r.username)}</strong></td>
                <td class="td-mono" style="color:var(--primary);font-weight:700">${r.wpm}</td>
                <td class="td-mono">${r.accuracy}%</td>
                <td>${langBadge(r.language)}</td>
                <td>${fmtDate(r.created_at)}</td>
                <td><button class="btn btn-sm btn-danger" onclick="deleteLbEntry(${r.id})">🗑</button></td>
            </tr>`;
        }).join('') : `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🏆</div><p>Leaderboard kosong</p></div></td></tr>`;
        renderPagination('lb-pagination', page, 30, total, 'lbPage');
    } catch (e) { }
}
window.lbPage = (dir) => loadLeaderboard(dir === 'next' ? lbPage + 1 : lbPage - 1);

async function deleteLbEntry(id) {
    confirmDelete('Hapus entri ini dari leaderboard?', async () => {
        try {
            await api('delete-lb-entry', { id }, 'POST');
            toast('Entri dihapus', 'success');
            loadLeaderboard(lbPage);
        } catch (e) { }
    });
}
window.deleteLbEntry = deleteLbEntry;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: COMPETITIONS
// ─────────────────────────────────────────────────────────────────────────────
async function loadCompetitions() {
    document.getElementById('comps-container').innerHTML = `<div class="loading"><div class="spinner"></div> Memuat...</div>`;
    try {
        const { competitions } = await api('admin-comps');
        const now = new Date();
        COMP_DATA = {}; // Clear old data
        document.getElementById('comps-container').innerHTML = competitions.length ? `
        <div class="table-wrap">
        <table><thead><tr>
            <th>#</th><th>Judul</th><th>Bahasa</th><th>Status</th>
            <th>Peserta</th><th>Mulai</th><th>Selesai</th><th>Aksi</th>
        </tr></thead><tbody>${competitions.map(c => {
            COMP_DATA[c.id] = c; // Store in registry
            const active = new Date(c.end_date) > now;
            return `<tr>
                <td class="td-mono">${c.id}</td>
                <td><strong>${esc(c.title)}</strong><br><span style="font-size:.75rem;color:var(--text-2)">${esc(c.description || '')}</span></td>
                <td>${langBadge(c.language)}</td>
                <td><span class="badge ${active ? 'badge-active' : 'badge-suspended'}">${active ? 'Aktif' : 'Selesai'}</span></td>
                <td class="td-mono">${c.participants}</td>
                <td>${fmtDate(c.start_date)}</td>
                <td>${fmtDate(c.end_date)}</td>
                <td>
                    <div class="td-actions">
                        <button class="btn btn-sm" onclick="openEditComp(${c.id})">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteComp(${c.id})">🗑</button>
                    </div>
                </td>
            </tr>`;
        }).join('')}</tbody></table></div>` :
            `<div class="empty-state"><div class="empty-icon">🏁</div><p>Belum ada kompetisi</p></div>`;
    } catch (e) { }
}

function openAddComp() {
    document.getElementById('comp-form').reset();
    document.getElementById('edit-comp-id').value = '';
    document.getElementById('comp-modal-title').textContent = 'Buat Kompetisi';
    openModal('modal-comp');
}
window.openAddComp = openAddComp;

function openEditComp(id) {
    const c = COMP_DATA[id];
    if (!c) return;
    document.getElementById('edit-comp-id').value = id;
    document.getElementById('comp-title').value = c.title;
    document.getElementById('comp-desc').value = c.description || '';
    document.getElementById('comp-lang').value = c.language;
    document.getElementById('comp-start').value = c.start_date?.slice(0, 16);
    document.getElementById('comp-end').value = c.end_date?.slice(0, 16);
    document.getElementById('comp-modal-title').textContent = 'Edit Kompetisi';
    openModal('modal-comp');
}
window.openEditComp = openEditComp;

async function saveComp(e) {
    e.preventDefault();
    const id = document.getElementById('edit-comp-id').value;
    const data = {
        title: document.getElementById('comp-title').value,
        description: document.getElementById('comp-desc').value,
        language: document.getElementById('comp-lang').value,
        start_date: document.getElementById('comp-start').value,
        end_date: document.getElementById('comp-end').value,
    };
    try {
        if (id) {
            await api('edit-competition', { id: parseInt(id), ...data }, 'POST');
            toast('Kompetisi diperbarui', 'success');
        } else {
            await api('add-competition', data, 'POST');
            toast('Kompetisi dibuat', 'success');
        }
        closeModal('modal-comp');
        loadCompetitions();
    } catch (e) { }
}
window.saveComp = saveComp;

async function deleteComp(id) {
    id = parseInt(id);
    const c = COMP_DATA[id];
    const title = c ? c.title : 'kompetisi ini';
    confirmDelete(`Hapus kompetisi "${title}"? Seluruh data hasil kompetisi juga akan dihapus.`, async () => {
        try {
            await api('delete-competition', { id }, 'POST');
            toast('Kompetisi berhasil dihapus', 'success');
            loadCompetitions();
        } catch (e) {
            console.error('Delete competition failed:', e);
        }
    });
}
window.deleteComp = deleteComp;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: PRACTICE TEXTS
// ─────────────────────────────────────────────────────────────────────────────
async function loadPracticeTexts() {
    showLoading('practice-tbody');
    const lang = document.getElementById('practice-lang-filter')?.value || '';
    try {
        const { texts } = await api('admin-practice-texts', { lang });
        PRACTICE_DATA = {};
        document.getElementById('practice-tbody').innerHTML = texts.length ? texts.map(t => {
            PRACTICE_DATA[t.id] = t;
            return `
            <tr>
                <td class="td-mono">#${t.id}</td>
                <td><strong>${esc(t.title)}</strong></td>
                <td>${langBadge(t.language)}</td>
                <td><span class="diff-badge diff-${t.difficulty}">${t.difficulty}</span></td>
                <td class="td-mono">${t.char_count}</td>
                <td><span class="badge ${t.is_active == 1 ? 'badge-active' : 'badge-suspended'}">${t.is_active == 1 ? 'Aktif' : 'Non-aktif'}</span></td>
                <td>
                    <div class="td-actions">
                        <button class="btn btn-sm" onclick="openEditPractice(${t.id})">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deletePracticeText(${t.id})">🗑</button>
                    </div>
                </td>
            </tr>`;
        }).join('') : `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">✍️</div><p>Tidak ada teks latihan</p></div></td></tr>`;
    } catch (e) { }
}
window.loadPracticeTexts = loadPracticeTexts;

function openAddPractice() {
    document.getElementById('practice-form').reset();
    document.getElementById('pt-id').value = '';
    document.getElementById('practice-modal-title').textContent = 'Tambah Teks Latihan';
    openModal('modal-practice');
}
window.openAddPractice = openAddPractice;

async function openEditPractice(id) {
    try {
        // Fetch full content from public API as admin-api might not return it in list
        const res = await fetch(`../backend-php/api.php?action=practice-text&id=${id}`);
        const data = await res.json();
        const t = data.text;

        document.getElementById('pt-id').value = t.id;
        document.getElementById('pt-title').value = t.title;
        document.getElementById('pt-language').value = t.language;
        document.getElementById('pt-difficulty').value = t.difficulty;
        document.getElementById('pt-content').value = t.content;
        document.getElementById('pt-description').value = t.description || '';
        document.getElementById('pt-active').value = t.is_active;
        document.getElementById('practice-modal-title').textContent = 'Edit Teks Latihan';
        openModal('modal-practice');
    } catch (e) {
        toast('Gagal memuat detail teks', 'error');
    }
}
window.openEditPractice = openEditPractice;

async function savePracticeText(e) {
    e.preventDefault();
    const id = document.getElementById('pt-id').value;
    const data = {
        id: id ? parseInt(id) : undefined,
        title: document.getElementById('pt-title').value.trim(),
        description: document.getElementById('pt-description').value.trim(),
        language: document.getElementById('pt-language').value,
        difficulty: document.getElementById('pt-difficulty').value,
        content: document.getElementById('pt-content').value.trim(),
        is_active: parseInt(document.getElementById('pt-active').value)
    };
    try {
        await api('admin-save-practice-text', data, 'POST');
        toast(id ? 'Teks diperbarui' : 'Teks ditambahkan', 'success');
        closeModal('modal-practice');
        loadPracticeTexts();
    } catch (e) { }
}
window.savePracticeText = savePracticeText;

async function deletePracticeText(id) {
    const t = PRACTICE_DATA[id];
    const title = t ? t.title : 'teks ini';
    confirmDelete(`Hapus teks latihan "${title}"? Seluruh riwayat percobaan user untuk teks ini juga akan dihapus.`, async () => {
        try {
            await api('admin-delete-practice-text', { id }, 'POST');
            toast('Teks berhasil dihapus', 'success');
            loadPracticeTexts();
        } catch (e) { }
    });
}
window.deletePracticeText = deletePracticeText;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: MULTIPLAYER
// ─────────────────────────────────────────────────────────────────────────────
async function loadMultiplayer() {
    await refreshMultiplayer();
    if (!mpInterval) {
        mpInterval = setInterval(refreshMultiplayer, 5000);
    }
}

async function refreshMultiplayer() {
    try {
        const data = await api('multiplayer-stats');
        const el = document.getElementById('mp-content');
        const btnStart = document.getElementById('admin-btn-start-server');
        const btnStop = document.getElementById('admin-btn-stop-server');

        if (data.online) {
            const rooms = data.data?.rooms || [];
            document.getElementById('mp-status').innerHTML = `<span class="badge badge-online">● Server Online</span>`;

            if (btnStart) btnStart.style.display = 'none';
            if (btnStop) {
                btnStop.style.display = 'inline-flex';
                btnStop.disabled = false;
                btnStop.textContent = '⏹ Matikan Server';
            }

            el.innerHTML = rooms.length ? `<div class="mp-grid">${rooms.map(r => {
                const statusLabel = {
                    'waiting': 'Menunggu',
                    'countdown': 'Countdown',
                    'playing': 'Dalam Balapan',
                    'finished': 'Selesai'
                }[r.status] || r.status;

                const statusClass = {
                    'waiting': 'badge-inactive',
                    'countdown': 'badge-warn',
                    'playing': 'badge-active',
                    'finished': 'badge-admin'
                }[r.status] || '';

                return `
                <div class="room-card">
                    <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:0.75rem;">
                        <div class="room-id">Room: ${esc(r.id)}</div>
                        <span class="badge ${statusClass}">${statusLabel}</span>
                    </div>
                    <div style="font-size:0.8rem; margin-bottom:0.5rem;">
                        <strong>${r.players?.length || 0}</strong> player • <span class="badge badge-${r.language}">${r.language.toUpperCase()}</span>
                    </div>
                    <div class="room-players-list" style="display:grid; gap:0.75rem; margin-top:0.75rem;">
                        ${(r.players || []).sort((a, b) => b.progress - a.progress).map(p => `
                            <div class="player-monitor-row">
                                <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:0.25rem;">
                                    <span>${esc(p.username || p.id)}</span>
                                    <span style="font-family:var(--mono); color:var(${p.finished ? '--correct' : '--primary'})">
                                        ${p.wpm} WPM ${p.finished ? '🏁' : ''}
                                    </span>
                                </div>
                                <div class="progress-bar-container">
                                    <div class="progress-bar-fill" style="width:${p.progress}%"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            }).join('')}</div>` :
                `<div class="empty-state"><div class="empty-icon">🎮</div><p>Tidak ada room aktif</p></div>`;
        } else {
            document.getElementById('mp-status').innerHTML = `<span class="badge badge-offline">● Server Offline</span>`;

            if (btnStop) btnStop.style.display = 'none';
            if (btnStart) {
                btnStart.style.display = 'inline-flex';
                btnStart.disabled = false;
                btnStart.textContent = '▶ Jalankan Server';
            }

            const recent = data.recent_activity || [];
            el.innerHTML = `
                <div style="color:var(--warn);margin-bottom:1rem;font-size:.875rem">⚠️ Node.js server tidak terjangkau. Menampilkan aktivitas terbaru dari database.</div>
                <div class="table-wrap"><table><thead><tr><th>User</th><th>KPM</th><th>Waktu</th></tr></thead><tbody>
                ${recent.map(r => `<tr><td>${esc(r.username)}</td><td class="td-mono">${r.wpm}</td><td>${fmtDateTime(r.created_at)}</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text-mut)">Tidak ada aktivitas</td></tr>'}
                </tbody></table></div>`;
        }
    } catch (e) { }
}

async function startNodeServer() {
    const btn = document.getElementById('admin-btn-start-server');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = '⌛ Menjalankan…';

    try {
        const res = await fetch('../backend-php/start-node-server.php');
        const data = await res.json();
        if (data.status === 'success') {
            toast('✅ ' + data.message, 'success');
            refreshMultiplayer();
        } else {
            toast('❌ ' + data.message, 'error');
            btn.disabled = false;
            btn.textContent = '▶ Jalankan Server';
        }
    } catch (err) {
        toast('❌ Gagal menghubungi PHP backend.', 'error');
        btn.disabled = false;
        btn.textContent = '▶ Jalankan Server';
    }
}
window.startNodeServer = startNodeServer;

async function stopNodeServer() {
    if (!confirm('Matikan server multiplayer sekarang?')) return;

    const btn = document.getElementById('admin-btn-stop-server');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = '⌛ Mematikan…';

    try {
        const res = await fetch('../backend-php/stop-node-server.php');
        const data = await res.json();
        if (data.status === 'success') {
            toast('✅ ' + data.message, 'success');
            refreshMultiplayer();
        } else {
            toast('❌ ' + data.message, 'error');
            btn.disabled = false;
            btn.textContent = '⏹ Matikan Server';
        }
    } catch (err) {
        toast('❌ Gagal menghubungi PHP backend.', 'error');
        btn.disabled = false;
        btn.textContent = '⏹ Matikan Server';
    }
}
window.stopNodeServer = stopNodeServer;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: STATISTICS
// ─────────────────────────────────────────────────────────────────────────────
let statsCharts = {};
async function loadStatistics() {
    try {
        const s = await api('statistics');
        const style = getComputedStyle(document.documentElement);
        const primaryColor = style.getPropertyValue('--primary').trim() || '#f97316';
        const correctColor = style.getPropertyValue('--correct').trim() || '#22c55e';
        const accentColor = style.getPropertyValue('--accent').trim() || '#fb923c';

        // Daily tests + avg KPM
        const dailyLabels = s.daily.map(r => r.day.slice(5));
        renderLineChart('chart-daily', dailyLabels, s.daily.map(r => r.tests), 'Tes per Hari', primaryColor);
        renderLineChart('chart-avg-kpm', dailyLabels, s.daily.map(r => parseFloat(r.avg_kpm) || 0), 'Rata-rata KPM', correctColor);

        // Language distribution
        const langLabels = s.lang_dist.map(r => ({ en: 'English', id: 'Indonesian', ar: 'Arabic' }[r.language] || r.language));
        renderDoughnutChart('chart-lang', langLabels, s.lang_dist.map(r => parseInt(r.count)), ['#60a5fa', '#f87171', '#4ade80']);

        // Top users bar chart
        renderBarChart('chart-top-users', s.top_users.map(u => u.username), s.top_users.map(u => parseInt(u.tests)), 'Jumlah Tes', accentColor);
    } catch (e) { }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
async function loadSettings() {
    try {
        const { settings } = await api('settings');
        document.getElementById('set-site-name').value = settings.site_name || '';
        document.getElementById('set-max-players').value = settings.max_room_players || 4;
        document.getElementById('set-default-lang').value = settings.default_language || 'id';
        document.getElementById('set-node-url').value = settings.node_server_url || '';
        document.getElementById('set-allow-reg').checked = !!settings.allow_register;
        document.getElementById('set-maintenance').checked = !!settings.maintenance_mode;
        document.getElementById('set-base-color').value = settings.site_base_color || '#f97316';

        // Logo preview
        const logoPreviewImg = document.getElementById('logo-preview-img');
        const logoPlaceholder = document.getElementById('logo-preview-placeholder');
        if (settings.site_logo) {
            logoPreviewImg.src = settings.site_logo;
            logoPreviewImg.style.display = 'block';
            logoPlaceholder.style.display = 'none';
        } else {
            logoPreviewImg.style.display = 'none';
            logoPlaceholder.style.display = 'block';
        }

        // Advanced Settings
        document.getElementById('set-min-wpm-id').value = settings.min_wpm_id || 0;
        document.getElementById('set-min-wpm-en').value = settings.min_wpm_en || 0;
        document.getElementById('set-min-wpm-ar').value = settings.min_wpm_ar || 0;
        document.getElementById('set-min-try-practice').value = settings.min_attempts_practice || 1;
        document.getElementById('set-min-try-finger').value = settings.min_attempts_finger || 1;

        // Custom Slogan & Description
        document.getElementById('set-slogan-id').value = settings.site_slogan_id || '';
        document.getElementById('set-slogan-en').value = settings.site_slogan_en || '';
        document.getElementById('set-slogan-ar').value = settings.site_slogan_ar || '';
        document.getElementById('set-desc-id').value = settings.site_description_id || '';
        document.getElementById('set-desc-en').value = settings.site_description_en || '';
        document.getElementById('set-desc-ar').value = settings.site_description_ar || '';

        // Ratings Table
        const tbody = document.getElementById('ratings-tbody');
        tbody.innerHTML = '';
        let ratings = [];
        try {
            ratings = typeof settings.typing_ratings === 'string'
                ? JSON.parse(settings.typing_ratings)
                : (settings.typing_ratings || []);
        } catch (e) { ratings = []; }

        if (ratings.length === 0) {
            // Default values if empty
            ratings = [
                { min_wpm: 0, rating: 'Poor', desc: 'Needs more practice' },
                { min_wpm: 40, rating: 'Good', desc: 'Average computer user' },
                { min_wpm: 61, rating: 'Very Good', desc: 'Fast and consistent' },
                { min_wpm: 81, rating: 'Excellent', desc: 'Professional level' },
                { min_wpm: 100, rating: 'Master', desc: 'Elite typing speed' }
            ];
        }
        ratings.forEach(r => addRatingRow(r));

    } catch (e) { }
}

function addRatingRow(data = { min_wpm: '', rating: '', desc: '' }) {
    const tbody = document.getElementById('ratings-tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="number" class="form-input rating-min-wpm" style="width:70px" value="${data.min_wpm}"></td>
        <td><input type="text" class="form-input rating-label" style="width:100%" value="${esc(data.rating)}"></td>
        <td><input type="text" class="form-input rating-desc" style="width:100%" value="${esc(data.desc)}"></td>
        <td style="text-align:center;"><button type="button" class="btn btn-sm btn-danger" onclick="this.closest('tr').remove()">🗑</button></td>
    `;
    tbody.appendChild(tr);
}
window.addRatingRow = addRatingRow;

async function saveSettings(e) {
    e.preventDefault();

    // Collect ratings
    const ratings = [];
    document.querySelectorAll('#ratings-tbody tr').forEach(tr => {
        const minWpm = parseInt(tr.querySelector('.rating-min-wpm').value);
        const label = tr.querySelector('.rating-label').value.trim();
        const desc = tr.querySelector('.rating-desc').value.trim();
        if (!isNaN(minWpm)) {
            ratings.push({ min_wpm: minWpm, rating: label, desc: desc });
        }
    });
    // Sort by WPM asc
    ratings.sort((a, b) => a.min_wpm - b.min_wpm);

    const data = {
        site_name: document.getElementById('set-site-name').value,
        max_room_players: parseInt(document.getElementById('set-max-players').value),
        default_language: document.getElementById('set-default-lang').value,
        node_server_url: document.getElementById('set-node-url').value,
        allow_register: document.getElementById('set-allow-reg').checked,
        maintenance_mode: document.getElementById('set-maintenance').checked,

        // New advanced settings
        min_wpm_id: parseInt(document.getElementById('set-min-wpm-id').value),
        min_wpm_en: parseInt(document.getElementById('set-min-wpm-en').value),
        min_wpm_ar: parseInt(document.getElementById('set-min-wpm-ar').value),
        min_attempts_practice: parseInt(document.getElementById('set-min-try-practice').value),
        min_attempts_finger: parseInt(document.getElementById('set-min-try-finger').value),
        site_slogan_id: document.getElementById('set-slogan-id').value.trim(),
        site_slogan_en: document.getElementById('set-slogan-en').value.trim(),
        site_slogan_ar: document.getElementById('set-slogan-ar').value.trim(),
        site_description_id: document.getElementById('set-desc-id').value.trim(),
        site_description_en: document.getElementById('set-desc-en').value.trim(),
        site_description_ar: document.getElementById('set-desc-ar').value.trim(),
        site_base_color: document.getElementById('set-base-color').value,
        typing_ratings: JSON.stringify(ratings)
    };
    try {
        const logoFile = document.getElementById('set-logo-file').files[0];
        if (logoFile) {
            const formData = new FormData();
            formData.append('logo', logoFile);
            formData.append('admin_id', adminId()); // Add admin_id for authorization
            
            const uploadRes = await fetch('../backend-php/admin-api.php?action=upload-logo', {
                method: 'POST',
                body: formData
            });
            const uploadData = await uploadRes.json();
            if (uploadData.logo_path) {
                data.site_logo = uploadData.logo_path;
            } else if (uploadData.error) {
                throw new Error(uploadData.error);
            }
        }

        await api('settings', data, 'POST');
        toast(App.t('settings_saved'), 'success');
        window.dispatchEvent(new CustomEvent('settings-saved'));
        loadSettings(); // Reload to refresh preview
    } catch (e) {
        console.error('Settings Error:', e);
        toast(e.message || 'Gagal menyimpan pengaturan', 'error');
    }
}
window.saveSettings = saveSettings;

function previewLogo(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('logo-preview-img');
        const placeholder = document.getElementById('logo-preview-placeholder');
        img.src = e.target.result;
        img.style.display = 'block';
        placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);
}
window.previewLogo = previewLogo;

async function resetData() {
    // Reset modal state
    document.querySelectorAll('input[name="reset-target"]').forEach(cb => {
        cb.checked = false;
        cb.closest('.reset-option-card').classList.remove('selected');
    });
    updateResetSummary();
    const selectAllBtn = document.querySelector('button[onclick^="toggleSelectAllReset"]');
    if (selectAllBtn) selectAllBtn.textContent = App.t('select_all');

    openModal('modal-reset-data');
}
window.resetData = resetData;

function toggleSelectAllReset(btn) {
    const checkboxes = document.querySelectorAll('input[name="reset-target"]');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);

    checkboxes.forEach(cb => {
        cb.checked = !allChecked;
        const card = cb.closest('.reset-option-card');
        if (cb.checked) card.classList.add('selected');
        else card.classList.remove('selected');
    });

    btn.textContent = allChecked ? App.t('select_all') : App.t('deselect_all') || 'Deselect All';
    updateResetSummary();
}
window.toggleSelectAllReset = toggleSelectAllReset;

function updateResetSummary() {
    const checked = document.querySelectorAll('input[name="reset-target"]:checked');
    const summaryBox = document.getElementById('reset-summary-box');
    const summaryText = document.getElementById('reset-summary-text');
    const executeBtn = document.getElementById('btn-execute-reset');

    // Update card styling
    document.querySelectorAll('input[name="reset-target"]').forEach(cb => {
        const card = cb.closest('.reset-option-card');
        if (cb.checked) card.classList.add('selected');
        else card.classList.remove('selected');
    });

    if (checked.length > 0) {
        summaryBox.style.display = 'block';
        summaryText.textContent = App.t('reset_summary').replace('{count}', checked.length);
        executeBtn.disabled = false;
        executeBtn.style.opacity = '1';
        executeBtn.style.cursor = 'pointer';
    } else {
        summaryBox.style.display = 'none';
        executeBtn.disabled = true;
        executeBtn.style.opacity = '0.5';
        executeBtn.style.cursor = 'not-allowed';
    }
}
window.updateResetSummary = updateResetSummary;

async function executeReset() {
    const targets = Array.from(document.querySelectorAll('input[name="reset-target"]:checked')).map(cb => cb.value);

    if (targets.length === 0) {
        toast(App.t('select_at_least_one'), 'error');
        return;
    }

    if (!confirm(App.t('confirm_reset_action'))) return;

    const secondConfirm = prompt(App.t('reset_confirm_prompt'));
    if (secondConfirm !== 'RESET') {
        toast(App.t('reset_cancelled'), 'info');
        return;
    }

    try {
        const res = await api('reset-data', { targets }, 'POST');
        toast(res.message, 'success');
        closeModal('modal-reset-data');
        setTimeout(() => navigate('dashboard'), 1500);
    } catch (e) {
        toast('Gagal meriset data: ' + e.message, 'error');
    }
}
window.executeReset = executeReset;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: ACHIEVEMENTS
// ─────────────────────────────────────────────────────────────────────────────
async function loadAchievements() {
    showLoading('achievements-tbody');
    try {
        const { achievements } = await api('admin-achievements');
        ACHIEVEMENT_DATA = {};
        document.getElementById('achievements-tbody').innerHTML = achievements.length ? achievements.map(a => {
            ACHIEVEMENT_DATA[a.id] = a;
            return `
            <tr>
                <td class="td-mono">#${a.id}</td>
                <td style="font-size:1.5rem;">${esc(a.badge_icon)}</td>
                <td><strong>${esc(a.title)}</strong><br><small style="color:var(--text-2)">${esc(a.description)}</small></td>
                <td><span class="badge badge-info">${esc(a.category)}</span></td>
                <td><code class="td-mono">${esc(typeof a.requirements_json === 'string' ? a.requirements_json : JSON.stringify(a.requirements_json))}</code></td>
                <td>
                    <div class="td-actions">
                        <button class="btn btn-sm" onclick="openEditAchievement(${a.id})" title="Edit Achievement">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteAchievement(${a.id})" title="Hapus Achievement">🗑</button>
                    </div>
                </td>
            </tr>`;
        }).join('') : `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🏆</div><p>${App.t('no_achievements_found')}</p></div></td></tr>`;
    } catch (e) { }
}
window.loadAchievements = loadAchievements;

function openAddAchievement() {
    document.getElementById('achievement-modal-title').textContent = 'Tambah Achievement';
    document.getElementById('ach-id').value = '';
    document.getElementById('achievement-form').reset();
    openModal('modal-achievement');
}
window.openAddAchievement = openAddAchievement;

function openEditAchievement(id) {
    const a = ACHIEVEMENT_DATA[id];
    if (!a) return;
    document.getElementById('achievement-modal-title').textContent = 'Edit Achievement';
    document.getElementById('ach-id').value = a.id;
    document.getElementById('ach-title').value = a.title;
    document.getElementById('ach-badge').value = a.badge_icon;
    document.getElementById('ach-desc').value = a.description;
    document.getElementById('ach-category').value = a.category;
    document.getElementById('ach-reqs').value = typeof a.requirements_json === 'string' ? a.requirements_json : JSON.stringify(a.requirements_json, null, 2);
    openModal('modal-achievement');
}
window.openEditAchievement = openEditAchievement;

async function saveAchievement(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('ach-id').value;
    const title = document.getElementById('ach-title').value;
    const badge_icon = document.getElementById('ach-badge').value || '🏆';
    const description = document.getElementById('ach-desc').value;
    const category = document.getElementById('ach-category').value;
    const reqsText = document.getElementById('ach-reqs').value;

    let requirements_json;
    try {
        requirements_json = JSON.parse(reqsText);
    } catch (err) {
        return toast('Format JSON Persyaratan tidak valid', 'error');
    }

    try {
        const payload = { id, title, badge_icon, description, category, requirements_json };
        await api('admin-save-achievement', payload, 'POST');
        toast(id ? 'Achievement diperbarui' : 'Achievement ditambahkan', 'success');
        closeModal('modal-achievement');
        loadAchievements();
    } catch (e) {
        toast('Gagal menyimpan: ' + e.message, 'error');
    }
}
window.saveAchievement = saveAchievement;

function deleteAchievement(id) {
    confirmDelete('Hapus achievement ini? Riwayat capaian user yang sudah terbuka juga akan terhapus.', async () => {
        try {
            await api('admin-delete-achievement', { id }, 'POST');
            toast('Achievement berhasil dihapus', 'success');
            loadAchievements();
        } catch (e) {
            toast('Gagal menghapus: ' + e.message, 'error');
        }
    });
}
window.deleteAchievement = deleteAchievement;

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: ACTIVITY LOGS
// ─────────────────────────────────────────────────────────────────────────────
let logPage = 1;
const logIcons = {
    'User Registered': { icon: '👤', bg: 'rgba(249,115,22,.15)', color: '#f97316' },
    'Test Completed': { icon: '⌨️', bg: 'rgba(34,197,94,.15)', color: '#22c55e' },
    'Competition Created': { icon: '🏁', bg: 'rgba(245,158,11,.15)', color: '#f59e0b' },
};

async function loadLogs(page = 1) {
    logPage = page;
    const el = document.getElementById('logs-list');
    el.innerHTML = `<div class="loading"><div class="spinner"></div> ${App.t('loading')}</div>`;
    try {
        const { logs } = await api('activity-logs', { page });
        el.innerHTML = logs.length ? logs.map(l => {
            const meta = logIcons[l.event] || { icon: '📋', bg: 'rgba(148,163,184,.15)', color: '#94a3b8' };
            return `<div class="log-event">
                <div class="log-icon" style="background:${meta.bg};color:${meta.color}">${meta.icon}</div>
                <div class="log-body">
                    <div class="log-title">${esc(l.event)}</div>
                    <div class="log-meta"><strong>${esc(l.actor)}</strong> — ${esc(l.detail)}</div>
                </div>
                <div class="log-time">${fmtDateTime(l.created_at)}</div>
            </div>`;
        }).join('') : `<div class="empty-state"><div class="empty-icon">📋</div><p>${App.t('no_logs')}</p></div>`;
    } catch (e) { }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART.JS WRAPPERS
// ─────────────────────────────────────────────────────────────────────────────
const chartInstances = {};
function destroyChart(id) {
    if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}
function renderLineChart(id, labels, data, label, color) {
    destroyChart(id);
    const ctx = document.getElementById(id)?.getContext('2d');
    if (!ctx) return;
    chartInstances[id] = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label, data, borderColor: color, backgroundColor: color + '22', tension: .4, fill: true, pointRadius: 3, pointBackgroundColor: color }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#2d3748' } }, y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#2d3748' }, beginAtZero: true } } },
    });
}
function renderBarChart(id, labels, data, label, color) {
    destroyChart(id);
    const ctx = document.getElementById(id)?.getContext('2d');
    if (!ctx) return;
    chartInstances[id] = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label, data, backgroundColor: color + 'bb', borderColor: color, borderWidth: 1, borderRadius: 4 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#2d3748' } }, y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#2d3748' }, beginAtZero: true } } },
    });
}
function renderDoughnutChart(id, labels, data, colors) {
    destroyChart(id);
    const ctx = document.getElementById(id)?.getContext('2d');
    if (!ctx) return;
    chartInstances[id] = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors.map(c => c + 'bb'), borderColor: colors, borderWidth: 2 }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } } }, cutout: '65%' },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Auth check
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || user.role !== 'admin') {
        alert(App.t('must_login_admin'));
        window.location.href = 'login.html';
        return;
    }

    // Set admin info in sidebar
    document.getElementById('admin-username').textContent = user.username;

    // Clock
    function updateClock() {
        const el = document.getElementById('topbar-time');
        if (el) el.textContent = new Date().toLocaleTimeString('id-ID');
    }
    updateClock();
    setInterval(updateClock, 1000);

    // Wire up search inputs
    document.getElementById('user-search-input')?.addEventListener('input', (e) => {
        clearTimeout(e.target._t);
        e.target._t = setTimeout(() => loadUsers(1, e.target.value), 400);
    });
    document.getElementById('word-search-input')?.addEventListener('input', (e) => {
        clearTimeout(e.target._t);
        e.target._t = setTimeout(() => loadWords(1, currentLang, e.target.value), 400);
    });
    document.getElementById('result-lang-filter')?.addEventListener('change', (e) => {
        loadResults(1, e.target.value);
    });

    // Navigate to dashboard
    navigate('dashboard');
});
