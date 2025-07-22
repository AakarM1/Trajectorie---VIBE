# Test Users Documentation

## Overview
The application now automatically seeds the localStorage database with **11 users total**:
- **1 Administrator**
- **10 Test Users** with diverse profiles

## Administrator Account
- **Email**: `admin@gmail.com`
- **Password**: `admin@123`
- **Name**: System Administrator
- **ID**: ADMIN001
- **Company**: Trajectorie
- **Role**: Administrator

## Test User Accounts
All test users have the password: `test123`

### Test User 1
- **Email**: `test1@gmail.com`
- **Name**: John Smith
- **ID**: T001
- **Company**: TechCorp Solutions
- **Role**: Software Engineer

### Test User 2
- **Email**: `test2@gmail.com`
- **Name**: Sarah Johnson
- **ID**: T002
- **Company**: DataTech Inc
- **Role**: Data Analyst

### Test User 3
- **Email**: `test3@gmail.com`
- **Name**: Michael Brown
- **ID**: T003
- **Company**: InnovateLabs
- **Role**: Product Manager

### Test User 4
- **Email**: `test4@gmail.com`
- **Name**: Emily Davis
- **ID**: T004
- **Company**: FinanceFirst
- **Role**: Financial Analyst

### Test User 5
- **Email**: `test5@gmail.com`
- **Name**: David Wilson
- **ID**: T005
- **Company**: MarketPro
- **Role**: Marketing Manager

### Test User 6
- **Email**: `test6@gmail.com`
- **Name**: Lisa Anderson
- **ID**: T006
- **Company**: SalesForce Pro
- **Role**: Sales Representative

### Test User 7
- **Email**: `test7@gmail.com`
- **Name**: Robert Taylor
- **ID**: T007
- **Company**: ConsultCorp
- **Role**: Business Consultant

### Test User 8
- **Email**: `test8@gmail.com`
- **Name**: Jennifer Lee
- **ID**: T008
- **Company**: HRSolutions
- **Role**: HR Specialist

### Test User 9
- **Email**: `test9@gmail.com`
- **Name**: Christopher Garcia
- **ID**: T009
- **Company**: OperationsHub
- **Role**: Operations Manager

### Test User 10
- **Email**: `test10@gmail.com`
- **Name**: Amanda Martinez
- **ID**: T010
- **Company**: DesignStudio
- **Role**: UX Designer

## How to Use

### View All Users
- Click the "Show Users" button in the bottom-left corner of the page
- This will display all seeded users in a popup panel

### Login as Any User
1. Go to the login page (`/login`)
2. Use any of the email/password combinations above
3. The system will authenticate and log you in

### Access Admin Features
- Use the admin account to access administrative functions
- Admin users have elevated permissions for managing the system

## Seeding Behavior

### First Time Setup
- Users are automatically seeded when the app starts
- If localStorage is empty, all 11 users are created

### Subsequent Loads
- The system checks if users already exist
- If users are found, no additional seeding occurs
- This prevents duplicate user creation

### Firestore Mode
- When valid Firebase credentials are provided, the same users are seeded in Firestore
- This ensures consistency between storage modes

## Development Tools

### Clear and Re-seed
To force fresh seeding during development:
1. Open browser developer tools (F12)
2. Go to Application/Storage tab
3. Clear localStorage data
4. Refresh the page

### Debug Console
- Seeding completion is logged to the browser console
- Look for: "✅ Seeded localStorage with 1 admin and 10 test users"

## Security Notes
- **Development Only**: These are test accounts for development purposes
- **Simple Passwords**: Passwords are intentionally simple for testing
- **Production**: In production, implement proper password hashing and complexity requirements
