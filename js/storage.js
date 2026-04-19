/**
 * LocalStorage helpers for Cyber Quiz — with per-user profiles.
 *
 * Privacy model:
 *  - All data lives in the browser's localStorage. Nothing is ever sent to
 *    a server — there is no server. Each browser/device is already isolated.
 *  - On top of that, a "profile" namespace lets multiple people on the same
 *    browser keep separate progress. Keys are stored as:
 *        cq:{profileId}:{name}     e.g. cq:chris:history:quiz-01-intro
 *    Switching profile changes the prefix, so every other call reads from
 *    a different bucket.
 *  - A one-time migration moves legacy unprefixed keys into the "default"
 *    profile so existing users don't lose their progress.
 */

const BASE = 'cq:';
const ACTIVE_KEY = BASE + '_active';
const MIGRATION_FLAG = BASE + '_migrated_v1';
const DEFAULT_PROFILE = 'default';
const MAX_WRONG_POOL = 200;
const MAX_HISTORY = 50;

function sanitizeProfileId(name) {
    return String(name || '')
        .trim()
        .slice(0, 24)
        .replace(/\s+/g, '-')
        .replace(/[^\w\u0590-\u05FF-]/g, '')
        || DEFAULT_PROFILE;
}

/** One-time migration: move legacy `cq:history:*` etc. under `cq:default:*`. */
function runMigration() {
    try {
        if (localStorage.getItem(MIGRATION_FLAG)) return;
        const RESERVED_SUFFIXES = new Set(['_active', '_migrated_v1']);
        const legacyKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k?.startsWith(BASE)) continue;
            const rest = k.slice(BASE.length);
            if (RESERVED_SUFFIXES.has(rest)) continue;
            // Already namespaced (contains profileId before its first colon)
            // Profile-namespaced keys look like `cq:<profile>:<suffix>`.
            // Legacy keys look like `cq:<suffix>` where suffix can also have colons.
            // Heuristic: legacy starts with one of the known suffix roots.
            const legacyPrefixes = ['history:', 'wrong:', 'flags:', 'settings'];
            if (legacyPrefixes.some((p) => rest === p || rest.startsWith(p))) {
                legacyKeys.push({ fullKey: k, rest });
            }
        }
        legacyKeys.forEach(({ fullKey, rest }) => {
            const val = localStorage.getItem(fullKey);
            if (val != null) {
                localStorage.setItem(BASE + DEFAULT_PROFILE + ':' + rest, val);
            }
            localStorage.removeItem(fullKey);
        });
        localStorage.setItem(MIGRATION_FLAG, '1');
    } catch (err) {
        console.warn('[storage] migration failed:', err);
    }
}
runMigration();

function getActiveProfile() {
    try {
        const active = localStorage.getItem(ACTIVE_KEY);
        if (active) return active;
        localStorage.setItem(ACTIVE_KEY, DEFAULT_PROFILE);
        return DEFAULT_PROFILE;
    } catch {
        return DEFAULT_PROFILE;
    }
}

function profileKey(suffix) {
    return BASE + getActiveProfile() + ':' + suffix;
}

function safeGet(suffix, fallback) {
    try {
        const raw = localStorage.getItem(profileKey(suffix));
        return raw == null ? fallback : JSON.parse(raw);
    } catch (err) {
        console.warn(`[storage] failed to read ${suffix}:`, err);
        return fallback;
    }
}

function safeSet(suffix, value) {
    try {
        localStorage.setItem(profileKey(suffix), JSON.stringify(value));
        return true;
    } catch (err) {
        console.warn(`[storage] failed to write ${suffix}:`, err);
        return false;
    }
}

export const Storage = {
    // ==================== Profiles ====================
    getActiveProfile,

    setActiveProfile(name) {
        const clean = sanitizeProfileId(name);
        localStorage.setItem(ACTIVE_KEY, clean);
        return clean;
    },

    /** Scan localStorage for all known profile IDs. */
    listProfiles() {
        const seen = new Set();
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k?.startsWith(BASE) || k === ACTIVE_KEY || k === MIGRATION_FLAG) continue;
            const m = k.slice(BASE.length).match(/^([^:]+):/);
            if (m) seen.add(m[1]);
        }
        // Always include active profile even if it has no data yet.
        seen.add(getActiveProfile());
        return Array.from(seen).sort();
    },

    /** Delete all data for a profile (default: the active one). */
    clearProfile(name) {
        const target = sanitizeProfileId(name || getActiveProfile());
        const keysToDelete = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith(BASE + target + ':')) keysToDelete.push(k);
        }
        keysToDelete.forEach((k) => localStorage.removeItem(k));
        return keysToDelete.length;
    },

    // ==================== History ====================
    getHistory(quizId) {
        return safeGet(`history:${quizId}`, []);
    },

    addResult(quizId, result) {
        const history = this.getHistory(quizId);
        history.unshift({ ...result, timestamp: Date.now() });
        if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
        return safeSet(`history:${quizId}`, history);
    },

    /** All-history scan limited to current profile. */
    getAllHistory() {
        const profile = getActiveProfile();
        const profilePrefix = BASE + profile + ':history:';
        const all = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key?.startsWith(profilePrefix)) continue;
            const quizId = key.slice(profilePrefix.length);
            all[quizId] = safeGet(`history:${quizId}`, []);
        }
        return all;
    },

    // ==================== Wrong-answer pool ====================
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
            examDurationSec: 1800,
            showExplanationsAfterEach: true,
            shuffleOptions: true,
        });
    },

    saveSettings(patch) {
        return safeSet('settings', { ...this.getSettings(), ...patch });
    },
};
