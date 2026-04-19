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

    renderStats();
    renderFinalExamCard();
    renderQuizzes();
    wireInteractions();
    wireGlobalMenuClose();
    wireResetButton();
}

/** Refresh every widget after a wipe. Lets the user see the cleared state immediately. */
function refreshEverything() {
    renderStats();
    renderFinalExamCard();
    renderQuizzes();
}

/**
 * Wire the single "reset progress" button in the header. Opens the
 * confirmation modal — actual wipe only happens if the user confirms.
 */
function wireResetButton() {
    const btn = document.querySelector('[data-role="header-reset"]');
    if (!btn) return;
    btn.addEventListener('click', () => openConfirmModal());
}

/* =============== Confirm modal (reset progress) =============== */

const confirmModal = document.querySelector('[data-role="confirm-modal"]');
const confirmForm = confirmModal?.querySelector('form');
const confirmCancelBtn = document.querySelector('[data-role="confirm-modal-cancel"]');
const confirmCloseBtn = document.querySelector('[data-role="confirm-modal-close"]');

function openConfirmModal() {
    if (!confirmModal) return;
    confirmModal.showModal();
}

function closeConfirmModal() {
    if (!confirmModal || !confirmModal.open) return;
    confirmModal.close();
}

function performReset() {
    const removed = Storage.clearProfile();
    refreshEverything();
    closeConfirmModal();
    showToast(`נוקו ${removed} רשומות — ההתקדמות אופסה`, 'danger');
}

if (confirmForm) {
    confirmForm.addEventListener('submit', (e) => {
        e.preventDefault();
        performReset();
    });
}
confirmCancelBtn?.addEventListener('click', closeConfirmModal);
confirmCloseBtn?.addEventListener('click', closeConfirmModal);
// Click on the backdrop (outside the card) closes too.
confirmModal?.addEventListener('click', (e) => {
    if (e.target === confirmModal) closeConfirmModal();
});

/* =============== Toast =============== */
let toastTimer = null;
function showToast(message, variant = 'default') {
    const el = document.querySelector('[data-role="toast"]');
    if (!el) return;
    el.textContent = message;
    el.setAttribute('data-variant', variant);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

/* =============== Final exam card =============== */
function renderFinalExamCard() {
    const startBtn = document.querySelector('[data-role="start-final"]');
    if (startBtn && !startBtn.dataset.wired) {
        startBtn.dataset.wired = '1';
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

/* =============== Stats =============== */
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

/* =============== Quiz grid =============== */
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
