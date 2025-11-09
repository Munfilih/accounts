# Firebase Setup Instructions

## 1. Firebase Console Setup

### Enable Authentication:
1. Go to Firebase Console → Authentication
2. Click "Sign-in method" tab
3. Enable "Email/Password" provider
4. Save changes

### Enable Firestore Database:
1. Go to Firestore Database
2. Click "Create database"
3. Start in "Test mode"
4. Choose location (closest to users)

### Deploy Firestore Rules:
1. Go to Firestore Database → Rules
2. Copy content from `firestore.rules` file
3. Click "Publish"

## 2. Verify Configuration

Your Firebase config should match:
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyDOdcYVkewFy_jqfJTIY4qeqcn-mWa0Ww8",
    authDomain: "polosysaccounts-a494e.firebaseapp.com",
    projectId: "polosysaccounts-a494e",
    storageBucket: "polosysaccounts-a494e.firebasestorage.app",
    messagingSenderId: "775822338953",
    appId: "1:775822338953:web:1e40b736cbcf760d200f58"
};
```

## 3. Test the Application

1. Open `login.html` in browser
2. Try signing up with email/password
3. Login should redirect to dashboard
4. Check Firebase Console → Authentication → Users to see registered users