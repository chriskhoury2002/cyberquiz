/**
 * UI rendering helpers for the quiz runner page.
 * All functions are pure DOM manipulation — they don't own state,
 * they're called by quiz-page.js in response to engine events.
 */

const OPTION_LETTERS = ['א', 'ב', 'ג', 'ד'];

export function renderQuestion({ question, index, total, answer }, options = {}) {
    const { mode = 'practice', showExplanation = false, isFlagged = false } = options;

    const stage = document.querySelector('[data-role="quiz-stage"]');
    stage.innerHTML = '';

    if (mode === 'flashcards') {
        stage.appendChild(buildFlashcard(question, index, total, isFlagged));
        return;
    }

    const tmpl = document.getElementById('question-template');
    const card = tmpl.content.firstElementChild.cloneNode(true);

    card.querySelector('[data-role="topic"]').textContent = question.topic || 'כללי';
    const difficulty = card.querySelector('[data-role="difficulty"]');
    difficulty.textContent = translateDifficulty(question.difficulty);
    difficulty.dataset.difficulty = question.difficulty || '';
    card.querySelector('[data-role="question-text"]').textContent = question.question;

    const flagBtn = card.querySelector('[data-role="flag"]');
    if (isFlagged) flagBtn.classList.add('is-flagged');

    const optsList = card.querySelector('[data-role="options"]');
    const optTmpl = document.getElementById('option-template');
    question.options.forEach((text, i) => {
        const li = optTmpl.content.firstElementChild.cloneNode(true);
        li.querySelector('[data-role="option-letter"]').textContent = OPTION_LETTERS[i] || String(i + 1);
        li.querySelector('[data-role="option-text"]').textContent = text;
        li.dataset.optionIndex = String(i);
        optsList.appendChild(li);
    });

    // Previously-answered rendering (happens when navigating back)
    if (answer) {
        applyAnswerReveal(card, question, answer, {
            showExplanation,
            lockClicks: showExplanation,
        });
    }

    updatePrevNextButtons(card, index, total);

    stage.appendChild(card);
    return card;
}

function buildFlashcard(question, index, total, isFlagged) {
    const wrapper = document.createElement('div');
    wrapper.className = 'question-card';
    wrapper.innerHTML = `
        <div class="flashcard-inner" data-role="flashcard-inner">
            <div class="flashcard-face flashcard-front">
                <span class="question-topic">${escapeHtml(question.topic || 'כללי')}</span>
                <h2 class="question-text">${escapeHtml(question.question)}</h2>
                <span class="flashcard-hint">לחץ לראות את התשובה ↺</span>
            </div>
            <div class="flashcard-face flashcard-back">
                <div class="explanation-verdict" data-verdict="correct">תשובה נכונה: ${escapeHtml(OPTION_LETTERS[question.correctIndex])} — ${escapeHtml(question.options[question.correctIndex])}</div>
                <p class="explanation-text">${escapeHtml(question.explanation)}</p>
                <p class="explanation-source">מקור: ${escapeHtml(question.source)}</p>
                <span class="flashcard-hint">לחץ לחזור ↺</span>
            </div>
        </div>
        <footer class="question-card-footer">
            <button class="btn btn-ghost" data-action="prev">הקודמת</button>
            <button class="btn btn-primary" data-action="next">הבאה ←</button>
        </footer>
    `;
    const inner = wrapper.querySelector('[data-role="flashcard-inner"]');
    wrapper.addEventListener('click', (e) => {
        // Flip on card click (but not on prev/next)
        if (e.target.closest('[data-action]')) return;
        inner.classList.toggle('is-flipped');
    });
    const footer = wrapper.querySelector('.question-card-footer');
    updatePrevNextButtons(footer, index, total);
    return wrapper;
}

function updatePrevNextButtons(container, index, total) {
    const prev = container.querySelector('[data-action="prev"]');
    const next = container.querySelector('[data-action="next"]');
    if (prev) prev.disabled = index === 0;
    if (next) next.textContent = index === total - 1 ? 'סיום ✓' : 'הבאה ←';
}

/**
 * Apply visual feedback for a submitted answer.
 *
 * `lockClicks` controls whether options become disabled after answering.
 * In modes that show the explanation right away (practice/wrong/quick10)
 * we lock — there's no point letting the user "change" an answer they
 * already know is right/wrong. In exam mode we leave them open so the
 * user can change their mind until they hit Next.
 */
export function applyAnswerReveal(card, question, answer, opts = {}) {
    // Backward-compat: old callers passed `showExplanation` as a bool.
    if (typeof opts === 'boolean') opts = { showExplanation: opts, lockClicks: opts };
    const { showExplanation = false, lockClicks = true } = opts;

    const options = card.querySelectorAll('[data-role="option"]');
    const list = card.querySelector('[data-role="options"]');

    // Clear any prior selection/correctness classes — needed when the user
    // re-clicks a different option in exam mode.
    options.forEach((opt) => {
        opt.classList.remove('is-selected', 'is-correct', 'is-incorrect');
    });

    if (lockClicks) list?.classList.add('is-locked');
    else list?.classList.remove('is-locked');

    options.forEach((opt) => {
        const idx = Number(opt.dataset.optionIndex);
        const btn = opt.querySelector('.option-btn');
        btn.disabled = !!lockClicks;

        if (idx === answer.selectedIndex) opt.classList.add('is-selected');

        // Correctness is only revealed when we're also locking — otherwise
        // revealing the right answer defeats the purpose of exam mode.
        if (lockClicks) {
            if (idx === question.correctIndex) opt.classList.add('is-correct');
            if (idx === answer.selectedIndex && !answer.correct) opt.classList.add('is-incorrect');
        }
    });

    if (showExplanation) {
        showExplanationPanel(card, question, answer);
    }
}

