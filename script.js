let buildings = [];

fetch("buildings.json")
  .then((response) => response.json())
  .then((data) => {
    buildings = data;
  })
  .catch((error) => {
    console.error("Error loading JSON:", error);
  });

const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("searchInput");
const resultDiv = document.getElementById("result");
const suggestionsDiv = document.getElementById("suggestions");

function normalizeText(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, " ")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\broad\b/g, "rd");
}

function buildGoogleMapsLink(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function buildWazeLink(address) {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}`;
}


function displayResult(found) {
  resultDiv.classList.remove("hidden");

  let imageList = [];

  if (Array.isArray(found.images)) {
    imageList = found.images;
  } else if (typeof found.images === "string" && found.images.trim() !== "") {
    imageList = [found.images];
  }

  const isGitHubPages = window.location.hostname.includes("github.io");
  const basePath = isGitHubPages ? "/DockMap/" : "";

  const imagesHtml = imageList
    .map((imagePath) => `<img src="${basePath}${imagePath}" alt="Service entrance photo">`)
    .join("");

  resultDiv.innerHTML = `
    <h2>${found.main_address}</h2>

    <div class="service-entrance-box">
      <p class="service-entrance-label">📍 SERVICE ENTRANCE</p>

      <p class="service-entrance-address">
        ${found.service_entrance}
      </p>

      ${found.id_required ? `
        <div class="id-warning">
          🪪 ID required
        </div>
      ` : ""}

      ${found.instruction ? `
        <div class="info-row">
          <span class="label">➡️</span> ${found.instruction}
        </div>
      ` : ""}

      ${found.estimated_time_saved ? `
        <div class="time-saved">
          ⏱ Save ~${found.estimated_time_saved} min
        </div>
      ` : ""}

      <div class="service-entrance-actions">
        <button class="copy-btn" 
          onclick="
            copyAddress('${found.service_entrance}');
            countBuildingTimeForToday(${found.id}, ${found.estimated_time_saved || 0});
            trackDeliveryAssist('copy_service_entrance', {
              id: '${found.id}',
              building_name: '${found.building_name}',
              estimated_time_saved: ${found.estimated_time_saved || 0}
            });
          ">
          📋 Copy address
        </button>

        <a href="${buildGoogleMapsLink(found.service_entrance)}"
           target="_blank"
           onclick="
             countBuildingTimeForToday(${found.id}, ${found.estimated_time_saved || 0});
             trackDeliveryAssist('click_google_maps', {
               id: '${found.id}',
               building_name: '${found.building_name}',
               estimated_time_saved: ${found.estimated_time_saved || 0}
             });
           ">
          🗺 Google Maps
        </a>

        <a href="${buildWazeLink(found.service_entrance)}"
           target="_blank"
           onclick="
             countBuildingTimeForToday(${found.id}, ${found.estimated_time_saved || 0});
             trackDeliveryAssist('click_waze', {
               id: '${found.id}',
               building_name: '${found.building_name}',
               estimated_time_saved: ${found.estimated_time_saved || 0}
             });
           ">
          🧭 Waze
        </a>
      </div>
    </div>

    <div class="info-row">
      <span class="label">Average Delivery Time:</span> ${found.avg_delivery_time || "Not available"}
    </div>

    <div class="info-row">
      <span class="label">Delivery Access:</span> ${found.delivery_access || "Not available"}
    </div>

    ${found.notes ? `
      <div class="info-row">
        <span class="label">Notes:</span> ${found.notes}
      </div>
    ` : ""}

    <div class="images">
      ${imagesHtml}
    </div>
  `;
}

function searchBuilding() {
  const userInput = searchInput.value;
  const normalizedInput = normalizeText(userInput);

  let found = buildings.find(
    (building) => normalizeText(building.main_address) === normalizedInput
  );

  if (!found) {
    found = buildings.find((building) =>
      normalizeText(building.main_address).includes(normalizedInput)
    );
  }

  resultDiv.classList.remove("hidden");

  if (!found) {
    resultDiv.innerHTML = `
      <p class="not-found">Address not found.</p>
      <p>Try a suggested address from the dropdown.</p>
    `;
    return;
  }

  displayResult(found);
}

function showSuggestions() {
  const userInput = normalizeText(searchInput.value);

  if (!userInput) {
    suggestionsDiv.style.display = "none";
    suggestionsDiv.innerHTML = "";
    return;
  }

  const matches = buildings.filter((building) =>
    normalizeText(building.main_address).includes(userInput)
  );

  if (matches.length === 0) {
    suggestionsDiv.style.display = "none";
    suggestionsDiv.innerHTML = "";
    return;
  }

  suggestionsDiv.innerHTML = matches
    .slice(0, 5)
    .map(
      (building) =>
        `<div class="suggestion-item" data-address="${building.main_address}">
          ${building.main_address}
        </div>`
    )
    .join("");

  suggestionsDiv.style.display = "block";
}

searchInput.addEventListener("input", showSuggestions);

suggestionsDiv.addEventListener("click", function (event) {
  const item = event.target.closest(".suggestion-item");
  if (!item) return;

  const selectedAddress = item.getAttribute("data-address");
  searchInput.value = selectedAddress;
  suggestionsDiv.style.display = "none";

  const found = buildings.find(
    (building) => building.main_address === selectedAddress
  );

  if (found) {
    displayResult(found);
  }
});

if (searchBtn) {
  searchBtn.addEventListener("click", searchBuilding);
}

searchInput.addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    suggestionsDiv.style.display = "none";
    searchBuilding();
  }
});

document.addEventListener("click", function (event) {
  if (!event.target.closest(".search-wrapper")) {
    suggestionsDiv.style.display = "none";
  }
});

function copyAddress(address) {
  navigator.clipboard.writeText(address)
    .then(() => {
      alert("Address copied!");
    })
    .catch((error) => {
      console.error("Copy failed:", error);
      alert("Failed to copy address");
    });
}

function getTodayKey() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}


function trackDeliveryAssist(actionType, building) {
  if (typeof gtag !== "function") return;

  gtag("event", actionType, {
    building_id: building.id || "",
    building_name: building.building_name || "",
    main_address: building.main_address || "",
    service_entrance: building.service_entrance || "",
    estimated_time_saved: building.estimated_time_saved || 0
  });
}


function countBuildingTimeForToday(buildingId, minutes) {
  if (!minutes) return;

  const todayKey = getTodayKey();
  const countedKey = "countedBuildingsByDay";
  const timeKey = "timeSavedByDay";

  const countedData = JSON.parse(localStorage.getItem(countedKey)) || {};
  const timeData = JSON.parse(localStorage.getItem(timeKey)) || {};

  if (!countedData[todayKey]) {
    countedData[todayKey] = [];
  }

  if (countedData[todayKey].includes(buildingId)) {
    return;
  }

  // 👉 initialiser le jour si nécessaire
  if (!timeData[todayKey]) {
    timeData[todayKey] = 0;
  }

  // 👉 ajouter les minutes pour AUJOURD’HUI seulement
  timeData[todayKey] += minutes;

  // 👉 sauvegarde
  localStorage.setItem(timeKey, JSON.stringify(timeData));

  countedData[todayKey].push(buildingId);
  localStorage.setItem(countedKey, JSON.stringify(countedData));

  updateTotalDisplay();
}


function updateTotalDisplay() {
  const todayKey = getTodayKey();
  const timeData = JSON.parse(localStorage.getItem("timeSavedByDay")) || {};
  const total = timeData[todayKey] || 0;

  const el = document.getElementById("totalSaved");

  if (el) {
    el.innerText = `⏱ Today saved: ${total} min`;
  }
}

updateTotalDisplay();

