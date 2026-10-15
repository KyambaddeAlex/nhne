import { firebaseConfig } from './firebase-config.js';
import {
    Achievement,
    Ambition,
    DailyReflection,
    DichotomyItem,
    VIRTUE_LABELS,
    localDateString
} from './models.js';
import { DAILY_QUOTE_COUNT, dailyQuoteDocumentId, dailyQuoteForIndex, dailyQuoteIndex } from './quotes.js';

const dailyAmbitionPrompts = [
    { title: 'Give one important task my full attention', virtue: 'wisdom', steps: 'Choose one task, define the next step, silence distractions' },
    { title: 'Approach one difficult conversation with honesty and care', virtue: 'courage', steps: 'Name what matters, listen fully, speak respectfully' },
    { title: 'Make one useful contribution to someone else’s work', virtue: 'justice', steps: 'Ask what would help, offer a specific action, follow through' },
    { title: 'Practice restraint with my time and attention', virtue: 'temperance', steps: 'Choose a stopping point, take a deliberate break, return with focus' },
    { title: 'Learn from a mistake without letting it define the day', virtue: 'wisdom', steps: 'Identify what happened, choose one adjustment, try again' },
    { title: 'Take one step toward a task I have been avoiding', virtue: 'courage', steps: 'Break it into a small action, begin for 15 minutes, review progress' },
    { title: 'Treat one person with patience and fairness', virtue: 'justice', steps: 'Hear their perspective, check my assumptions, respond with respect' }
];

const configured = ['apiKey', 'authDomain', 'projectId', 'appId']
    .every((key) => typeof firebaseConfig[key] === 'string' && firebaseConfig[key].trim());
let auth = null;
let db = null;
let currentUser = null;
let reflection = null;
let achievements = [];
let profile = {};
let pendingProfilePhoto = null;
let pendingPhotoPreviewUrl = null;
let removeProfilePhoto = false;
let currentDate = localDateString();
let storageMode = 'firebase';

const root = document.querySelector('#app');

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function dateLabel(value) {
    return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });
}

function quoteForDate(date = currentDate) {
    return dailyQuoteForIndex(dailyQuoteIndex(new Date(`${date}T12:00:00`)));
}

function ambitionPromptForDate(date = new Date()) {
    const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    return dailyAmbitionPrompts[((day % dailyAmbitionPrompts.length) + dailyAmbitionPrompts.length) % dailyAmbitionPrompts.length];
}

function localKey(collection, id = '') {
    return `stoic-daily:${currentUser.uid}:${collection}:${id}`;
}

function getReflectionRef(date = currentDate) {
    return db.collection('users').doc(currentUser.uid).collection('reflections').doc(date);
}

function getAchievementsRef() {
    return db.collection('users').doc(currentUser.uid).collection('achievements');
}

function getProfileRef() {
    return db.collection('users').doc(currentUser.uid);
}

async function loadProfile() {
    if (storageMode === 'local') {
        return JSON.parse(localStorage.getItem(localKey('profile')) || '{}');
    }
    const snapshot = await getProfileRef().get();
    const data = snapshot.exists ? snapshot.data() : {};
    return { ...data, displayName: data.displayName || currentUser.displayName || '' };
}

async function saveProfile(nextProfile) {
    const updatedProfile = {
        displayName: nextProfile.displayName.trim(),
        age: nextProfile.age ? Number(nextProfile.age) : null,
        occupation: nextProfile.occupation.trim(),
        location: nextProfile.location.trim(),
        about: nextProfile.about.trim(),
        photoURL: Object.hasOwn(nextProfile, 'photoURL') ? nextProfile.photoURL : (profile.photoURL || null),
        photoPath: Object.hasOwn(nextProfile, 'photoPath') ? nextProfile.photoPath : (profile.photoPath || null),
        updatedAt: new Date().toISOString()
    };
    if (storageMode === 'local') {
        localStorage.setItem(localKey('profile'), JSON.stringify(updatedProfile));
    } else {
        await getProfileRef().set(updatedProfile, { merge: true });
    }
    profile = updatedProfile;
}

function allowedProfilePhotoUrl(url) {
    return typeof url === 'string'
        && (url.startsWith('https://firebasestorage.googleapis.com/')
            || url.startsWith('data:image/jpeg;base64,'));
}

function avatarMarkup(photoURL, fallback, className) {
    const safeUrl = allowedProfilePhotoUrl(photoURL) ? photoURL : '';
    return safeUrl
        ? `<img class="${className}" src="${escapeHtml(safeUrl)}" alt="Profile photo">`
        : `<span class="${className}">${escapeHtml(fallback)}</span>`;
}

