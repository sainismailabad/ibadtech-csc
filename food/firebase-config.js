// Firebase Configuration - Ibad Foodz
const firebaseConfig = {
    apiKey: "AIzaSyBubqyuu6OrPvxcPAOoy6_V20tSar4Bnos",
    authDomain: "ibadecomerce.firebaseapp.com",
    databaseURL: "https://ibadecomerce-default-rtdb.firebaseio.com",
    projectId: "ibadecomerce",
    storageBucket: "ibadecomerce.firebasestorage.app",
    messagingSenderId: "784111761552",
    appId: "1:784111761552:web:9a04705daee23928048015",
    measurementId: "G-59Y6M9J4S8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
window.db = db;