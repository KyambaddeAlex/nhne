# Stoic Daily

A mobile-responsive daily reflection app built with browser JavaScript modules and Firebase's compat SDK. It supports email/password or anonymous Firebase Auth, private per-user Firestore reflections and achievements, a read-only daily quote collection, and an optional device-only mode before Firebase is configured.

The dashboard adapts to phone screens with a compact header, sticky section shortcuts, stacked forms and cards, larger touch targets, and a bottom-sheet-style profile editor.

## Project structure

```text
.
├── app.js                  Dashboard, authentication, and Firebase data operations
├── firebase-config.js      Firebase web app configuration
├── firebase.json           Firebase CLI Firestore and Storage configuration
├── firestore.rules         User-scoped data access and read-only public quotes
├── index.html              Browser entry point and Firebase SDK loading
├── models.js               Daily plan, dichotomy, reflection, and achievement models
├── quotes.js               Curated quote and application-note seed data
├── scripts/
│   └── seed-quotes.js      Admin-SDK seeder for the quotes collection
├── storage.rules           Owner-only profile photo access
└── styles.css              Responsive dark theme
```

## Run locally

Open this folder through a local static web server (for example, VS Code Live Server). ES modules are not supported when opening `index.html` directly using a `file:` URL.

Firebase is configured for the `stoic-18305` project in `firebase-config.js`. Sign in or create an account to save data to Cloud Firestore. **Continue on this device** is an optional local-only mode; it stores data in this browser's local storage and does not sync or authenticate.

## Publish on GitHub Pages

1. Create a GitHub repository for the app.
2. Upload the files in this project folder to the repository root. Do not upload `node_modules` or Firebase service-account credentials.
3. In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select the `main` branch and `/ (root)`, and save.
4. Wait for the Pages deployment to finish. Open the URL GitHub shows, usually `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.
5. In Firebase Console, open **Authentication → Settings → Authorized domains** and add `YOUR-USERNAME.github.io`. Enter only the hostname, without `https://` or the repository path.
6. Follow the Firebase setup below before using cloud saves and photo uploads.

The site is static-hosted by GitHub Pages; Firebase provides account sign-in and cloud data. Use the same email/password account on each device to see the same records. **Continue on this device** remains local to that browser.

## Connect Firebase services

1. In the Firebase Console for `stoic-18305`, enable **Email/Password** and **Anonymous** under **Authentication → Sign-in method**.
2. Create a Cloud Firestore database and enable Firebase Storage in the Firebase Console if they do not already exist.
3. Install the Firebase CLI if needed, select the `stoic-18305` project, then deploy the included rules from this folder: `firebase deploy --only firestore:rules,storage`.

The app writes reflections to `users/{uid}/reflections/{yyyy-mm-dd}`, achievements to `users/{uid}/achievements/{achievementId}`, and profile details to `users/{uid}` in **Cloud Firestore** for the configured `stoic-18305` project. Profile photos are resized to JPEG and stored under `users/{uid}/profile/` in **Firebase Storage**. Firebase rules restrict direct photo access to the owner's authenticated UID. The app saves a Firebase download URL with the private profile document; treat that URL as a secret if you copy or share it. Quote documents are readable by signed-in users and not writable from the browser. The `databaseURL` in the Firebase config refers to Realtime Database; this app does not write user records to Realtime Database.

The **My profile** form lets you optionally save a photo, display name, age, occupation, location, and short bio. Personal profile fields are stored in that user's Firestore document; the resized photo is stored in that user's Firebase Storage folder. Email remains managed by Firebase Authentication.

## Seed the daily quotes

The app includes 366 distinct daily Stoic quotes/reflections. To populate the quote documents `quotes/day-001` through `quotes/day-366`, install the Admin SDK and authenticate the seeding environment with Google Application Default Credentials. The client selects by local calendar day using an absolute day count, so the quote changes every day, including across leap days and year boundaries:

```powershell
npm install
gcloud auth application-default login
$env:GOOGLE_CLOUD_PROJECT = "your-firebase-project-id"
npm run seed:quotes
```

Run the seeder only from a trusted development or deployment environment with Firestore access. It uses Application Default Credentials and does not require or store a service-account key in the workspace. Rerunning it safely updates the seeded quote documents. The 366-entry set includes the five attributed classical quotations and original Stoic practice reflections; the set repeats only after 366 days.

Each daily plan is stored separately at `users/{uid}/reflections/{yyyy-mm-dd}`. Ambitions, control items, and reflections for one date are loaded and saved only under that date; use the reflection date selector to review previous days. A different rotating Stoic ambition prompt is offered each day. It is only added to the plan when selected and submitted, and nothing automatically copies yesterday's ambitions into a new date.
