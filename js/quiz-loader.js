/**
 * Load and validate quiz data from JSON files.
 * Validation is strict on structure but forgiving on content — questions
 * that fail validation are dropped with a console warning, but the quiz still
 * loads so long as at least one question survives.
 */

const OPTION_COUNT = 4;  // per brief: always exactly 4 options

/** Fetch the top-level quiz registry. */
export async function loadIndex() {
    const res = await fetch('data/index.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load index.json: ${res.status}`);
    return res.json();
}

/** Fetch a single quiz file and validate it. Throws if the quiz has zero valid questions. */
export async function loadQuiz(file) {
    const res = await fetch(file, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
    const quiz = await res.json();

    const { validQuestions, errors } = validateQuiz(quiz);
    if (errors.length > 0) {
        console.warn(`[loader] ${errors.length} issues in ${file}:`, errors);
    }
    if (validQuestions.length === 0) {
        throw new Error(`Quiz ${file} has no valid questions`);
    }

    return { ...quiz, questions: validQuestions };
}

function validateQuiz(quiz) {
    const errors = [];
    const validQuestions = [];

    if (!quiz || typeof quiz !== 'object') {
        errors.push('Quiz is not an object');
        return { validQuestions, errors };
    }
    if (!Array.isArray(quiz.questions)) {
        errors.push('quiz.questions is not an array');
        return { validQuestions, errors };
    }

    quiz.questions.forEach((q, idx) => {
        const issues = validateQuestion(q, idx);
        if (issues.length === 0) {
            validQuestions.push(q);
        } else {
            errors.push(`Q${q?.id ?? idx}: ${issues.join(', ')}`);
        }
    });

    return { validQuestions, errors };
}

function validateQuestion(q, idx) {
    const issues = [];
    if (!q || typeof q !== 'object') { issues.push('not an object'); return issues; }
    if (q.id == null) issues.push('missing id');
    if (typeof q.question !== 'string' || q.question.trim().length === 0) issues.push('empty question');
    if (!Array.isArray(q.options) || q.options.length !== OPTION_COUNT) {
        issues.push(`must have exactly ${OPTION_COUNT} options`);
    } else {
        const clean = q.options.map((o) => typeof o === 'string' ? o.trim() : '');
        if (clean.some((o) => o.length === 0)) issues.push('empty option');
        if (new Set(clean).size !== clean.length) issues.push('duplicate options');
    }
    if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= OPTION_COUNT) {
        issues.push('correctIndex out of range');
    }
    if (typeof q.explanation !== 'string' || q.explanation.trim().length === 0) {
        issues.push('missing explanation');
    }
    if (typeof q.source !== 'string' || q.source.trim().length === 0) {
        issues.push('missing source');
    }
    return issues;
}