function clearPendingPhotoPreview() {
    if (pendingPhotoPreviewUrl) {
        URL.revokeObjectURL(pendingPhotoPreviewUrl);
        pendingPhotoPreviewUrl = null;
    }
}

function createResizedProfilePhoto(file) {
    return new Promise((resolve, reject) => {
        const sourceUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(sourceUrl);
            let maxDimension = 512;
            let quality = 0.8;
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) {
                reject(new Error('Your browser could not prepare the profile photo.'));
                return;
            }
            const resize = () => {
                const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
                canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
                canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Your browser could not prepare the profile photo.'));
                    } else if (blob.size <= 400 * 1024) {
                        resolve(blob);
                    } else if (quality > 0.5) {
                        quality = Math.max(0.5, quality - 0.1);
                        resize();
                    } else if (maxDimension > 256) {
                        maxDimension = Math.floor(maxDimension * 0.75);
                        quality = 0.8;
                        resize();
                    } else {
                        reject(new Error('This photo could not be compressed enough to save within your free profile storage limit. Choose a smaller image.'));
                    }
                }, 'image/jpeg', quality);
            };
            resize();
        };
        image.onerror = () => {
            URL.revokeObjectURL(sourceUrl);
            reject(new Error('This photo could not be opened. Choose a JPEG, PNG, or WebP image.'));
        };
        image.src = sourceUrl;
    });
}

async function uploadProfilePhoto(file) {
    const imageBlob = await createResizedProfilePhoto(file);
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Could not read the selected photo.'));
        reader.readAsDataURL(imageBlob);
    });
}

async function loadReflection() {
    if (storageMode === 'local') {
        return new DailyReflection(JSON.parse(localStorage.getItem(localKey('reflections', currentDate)) || '{}'));
    }
    const snapshot = await getReflectionRef().get();
    return new DailyReflection({ id: snapshot.id, ...(snapshot.exists ? snapshot.data() : {}), date: currentDate });
}

async function loadAchievements() {
    if (storageMode === 'local') {
        const all = JSON.parse(localStorage.getItem(localKey('achievements')) || '[]');
        return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    }
    const snapshot = await getAchievementsRef().orderBy('date', 'desc').limit(8).get();
    return snapshot.docs.map((doc) => Achievement.fromFirestore(doc));
}

async function saveReflection(patch) {
    const updated = new DailyReflection({
        ...reflection,
        ...patch,
        date: currentDate,
        updatedAt: new Date().toISOString()
    });
    if (storageMode === 'local') {
        localStorage.setItem(localKey('reflections', currentDate), JSON.stringify(updated.toFirestore()));
    } else {
        await getReflectionRef().set(updated.toFirestore(), { merge: true });
    }
    reflection = updated;
    renderDashboard();
}

function showMessage(message, kind = 'error') {
    const profileOverlay = document.querySelector('#profile-overlay');
    const region = profileOverlay && !profileOverlay.hidden
        ? profileOverlay.querySelector('#profile-notice')
        : document.querySelector('#notice');
    if (!region) return;
    region.innerHTML = `<div class="notice notice-${kind}" role="status">${escapeHtml(message)}</div>`;
    window.setTimeout(() => {
        if (region.textContent === message) region.replaceChildren();
    }, 6000);
}

function describeError(error) {
    const messages = {
        'auth/email-already-in-use': 'That email is already registered. Try signing in instead.',
        'auth/invalid-credential': 'Email or password was not recognized.',
        'auth/invalid-email': 'Enter a valid email address.',
        'auth/weak-password': 'Choose a password with at least 6 characters.',
        'auth/operation-not-allowed': 'Email and password accounts are not enabled for this Firebase project. In Firebase Console, open Authentication → Sign-in method and enable Email/Password.',
        'auth/admin-restricted-operation': 'Email and password accounts are not enabled for this Firebase project. In Firebase Console, open Authentication → Sign-in method and enable Email/Password.',
        'auth/unauthorized-domain': 'This app address is not authorized for Firebase Authentication. Add its hostname under Firebase Console → Authentication → Settings → Authorized domains.',
        'auth/invalid-api-key': 'Firebase rejected the web API key. The key shown in Firebase Console is being rejected by Google APIs; ask the Google Cloud project owner to create or restore a valid web API key and allow the Identity Toolkit API.',
        'auth/configuration-not-found': 'Firebase Authentication is not configured for this project. Enable Authentication in the Firebase Console.',
        'auth/too-many-requests': 'Firebase temporarily blocked sign-in attempts. Wait a little and try again.',
        'auth/network-request-failed': 'Network error. Check your connection and try again.',
        'permission-denied': 'Firestore denied this request. Check your Firebase Security Rules.',
        'unavailable': 'Firebase is temporarily unavailable. Please try again.',
        'resource-exhausted': 'Firebase’s free Firestore quota has been reached. Try again after the daily quota resets.',
        'invalid-argument': 'Firebase could not save this profile. Try a smaller profile photo or shorter details.'
    };
    return messages[error.code] || `Request failed: ${error.message || 'Unknown error'}`;
}

