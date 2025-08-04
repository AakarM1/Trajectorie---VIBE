# Verbal Insights - AI-Powered Interview Platform

🚀 **Advanced AI-Powered Interview Assessment Platform** with documentation and architecture guides.

## 🌟 Platform Overview

Verbal Insights is ## 📚 Complete Documentation Index

**🏗️ System Architecture:**
- [🏗️ Complete System Architecture](./COMPLETE_SYSTEM_ARCHITECTURE.md) - Updated comprehensive architecture with Firebase Storage integration
- [📦 Firebase Storage & Media Architecture](./FIREBASE_STORAGE_MEDIA_ARCHITECTURE.md) - Media processing, CORS handling, and download strategies

**🔍 Analysis & Implementation:**
- [📊 Repository Analysis](./docs/detailed-documentation/COMPREHENSIVE_REPOSITORY_ANALYSIS.md) - Complete codebase breakdown
- [⚙️ Implementation Guide](./docs/detailed-documentation/COMPLETE_IMPLEMENTATION_GUIDE.md) - Component-by-component implementation

**🤖 AI & Development:**
- [🧠 AI Flows Documentation](./docs/detailed-documentation/AI_FLOWS_DATA_ARCHITECTURE.md) - AI processing flows and data models
- [👨‍💻 Developer Setup Guide](./docs/detailed-documentation/DEVELOPER_SETUP_DEPLOYMENT_GUIDE.md) - Complete development environment setup

**🔧 Infrastructure & Setup:**
- [🔥 Firebase Setup](./FIREBASE_SETUP.md) - Firebase configuration and rules
- [🌐 CORS Setup](./FIREBASE_STORAGE_CORS_SETUP.md) - CORS configuration and troubleshooting
- [🚀 Vercel Deployment](./VERCEL_DEPLOYMENT.md) - Production deployment guide
- [🗄️ Database Setup](./DATABASE_SETUP.md) - Database schema and configuration
- [📦 Storage Configuration](./STORAGE_CONFIGURATION.md) - Advanced storage optimization

**📋 Feature Documentation:**
- [📤 Progressive Uploads](./PROGRESSIVE_UPLOAD_EFFICIENCY_PLAN.md) - Upload optimization strategies
- [👥 User Management](./TEST_USERS_DOCUMENTATION.md) - User roles and permissions
- [👨‍💼 Super Admin Guide](./SUPERADMIN_DOCUMENTATION.md) - Administrative featuresticated Next.js 15 application that leverages Google Gemini AI to conduct and analyze job interviews. The platform supports both traditional interview assessments (JDT) and situational judgment tests (SJT) with real-time audio processing, comprehensive reporting, and role-based access control.

## 🚀 Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## � Complete Documentation Suite

### 🏗️ **System Architecture & Implementation**
- **[🏗️ Complete System Architecture](./COMPLETE_SYSTEM_ARCHITECTURE.md)** - Comprehensive system architecture with updated Firebase Storage integration, CORS handling, and progressive upload system
- **[📦 Firebase Storage & Media Architecture](./FIREBASE_STORAGE_MEDIA_ARCHITECTURE.md)** - Detailed documentation of media processing, CORS resolution, and 5-layer download strategy
- **[📊 Comprehensive Repository Analysis](./docs/detailed-documentation/COMPREHENSIVE_REPOSITORY_ANALYSIS.md)** - Complete codebase analysis with statistics, dependencies, and structure breakdown
- **[⚙️ Complete Implementation Guide](./docs/detailed-documentation/COMPLETE_IMPLEMENTATION_GUIDE.md)** - Page-by-page implementation details and component functionality

### 🤖 **AI & Data Architecture**
- **[🧠 AI Flows & Data Architecture](./docs/detailed-documentation/AI_FLOWS_DATA_ARCHITECTURE.md)** - Deep dive into 8 AI processing flows, Genkit integration, and data models
- **[👨‍💻 Developer Setup & Deployment Guide](./docs/detailed-documentation/DEVELOPER_SETUP_DEPLOYMENT_GUIDE.md)** - Complete setup, development, and production deployment instructions

### � **Firebase & Infrastructure Setup**
- **[🔥 Firebase Setup Guide](./FIREBASE_SETUP.md)** - Complete Firebase configuration including Storage, Firestore, and Auth
- **[🌐 Firebase Storage CORS Setup](./FIREBASE_STORAGE_CORS_SETUP.md)** - CORS configuration and troubleshooting
- **[🚀 Vercel Deployment Guide](./VERCEL_DEPLOYMENT.md)** - Production deployment instructions
- **[🗄️ Database Setup](./DATABASE_SETUP.md)** - Database configuration options and schema
- **[📦 Storage Configuration](./STORAGE_CONFIGURATION.md)** - Advanced storage setup and optimization

### 📖 **Feature Documentation**
- **[📤 Progressive Upload System](./PROGRESSIVE_UPLOAD_EFFICIENCY_PLAN.md)** - Upload optimization and chunking strategy
- **[👥 User Management](./TEST_USERS_DOCUMENTATION.md)** - User roles and access control
- **[👨‍💼 Super Admin Features](./SUPERADMIN_DOCUMENTATION.md)** - Advanced administrative capabilities
- **[🏗️ Architecture Overview](./docs/ARCHITECTURE.md)** - High-level system overview

## 🗄️ Database Architecture

