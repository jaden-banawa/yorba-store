const SHEET_URL = "https://api.sheetbest.com/sheets/21177b5e-b9d3-4136-bf70-b1bafca31b38";

let currentUser = null;
let allUsers = [];

function getBalance(user) {
  return parseFloat(user.balance) || 0;
}

function renderProfiles(users) {
  const grid = document.getElementById("profile-grid");
  grid.innerHTML = "";

  users.forEach(user => {
    if (!user.id || !user.name || !user.image || user.balance === undefined) return;

    const div = document.createElement("div");
    div.className = "profile";
    div.innerHTML = `
      <img src="${user.image}" alt="${user.name}" />
      <h3>${user.name}</h3>
    `;
    div.addEventListener("click", () => openUser(user));
    grid.appendChild(div);
  });
}

function openUser(user) {
  currentUser = user;
  sessionItems = [];
  document.getElementById("user-name").textContent = user.name;
  document.getElementById("user-balance").textContent = getBalance(user).toFixed(2);
  document.getElementById("amount").value = "";
  document.getElementById("user-image").src = user.image;

  document.getElementById("input-overlay").classList.remove("hidden");
}

document.getElementById("back-btn").addEventListener("click", () => {
  document.getElementById("input-overlay").classList.add("hidden");
});


document.getElementById("confirm-session-btn").addEventListener("click", () => {
    const amount = parseFloat(document.getElementById("amount").value);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
  
    const newBalance = getBalance(currentUser) + amount;
    currentUser.balance = newBalance.toFixed(2);
    document.getElementById("user-balance").textContent = currentUser.balance;
  
    const updateUrl = `${SHEET_URL}/id/${currentUser.id}`;
  
    fetch(updateUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance: currentUser.balance })
    })
      .then(res => res.json())
      .then(() => {
        document.getElementById("amount").value = "";
        fetchUsers();
      })
      .catch(err => {
        console.error("Failed to update balance", err);
      });
  });
  

document.getElementById("add-profile-btn").addEventListener("click", () => {
  document.getElementById("home-screen").classList.add("hidden");
  document.getElementById("add-profile-screen").classList.remove("hidden");
});

document.getElementById("cancel-add-profile").addEventListener("click", () => {
  document.getElementById("add-profile-screen").classList.add("hidden");
  document.getElementById("home-screen").classList.remove("hidden");
});

document.getElementById("submit-profile").addEventListener("click", () => {
  const name = document.getElementById("new-name").value.trim();
  const fileInput = document.getElementById("new-image-file");
const file = fileInput.files[0];

if (!file) {
  alert("Please select or take a profile picture.");
  return;
}

const reader = new FileReader();
reader.onload = function (e) {
  const img = new Image();
  img.onload = function () {
    // Crop to square
    const side = Math.min(img.width, img.height);
    const startX = (img.width - side) / 2;
    const startY = (img.height - side) / 2;

    const canvas = document.createElement("canvas");
    const size = 150; // final cropped size
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, startX, startY, side, side, 0, 0, size, size);

    const image = canvas.toDataURL("image/jpeg", 0.9); // cropped & resized base64

    const newProfile = {
      id,
      name,
      image,
      balance: "0.00"
    };

    fetch(SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newProfile)
    })
      .then(res => res.json())
      .then(() => {
        alert(`${name} added!`);
        document.getElementById("new-name").value = "";
        fileInput.value = "";

        document.getElementById("add-profile-screen").classList.add("hidden");
        document.getElementById("home-screen").classList.remove("hidden");
        fetchUsers();
      })
      .catch(err => {
        console.error("Failed to add profile", err);
        alert("Something went wrong.");
      });
  };

  img.src = e.target.result;
};


reader.readAsDataURL(file);


  if (!name) {
    alert("Please enter a name.");
    return;
  }

  const maxId = allUsers.reduce((max, user) => {
    const numericId = parseInt(user.id, 10);
    return numericId > max ? numericId : max;
  }, 0);

  const id = (maxId + 1).toString();

  const newProfile = {
    id,
    name,
    image,
    balance: "0.00"
  };

  fetch(SHEET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newProfile)
  })
    .then(res => res.json())
    .then(() => {
      alert(`${name} added!`);
      document.getElementById("new-name").value = "";
      document.getElementById("new-image").value = "";

      document.getElementById("add-profile-screen").classList.add("hidden");
      document.getElementById("home-screen").classList.remove("hidden");
      fetchUsers();
    })
    .catch(err => {
      console.error("Failed to add profile", err);
      alert("Something went wrong.");
    });
});

document.getElementById("amount").addEventListener("blur", () => {
    let amt = parseFloat(document.getElementById("amount").value);
    if (!isNaN(amt)) {
      document.getElementById("amount").value = amt.toFixed(2);
    }
  });

function fetchUsers() {
  fetch(SHEET_URL)
    .then(res => res.json())
    .then(data => {
      allUsers = data.filter(user =>
        user.id && user.name && user.image && user.balance !== undefined
      );
      renderProfiles(allUsers);
    })
    .catch(err => {
      console.error("Failed to load sheet data", err);
    });
}

fetchUsers();