async function runSafely(operation) {
    try {
        await operation();
    } catch (error) {
        console.error(error);
        showMessage(describeError(error));
    }
}

function renderAuth() {
    root.innerHTML = `
        <main class="auth-shell">
            <div class="auth-card">
                <div class="brand-mark">S</div>
                <p class="eyebrow">A PRACTICE, NOT A PERFORMANCE</p>
                <h1>Stoic Daily</h1>
                <p class="auth-intro">A quieter space to choose your direction, focus on what you can shape, and meet each day with intention.</p>
                <div id="notice"></div>
                ${configured ? `
                    <form id="auth-form" class="auth-form">
                        <label>Email<input type="email" name="email" autocomplete="email" required></label>
                        <label>Password<input type="password" name="password" autocomplete="current-password" minlength="6" required></label>
                        <button class="button button-primary button-full" type="submit">Sign in</button>
                        <button class="button button-quiet button-full" type="button" data-action="signup">Create an account</button>
                        <div class="auth-divider"><span>or</span></div>
                    </form>
                ` : `
                    <div class="welcome-note">
                        <span class="welcome-sigil" aria-hidden="true">✳</span>
                        <div>
                            <strong>Begin with what is yours to shape.</strong>
                            <p>Set one meaningful intention, give your attention to the next right action, and return later to reflect.</p>
                        </div>
                    </div>
                    <button class="button button-primary button-full" type="button" data-action="local">Begin today’s practice <span>↗</span></button>
                `}
                <p class="auth-footnote">${configured
        ? 'Your reflections are saved privately to your account.'
        : 'Your practice is saved in this browser on this device.'}</p>
            </div>
        </main>`;

    root.querySelector('#auth-form')?.addEventListener('submit', (event) => {
        event.preventDefault();
        runSafely(async () => {
            const data = new FormData(event.currentTarget);
            await auth.signInWithEmailAndPassword(data.get('email'), data.get('password'));
        });
    });
    root.querySelector('[data-action="signup"]')?.addEventListener('click', () => runSafely(async () => {
        const data = new FormData(root.querySelector('#auth-form'));
        if (!data.get('email') || !data.get('password')) {
            showMessage('Enter your email and password to create an account.');
            return;
        }
        await auth.createUserWithEmailAndPassword(data.get('email'), data.get('password'));
    }));
    root.querySelector('[data-action="local"]')?.addEventListener('click', () => {
        runSafely(async () => {
            storageMode = 'local';
            currentUser = { uid: 'local' };
            localStorage.setItem('stoic-daily:local-mode', 'true');
            await enterDashboard();
        });
    });
}

