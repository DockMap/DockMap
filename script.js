const SUPABASE_URL = "https://rfeojoxjdxxjuqplrzwq.supabase.co";
const SUPABASE_KEY = "sb_publishable_CnmluyGaHpX8BSITOReAwg_4qCJ9zUU";

const dockmapSupabase = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

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

  resetEngagedViewTracking(); //pour voir les recherches sans resultats

  trackSearchNoResults(searchInput.value);

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

    // La même fiche est déjà affichée : éviter de la recompter.
  if (
    currentDisplayedBuilding &&
    String(currentDisplayedBuilding.id) === String(building.id) &&
    !resultDiv.classList.contains("hidden")
  ) {
    return;
  } 


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

      ${
        /^\d{4}-(0[1-9]|1[0-2])$/.test(
          (building.last_verified || "").trim()
        )
          ? `
            <p class="verification-date">
              Last verified: ${
                new Intl.DateTimeFormat("en-US", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC"
                }).format(
                  new Date(
                    building.last_verified.trim() +
                    "-01T00:00:00Z"
                  )
                )
              }${
                building.verified_by
                  ? ` by ${escapeHTML(building.verified_by)}`
                  : ""
              }
            </p>
          `
          : ""
      }

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

  // DEBUT — Consultation immediate de la fiche
  if (typeof gtag === "function") {
    gtag("event", "building_view", {
      building_id: String(building.id ?? ""),
      building_name: building.building_name || "",
      main_address: building.main_address || ""
    });
  }
  // FIN — Consultation immediate de la fiche

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

// DEBUT DU SUIVI DES RECHERCHES SANS RESULTAT

let lastMissingSearch = { term: "", sentAt: 0 };

function prepareMissingSearchTerm(value) {
  const input = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

  // Écarte les coordonnées personnelles évidentes.
  if (/@|https?:|www\.|\+\d/i.test(input)) return "";
  if (/\b(?:\d[\s().-]*){7,}\b/.test(input)) return "";

  // Conserve l'adresse du bâtiment sans numéro d'appartement.
  const term = input
    .replace(
      /\s*,?\s+(?:apt\.?|apartment|suite|ste\.?|unit|floor|fl\.?)\b.*$/i,
      ""
    )
    .replace(/\s*#.*$/, "")
    .trim();

  if (term.length < 5 || term.length > 100) return "";

  // Retient les adresses commençant par un numéro.
  if (!/^\d+[a-z]?(?:[-–]\d+[a-z]?)?\s+.*[a-z]{2}/i.test(term)) {
    return "";
  }

  return term;
}

function trackSearchNoResults(value) {
  if (typeof gtag !== "function") return;

  const term = prepareMissingSearchTerm(value);
  if (!term) return;

  const key = normalizeText(term);
  const now = Date.now();

  // Évite de compter deux fois un double clic immédiat.
  if (
    lastMissingSearch.term === key &&
    now - lastMissingSearch.sentAt < 2000
  ) {
    return;
  }

  try {
    gtag("event", "search_no_results", {
      unmatched_address: term
    });

    lastMissingSearch = { term: key, sentAt: now };
  } catch {
    // La recherche continue même si Analytics échoue.
  }
}

// FIN DU SUIVI DES RECHERCHES SANS RESULTAT

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
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
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

// DEBUT — Actualisation du compteur journalier
let displayedDayKey = getTodayKey();

function refreshDailyCounter() {
  displayedDayKey = getTodayKey();
  updateTotalDisplay();
}

// Vérifie le changement de journée toutes les secondes.
setInterval(() => {
  if (getTodayKey() !== displayedDayKey) {
    refreshDailyCounter();
  }
}, 1000);

// Actualise aussi lorsque la personne revient sur DockMap.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshDailyCounter();
  }
});

window.addEventListener("pageshow", refreshDailyCounter);
// FIN — Actualisation du compteur journalier



// ==================================================
// Installation de DockMap sur le téléphone
// ==================================================

