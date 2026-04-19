/**
 * LocalStorage helpers for Cyber Quiz.
 * All keys are prefixed with "cq:" to avoid collisions.
 * Data is JSON-encoded. On quota or serialization failure we log and
 * return defaults rather than throwing — the user shouldn't see a broken UI
 * because their browser is full.
 */

const PREFIX = 'cq:';
const MAX_WRONG_POOL = 200;      // cap per quiz so it can't grow unbounded
const MAX_HISTORY = 50;           // cap history entries per quiz

function safeGet(key, fallback) {
    try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw == null ? fallback : JSON.parse(raw);
    } catch (err) {
        console.warn(`[storage] failed to read ${key}:`, err);
        return fallback;
    }
}

function safeSet(key, value) {
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
    } catch (err) {
        console.warn(`[storage] failed to write ${key}:`, err);
        return false;
    }
}

export const Storage = {
    // ==================== History ====================
    /** History entries: [{ score, total, percent, mode, timestamp }] newest-first */
    getHistory(quizId) {
        return safeGet(`history:${quizId}`, []);
    },

    addResult(quizId, result) {
        const history = this.getHistory(quizId);
        history.unshift({ ...result, timestamp: Date.now() });
        if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
        return safeSet(`history:${quizId}`, history);
    },

    getAllHistory() {
        const all = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith(PREFIX + 'history:')) continue;
            const quizId = key.slice((PREFIX + 'history:').length);
            all[quizId] = safeGet(`history:${quizId}`, []);
        }
        return all;
    },

    // ==================== Wrong-answer pool ====================
    /** Array of question IDs the user got wrong. Used by "Wrong-only" mode. */
    getWrongIds(quizId) {
        return safeGet(`wrong:${quizId}`, []);
    },

    addWrongIds(quizId, ids) {
        const existing = new Set(this.getWrongIds(quizId));
        ids.forEach((id) => existing.add(id));
        const arr = Array.from(existing).slice(-MAX_WRONG_POOL);
        return safeSet(`wrong:${quizId}`, arr);
    },

    removeWrongIds(quizId, ids) {
        const remove = new Set(ids);
        const filtered = this.getWrongIds(quizId).filter((id) => !remove.has(id));
        return safeSet(`wrong:${quizId}`, filtered);
    },

    // ==================== Flags ====================
    getFlaggedIds(quizId) {
        return safeGet(`flags:${quizId}`, []);
    },

    toggleFlag(quizId, qId) {
        const set = new Set(this.getFlaggedIds(quizId));
        if (set.has(qId)) set.delete(qId);
        else set.add(qId);
        safeSet(`flags:${quizId}`, Array.from(set));
        return set.has(qId);
    },

    // ==================== Settings ====================
    getSettings() {
        return safeGet('settings', {
            examDurationSec: 1800,      // 30 min default for Exam mode
            showExplanationsAfterEach: true,
            shuffleOptions: true,
        });
    },

    saveSettings(patch) {
        return safeSet('settings', { ...this.getSettings(), ...patch });
    },
};
