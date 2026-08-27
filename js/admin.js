import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, query, where, orderBy, getDocs, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, SETTINGS } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "index.html"; return; }

  if (user.email !== SETTINGS.ADMIN_EMAIL) {
    document.getElementById("notAdminMsg").style.display = "block";
    return;
  }

  document.getElementById("adminEmail").textContent = user.email;
  document.getElementById("adminContent").style.display = "block";
  loadPending();
  loadPaid();
});

async function loadPending() {
  const q = query(collection(db, "withdrawals"), where("status", "==", "pending"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  const body = document.getElementById("pendingBody");
  const emptyEl = document.getElementById("pendingEmpty");
  body.innerHTML = "";

  if (snap.empty) {
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  snap.forEach((d) => {
    const w = d.data();
    const date = new Date(w.createdAt).toLocaleDateString();
    body.innerHTML += `
      <tr>
        <td>${date}</td>
        <td>${w.email}</td>
        <td class="mono">$${w.amount.toFixed(2)}</td>
        <td class="mono">$${w.netToUser.toFixed(2)}</td>
        <td>${w.method}</td>
        <td>${w.details}</td>
        <td class="mono">${w.referrerCommission > 0 ? "$" + w.referrerCommission.toFixed(2) : "—"}</td>
        <td><button class="btn btn-primary" data-id="${d.id}">Mark Paid</button></td>
      </tr>`;
  });

  body.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "...";
      await updateDoc(doc(db, "withdrawals", btn.dataset.id), { status: "paid", paidAt: Date.now() });
      loadPending();
      loadPaid();
    });
  });
}

async function loadPaid() {
  const q = query(collection(db, "withdrawals"), where("status", "==", "paid"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  const body = document.getElementById("paidBody");
  const emptyEl = document.getElementById("paidEmpty");
  body.innerHTML = "";

  if (snap.empty) {
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  snap.forEach((d) => {
    const w = d.data();
    const date = new Date(w.createdAt).toLocaleDateString();
    body.innerHTML += `
      <tr>
        <td>${date}</td>
        <td>${w.email}</td>
        <td class="mono">$${w.amount.toFixed(2)}</td>
        <td>${w.method}</td>
      </tr>`;
  });
}

document.getElementById("logoutBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  await signOut(auth);
  window.location.href = "index.html";
});
