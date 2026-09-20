// ==================================================
// Données et éléments de la page
// ==================================================

let buildings = [];
let loadState = "loading";

let engagedViewTimer = null;
let currentDisplayedBuilding = null;
let engagedViewTracked = false;

let photos = [];
let photoIndex = 0;

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const resultDiv = document.getElementById("result");
const suggestionsDiv = document.getElementById("suggestions");
const statusEl = document.getElementById("searchStatus");
const dialog = document.getElementById("photoDialog");

// ==================================================
// Fonctions utilitaires
// ==================================================

function escapeHTML(value) {
  const characters = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  return String(value ?? "").replace(
    /[&<>"']/g,
    character => characters[character]
  );
}

function readStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Le site reste utilisable si le stockage est bloqué.
  }
}

function normalizeText(text) {
  return String(text ?? "")
    .toLowerCase()
    .trim()
    .replace(/[.,]/g, "")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\broad\b/g, "rd")
    .replace(/\beast\b/g, "e")
    .replace(/\bwest\b/g, "w")
    .replace(/(\d+)(st|nd|rd|th)\b/g, "$1")
    .replace(/\s+/g, " ");
}

function matching(value) {
  const query = normalizeText(value);

  return buildings.filter(building =>
    normalizeText(building.main_address).includes(query)
  );
}

// ==================================================
// Chargement des adresses
// ==================================================

fetch("buildings.json")
  .then(response => {
    if (!response.ok) {
      throw new Error("Could not load buildings.json");
    }

    return response.json();
  })
  .then(data => {
    if (!Array.isArray(data)) {
      throw new Error("Invalid building data");
    }

    buildings = data;
    loadState = "ready";

    statusEl.textContent =
      "Search an address, then choose a suggestion.";

    if (searchInput.value) {
      showSuggestions();
    }
  })
  .catch(error => {
    console.error("Loading error:", error);

    loadState = "error";

    statusEl.textContent =
      "Addresses could not load. Please refresh the page.";
  });

// ==================================================
// Recherche et suggestions
// ==================================================

function hideSuggestions() {
  suggestionsDiv.style.display = "none";
  searchInput.setAttribute("aria-expanded", "false");
}

function showSuggestions() {
  suggestionsDiv.replaceChildren();

  if (!searchInput.value.trim()) {
    hideSuggestions();
    return;
  }

  const matches = matching(searchInput.value).slice(0, 5);

  for (const building of matches) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "suggestion-item";
    button.textContent = building.main_address;

    button.addEventListener("click", () => {
      searchInput.value = building.main_address;
      displayResult(building);
      hideSuggestions();
      searchInput.focus();
    });

    suggestionsDiv.append(button);
  }

  suggestionsDiv.style.display = matches.length ? "block" : "none";

  searchInput.setAttribute(
    "aria-expanded",
    String(matches.length > 0)
  );
}

function searchBuilding() {
  hideSuggestions();

  if (loadState !== "ready") {
    statusEl.textContent =
      loadState === "loading"
        ? "Addresses are still loading…"
        : "Addresses could not load. Please refresh the page.";

    return;
  }

  if (!searchInput.value.trim()) {
    statusEl.textContent =
      "Enter a building address to get started.";

    searchInput.focus();
    return;
  }

  const normalizedInput = normalizeText(searchInput.value);

  const found =
    buildings.find(
      building =>
        normalizeText(building.main_address) === normalizedInput
    ) || matching(searchInput.value)[0];

  if (found) {
    displayResult(found);
    return;
  }

  resetEngagedViewTracking();

  resultDiv.classList.remove("hidden");

  resultDiv.innerHTML = `
    <div class="empty-state">
      <h2>Address not found yet</h2>
      <p>Try a shorter address or choose a suggestion.</p>
    </div>
  `;
}

searchInput.addEventListener("input", showSuggestions);

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchBuilding();
  }

  if (event.key === "Escape") {
    hideSuggestions();
  }

  if (
    event.key === "ArrowDown" &&
    searchInput.getAttribute("aria-expanded") === "true"
  ) {
    const first = suggestionsDiv.querySelector("button");

    if (first) {
      event.preventDefault();
      first.focus();
    }
  }
});

suggestionsDiv.addEventListener("keydown", event => {
  const buttons = [
    ...suggestionsDiv.querySelectorAll("button")
  ];

  const index = buttons.indexOf(document.activeElement);

  if (
    buttons.length &&
    (event.key === "ArrowDown" || event.key === "ArrowUp")
  ) {
    event.preventDefault();

    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      (index + direction + buttons.length) % buttons.length;

    buttons[nextIndex].focus();
  }

  if (event.key === "Escape") {
    hideSuggestions();
    searchInput.focus();
  }
});

searchBtn.addEventListener("click", searchBuilding);

document.addEventListener("click", event => {
  if (!event.target.closest(".search-box")) {
    hideSuggestions();
  }
});

// ==================================================
// Affichage du bâtiment
// ==================================================

