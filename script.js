let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let intendedPlaying = localStorage.getItem("intendedPlaying") === "true" || false;
let stationLists = JSON.parse(localStorage.getItem("stationLists")) || {};
let userAddedStations = JSON.parse(localStorage.getItem("userAddedStations")) || {};
let stationItems = [];
let abortController = new AbortController();
let errorCount = 0;
const ERROR_LIMIT = 15;
let pastSearches = JSON.parse(localStorage.getItem("pastSearches")) || [];
let deletedStations = JSON.parse(localStorage.getItem("deletedStations")) || [];
let customTabs = JSON.parse(localStorage.getItem("customTabs")) || [];
let isAutoPlayPending = false;
let lastSuccessfulPlayTime = 0;
let streamAbortController = null;
let errorTimeout = null;
let autoPlayRequestId = 0; // Unique ID for autoplay requests
let currentVisualizer = localStorage.getItem("currentVisualizer") || "wave";
const visualizers = ["wave", "circles", "dots", "bars"];
customTabs = Array.isArray(customTabs) ? customTabs.filter(tab => typeof tab === "string" && tab.trim()) : [];

document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
  const currentStationInfo = document.getElementById("currentStationInfo");
  const themeToggle = document.querySelector(".theme-toggle");
  const shareButton = document.querySelector(".share-button");
  const exportButton = document.querySelector(".export-button");
  const importButton = document.querySelector(".import-button");
  const importFileInput = document.getElementById("importFileInput");
  const searchInput = document.getElementById("searchInput");
  const searchQuery = document.getElementById("searchQuery");
  const searchCountry = document.getElementById("searchCountry");
  const searchGenre = document.getElementById("searchGenre");
  const searchBtn = document.querySelector(".search-btn");
  const pastSearchesList = document.getElementById("pastSearches");
  const tabsContainer = document.getElementById("tabs");
  const waveVisualizer = document.querySelector(".wave-visualizer");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !shareButton || !exportButton || !importButton || !importFileInput || !searchInput || !searchQuery || !searchCountry || !searchGenre || !searchBtn || !pastSearchesList || !tabsContainer || !waveVisualizer) {
    console.error("One of required DOM elements not found", {
      audio: !!audio,
      stationList: !!stationList,
      playPauseBtn: !!playPauseBtn,
      currentStationInfo: !!currentStationInfo,
      themeToggle: !!themeToggle,
      shareButton: !!shareButton,
      exportButton: !!exportButton,
      importButton: !!importButton,
      importFileInput: !!importFileInput,
      searchInput: !!searchInput,
      searchQuery: !!searchQuery,
      searchCountry: !!searchCountry,
      searchGenre: !!searchGenre,
      searchBtn: !!searchBtn,
      pastSearchesList: !!pastSearchesList,
      tabsContainer: !!tabsContainer,
      waveVisualizer: !!waveVisualizer
    });
    setTimeout(initializeApp, 100);
    return;
  }

  initializeApp();

  function initializeApp() {
    console.log("Initializing app...");
    audio.preload = "auto";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

    updatePastSearches();
    populateSearchSuggestions();
    renderTabs();
    applyVisualizer();

    shareButton.addEventListener("click", () => {
      const stationName = currentStationInfo.querySelector(".station-name").textContent || "Radio S O";
      const shareData = {
        title: "Radio S O",
        text: `Listening to ${stationName} on Radio S O! Join my favorite radio stations!`,
        url: window.location.href
      };
      if (navigator.share) {
        navigator.share(shareData)
          .catch(error => console.error("Error sharing:", error));
      } else {
        alert(`Share function not supported. Copy: ${shareData.text} ${shareData.url}`);
      }
    });

    exportButton.addEventListener("click", exportSettings);
    importButton.addEventListener("click", () => importFileInput.click());
    importFileInput.addEventListener("change", importSettings);

    document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
    document.querySelector(".controls .control-btn:nth-child(2)").addEventListener("click", togglePlayPause);
    document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);

    waveVisualizer.addEventListener("click", toggleVisualizer);

    searchBtn.addEventListener("click", () => {
      const query = searchQuery.value.trim();
      const country = normalizeCountry(searchCountry.value.trim());
      const genre = searchGenre.value.trim().toLowerCase();
      console.log("Search:", { query, country, genre });
      if (query || country || genre) {
        if (query && !pastSearches.includes(query)) {
          pastSearches.unshift(query);
          if (pastSearches.length > 5) pastSearches.pop();
          localStorage.setItem("pastSearches", JSON.stringify(pastSearches));
          updatePastSearches();
        }
        searchStations(query, country, genre);
      } else {
        console.warn("All search fields are empty");
        stationList.innerHTML = "<div class='station-item empty'>Enter station name, country or genre</div>";
      }
    });

    searchQuery.addEventListener("keypress", (e) => {
      if (e.key === "Enter") searchBtn.click();
    });

    searchCountry.addEventListener("keypress", (e) => {
      if (e.key === "Enter") searchBtn.click();
    });

    searchGenre.addEventListener("keypress", (e) => {
      if (e.key === "Enter") searchBtn.click();
    });
  }

  function toggleVisualizer() {
    console.log("Toggling visualizer...");
    const currentIndex = visualizers.indexOf(currentVisualizer);
    currentVisualizer = visualizers[(currentIndex + 1) % visualizers.length];
    localStorage.setItem("currentVisualizer", currentVisualizer);
    applyVisualizer();
    console.log(`Switched to visualizer: ${currentVisualizer}`);
  }

  function applyVisualizer() {
    console.log("Applying visualizer:", currentVisualizer);
    const waveVisualizer = document.querySelector(".wave-visualizer");
    if (!waveVisualizer) {
      console.error("Wave visualizer element not found");
      return;
    }
    waveVisualizer.className = `wave-visualizer ${currentVisualizer}`;
    const visualizerElements = {
      "wave": ["wave-line", 9],
      "circles": ["circle", 9],
      "dots": ["dot", 9],
      "bars": ["bar", 9]
    };
    const [elementClass, count] = visualizerElements[currentVisualizer];
    waveVisualizer.innerHTML = Array.from({ length: count }, () => `<div class="${elementClass}"></div>`).join("");
    if (isPlaying) {
      console.log("Adding .playing class to visualizer elements");
      document.querySelectorAll(`.${elementClass}`).forEach(el => el.classList.add("playing"));
    }
  }

  function exportSettings() {
    const settings = {
      selectedTheme: localStorage.getItem("selectedTheme") || "deep-obsidian",
      customTabs: JSON.parse(localStorage.getItem("customTabs")) || [],
      userAddedStations: JSON.parse(localStorage.getItem("userAddedStations")) || {},
      favoriteStations: JSON.parse(localStorage.getItem("favoriteStations")) || [],
      pastSearches: JSON.parse(localStorage.getItem("pastSearches")) || [],
      deletedStations: JSON.parse(localStorage.getItem("deletedStations")) || [],
      currentTab: localStorage.getItem("currentTab") || "techno",
      currentVisualizer: localStorage.getItem("currentVisualizer") || "wave"
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "radio_settings.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("Settings exported:", settings);
  }

  function importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target.result);
        if (!settings || typeof settings !== "object") {
          alert("Invalid settings file!");
          return;
        }
        const validThemes = [
          "deep-obsidian", "void-nexus", "shadow-pulse", "dark-abyss",
          "cosmic-dream", "midnight-aurora", "emerald-glow", "retro-wave",
          "arctic-fusion", "golden-haze"
        ];
        if (settings.selectedTheme && validThemes.includes(settings.selectedTheme)) {
          localStorage.setItem("selectedTheme", settings.selectedTheme);
          applyTheme(settings.selectedTheme);
        }
        if (Array.isArray(settings.customTabs)) {
          const validTabs = settings.customTabs.filter(tab => 
            typeof tab === "string" && 
            tab.trim() && 
            tab.length <= 10 && 
            /^[a-z0-9_-]+$/.test(tab) && 
            !["best", "techno", "trance", "ukraine", "pop", "search"].includes(tab) &&
            !customTabs.includes(tab)
          );
          if (validTabs.length + customTabs.length <= 7) {
            customTabs = validTabs;
            localStorage.setItem("customTabs", JSON.stringify(customTabs));
          } else {
            console.warn("Imported custom tabs exceed limit of 7, skipping");
          }
        }
        if (settings.userAddedStations && typeof settings.userAddedStations === "object") {
          const validStations = {};
          Object.keys(settings.userAddedStations).forEach(tab => {
            if (["techno", "trance", "ukraine", "pop", ...customTabs].includes(tab)) {
              const stations = Array.isArray(settings.userAddedStations[tab]) 
                ? settings.userAddedStations[tab].filter(s => 
                    s && typeof s === "object" && 
                    s.name && typeof s.name === "string" && 
                    s.value && isValidUrl(s.value) && 
                    s.genre && typeof s.genre === "string" && 
                    s.country && typeof s.country === "string"
                  )
                : [];
              validStations[tab] = stations;
            }
          });
          userAddedStations = validStations;
          localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        }
        if (Array.isArray(settings.favoriteStations)) {
          favoriteStations = settings.favoriteStations.filter(name => typeof name === "string");
          localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
        }
        if (Array.isArray(settings.pastSearches)) {
          pastSearches = settings.pastSearches.filter(search => typeof search === "string").slice(0, 5);
          localStorage.setItem("pastSearches", JSON.stringify(pastSearches));
          updatePastSearches();
        }
        if (Array.isArray(settings.deletedStations)) {
          deletedStations = settings.deletedStations.filter(name => typeof name === "string");
          localStorage.setItem("deletedStations", JSON.stringify(deletedStations));
        }
        if (settings.currentTab && typeof settings.currentTab === "string") {
          const validTabs = ["best", "techno", "trance", "ukraine", "pop", "search", ...customTabs];
          if (validTabs.includes(settings.currentTab)) {
            currentTab = settings.currentTab;
            localStorage.setItem("currentTab", currentTab);
          }
        }
        if (settings.currentVisualizer && visualizers.includes(settings.currentVisualizer)) {
          currentVisualizer = settings.currentVisualizer;
          localStorage.setItem("currentVisualizer", currentVisualizer);
          applyVisualizer();
        }
        loadStations();
        switchTab(currentTab);
        console.log("Settings imported:", settings);
        alert("Settings imported successfully!");
      } catch (error) {
        console.error("Error importing settings:", error);
        alert("Error importing settings. Please check the file format.");
      }
      importFileInput.value = "";
    };
    reader.readAsText(file);
  }

  function populateSearchSuggestions() {
    const suggestedCountries = [
      "Germany", "France", "United Kingdom", "Italy", "Spain", "Netherlands",
      "Switzerland", "Belgium", "Sweden", "Norway", "Denmark", "Austria",
      "Poland", "Ukraine", "Canada", "United States", "Australia", "Japan",
      "South Korea", "New Zealand"
    ];
    const suggestedGenres = [
      "Pop", "Rock", "Dance", "Electronic", "Techno", "Trance", "House",
      "EDM", "Hip-Hop", "Rap", "Jazz", "Classical", "Country", "Reggae",
      "Blues", "Folk", "Metal", "R&B", "Soul", "Ambient"
    ];

    const countryDatalist = document.getElementById("suggestedCountries");
    const genreDatalist = document.getElementById("suggestedGenres");

    countryDatalist.innerHTML = suggestedCountries.map(country => `<option value="${country}">`).join("");
    genreDatalist.innerHTML = suggestedGenres.map(genre => `<option value="${genre}">`).join("");
  }

  function updatePastSearches() {
    pastSearchesList.innerHTML = "";
    pastSearches.forEach(search => {
      const option = document.createElement("option");
      option.value = search;
      pastSearchesList.appendChild(option);
    });
  }

  function normalizeCountry(country) {
    if (!country) return "";
    const countryMap = {
      "ukraine": "Ukraine", "italy": "Italy", "german": "Germany",
      "germany": "Germany", "france": "France", "spain": "Spain",
      "usa": "United States", "united states": "United States",
      "uk": "United Kingdom", "united kingdom": "United Kingdom",
      "netherlands": "Netherlands", "canada": "Canada", "australia": "Australia",
      "switzerland": "Switzerland", "belgium": "Belgium", "poland": "Poland",
      "austria": "Austria", "sweden": "Sweden", "norway": "Norway",
      "denmark": "Denmark", "japan": "Japan", "south korea": "South Korea",
      "new zealand": "New Zealand"
    };
    const normalized = country.toLowerCase();
    return countryMap[normalized] || country.charAt(0).toUpperCase() + country.slice(1).toLowerCase();
  }

  function isValidUrl(url) {
    if (!url) return false;
    try {
      new URL(url);
      return /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(url);
    } catch {
      return false;
    }
  }

  function normalizeUrl(url) {
    if (!url) return "";
    try {
      const urlObj = new URL(url);
      return urlObj.origin + urlObj.pathname;
    } catch {
      return url;
    }
  }

  function resetStationInfo() {
    const stationNameElement = currentStationInfo.querySelector(".station-name");
    const stationGenreElement = currentStationInfo.querySelector(".station-genre");
    const stationCountryElement = currentStationInfo.querySelector(".station-country");
    const stationIconElement = currentStationInfo.querySelector(".station-icon");
    if (stationNameElement) stationNameElement.textContent = "Select station";
    else console.error(".station-name element not found");
    if (stationGenreElement) stationGenreElement.textContent = "genre: -";
    else console.error(".station-genre element not found");
    if (stationCountryElement) stationCountryElement.textContent = "country: -";
    else console.error(".station-country element not found");
    if (stationIconElement) {
      stationIconElement.innerHTML = "🎵";
      stationIconElement.style.backgroundImage = "none";
    } else console.error(".station-icon element not found");
  }

  async function loadStations() {
    console.time("loadStations");
    stationList.innerHTML = "<div class='station-item empty'>Loading...</div>";
    try {
      abortController.abort();
      abortController = new AbortController();
      const response = await fetch(`stations.json?t=${Date.now()}`, {
        cache: "no-store",
        signal: abortController.signal
      });
      console.log(`Response status: ${response.status}`);
      const mergedStationLists = {};
      if (response.ok) {
        const newStations = await response.json();
        Object.keys(newStations).forEach(tab => {
          const uniqueStations = new Map();
          (userAddedStations[tab] || []).forEach(s => {
            if (!deletedStations.includes(s.name)) {
              uniqueStations.set(s.name, s);
            }
          });
          newStations[tab].forEach(s => {
            if (!deletedStations.includes(s.name)) {
              uniqueStations.set(s.name, s);
            }
          });
          mergedStationLists[tab] = Array.from(uniqueStations.values());
          console.log(`Added to ${tab}:`, mergedStationLists[tab].map(s => s.name));
        });
      } else {
        console.warn("Failed to load stations.json, using cached data");
      }
      customTabs.forEach(tab => {
        const uniqueStations = new Map();
        (userAddedStations[tab] || []).forEach(s => {
          if (!deletedStations.includes(s.name)) {
            uniqueStations.set(s.name, s);
          }
        });
        (stationLists[tab] || []).forEach(s => {
          if (!deletedStations.includes(s.name)) {
            uniqueStations.set(s.name, s);
          }
        });
        mergedStationLists[tab] = Array.from(uniqueStations.values());
        console.log(`Saved for custom tab ${tab}:`, mergedStationLists[tab].map(s => s.name));
      });
      stationLists = mergedStationLists;
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
      favoriteStations = favoriteStations.filter(name => 
        Object.values(stationLists).flat().some(s => s.name === name)
      );
      localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
      const validTabs = [...Object.keys(stationLists), "best", "search", ...customTabs];
      if (!validTabs.includes(currentTab)) {
        currentTab = validTabs[0] || "techno";
        localStorage.setItem("currentTab", currentTab);
      }
      currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
      switchTab(currentTab);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Error loading stations:", error);
        customTabs.forEach(tab => {
          const uniqueStations = new Map();
          (userAddedStations[tab] || []).forEach(s => {
            if (!deletedStations.includes(s.name)) {
              uniqueStations.set(s.name, s);
            }
          });
          (stationLists[tab] || []).forEach(s => {
            if (!deletedStations.includes(s.name)) {
              uniqueStations.set(s.name, s);
            }
          });
          stationLists[tab] = Array.from(uniqueStations.values());
        });
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        stationList.innerHTML = "<div class='station-item empty'>Failed to load stations</div>";
      }
    } finally {
      console.timeEnd("loadStations");
    }
  }

  async function searchStations(query, country, genre) {
    stationList.innerHTML = "<div class='station-item empty'>Searching...</div>";
    try {
      abortController.abort();
      abortController = new AbortController();
      const params = new URLSearchParams();
      if (query) params.append("name", query);
      if (country) params.append("country", country);
      if (genre) params.append("tag", genre);
      params.append("order", "clickcount");
      params.append("reverse", "true");
      params.append("limit", "2000");
      const url = `https://de1.api.radio-browser.info/json/stations/search?${params.toString()}`;
      console.log("API request:", url);
      const response = await fetch(url, {
        signal: abortController.signal
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      let stations = await response.json();
      stations = stations.filter(station => station.url_resolved && isValidUrl(station.url_resolved));
      console.log("Received stations (after HTTPS filter):", stations.length);
      renderSearchResults(stations);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error("Error searching stations:", error);
        stationList.innerHTML = "<div class='station-item empty'>Failed to find stations</div>";
      }
    }
  }

  function renderSearchResults(stations) {
    if (!stations.length) {
      stationList.innerHTML = "<div class='station-item empty'>Nothing found</div>";
      stationItems = [];
      return;
    }
    const fragment = document.createDocumentFragment();
    stations.forEach((station, index) => {
      const item = document.createElement("div");
      item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
      item.dataset.value = station.url || station.url_resolved;
      item.dataset.name = station.name || "Unknown";
      item.dataset.genre = shortenGenre(station.tags || "Unknown");
      item.dataset.country = station.country || "Unknown";
      item.dataset.favicon = station.favicon && isValidUrl(station.favicon) ? station.favicon : "";
      const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" style="width: 32px; height: 32px; object-fit: contain; margin-right: 10px;" onerror="this.outerHTML='🎵 '">` : "🎵 ";
      item.innerHTML = `${iconHtml}<span class="station-name">${station.name}</span><button class="add-btn">ADD</button>`;
      fragment.appendChild(item);
    });
    stationList.innerHTML = "";
    stationList.appendChild(fragment);
    stationItems = document.querySelectorAll(".station-item");
    if (stationItems.length && currentIndex < stationItems.length) {
      changeStation(currentIndex);
    }
    stationList.onclick = e => {
      const item = e.target.closest(".station-item");
      const addBtn = e.target.closest(".add-btn");
      if (item && !item.classList.contains("empty")) {
        currentIndex = Array.from(stationItems).indexOf(item);
        changeStation(currentIndex);
      }
      if (addBtn) {
        e.stopPropagation();
        showTabModal(item);
      }
    };
  }

  function shortenGenre(tags) {
    const genres = tags.split(",").map(g => g.trim()).filter(g => g);
    return genres.length > 4 ? genres.slice(0, 4).join(", ") + "..." : genres.join(", ");
  }

  function showTabModal(item) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <h2>Select tab</h2>
      <div class="modal-tabs">
        <button class="modal-tab-btn" data-tab="techno">TECHNO</button>
        <button class="modal-tab-btn" data-tab="trance">TRANCE</button>
        <button class="modal-tab-btn" data-tab="ukraine">UA</button>
        <button class="modal-tab-btn" data-tab="pop">POP</button>
        ${customTabs.map(tab => `<button class="modal-tab-btn" data-tab="${tab}">${tab.toUpperCase()}</button>`).join('')}
        <button class="modal-cancel-btn">Cancel</button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    const closeModal = () => {
      overlay.remove();
      modal.remove();
    };
    overlay.addEventListener("click", closeModal);
    modal.querySelectorAll(".modal-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetTab = btn.dataset.tab;
        saveStation(item, targetTab);
        closeModal();
      });
    });
    modal.querySelector(".modal-cancel-btn").addEventListener("click", closeModal);
  }

  function saveStation(item, targetTab) {
    const stationName = item.dataset.name;
    if (!stationLists[targetTab]) stationLists[targetTab] = [];
    if (!userAddedStations[targetTab]) userAddedStations[targetTab] = [];
    if (!stationLists[targetTab].some(s => s.name === stationName)) {
      const newStation = {
        value: item.dataset.value,
        name: item.dataset.name,
        genre: item.dataset.genre,
        country: item.dataset.country,
        favicon: item.dataset.favicon || "",
        isFromSearch: currentTab === "search"
      };
      stationLists[targetTab].unshift(newStation);
      userAddedStations[targetTab].unshift(newStation);
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
      localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
      console.log(`Added station ${stationName} to ${targetTab}:`, newStation);
      if (currentTab !== "search") {
        updateStationList();
      }
    } else {
      alert("This station is already added to the selected tab!");
    }
  }

  function renderTabs() {
    const fixedTabs = ["best", "techno", "trance", "ukraine", "pop", "search"];
    tabsContainer.innerHTML = "";
    fixedTabs.forEach(tab => {
      const btn = document.createElement("button");
      btn.className = `tab-btn ${currentTab === tab ? "active" : ""}`;
      btn.dataset.tab = tab;
      btn.textContent = tab === "best" ? "Best" : tab === "ukraine" ? "UA" : tab === "search" ? "Search" : tab.charAt(0).toUpperCase() + tab.slice(1);
      tabsContainer.appendChild(btn);
    });
    customTabs.forEach(tab => {
      if (typeof tab !== "string" || !tab.trim()) return;
      const btn = document.createElement("button");
      btn.className = `tab-btn ${currentTab === tab ? "active" : ""}`;
      btn.dataset.tab = tab;
      btn.textContent = tab.toUpperCase();
      tabsContainer.appendChild(btn);
    });
    const addBtn = document.createElement("button");
    addBtn.className = "add-tab-btn";
    addBtn.textContent = "+";
    tabsContainer.appendChild(addBtn);

    tabsContainer.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
      if (customTabs.includes(btn.dataset.tab)) {
        let longPressTimer;
        btn.addEventListener("pointerdown", () => {
          longPressTimer = setTimeout(() => showEditTabModal(btn.dataset.tab), 500);
        });
        btn.addEventListener("pointerup", () => clearTimeout(longPressTimer));
        btn.addEventListener("pointerleave", () => clearTimeout(longPressTimer));
      }
    });

    addBtn.addEventListener("click", showNewTabModal);
  }

  function showNewTabModal() {
    const overlay = document.querySelector(".new-tab-modal");
    const modal = overlay.querySelector(".modal");
    const input = document.getElementById("newTabName");
    const createBtn = document.getElementById("createTabBtn");
    const cancelBtn = modal.querySelector(".modal-cancel-btn");

    overlay.style.display = "block";
    input.value = "";
    input.focus();

    const closeModal = () => {
      overlay.style.display = "none";
      createBtn.removeEventListener("click", createTabHandler);
      cancelBtn.removeEventListener("click", closeModal);
      overlay.removeEventListener("click", closeModal);
      input.removeEventListener("keypress", keypressHandler);
    };

    const createTabHandler = () => {
      const tabName = input.value.trim().toLowerCase();
      if (!tabName) {
        alert("Enter tab name!");
        return;
      }
      if (["best", "techno", "trance", "ukraine", "pop", "search"].includes(tabName) || customTabs.includes(tabName)) {
        alert("This tab name already exists!");
        return;
      }
      if (tabName.length > 10 || !/^[a-z0-9_-]+$/.test(tabName)) {
        alert("Tab name cannot exceed 10 characters and must contain only Latin letters, numbers, hyphen or underscore.");
        return;
      }
      if (customTabs.length >= 7) {
        alert("Maximum of 7 custom tabs reached!");
        return;
      }
      customTabs.push(tabName);
      stationLists[tabName] = [];
      userAddedStations[tabName] = [];
      localStorage.setItem("customTabs", JSON.stringify(customTabs));
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
      localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
      console.log(`Created new tab ${tabName}`);
      renderTabs();
      switchTab(tabName);
      closeModal();
    };

    const keypressHandler = (e) => {
      if (e.key === "Enter") createBtn.click();
    };

    createBtn.addEventListener("click", createTabHandler);
    cancelBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", closeModal);
    input.addEventListener("keypress", keypressHandler);
  }

  function showEditTabModal(tab) {
    const overlay = document.querySelector(".edit-tab-modal");
    const modal = overlay.querySelector(".modal");
    const input = document.getElementById("renameTabName");
    const renameBtn = document.getElementById("renameTabBtn");
    const deleteBtn = document.getElementById("deleteTabBtn");
    const cancelBtn = modal.querySelector(".modal-cancel-btn");

    overlay.style.display = "block";
    input.value = tab;
    input.focus();

    const closeModal = () => {
      overlay.style.display = "none";
      renameBtn.removeEventListener("click", renameTabHandler);
      deleteBtn.removeEventListener("click", deleteTabHandler);
      cancelBtn.removeEventListener("click", closeModal);
      overlay.removeEventListener("click", closeModal);
      input.removeEventListener("keypress", keypressHandler);
    };

    const renameTabHandler = () => {
      const newTabName = input.value.trim().toLowerCase();
      if (!newTabName) {
        alert("Enter new tab name!");
        return;
      }
      if (["best", "techno", "trance", "ukraine", "pop", "search"].includes(newTabName) || customTabs.includes(newTabName)) {
        alert("This tab name already exists!");
        return;
      }
      if (newTabName.length > 10 || !/^[a-z0-9_-]+$/.test(newTabName)) {
        alert("Tab name cannot exceed 10 characters and must contain only Latin letters, numbers, hyphen or underscore.");
        return;
      }
      const index = customTabs.indexOf(tab);
      customTabs[index] = newTabName;
      stationLists[newTabName] = stationLists[tab] || [];
      userAddedStations[newTabName] = userAddedStations[tab] || [];
      delete stationLists[tab];
      delete userAddedStations[tab];
      localStorage.setItem("customTabs", JSON.stringify(customTabs));
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
      localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
      console.log(`Renamed tab ${tab} to ${newTabName}`);
      if (currentTab === tab) {
        currentTab = newTabName;
        localStorage.setItem("currentTab", currentTab);
      }
      renderTabs();
      switchTab(currentTab);
      closeModal();
    };

    const deleteTabHandler = () => {
      if (confirm(`Are you sure you want to delete the tab "${tab}"?`)) {
        customTabs = customTabs.filter(t => t !== tab);
        delete stationLists[tab];
        delete userAddedStations[tab];
        localStorage.setItem("customTabs", JSON.stringify(customTabs));
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        console.log(`Deleted tab ${tab}`);
        if (currentTab === tab) {
          currentTab = "techno";
          localStorage.setItem("currentTab", currentTab);
        }
        renderTabs();
        switchTab(currentTab);
        closeModal();
      }
    };

    const keypressHandler = (e) => {
      if (e.key === "Enter") renameBtn.click();
    };

    renameBtn.addEventListener("click", renameTabHandler);
    deleteBtn.addEventListener("click", deleteTabHandler);
    cancelBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", closeModal);
    input.addEventListener("keypress", keypressHandler);
  }

  function switchTab(tab) {
    console.log(`Switching to tab: ${tab}`);
    currentTab = tab;
    localStorage.setItem("currentTab", currentTab);
    currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
    searchInput.style.display = tab === "search" ? "flex" : "none";
    renderTabs();
    updateStationList();
  }

  function updateStationList() {
    stationList.innerHTML = "<div class='station-item empty'>Loading...</div>";
    let stations = [];
    if (currentTab === "best") {
      stations = favoriteStations
        .map(name => Object.values(stationLists).flat().find(s => s.name === name))
        .filter(s => s);
    } else if (currentTab === "search") {
      stationList.innerHTML = "<div class='station-item empty'>Enter search query</div>";
      return;
    } else {
      stations = (stationLists[currentTab] || []).filter(s => !deletedStations.includes(s.name));
    }
    if (!stations.length) {
      stationList.innerHTML = "<div class='station-item empty'>No stations available</div>";
      resetStationInfo();
      stopAudio();
      return;
    }
    const fragment = document.createDocumentFragment();
    stations.forEach((station, index) => {
      const item = document.createElement("div");
      item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
      item.dataset.value = station.value;
      item.dataset.name = station.name;
      item.dataset.genre = station.genre || "Unknown";
      item.dataset.country = station.country || "Unknown";
      item.dataset.favicon = station.favicon || "";
      const iconHtml = station.favicon ? `<img src="${station.favicon}" alt="${station.name} icon" style="width: 32px; height: 32px; object-fit: contain; margin-right: 10px;" onerror="this.outerHTML='🎵 '">` : "🎵 ";
      const isFavorited = favoriteStations.includes(station.name);
      item.innerHTML = `
        ${iconHtml}
        <span class="station-name">${station.name}</span>
        <div class="buttons-container">
          <button class="favorite-btn ${isFavorited ? "favorited" : ""}">${isFavorited ? "★" : "☆"}</button>
          ${station.isFromSearch ? '<button class="delete-btn">🗑</button>' : ""}
        </div>
      `;
      fragment.appendChild(item);
    });
    stationList.innerHTML = "";
    stationList.appendChild(fragment);
    stationItems = document.querySelectorAll(".station-item");
    stationList.onclick = e => {
      const item = e.target.closest(".station-item");
      const favoriteBtn = e.target.closest(".favorite-btn");
      const deleteBtn = e.target.closest(".delete-btn");
      if (item && !item.classList.contains("empty")) {
        currentIndex = Array.from(stationItems).indexOf(item);
        changeStation(currentIndex);
      }
      if (favoriteBtn) {
        e.stopPropagation();
        const stationName = favoriteBtn.closest(".station-item").dataset.name;
        toggleFavorite(stationName);
      }
      if (deleteBtn) {
        e.stopPropagation();
        const stationName = deleteBtn.closest(".station-item").dataset.name;
        deleteStation(stationName);
      }
    };
    if (stationItems.length && currentIndex < stationItems.length) {
      changeStation(currentIndex);
    } else {
      resetStationInfo();
      stopAudio();
    }
  }

  function toggleFavorite(stationName) {
    if (favoriteStations.includes(stationName)) {
      favoriteStations = favoriteStations.filter(name => name !== stationName);
    } else {
      favoriteStations.push(stationName);
    }
    localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
    console.log(`Toggled favorite for ${stationName}:`, favoriteStations);
    if (currentTab === "best") {
      updateStationList();
    } else {
      const item = Array.from(stationItems).find(item => item.dataset.name === stationName);
      if (item) {
        const btn = item.querySelector(".favorite-btn");
        btn.classList.toggle("favorited");
        btn.textContent = favoriteStations.includes(stationName) ? "★" : "☆";
      }
    }
  }

  function deleteStation(stationName) {
    if (confirm(`Are you sure you want to delete the station "${stationName}"?`)) {
      deletedStations.push(stationName);
      localStorage.setItem("deletedStations", JSON.stringify(deletedStations));
      Object.keys(stationLists).forEach(tab => {
        stationLists[tab] = stationLists[tab].filter(s => s.name !== stationName);
      });
      Object.keys(userAddedStations).forEach(tab => {
        userAddedStations[tab] = userAddedStations[tab].filter(s => s.name !== stationName);
      });
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
      localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
      console.log(`Deleted station ${stationName}`);
      updateStationList();
    }
  }

  function changeStation(index) {
    console.log(`Changing station to index: ${index}`);
    if (stationItems.length === 0) {
      console.warn("No stations available");
      resetStationInfo();
      stopAudio();
      return;
    }
    if (index < 0 || index >= stationItems.length) {
      currentIndex = 0;
      index = 0;
    }
    currentIndex = index;
    localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
    stationItems.forEach(item => item.classList.remove("selected"));
    if (stationItems[currentIndex]) {
      stationItems[currentIndex].classList.add("selected");
      const station = {
        value: stationItems[currentIndex].dataset.value,
        name: stationItems[currentIndex].dataset.name,
        genre: stationItems[currentIndex].dataset.genre,
        country: stationItems[currentIndex].dataset.country,
        favicon: stationItems[currentIndex].dataset.favicon
      };
      updateStationInfo(station);
      playStation(station);
    }
  }

  function updateStationInfo(station) {
    const stationNameElement = currentStationInfo.querySelector(".station-name");
    const stationGenreElement = currentStationInfo.querySelector(".station-genre");
    const stationCountryElement = currentStationInfo.querySelector(".station-country");
    const stationIconElement = currentStationInfo.querySelector(".station-icon");
    if (stationNameElement) stationNameElement.textContent = station.name || "Select station";
    if (stationGenreElement) stationGenreElement.textContent = `genre: ${station.genre || "-"}`;
    if (stationCountryElement) stationCountryElement.textContent = `country: ${station.country || "-"}`;
    if (stationIconElement) {
      if (station.favicon) {
        stationIconElement.style.backgroundImage = `url(${station.favicon})`;
        stationIconElement.innerHTML = "";
      } else {
        stationIconElement.style.backgroundImage = "none";
        stationIconElement.innerHTML = "🎵";
      }
    }
  }

  function playStation(station) {
    console.log(`Playing station: ${station.name}, URL: ${station.value}`);
    if (streamAbortController) {
      streamAbortController.abort();
    }
    streamAbortController = new AbortController();
    audio.src = station.value;
    const requestId = ++autoPlayRequestId;
    isAutoPlayPending = true;
    intendedPlaying = true;
    localStorage.setItem("intendedPlaying", "true");
    audio.play().then(() => {
      if (requestId !== autoPlayRequestId) {
        console.log(`Aborting play for outdated request ID: ${requestId}`);
        return;
      }
      isPlaying = true;
      isAutoPlayPending = false;
      localStorage.setItem("isPlaying", "true");
      lastSuccessfulPlayTime = Date.now();
      errorCount = 0;
      if (errorTimeout) {
        clearTimeout(errorTimeout);
        errorTimeout = null;
      }
      console.log(`Successfully playing: ${station.name}`);
      document.querySelector(".controls .control-btn:nth-child(2)").textContent = "⏸";
      document.querySelectorAll(".wave-visualizer .wave-line, .wave-visualizer .circle, .wave-visualizer .dot, .wave-visualizer .bar").forEach(el => el.classList.add("playing"));
    }).catch(error => {
      if (requestId !== autoPlayRequestId) {
        console.log(`Aborting error handling for outdated request ID: ${requestId}`);
        return;
      }
      console.error(`Error playing ${station.name}:`, error);
      isPlaying = false;
      isAutoPlayPending = false;
      localStorage.setItem("isPlaying", "false");
      document.querySelector(".controls .control-btn:nth-child(2)").textContent = "▶";
      document.querySelectorAll(".wave-visualizer .wave-line, .wave-visualizer .circle, .wave-visualizer .dot, .wave-visualizer .bar").forEach(el => el.classList.remove("playing"));
      if (error.name !== 'AbortError') {
        errorCount++;
        if (errorCount < ERROR_LIMIT) {
          console.log(`Retrying station ${station.name} (${errorCount}/${ERROR_LIMIT})`);
          errorTimeout = setTimeout(() => {
            if (intendedPlaying) {
              console.log(`Retrying play for ${station.name}`);
              playStation(station);
            }
          }, 1000);
        } else {
          console.warn(`Error limit reached for ${station.name}`);
          alert(`Failed to play ${station.name}. Please try another station.`);
          nextStation();
        }
      }
    });
  }

  function stopAudio() {
    console.log("Stopping audio");
    if (streamAbortController) {
      streamAbortController.abort();
    }
    audio.src = "";
    isPlaying = false;
    isAutoPlayPending = false;
    intendedPlaying = false;
    localStorage.setItem("isPlaying", "false");
    localStorage.setItem("intendedPlaying", "false");
    document.querySelector(".controls .control-btn:nth-child(2)").textContent = "▶";
    document.querySelectorAll(".wave-visualizer .wave-line, .wave-visualizer .circle, .wave-visualizer .dot, .wave-visualizer .bar").forEach(el => el.classList.remove("playing"));
  }

  function togglePlayPause() {
    console.log(`Toggling play/pause, current state: isPlaying=${isPlaying}, intendedPlaying=${intendedPlaying}`);
    if (isPlaying || isAutoPlayPending) {
      audio.pause();
      stopAudio();
    } else {
      if (stationItems.length && currentIndex < stationItems.length) {
        const station = {
          value: stationItems[currentIndex].dataset.value,
          name: stationItems[currentIndex].dataset.name,
          genre: stationItems[currentIndex].dataset.genre,
          country: stationItems[currentIndex].dataset.country,
          favicon: stationItems[currentIndex].dataset.favicon
        };
        playStation(station);
      } else {
        console.warn("No station selected for playback");
        alert("Please select a station to play.");
      }
    }
  }

  function prevStation() {
    console.log("Previous station");
    if (stationItems.length) {
      changeStation(currentIndex - 1);
    }
  }

  function nextStation() {
    console.log("Next station");
    if (stationItems.length) {
      changeStation(currentIndex + 1);
    }
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    localStorage.setItem("selectedTheme", theme);
    console.log(`Applied theme: ${theme}`);
  }

  themeToggle.addEventListener("click", () => {
    const themes = [
      "deep-obsidian", "void-nexus", "shadow-pulse", "dark-abyss",
      "cosmic-dream", "midnight-aurora", "emerald-glow", "retro-wave",
      "arctic-fusion", "golden-haze"
    ];
    const currentTheme = document.body.dataset.theme || "deep-obsidian";
    const nextTheme = themes[(themes.indexOf(currentTheme) + 1) % themes.length];
    applyTheme(nextTheme);
  });

  audio.addEventListener("volumechange", () => {
    localStorage.setItem("volume", audio.volume);
    console.log(`Volume changed to: ${audio.volume}`);
  });
});