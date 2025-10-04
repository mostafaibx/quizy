import { initializeApp, cert, getApps, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const initializeFirebaseAdmin = () => {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // For Cloudflare Workers, we need to pass credentials differently
  // You'll need to set these as environment variables
  const serviceAccount: ServiceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  return initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
};

// Initialize app
const app = initializeFirebaseAdmin();

// Export Firestore instance
export const adminDb = getFirestore(app);

// Helper to get Firestore compatible with Cloudflare Workers
export const getFirestoreAdmin = () => {
  return adminDb;
};