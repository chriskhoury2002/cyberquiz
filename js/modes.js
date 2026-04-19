/**
 * Quiz modes — defines how questions are selected, ordered, and timed.
 * Each mode produces a list of questions for the engine to run on.
 */

import { Storage } from './storage.js';

export const MODES = {
    practice: {
        id: 'practice',
        label: 'תרגול',
        description: 'משוב מיידי אחרי כל שאלה, מסבירים גלויים',
        timerSec: null,
        showExplanationAfterEach: true,
        shuffleQuestions: false,
    },
    exam: {
        id: 'exam',
        label: 'מבחן',
        description: 'טיימר פעיל, מסבירים מוצגים רק בסוף',
        timerSec: 1800,  // 30 min default
        showExplanationAfterEach: false,
        shuffleQuestions: true,
    },
    wrong: {
        id: 'wrong',
        label: 'שאלות שטעיתי',
        description: 'חוזר רק על שאלות שהשבת עליהן לא נכון בעבר',
        timerSec: null,
        showExplanationAfterEach: true,
        shuffleQuestions: true,
    },
    flashcards: {
        id: 'flashcards',
        label: 'כרטיסי זיכרון',
        description: 'דפדוף חופשי, הפוך את הכרטיס לראות את התשובה',
        timerSec: null,
        showExplanationAfterEach: true,
        shuffleQuestions: false,
    },
    quick10: {
        id: 'quick10',
        label: 'מהיר (10 שאלות)',
        description: '10 שאלות אקראיות לסקירה מהירה',
        timerSec: null,
        showExplanationAfterEach: true,
        shuffleQuestions: true,
    },
};

export function getMode(modeId) {
    return MODES[modeId] ?? MODES.practice;
}

/**
 * Given a loaded quiz and a mode, return the ordered list of questions
 * to run the engine on. Pure function of inputs + storage.
 */
export function prepareQuestions(quiz, modeId) {
    const mode = getMode(modeId);
    let pool = [...quiz.questions];

    if (modeId === 'wrong') {
        const wrongIds = new Set(Storage.getWrongIds(quiz.quizId));
        pool = pool.filter((q) => wrongIds.has(q.id));
        if (pool.length === 0) {
            // Fall back gracefully — no wrong pool yet
            throw new Error('NO_WRONG_QUESTIONS');
        }
    }

    if (modeId === 'quick10') {
        pool = shuffle(pool).slice(0, Math.min(10, pool.length));
    } else if (mode.shuffleQuestions) {
        pool = shuffle(pool);
    }

    return pool;
}

function shuffle(arr) {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}
