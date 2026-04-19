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
    final: {
        id: 'final',
        label: 'מבחן סופי',
        description: '40 שאלות מכל הקורס — רנדומלי ומעורב',
        timerSec: 3600,                  // 60 min
        showExplanationAfterEach: false, // exam-style: no reveals mid-test
        shuffleQuestions: true,
        hideTopicAndSource: true,        // don't leak which lesson a Q is from
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

function sampleN(pool, n) {
    if (pool.length <= n) return [...pool];
    return shuffle(pool).slice(0, n);
}

/**
 * Compose a final exam by sampling questions from every lesson.
 * Default: 4 Qs per lesson, aiming for 1 easy / 2 medium / 1 hard.
 * If a lesson lacks a given difficulty, backfill from remaining Qs.
 * Every invocation returns a fresh, re-shuffled set — that's the whole
 * point: running the final twice gives completely different exams.
 */
export function composeFinalExam(allQuizzes, perLesson = 4) {
    const picked = [];
    const targets = { easy: 1, medium: 2, hard: 1 };

    allQuizzes.forEach((quiz) => {
        const byDiff = { easy: [], medium: [], hard: [] };
        quiz.questions.forEach((q) => {
            (byDiff[q.difficulty] ?? byDiff.medium).push(q);
        });

        const sampled = [];
        for (const [diff, n] of Object.entries(targets)) {
            sampled.push(...sampleN(byDiff[diff], n));
        }

        // Backfill if we didn't hit the target (small lesson / skewed difficulty)
        while (sampled.length < perLesson) {
            const remaining = quiz.questions.filter((q) => !sampled.includes(q));
            if (remaining.length === 0) break;
            sampled.push(remaining[Math.floor(Math.random() * remaining.length)]);
        }

        // Tag origin for the results breakdown — users want to know which
        // lesson they fumbled. The exam itself hides this via hideTopicAndSource.
        sampled.forEach((q) => {
            picked.push({
                ...q,
                _originQuizId: quiz.quizId,
                _originTitle: quiz.title,
                _originalTopic: q.topic,
                _originalSource: q.source,
            });
        });
    });

    // Renumber IDs + shuffle the full set so lesson-order isn't leaked.
    const shuffled = shuffle(picked);
    shuffled.forEach((q, i) => { q.id = i + 1; });
    return shuffled;
}
