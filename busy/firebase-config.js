// Firebase Configuration for Ibad Accounts ERP
// ===========================================
// HOW TO SET UP:
// 1. Go to https://console.firebase.google.com/
// 2. Create a new project (or use existing)
// 3. Go to Project Settings > General > Your Apps
// 4. Add a Web App (</>)
// 5. Copy the firebaseConfig below and paste it here
// 6. Enable Realtime Database in Firebase Console:
//    - Go to Build > Realtime Database
//    - Click "Create Database"
//    - Choose your region
//    - Start in TEST MODE (we'll secure it later)
// 7. Enable Authentication > Email/Password sign-in method

// REPLACE THE VALUES BELOW WITH YOUR OWN FIREBASE PROJECT CONFIG
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();
    
    console.log('Firebase initialized successfully');
    
    // Test connection
    db.ref('.info/connected').on('value', (snap) => {
        if (snap.val() === true) {
            console.log('Connected to Firebase Realtime Database');
        } else {
            console.log('Disconnected from Firebase');
        }
    });
    
    // Export for use in other modules
    window.firebaseApp = firebase;
    window.firebaseAuth = auth;
    window.firebaseDB = db;
    
} catch (error) {
    console.error('Firebase initialization error:', error);
    alert('Failed to connect to Firebase. Please check your configuration.');
}
