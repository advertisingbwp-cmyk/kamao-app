import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, SETTINGS } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Fill hero stats from settings
document.getElementById("statReward").textContent = "$" + SETTINGS.REWARD_PER_AD.toFixed(2);
document.getElementById("statLimit").textContent = SETTINGS.DAILY_AD_LIMIT;
document.getElementById("statMin").textContent = "$" + SETTINGS.MIN_WITHDRAWAL;

// ---- Referral code capture (from ?ref=CODE in URL) ----
const urlParams = new URLSearchParams(window.location.search);
const refCode = urlParams.get("ref");
if (refCode) {
  localStorage.setItem("kamao_ref", refCode);
  document.getElementById("refHint").style.display = "block";
  document.getElementById("refHint").textContent = "Aap " + refCode + " ke referral se aaye hain. Signup karein.";
  // default to signup tab if a referral link brought them here
  document.getElementById("tabSignup").click();
}

// ---- Tab switching ----
const tabLogin = document.getElementById("tabLogin");
const tabSignup = document.getElementById("tabSignup");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("active"); tabSignup.classList.remove("active");
  loginForm.style.display = "block"; signupForm.style.display = "none";
});
tabSignup.addEventListener("click", () => {
  tabSignup.classList.add("active"); tabLogin.classList.remove("active");
  signupForm.style.display = "block"; loginForm.style.display = "none";
});

function randomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ---- Signup ----
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const errEl = document.getElementById("signupError");
  errEl.style.display = "none";

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    // Resolve referredBy: look up which uid owns this referral code
    let referredByUid = null;
    const storedRef = localStorage.getItem("kamao_ref");
    if (storedRef) {
      const q = query(collection(db, "users"), where("referralCode", "==", storedRef));
      const snap = await getDocs(q);
      if (!snap.empty) {
        referredByUid = snap.docs[0].id;
      }
    }

    await setDoc(doc(db, "users", uid), {
      email,
      balance: 0,
      referralBonus: 0,
      referralCode: randomCode(),
      referredBy: referredByUid,
      dailyAdsWatched: 0,
      lastAdDate: "",
      lastAdTimestamp: 0,
      createdAt: Date.now()
    });

    localStorage.removeItem("kamao_ref");
    window.location.href = "dashboard.html";
  } catch (err) {
    errEl.textContent = friendlyError(err.code);
    errEl.style.display = "block";
  }
});

// ---- Login ----
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");
  errEl.style.display = "none";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "dashboard.html";
  } catch (err) {
    errEl.textContent = friendlyError(err.code);
    errEl.style.display = "block";
  }
});

function friendlyError(code) {
  const map = {
    "auth/email-already-in-use": "Ye email pehle se register hai. Login karein.",
    "auth/invalid-email": "Email sahi format mein daalein.",
    "auth/weak-password": "Password kam se kam 6 characters ka ho.",
    "auth/user-not-found": "Ye account nahi mila. Signup karein.",
    "auth/wrong-password": "Password ghalat hai.",
    "auth/invalid-credential": "Email ya password ghalat hai."
  };
  return map[code] || "Kuch masla hua, dobara koshish karein.";
}

// If already logged in, skip straight to dashboard
onAuthStateChanged(auth, (user) => {
  if (user && window.location.pathname.endsWith("index.html")) {
    // don't force-redirect automatically to avoid surprising the user mid-signup
  }
});
