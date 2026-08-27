// ============================================================
// FIREBASE CONFIG — replace with YOUR OWN Firebase project keys
// ============================================================
// How to get these:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (free)
// 3. Add a "Web App" inside the project
// 4. Copy the config object it gives you and paste it below
// 5. In Firebase Console, enable:
//      - Authentication -> Sign-in method -> Email/Password
//      - Firestore Database -> Create database (production mode)
// 6. Paste the Firestore rules from README.md into
//      Firestore -> Rules tab
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyB3Uq1sb3pwRAn4qKii14TEsmj0oB6K9ZI",
  authDomain: "kamao-d8d2e.firebaseapp.com",
  projectId: "kamao-d8d2e",
  storageBucket: "kamao-d8d2e.firebasestorage.app",
  messagingSenderId: "98560234172",
  appId: "1:98560234172:web:e00a2f7186f08d8fa936b9",
  measurementId: "G-5T1GL4CKZN"
};

// ============================================================
// APP SETTINGS — tweak these numbers to control your economics
// ============================================================
export const SETTINGS = {
  REWARD_PER_AD: 0.02,        // $ credited to user per ad watched
  DAILY_AD_LIMIT: 15,         // max ads a single user can watch per day
  AD_WATCH_SECONDS: 20,       // how long the timer runs before reward unlocks
  COOLDOWN_SECONDS: 45,       // gap required between two ad watches
  MIN_WITHDRAWAL: 5,          // minimum $ a user must have to request withdrawal
  WITHDRAWAL_FEE_PERCENT: 10, // total fee you take on withdrawal
  REFERRAL_SHARE_PERCENT: 5,  // portion of that fee passed to the inviter (must be <= WITHDRAWAL_FEE_PERCENT)
  ADMIN_EMAIL: "you@example.com" // ONLY this email can open admin.html
};
