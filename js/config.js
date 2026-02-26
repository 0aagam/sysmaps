// Firebase Configuration from environment variables
// Export the config object for use in other modules
export const FIREBASE_CONFIG = {
  apiKey: window.ENV?.FIREBASE_API_KEY || "AIzaSyDhSDk2JLRx7Gx3ostmFZ6IWqO8PnEdRaM",
  authDomain: window.ENV?.FIREBASE_AUTH_DOMAIN || "sysmaps-3378d.firebaseapp.com",
  projectId: window.ENV?.FIREBASE_PROJECT_ID || "sysmaps-3378d",
  storageBucket: window.ENV?.FIREBASE_STORAGE_BUCKET || "sysmaps-3378d.firebasestorage.app",
  messagingSenderId: window.ENV?.FIREBASE_MESSAGING_SENDER_ID || "21224827114",
  appId: window.ENV?.FIREBASE_APP_ID || "1:21224827114:web:eb4ffd4249eff31a134f93",
  measurementId: window.ENV?.FIREBASE_MEASUREMENT_ID || "G-Z5S9V3WBF8"
};

// Initialize Firebase and return the instances
export function initializeFirebase() {
  firebase.initializeApp(FIREBASE_CONFIG);
  return {
    auth: firebase.auth(),
    db: firebase.firestore()
  };
}
