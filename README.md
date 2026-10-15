# Stoic Daily

A mobile-responsive daily reflection app built with browser JavaScript modules and Firebase's compat SDK. It supports email/password Firebase Auth, private per-user Firestore reflections and achievements, a read-only daily quote collection, and an optional device-only mode.

The dashboard adapts to phone screens with a compact header, sticky section shortcuts, stacked forms and cards, larger touch targets, and a bottom-sheet-style profile editor.

## Project structure

```text
.
├── app.js                  Dashboard, authentication, and Firebase data operations
├── android/                Capacitor native project, ready to open in Android Studio
├── firebase-config.js      Firebase web app configuration
├── firebase.json           Firebase CLI Firestore configuration
├── firestore.rules         User-scoped data access and read-only public quotes
├── index.html              Browser entry point and Firebase SDK loading
├── models.js               Daily plan, dichotomy, reflection, and achievement models
├── quotes.js               Curated quote and application-note seed data
├── capacitor.config.json   Capacitor Android app identity and web asset location
├── assets/
│   ├── icon.svg            Stoic Daily Android launcher icon source
│   └── stoic-icon.svg      Browser favicon
├── Stoic-Daily-debug.apk   Installable Android debug build (after generation)
├── scripts/
│   └── seed-quotes.js      Admin-SDK seeder for the quotes collection
└── styles.css              Responsive dark theme
```

## Run locally

Open this folder through a local static web server (for example, VS Code Live Server). ES modules are not supported when opening `index.html` directly using a `file:` URL.

Firebase is configured for the `stoic-18305` project in `firebase-config.js`. Email/password sign-in is enabled and private Firestore rules are published. If account creation reports an invalid API key, the Google Cloud project owner must create or restore a valid web API key with the Identity Toolkit API allowed, then update `firebase-config.js`. **Continue on this device** is an optional local-only mode; it stores data in this browser's local storage and does not sync or authenticate.

## Publish on GitHub Pages

1. Create a GitHub repository for the app.
2. Upload the files in this project folder to the repository root. Do not upload `node_modules` or Firebase service-account credentials.
3. In the repository, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, select the `main` branch and `/ (root)`, and save.
4. Wait for the Pages deployment to finish. Open the URL GitHub shows, usually `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.
5. In Firebase Console, open **Authentication → Settings → Authorized domains** and add `YOUR-USERNAME.github.io`. Enter only the hostname, without `https://` or the repository path.
6. Sign in with an email and password to save and sync records through Firebase.

The site is static-hosted by GitHub Pages; Firebase provides account sign-in and cloud data. Use the same email/password account on each device to see the same records. **Continue on this device** remains local to that browser.

## Connect Firebase services

1. In the Firebase Console for `stoic-18305`, **Email/Password** sign-in is enabled for account creation and sign-in.
2. Create a Cloud Firestore database in the Firebase Console if it does not already exist. This app does not require Firebase Storage or a paid billing upgrade.
3. Add the hostname where the app is hosted under **Authentication → Settings → Authorized domains** (for GitHub Pages, add `YOUR-USERNAME.github.io`; `localhost` is already authorized for local and Android use).
4. The owner-only Firestore rules are already published to `stoic-18305`. If you change them, sign in to the Firebase CLI using a Google account with access to the project and run `firebase deploy --only firestore:rules`.

The app writes reflections to `users/{uid}/reflections/{yyyy-mm-dd}`, achievements to `users/{uid}/achievements/{achievementId}`, and profile details to `users/{uid}` in **Cloud Firestore** for the configured `stoic-18305` project. Profile photos are resized and compressed to a maximum of 400 KiB, then saved as a private data URL in the owner's profile document. Firestore rules restrict each user to their own records; Storage and a billing upgrade are not required. Quote documents are readable by signed-in users and not writable from the browser. The `databaseURL` in the Firebase config refers to Realtime Database; this app does not write user records to Realtime Database.

The **My profile** form lets you optionally save a photo, display name, age, occupation, location, and short bio. Personal profile fields and the compressed photo are stored in that user's Firestore document. Email remains managed by Firebase Authentication.

## Build and install the Android app

This folder includes a Capacitor Android project. Install Node.js 22 or later, Android Studio, and an Android SDK (Android API 24 or later). Open the `android/` subfolder (the one containing `settings.gradle`) in Android Studio and let Gradle sync finish.

To refresh the bundled web app and launcher icon after making changes, run from this folder:

```powershell
npm.cmd install
npm.cmd run android:sync
```

In Android Studio, choose **Build → Build Bundle(s) / APK(s) → Build APK(s)**. The debug APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to your Android phone and open it to install; Android may ask you to allow installs from the app used to open the file. A debug APK is for personal testing and sideloading, not Play Store publishing.

Alternatively, after installing dependencies, set `JAVA_HOME` in PowerShell to the JDK bundled with Android Studio (or another JDK 21 or later), then run `npm.cmd run android:apk` to sync and build with the included Gradle wrapper. Sign in to Firebase while online to sync your records across devices; local-only mode remains stored only on that device/browser.

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
