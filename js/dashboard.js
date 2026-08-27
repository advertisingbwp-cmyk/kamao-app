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
  return new Date().toISOString().slice(0, 10);
}

function getDailyLimit(plan) {
  if (plan === "gold") return SETTINGS.DAILY_AD_LIMIT_GOLD;
  if (plan === "silver") return SETTINGS.DAILY_AD_LIMIT_SILVER;
  return SETTINGS.DAILY_AD_LIMIT_FREE;
}

function isPlanActive(userData) {
  if (userData.plan === "free" || !userData.plan) return true;
  return userData.planExpiry && Date.now() < userData.planExpiry;
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

  // If plan expired, reset to free
  if (userData.plan !== "free" && userData.planExpiry && Date.now() > userData.planExpiry) {
    userData.plan = "free";
    await updateDoc(ref, { plan: "free" });
  }

  // Reset daily counter if new day
  if (userData.lastAdDate !== todayStr()) {
    userData.dailyAdsWatched = 0;
    await updateDoc(ref, { dailyAdsWatched: 0, lastAdDate: todayStr() });
  }

  renderUser();
}

function renderUser() {
  const total = (userData.balance || 0) + (userData.referralBonus || 0);
  document.getElementById("balanceAmount").textContent = "₨" + Math.floor(total);
  document.getElementById("earnPart").textContent = "₨" + Math.floor(userData.balance || 0);
  document.getElementById("refPart").textContent = "₨" + Math.floor(userData.referralBonus || 0);

  const plan = isPlanActive(userData) ? (userData.plan || "free") : "free";
  const limit = getDailyLimit(plan);
  const watched = userData.dailyAdsWatched || 0;
  const pct = Math.min(100, (watched / limit) * 100);
  document.getElementById("dailyFill").style.width = pct + "%";
  document.getElementById("dailyLabel").textContent = `${watched} / ${limit} ads aaj`;

  // Plan badge
  const badge = document.getElementById("userPlanBadge");
  if (badge) {
    if (plan === "gold") { badge.textContent = "Gold 🥇"; badge.className = "plan-tag gold-tag"; }
    else if (plan === "silver") { badge.textContent = "Silver 🥈"; badge.className = "plan-tag silver-tag"; }
    else { badge.textContent = "Free"; badge.className = "plan-tag free-tag"; }
  }

  const refLink = `${window.location.origin}/index.html?ref=${userData.referralCode}`;
  document.getElementById("refLink").value = refLink;

  document.getElementById("wdFeeHint").textContent =
    `Minimum withdrawal ₨${SETTINGS.MIN_WITHDRAWAL}. Referral bonus: pehli withdrawal par inviter ko 10% milta hai.`;

  updateWatchButton();
}

// ---------------- WATCH AD FLOW ----------------
const watchBtn = document.getElementById("watchBtn");
const ringFg = document.getElementById("ringFg");
const ringSecs = document.getElementById("ringSecs");
let timerInterval = null;

function updateWatchButton() {
  const plan = isPlanActive(userData) ? (userData.plan || "free") : "free";
  const limit = getDailyLimit(plan);
  const watched = userData.dailyAdsWatched || 0;
  const now = Date.now();
  const cooldownLeft = SETTINGS.COOLDOWN_SECONDS * 1000 - (now - (userData.lastAdTimestamp || 0));

  if (watched >= limit) {
    watchBtn.disabled = true;
    watchBtn.textContent = "Aaj ki limit khatam — kal wapis aayein";
  } else if (cooldownLeft > 0) {
    watchBtn.disabled = true;
    let remaining = Math.ceil(cooldownLeft / 1000);
    watchBtn.textContent = `Thodi der intezar karein (${remaining}s)`;
    setTimeout(updateWatchButton, 1000);
  } else {
    watchBtn.disabled = false;
    watchBtn.textContent = "Ad Dekhna Shuru Karein (+₨1)";
  }
}

watchBtn.addEventListener("click", () => {
  if (watchBtn.disabled) return;
  startAdTimer();
});

function startAdTimer() {
  watchBtn.disabled = true;
  watchBtn.textContent = "Ad chal rahi hai...";

  // Open Adsterra Smartlink in new tab
  window.open("https://bibleearthquake.com/ccf1q1jw?key=52f7ecf948a0f517f28ed331316d0239", "_blank");

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
    errEl.textContent = `Minimum withdrawal ₨${SETTINGS.MIN_WITHDRAWAL} hai.`;
    errEl.style.display = "block";
    return;
  }
  if (amount > totalBalance) {
    errEl.textContent = "Itna balance nahi hai.";
    errEl.style.display = "block";
    return;
  }

  let fromEarning = Math.min(userData.balance || 0, amount);
  let fromReferral = amount - fromEarning;

  // Referral: 10% to inviter only on FIRST withdrawal of this user
  let referrerCommission = 0;
  let referrerUid = userData.referredBy || null;
  if (referrerUid && !userData.referralBonusPaid) {
    referrerCommission = Math.floor(amount * (SETTINGS.REFERRAL_BONUS_PERCENT / 100));
  }

  await addDoc(collection(db, "withdrawals"), {
    uid: currentUser.uid,
    email: currentUser.email,
    amount,
    netToUser: amount,
    method,
    details,
    status: "pending",
    referrerUid,
    referrerCommission,
    isFirstWithdrawal: !userData.referralBonusPaid,
    createdAt: Date.now()
  });

  const userRef = doc(db, "users", currentUser.uid);
  const updateData = {
    balance: increment(-fromEarning),
    referralBonus: increment(-fromReferral),
  };
  // Mark referral bonus as paid (so it won't happen again)
  if (referrerUid && !userData.referralBonusPaid) {
    updateData.referralBonusPaid = true;
  }
  await updateDoc(userRef, updateData);

  userData.balance -= fromEarning;
  userData.referralBonus -= fromReferral;
  if (referrerUid && !userData.referralBonusPaid) {
    userData.referralBonusPaid = true;
  }

  // Credit referrer's bonus
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
        <td class="mono">₨${w.amount}</td>
        <td>${w.method}</td>
        <td><span class="tag ${tagClass}">${w.status === "paid" ? "Paid ✅" : "Pending ⏳"}</span></td>
      </tr>`;
  });
}

// ---------------- LOGOUT ----------------
document.getElementById("logoutBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  await signOut(auth);
  window.location.href = "index.html";
});
