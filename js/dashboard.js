/**
 * Entry point for index.html — the dashboard.
 * Loads the quiz registry, renders quiz cards with per-quiz themes,
 * and wires search/filter interactions.
 */

import { loadIndex } from './quiz-loader.js';
import { applyCardTheme } from './theme.js';
import { Storage } from './storage.js';

const DIFFICULTY_LABEL = {
    beginner: 'מתחיל',
    intermediate: 'מתקדם',
    advanced: 'מומחה',
};

let state = {
    quizzes: [],
    indexData: null,
    filter: 'all',
    search: '',
};

async function main() {
    try {
        state.indexData = await loadIndex();
        state.quizzes = state.indexData.quizzes ?? [];
    } catch (err) {
        console.error(err);
        showEmpty('לא הצלחנו לטעון את רשימת הקוויזים. בדוק שהשרת פעיל ושקובץ data/index.json תקין.');
        return;
    }

    renderProfile();
    renderStats();
    renderFinalExamCard();
    renderQuizzes();
    wireInteractions();
    wireGlobalMenuClose();
    wireProfileMenu();
}

/** Update the profile chip label with the active profile name. */
function renderProfile() {
    const nameEl = document.querySelector('[data-role="profile-name"]');
    if (nameEl) nameEl.textContent = Storage.getActiveProfile();
}

/**
 * Close the profile dropdown. Defined at module scope so the modal helpers
 * can call it too (they need to dismiss the dropdown before opening the
 * overlay, otherwise it stays visible behind the backdrop — confusing).
 */
function closeProfileDropdown() {
    const menu = document.querySelector('[data-role="profile-menu"]');
    const chip = document.querySelector('[data-role="profile-chip"]');
    if (menu) menu.hidden = true;
    if (chip) chip.setAttribute('aria-expanded', 'false');
}

function wireProfileMenu() {
    const chip = document.querySelector('[data-role="profile-chip"]');
    const menu = document.querySelector('[data-role="profile-menu"]');
    const closeBtn = document.querySelector('[data-role="profile-close"]');
    const switchBtn = document.querySelector('[data-role="profile-switch"]');
    const resetBtn = document.querySelector('[data-role="profile-reset"]');
    if (!chip || !menu) return;

    const setOpen = (open) => {
        menu.hidden = !open;
        chip.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) renderProfileList();
    };

    chip.addEventListener('click', (e) => {
        e.stopPropagation();
        setOpen(menu.hidden);
    });

    closeBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.profile-area')) setOpen(false);
    });

    switchBtn?.addEventListener('click', () => {
        closeProfileDropdown(); // dismiss dropdown first for a clean overlay
        openProfileModal({
            title: 'החלפת פרופיל',
            description: 'כתוב שם קיים כדי להיכנס אליו, או שם חדש כדי ליצור פרופיל חדש עם התקדמות ריקה. הנתונים נשארים רק בדפדפן הזה.',
            icon: '👤',
            initialValue: Storage.getActiveProfile(),
            onConfirm: (value) => {
                const cleaned = Storage.setActiveProfile(value);
                refreshEverything();
                showToast(`נכנסת לפרופיל "${cleaned}"`, 'success');
                return cleaned;
            },
        });
    });

    resetBtn?.addEventListener('click', () => {
        closeProfileDropdown();
        const current = Storage.getActiveProfile();
        openConfirmModal({
            title: `לאפס את "${current}"?`,
            description: `פעולה זו תמחק את כל ההתקדמות של הפרופיל "${current}" (ציונים, שאלות שגויות, דגלים). שאר הפרופילים לא יושפעו. לא ניתן לשחזר.`,
            icon: '⚠️',
            variant: 'danger',
            confirmLabel: 'כן, אפס',
            onConfirm: () => {
                const removed = Storage.clearProfile(current);
                refreshEverything();
                showToast(`נוקו ${removed} רשומות של "${current}"`, 'danger');
            },
        });
    });
}

/* =============== Themed modal helpers =============== */

const modal = document.querySelector('[data-role="profile-modal"]');
const modalCard = modal?.querySelector('.app-modal-card');
const modalTitle = document.querySelector('[data-role="profile-modal-title"]');
const modalDesc = document.querySelector('[data-role="profile-modal-desc"]');
const modalIcon = document.querySelector('[data-role="profile-modal-icon"]');
const modalInput = document.querySelector('[data-role="profile-modal-input"]');
const modalInputWrap = document.querySelector('[data-role="profile-modal-input-wrap"]');
const modalError = document.querySelector('[data-role="profile-modal-error"]');
const modalForm = modal?.querySelector('form');
const modalCancelBtn = document.querySelector('[data-role="profile-modal-cancel"]');
const modalCloseBtn = document.querySelector('[data-role="profile-modal-close"]');
const modalOkBtn = document.querySelector('[data-role="profile-modal-ok"]');

