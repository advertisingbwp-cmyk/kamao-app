import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, query, where, orderBy, getDocs,
  doc, updateDoc, getDoc, addDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, SETTINGS } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---- Password Gate ----
const ADMIN_PASS = SETTINGS.ADMIN_PASS;
const passGate = document.getElementById("passGate");
const adminContent = document.getElementById("adminContent");

// Check session
if (sessionStorage.getItem("adminAuthed") === "yes") {
  passGate.style.display = "none";
  adminContent.style.display = "block";
  initAdmin();
}

document.getElementById("adminPassBtn").addEventListener("click", () => {
  const val = document.getElementById("adminPassInput").value;
  if (val === ADMIN_PASS) {
    sessionStorage.setItem("adminAuthed", "yes");
    passGate.style.display = "none";
    adminContent.style.display = "block";
    initAdmin();
  } else {
    document.getElementById("passError").style.display = "block";
  }
});

document.getElementById("adminPassInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("adminPassBtn").click();
});

document.getElementById("logoutBtn").addEventListener("click", (e) => {
  e.preventDefault();
  sessionStorage.removeItem("adminAuthed");
  passGate.style.display = "flex";
  adminContent.style.display = "none";
  document.getElementById("adminPassInput").value = "";
});

function initAdmin() {
  loadPending();
  loadPaid();
  loadFakeWithdrawals();
}

// ---- Pending Withdrawals ----
async function loadPending() {
  const q = query(collection(db, "withdrawals"), where("status", "==", "pending"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  const body = document.getElementById("pendingBody");
  const emptyEl = document.getElementById("pendingEmpty");
  body.innerHTML = "";

  if (snap.empty) { emptyEl.style.display = "block"; return; }
  emptyEl.style.display = "none";

  snap.forEach((d) => {
    const w = d.data();
    const date = new Date(w.createdAt).toLocaleDateString();
    body.innerHTML += `
      <tr>
        <td>${date}</td>
        <td>${w.email}</td>
        <td class="mono">₨${w.amount}</td>
        <td>${w.method}</td>
        <td>${w.details}</td>
        <td class="mono">${w.referrerCommission > 0 ? "₨" + w.referrerCommission + (w.isFirstWithdrawal ? " (Pehli)" : "") : "—"}</td>
        <td><button class="btn btn-primary" data-id="${d.id}">Mark Paid ✅</button></td>
      </tr>`;
  });

  body.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true; btn.textContent = "...";
      await updateDoc(doc(db, "withdrawals", btn.dataset.id), { status: "paid", paidAt: Date.now() });
      loadPending(); loadPaid();
    });
  });
}

// ---- Paid History ----
async function loadPaid() {
  const q = query(collection(db, "withdrawals"), where("status", "==", "paid"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const body = document.getElementById("paidBody");
  const emptyEl = document.getElementById("paidEmpty");
  body.innerHTML = "";

  if (snap.empty) { emptyEl.style.display = "block"; return; }
  emptyEl.style.display = "none";

  snap.forEach((d) => {
    const w = d.data();
    const date = new Date(w.createdAt).toLocaleDateString();
    body.innerHTML += `
      <tr>
        <td>${date}</td>
        <td>${w.email}</td>
        <td class="mono">₨${w.amount}</td>
        <td>${w.method}</td>
      </tr>`;
  });
}

// ---- Plan Upgrade ----
document.getElementById("planUpgradeBtn").addEventListener("click", async () => {
  const email = document.getElementById("planEmail").value.trim();
  const plan = document.getElementById("planSelect").value;
  const msgEl = document.getElementById("planMsg");

  if (!email) { msgEl.textContent = "Email daalein."; return; }

  const q = query(collection(db, "users"), where("email", "==", email));
  const snap = await getDocs(q);

  if (snap.empty) { msgEl.textContent = "User nahi mila: " + email; return; }

  const userDoc = snap.docs[0];
  const planExpiry = plan === "free" ? 0 : Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 din

  await updateDoc(doc(db, "users", userDoc.id), { plan, planExpiry });
  msgEl.textContent = `✅ ${email} ka plan "${plan}" mein upgrade ho gaya (30 din).`;
  document.getElementById("planEmail").value = "";
});

// ---- Fake Withdrawals ----
async function loadFakeWithdrawals() {
  const snap = await getDocs(collection(db, "fakeWithdrawals"));
  const body = document.getElementById("fwBody");
  const emptyEl = document.getElementById("fwEmpty");
  body.innerHTML = "";

  if (snap.empty) { emptyEl.style.display = "block"; return; }
  emptyEl.style.display = "none";

  snap.forEach((d) => {
    const w = d.data();
    body.innerHTML += `
      <tr>
        <td>${w.name}</td>
        <td class="mono">₨${w.amount}</td>
        <td>${w.method}</td>
        <td><button class="btn btn-danger" style="padding:6px 12px; font-size:12px;" data-id="${d.id}">Delete</button></td>
      </tr>`;
  });

  body.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "fakeWithdrawals", btn.dataset.id));
      loadFakeWithdrawals();
    });
  });
}

document.getElementById("fwAddBtn").addEventListener("click", async () => {
  const name = document.getElementById("fwName").value.trim();
  const amount = parseInt(document.getElementById("fwAmount").value);
  const method = document.getElementById("fwMethod").value;

  if (!name || !amount) return;

  await addDoc(collection(db, "fakeWithdrawals"), { name, amount, method, createdAt: Date.now() });
  document.getElementById("fwName").value = "";
  document.getElementById("fwAmount").value = "";
  loadFakeWithdrawals();
});
