// =========================
// Ynigo Mart - clean restart
// Sheet headers (row 1): id | name | image | balance  (all lowercase)
// =========================

"use strict";

// 1) Put your SheetBest URL here. If your data is on a tab, append /tabs/<TabName>
const SHEET_URL = "https://api.sheetbest.com/sheets/21177b5e-b9d3-4136-bf70-b1bafca31b38";

// Optional: if your SheetBest API is protected by key, set it here (or leave empty)
const SHEET_API_KEY = ""; // e.g., "sb_live_XXXX"; if set, we include X-Api-Key header

// ----------------------
// DOM Cache
// ----------------------
const el = {
  grid: document.getElementById("profile-grid"),

  home: document.getElementById("home-screen"),
  addScreen: document.getElementById("add-profile-screen"),

  addBtn: document.getElementById("add-profile-btn"),
  cancelAdd: document.getElementById("cancel-add-profile"),
  submitProfile: document.getElementById("submit-profile"),
  newName: document.getElementById("new-name"),
  newImageFile: document.getElementById("new-image-file"),

  overlay: document.getElementById("input-overlay"),
  userImage: document.getElementById("user-image"),
  userName: document.getElementById("user-name"),
  userBalance: document.getElementById("user-balance"),
  amount: document.getElementById("amount"),
  confirmSession: document.getElementById("confirm-session-btn"),
  backBtn: document.getElementById("back-btn"),
};

// ----------------------
// State
// ----------------------
let allUsers = [];      // [{id, name, image, balance}]
let currentUser = null; // {id, name, image, balance}

// ----------------------
// Helpers
// ----------------------
function headers(extra = {}) {
  const base = { "Content-Type": "application/json" };
  if (SHEET_API_KEY) base["X-Api-Key"] = SHEET_API_KEY;
  return { ...base, ...extra };
}

function toMoney(v) {
  const n = parseFloat(v);
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

function createCard(user) {
  const div = document.createElement("div");
  div.className = "profile";
  div.innerHTML = `
    <img src="${user.image}" alt="${user.name}" />
    <h3>${user.name}</h3>
  `;
  div.addEventListener("click", () => openUser(user));
  return div;
}

function renderProfiles(list) {
  el.grid.innerHTML = "";
  (list || []).forEach(u => el.grid.appendChild(createCard(u)));
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function cropToSquareDataURL(imgEl, size = 150, mime = "image/jpeg", quality = 0.9) {
  const side = Math.min(imgEl.width, imgEl.height);
  const sx = (imgEl.width - side) / 2;
  const sy = (imgEl.height - side) / 2;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  ctx.drawImage(imgEl, sx, sy, side, side, 0, 0, size, size);
  return c.toDataURL(mime, quality);
}

// Compute next id: max(existing ids) + 1, or 0 if no rows
function getNextId() {
  if (!allUsers.length) return 0;
  let max = -1;
  for (const u of allUsers) {
    const n = parseInt(u.id, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

// ----------------------
// SheetBest I/O
// ----------------------

// GET all rows (parsed). Docs show simple GET to the connection URL. :contentReference[oaicite:1]{index=1}
async function fetchUsers() {
  const res = await fetch(SHEET_URL, { cache: "no-store", headers: headers() });
  if (!res.ok) throw new Error(`GET ${res.status} ${res.statusText}`);
  const data = await res.json();

  // Ensure correct shapes and types
  allUsers = (data || [])
    .map(r => ({
      id: String(r.id ?? "").trim(),
      name: String(r.name ?? "").trim(),
      image: String(r.image ?? "").trim(),
      balance: toMoney(r.balance ?? "0"),
    }))
    .filter(u => u.name); // Show only rows with a name (image may be empty if you later allow it)

  renderProfiles(allUsers);
}

// POST a new row. Docs accept a single object or an array of objects. :contentReference[oaicite:2]{index=2}
async function postRow(row) {
  const res = await fetch(SHEET_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(row), // sending a single object
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`POST ${res.status}: ${t || res.statusText}`);
  }
  return res.json();
}

// PATCH by filtering column in the URL (we use lowercase 'id' exactly as your header).
// This is the official "Filtered Update" pattern. :contentReference[oaicite:3]{index=3}
async function patchById(id, partial) {
  const url = `${SHEET_URL}/id/${encodeURIComponent(String(id))}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(partial),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`PATCH ${res.status}: ${t || res.statusText}`);
  }
  return res.json();
}

// ----------------------
// UI Actions
// ----------------------
function openUser(user) {
  currentUser = user;
  el.userName.textContent = user.name;
  el.userBalance.textContent = toMoney(user.balance);
  el.userImage.src = user.image;
  el.amount.value = "";
  el.overlay.classList.remove("hidden");
}

el.backBtn.addEventListener("click", () => {
  el.overlay.classList.add("hidden");
});

el.confirmSession.addEventListener("click", async () => {
  const amt = parseFloat(el.amount.value);
  if (isNaN(amt) || amt <= 0) {
    alert("Please enter a valid amount.");
    return;
  }
  try {
    const newBal = (parseFloat(currentUser.balance) || 0) + amt;
    await patchById(currentUser.id, { balance: toMoney(newBal) });
    await fetchUsers(); // refresh list & local state
    // Update the open modal view
    const refreshed = allUsers.find(u => u.id === currentUser.id);
    if (refreshed) {
      currentUser = refreshed;
      el.userBalance.textContent = toMoney(currentUser.balance);
    }
    el.amount.value = "";
  } catch (e) {
    console.error(e);
    alert("Failed to update balance. See console for details.");
  }
});

// Show add-profile screen
el.addBtn.addEventListener("click", () => {
  el.home.classList.add("hidden");
  el.addScreen.classList.remove("hidden");
});

// Cancel add-profile
el.cancelAdd.addEventListener("click", () => {
  el.addScreen.classList.add("hidden");
  el.home.classList.remove("hidden");
});

// Format the amount nicely on blur
el.amount.addEventListener("blur", () => {
  const v = parseFloat(el.amount.value);
  if (!isNaN(v)) el.amount.value = v.toFixed(2);
});

// Submit new profile
el.submitProfile.addEventListener("click", async () => {
  const name = el.newName.value.trim();
  const file = el.newImageFile.files[0];

  if (!name) {
    alert("Please enter a name.");
    return;
  }
  if (!file) {
    alert("Please select or take a profile picture.");
    return;
  }

  // Prevent double-submits
  el.submitProfile.disabled = true;

  try {
    // Read file & crop to square
    const dataUrl = await readFileAsDataURL(file);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const cropped = cropToSquareDataURL(img, 150, "image/jpeg", 0.9);

    // Compute next ID (starting at 0)
    // Note: fetch current rows first to ensure the latest state
    await fetchUsers();
    const nextId = getNextId();

    // Build the row EXACTLY matching your headers (lowercase)
    const newRow = {
      id: String(nextId),
      name: name,
      image: cropped,     // base64 data URL stored in the "image" cell
      balance: "0.00",
    };

    // Insert the row
    await postRow(newRow); // POST to the same URL inserts a new line. :contentReference[oaicite:4]{index=4}

    // Reset form & UI
    el.newName.value = "";
    el.newImageFile.value = "";
    el.addScreen.classList.add("hidden");
    el.home.classList.remove("hidden");

    // Reload profiles
    await fetchUsers();
    alert(`${name} added!`);
  } catch (e) {
    console.error(e);
    alert("Failed to add profile. See console for details.");
  } finally {
    el.submitProfile.disabled = false;
  }
});

// ----------------------
// Boot
// ----------------------
fetchUsers().catch(err => {
  console.error("Initial load failed:", err);
});