function renderDashboard() {
    const ambitionCards = reflection.ambitions.map((ambition) => `
        <article class="ambition-card ${ambition.completed ? 'is-complete' : ''}">
            <label class="check-wrap" aria-label="Mark ${escapeHtml(ambition.title)} complete">
                <input type="checkbox" data-action="toggle-ambition" data-id="${escapeHtml(ambition.id)}" ${ambition.completed ? 'checked' : ''}>
                <span class="custom-check"></span>
            </label>
            <div class="ambition-content">
                <div class="ambition-heading"><h3>${escapeHtml(ambition.title)}</h3><span class="priority priority-${escapeHtml(ambition.priority)}">${escapeHtml(ambition.priority)}</span></div>
                ${ambition.description ? `<p>${escapeHtml(ambition.description)}</p>` : ''}
                ${ambition.actionSteps?.length ? `<ul class="action-steps">${ambition.actionSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ul>` : ''}
                <span class="virtue-tag">${escapeHtml(VIRTUE_LABELS[ambition.virtue] || 'Wisdom')}</span>
            </div>
            <button class="icon-button" type="button" data-action="delete-ambition" data-id="${escapeHtml(ambition.id)}" aria-label="Delete ambition">×</button>
        </article>`).join('');
    const itemCards = reflection.dichotomyItems.map((item) => `
        <article class="control-item">
            <div class="control-item-copy">
                <span class="control-label ${item.category === 'within' ? 'label-within' : 'label-outside'}">${item.category === 'within' ? 'Within my control' : 'Outside my control'}</span>
                <p>${escapeHtml(item.text)}</p>
                ${item.reframed ? `<p class="reframe">My response: ${escapeHtml(item.reframed)}</p>` : ''}
            </div>
            <div class="item-actions">
                <button class="text-button" type="button" data-action="toggle-item" data-id="${escapeHtml(item.id)}">Move to ${item.category === 'within' ? 'outside' : 'within'}</button>
                <button class="icon-button" type="button" data-action="delete-item" data-id="${escapeHtml(item.id)}" aria-label="Delete item">×</button>
            </div>
        </article>`).join('');
    const achievementCards = achievements.map((achievement) => `
        <article class="achievement-card">
            <div class="achievement-icon">✳</div>
            <div><h3>${escapeHtml(achievement.title)}</h3><p>${escapeHtml(achievement.description || achievement.date)}</p></div>
            <span class="virtue-tag">${escapeHtml(VIRTUE_LABELS[achievement.stoicVirtue] || achievement.stoicVirtue || 'Milestone')}</span>
        </article>`).join('');
    const quote = quoteForDate();
    const ambitionPrompt = ambitionPromptForDate(new Date(`${currentDate}T12:00:00`));

    root.innerHTML = `
        <div class="app-shell">
            <aside class="sidebar">
                <a class="brand" href="#" aria-label="Stoic Daily home"><span class="brand-mark brand-small">S</span><span>Stoic Daily<small>DAILY PRACTICE</small></span></a>
                <div class="sidebar-date"><span class="eyebrow">SELECTED DAY</span><strong>${escapeHtml(dateLabel(currentDate))}</strong></div>
                <nav class="side-nav" aria-label="Sections">
                    <a href="#intention">01 <span>Morning intention</span></a>
                    <a href="#control">02 <span>What I can control</span></a>
                    <a href="#reflection">03 <span>Evening reflection</span></a>
                </nav>
                <div class="sidebar-bottom">
                    <span class="account-label">${storageMode === 'local' ? 'Saved on this device' : currentUser.isAnonymous ? 'Anonymous account' : escapeHtml(currentUser.email || 'Your account')}</span>
                    <button class="text-button" type="button" data-action="signout">${storageMode === 'local' ? 'Exit' : 'Sign out'}</button>
                </div>
            </aside>
            <main class="main-content">
                <header class="topbar">
                    <div><p class="eyebrow">A CLEARER WAY TO BEGIN</p><h1>Good morning.</h1></div>
                    <div class="topbar-actions">
                        <button class="button button-secondary profile-button" type="button" data-action="open-profile">${avatarMarkup(profile.photoURL, (profile.displayName || currentUser.email || 'S').charAt(0).toUpperCase(), 'profile-avatar')} My profile</button>
                        <div class="date-picker"><span>REFLECTION DATE</span><input type="date" id="reflection-date" value="${escapeHtml(currentDate)}" aria-label="Reflection date"></div>
                    </div>
                </header>
                <nav class="mobile-nav" aria-label="Jump to a daily practice">
                    <a href="#intention"><span>01</span> Plan</a>
                    <a href="#control"><span>02</span> Control</a>
                    <a href="#reflection"><span>03</span> Reflect</a>
                </nav>
                <div id="notice"></div>
                <section class="quote-card">
                    <span class="quote-mark">“</span>
                    <div><p class="eyebrow">TODAY’S STOIC THOUGHT</p><blockquote>${escapeHtml(quote.text)}</blockquote><p class="quote-source">${escapeHtml(quote.author)} <span>·</span> ${escapeHtml(quote.source)}</p><p class="quote-application">${escapeHtml(quote.application)}</p></div>
                    <span class="quote-sun">✳</span>
                </section>
                <section class="section-block" id="intention">
                    <div class="section-heading"><div><p class="eyebrow">01 / MORNING PRACTICE</p><h2>Set your intention</h2><p class="section-subtitle">Choose a few things worth your effort. Decide how you’ll meet them.</p></div><span class="section-index">01</span></div>
                    <div class="panel">
                        <div class="panel-heading"><div><h3>Ambitions for ${escapeHtml(dateLabel(currentDate))}</h3><p>This day has its own saved plan. Focus on actions you can own.</p></div><span class="soft-count">${reflection.ambitions.length} ${reflection.ambitions.length === 1 ? 'intention' : 'intentions'}</span></div>
                        <div class="daily-prompt"><div><span class="eyebrow">A PROMPT FOR TODAY</span><p>${escapeHtml(ambitionPrompt.title)}</p></div><button class="text-button" type="button" data-action="use-daily-prompt">Use prompt</button></div>
                        <form id="ambition-form" class="ambition-form">
                            <div class="form-row"><label class="field-grow">Priority ambition<input name="title" maxlength="120" placeholder="e.g. Write clean code for two focused hours" required></label><label>Virtue<select name="virtue">${Object.entries(VIRTUE_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label></div>
                            <label>Action steps <span class="label-hint">Separate steps with commas</span><input name="steps" maxlength="300" placeholder="Silence notifications, review the plan, take one short break"></label>
                            <div class="form-row form-row-end"><label>Priority<select name="priority"><option value="high">High</option><option value="medium" selected>Medium</option><option value="low">Low</option></select></label><button class="button button-primary" type="submit"><span>＋</span> Add ambition</button></div>
                        </form>
                        <div class="ambition-list">${ambitionCards || '<div class="empty-state">Start small. One deliberate action is enough to begin.</div>'}</div>
                        <label class="field-block intention-note">How do I want to show up today?<textarea id="morning-intentions" rows="2" maxlength="500" placeholder="A short reminder to yourself...">${escapeHtml(reflection.morningIntentions)}</textarea></label>
                        <button class="button button-secondary save-morning" type="button" data-action="save-morning">Save morning intention</button>
                    </div>
                </section>
                <section class="section-block" id="control">
                    <div class="section-heading"><div><p class="eyebrow">02 / THE DICHOTOMY OF CONTROL</p><h2>Sort what’s yours to carry</h2><p class="section-subtitle">Give your effort to your choices. Meet outcomes and other people with perspective.</p></div><span class="section-index">02</span></div>
                    <div class="control-grid">
                        <div class="panel control-panel">
                            <div class="panel-heading"><div><h3>Put a thought in its place</h3><p>What’s taking up your attention?</p></div><span class="control-sigil">↔</span></div>
                            <form id="control-form" class="control-form">
                                <label>Thought or concern<input name="text" maxlength="200" placeholder="e.g. Whether the deployment goes smoothly" required></label>
                                <div class="form-row"><label>Mostly<select name="category"><option value="outside">Outside my control</option><option value="within">Within my control</option></select></label><label class="field-grow">My useful response<input name="reframed" maxlength="180" placeholder="e.g. Test carefully and communicate clearly"></label></div>
                                <button class="button button-primary" type="submit">Add to reflection <span>↗</span></button>
                            </form>
                            <div class="control-list">${itemCards || '<div class="empty-state">A worry named clearly is easier to examine.</div>'}</div>
                        </div>
                        <aside class="virtues-card"><p class="eyebrow">A PRACTICE TO RETURN TO</p><h3>Focus on the<br>quality of your effort.</h3><p>You can choose your attention, your actions, and how you respond. Results are not a measure of your character.</p><div class="virtue-list">${Object.values(VIRTUE_LABELS).map((virtue, index) => `<div><span>0${index + 1}</span>${virtue}</div>`).join('')}</div></aside>
                    </div>
                </section>
                <section class="section-block" id="reflection">
                    <div class="section-heading"><div><p class="eyebrow">03 / EVENING PRACTICE</p><h2>Close the day with care</h2><p class="section-subtitle">Notice what went well, what you’d change, and what you learned.</p></div><span class="section-index">03</span></div>
                    <div class="evening-grid">
                        <div class="panel">
                            <div class="panel-heading"><div><h3>Honest self-audit</h3><p>Reflection is practice, not judgment.</p></div><span class="evening-icon">☾</span></div>
                            <label class="field-block">What did I do well?<textarea id="audit-well" rows="3" maxlength="1000" placeholder="A choice, effort, or small win worth recognizing...">${escapeHtml(reflection.self_audit_well)}</textarea></label>
                            <label class="field-block">Where did I fall short?<textarea id="audit-short" rows="3" maxlength="1000" placeholder="What would I try differently next time?">${escapeHtml(reflection.self_audit_short)}</textarea></label>
                            <label class="field-block">What did I learn today?<textarea id="lessons" rows="2" maxlength="1000" placeholder="One lesson to carry forward...">${escapeHtml(reflection.lessonsLearned)}</textarea></label>
                            <button class="button button-primary" type="button" data-action="save-evening">Save evening reflection <span>↗</span></button>
                        </div>
                        <div class="panel achievement-panel">
                            <div class="panel-heading"><div><h3>Small wins count</h3><p>Record the moments you showed up.</p></div><span class="achievement-star">✳</span></div>
                            <form id="achievement-form" class="achievement-form">
                                <label>Achievement<input name="title" maxlength="100" placeholder="e.g. Helped a teammate unblock their work" required></label>
                                <div class="form-row"><label class="field-grow">What made it meaningful?<input name="description" maxlength="180" placeholder="A quick note (optional)"></label><label>Virtue<select name="virtue"><option value="">Choose</option>${Object.entries(VIRTUE_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label></div>
                                <button class="button button-secondary" type="submit">Record a win <span>＋</span></button>
                            </form>
                            <div class="achievement-list">${achievementCards || '<div class="empty-state">Your wins will gather here, one day at a time.</div>'}</div>
                        </div>
                    </div>
                </section>
                <footer class="page-footer"><span>Slow progress is still progress.</span><span>STOIC DAILY <span class="footer-dot">·</span> ${new Date().getFullYear()}</span></footer>
            </main>
            <div class="profile-overlay" id="profile-overlay" hidden>
                <section class="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title">
                    <div class="profile-dialog-heading">
                        <div><p class="eyebrow">YOUR ACCOUNT</p><h2 id="profile-title">My profile</h2><p>Optional personal details, private to your account.</p></div>
                        <button type="button" class="icon-button profile-close" data-action="close-profile" aria-label="Close profile">×</button>
                    </div>
                    <div id="profile-notice" aria-live="polite"></div>
                    <form id="profile-form" class="profile-form">
                        <div class="photo-editor">
                            <div class="photo-editor-preview" id="profile-photo-preview">
                                ${avatarMarkup(profile.photoURL, (profile.displayName || currentUser.email || 'S').charAt(0).toUpperCase(), 'profile-photo')}
                            </div>
                            <div class="photo-editor-controls">
                                <label class="photo-file-label">Profile photo<input id="profile-photo-file" type="file" accept="image/jpeg,image/png,image/webp"></label>
                                <p>JPEG, PNG, or WebP · up to 5 MB. Compressed before saving.</p>
                                <button class="text-button" type="button" data-action="remove-photo">Remove photo</button>
                            </div>
                        </div>
                        <label>Display name<input name="displayName" maxlength="80" autocomplete="name" value="${escapeHtml(profile.displayName || '')}" placeholder="What should we call you?"></label>
                        <div class="form-row">
                            <label>Age<input name="age" type="number" min="1" max="120" inputmode="numeric" value="${escapeHtml(profile.age ?? '')}" placeholder="Optional"></label>
                            <label class="field-grow">Occupation<input name="occupation" maxlength="100" autocomplete="organization-title" value="${escapeHtml(profile.occupation || '')}" placeholder="e.g. Software developer"></label>
                        </div>
                        <label>Location<input name="location" maxlength="100" autocomplete="address-level2" value="${escapeHtml(profile.location || '')}" placeholder="City or region (optional)"></label>
                        <label>About me<textarea name="about" rows="4" maxlength="500" placeholder="A few words about yourself, your values, or what you're working toward...">${escapeHtml(profile.about || '')}</textarea></label>
                        <p class="profile-privacy-note">Your profile details and compressed photo are stored in your private Firebase profile.</p>
                        <div class="profile-form-actions"><button class="button button-quiet" type="button" data-action="close-profile">Cancel</button><button class="button button-primary profile-save-button" type="submit">Save profile</button></div>
                    </form>
                </section>
            </div>
        </div>`;

    bindDashboardEvents();
    loadCloudQuote().catch((error) => {
        console.error(error);
        showMessage('Could not load the shared quote; showing the daily local quote instead.', 'info');
    });
}

async function loadCloudQuote() {
    if (storageMode !== 'firebase') return;
    const selectedDate = new Date(`${currentDate}T12:00:00`);
    const id = dailyQuoteDocumentId(selectedDate);
    const snapshot = await db.collection('quotes').doc(id).get();
    if (!snapshot.exists) return;
    const quote = snapshot.data();
    const card = document.querySelector('.quote-card');
    if (!card || !quote.text || !quote.author || quote.text !== quoteForDate().text) return;
    card.querySelector('blockquote').textContent = quote.text;
    card.querySelector('.quote-source').textContent = `${quote.author}${quote.source ? ` · ${quote.source}` : ''}`;
    if (quote.application) card.querySelector('.quote-application').textContent = quote.application;
}

function bindDashboardEvents() {
    const profileOverlay = root.querySelector('#profile-overlay');
    pendingProfilePhoto = null;
    removeProfilePhoto = false;
    const closeProfile = () => {
        profileOverlay.hidden = true;
        clearPendingPhotoPreview();
        pendingProfilePhoto = null;
        removeProfilePhoto = false;
        root.querySelector('[data-action="open-profile"]').focus();
    };
    root.querySelector('[data-action="open-profile"]').addEventListener('click', () => {
        profileOverlay.hidden = false;
        profileOverlay.querySelector('input[name="displayName"]').focus();
    });
    profileOverlay.querySelectorAll('[data-action="close-profile"]').forEach((button) => {
        button.addEventListener('click', closeProfile);
    });
    profileOverlay.addEventListener('click', (event) => {
        if (event.target === profileOverlay) closeProfile();
    });
    profileOverlay.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeProfile();
    });
    root.querySelector('#profile-form').addEventListener('submit', (event) => {
        event.preventDefault();
        runSafely(async () => {
            const data = new FormData(event.currentTarget);
            const saveButton = root.querySelector('.profile-save-button');
            saveButton.disabled = true;
            saveButton.textContent = pendingProfilePhoto ? 'Preparing photo…' : 'Saving…';
            try {
                let photoChanges = {};
                if (pendingProfilePhoto) {
                    photoChanges = { photoURL: await uploadProfilePhoto(pendingProfilePhoto), photoPath: null };
                } else if (removeProfilePhoto) {
                    photoChanges = { photoURL: null, photoPath: null };
                }
                await saveProfile({
                    displayName: data.get('displayName') || '',
                    age: data.get('age') || '',
                    occupation: data.get('occupation') || '',
                    location: data.get('location') || '',
                    about: data.get('about') || '',
                    ...photoChanges
                });
                pendingProfilePhoto = null;
                removeProfilePhoto = false;
                clearPendingPhotoPreview();
                renderDashboard();
                showMessage('Your profile has been saved.', 'success');
            } finally {
                if (root.querySelector('.profile-save-button')) {
                    const button = root.querySelector('.profile-save-button');
                    button.disabled = false;
                    button.textContent = pendingProfilePhoto
                        ? 'Save profile'
                        : removeProfilePhoto ? 'Remove photo and save' : 'Save profile';
                }
            }
        });
    });
    root.querySelector('#profile-photo-file').addEventListener('change', (event) => {
        const file = event.currentTarget.files[0];
        if (!file) return;
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            event.currentTarget.value = '';
            showMessage('Choose a JPEG, PNG, or WebP image.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            event.currentTarget.value = '';
            showMessage('Choose a profile photo smaller than 5 MB.');
            return;
        }
        pendingProfilePhoto = file;
        removeProfilePhoto = false;
        clearPendingPhotoPreview();
        pendingPhotoPreviewUrl = URL.createObjectURL(file);
        const preview = root.querySelector('#profile-photo-preview');
        preview.innerHTML = `<img class="profile-photo" src="${pendingPhotoPreviewUrl}" alt="Selected profile photo preview">`;
        root.querySelector('.profile-save-button').textContent = 'Save profile';
    });
    root.querySelector('[data-action="remove-photo"]').addEventListener('click', () => {
        pendingProfilePhoto = null;
        clearPendingPhotoPreview();
        root.querySelector('#profile-photo-file').value = '';
        removeProfilePhoto = Boolean(profile.photoURL);
        const fallback = (profile.displayName || currentUser.email || 'S').charAt(0).toUpperCase();
        root.querySelector('#profile-photo-preview').innerHTML = avatarMarkup('', fallback, 'profile-photo');
        root.querySelector('.profile-save-button').textContent = removeProfilePhoto ? 'Remove photo and save' : 'Save profile';
    });

    root.querySelector('[data-action="use-daily-prompt"]').addEventListener('click', () => {
        const prompt = ambitionPromptForDate(new Date(`${currentDate}T12:00:00`));
        const form = root.querySelector('#ambition-form');
        form.querySelector('[name="title"]').value = prompt.title;
        form.querySelector('[name="virtue"]').value = prompt.virtue;
        form.querySelector('[name="steps"]').value = prompt.steps;
        form.querySelector('[name="title"]').focus();
    });

    root.querySelector('#reflection-date').addEventListener('change', (event) => {
        currentDate = event.target.value || localDateString();
        runSafely(async () => {
            reflection = await loadReflection();
            renderDashboard();
        });
    });

    root.querySelector('#ambition-form').addEventListener('submit', (event) => {
        event.preventDefault();
        runSafely(async () => {
            const data = new FormData(event.currentTarget);
            const ambition = new Ambition({
                title: data.get('title').trim(),
                virtue: data.get('virtue'),
                priority: data.get('priority'),
                actionSteps: data.get('steps').split(',').map((step) => step.trim()).filter(Boolean)
            });
            await saveReflection({ ambitions: [...reflection.ambitions, ambition] });
            showMessage('Ambition added to today’s plan.', 'success');
        });
    });

    root.querySelector('#control-form').addEventListener('submit', (event) => {
        event.preventDefault();
        runSafely(async () => {
            const data = new FormData(event.currentTarget);
            const item = new DichotomyItem({
                text: data.get('text').trim(),
                category: data.get('category'),
                reframed: data.get('reframed').trim(),
                date: currentDate
            });
            await saveReflection({ dichotomyItems: [...reflection.dichotomyItems, item] });
            showMessage('Added to your reflection.', 'success');
        });
    });

    root.querySelector('#achievement-form').addEventListener('submit', (event) => {
        event.preventDefault();
        runSafely(async () => {
            const data = new FormData(event.currentTarget);
            const achievement = new Achievement({
                title: data.get('title').trim(),
                description: data.get('description').trim(),
                stoicVirtue: data.get('virtue'),
                date: currentDate
            });
            if (storageMode === 'local') {
                achievements = [achievement, ...achievements].slice(0, 8);
                const all = JSON.parse(localStorage.getItem(localKey('achievements')) || '[]');
                localStorage.setItem(localKey('achievements'), JSON.stringify([achievement, ...all]));
            } else {
                const doc = getAchievementsRef().doc();
                achievement.id = doc.id;
                await doc.set(achievement.toFirestore());
                achievements = [achievement, ...achievements].slice(0, 8);
            }
            renderDashboard();
            showMessage('Your win has been recorded.', 'success');
        });
    });

    root.querySelector('[data-action="save-morning"]').addEventListener('click', () => runSafely(async () => {
        await saveReflection({ morningIntentions: root.querySelector('#morning-intentions').value.trim() });
        showMessage('Morning intention saved.', 'success');
    }));

    root.querySelector('[data-action="save-evening"]').addEventListener('click', () => runSafely(async () => {
        await saveReflection({
            self_audit_well: root.querySelector('#audit-well').value.trim(),
            self_audit_short: root.querySelector('#audit-short').value.trim(),
            lessonsLearned: root.querySelector('#lessons').value.trim()
        });
        showMessage('Evening reflection saved.', 'success');
    }));

    root.querySelectorAll('[data-action="toggle-ambition"]').forEach((input) => {
        input.addEventListener('change', () => runSafely(async () => {
            const ambitions = reflection.ambitions.map((ambition) => ambition.id === input.dataset.id
                ? { ...ambition, completed: input.checked }
                : ambition);
            await saveReflection({ ambitions });
        }));
    });

    root.querySelectorAll('[data-action="delete-ambition"]').forEach((button) => {
        button.addEventListener('click', () => runSafely(async () => {
            await saveReflection({ ambitions: reflection.ambitions.filter((item) => item.id !== button.dataset.id) });
        }));
    });

    root.querySelectorAll('[data-action="toggle-item"]').forEach((button) => {
        button.addEventListener('click', () => runSafely(async () => {
            const dichotomyItems = reflection.dichotomyItems.map((item) => item.id === button.dataset.id
                ? { ...item, category: item.category === 'within' ? 'outside' : 'within' }
                : item);
            await saveReflection({ dichotomyItems });
        }));
    });

    root.querySelectorAll('[data-action="delete-item"]').forEach((button) => {
        button.addEventListener('click', () => runSafely(async () => {
            await saveReflection({ dichotomyItems: reflection.dichotomyItems.filter((item) => item.id !== button.dataset.id) });
        }));
    });

    root.querySelector('[data-action="signout"]').addEventListener('click', () => {
        if (storageMode === 'local') {
            runSafely(async () => {
                localStorage.removeItem('stoic-daily:local-mode');
                currentUser = null;
                renderAuth();
            });
        } else {
            runSafely(() => auth.signOut());
        }
    });
}

async function enterDashboard() {
    [profile, reflection, achievements] = await Promise.all([
        loadProfile(),
        loadReflection(),
        loadAchievements()
    ]);
    renderDashboard();
}

function start() {
    if (!configured) {
        if (localStorage.getItem('stoic-daily:local-mode') === 'true') {
            storageMode = 'local';
            currentUser = { uid: 'local' };
            runSafely(enterDashboard);
            return;
        }
        renderAuth();
        return;
    }
    try {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        auth.onAuthStateChanged((user) => {
            if (!user) {
                currentUser = null;
                storageMode = 'firebase';
                renderAuth();
                return;
            }
            currentUser = user;
            storageMode = 'firebase';
            runSafely(enterDashboard);
        });
    } catch (error) {
        console.error(error);
        renderAuth();
        showMessage('Firebase could not be initialized. Verify the web app settings in firebase-config.js.');
    }
}

start();
