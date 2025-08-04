# Verbal Insights - AI-Powered Interview Platform

🚀 **Advanced AI-Powered Interview Assessment Platform** with comprehensive Firebase integration and production-ready CORS handling.

## 🌟 Platform Overview

Verbal Insights is a sophisticated Next.js 15 application that leverages Google Gemini AI to conduct and analyze job interviews. The platform supports both traditional interview assessments (JDT) and situational judgment tests (SJT) with real-time audio processing, comprehensive reporting, and role-based access control.

## 🚀 Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## ⚡ Quick Start Development

```bash
# Clone repository
git clone https://github.com/AakarM1/Trajectorie---VIBE.git
cd Trajectorie---VIBE

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

## 📋 Environment Configuration

### **📝 Complete Environment Variables Setup**

Create `.env.local` file in your project root with the following variables:

#### **🤖 AI Configuration (Required)**
```bash
# Google AI Studio API Key for Gemini AI
GEMINI_API_KEY="your_google_ai_studio_api_key"
```

#### **🔥 Firebase Configuration (Required for Production)**
```bash
# Firebase Web App Configuration
NEXT_PUBLIC_FIREBASE_API_KEY="your_firebase_api_key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_project_id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_project.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
NEXT_PUBLIC_FIREBASE_APP_ID="your_app_id"

# Optional: Firebase Admin SDK (for server-side operations)
FIREBASE_ADMIN_PRIVATE_KEY="your_admin_private_key"
FIREBASE_ADMIN_CLIENT_EMAIL="your_admin_client_email"
```

#### **⚙️ Application Configuration (Optional)**
```bash
# Environment Mode
NODE_ENV="development"
NEXT_PUBLIC_ENVIRONMENT="development"

# Storage Mode Configuration
NEXT_PUBLIC_USE_FIRESTORE="true"
NEXT_PUBLIC_USE_LOCAL_STORAGE="false"

# Debug Settings
NEXT_PUBLIC_DEBUG_MODE="false"
NEXT_PUBLIC_ENABLE_LOGGING="true"

# Admin Configuration
NEXT_PUBLIC_ADMIN_EMAIL="admin@yourcompany.com"
NEXT_PUBLIC_SUPER_ADMIN_EMAIL="superadmin@yourcompany.com"
```

### **🎯 Environment Variable Priorities**
1. **Development**: Uses `.env.local` → `.env.development` → `.env`
2. **Production**: Uses Vercel environment variables → `.env.production` → `.env`
3. **Fallbacks**: Hard-coded defaults in `firebase.ts` for demo mode

## 🔥 Firebase Configuration & Setup

### **📋 Firebase Project Setup Requirements**

#### **1. Enable Required Firebase Services**
In your [Firebase Console](https://console.firebase.google.com):
- ✅ **Authentication**: Enable Email/Password provider
- ✅ **Firestore Database**: Create in production mode
- ✅ **Storage**: Enable Firebase Storage
- ✅ **Hosting** (optional): For static deployment

#### **2. Configure Firebase Storage**

**Enable Storage Bucket:**
1. Go to Firebase Console → Storage
2. Click "Get Started" 
3. Choose your storage location (cannot be changed later)
4. Start in production mode

**Apply Security Rules:**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Users can upload their own submissions
    match /submissions/{userId}/{submissionId}/{fileName} {
      allow write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null && 
                     (request.auth.uid == userId || isAdmin());
      allow delete: if isAdmin();
    }
    
    // Admin-only access
    match /admin/{allPaths=**} {
      allow read, write, delete: if isAdmin();
    }
    
    // Helper function for admin check
    function isAdmin() {
      return request.auth != null && 
             request.auth.token.email in [
               'admin@yourcompany.com',
               'superadmin@yourcompany.com'
             ];
    }
  }
}
```

#### **3. Configure Firestore Database**

