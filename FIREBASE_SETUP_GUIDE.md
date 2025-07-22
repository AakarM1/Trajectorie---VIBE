# Sample Firebase Configuration for Testing

## Create a test Firebase project and update .env with these values:

GEMINI_API_KEY="AIzaSyDyQ53A9f1TPbk4CudjXJTDC0OzIEzqyvc"

# Replace these with actual Firebase project values
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyBdKGiB9j1WI7QnLJ9lMnOp3QrS2TuVwXy"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="trajectorie-vibe-demo.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="trajectorie-vibe-demo"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="trajectorie-vibe-demo.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789012"
NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789012:web:abc123def456ghi789"

## Steps to get real Firebase credentials:

1. Go to https://console.firebase.google.com/
2. Create a new project (or use existing)
3. Go to Project Settings (⚙️ icon)
4. Scroll down to "Your apps" section
5. Click "Add app" → Web app (</>) 
6. Register your app with a nickname
7. Copy the config values from the SDK setup code
8. Replace the values above with your actual config
9. Restart the development server

## Security Notes:
- These values are safe to expose in client-side code
- The API key is restricted by domain/referrer settings in Firebase
- For production, set these as environment variables in your hosting platform
