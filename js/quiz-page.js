/**
 * Entry point for quiz.html.
 * Reads ?id=&mode= from the URL, loads the quiz, wires engine + UI.
 */

import { QuizEngine } from './quiz-engine.js';
import { loadIndex, loadQuiz, loadAllQuizzes } from './quiz-loader.js';
import { applyTheme } from './theme.js';
import { getMode, prepareQuestions, composeFinalExam } from './modes.js';
import { Storage } from './storage.js';
import * as UI from './ui.js';

async function main() {
    const params = new URLSearchParams(location.search);
    const quizId = params.get('id');
    const modeId = params.get('mode') ?? 'practice';
    const mode = getMode(modeId);

    let index, quizMeta, quiz, questions;
    try {
        index = await loadIndex();

        if (modeId === 'final') {
            // Special path: compose a fresh exam from all lessons every run.
            const allQuizzes = await loadAllQuizzes(index);
            questions = composeFinalExam(allQuizzes);
            quiz = {
                quizId: 'final-exam',
                title: 'מבחן סופי — כל הקורס',
                color: index.themes?.signature ?? null,
                totalQuestions: questions.length,
                questions,
            };
            quizMeta = { id: 'final-exam', theme: 'signature' };
        } else {
            if (!quizId) return showError('לא צוין מזהה קוויז. חזור לדשבורד.');
            quizMeta = index.quizzes.find((q) => q.id === quizId);
            if (!quizMeta) throw new Error(`Quiz ${quizId} not in registry`);
            quiz = await loadQuiz(quizMeta.file);
            try {
                questions = prepareQuestions(quiz, modeId);
            } catch (err) {
                if (err.message === 'NO_WRONG_QUESTIONS') {
                    return showError('אין לך עדיין שאלות שגויות בקוויז הזה. התחל בתרגול רגיל.');
                }
                throw err;
            }
        }
    } catch (err) {
        console.error(err);
        return showError('טעינה נכשלה: ' + err.message);
    }

    applyTheme(quizMeta.theme, quiz.color);

    const engine = new QuizEngine(questions, {
        mode: modeId,
        timerSec: mode.timerSec,
        allowReview: true,
    });

    UI.setHeader({ quizTitle: quiz.title, modeLabel: mode.label, modeId });
    wireEventHandlers(engine, quiz, quizMeta, mode);
    renderCurrent(engine, quiz, mode);

    if (mode.timerSec) engine.startTimer();

    // Engine events → UI updates
    engine.on('question-changed', () => renderCurrent(engine, quiz, mode));
    engine.on('answer-submitted', ({ index, question }) => {
        UI.updateProgress(index, questions.length);
        if (mode.showExplanationAfterEach) {
            const card = document.querySelector('[data-role="question"]');
            if (card) UI.showExplanationPanel(card, question, engine.state.answers[index]);
        }
    });
    engine.on('timer-tick', ({ remainingSec }) => UI.updateTimer(remainingSec, mode.timerSec));
    engine.on('quiz-completed', ({ results }) => handleComplete(results, quiz, engine));
    engine.on('timer-expired', () => {});
}

function renderCurrent(engine, quiz, mode) {
    const { question, index, total, answer } = engine.current();
    const isFlagged = Storage.getFlaggedIds(quiz.quizId).includes(question.id);
    UI.renderQuestion(
        { question, index, total, answer },
        {
            mode: mode.id,
            showExplanation: !!answer && mode.showExplanationAfterEach,
            isFlagged,
            hideTopicAndSource: !!mode.hideTopicAndSource,
        },
    );
    UI.updateProgress(index, total);
}

function wireEventHandlers(engine, quiz, quizMeta, mode) {
    const stage = document.querySelector('[data-role="quiz-stage"]');

    // Option click
    stage.addEventListener('click', (e) => {
        const optionEl = e.target.closest('[data-role="option"]');
        if (optionEl && mode.id !== 'flashcards') {
            const idx = Number(optionEl.dataset.optionIndex);
            handleAnswer(engine, quiz, mode, idx);
            return;
        }

        const flagBtn = e.target.closest('[data-role="flag"]');
        if (flagBtn) {
            const q = engine.current().question;
            const isFlagged = Storage.toggleFlag(quiz.quizId, q.id);
            flagBtn.classList.toggle('is-flagged', isFlagged);
            return;
        }

        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            if (action === 'next') handleNext(engine);
            if (action === 'prev') engine.prev();
        }
    });

    // Results panel buttons
    const resultsPanel = document.querySelector('[data-role="results"]');
    resultsPanel.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'retry') location.reload();
        if (btn.dataset.action === 'retry-wrong') {
            const url = new URL(location.href);
            url.searchParams.set('mode', 'wrong');
            location.href = url.toString();
        }
    });
}

function handleAnswer(engine, quiz, mode, selectedIndex) {
    const { question, answer } = engine.current();

    // In lock-after-answer modes (practice/wrong/quick10) the first click is
    // final — re-clicks do nothing. In exam mode we allow the user to change
    // their mind until they navigate forward.
    if (answer && mode.showExplanationAfterEach) return;

    // Don't re-submit the same option a second time (no-op click).
    if (answer && answer.selectedIndex === selectedIndex) return;

    engine.submit(selectedIndex);
    const updatedAnswer = engine.current().answer;
    const card = document.querySelector('[data-role="question"]');
    if (card) {
        UI.applyAnswerReveal(card, question, updatedAnswer, {
            showExplanation: mode.showExplanationAfterEach,
            lockClicks: mode.showExplanationAfterEach,
        });
    }
}

function handleNext(engine) {
    const moved = engine.next();
    if (!moved) engine.complete();
}

function handleComplete(results, quiz, engine) {
    Storage.addResult(quiz.quizId, {
        score: results.correct,
        total: results.total,
        percent: results.percent,
        mode: results.mode,
    });

    if (quiz.quizId === 'final-exam') {
        // Final exam composes fresh questions each run — there's no stable
        // "wrong pool" to maintain. Also hide the retry-wrong button since
        // it wouldn't be able to reproduce the same questions anyway.
        const retryWrong = document.querySelector('[data-action="retry-wrong"]');
        if (retryWrong) retryWrong.hidden = true;
    } else {
        // Update the wrong-answer pool: add questions answered wrong this
        // session, remove ones that were answered correctly.
        const correctIds = [];
        const wrongIds = [];
        results.answers.forEach((answer, i) => {
            const q = engine.questions[i];
            if (!q) return;
            if (answer?.correct) correctIds.push(q.id);
            else wrongIds.push(q.id);
        });
        if (wrongIds.length > 0) Storage.addWrongIds(quiz.quizId, wrongIds);
        if (correctIds.length > 0) Storage.removeWrongIds(quiz.quizId, correctIds);
    }

    document.querySelector('[data-role="progress-fill"]').style.width = '100%';
    UI.renderResults(results, { quizTitle: quiz.title });
}

function showError(msg) {
    const stage = document.querySelector('[data-role="quiz-stage"]');
    stage.innerHTML = `
        <div class="question-card" style="text-align: center;">
            <h2>שגיאה</h2>
            <p>${msg}</p>
            <a class="btn btn-primary" href="./" style="margin-top: 1rem;">חזרה לדשבורד</a>
        </div>
    `;
}

main();
