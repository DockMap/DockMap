let buildings = [];
let engagedViewTimer = null;
let currentDisplayedBuilding = null;
let engagedViewTracked = false;

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
            countBuildingTimeSaved(${found.id}, ${found.estimated_time_saved || 0});
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
             countBuildingTimeSaved(${found.id}, ${found.estimated_time_saved || 0});
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
             countBuildingTimeSaved(${found.id}, ${found.estimated_time_saved || 0});
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
    //pour la metrc 2
    startEngagedViewTimer(found);

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
//pour metric 2
  if (!found) {
  resultDiv.innerHTML = `
    <p class="not-found">Address not found.</p>
    <p>Try a suggested address from the dropdown.</p>
  `;
  resetEngagedViewTracking();
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

//pour la metric 2

function trackEngagedView(building) {
  if (typeof gtag !== "function") return;

  gtag("event", "engaged_view", {
    building_id: building.id || "",
    building_name: building.building_name || "",
    main_address: building.main_address || "",
    service_entrance: building.service_entrance || "",
    estimated_time_saved: building.estimated_time_saved || 0,
    id_required: building.id_required ? "yes" : "no",
    delivery_access: building.delivery_access || ""
  });
}

function startEngagedViewTimer(building) {
  if (engagedViewTimer) {
    clearTimeout(engagedViewTimer);
  }

  currentDisplayedBuilding = building;
  engagedViewTracked = false;

  engagedViewTimer = setTimeout(() => {
    if (currentDisplayedBuilding && !engagedViewTracked) {
      trackEngagedView(currentDisplayedBuilding);
      countBuildingTimeSaved(
        currentDisplayedBuilding.id,
        currentDisplayedBuilding.estimated_time_saved || 0
      );
      engagedViewTracked = true;
    }
  }, 6000);
}

function resetEngagedViewTracking() {
  if (engagedViewTimer) {
    clearTimeout(engagedViewTimer);
    engagedViewTimer = null;
  }

  currentDisplayedBuilding = null;
  engagedViewTracked = false;
}

// pour metric 3

function getTodayKey() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

function getWeekKey() {
  const today = new Date();
  const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
  const pastDaysOfYear = Math.floor((today - firstDayOfYear) / 86400000);
  const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

  return `${today.getFullYear()}-W${weekNumber}`;
}

function getMonthKey() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  return `${today.getFullYear()}-${month}`;
}

function addTimeSaved(periodKey, storageKey, minutes) {
  const data = JSON.parse(localStorage.getItem(storageKey)) || {};

  if (!data[periodKey]) {
    data[periodKey] = 0;
  }

  data[periodKey] += minutes;
  localStorage.setItem(storageKey, JSON.stringify(data));
}

//function preincipale metric 3 

function countBuildingTimeSaved(buildingId, minutes) {
  const numericMinutes = Number(minutes);
  if (!numericMinutes) return;

  const todayKey = getTodayKey();
  const weekKey = getWeekKey();
  const monthKey = getMonthKey();

  const countedKey = "countedBuildingsByDay";
  const countedData = JSON.parse(localStorage.getItem(countedKey)) || {};

  if (!countedData[todayKey]) {
    countedData[todayKey] = [];
  }

  if (countedData[todayKey].includes(buildingId)) {
    return;
  }

  addTimeSaved(todayKey, "timeSavedByDay", numericMinutes);
  addTimeSaved(weekKey, "timeSavedByWeek", numericMinutes);
  addTimeSaved(monthKey, "timeSavedByMonth", numericMinutes);

  countedData[todayKey].push(buildingId);
  localStorage.setItem(countedKey, JSON.stringify(countedData));

  if (typeof gtag === "function") {
    gtag("event", "time_saved", {
      time_saved_minutes: numericMinutes,
      building_id: String(buildingId)
    });
  }
}
//function pour afficher les velurs  metric 3 
function getTodayTimeSaved() {
  const todayKey = getTodayKey();
  const data = JSON.parse(localStorage.getItem("timeSavedByDay")) || {};
  return data[todayKey] || 0;
}

function getWeekTimeSaved() {
  const weekKey = getWeekKey();
  const data = JSON.parse(localStorage.getItem("timeSavedByWeek")) || {};
  return data[weekKey] || 0;
}

function getMonthTimeSaved() {
  const monthKey = getMonthKey();
  const data = JSON.parse(localStorage.getItem("timeSavedByMonth")) || {};
  return data[monthKey] || 0;
}