**Apply Security Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User submissions - users can only access their own data
    match /submissions/{userId} {
      allow read, write: if request.auth != null && 
                            (request.auth.uid == userId || isAdmin());
      allow delete: if isAdmin();
    }
    
    // User profiles
    match /users/{userId} {
      allow read, write: if request.auth != null && 
                            (request.auth.uid == userId || isAdmin());
    }
    
    // Helper function for admin check
    function isAdmin() {
      return request.auth != null && 
             request.auth.token.email in [
               'admin@yourcompany.com',
               'superadmin@yourcompany.com'
             ];
    }
  }
}
```

#### **4. Update Admin Email Addresses**
⚠️ **Important**: Replace `admin@yourcompany.com` and `superadmin@yourcompany.com` with your actual admin email addresses in:
- `storage.rules`
- `firestore.rules`  
- Environment variables

### **🔧 Deploy Firebase Rules**
```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage:rules

# Deploy all rules
firebase deploy --only rules
```

## 🌐 Firebase Storage CORS Configuration

### **🚨 Critical for Production Deployment**

When deploying to Vercel or any external domain, you **must** configure CORS for Firebase Storage to prevent cross-origin request errors.

#### **📋 Prerequisites**
1. **Google Cloud SDK** installed locally
2. **Firebase project** with Storage enabled
3. **Production domain** (e.g., Vercel deployment URL)

#### **🛠️ Step-by-Step CORS Setup**

**1. Install Google Cloud SDK**
```bash
# Windows (using winget)
winget install Google.CloudSDK

# macOS (using Homebrew)
brew install google-cloud-sdk

# Linux (using apt)
sudo apt-get install google-cloud-sdk
```

**2. Authenticate and Set Project**
```bash
# Login to Google Cloud
gcloud auth login

# Set your Firebase project ID
gcloud config set project your-firebase-project-id
```

**3. Create CORS Configuration File**

Create `cors.json` in your project root:
```json
[
  {
    "origin": [
      "https://your-vercel-app.vercel.app",
      "https://*.vercel.app",
      "http://localhost:3000"
    ],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "maxAgeSeconds": 3600,
    "responseHeader": [
      "Content-Type",
      "Access-Control-Allow-Origin",
      "x-goog-resumable"
    ]
  }
]
```

**4. Apply CORS Configuration**
```bash
# Apply CORS to your Firebase Storage bucket
gsutil cors set cors.json gs://your-project.firebasestorage.app
```

#### **🔍 Verification**
After applying CORS configuration:
1. Deploy your app to Vercel
2. Test file uploads/downloads in production
3. Check browser console for CORS errors (should be resolved)

#### **⚠️ Common Issues**
- **Bucket not found**: Verify your Firebase project ID and storage bucket name
- **Permission denied**: Ensure you're authenticated with the correct Google account
- **UTF-8 encoding**: Create CORS file with proper UTF-8 encoding (no BOM)

#### **🎯 What This Fixes**
- ✅ File uploads from Vercel to Firebase Storage
- ✅ File downloads and media access
- ✅ Audio extraction feature in production
- ✅ Enhanced deletion system functionality
- ✅ Progress tracking for chunked uploads

### **📱 Testing CORS Configuration**
```bash
# Test CORS configuration
curl -H "Origin: https://your-vercel-app.vercel.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://firebasestorage.googleapis.com/v0/b/your-project.firebasestorage.app/o
```

## 🚀 Deployment Options

### **Vercel (Recommended)**
```bash
# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard
# Automatic builds on git push
```

### **Firebase Hosting**
```bash
# Build for static export
npm run build && npm run export

