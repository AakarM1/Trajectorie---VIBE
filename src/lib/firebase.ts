import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

// Firebase configuration
// In a real app, these would come from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "demo-app.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-app",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "demo-app.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore and Auth
export const db = getFirestore(app);
export const auth = getAuth(app);

// Connect to emulators in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Only connect to emulators in development and in browser
  const isEmulatorConnected = () => {
    // Check if already connected to avoid reconnection errors
    return (db as any)._delegate?._databaseId?.projectId?.includes('demo') ||
           process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'demo-app';
  };

  if (isEmulatorConnected() && !window.location.hostname.includes('vercel')) {
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
