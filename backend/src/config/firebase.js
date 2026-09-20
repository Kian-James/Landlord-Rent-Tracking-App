import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function app() {
  return getApps()[0] || initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
}

export function firebaseAuth() {
  return getAuth(app());
}
