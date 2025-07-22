# Vercel Deployment Guide

## Environment Variables Setup

In your Vercel dashboard, go to your project settings and add these environment variables:

### Required for Firebase (if using Firestore):
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_actual_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_actual_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Required for AI Features:
```
GEMINI_API_KEY=your_google_ai_api_key
```

### Optional:
```
DATABASE_MODE=localStorage
```

## How to Add Environment Variables in Vercel:

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add each variable one by one
5. Set them for all environments (Production, Preview, Development)

## Notes:

- If you don't set Firebase variables, the app will automatically use localStorage
- The app is designed to fallback gracefully
- Make sure to redeploy after adding environment variables
