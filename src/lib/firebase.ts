import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// Firebase configuration
// These should be set as environment variables in production
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDdNbACt-eseLyvXluj1uKuBQ7zWK47t-o",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "trajectorie-vibe.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "trajectorie-vibe",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "trajectorie-vibe.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:trajectorie-vibe"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore and Auth
export const db = getFirestore(app);
export const auth = getAuth(app);

// Only connect to emulators in local development
if (typeof window !== 'undefined' && 
    process.env.NODE_ENV === 'development' && 
    window.location.hostname === 'localhost') {
  
  const isUsingEmulators = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'demo-app' ||
                          !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  
  if (isUsingEmulators) {
    try {
      // Connect to Firestore emulator
      if (!(db as any)._delegate._settings?.host?.includes('localhost')) {
        connectFirestoreEmulator(db, 'localhost', 8080);
      }
      
      // Connect to Auth emulator
      if (!(auth.config as any).emulator) {
        connectAuthEmulator(auth, 'http://localhost:9099');
      }
    } catch (error) {
      // Emulators might already be connected or not running
      console.log('Firebase emulators connection status:', error);
    }
  }
}

export default app;
