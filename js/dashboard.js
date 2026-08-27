import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, updateDoc, collection, addDoc, query, where, orderBy, getDocs, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, SETTINGS } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let userData = null;
const RADIUS = 66;
const CIRC = 2 * Math.PI * RADIUS;
document.getElementById("ringFg").style.strokeDasharray = CIRC;
document.getElementById("ringFg").style.strokeDashoffset = CIRC;

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "index.html"; return; }
  currentUser = user;
  document.getElementById("userEmail").textContent = user.email;
  await loadUser();
  loadHistory();
});

async function loadUser() {
  const ref = doc(db, "users", currentUser.uid);
  const snap = await getDoc(ref);
  userData = snap.data();

  // Reset daily counter if it's a new day
  if (userData.lastAdDate !== todayStr()) {
    userData.dailyAdsWatched = 0;
    await updateDoc(ref, { dailyAdsWatched: 0, lastAdDate: todayStr() });
  }

  renderUser();
}

function renderUser() {
  const total = (userData.balance || 0) + (userData.referralBonus || 0);
  document.getElementById("balanceAmount").textContent = "$" + total.toFixed(2);
  document.getElementById("earnPart").textContent = "$" + (userData.balance || 0).toFixed(2);
  document.getElementById("refPart").textContent = "$" + (userData.referralBonus || 0).toFixed(2);

  const watched = userData.dailyAdsWatched || 0;
  const pct = Math.min(100, (watched / SETTINGS.DAILY_AD_LIMIT) * 100);
  document.getElementById("dailyFill").style.width = pct + "%";
  document.getElementById("dailyLabel").textContent = `${watched} / ${SETTINGS.DAILY_AD_LIMIT} ads aaj`;

  const refLink = `${window.location.origin}${window.location.pathname.replace("dashboard.html","index.html")}?ref=${userData.referralCode}`;
  document.getElementById("refLink").value = refLink;

  document.getElementById("wdFeeHint").textContent =
    `Fee: ${SETTINGS.WITHDRAWAL_FEE_PERCENT}% (isme se ${SETTINGS.REFERRAL_SHARE_PERCENT}% aapke inviter ko jata hai agar aap referred hain). Minimum withdrawal $${SETTINGS.MIN_WITHDRAWAL}.`;

  updateWatchButton();
}

// ---------------- WATCH AD FLOW ----------------
const watchBtn = document.getElementById("watchBtn");
const ringFg = document.getElementById("ringFg");
const ringSecs = document.getElementById("ringSecs");
let timerInterval = null;

function updateWatchButton() {
  const watched = userData.dailyAdsWatched || 0;
  const now = Date.now();
  const cooldownLeft = SETTINGS.COOLDOWN_SECONDS * 1000 - (now - (userData.lastAdTimestamp || 0));

  if (watched >= SETTINGS.DAILY_AD_LIMIT) {
    watchBtn.disabled = true;
    watchBtn.textContent = "Aaj ki limit khatam — kal wapis aayein";
  } else if (cooldownLeft > 0) {
    watchBtn.disabled = true;
    let remaining = Math.ceil(cooldownLeft / 1000);
    watchBtn.textContent = `Thodi der intezar karein (${remaining}s)`;
    setTimeout(updateWatchButton, 1000);
  } else {
    watchBtn.disabled = false;
    watchBtn.textContent = "Ad Dekhna Shuru Karein";
  }
}

watchBtn.addEventListener("click", () => {
  if (watchBtn.disabled) return;
  startAdTimer();
});

function startAdTimer() {
  watchBtn.disabled = true;
  watchBtn.textContent = "Ad chal rahi hai...";
  document.getElementById("adSlot").textContent = "Ad chal rahi hai — poora dekhein...";
  // NOTE: Replace the text above with your actual Adsterra ad unit
  // (script tag or iframe) so a real ad renders inside #adSlot.

  let remaining = SETTINGS.AD_WATCH_SECONDS;
  ringSecs.textContent = remaining + "s";

  timerInterval = setInterval(() => {
    remaining--;
    const progress = 1 - remaining / SETTINGS.AD_WATCH_SECONDS;
    ringFg.style.strokeDashoffset = CIRC - progress * CIRC;
    ringSecs.textContent = remaining > 0 ? remaining + "s" : "✓";

    if (remaining <= 0) {
      clearInterval(timerInterval);
      claimReward();
    }
  }, 1000);
}

