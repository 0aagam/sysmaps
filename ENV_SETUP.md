# Environment Configuration Setup

Your application has been configured to use environment variables for sensitive configuration like Firebase credentials.

## Local Development

### 1. Copy the example file
```bash
cp .env.example .env
```

### 2. Fill in your credentials
Edit the `.env` file and add your Firebase configuration values:
```
FIREBASE_API_KEY=your_actual_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 3. Get your credentials
- Go to [Firebase Console](https://console.firebase.google.com)
- Select your project
- Click **Project Settings** (gear icon)
- Find your **Web App Configuration** and copy the values

### Important: Never commit .env files
The `.env` file is listed in `.gitignore` and should **never** be committed to version control. Only commit `.env.example` which contains placeholder values.

## Vercel Deployment

### 1. Set environment variables in Vercel dashboard
1. Go to your Vercel project dashboard
2. Navigate to **Settings → Environment Variables**
3. Add each variable:
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
   - `FIREBASE_MEASUREMENT_ID`

### 2. Configure for client-side access
Since this is a client-side app, you'll also need to configure these as client-accessible environment variables in Vercel.

## How It Works

1. **env-loader.js** - Loads the `.env` file on page startup and makes variables available via `window.ENV`
2. **config.js** - Reads from `window.ENV` (if available) with fallback to hardcoded values
3. **Application** - Uses `FIREBASE_CONFIG` which is populated from environment variables

## Fallback Values

The configuration includes fallback values for the current Firebase project. If environment variables are not available, these defaults will be used.

## Security Notes

✅ **Good practices:**
- Keep `.env` file in `.gitignore`
- Use `.env.example` with placeholder values for documentation
- Rotate Firebase keys regularly
- Use appropriate Firebase security rules

⚠️ **Be careful:**
- Never expose `.env` file in version control
- Don't share your `.env` file with others
- Regularly review who has access to your Firebase project
