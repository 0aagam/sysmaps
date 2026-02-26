// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDhSDk2JLRx7Gx3ostmFZ6IWqO8PnEdRaM",
  authDomain: "sysmaps-3378d.firebaseapp.com",
  projectId: "sysmaps-3378d",
  storageBucket: "sysmaps-3378d.firebasestorage.app",
  messagingSenderId: "21224827114",
  appId: "1:21224827114:web:eb4ffd4249eff31a134f93",
  measurementId: "G-Z5S9V3WBF8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
