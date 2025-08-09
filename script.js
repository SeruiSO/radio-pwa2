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
customTabs = Array.isArray(customTabs) ? customTabs.filter(tab => typeof tab === "string" && tab.trim()) : [];

document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(3)");
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
  const volumeBtn = document.querySelector(".volume-btn");
  const equalizerBtn = document.querySelector(".equalizer-btn");
  const volumeModal = document.querySelector(".volume-modal");
  const equalizerModal = document.querySelector(".equalizer-modal");
  const volumeSlider = document.getElementById("volumeSlider");
  const bassSlider = document.getElementById("bassSlider");
  const midSlider = document.getElementById("midSlider");
  const trebleSlider = document.getElementById("trebleSlider");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !shareButton || !exportButton || !importButton || !importFileInput || !searchInput || !searchQuery || !searchCountry || !searchGenre || !searchBtn || !pastSearchesList || !tabsContainer || !volumeBtn || !equalizerBtn || !volumeModal || !equalizerModal || !volumeSlider || !bassSlider || !midSlider || !trebleSlider) {
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
      volumeBtn: !!volumeBtn,
      equalizerBtn: !!equalizerBtn,
      volumeModal: !!volumeModal,
      equalizerModal: !!equalizerModal,
      volumeSlider: !!volumeSlider,
      bassSlider: !!bassSlider,
      midSlider: !!midSlider,
      trebleSlider: !!trebleSlider
    });
    setTimeout(initializeApp, 100);
    return;
  }

  initializeApp();

  function initializeApp() {
    audio.preload = "auto";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;
    volumeSlider.value = audio.volume;

    updatePastSearches();
    populateSearchSuggestions();
    renderTabs();

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

    document.querySelector(".controls .control-btn:nth-child(2)").addEventListener("click", prevStation);
    document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", togglePlayPause);
    document.querySelector(".controls .control-btn:nth-child(4)").addEventListener("click", nextStation);

    volumeBtn.addEventListener("click", () => {
      volumeModal.style.display = "block";
    });

    equalizerBtn.addEventListener("click", () => {
      equalizerModal.style.display = "block";
    });

    volumeModal.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-overlay") || e.target.classList.contains("modal-cancel-btn")) {
        volumeModal.style.display = "none";
      }
    });

    equalizerModal.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-overlay") || e.target.classList.contains("modal-cancel-btn")) {
        equalizerModal.style.display = "none";
      }
    });

    volumeSlider.addEventListener("input", () => {
      audio.volume = parseFloat(volumeSlider.value);
      localStorage.setItem("volume", audio.volume);
    });

    bassSlider.addEventListener("input", () => {
      console.log("Bass adjusted:", bassSlider.value);
      // Placeholder for equalizer functionality
    });

    midSlider.addEventListener("input", () => {
      console.log("Mid adjusted:", midSlider.value);
      // Placeholder for equalizer functionality
    });

    trebleSlider.addEventListener("input", () => {
      console.log("Treble adjusted:", trebleSlider.value);
      // Placeholder for equalizer functionality
    });

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

    function exportSettings() {
      const settings = {
        selectedTheme: localStorage.getItem("selectedTheme") || "shadow-pulse",
        customTabs: JSON.parse(localStorage.getItem("customTabs")) || [],
        userAddedStations: JSON.parse(localStorage.getItem("userAddedStations")) || {},
        favoriteStations: JSON.parse(localStorage.getItem("favoriteStations")) || [],
        pastSearches: JSON.parse(localStorage.getItem("pastSearches")) || [],
        deletedStations: JSON.parse(localStorage.getItem("deletedStations")) || [],
        currentTab: localStorage.getItem("currentTab") || "techno"
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
            "shadow-pulse", "dark-abyss", "emerald-glow", "retro-wave",
            "neon-pulse", "lime-surge", "flamingo-flash", "aqua-glow",
            "aurora-haze", "starlit-amethyst", "lunar-frost"
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
                      s.country && typeof s.country === "string" && 
                      s.favicon && isValidUrl(s.favicon)
                    )
                  : [];
                if (stations.length) validStations[tab] = stations;
              }
            });
            userAddedStations = validStations;
            localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
          }
          if (Array.isArray(settings.favoriteStations)) {
            favoriteStations = settings.favoriteStations.filter(s => 
              s && typeof s === "object" && 
              s.name && typeof s.name === "string" && 
              s.value && isValidUrl(s.value) && 
              s.genre && typeof s.genre === "string" && 
              s.country && typeof s.country === "string" && 
              s.favicon && isValidUrl(s.favicon)
            );
            localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
          }
          if (Array.isArray(settings.pastSearches)) {
            pastSearches = settings.pastSearches.filter(s => typeof s === "string" && s.trim()).slice(0, 5);
            localStorage.setItem("pastSearches", JSON.stringify(pastSearches));
            updatePastSearches();
          }
          if (Array.isArray(settings.deletedStations)) {
            deletedStations = settings.deletedStations.filter(s => 
              s && typeof s === "object" && 
              s.name && typeof s.name === "string" && 
              s.value && isValidUrl(s.value)
            );
            localStorage.setItem("deletedStations", JSON.stringify(deletedStations));
          }
          if (settings.currentTab && ["best", "techno", "trance", "ukraine", "pop", "search", ...customTabs].includes(settings.currentTab)) {
            currentTab = settings.currentTab;
            localStorage.setItem("currentTab", currentTab);
          }
          renderTabs();
          loadStations();
          alert("Settings imported successfully!");
        } catch (error) {
          console.error("Error importing settings:", error);
          alert("Error importing settings!");
        }
      };
      reader.readAsText(file);
    }

    function normalizeCountry(country) {
      if (!country) return "";
      const countryMap = {
        "united states": "usa",
        "united kingdom": "uk",
        "russia": "russian federation",
        "ukraine": "ukraine",
        "germany": "germany",
        "france": "france"
      };
      return countryMap[country.toLowerCase()] || country.toLowerCase();
    }

    function isValidUrl(string) {
      try {
        new URL(string);
        return true;
      } catch (_) {
        return false;
      }
    }

    function normalizeUrl(url) {
      try {
        const parsed = new URL(url);
        return parsed.toString().replace(/\/+$/, "");
      } catch (_) {
        return url;
      }
    }

    function updatePastSearches() {
      pastSearchesList.innerHTML = "";
      pastSearches.forEach(search => {
        const option = document.createElement("option");
        option.value = search;
        pastSearchesList.appendChild(option);
      });
    }

    function populateSearchSuggestions() {
      const countries = ["USA", "UK", "Russian Federation", "Ukraine", "Germany", "France"];
      const genres = ["techno", "trance", "pop", "rock", "jazz", "classical"];
      const countrySuggestions = document.getElementById("countrySuggestions");
      const genreSuggestions = document.getElementById("genreSuggestions");
      countries.forEach(country => {
        const option = document.createElement("option");
        option.value = country;
        countrySuggestions.appendChild(option);
      });
      genres.forEach(genre => {
        const option = document.createElement("option");
        option.value = genre;
        genreSuggestions.appendChild(option);
      });
    }

    function renderTabs() {
      tabsContainer.innerHTML = "";
      const tabs = ["best", "techno", "trance", "ukraine", "pop", "search", ...customTabs];
      tabs.forEach(tab => {
        const btn = document.createElement("button");
        btn.className = `tab-btn${tab === currentTab ? " active" : ""}`;
        btn.dataset.tab = tab;
        btn.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
        btn.addEventListener("click", () => {
          currentTab = tab;
          localStorage.setItem("currentTab", currentTab);
          document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          loadStations();
        });
        tabsContainer.appendChild(btn);
      });
      const addTabBtn = document.createElement("button");
      addTabBtn.className = "add-tab-btn";
      addTabBtn.textContent = "+";
      addTabBtn.addEventListener("click", () => {
        document.querySelector(".new-tab-modal").style.display = "block";
      });
      tabsContainer.appendChild(addTabBtn);

      document.querySelector(".new-tab-modal .modal-tab-btn").addEventListener("click", () => {
        const input = document.getElementById("newTabInput");
        const tabName = input.value.trim().toLowerCase();
        if (tabName && tabName.length <= 10 && /^[a-z0-9_-]+$/.test(tabName) && !tabs.includes(tabName) && customTabs.length < 7) {
          customTabs.push(tabName);
          localStorage.setItem("customTabs", JSON.stringify(customTabs));
          currentTab = tabName;
          localStorage.setItem("currentTab", currentTab);
          renderTabs();
          loadStations();
          document.querySelector(".new-tab-modal").style.display = "none";
          input.value = "";
        } else {
          alert("Invalid tab name! Use up to 10 characters (a-z, 0-9, _, -) and ensure it's unique.");
        }
      });

      document.querySelector(".new-tab-modal .modal-cancel-btn").addEventListener("click", () => {
        document.querySelector(".new-tab-modal").style.display = "none";
        document.getElementById("newTabInput").value = "";
      });

      document.querySelectorAll(".tab-btn").forEach(btn => {
        if (!["best", "techno", "trance", "ukraine", "pop", "search"].includes(btn.dataset.tab)) {
          btn.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            document.getElementById("editTabInput").value = btn.dataset.tab;
            document.querySelector(".edit-tab-modal").style.display = "block";
          });
        }
      });

      document.querySelector(".edit-tab-modal .rename-btn").addEventListener("click", () => {
        const input = document.getElementById("editTabInput");
        const newName = input.value.trim().toLowerCase();
        const oldName = document.querySelector(".edit-tab-modal").dataset.tab || "";
        if (newName && newName.length <= 10 && /^[a-z0-9_-]+$/.test(newName) && !tabs.includes(newName)) {
          const index = customTabs.indexOf(oldName);
          if (index !== -1) {
            customTabs[index] = newName;
            localStorage.setItem("customTabs", JSON.stringify(customTabs));
            if (currentTab === oldName) {
              currentTab = newName;
              localStorage.setItem("currentTab", currentTab);
            }
            if (userAddedStations[oldName]) {
              userAddedStations[newName] = userAddedStations[oldName];
              delete userAddedStations[oldName];
              localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
            }
            renderTabs();
            loadStations();
            document.querySelector(".edit-tab-modal").style.display = "none";
            input.value = "";
          }
        } else {
          alert("Invalid tab name! Use up to 10 characters (a-z, 0-9, _, -) and ensure it's unique.");
        }
      });

      document.querySelector(".edit-tab-modal .delete-btn").addEventListener("click", () => {
        const tabName = document.getElementById("editTabInput").value.trim().toLowerCase();
        const index = customTabs.indexOf(tabName);
        if (index !== -1) {
          customTabs.splice(index, 1);
          localStorage.setItem("customTabs", JSON.stringify(customTabs));
          if (currentTab === tabName) {
            currentTab = "techno";
            localStorage.setItem("currentTab", currentTab);
          }
          if (userAddedStations[tabName]) {
            delete userAddedStations[tabName];
            localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
          }
          renderTabs();
          loadStations();
          document.querySelector(".edit-tab-modal").style.display = "none";
          document.getElementById("editTabInput").value = "";
        }
      });

      document.querySelector(".edit-tab-modal .modal-cancel-btn").addEventListener("click", () => {
        document.querySelector(".edit-tab-modal").style.display = "none";
        document.getElementById("editTabInput").value = "";
      });
    }

    function loadStations() {
      stationList.innerHTML = "";
      stationItems = [];
      currentIndex = 0;
      let stations = [];
      if (currentTab === "best") {
        stations = favoriteStations;
      } else if (currentTab === "search") {
        stationList.innerHTML = "<div class='station-item empty'>Enter search query</div>";
        return;
      } else {
        stations = (stationLists[currentTab] || []).concat(userAddedStations[currentTab] || []).filter(s => 
          !deletedStations.some(ds => ds.value === s.value)
        );
      }
      if (!stations.length) {
        stationList.innerHTML = `<div class='station-item empty'>No stations in ${currentTab}</div>`;
        resetStationInfo();
        return;
      }
      stations.forEach((station, index) => {
        const item = document.createElement("div");
        item.className = `station-item${index === currentIndex ? " active" : ""}`;
        item.dataset.name = station.name;
        item.dataset.value = station.value;
        item.dataset.genre = station.genre;
        item.dataset.country = station.country;
        item.dataset.favicon = station.favicon;
        item.innerHTML = `
          <img src="${station.favicon}" onerror="this.style.display='none'">
          <div class="station-name">${station.name}</div>
          <button class="favorite-btn">${favoriteStations.some(fs => fs.value === station.value) ? "★" : "☆"}</button>
          <button class="remove-btn">🗑</button>
        `;
        item.addEventListener("click", () => {
          currentIndex = index;
          changeStation(index);
        });
        item.querySelector(".favorite-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          toggleFavorite(station);
          loadStations();
        });
        item.querySelector(".remove-btn").addEventListener("click", (e) => {
          e.stopPropagation();
          removeStation(station);
          loadStations();
        });
        stationList.appendChild(item);
        stationItems.push(item);
      });
      if (stations[currentIndex]) {
        changeStation(currentIndex);
      } else {
        resetStationInfo();
      }
    }

    function toggleFavorite(station) {
      const index = favoriteStations.findIndex(fs => fs.value === station.value);
      if (index === -1) {
        favoriteStations.push(station);
      } else {
        favoriteStations.splice(index, 1);
      }
      localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
    }

    function removeStation(station) {
      deletedStations.push({ name: station.name, value: station.value });
      localStorage.setItem("deletedStations", JSON.stringify(deletedStations));
      if (userAddedStations[currentTab]) {
        userAddedStations[currentTab] = userAddedStations[currentTab].filter(s => s.value !== station.value);
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
      }
    }

    function searchStations(query, country, genre) {
      if (currentTab !== "search") return;
      stationList.innerHTML = "";
      stationItems = [];
      currentIndex = 0;
      fetch(`stations.json?${new Date().getTime()}`, { signal: abortController.signal })
        .then(response => response.json())
        .then(data => {
          const filtered = data.filter(station => {
            return (!query || station.name.toLowerCase().includes(query.toLowerCase())) &&
                   (!country || normalizeCountry(station.country).includes(country)) &&
                   (!genre || station.genre.toLowerCase().includes(genre)) &&
                   !deletedStations.some(ds => ds.value === station.value);
          });
          if (!filtered.length) {
            stationList.innerHTML = "<div class='station-item empty'>No stations found</div>";
            resetStationInfo();
            return;
          }
          filtered.forEach((station, index) => {
            const item = document.createElement("div");
            item.className = `station-item${index === currentIndex ? " active" : ""}`;
            item.dataset.name = station.name;
            item.dataset.value = station.value;
            item.dataset.genre = station.genre;
            item.dataset.country = station.country;
            item.dataset.favicon = station.favicon;
            item.innerHTML = `
              <img src="${station.favicon}" onerror="this.style.display='none'">
              <div class="station-name">${station.name}</div>
              <button class="favorite-btn">${favoriteStations.some(fs => fs.value === station.value) ? "★" : "☆"}</button>
              <button class="add-station-btn">+</button>
              <button class="remove-btn">🗑</button>
            `;
            item.addEventListener("click", () => {
              currentIndex = index;
              changeStation(index);
            });
            item.querySelector(".favorite-btn").addEventListener("click", (e) => {
              e.stopPropagation();
              toggleFavorite(station);
              loadStations();
            });
            item.querySelector(".add-station-btn").addEventListener("click", (e) => {
              e.stopPropagation();
              const tab = prompt("Enter tab name to add station to (techno, trance, ukraine, pop, or custom tab):").toLowerCase();
              if (["techno", "trance", "ukraine", "pop", ...customTabs].includes(tab)) {
                if (!userAddedStations[tab]) userAddedStations[tab] = [];
                if (!userAddedStations[tab].some(s => s.value === station.value)) {
                  userAddedStations[tab].push(station);
                  localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
                  if (currentTab === tab) loadStations();
                }
              } else {
                alert("Invalid tab name!");
              }
            });
            item.querySelector(".remove-btn").addEventListener("click", (e) => {
              e.stopPropagation();
              removeStation(station);
              loadStations();
            });
            stationList.appendChild(item);
            stationItems.push(item);
          });
          if (filtered[currentIndex]) {
            changeStation(currentIndex);
          } else {
            resetStationInfo();
          }
        })
        .catch(error => {
          console.error("Error fetching stations:", error);
          stationList.innerHTML = "<div class='station-item empty'>Error loading stations</div>";
          resetStationInfo();
        });
    }

    function resetStationInfo() {
      const stationNameElement = currentStationInfo.querySelector(".station-name");
      const stationGenreElement = currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = currentStationInfo.querySelector(".station-country");
      const stationIconElement = currentStationInfo.querySelector(".station-icon");
      if (stationNameElement) {
        stationNameElement.textContent = "Обирайте станцію";
      } else {
        console.error(".station-name element not found");
      }
      if (stationGenreElement) {
        stationGenreElement.textContent = "жанр: -";
      } else {
        console.error(".station-genre element not found");
      }
      if (stationCountryElement) {
        stationCountryElement.textContent = "країна: -";
      } else {
        console.error(".station-country element not found");
      }
      if (stationIconElement) {
        stationIconElement.innerHTML = "🎵";
        stationIconElement.style.backgroundImage = "none";
      } else {
        console.error(".station-icon element not found");
      }
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
      }
      audio.src = "";
      isPlaying = false;
      intendedPlaying = false;
      localStorage.setItem("isPlaying", isPlaying);
      localStorage.setItem("intendedPlaying", intendedPlaying);
      playPauseBtn.textContent = "▶";
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
    }

    function changeStation(index) {
      if (!stationItems[index]) {
        resetStationInfo();
        return;
      }
      document.querySelectorAll(".station-item").forEach(item => item.classList.remove("active"));
      stationItems[index].classList.add("active");
      const item = stationItems[index];
      const stationNameElement = currentStationInfo.querySelector(".station-name");
      const stationGenreElement = currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = currentStationInfo.querySelector(".station-country");
      const stationIconElement = currentStationInfo.querySelector(".station-icon");
      if (stationNameElement) {
        stationNameElement.textContent = item.dataset.name || "Unknown Station";
      } else {
        console.error(".station-name element not found");
      }
      if (stationGenreElement) {
        stationGenreElement.textContent = `genre: ${item.dataset.genre || ""}`;
      } else {
        console.error(".station-genre element not found");
      }
      if (stationCountryElement) {
        stationCountryElement.textContent = `country: ${item.dataset.country || ""}`;
      } else {
        console.error(".station-country element not found");
      }
      if (stationIconElement) {
        if (item.dataset.favicon && isValidUrl(item.dataset.favicon)) {
          stationIconElement.innerHTML = "";
          stationIconElement.style.backgroundImage = `url(${item.dataset.favicon})`;
          stationIconElement.style.backgroundSize = "contain";
          stationIconElement.style.backgroundRepeat = "no-repeat";
          stationIconElement.style.backgroundPosition = "center";
        } else {
          stationIconElement.innerHTML = "🎵";
          stationIconElement.style.backgroundImage = "none";
        }
      } else {
        console.error(".station-icon element not found");
      }
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.dataset.name || "Unknown Station",
          artist: `${item.dataset.genre || ""} | ${item.dataset.country || ""}`,
          album: "Radio Music S O",
          artwork: item.dataset.favicon && isValidUrl(item.dataset.favicon) ? [
            { src: item.dataset.favicon, sizes: "96x96", type: "image/png" },
            { src: item.dataset.favicon, sizes: "128x128", type: "image/png" },
            { src: item.dataset.favicon, sizes: "192x192", type: "image/png" },
            { src: item.dataset.favicon, sizes: "256x256", type: "image/png" },
            { src: item.dataset.favicon, sizes: "384x384", type: "image/png" },
            { src: item.dataset.favicon, sizes: "512x512", type: "image/png" }
          ] : []
        });
      }
      audio.src = item.dataset.value;
      if (intendedPlaying) {
        debouncedTryAutoPlay();
      }
    }

    function debouncedTryAutoPlay() {
      if (!stationItems[currentIndex]) return;
      autoPlayRequestId++;
      const requestId = autoPlayRequestId;
      setTimeout(() => {
        if (requestId === autoPlayRequestId && intendedPlaying && navigator.onLine) {
          tryAutoPlay();
        }
      }, 100);
    }

    function tryAutoPlay() {
      if (!stationItems[currentIndex] || !intendedPlaying) return;
      if (streamAbortController) {
        streamAbortController.abort();
      }
      streamAbortController = new AbortController();
      audio.src = stationItems[currentIndex].dataset.value;
      audio.load();
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            lastSuccessfulPlayTime = Date.now();
            errorCount = 0;
            isAutoPlayPending = false;
            playPauseBtn.textContent = "⏸";
            document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
            console.log("Playback started successfully");
          })
          .catch(error => {
            console.error("Autoplay error:", error);
            document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
            if (intendedPlaying && errorCount < ERROR_LIMIT && !errorTimeout) {
              errorCount++;
              errorTimeout = setTimeout(() => {
                debouncedTryAutoPlay();
                errorTimeout = null;
              }, 1000);
            } else if (errorCount >= ERROR_LIMIT) {
              console.error("Reached playback error limit");
              resetStationInfo();
            }
          });
      }
    }

    function prevStation() {
      if (!stationItems?.length) return;
      currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
      if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
      changeStation(currentIndex);
    }

    function nextStation() {
      if (!stationItems?.length) return;
      currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
      if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
      changeStation(currentIndex);
    }

    function togglePlayPause() {
      if (!playPauseBtn || !audio) {
        console.error("playPauseBtn or audio not found");
        return;
      }
      if (audio.paused) {
        isPlaying = true;
        intendedPlaying = true;
        debouncedTryAutoPlay();
        playPauseBtn.textContent = "⏸";
        document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
      } else {
        audio.pause();
        isPlaying = false;
        intendedPlaying = false;
        playPauseBtn.textContent = "▶";
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      }
      localStorage.setItem("isPlaying", isPlaying);
      localStorage.setItem("intendedPlaying", intendedPlaying);
    }

    const eventListeners = {
      keydown: e => {
        if (e.key === "ArrowLeft") prevStation();
        if (e.key === "ArrowRight") nextStation();
        if (e.key === " ") {
          e.preventDefault();
          togglePlayPause();
        }
      },
      visibilitychange: () => {
        if (document.hidden || !intendedPlaying || !navigator.onLine || !stationItems?.length || currentIndex >= stationItems.length) {
          console.log("visibilitychange: Skip, tab hidden or invalid state");
          return;
        }
        const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) {
          console.log("visibilitychange: Skip playback, station already playing");
        } else {
          console.log("visibilitychange: Starting playback after visibility change");
          isAutoPlayPending = false;
          debouncedTryAutoPlay();
        }
      },
      resume: () => {
        if (!intendedPlaying || !navigator.onLine || !stationItems?.length || currentIndex >= stationItems.length) {
          console.log("resume: Skip, invalid state");
          return;
        }
        const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) {
          console.log("resume: Skip playback, station already playing");
        } else {
          console.log("resume: Starting playback after app resume");
          isAutoPlayPending = false;
          debouncedTryAutoPlay();
        }
      }
    };

    function addEventListeners() {
      document.addEventListener("keydown", eventListeners.keydown);
      document.addEventListener("visibilitychange", eventListeners.visibilitychange);
      document.addEventListener("resume", eventListeners.resume);
    }

    function removeEventListeners() {
      document.removeEventListener("keydown", eventListeners.keydown);
      document.removeEventListener("visibilitychange", eventListeners.visibilitychange);
      document.removeEventListener("resume", eventListeners.resume);
    }

    audio.addEventListener("playing", () => {
      isPlaying = true;
      playPauseBtn.textContent = "⏸";
      document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
      localStorage.setItem("isPlaying", isPlaying);
      if (errorTimeout) {
        clearTimeout(errorTimeout);
        errorTimeout = null;
      }
    });

    audio.addEventListener("pause", () => {
      isPlaying = false;
      playPauseBtn.textContent = "▶";
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      localStorage.setItem("isPlaying", isPlaying);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
      }
    });

    audio.addEventListener("error", () => {
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      console.error("Audio error:", audio.error?.message || "Unknown error", "for URL:", audio.src);
      if (intendedPlaying && errorCount < ERROR_LIMIT && !errorTimeout) {
        errorCount++;
        errorTimeout = setTimeout(() => {
          debouncedTryAutoPlay();
          errorTimeout = null;
        }, 1000);
      } else if (errorCount >= ERROR_LIMIT) {
        console.error("Reached playback error limit");
        resetStationInfo();
      }
    });

    audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", audio.volume);
      volumeSlider.value = audio.volume;
    });

    window.addEventListener("online", () => {
      console.log("Network restored");
      if (intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
      }
    });

    window.addEventListener("offline", () => {
      console.log("Network connection lost");
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      errorCount = 0;
    });

    addEventListeners();

    window.addEventListener("beforeunload", () => {
      removeEventListeners();
    });

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => {
        if (intendedPlaying) return;
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (!isPlaying) return;
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler("previoustrack", prevStation);
      navigator.mediaSession.setActionHandler("nexttrack", nextStation);
    }

    applyTheme(localStorage.getItem("selectedTheme") || "shadow-pulse");
    loadStations();
    if (intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
      const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
      const normalizedAudioSrc = normalizeUrl(audio.src);
      if (normalizedAudioSrc !== normalizedCurrentUrl || audio.paused || audio.error || audio.readyState < 2 || audio.currentTime === 0) {
        console.log("initializeApp: Starting playback after initialization");
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
      } else {
        console.log("initializeApp: Skip playback, station already playing");
      }
    } else {
      console.log("initializeApp: Skip playback, invalid state");
    }
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    localStorage.setItem("selectedTheme", theme);
  }
});