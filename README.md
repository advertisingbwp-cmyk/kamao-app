# Kamao — Ads Dekho, Kamao

Ye website users ko ads dikha kar reward deti hai, referral commission deti hai, aur withdrawal requests leti hai jo aap **manually** process karte hain.

## ⚠️ Zaroor Parhein — Real Risk

Adsterra (aur zyada tar ad networks) ki policy "incentivized traffic" ko allow nahi karti — yaani users ko paisa dene ka wada karke ad dikhwana. Chahe traffic 100% real logon ka ho, agar Adsterra ko pata chale ke views/clicks incentive-based hain, to **aapka account suspend/ban ho sakta hai** aur pending balance zabt ho sakti hai. Ye site banane se pehle Adsterra ki Terms of Service khud padh lein. Is code ka maqsad sirf aapko dikhana hai ke system technically kaise kaam karta hai — business decision aapki hai.

## Setup Steps

### 1. Firebase Project Banayein (Free)
1. https://console.firebase.google.com par jayein, naya project banayein
2. Left menu se **Build → Authentication → Get Started → Email/Password → Enable**
3. Left menu se **Build → Firestore Database → Create Database → Production mode**
4. Project Settings (gear icon) → scroll down → **"Add app" → Web (</>)** → app register karein
5. Jo config object milega, use `js/firebase-config.js` mein paste karein

### 2. Firestore Security Rules
Firestore → Rules tab mein ye paste karein aur Publish karein:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /withdrawals/{docId} {
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
      allow read: if request.auth != null &&
                  (request.auth.uid == resource.data.uid || request.auth.token.email == "PASTE_YOUR_ADMIN_EMAIL_HERE");
      allow update: if request.auth != null && request.auth.token.email == "PASTE_YOUR_ADMIN_EMAIL_HERE";
    }
  }
}
```

Replace `PASTE_YOUR_ADMIN_EMAIL_HERE` with the same email you set in `SETTINGS.ADMIN_EMAIL` inside `js/firebase-config.js`.

### 3. Apni Settings Set Karein
`js/firebase-config.js` khol kar `SETTINGS` object mein:
- `REWARD_PER_AD` — per-ad kitna dena hai
- `DAILY_AD_LIMIT` — ek user din mein max kitne ads dekh sakta hai
- `WITHDRAWAL_FEE_PERCENT` / `REFERRAL_SHARE_PERCENT` — apna commission structure
- `ADMIN_EMAIL` — apna email, admin.html sirf isi email se khulega

### 4. Adsterra Ad Code Lagayein
`dashboard.html` mein `<div class="ad-slot" id="adSlot">` ke andar apna Adsterra ad unit script/iframe paste karein. `js/dashboard.js` mein `startAdTimer()` function ke andar comment likha hai wahan bhi dekh lein.

### 5. Deploy
Ye poora folder Vercel ya Netlify par drag-and-drop kar dein (jaisa aap pehle Haveli Village site ke liye kar chuke hain) — koi build step nahi chahiye, seedha static files hain.

### 6. Admin Panel
`yourdomain.com/admin.html` par jayein, jis email se aap login karenge wahi `ADMIN_EMAIL` se match hona chahiye. Yahan aapko sab pending withdrawal requests dikhengi — aap manually JazzCash/Bank se paisa bhej kar "Mark Paid" click kar dein.

## File Structure
```
kamao-app/
├── index.html          → Login/Signup page
├── dashboard.html       → User's earning dashboard
├── admin.html           → Admin panel (manual payouts)
├── css/style.css
└── js/
    ├── firebase-config.js  → apni keys + settings yahan
    ├── auth.js              → login/signup logic
    ├── dashboard.js         → ad timer, wallet, referral, withdrawal
    └── admin.js             → admin panel logic
```