function displayResult(building) {
  resultDiv.classList.remove("hidden");
  document.body.classList.add("has-result");
  statusEl.textContent = "";

  const address =
    building.service_entrance || building.main_address;

  const imageList = Array.isArray(building.images)
    ? building.images
    : typeof building.images === "string"
      ? [building.images]
      : [];

  photos = imageList.filter(
    path => typeof path === "string" && path.trim()
  );

  photoIndex = 0;

  const wazeLink =
    `https://waze.com/ul?q=${encodeURIComponent(address)}`;

  const googleLink =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(address);

  resultDiv.innerHTML = `
    <div class="entrance-heading">
      <p class="eyebrow">SERVICE ENTRANCE</p>

      <div class="address-row">
        <h2>${escapeHTML(address)}</h2>

        <button
          id="copyAddress"
          class="copy-btn"
          type="button"
          aria-label="Copy service entrance address"
        >
          Copy
        </button>
      </div>

      <p class="main-address">
        Main address:
        <span>${escapeHTML(building.main_address)}</span>
      </p>
    </div>

    <div class="nav-actions">
      <a
        id="wazeLink"
        target="_blank"
        rel="noopener"
        href="${wazeLink}"
      >
        <span aria-hidden="true">↗</span>
        Open in Waze
      </a>

      <a
        id="googleLink"
        target="_blank"
        rel="noopener"
        href="${googleLink}"
      >
        <span aria-hidden="true">↗</span>
        Google Maps
      </a>
    </div>

    <div class="badges">
      ${
        building.id_required
          ? '<span class="id-badge">ID required</span>'
          : ""
      }

      ${
        building.estimated_time_saved
          ? `
            <span class="saved-badge">
              Save ~${escapeHTML(building.estimated_time_saved)} min
            </span>
          `
          : ""
      }
    </div>

    <div class="details-grid">
      <div class="gallery">
        ${
          photos.length
            ? `
              <div class="photo-frame">
                <button
                  id="enlargePhoto"
                  type="button"
                  aria-label="Enlarge entrance photo"
                >
                  <img
                    id="entrancePhoto"
                    alt="Service entrance at ${escapeHTML(address)}"
                  />
                </button>

                <span class="zoom-hint">
                  Tap to enlarge ↗
                </span>
              </div>

              <div class="gallery-controls">
                <span>Entrance photos</span>

                <div>
                  <button
                    class="previous"
                    type="button"
                    aria-label="Previous photo"
                  >
                    ←
                  </button>

                  <span
                    class="photo-count"
                    aria-live="polite"
                  ></span>

                  <button
                    class="next"
                    type="button"
                    aria-label="Next photo"
                  >
                    →
                  </button>
                </div>
              </div>
            `
            : `
              <div class="no-photo">
                No entrance photo available yet.
              </div>
            `
        }
      </div>

      <aside class="delivery-details">
      

        <div class="detail">
          <span>Delivery access</span>
          <strong>
            ${escapeHTML(building.delivery_access || "Not available")}
          </strong>
        </div>

        <div class="detail">
          <span>Average delivery time</span>
          <strong>
            ${escapeHTML(building.avg_delivery_time || "Not available")}
          </strong>
        </div>

        ${
          building.instruction
            ? `
              <div class="instruction">
                <span>Entrance instructions</span>
                <p>${escapeHTML(building.instruction)}</p>
              </div>
            `
            : ""
        }

        ${
          building.notes
            ? `
              <div class="detail">
                <span>Notes</span>
                <p>${escapeHTML(building.notes)}</p>
              </div>
            `
            : ""
        }
      </aside>
    </div>
  `;

  function assist(action) {
    countBuildingTimeSaved(
      building.id,
      building.estimated_time_saved || 0
    );

    trackDeliveryAssist(action, building);
  }

  document
    .getElementById("wazeLink")
    .addEventListener("click", () => {
      assist("click_waze");
    });

  document
    .getElementById("googleLink")
    .addEventListener("click", () => {
      assist("click_google_maps");
    });

  document
    .getElementById("copyAddress")
    .addEventListener("click", async event => {
      const button = event.currentTarget;

      try {
        await navigator.clipboard.writeText(address);

        button.textContent = "Copied ✓";
        assist("copy_service_entrance");
      } catch {
        button.textContent = "Select address to copy";
      }
    });

  if (photos.length) {
    document
      .getElementById("enlargePhoto")
      .addEventListener("click", () => {
        dialog.showModal();
        updatePhoto();
      });

    wireGallery(resultDiv.querySelector(".gallery"));
    updatePhoto();
  }

  startEngagedViewTimer(building);
}

// ==================================================
// Galerie et agrandissement
// ==================================================

function updatePhoto() {
  const image = document.getElementById("entrancePhoto");
  const fullPhoto = document.getElementById("fullPhoto");

  if (!image || !photos.length) {
    return;
  }

  const address =
    currentDisplayedBuilding?.service_entrance ||
    currentDisplayedBuilding?.main_address;

  if (address) {
    image.alt = `Service entrance at ${address}`;
  }

  image.onerror = () => {
    image.alt = "Photo unavailable — try another photo.";
  };

  image.src = photos[photoIndex];

  fullPhoto.src = photos[photoIndex];
  fullPhoto.alt = image.alt;

  document.querySelectorAll(".photo-count").forEach(element => {
    element.textContent = `${photoIndex + 1} / ${photos.length}`;
  });

  document.querySelectorAll(".previous, .next").forEach(button => {
    button.hidden = photos.length < 2;
  });
}