(() => {
  const banner = document.getElementById("installBanner");
  const installButton = document.getElementById("installButton");
  const dismissButton = document.getElementById("dismissInstall");
  const footerButton = document.getElementById("installFooterButton");

  if (!banner || !installButton || !dismissButton || !footerButton) {
    return;
  }

  const dismissalKey = "dockmapInstallDismissedUntil";
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const standaloneMode = window.matchMedia("(display-mode: standalone)");

  const isAppleMobile =
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const isAndroid = /Android/i.test(navigator.userAgent);

  let pendingPrompt = null;
  let installedThisSession = false;
  let promptOpen = false;
  let dismissedUntil = 0;

  try {
    dismissedUntil =
      Number(localStorage.getItem(dismissalKey)) || 0;
  } catch {
    // Le bouton fonctionne aussi si le stockage est bloqué.
  }

  function isStandalone() {
    return standaloneMode.matches || navigator.standalone === true;
  }

  function refreshInstallButtons() {
    const installed = isStandalone() || installedThisSession;
    const canOfferHelp = isAppleMobile || isAndroid || !!pendingPrompt;

    banner.hidden =
      installed ||
      !canOfferHelp ||
      Date.now() < dismissedUntil;

    footerButton.hidden = installed || !canOfferHelp;

    installButton.disabled = promptOpen;
    footerButton.disabled = promptOpen;
  }

  function showInstallHelp() {
    if (isAppleMobile) {
      window.alert(
        "Add DockMap to your Home Screen\n\n" +
        "1. Open this website in Safari or Chrome.\n" +
        "2. Open the Share menu (square with an upward arrow).\n" +
        "3. Choose “Add to Home Screen”.\n" +
        "4. Keep “Open as Web App” enabled if shown, then tap “Add”.\n\n" +
        "If the option is missing, scroll down in the Share menu " +
        "and select “Edit Actions”."
      );
      return;
    }

    window.alert(
      "Add DockMap to your device\n\n" +
      "Open your browser menu and look for “Add to Home screen” " +
      "or “Install app”.\n\n" +
      "If you are using an in-app browser, open this website " +
      "in Chrome first.\n\n" +
      "If no installation option appears, this browser cannot " +
      "offer installation right now."
    );
  }

  async function requestInstallation() {
    if (promptOpen || isStandalone() || installedThisSession) {
      return;
    }

    if (!pendingPrompt) {
      showInstallHelp();
      return;
    }

    const promptEvent = pendingPrompt;
    pendingPrompt = null;
    promptOpen = true;
    refreshInstallButtons();

    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      showInstallHelp();
    } finally {
      promptOpen = false;
      refreshInstallButtons();
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    pendingPrompt = event;
    refreshInstallButtons();
  });

  window.addEventListener("appinstalled", () => {
    installedThisSession = true;
    pendingPrompt = null;
    refreshInstallButtons();
  });

  installButton.addEventListener("click", requestInstallation);
  footerButton.addEventListener("click", requestInstallation);

  dismissButton.addEventListener("click", () => {
    dismissedUntil = Date.now() + sevenDays;

    try {
      localStorage.setItem(dismissalKey, String(dismissedUntil));
    } catch {
      // La fermeture reste effective pour cette page.
    }

    refreshInstallButtons();
    footerButton.focus();
  });

  standaloneMode.addEventListener("change", refreshInstallButtons);
  window.addEventListener("pageshow", refreshInstallButtons);

  refreshInstallButtons();
})();



/* ==================================================
   Add a building
   ================================================== */

const openAddBuildingBtn = document.getElementById("openAddBuilding");
const addBuildingOverlay = document.getElementById("addBuildingOverlay");
const closeAddBuildingBtn = document.getElementById("closeAddBuilding");

const addBuildingForm = document.getElementById("addBuildingForm");
const addBuildingFormView = document.getElementById("addBuildingFormView");

const submittedBuildingAddress = document.getElementById("submittedBuildingAddress");
const submittedDeliveryHours = document.getElementById("submittedDeliveryHours");

const submittedEntrancePhotos = document.getElementById(
  "submittedEntrancePhotos"
);

const submittedPhotosGrid = document.getElementById(
  "submittedPhotosGrid"
);

const addBuildingPhotoButton = document.getElementById(
  "addBuildingPhotoButton"
);

const submittedPhotosCount = document.getElementById(
  "submittedPhotosCount"
);

let selectedBuildingPhotos = [];


const addBuildingSuccess = document.getElementById(
  "addBuildingSuccess"
);

const finishAddBuildingBtn = document.getElementById(
  "finishAddBuilding"
);


/* Ouvrir la fenêtre */

function openAddBuilding() {
  addBuildingOverlay.hidden = false;
  document.body.style.overflow = "hidden";
}


/* Fermer la fenêtre */

function closeAddBuilding() {
  addBuildingOverlay.hidden = true;
  document.body.style.overflow = "";
}


/* Clic sur + Add a building */

openAddBuildingBtn?.addEventListener("click", () => {
  openAddBuilding();
});


/* Clic sur X */

closeAddBuildingBtn?.addEventListener("click", () => {
  closeAddBuilding();
});


/* Clic sur le fond sombre */

addBuildingOverlay?.addEventListener("click", (event) => {
  if (event.target === addBuildingOverlay) {
    closeAddBuilding();
  }
});


