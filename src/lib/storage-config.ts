/**
 * Utility to validate Firebase configuration and determine storage type
 */

export interface FirebaseValidationResult {
  isValid: boolean;
  storageType: 'firestore' | 'localStorage';
  message: string;
}

/**
 * Validates if Firebase environment variables are properly configured
 */
export const validateFirebaseConfig = (): FirebaseValidationResult => {
  const requiredEnvVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ];

  const placeholderValues = [
    'your_firebase_api_key_here',
    'your_project.firebaseapp.com',
    'your_project_id',
    'your_project.appspot.com',
    'your_sender_id',
    'your_app_id'
  ];

  // Check if all required environment variables exist and are not placeholder values
  const missingOrInvalid = requiredEnvVars.filter((envVar, index) => {
    const value = process.env[envVar];
    return !value || 
           value.trim() === '' || 
           value === placeholderValues[index] ||
           value.includes('your_');
  });

  if (missingOrInvalid.length > 0) {
    return {
      isValid: false,
      storageType: 'localStorage',
      message: `Using Local Storage - Firebase config incomplete. Missing/invalid: ${missingOrInvalid.join(', ')}`
    };
  }

  // Additional validation for API key format (Firebase API keys typically start with "AIza")
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (apiKey && !apiKey.startsWith('AIza')) {
    return {
      isValid: false,
      storageType: 'localStorage',
      message: 'Using Local Storage - Firebase API key format appears invalid'
    };
  }

  return {
    isValid: true,
    storageType: 'firestore',
    message: 'Using Firestore Database - Shared storage for all users'
  };
};

/**
 * Get the current storage configuration
 */
export const getStorageConfig = () => {
  const validation = validateFirebaseConfig();
  
  return {
    useFirestore: validation.isValid,
    storageType: validation.storageType,
    message: validation.message
  };
};
