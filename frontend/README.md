# PropTrack web app

React + Vite. Login is **Firebase Auth** (email/password + Google); all data comes from the PropTrack API.

1. Firebase console → add a Web app → copy its config into `.env.local` (see `.env.example`).
2. Authentication → Sign-in method → enable **Email/Password** and **Google**.
3. Authentication → Settings → Authorized domains → add your production domain.
4. `npm install && npm run dev` (the API must be running on port 5000, or set `VITE_API_URL`).