export function showExplanationPanel(card, question, answer) {
    const panel = card.querySelector('[data-role="explanation"]');
    if (!panel) return;
    const verdict = card.querySelector('[data-role="verdict"]');
    const text = card.querySelector('[data-role="explanation-text"]');
    const src = card.querySelector('[data-role="source"]');
    verdict.textContent = answer.correct ? 'תשובה נכונה!' : 'תשובה שגויה';
    verdict.dataset.verdict = answer.correct ? 'correct' : 'incorrect';
    text.textContent = question.explanation;
    src.textContent = `מקור: ${question.source}`;
    panel.hidden = false;
}

// ==================== Progress, counter, timer ====================
export function updateProgress(index, total) {
    const fill = document.querySelector('[data-role="progress-fill"]');
    const counter = document.querySelector('[data-role="counter"]');
    if (fill) fill.style.width = `${((index + 1) / total) * 100}%`;
    if (counter) counter.textContent = `${index + 1} / ${total}`;
}

export function updateTimer(remainingSec, examDurationSec) {
    const timer = document.querySelector('[data-role="timer"]');
    if (!timer) return;
    timer.hidden = false;
    timer.textContent = formatTime(remainingSec);
    const fraction = examDurationSec > 0 ? remainingSec / examDurationSec : 1;
    timer.classList.toggle('is-low', fraction < 0.1);
}

export function setHeader({ quizTitle, modeLabel, modeId }) {
    document.querySelector('[data-role="quiz-title"]').textContent = quizTitle;
    document.querySelector('[data-role="mode-label"]').textContent = modeLabel;
    document.body.className = document.body.className.replace(/\bmode-\S+/g, '').trim();
    document.body.classList.add(`mode-${modeId}`);
}

// ==================== Results ====================
export function renderResults(results, { quizTitle }) {
    const panel = document.querySelector('[data-role="results"]');
    const stage = document.querySelector('[data-role="quiz-stage"]');
    if (stage) stage.innerHTML = '';

    document.querySelector('[data-role="results-score"]').textContent = `${results.correct} / ${results.total}`;
    document.querySelector('[data-role="results-percent"]').textContent = `${results.percent}%`;
    document.querySelector('[data-role="results-summary"]').textContent = buildSummary(results, quizTitle);

    const breakdown = document.querySelector('[data-role="results-breakdown"]');
    breakdown.innerHTML = '';
    Object.entries(results.breakdown).forEach(([topic, stats]) => {
        const div = document.createElement('div');
        div.className = 'breakdown-row';
        div.innerHTML = `
            <div class="breakdown-topic">${escapeHtml(topic)}</div>
            <div class="breakdown-score">${stats.correct} / ${stats.total}</div>
        `;
        breakdown.appendChild(div);
    });

    const wrongList = document.querySelector('[data-role="wrong-list"]');
    wrongList.innerHTML = '';
    if (results.wrongQuestions.length === 0) {
        wrongList.innerHTML = '<p style="color: var(--color-success); padding: 1rem 0;">כל הכבוד — לא טעית באף שאלה!</p>';
    } else {
        results.wrongQuestions.forEach(({ question, answer }) => {
            const item = document.createElement('div');
            item.className = 'wrong-item';
            const yours = answer.skipped
                ? '<em>דילגת על השאלה</em>'
                : escapeHtml(question.options[answer.selectedIndex] ?? '—');
            item.innerHTML = `
                <div class="wrong-q">${escapeHtml(question.question)}</div>
                <div class="wrong-a">
                    <span class="yours">תשובתך: ${yours}</span>
                    <span class="correct">התשובה הנכונה: ${escapeHtml(question.options[question.correctIndex])}</span>
                </div>
                <div class="wrong-explanation">${escapeHtml(question.explanation)} <em>(${escapeHtml(question.source)})</em></div>
            `;
            wrongList.appendChild(item);
        });
    }

    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth' });
}

function buildSummary(results, quizTitle) {
    const minutes = Math.round(results.durationMs / 60000);
    if (results.percent >= 90) return `מצוין! ציון ${results.percent}% ב"${quizTitle}". סיימת ב-${minutes} דקות.`;
    if (results.percent >= 75) return `יפה. ציון ${results.percent}%. יש עדיין פינות לשפר — כדאי לסקור את השאלות השגויות.`;
    if (results.percent >= 60) return `ציון ${results.percent}%. כדאי לעבור שוב על החומר ולחזור במצב "רק שאלות שטעיתי".`;
    return `ציון ${results.percent}%. שווה לחזור למצגת ולסקור את הנושאים לפני ניסיון נוסף.`;
}

// ==================== Helpers ====================
function translateDifficulty(d) {
    return { easy: 'קל', medium: 'בינוני', hard: 'קשה' }[d] || d || '';
}

function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
}

function escapeHtml(s) {
    return String(s ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
