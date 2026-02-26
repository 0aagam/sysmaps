// ══════════════════════════════════════════════
// SYSMAP — FIREBASE CONFIG
// Edit this file with your Firebase project details.
// Get this from: console.firebase.google.com
//   → Your project → Project Settings → Your apps → Web app
//
// Steps:
// 1. Create Firebase project at console.firebase.google.com
// 2. Enable Authentication → Google sign-in
// 3. Create Firestore database (production mode)
// 4. Paste your config below
// 5. Deploy to Vercel by dragging this folder
// ══════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey:            "REPLACE_API_KEY",
  authDomain:        "REPLACE.firebaseapp.com",
  projectId:         "REPLACE_PROJECT_ID",
  storageBucket:     "REPLACE.appspot.com",
  messagingSenderId: "REPLACE_SENDER_ID",
  appId:             "REPLACE_APP_ID"
};

// ── FIRESTORE RULES (paste into Firebase Console → Firestore → Rules) ──
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /users/{userId}/{document=**} {
//       allow read, write: if request.auth != null && request.auth.uid == userId;
//     }
//   }
// }
//
// NOTE: No Firebase Storage needed. Images are stored as base64 in
// Firestore documents. This keeps everything on the free tier.
