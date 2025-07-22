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

## 🔄 Deployment Modes

### Mode 1: localStorage Only (No Setup Required)
- Works immediately on Vercel
- All data stored in browser localStorage
- Perfect for demos and development

### Mode 2: With Firestore Database
- Set Firebase environment variables in Vercel
- Scalable production database
- Automatic fallback to localStorage if Firebase unavailable

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
