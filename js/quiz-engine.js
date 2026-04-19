/**
 * QuizEngine — the headless state machine for running a quiz.
 * No DOM code here. Emits events; UI layer subscribes.
 *
 * Events:
 *   'question-changed' → { index, question, total }
 *   'answer-submitted' → { index, question, selectedIndex, correct }
 *   'quiz-completed'   → { results }
 *   'timer-tick'       → { remainingSec }
 *   'timer-expired'    → {}
 */

export class QuizEngine extends EventTarget {
    /**
     * @param {Array} questions   — ordered questions already prepared by mode logic
     * @param {Object} options    — { mode, timerSec, allowReview }
     */
    constructor(questions, options = {}) {
        super();
        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('QuizEngine requires a non-empty questions array');
        }
        this.questions = questions;
        this.mode = options.mode ?? 'practice';
        this.timerSec = options.timerSec ?? null;
        this.allowReview = options.allowReview ?? true;

        this.state = {
            currentIndex: 0,
            answers: new Array(questions.length).fill(null),
            startedAt: Date.now(),
            completedAt: null,
        };

        this._timerInterval = null;
        this._timerRemaining = this.timerSec;
    }

    // ==================== Navigation ====================
    current() {
        return {
            index: this.state.currentIndex,
            total: this.questions.length,
            question: this.questions[this.state.currentIndex],
            answer: this.state.answers[this.state.currentIndex],
        };
    }

    /** Move forward. Returns true if moved, false if already at last. */
    next() {
        if (this.state.currentIndex >= this.questions.length - 1) return false;
        this.state.currentIndex++;
        this._dispatch('question-changed', this.current());
        return true;
    }

    prev() {
        if (this.state.currentIndex <= 0) return false;
        this.state.currentIndex--;
        this._dispatch('question-changed', this.current());
        return true;
    }

    /** Jump to a specific index (used by results screen "review" links). */
    goTo(index) {
        if (index < 0 || index >= this.questions.length) return false;
        this.state.currentIndex = index;
        this._dispatch('question-changed', this.current());
        return true;
    }

    // ==================== Answering ====================
    // Always accepts new submissions; callers decide whether to allow re-clicks.
    // Modes that lock after answering (practice/wrong/quick10) enforce that
    // at the UI layer. Exam-style modes let the user change their mind until
    // they navigate forward.
    submit(selectedIndex) {
        const idx = this.state.currentIndex;
        const q = this.questions[idx];
        const correct = selectedIndex === q.correctIndex;
        const answer = {
            selectedIndex,
            correct,
            questionId: q.id,
            correctIndex: q.correctIndex,
            submittedAt: Date.now(),
        };
        this.state.answers[idx] = answer;
        this._dispatch('answer-submitted', {
            index: idx,
            question: q,
            selectedIndex,
            correct,
        });
        return answer;
    }

    /** Mark current as skipped without selecting an answer. */
    skip() {
        const idx = this.state.currentIndex;
        if (this.state.answers[idx] != null) return;
        this.state.answers[idx] = { skipped: true, correct: false, questionId: this.questions[idx].id };
    }

    // ==================== Completion ====================
    isComplete() {
        return this.state.answers.every((a) => a != null);
    }

    complete() {
        if (this.state.completedAt != null) return;
        this.state.completedAt = Date.now();
        this._stopTimer();
        this._dispatch('quiz-completed', { results: this.getResults() });
    }

    getResults() {
        const total = this.questions.length;
        const answered = this.state.answers.filter((a) => a && !a.skipped).length;
        const correct = this.state.answers.filter((a) => a?.correct).length;
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

        const breakdown = {};
        this.questions.forEach((q, i) => {
            const topic = q.topic || 'כללי';
            if (!breakdown[topic]) breakdown[topic] = { total: 0, correct: 0 };
            breakdown[topic].total++;
            if (this.state.answers[i]?.correct) breakdown[topic].correct++;
        });

        const wrongQuestions = this.questions
            .map((q, i) => ({ question: q, answer: this.state.answers[i], index: i }))
            .filter((r) => r.answer && !r.answer.correct);

        return {
            total,
            answered,
            correct,
            percent,
            mode: this.mode,
            durationMs: (this.state.completedAt ?? Date.now()) - this.state.startedAt,
            breakdown,
            wrongQuestions,
            answers: this.state.answers,
        };
    }

    // ==================== Timer ====================
    startTimer() {
        if (!this.timerSec || this._timerInterval) return;
        this._timerInterval = setInterval(() => {
            this._timerRemaining--;
            this._dispatch('timer-tick', { remainingSec: this._timerRemaining });
            if (this._timerRemaining <= 0) {
                this._stopTimer();
                this._dispatch('timer-expired', {});
                this.complete();
            }
        }, 1000);
    }

    _stopTimer() {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    }

    // ==================== Event helper ====================
    _dispatch(type, detail) {
        this.dispatchEvent(new CustomEvent(type, { detail }));
    }

    on(type, handler) {
        const wrapped = (ev) => handler(ev.detail);
        this.addEventListener(type, wrapped);
        return () => this.removeEventListener(type, wrapped);
    }
}
