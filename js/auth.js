import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, SETTINGS } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ---- Fake withdrawals ticker ----
async function loadTicker() {
  const track = document.getElementById("tickerTrack");
  if (!track) return;
  const snap = await getDocs(collection(db, "fakeWithdrawals"));
  let items = [];
  snap.forEach(d => items.push(d.data()));
  if (items.length === 0) {
    // default seed items
    items = [
      { name: "Ali R.", amount: 450, method: "JazzCash" },
      { name: "Sara K.", amount: 300, method: "EasyPaisa" },
      { name: "Usman T.", amount: 650, method: "JazzCash" },
      { name: "Hina M.", amount: 200, method: "EasyPaisa" },
      { name: "Bilal A.", amount: 800, method: "Bank Transfer" },
    ];
  }
  const html = items.map(i =>
    `<span class="ticker-item">✅ ${i.name} ne ₨${i.amount} ${i.method} se withdraw kiye</span>`
  ).join("");
  track.innerHTML = html + html; // duplicate for seamless loop
}
loadTicker();

// ---- Referral code capture ----
const urlParams = new URLSearchParams(window.location.search);
const refCode = urlParams.get("ref");
if (refCode) {
  localStorage.setItem("kamao_ref", refCode);
  const hint = document.getElementById("refHint");
  if (hint) { hint.style.display = "block"; hint.textContent = "Aap " + refCode + " ke referral se aaye hain. Signup karein."; }
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

async function createUserDoc(uid, email) {
  let referredByUid = null;
  const storedRef = localStorage.getItem("kamao_ref");
  if (storedRef) {
    const q = query(collection(db, "users"), where("referralCode", "==", storedRef));
    const snap = await getDocs(q);
    if (!snap.empty) referredByUid = snap.docs[0].id;
  }
  // Check if user doc already exists
  const existing = await getDoc(doc(db, "users", uid));
  if (existing.exists()) return;

  await setDoc(doc(db, "users", uid), {
    email,
    balance: 0,
    referralBonus: 0,
    referralCode: randomCode(),
    referredBy: referredByUid,
    referralBonusPaid: false,   // track if inviter already got 10% bonus
    dailyAdsWatched: 0,
    lastAdDate: "",
    lastAdTimestamp: 0,
    plan: "free",               // free | silver | gold
    planExpiry: 0,
    createdAt: Date.now()
  });
  localStorage.removeItem("kamao_ref");
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
    await createUserDoc(cred.user.uid, email);
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

// ---- Google Login ----
document.getElementById("googleBtn").addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    await createUserDoc(result.user.uid, result.user.email);
    window.location.href = "dashboard.html";
  } catch (err) {
    console.error(err);
  }
});

function friendlyError(code) {
  const map = {
    "auth/email-already-in-use": "Ye email pehle se register hai. Login karein.",
    "auth/invalid-email": "Email sahi format mein daalein.",
    "auth/weak-password": "Password kam se kam 6 characters ka ho.",
    "auth/user-not-found": "Ye account nahi mila. Signup karein.",
    "auth/wrong-password": "Password ghalat hai.",
    "auth/invalid-credential": "Email ya password ghalat hai.",
  };
  return map[code] || "Kuch masla hua, dobara koshish karein.";
}

onAuthStateChanged(auth, (user) => {
  if (user && window.location.pathname.includes("index")) {
    window.location.href = "dashboard.html";
  }
});
