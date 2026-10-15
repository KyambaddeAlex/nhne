import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { DAILY_QUOTE_COUNT, dailyQuoteForIndex } from '../quotes.js';

const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
    throw new Error('Set GOOGLE_CLOUD_PROJECT or FIREBASE_PROJECT_ID to your Firebase project ID.');
}

initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore();
const batch = db.batch();

for (let index = 0; index < DAILY_QUOTE_COUNT; index += 1) {
    const quote = dailyQuoteForIndex(index);
    const id = `day-${String(index + 1).padStart(3, '0')}`;
    batch.set(db.collection('quotes').doc(id), { ...quote, rotationIndex: index });
}

await batch.commit();
console.log(`Seeded ${DAILY_QUOTE_COUNT} distinct quote documents for the daily rotation.`);
