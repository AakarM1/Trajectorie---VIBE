# Verbal Insights - AI-Powered Interview Platform

This project is ready for deployment on Vercel with database integration.

## 🚀 Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## 📋 Deployment Checklist

### Required Environment Variables in Vercel:

**For AI Features (Required):**
- `GEMINI_API_KEY` - Your Google AI Studio API key

**For Database (Optional - uses localStorage if not set):**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Setup Instructions:

1. **Clone and Deploy:**
   ```bash
   git push origin main
   ```
   
2. **Set Environment Variables in Vercel:**
   - Go to your Vercel project dashboard
   - Navigate to Settings → Environment Variables
   - Add the required variables above
   
3. **Redeploy:**
   - Trigger a new deployment after adding environment variables

# Verbal Insights - AI-Powered Interview Platform

🌟 **Now with Shared Database Support!** - All users access the same data across devices.

## � Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## 🗄️ Database Modes

### 🌍 **Shared Database (Default - Firestore)**
- **All users see the same data**
- **Cross-device synchronization**
- **Scalable and production-ready**
- **Requires Firebase setup**

### 📱 **Local Storage (Fallback)**
- **Device-specific data only**
- **No setup required**
- **Good for demos/testing**

## 📋 Setup for Shared Database

### Required Environment Variables:

**For AI Features (Required):**
- `GEMINI_API_KEY` - Your Google AI Studio API key

**For Shared Database (Required for multi-user access):**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## 🔧 Quick Setup Steps

### 1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create new project
   - Enable Firestore Database

### 2. **Deploy to Vercel**
   ```bash
   git push origin main
   ```

### 3. **Set Environment Variables**
   - Add Firebase config in Vercel dashboard
   - Redeploy

### 4. **🎉 Your app now has shared database!**

## 📖 Detailed Guides

- **[Firebase Setup Guide](./FIREBASE_SETUP.md)** - Complete Firebase configuration
- **[Vercel Deployment Guide](./VERCEL_DEPLOYMENT.md)** - Deployment instructions
- **[Database Setup](./DATABASE_SETUP.md)** - Database configuration options

## 🔄 How It Works

1. **With Firebase Config**: Uses shared Firestore database
2. **Without Firebase Config**: Falls back to localStorage
3. **Force localStorage**: Set `NEXT_PUBLIC_USE_LOCALSTORAGE=true`

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Run development server (uses Firestore if configured)
npm run dev

# Force localStorage mode for local development
NEXT_PUBLIC_USE_LOCALSTORAGE=true npm run dev
```

## 🌟 Key Features

- **🔄 Shared Database**: All users access same data
- **📱 Cross-Device Sync**: Works on any device
- **🛡️ Automatic Fallback**: localStorage if Firestore unavailable
- **🚀 Vercel Ready**: Zero-config deployment
- **🤖 AI Integration**: Google Gemini for analysis
- **📊 Real-time Updates**: Instant data synchronization

## 🔒 Security Note

The default Firestore rules allow public access for easy setup. For production:
1. Implement proper authentication rules
2. Add user permissions
3. Use Firebase Authentication

## 🆘 Troubleshooting

**Data not syncing?**
- Check Firebase environment variables
- Verify Firestore rules allow access
- Check browser console for errors

**Still using localStorage?**
- Ensure Firebase config is set correctly
- Check that `NEXT_PUBLIC_USE_LOCALSTORAGE` is not `true`

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run with Firebase emulators (optional)
npm run dev:with-db
```

## 📁 Project Structure

```
src/
├── app/           # Next.js pages and API routes
├── components/    # React components
├── contexts/      # React context providers
├── lib/           # Utility functions and services
└── types/         # TypeScript type definitions
```

## 🔧 Key Features

- **Hybrid Storage**: Firestore + localStorage fallback
- **AI Integration**: Google Gemini for analysis
- **Type Safe**: Full TypeScript support
- **Responsive**: Mobile-friendly UI
- **Vercel Ready**: Zero-config deployment

## 📖 Documentation

- [Database Setup Guide](./DATABASE_SETUP.md)
- [Vercel Deployment Guide](./VERCEL_DEPLOYMENT.md)
- [Architecture Overview](./docs/ARCHITECTURE.md)

## 🚨 Important Notes for Vercel

1. **Environment Variables**: Set in Vercel dashboard, not in code
2. **Database Mode**: Automatically determined by environment variables
3. **Build Process**: Uses standard Next.js build (`npm run build`)
4. **No Additional Config**: Works out of the box with Vercel

## 📞 Support

If you encounter issues during deployment, check:
1. Environment variables are set correctly in Vercel
2. All required dependencies are in `package.json`
3. Build logs in Vercel dashboard for specific errors
