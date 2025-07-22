# Database Setup Guide

This application now supports both **Firestore** (Firebase's NoSQL database) and **localStorage** as storage options. The system automatically falls back to localStorage if Firestore is unavailable.

## Quick Start (Development Mode)

For development, the app works out of the box with localStorage. No additional setup required.

## Firestore Setup (Production Ready)

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Follow the setup wizard
4. Enable Firestore Database in your project

### 2. Get Firebase Configuration

1. In your Firebase project, go to Project Settings (gear icon)
2. Scroll down to "Your apps" section
3. Click "Add app" and select the web icon `</>`
4. Register your app and copy the config object

### 3. Update Environment Variables

Copy `.env.example` to `.env.local` and update with your Firebase config:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY="your_api_key_here"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_project_id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_project.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
NEXT_PUBLIC_FIREBASE_APP_ID="your_app_id"

# Google AI API Key (existing)
GEMINI_API_KEY="your_google_ai_api_key_here"
```

### 4. Set Firestore Rules

In Firebase Console > Firestore Database > Rules, set up basic security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own data
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Development with Firebase Emulators

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

```bash
firebase login
```

### 3. Initialize Firebase in Project

```bash
firebase init
```

Select:
- Firestore
- Emulators

### 4. Start Development with Emulators

```bash
npm run dev:with-db
```

This starts both the Next.js dev server and Firebase emulators.

## Database Collections

The application creates the following Firestore collections:

### `users`
```typescript
{
  id: string,
  email: string,
  candidateName: string,
  candidateId: string,
  clientName: string,
  role: string,
  passwordHash: string, // In production, use proper password hashing
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### `submissions`
```typescript
{
  id: string,
  candidateName: string,
  testType: 'JDT' | 'SJT',
  date: Timestamp,
  report: AnalysisResult,
  history: ConversationEntry[],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### `configurations`
```typescript
{
  id: string,
  type: 'jdt' | 'sjt' | 'global',
  data: any, // Configuration object
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## Migration from localStorage

If you have existing data in localStorage and want to migrate to Firestore:

1. Export your localStorage data before switching
2. Set up Firestore as described above
3. The application will automatically start using Firestore for new data
4. Existing localStorage data will remain accessible as fallback

## Troubleshooting

### App Still Uses localStorage
- Check that `NEXT_PUBLIC_FIREBASE_PROJECT_ID` is set and not "demo-app"
- Verify Firebase configuration in browser dev tools
- Check console for any Firebase connection errors

### Firestore Permission Errors
- Ensure Firestore rules allow read/write access
- Check that authentication is working properly
- Verify your Firebase project has Firestore enabled

### Data Not Syncing
- Check browser network tab for failed Firebase requests
- Verify Firebase config is correct
- Ensure Firestore is enabled in your Firebase project

## Features

- **Automatic Fallback**: If Firestore is unavailable, automatically falls back to localStorage
- **Seamless Migration**: No code changes required to switch between storage methods
- **Development Friendly**: Works out of the box with localStorage for development
- **Production Ready**: Full Firestore integration for scalable production deployment