function changePhoto(direction) {
  if (!photos.length) {
    return;
  }

  photoIndex =
    (photoIndex + direction + photos.length) % photos.length;

  updatePhoto();
}

function wireGallery(root) {
  root.querySelector(".previous")?.addEventListener(
    "click",
    () => changePhoto(-1)
  );

  root.querySelector(".next")?.addEventListener(
    "click",
    () => changePhoto(1)
  );

  let start = null;

  root.addEventListener(
    "touchstart",
    event => {
      start = [
        event.changedTouches[0].clientX,
        event.changedTouches[0].clientY
      ];
    },
    { passive: true }
  );

  root.addEventListener(
    "touchend",
    event => {
      if (!start) {
        return;
      }

      const dx = event.changedTouches[0].clientX - start[0];
      const dy = event.changedTouches[0].clientY - start[1];

      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        changePhoto(dx < 0 ? 1 : -1);
      }

      start = null;
    },
    { passive: true }
  );
}

wireGallery(dialog);

dialog
  .querySelector(".dialog-close")
  .addEventListener("click", () => {
    dialog.close();
  });

dialog.addEventListener("click", event => {
  if (event.target === dialog) {
    dialog.close();
  }
});

dialog.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    changePhoto(-1);
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    changePhoto(1);
  }
});

// ==================================================
// Google Analytics
// ==================================================

function trackDeliveryAssist(actionType, building) {
  if (typeof gtag !== "function") {
    return;
  }

  gtag("event", actionType, {
    building_id: building.id || "",
    building_name: building.building_name || "",
    main_address: building.main_address || "",
    service_entrance: building.service_entrance || "",
    estimated_time_saved: building.estimated_time_saved || 0
  });
}

function trackEngagedView(building) {
  if (typeof gtag !== "function") {
    return;
  }

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

// ==================================================
// Consultation de 6 secondes
// ==================================================

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

// ==================================================
// Compteurs de temps gagné
// ==================================================

function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

function getWeekKey() {
  const today = new Date();

  const firstDayOfYear = new Date(
    today.getFullYear(),
    0,
    1
  );

  const pastDaysOfYear = Math.floor(
    (today - firstDayOfYear) / 86400000
  );

  const weekNumber = Math.ceil(
    (pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7
  );

  return `${today.getFullYear()}-W${weekNumber}`;
}

function getMonthKey() {
  const today = new Date();

  const month = String(today.getMonth() + 1).padStart(2, "0");

  return `${today.getFullYear()}-${month}`;
}

function addTimeSaved(periodKey, storageKey, minutes) {
  const data = readStorage(storageKey) || {};

  if (!data[periodKey]) {
    data[periodKey] = 0;
  }

  data[periodKey] += minutes;

  writeStorage(storageKey, JSON.stringify(data));
}

function countBuildingTimeSaved(buildingId, minutes) {
  const numericMinutes = Number(minutes);

  if (!Number.isFinite(numericMinutes) || numericMinutes <= 0) {
    return;
  }

  const todayKey = getTodayKey();
  const weekKey = getWeekKey();
  const monthKey = getMonthKey();

  const countedKey = "countedBuildingsByDay";
  const countedData = readStorage(countedKey) || {};

  if (!countedData[todayKey]) {
    countedData[todayKey] = [];
  }

  const alreadyCounted = countedData[todayKey].some(
    id => String(id) === String(buildingId)
  );

  if (alreadyCounted) {
    return;
  }

  addTimeSaved(
    todayKey,
    "timeSavedByDay",
    numericMinutes
  );

  addTimeSaved(
    weekKey,
    "timeSavedByWeek",
    numericMinutes
  );

  addTimeSaved(
    monthKey,
    "timeSavedByMonth",
    numericMinutes
  );

  countedData[todayKey].push(buildingId);

  writeStorage(countedKey, JSON.stringify(countedData));

  updateTotalDisplay();

  if (typeof gtag === "function") {
    gtag("event", "time_saved", {
      time_saved_minutes: numericMinutes,
      building_id: String(buildingId)
    });
  }
}

function getTodayTimeSaved() {
  const data = readStorage("timeSavedByDay") || {};
  return data[getTodayKey()] || 0;
}

function getWeekTimeSaved() {
  const data = readStorage("timeSavedByWeek") || {};
  return data[getWeekKey()] || 0;
}

function getMonthTimeSaved() {
  const data = readStorage("timeSavedByMonth") || {};
  return data[getMonthKey()] || 0;
}

function updateTotalDisplay() {
  const element = document.getElementById("totalSaved");

  if (element) {
    element.textContent =
      `⏱ Today saved: ${getTodayTimeSaved()} min`;
  }
}

updateTotalDisplay();