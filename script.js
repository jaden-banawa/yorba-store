// ===== Ynigo Mart — Robust JS wired for SheetBest =====

// If your data lives in a specific tab, append: `${SHEET_URL}/tabs/YourTabName`
const SHEET_URL = "https://api.sheetbest.com/sheets/21177b5e-b9d3-4136-bf70-b1bafca31b38";

// ---- State ----
let allUsers = [];        // normalized rows with _row index (for PATCH)
let currentUser = null;   // the user currently opened in the modal

// ---- DOM Cache ----
const el = {
  grid: document.getElementById("profile-grid"),
  addBtn: document.getElementById("add-profile-btn"),
  home: document.getElementById("home-screen"),
  addScreen: document.getElementById("add-profile-screen"),
  submitProfile: document.getElementById("submit-profile"),
  cancelAdd: document.getElementById("cancel-add-profile"),
  newName: document.getElementById("new-name"),
  newImgFile: document.getElementById("new-image-file"),
  overlay: document.getElementById("input-overlay"),
  userImg: document.getElementById("user-image"),
  userName: document.getElementById("user-name"),
  userBal: document.getElementById("user-balance"),
  amount: document.getElementById("amount"),
  confirmSession: document.getElementById("confirm-session-btn"),
  backBtn: document.getElementById("back-btn"),
};

// ---- Utils ----
const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>
    <rect width='120' height='120' fill='#e5f3fb'/>
    <circle cx='60' cy='46' r='22' fill='#62b6f0'/>
    <rect x='20' y='78' width='80' height='28' rx='14' fill='#62b6f0'/>
  </svg>`);

// Lowercase keys from SheetBest rows so "Name"/"name" both work
function normalizeRow(row) {
  const out = {};
  Object.keys(row || {}).forEach(k => {
    out[k.trim().toLowerCase()] = row[k];
  });
  return out;
}

function toMoney(n) {
  const x = parseFloat(n);
  return isNaN(x) ? "0.00" : x.toFixed(2);
}

// Draw a single profile card
function createProfileCard(user) {
  const card = document.createElement("div");
  card.className = "profile";

  const imgSrc = user.image?.trim() ? user.image : DEFAULT_AVATAR;

  card.innerHTML = `
    <img src="${imgSrc}" alt="${user.name}" />
    <h3>${user.name}</h3>
  `;
  card.addEventListener("click", () => openUser(user));
  return card;
}

function renderProfiles(users) {
  el.grid.innerHTML = "";
  if (!users || users.length === 0) return;
  users.forEach(u => el.grid.appendChild(createProfileCard(u)));
}

// ---- SheetBest I/O ----
// NOTE: SheetBest updates by *row number* (0-based for data rows). We store that
// value as `_row` so we can PATCH like `${SHEET_URL}/${_row}`. :contentReference[oaicite:2]{index=2}
async function fetchUsers() {
  try {
    const res = await fetch(SHEET_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const raw = await res.json();

    // Normalize and attach row index
    allUsers = (raw || []).map((r, idx) => {
      const row = normalizeRow(r);
      return {
        _row: idx, // important for PATCH
        id: (row.id ?? row.ID ?? row.Id ?? "").toString(),
        name: (row.name ?? row.Name ?? "").toString(),
        image: (row.image ?? row.Image ?? "").toString(),
        balance: toMoney(row.balance ?? row.Balance ?? "0.00"),
      };
    }).filter(u => u.name); // show rows with at least a name

    renderProfiles(allUsers);
  } catch (err) {
    console.error("Failed to load sheet data:", err);
  }
}

async function patchRowByIndex(rowIndex, partial) {
  // PATCH by row number per docs: /<row number>
  // Example: PATCH .../1 updates the second data row (0-based). :contentReference[oaicite:3]{index=3}
  const url = `${SHEET_URL}/${rowIndex}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(partial),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`PATCH failed ${res.status}: ${t || res.statusText}`);
  }
  return res.json();
}

async function postRow(data) {
  const res = await fetch(SHEET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`POST failed ${res.status}: ${t || res.statusText}`);
  }
  return res.json();
}

// ---- Modal / Session ----
function openUser(user) {
  currentUser = user;
  el.userName.textContent = user.name;
  el.userBal.textContent = toMoney(user.balance);
  el.amount.value = "";
  el.userImg.src = user.image?.trim() ? user.image : DEFAULT_AVATAR;
  el.overlay.classList.remove("hidden");
}

el.backBtn.addEventListener("click", () => {
  el.overlay.classList.add("hidden");
});

// Confirm adding funds (kept same behavior: positive numbers only)
el.confirmSession.addEventListener("click", async () => {
  try {
    const amount = parseFloat(el.amount.value);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    const newBalance = parseFloat(currentUser.balance || "0") + amount;
    const patch = { Balance: toMoney(newBalance) }; // use Sheet header casing (robust)
    await patchRowByIndex(currentUser._row, patch);

    // Update local state + UI
    currentUser.balance = toMoney(newBalance);
    el.userBal.textContent = currentUser.balance;
    el.amount.value = "";

    // Refresh full list (keeps row indexes correct after other changes)
    await fetchUsers();
  } catch (err) {
    console.error("Failed to update balance:", err);
    alert("Could not update balance. See console for details.");
  }
});

// ---- Add Profile ----
el.addBtn.addEventListener("click", () => {
  el.home.classList.add("hidden");
  el.addScreen.classList.remove("hidden");
});

el.cancelAdd.addEventListener("click", () => {
  el.addScreen.classList.add("hidden");
  el.home.classList.remove("hidden");
});

// Crop to center-square and resize to 150px
function cropToSquare(img, size = 150, mime = "image/jpeg", quality = 0.9) {
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL(mime, quality);
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

el.submitProfile.addEventListener("click", async () => {
  try {
    const name = el.newName.value.trim();
    const file = el.newImgFile.files[0];

    if (!name) {
      alert("Please enter a name.");
      return;
    }
    if (!file) {
      alert("Please select or take a profile picture.");
      return;
    }

    // Calculate next id (numeric max + 1). Falls back to 1 if no numeric IDs yet.
    const maxId = allUsers.reduce((max, u) => {
      const n = parseInt(u.id, 10);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    const id = String(maxId + 1);

    // Prepare cropped image
    const dataUrl = await readFileAsDataURL(file);
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    const cropped = cropToSquare(img, 150);

    // Build row. IMPORTANT: use original header casing likely present in your sheet.
    // We'll send capitalized keys so SheetBest maps them cleanly regardless. :contentReference[oaicite:4]{index=4}
    const newProfile = {
      Id: id,
      Name: name,
      Image: cropped,
      Balance: "0.00",
    };

    await postRow(newProfile);

    alert(`${name} added!`);
    el.newName.value = "";
    el.newImgFile.value = "";

    el.addScreen.classList.add("hidden");
    el.home.classList.remove("hidden");

    await fetchUsers();
  } catch (err) {
    console.error("Failed to add profile:", err);
    alert("Something went wrong adding the profile. See console for details.");
  }
});

// ---- Input niceties ----
el.amount.addEventListener("blur", () => {
  const v = parseFloat(el.amount.value);
  if (!isNaN(v)) el.amount.value = v.toFixed(2);
});

// ---- Boot ----
fetchUsers();