/* Touche Escape sur ordinateur */

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    addBuildingOverlay &&
    !addBuildingOverlay.hidden
  ) {
    closeAddBuilding();
  }
});


/* ==================================================
   Photos — maximum 3
   ================================================== */

function renderSelectedBuildingPhotos() {
  // Supprime uniquement les anciennes vignettes
  submittedPhotosGrid
    .querySelectorAll(".add-building-photo-preview-item")
    .forEach((item) => item.remove());

  // Crée une vignette pour chaque photo
  selectedBuildingPhotos.forEach((photo, index) => {
    const photoItem = document.createElement("div");
    photoItem.className = "add-building-photo-preview-item";

    const image = document.createElement("img");
    image.src = photo.url;
    image.alt = `Service entrance photo ${index + 1}`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "add-building-remove-photo";
    removeButton.setAttribute(
      "aria-label",
      `Remove photo ${index + 1}`
    );
    removeButton.textContent = "×";

    // Supprimer seulement cette photo
    removeButton.addEventListener("click", () => {
      URL.revokeObjectURL(selectedBuildingPhotos[index].url);

      selectedBuildingPhotos.splice(index, 1);

      renderSelectedBuildingPhotos();
    });

    photoItem.appendChild(image);
    photoItem.appendChild(removeButton);

    submittedPhotosGrid.insertBefore(
      photoItem,
      addBuildingPhotoButton
    );
  });

  // Cache + Add photo lorsque 3 photos sont présentes
  addBuildingPhotoButton.hidden =
    selectedBuildingPhotos.length >= 3;

  // Met à jour le compteur
  submittedPhotosCount.textContent =
    `${selectedBuildingPhotos.length} of 3 photos selected`;
}


/* Quand le livreur choisit des photos */

submittedEntrancePhotos?.addEventListener("change", () => {
  const newPhotos = Array.from(
    submittedEntrancePhotos.files || []
  );

  newPhotos.forEach((photo) => {
    // Maximum 3
    if (selectedBuildingPhotos.length >= 3) {
      return;
    }

    // Accepte uniquement les images
    if (!photo.type.startsWith("image/")) {
      return;
    }

    selectedBuildingPhotos.push({
      file: photo,
      url: URL.createObjectURL(photo)
    });
  });

  /*
    Important :
    on vide l'input pour permettre de sélectionner
    à nouveau la même photo après l'avoir supprimée.
  */
  submittedEntrancePhotos.value = "";

  renderSelectedBuildingPhotos();
});


/* Submit — TEST seulement pour le moment */

addBuildingForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  // Au moins une photo est obligatoire
  if (selectedBuildingPhotos.length === 0) {
    alert("Please add at least one service entrance photo.");
    return;
  }

  try {
        // 1. Enregistrer d'abord la soumission du building
    const { data: submissionData, error: insertError } = await dockmapSupabase
      .from("building_submissions")
      .insert({
        building_address: submittedBuildingAddress.value.trim(),
        delivery_hours: submittedDeliveryHours.value.trim(),
        status: "pending"
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    const submissionId = submissionData.id;

    // 2. Upload des photos et liaison avec la soumission
    for (const photo of selectedBuildingPhotos) {
      const fileName =
        `${Date.now()}-${crypto.randomUUID()}-${photo.file.name}`;

      const { error: uploadError } = await dockmapSupabase.storage
        .from("building-submission-photos")
        .upload(fileName, photo.file);

      if (uploadError) {
        throw uploadError;
      }

      // Enregistrer le lien entre la photo et la soumission
      const { error: photoInsertError } = await dockmapSupabase
        .from("building_submission_photos")
        .insert({
          submission_id: submissionId,
          file_path: fileName
        });

      if (photoInsertError) {
        throw photoInsertError;
      }
    }

    // 3. Afficher le succès seulement si tout a fonctionné
    addBuildingFormView.hidden = true;
    addBuildingSuccess.hidden = false;
  } catch (error) {
    console.error("DockMap submission error:", error);
    alert("Something went wrong. Please try again.");
  }
});

/* Done */

finishAddBuildingBtn?.addEventListener("click", () => {
  closeAddBuilding();

  // Vide les champs du formulaire
  addBuildingForm.reset();

  // Libère les aperçus des photos
  selectedBuildingPhotos.forEach((photo) => {
    URL.revokeObjectURL(photo.url);
  });

  // Vide la liste des photos
  selectedBuildingPhotos = [];

  // Remet la zone photo à zéro
  renderSelectedBuildingPhotos();

  // Prépare le formulaire pour la prochaine contribution
  addBuildingSuccess.hidden = true;
  addBuildingFormView.hidden = false;
});