### 🌍 **Hybrid Storage System**
- **Primary**: Firebase Firestore with real-time synchronization
- **Fallback**: localStorage for offline/demo functionality
- **Smart Detection**: Automatic mode selection based on configuration

### 📊 **Data Models**
- **Users**: Role-based authentication (admin, superadmin, candidate)
- **Submissions**: Interview responses and AI analysis results  
- **Configurations**: System settings and AI parameters
- **Real-time Sync**: Cross-device data synchronization

## � Quick Start Development

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

### **Required for AI Features:**
```bash
GEMINI_API_KEY="your_google_ai_studio_api_key"
```

### **Optional for Cloud Database:**
```bash
NEXT_PUBLIC_FIREBASE_API_KEY="your_firebase_api_key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your_project.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your_project_id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your_project.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your_sender_id"
NEXT_PUBLIC_FIREBASE_APP_ID="your_app_id"
```

## �️ System Architecture

### **Technology Stack**
- **Frontend**: Next.js 15, React 18, TypeScript 5
- **UI Framework**: Tailwind CSS + shadcn/ui components
- **AI Engine**: Google Genkit with Gemini 2.0 Flash
- **Database**: Firebase Firestore + localStorage fallback
- **Authentication**: Custom role-based system
- **Deployment**: Vercel + Firebase Hosting

### **Core Features**
- **🧠 AI-Powered Assessment**: Real-time interview analysis with Google Gemini
- **🎯 Dual Test Types**: JDT (Job Description Test) & SJT (Situational Judgment Test)
- **🎤 Audio Processing**: Real-time transcription and speech analysis
- **� Comprehensive Reporting**: Detailed candidate evaluation and scoring
- **👥 Role-Based Access**: Admin, Super Admin, and Candidate dashboards
- **📱 Responsive Design**: Mobile-optimized interface
- **� Real-time Sync**: Cross-device data synchronization

## � Project Structure

```
📦 Verbal Insights Platform
├── 🏠 Frontend Layer (Next.js 15)
│   ├── 📄 Pages: Landing, Auth, Interview, Admin Dashboard
│   ├── 🧩 Components: 22+ reusable UI components
│   └── 🎨 Styling: Tailwind CSS + shadcn/ui
├── 🤖 AI Processing Engine (Google Genkit)
│   ├── 🎯 8 AI Flows: Analysis, Evaluation, Reporting
│   ├── 🧠 Gemini Integration: Advanced language processing
│   └── 📝 Real-time Processing: Audio transcription & analysis
├── 🗄️ Data Layer (Hybrid Storage)
│   ├── ☁️ Firebase Firestore: Primary cloud database
│   ├── 💾 localStorage: Offline fallback storage
│   └── 🔄 Real-time Sync: Cross-device synchronization
└── 🔐 Security & Auth
    ├── 👤 Role-based Access Control
    ├── 🛡️ Firebase Security Rules
    └── 🔑 Custom Authentication Context
```

## � Key Application Pages

| Page | Purpose | Features |
|------|---------|----------|
| **🏠 Landing** | Welcome & navigation | Platform overview, quick access |
| **🔐 Authentication** | Login/Register | Role-based user management |
| **🎤 Interview** | JDT Assessment | Real-time audio recording & AI analysis |
| **📝 SJT Test** | Behavioral evaluation | Situational judgment scenarios |
| **📊 Admin Dashboard** | Management interface | User management, analytics, reports |
| **📈 Reports** | Assessment results | Detailed candidate evaluation |

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

## � Development Commands

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

## 🛡️ Security & Production

### **Firebase Security Rules**
- Role-based access control
- Data validation and sanitization
- User-specific data isolation

### **Environment Security**
- API key protection
- CORS configuration
- Input validation with Zod schemas

## 🆘 Troubleshooting

### **Common Issues**
- **AI not working**: Check `GEMINI_API_KEY` configuration
- **Data not syncing**: Verify Firebase environment variables
- **Build errors**: Run `npm run typecheck` for type issues
- **Authentication issues**: Check role assignments and contexts

### **Debug Tools**
- Storage notification component shows current storage mode
- Console logging for development environment
- Error boundaries for graceful error handling

## � Support & Contributing

### **Getting Help**
1. Check the comprehensive documentation in `/docs/detailed-documentation/`
2. Review troubleshooting guides for common issues
3. Examine console logs for specific error messages
4. Verify environment variable configuration

### **Contributing**
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## � Complete Documentation Index

**🔍 Analysis & Architecture:**
- [📊 Repository Analysis](./docs/detailed-documentation/COMPREHENSIVE_REPOSITORY_ANALYSIS.md)
- [🏗️ Architecture Guide](./docs/detailed-documentation/DETAILED_ARCHITECTURE_GUIDE.md)
- [⚙️ Implementation Guide](./docs/detailed-documentation/COMPLETE_IMPLEMENTATION_GUIDE.md)

**🤖 AI & Development:**
- [🧠 AI Flows Documentation](./docs/detailed-documentation/AI_FLOWS_DATA_ARCHITECTURE.md)
- [👨‍💻 Developer Setup Guide](./docs/detailed-documentation/DEVELOPER_SETUP_DEPLOYMENT_GUIDE.md)

---

**Built with ❤️ using Next.js 15, Google Gemini AI, and Firebase Storage** | **Production-ready with advanced CORS handling and progressive uploads**
