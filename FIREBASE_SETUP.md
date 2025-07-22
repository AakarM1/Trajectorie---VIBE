# 🔥 Firebase Setup Guide for Shared Database

## Quick Setup Steps

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Name it "trajectorie-vibe" (or any name you prefer)
4. Enable Google Analytics (optional)
5. Create project

### 2. Enable Firestore
1. In your Firebase project, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in production mode" 
4. Select a location (choose closest to your users)

### 3. Set Firestore Rules (Important!)
Go to Firestore Database → Rules and replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to all documents for now
    // In production, add proper authentication rules
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
⚠️ **Note**: This allows public access. For production, implement proper auth rules.

### 4. Get Firebase Configuration
1. Go to Project Settings (gear icon)
2. Scroll to "Your apps" section
3. Click web icon `</>`
4. Register app with nickname "trajectorie-vibe-web"
5. Copy the config object

### 5. Update Environment Variables

**Option A: For Development (.env.local)**
```env
NEXT_PUBLIC_FIREBASE_API_KEY="your_api_key_here"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_project_id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_project.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
NEXT_PUBLIC_FIREBASE_APP_ID="your_app_id"
GEMINI_API_KEY="your_google_ai_api_key"
```

**Option B: For Vercel Deployment**
1. Go to Vercel project settings
2. Add environment variables:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`  
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `GEMINI_API_KEY`

### 6. Deploy to Vercel
1. Push your code to GitHub
2. Deploy on Vercel (will automatically use Firestore)
3. Set environment variables in Vercel dashboard
4. Redeploy

## Testing the Setup

### Local Testing
```bash
npm run dev
```
- Check browser console for Firebase connection
- Try creating a user account
- Verify data appears in Firebase Console

### Production Testing
1. Deploy to Vercel
2. Test user registration/login
3. Check Firestore Console for data
4. Verify multiple users can see same data

## Switching Between Storage Modes

### Use Firestore (Default - Shared Database)
- Set Firebase environment variables
- Deploy normally

### Use localStorage (Local Only)
- Set `NEXT_PUBLIC_USE_LOCALSTORAGE=true`
- Or don't set Firebase environment variables

## Data Structure in Firestore

Your app will create these collections:

- **users**: User accounts and authentication
- **submissions**: Interview submissions and results  
- **configurations**: Admin settings (JDT, SJT, global)

## Security Notes

🔒 **For Production:**
1. Update Firestore rules for proper authentication
2. Implement user roles and permissions
3. Use Firebase Authentication for secure login
4. Hash passwords properly

## Troubleshooting

### "Permission denied" errors
- Check Firestore rules allow access
- Verify Firebase config is correct

### Data not syncing
- Check browser network tab for Firebase requests
- Verify environment variables are set
- Check Firestore Console for data

### Still using localStorage
- Verify Firebase env vars are set correctly
- Check browser console for Firebase errors
- Ensure `NEXT_PUBLIC_USE_LOCALSTORAGE` is not set to `true`
