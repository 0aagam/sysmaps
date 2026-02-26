# SysMap — Setup Guide

## Files
```
sysmap/
├── index.html          ← app shell (don't touch)
├── css/style.css       ← all styling (don't touch)
├── js/
│   ├── config.js       ← EDIT THIS: your Firebase keys go here
│   ├── themes.js       ← theme system (don't touch)
│   └── app.js          ← all logic (don't touch)
├── manifest.json       ← PWA config
├── sw.js               ← service worker (offline)
├── icon-192.png        ← app icon
├── icon-512.png        ← app icon hi-res
└── vercel.json         ← Vercel routing
```

---

## Step 1 — Firebase (10 min)

1. Go to **console.firebase.google.com** → Create project → name it anything
2. **Authentication** → Get started → Google → Enable → save
3. **Firestore Database** → Create database → Production mode → pick nearest region → Done
4. Paste Firestore rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
5. **No Storage needed** — images stored in Firestore as base64. Free.

---

## Step 2 — Config (2 min)

Project Overview → `</>` web icon → Register app → copy `firebaseConfig`

Open `js/config.js` and replace the REPLACE_ values.

---

## Step 3 — Deploy to Vercel (3 min)

1. vercel.com → sign up free → New Project
2. Drag this entire folder onto the page
3. Deploy → you get a live URL

Add that URL to Firebase: Authentication → Settings → Authorized domains → Add domain

---

## Themes

**Built-in:** Obsidian (dark), Paper (light), Midnight (dark blue)

**Export your theme:** Header → Theme → Export current theme → saves a `.json` file

**Import a theme:** Header → Theme → Import theme → pick the `.json` file

The Obsidian theme (your original dark theme) is preserved and always available. When you export it you get a JSON file you can share or re-import on any deployment.

---

## Install as app

**iPhone:** Safari → Share → Add to Home Screen  
**Android:** Chrome → ⋯ → Add to Home Screen  
**Desktop:** Chrome address bar → install icon  

---

## Free tier at 100–200 users

| Service | Free limit | Status |
|---|---|---|
| Firebase Auth | 10,000 users/month | ✓ Safe |
| Firestore reads | 50,000/day | ✓ Safe (cached) |
| Firestore writes | 20,000/day | ✓ Safe (debounced) |
| Firebase Storage | Not used | ✓ Free |
| Vercel hosting | Unlimited | ✓ Free forever |

Images stored as base64 in Firestore. Each image ~100KB after compression. Firestore document limit is 1MB per doc — large images auto-split across the images sub-collection.

---

## Keyboard shortcuts

| Action | Shortcut |
|---|---|
| Save node | Ctrl/Cmd + S |
| New node | Ctrl/Cmd + N |
| Close panel | Escape |