async function claimReward() {
  document.getElementById("adSlot").textContent = "Yahan aapka Adsterra ad code load hoga";
  const ref = doc(db, "users", currentUser.uid);
  const newWatched = (userData.dailyAdsWatched || 0) + 1;

  await updateDoc(ref, {
    balance: increment(SETTINGS.REWARD_PER_AD),
    dailyAdsWatched: newWatched,
    lastAdDate: todayStr(),
    lastAdTimestamp: Date.now()
  });

  userData.balance = (userData.balance || 0) + SETTINGS.REWARD_PER_AD;
  userData.dailyAdsWatched = newWatched;
  userData.lastAdTimestamp = Date.now();
  userData.lastAdDate = todayStr();

  ringFg.style.strokeDashoffset = CIRC;
  ringSecs.textContent = "Ready";
  renderUser();
}

// ---------------- REFERRAL COPY ----------------
document.getElementById("copyRefBtn").addEventListener("click", () => {
  const input = document.getElementById("refLink");
  input.select();
  navigator.clipboard.writeText(input.value);
  const btn = document.getElementById("copyRefBtn");
  btn.textContent = "Copied!";
  setTimeout(() => (btn.textContent = "Copy"), 1500);
});

// ---------------- WITHDRAWAL ----------------
document.getElementById("withdrawForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("wdError");
  errEl.style.display = "none";

  const amount = parseFloat(document.getElementById("wdAmount").value);
  const method = document.getElementById("wdMethod").value;
  const details = document.getElementById("wdDetails").value.trim();
  const totalBalance = (userData.balance || 0) + (userData.referralBonus || 0);

  if (amount < SETTINGS.MIN_WITHDRAWAL) {
    errEl.textContent = `Minimum withdrawal $${SETTINGS.MIN_WITHDRAWAL} hai.`;
    errEl.style.display = "block";
    return;
  }
  if (amount > totalBalance) {
    errEl.textContent = "Itna balance nahi hai.";
    errEl.style.display = "block";
    return;
  }

  // Deduct proportionally from earning balance first, then referral bonus
  let fromEarning = Math.min(userData.balance || 0, amount);
  let fromReferral = amount - fromEarning;

  const feeAmount = amount * (SETTINGS.WITHDRAWAL_FEE_PERCENT / 100);
  const netToUser = amount - feeAmount;

  let referrerCommission = 0;
  let referrerUid = userData.referredBy || null;
  if (referrerUid) {
    referrerCommission = amount * (SETTINGS.REFERRAL_SHARE_PERCENT / 100);
  }

  // Create withdrawal record
  await addDoc(collection(db, "withdrawals"), {
    uid: currentUser.uid,
    email: currentUser.email,
    amount,
    feeAmount,
    netToUser,
    method,
    details,
    status: "pending",
    referrerUid,
    referrerCommission,
    createdAt: Date.now()
  });

  // Deduct from user's balances immediately (escrow until admin pays out)
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, {
    balance: increment(-fromEarning),
    referralBonus: increment(-fromReferral)
  });
  userData.balance -= fromEarning;
  userData.referralBonus -= fromReferral;

  // Credit referrer's bonus balance right away
  if (referrerUid && referrerCommission > 0) {
    const referrerRef = doc(db, "users", referrerUid);
    await updateDoc(referrerRef, { referralBonus: increment(referrerCommission) });
  }

  document.getElementById("withdrawForm").reset();
  renderUser();
  loadHistory();
});

// ---------------- HISTORY ----------------
async function loadHistory() {
  const q = query(collection(db, "withdrawals"), where("uid", "==", currentUser.uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const body = document.getElementById("historyBody");
  const emptyEl = document.getElementById("historyEmpty");
  body.innerHTML = "";

  if (snap.empty) {
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  snap.forEach((d) => {
    const w = d.data();
    const date = new Date(w.createdAt).toLocaleDateString();
    const tagClass = w.status === "paid" ? "tag-paid" : "tag-pending";
    body.innerHTML += `
      <tr>
        <td>${date}</td>
        <td class="mono">$${w.amount.toFixed(2)}</td>
        <td>${w.method}</td>
        <td><span class="tag ${tagClass}">${w.status}</span></td>
      </tr>`;
  });
}

// ---------------- LOGOUT ----------------
document.getElementById("logoutBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  await signOut(auth);
  window.location.href = "index.html";
});
