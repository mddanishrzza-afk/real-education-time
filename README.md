# 🎓 REAL EDUCATION TIME

**Learn • Practice • Test • Improve**

A professional, responsive EdTech platform for school students with quizzes, leaderboards, certificates, and role-based Teacher/Admin panels.

## ✨ Features
- Student registration / login (Firebase Auth) + forgot password
- Subjects: Physics, Chemistry, Biology, Mathematics, Computer, General Knowledge
- Timed MCQ quiz engine (countdown, progress bar, auto-next, confirmation)
- Results page: score, percentage, grade (A/B/C), time, answer review with explanations
- Student dashboard with charts, recent quizzes, performance tracking
- Live leaderboard from real result data
- Certificate generation with professional design + **Download as PDF**
- Hindi/English language switching
- Light/Dark mode (persisted)
- Teacher panel: manage quizzes & questions, view student performance
- Admin panel: users, subjects, quizzes, questions, results, certificates
- Fully responsive (320px → desktop)

## 🚀 Getting Started

### 1. Install
```bash
npm install
npm run dev
```

### 2. Firebase setup (REQUIRED for real auth & database)
1. Go to https://console.firebase.google.com and **Create a new project**.
2. In the project, add a **Web app** (</> icon).
3. In **Project Settings → General → Your apps**, copy the firebaseConfig values.
4. In the project root, copy the template:
   ```bash
   cp .env.example .env
   ```
5. Paste your real values into `.env` (the `VITE_FIREBASE_*` keys).
6. In Firebase Console, enable **Authentication → Sign-in method → Email/Password**.
7. Create **Cloud Firestore** database (Production mode).
8. Deploy the security rules in `firestore.rules`:
   - Console → Firestore Database → Rules → paste → Publish
9. **Create your first Admin account:**
   - Register a normal student account first (from the app UI).
   - In Firestore console, open `users/{userId}` and change `role` to `"admin"`.
   - Then log in as that user to access `/admin`.

> **Never commit your `.env` file.** It is already in `.gitignore`.

### Gemini AI (optional, auto-generate questions)
1. Get a free API key: https://aistudio.google.com/apikey
2. Add it to `.env`: `VITE_GEMINI_API_KEY=your_key`
3. In the Teacher/Admin quiz editor, click **✨ Generate with AI**.
> ⚠️ The key is visible to end users in this direct-browser setup. For production, move this call to a serverless function.

## 🚢 Deployment (Vercel / Netlify)
This is a static Vite SPA. `vercel.json` and `netlify.toml` are included so React Router works on any route.

**Vercel:**
1. Push the repo to GitHub.
2. On Vercel, import the repo (Framework: Vite). It auto-detects the build.
3. In **Project Settings → Environment Variables**, add the `VITE_FIREBASE_*` keys and `VITE_GEMINI_API_KEY`.
4. Deploy.

**Netlify:**
1. Import the repo (Build command `npm run build`, Publish `dist`).
2. Add the same env vars under Site Settings → Environment variables.
3. Deploy.

> Set env vars on the hosting platform — do NOT ship `.env` with real keys in the repo.

### 3. Roles
| Role | Access |
|------|--------|
| student | Dashboard, quizzes, results, leaderboard, certificates, profile |
| teacher | Teacher panel (manage quizzes/questions, view performance) |
| admin | Admin panel (users, subjects, quizzes, questions, results, certificates) |

## 🗂 Project Structure
```
src/
├── components/       # Layout, ProtectedRoute, UI, panels (Quiz/Question/Subject managers)
├── pages/            # Landing, Auth, Dashboard, Quiz, Result, Leaderboard, etc.
├── context/          # Auth, Language, Theme
├── services/         # store (Firestore/localStorage), certificate PDF
├── firebase/         # Firebase init
├── i18n/             # English + Hindi translations
├── data/             # Sample subjects & quizzes
├── utils/            # helpers
├── styles/           # global.css (design system + dark mode)
├── App.jsx
└── main.jsx
```

## 🔒 Security Notes
- Passwords are **never** stored in Firestore (Firebase handles them).
- Role-based route guards protect Teacher/Admin pages.
- Firestore rules enforce role-based read/write access.
- Students can only create/read their own results.

## 🧪 Demo mode
If `.env` is not configured, the app runs in a clearly-labelled **demo mode** using browser `localStorage` so every flow (register, quiz, results, leaderboard, certificates) is testable. Add your Firebase config to switch to real backend.
