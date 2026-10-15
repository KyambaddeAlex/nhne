/**
 * Core data models for the Stoic Daily application.
 * 
 * These TypeScript interfaces define the structure of data stored in
 * Firebase Firestore collections:
 * - users/{userId}/reflections
 * - users/{userId}/achievements
 * - quotes
 */

export const COLLECTIONS = {
    REFLECTIONS: 'reflections',
    ACHIEVEMENTS: 'achievements',
    QUOTES: 'quotes',
    USERS: 'users'
};

/**
 * Represents an item in the Dichotomy of Control.
 * - WithinControl: Actions, efforts, judgments, mindset (Epictetus)
 * - OutsideControl: Outcomes, others' opinions, external events
 */
export class DichotomyItem {
    constructor(data = {}) {
        this.id = data.id || DichotomyItem.generateId();
        this.text = data.text || '';
        this.category = data.category || 'outside';
        this.reframed = data.reframed || '';
        this.date = data.date || localDateString();
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    static generateId() {
        return 'dich_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    }

    static fromFirestore(doc) {
        return new DichotomyItem({
            id: doc.id,
            ...doc.data()
        });
    }

    toFirestore() {
        return {
            text: this.text,
            category: this.category,
            reframed: this.reframed,
            date: this.date,
            createdAt: this.createdAt
        };
    }
}

/**
 * Represents a daily reflection entry containing ambitions, achievements,
 * and lessons learned.
 */
export class DailyReflection {
    constructor(data = {}) {
        this.id = data.id || DailyReflection.generateId();
        this.date = data.date || localDateString();
        this.ambitions = Array.isArray(data.ambitions) ? data.ambitions : [];
        this.dichotomyItems = Array.isArray(data.dichotomyItems) ? data.dichotomyItems : [];
        this.achievements = Array.isArray(data.achievements) ? data.achievements : [];
        this.lessonsLearned = data.lessonsLearned || '';
        this.self_audit_well = data.self_audit_well || '';
        this.self_audit_short = data.self_audit_short || '';
        this.morningIntentions = data.morningIntentions || '';
        this.eveningReflection = data.eveningReflection || '';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    static generateId() {
        return 'ref_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    }

    static fromFirestore(doc) {
        return new DailyReflection({
            id: doc.id,
            ...doc.data()
        });
    }

    toFirestore() {
        return {
            date: this.date,
            ambitions: this.ambitions,
            dichotomyItems: this.dichotomyItems,
            achievements: this.achievements,
            lessonsLearned: this.lessonsLearned,
            self_audit_well: this.self_audit_well,
            self_audit_short: this.self_audit_short,
            morningIntentions: this.morningIntentions,
            eveningReflection: this.eveningReflection,
            createdAt: this.createdAt,
            updatedAt: new Date().toISOString()
        };
    }
}

/**
 * Represents an achievement or milestone.
 */
export class Achievement {
    constructor(data = {}) {
        this.id = data.id || Achievement.generateId();
        this.title = data.title || '';
        this.description = data.description || '';
        this.category = data.category || 'general';
        this.date = data.date || localDateString();
        this.stoicVirtue = data.stoicVirtue || '';
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    static generateId() {
        return 'ach_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    }

    static fromFirestore(doc) {
        return new Achievement({
            id: doc.id,
            ...doc.data()
        });
    }

    toFirestore() {
        return {
            title: this.title,
            description: this.description,
            category: this.category,
            date: this.date,
            stoicVirtue: this.stoicVirtue,
            createdAt: this.createdAt
        };
    }
}

/**
 * Represents a Stoic quote.
 */
export class StoicQuote {
    constructor(data = {}) {
        this.id = data.id;
        this.text = data.text || '';
        this.author = data.author || '';
        this.source = data.source || '';
        this.virtue = data.virtue || ''; // wisdom, courage, justice, temperance
        this.application = data.application || ''; // Practical application note
        this.dayOfYear = data.dayOfYear || 0; // 1-365 for daily rotation
    }

    static fromFirestore(doc) {
        return new StoicQuote({
            id: doc.id,
            ...doc.data()
        });
    }
}

/**
 * Represents a daily ambition with action steps grounded in Stoic virtues.
 */
export class Ambition {
    constructor(data = {}) {
        this.id = data.id || Ambition.generateId();
        this.title = data.title || '';
        this.description = data.description || '';
        this.virtue = data.virtue || 'wisdom'; // wisdom, courage, justice, temperance
        this.actionSteps = data.actionSteps || []; // Array of strings
        this.completed = data.completed || false;
        this.priority = data.priority || 'medium'; // high, medium, low
    }

    static generateId() {
        return 'amb_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    }
}

export function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export const VIRTUES = {
    WISDOM: 'wisdom',
    COURAGE: 'courage',
    JUSTICE: 'justice',
    TEMPERANCE: 'temperance'
};

export const VIRTUE_LABELS = {
    [VIRTUES.WISDOM]: 'Wisdom',
    [VIRTUES.COURAGE]: 'Courage',
    [VIRTUES.JUSTICE]: 'Justice',
    [VIRTUES.TEMPERANCE]: 'Temperance'
};

export const CATEGORIES = {
    WITHIN: 'within',
    OUTSIDE: 'outside'
};

export const CATEGORY_LABELS = {
    [CATEGORIES.WITHIN]: 'Within Control',
    [CATEGORIES.OUTSIDE]: 'Outside Control'
};