let activeConfirm = null;

function setModalError(message) {
    if (!modalError) return;
    if (message) {
        modalError.textContent = message;
        modalError.hidden = false;
        modalInput?.classList.add('is-invalid');
    } else {
        modalError.textContent = '';
        modalError.hidden = true;
        modalInput?.classList.remove('is-invalid');
    }
}

function closeModal() {
    if (!modal || !modal.open) return;
    setModalError('');
    modal.close();
    activeConfirm = null;
}

function openProfileModal({ title, description, icon = '👤', initialValue = '', onConfirm }) {
    if (!modal) return;
    modalCard?.setAttribute('data-variant', 'input');
    if (modalIcon) modalIcon.textContent = icon;
    modalTitle.textContent = title;
    modalDesc.textContent = description;
    setModalError('');
    if (modalInputWrap) modalInputWrap.hidden = false;
    modalInput.value = initialValue;
    modalOkBtn.textContent = 'שמור';

    activeConfirm = () => {
        const raw = (modalInput.value || '').trim();
        if (!raw) {
            setModalError('חייבים להזין שם');
            modalInput.focus();
            return false;
        }
        if (raw.length > 24) {
            setModalError('מקסימום 24 תווים');
            modalInput.focus();
            return false;
        }
        onConfirm(raw);
        return true;
    };
    modal.showModal();
    // Delay focus so the modal animation doesn't steal it
    setTimeout(() => { modalInput.focus(); modalInput.select(); }, 50);
}

function openConfirmModal({ title, description, icon = '⚠️', variant = 'danger', confirmLabel = 'אישור', onConfirm }) {
    if (!modal) return;
    modalCard?.setAttribute('data-variant', variant);
    if (modalIcon) modalIcon.textContent = icon;
    modalTitle.textContent = title;
    modalDesc.textContent = description;
    setModalError('');
    if (modalInputWrap) modalInputWrap.hidden = true;
    modalOkBtn.textContent = confirmLabel;

    activeConfirm = () => { onConfirm(); return true; };
    modal.showModal();
    setTimeout(() => modalOkBtn.focus(), 50);
}

/** Floating confirmation toast — stays for ~2.5 seconds then fades. */
let toastTimer = null;
function showToast(message, variant = 'default') {
    const el = document.querySelector('[data-role="toast"]');
    if (!el) return;
    el.textContent = message;
    el.setAttribute('data-variant', variant);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        el.hidden = true;
    }, 2800);
}

// Wire modal events once on module load.
if (modalForm) {
    modalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (activeConfirm && activeConfirm() !== false) closeModal();
    });
}
// Clear error as the user types.
modalInput?.addEventListener('input', () => setModalError(''));
modalCancelBtn?.addEventListener('click', closeModal);
modalCloseBtn?.addEventListener('click', closeModal);
// Clicking the backdrop (outside the card) also closes.
modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

function renderProfileList() {
    const listEl = document.querySelector('[data-role="profile-list"]');
    if (!listEl) return;
    const profiles = Storage.listProfiles();
    const active = Storage.getActiveProfile();
    listEl.innerHTML = '<div class="profile-list-label">פרופילים קיימים בדפדפן הזה:</div>';
    profiles.forEach((p) => {
        const btn = document.createElement('button');
        btn.textContent = p;
        if (p === active) btn.classList.add('is-active');
        btn.addEventListener('click', () => {
            Storage.setActiveProfile(p);
            refreshEverything(p);
        });
        listEl.appendChild(btn);
    });
}

function refreshEverything() {
    renderProfile();
    renderStats();
    renderFinalExamCard();
    renderQuizzes();
    renderProfileList();
}

function renderFinalExamCard() {
    const startBtn = document.querySelector('[data-role="start-final"]');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const url = new URL('quiz.html', location.href);
            url.searchParams.set('mode', 'final');
            location.href = url.toString();
        });
    }

    // Show last final-exam score if one exists.
    const lastEl = document.querySelector('[data-role="final-last"]');
    if (lastEl) {
        const history = Storage.getHistory('final-exam');
        if (history.length > 0) {
            const last = history[0];
            lastEl.textContent = `ציון אחרון: ${last.percent}% · ${history.length} ניסיונות`;
        } else {
            lastEl.textContent = 'טרם נוסה';
        }
    }
}

