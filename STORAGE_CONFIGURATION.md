# Storage Configuration Documentation

## Overview
The app now automatically detects whether to use Firestore (cloud database) or localStorage based on the Firebase configuration in your `.env` file.

## How It Works

### 1. Environment Variable Validation
The app checks these required Firebase environment variables:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`  
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### 2. Storage Selection Logic
- **Firestore (Cloud)**: Used when all Firebase env vars are present and valid
- **localStorage (Local)**: Used when Firebase config is missing/invalid

### 3. Visual Notification
- A popup appears for 8 seconds on page load
- Shows which storage type is being used
- Provides context about data sharing implications

## Current Configuration Status

Based on your `.env` file:
```
NEXT_PUBLIC_FIREBASE_API_KEY="your_firebase_api_key_here"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_project_id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_project.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
NEXT_PUBLIC_FIREBASE_APP_ID="your_app_id"
```

**Current Status**: Using **localStorage** (placeholder values detected)

## To Enable Firestore
Replace the placeholder values in `.env` with actual Firebase project credentials:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Go to Project Settings → General → Your apps
4. Copy the config values to your `.env` file

## Benefits of Each Storage Type

### Firestore (Cloud Database)
✅ Shared data across all users
✅ Real-time synchronization  
✅ Persistent data storage
✅ Accessible from any device

### localStorage (Local Storage)
✅ Works offline
✅ Fast access
✅ No external dependencies
❌ Data limited to single browser/device
❌ Not shared between users

## Testing
- Visit `http://localhost:3000` to see the storage notification
- Check browser console for storage type logs
- Test login/registration to verify data persistence