# Deploy to Firebase
firebase deploy --only hosting
```

## 🛠️ System Architecture

### **Technology Stack**
- **Frontend**: Next.js 15, React 18, TypeScript 5
- **UI Framework**: Tailwind CSS + shadcn/ui components
- **AI Engine**: Google Genkit with Gemini 2.0 Flash
- **Database**: Firebase Firestore + localStorage fallback
- **Storage**: Firebase Storage with CORS configuration
- **Authentication**: Firebase Auth with custom role system
- **Deployment**: Vercel + Firebase Hosting

### **Core Features**
- **🧠 AI-Powered Assessment**: Real-time interview analysis with Google Gemini
- **🎯 Dual Test Types**: JDT (Job Description Test) & SJT (Situational Judgment Test)
- **🎤 Audio Processing**: Real-time transcription and speech analysis
- **🎵 Audio Extraction**: Client-side video-to-audio conversion for admin downloads
- **🗑️ Enhanced Deletion**: Cross-storage mode deletion with complete file cleanup
- **📊 Comprehensive Reporting**: Detailed candidate evaluation and scoring
- **👥 Role-Based Access**: Admin, Super Admin, and Candidate dashboards
- **📱 Responsive Design**: Mobile-optimized interface
- **🔄 Real-time Sync**: Cross-device data synchronization

## 🗄️ Database Architecture

### **🌍 Hybrid Storage System**
- **Primary**: Firebase Firestore with real-time synchronization
- **Fallback**: localStorage for offline/demo functionality
- **Smart Detection**: Automatic mode selection based on configuration

### **📊 Data Models**
- **Users**: Role-based authentication (admin, superadmin, candidate)
- **Submissions**: Interview responses and AI analysis results  
- **Configurations**: System settings and AI parameters
- **Real-time Sync**: Cross-device data synchronization

## 🔧 Development Commands

```bash
# Development server with hot reload
npm run dev

# AI development tools (Genkit)
npm run genkit:dev

# Type checking
npm run typecheck

# Production build
npm run build

# Start production server
npm start
```

## 🆘 Troubleshooting

### **🌐 CORS Issues**
**Problem**: "CORS policy: No 'Access-Control-Allow-Origin' header is present"
**Solution**: 
1. Configure Firebase Storage CORS (see CORS section above)
2. Verify your domain is included in `cors.json`
3. Ensure CORS is applied to correct storage bucket

**Problem**: "gsutil command not found"
**Solution**: 
1. Install Google Cloud SDK
2. Restart terminal after installation
3. Use full path if needed: `"C:\Users\[USERNAME]\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gsutil.cmd"`

### **🔑 Environment Variable Issues**
**Problem**: "AI features not working"
**Solution**: 
1. Check `GEMINI_API_KEY` in `.env.local`
2. Verify API key is valid in Google AI Studio
3. Ensure no extra spaces or quotes in the key

**Problem**: "Firebase connection errors"
**Solution**: 
1. Verify all `NEXT_PUBLIC_FIREBASE_*` variables are set
2. Check Firebase project settings for correct values
3. Ensure storage bucket URL format: `project-id.firebasestorage.app`

**Problem**: "Data not syncing between devices"
**Solution**: 
1. Check `NEXT_PUBLIC_USE_FIRESTORE="true"` in environment
2. Verify Firebase rules allow read/write access
3. Check browser console for authentication errors

### **🚀 Production Deployment Issues**
**Problem**: "Build fails on Vercel"
**Solution**: 
1. Set environment variables in Vercel dashboard
2. Ensure all required variables are present
3. Check build logs for specific missing variables

**Problem**: "Files not uploading in production"
**Solution**: 
1. Configure Firebase Storage CORS (critical)
2. Verify storage bucket permissions
3. Check network requests in browser dev tools

### **🔧 Development Issues**
**Problem**: "Cannot read properties of undefined"
**Solution**: 
1. Check if running in client vs server context
2. Use `ClientOnly` component for client-side features
3. Verify Firebase initialization in `firebase.ts`

**Problem**: "Audio extraction not working"
**Solution**: 
1. Ensure FFmpeg.js dependencies are installed
2. Check browser compatibility (modern browsers only)
3. Verify video file format is supported

### **📱 Debug Tools**
- **Storage Mode**: Check storage notification component
- **Console Logging**: Enable with `NEXT_PUBLIC_ENABLE_LOGGING="true"`
- **Firebase Rules**: Test in Firebase Console rules playground
- **Network Tab**: Monitor API requests and CORS headers

## 🆘 Support & Contributing

### **Getting Help**
1. Check the troubleshooting section for common issues
2. Review Firebase Console for configuration errors
3. Examine console logs for specific error messages
4. Verify environment variable configuration

### **Contributing**
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

**Built with ❤️ using Next.js 15, Google Gemini AI, Firebase Storage with production-ready CORS handling** | **Ready for Vercel deployment**