function renderStats() {
    const all = Storage.getAllHistory();
    const quizIds = state.quizzes.map((q) => q.id);
    let completed = 0;
    let scores = [];
    let attempts = 0;
    let wrongPool = 0;

    for (const quizId of quizIds) {
        const history = all[quizId] ?? [];
        if (history.length > 0) completed++;
        attempts += history.length;
        history.forEach((h) => scores.push(h.percent));
        wrongPool += Storage.getWrongIds(quizId).length;
    }

    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    setStat('completed', completed);
    setStat('avg-score', avg != null ? `${avg}%` : '—');
    setStat('total-attempts', attempts);
    setStat('wrong-pool', wrongPool);
}

function setStat(name, value) {
    const el = document.querySelector(`[data-stat="${name}"]`);
    if (el) el.textContent = value;
}

function renderQuizzes() {
    const grid = document.getElementById('quizzes');
    grid.innerHTML = '';

    const visible = state.quizzes.filter(matchesFilter);

    if (visible.length === 0) {
        grid.innerHTML = `<div class="loading-placeholder">לא נמצאו קוויזים התואמים לסינון.</div>`;
        return;
    }

    const tmpl = document.getElementById('quiz-card-template');
    visible.forEach((quiz) => {
        const card = tmpl.content.firstElementChild.cloneNode(true);
        card.dataset.quizId = quiz.id;

        applyCardTheme(card, quiz.theme, state.indexData);

        card.querySelector('.quiz-number').textContent = `#${quiz.presentationNumber ?? '—'}`;
        card.querySelector('.quiz-difficulty').textContent = DIFFICULTY_LABEL[quiz.difficulty] ?? '';
        card.querySelector('.quiz-title').textContent = quiz.title;
        card.querySelector('.quiz-count').textContent = `${quiz.questionCount ?? '?'} שאלות`;
        card.querySelector('.quiz-time').textContent = `~${quiz.estimatedMinutes ?? '?'} דק'`;

        // Progress from history (last score)
        const history = Storage.getHistory(quiz.id);
        if (history.length > 0) {
            const lastPercent = history[0].percent;
            const progressEl = card.querySelector('.quiz-progress');
            progressEl.hidden = false;
            progressEl.querySelector('.quiz-progress-fill').style.width = `${lastPercent}%`;
            progressEl.querySelector('.quiz-progress-text').textContent = `ציון אחרון: ${lastPercent}% · ${history.length} נסיונות`;
        }

        wireCard(card, quiz);
        grid.appendChild(card);
    });
}

function wireCard(card, quiz) {
    const menu = card.querySelector('.quiz-mode-menu');

    card.querySelector('[data-action="practice"]').addEventListener('click', () => {
        goToQuiz(quiz.id, 'practice');
    });

    card.querySelector('[data-action="menu"]').addEventListener('click', (e) => {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
    });

    menu.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-mode]');
        if (btn) goToQuiz(quiz.id, btn.dataset.mode);
    });
}

/** Single document-level listener that closes any open menus on outside click. */
function wireGlobalMenuClose() {
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.quiz-mode-menu').forEach((menu) => {
            const card = menu.closest('.quiz-card');
            if (card && !card.contains(e.target)) menu.hidden = true;
        });
    });
}

function goToQuiz(quizId, mode) {
    const url = new URL('quiz.html', location.href);
    url.searchParams.set('id', quizId);
    url.searchParams.set('mode', mode);
    location.href = url.toString();
}

function matchesFilter(quiz) {
    if (state.filter !== 'all' && quiz.difficulty !== state.filter) return false;
    if (state.search && !quiz.title.includes(state.search)) return false;
    return true;
}

function wireInteractions() {
    document.querySelectorAll('[data-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-filter]').forEach((b) => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            state.filter = btn.dataset.filter;
            renderQuizzes();
        });
    });

    const search = document.querySelector('[data-role="search"]');
    search?.addEventListener('input', (e) => {
        state.search = e.target.value.trim();
        renderQuizzes();
    });
}

function showEmpty(msg) {
    const grid = document.getElementById('quizzes');
    if (grid) grid.innerHTML = `<div class="loading-placeholder">${msg}</div>`;
}

main();
