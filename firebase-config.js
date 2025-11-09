// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDOdcYVkewFy_jqfJTIY4qeqcn-mWa0Ww8",
  authDomain: "polosysaccounts-a494e.firebaseapp.com",
  projectId: "polosysaccounts-a494e",
  storageBucket: "polosysaccounts-a494e.firebasestorage.app",
  messagingSenderId: "775822338953",
  appId: "1:775822338953:web:1e40b736cbcf760d200f58",
  measurementId: "G-R9MP6FNJX9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);