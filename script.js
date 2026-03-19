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

  const imagesHtml = Array.isArray(found.images)
    ? found.images
        .map((imagePath) => `<img src="/DockMap/${imagePath}" alt="Service entrance photo">`)
        .join("")
    : "";

  resultDiv.innerHTML = `
    <h2>${found.main_address}</h2>

   <div class="info-row">
    <span class="label">Service Entrance:</span> 
    <span class="address-text">${found.service_entrance}</span>
    <button class="copy-btn" onclick="copyAddress('${found.service_entrance}')">
    Copy
    </button>
   </div>

    <div class="info-row">
      <span class="label">Average Delivery Time:</span> ${found.avg_delivery_time || "Not available"}
    </div>

    <div class="info-row">
      <span class="label">Delivery Access:</span> ${found.delivery_access || "Not available"}
    </div>

    <div class="info-row">
      <span class="label">Notes:</span> ${found.notes || "No additional notes"}
    </div>

    <div class="links">
      <a href="${buildGoogleMapsLink(found.service_entrance)}" target="_blank">Open Service Entrance in Google Maps</a>
      <a href="${buildWazeLink(found.service_entrance)}" target="_blank">Open Service Entrance in Waze</a>
      <a href="${buildGoogleMapsLink(found.main_address)}" target="_blank">Open Main Address in Google Maps</a>
    </div>

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

searchBtn.addEventListener("click", searchBuilding);

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