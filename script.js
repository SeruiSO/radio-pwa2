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
let audioContext = null;
let equalizerFilters = null;
let sleepTimer = null;

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
  const equalizerButton = document.querySelector(".equalizer-button");
  const sleepTimerButton = document.querySelector(".sleep-timer-button");
  const volumeButton = document.querySelector(".volume-button");
  const importFileInput = document.getElementById("importFileInput");
  const searchInput = document.getElementById("searchInput");
  const searchQuery = document.getElementById("searchQuery");
  const searchCountry = document.getElementById("searchCountry");
  const searchGenre = document.getElementById("searchGenre");
  const searchBtn = document.querySelector(".search-btn");
  const pastSearchesList = document.getElementById("pastSearches");
  const tabsContainer = document.getElementById("tabs");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !shareButton || !exportButton || !importButton || !equalizerButton || !sleepTimerButton || !volumeButton || !importFileInput || !searchInput || !searchQuery || !searchCountry || !searchGenre || !searchBtn || !pastSearchesList || !tabsContainer) {
    console.error("One of required DOM elements not found", {
      audio: !!audio,
      stationList: !!stationList,
      playPauseBtn: !!playPauseBtn,
      currentStationInfo: !!currentStationInfo,
      themeToggle: !!themeToggle,
      shareButton: !!shareButton,
      exportButton: !!exportButton,
      importButton: !!importButton,
      equalizerButton: !!equalizerButton,
      sleepTimerButton: !!sleepTimerButton,
      volumeButton: !!volumeButton,
      importFileInput: !!importFileInput,
      searchInput: !!searchInput,
      searchQuery: !!searchQuery,
      searchCountry: !!searchCountry,
      searchGenre: !!searchGenre,
      searchBtn: !!searchBtn,
      pastSearchesList: !!pastSearchesList,
      tabsContainer: !!tabsContainer
    });
    setTimeout(initializeApp, 100);
    return;
  }

  initializeApp();

  function initializeApp() {
    audio.preload = "auto";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

    updatePastSearches();
    populateSearchSuggestions();
    renderTabs();
    setupEqualizer();
    restoreSleepTimer();

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

    equalizerButton.addEventListener("click", () => toggleModal("equalizer-modal"));
    sleepTimerButton.addEventListener("click", () => toggleModal("sleep-timer-modal"));
    volumeButton.addEventListener("click", () => {
      toggleModal("volume-modal");
      const volumeSlider = document.getElementById("volume");
      volumeSlider.value = audio.volume;
    });

    document.querySelector(".controls .control-btn:nth-child(2)").addEventListener("click", prevStation);
    document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", togglePlayPause);
    document.querySelector(".controls .control-btn:nth-child(4)").addEventListener("click", nextStation);

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

    document.getElementById("lowshelf").addEventListener("input", (e) => {
      if (equalizerFilters) equalizerFilters[0].gain.setValueAtTime(e.target.value, audioContext.currentTime);
      localStorage.setItem("eqLowShelf", e.target.value);
    });

    document.getElementById("peaking").addEventListener("input", (e) => {
      if (equalizerFilters) equalizerFilters[1].gain.setValueAtTime(e.target.value, audioContext.currentTime);
      localStorage.setItem("eqPeaking", e.target.value);
    });

    document.getElementById("highshelf").addEventListener("input", (e) => {
      if (equalizerFilters) equalizerFilters[2].gain.setValueAtTime(e.target.value, audioContext.currentTime);
      localStorage.setItem("eqHighShelf", e.target.value);
    });

    document.getElementById("volume").addEventListener("input", (e) => {
      audio.volume = parseFloat(e.target.value);
      localStorage.setItem("volume", audio.volume);
    });

    window.addEventListener("orientationchange", () => {
      const container = document.querySelector(".container");
      container.classList.toggle("landscape", window.matchMedia("(orientation: landscape)").matches);
    });

    function setupEqualizer() {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaElementSource(audio);
        equalizerFilters = [
          { frequency: 100, type: 'lowshelf' },
          { frequency: 1000, type: 'peaking' },
          { frequency: 6000, type: 'highshelf' }
        ].map(band => {
          const filter = audioContext.createBiquadFilter();
          filter.type = band.type;
          filter.frequency.setValueAtTime(band.frequency, audioContext.currentTime);
          filter.gain.setValueAtTime(parseFloat(localStorage.getItem(`eq${band.type.charAt(0).toUpperCase() + band.type.slice(1)}`) || 0), audioContext.currentTime);
          return filter;
        });

        source.connect(equalizerFilters[0]);
        equalizerFilters[0].connect(equalizerFilters[1]);
        equalizerFilters[1].connect(equalizerFilters[2]);
        equalizerFilters[2].connect(audioContext.destination);

        document.getElementById("lowshelf").value = localStorage.getItem("eqLowShelf") || 0;
        document.getElementById("peaking").value = localStorage.getItem("eqPeaking") || 0;
        document.getElementById("highshelf").value = localStorage.getItem("eqHighShelf") || 0;
      }
    }

    function toggleModal(modalClass) {
      const overlay = document.querySelector(`.modal-overlay.${modalClass}`);
      const modal = overlay.querySelector(`.modal.${modalClass}`);
      const isActive = overlay.classList.contains("active");
      document.querySelectorAll(".modal-overlay").forEach(o => {
        o.classList.remove("active");
        o.querySelector(".modal").classList.remove("active");
      });
      if (!isActive) {
        overlay.classList.add("active");
        modal.classList.add("active");
      }
    }

    function closeModal() {
      document.querySelectorAll(".modal-overlay").forEach(o => {
        o.classList.remove("active");
        o.querySelector(".modal").classList.remove("active");
      });
    }

    function setSleepTimer(minutes) {
      if (sleepTimer) clearTimeout(sleepTimer);
      sleepTimer = setTimeout(() => {
        audio.pause();
        togglePlayPause();
        alert("Таймер сну завершив роботу!");
        localStorage.removeItem("sleepTimer");
      }, minutes * 60 * 1000);
      localStorage.setItem("sleepTimer", Date.now() + minutes * 60 * 1000);
      toggleModal("sleep-timer-modal");
    }

    function clearSleepTimer() {
      if (sleepTimer) clearTimeout(sleepTimer);
      sleepTimer = null;
      localStorage.removeItem("sleepTimer");
      toggleModal("sleep-timer-modal");
    }

    function restoreSleepTimer() {
      const timerEnd = parseInt(localStorage.getItem("sleepTimer"));
      if (timerEnd && timerEnd > Date.now()) {
        const remainingMs = timerEnd - Date.now();
        sleepTimer = setTimeout(() => {
          audio.pause();
          togglePlayPause();
          alert("Таймер сну завершив роботу!");
          localStorage.removeItem("sleepTimer");
        }, remainingMs);
      }
    }

    function exportSettings() {
      const settings = {
        selectedTheme: localStorage.getItem("selectedTheme") || "shadow-pulse",
        customTabs: JSON.parse(localStorage.getItem("customTabs")) || [],
        userAddedStations: JSON.parse(localStorage.getItem("userAddedStations")) || {},
        favoriteStations: JSON.parse(localStorage.getItem("favoriteStations")) || [],
        pastSearches: JSON.parse(localStorage.getItem("pastSearches")) || [],
        deletedStations: JSON.parse(localStorage.getItem("deletedStations")) || [],
        currentTab: localStorage.getItem("currentTab") || "techno",
        volume: parseFloat(localStorage.getItem("volume")) || 0.9,
        eqLowShelf: parseFloat(localStorage.getItem("eqLowShelf")) || 0,
        eqPeaking: parseFloat(localStorage.getItem("eqPeaking")) || 0,
        eqHighShelf: parseFloat(localStorage.getItem("eqHighShelf")) || 0
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
          if (settings.selectedTheme) {
            localStorage.setItem("selectedTheme", settings.selectedTheme);
            applyTheme(settings.selectedTheme);
          }
          if (Array.isArray(settings.customTabs)) {
            localStorage.setItem("customTabs", JSON.stringify(settings.customTabs));
            customTabs = settings.customTabs;
            renderTabs();
          }
          if (settings.userAddedStations) {
            localStorage.setItem("userAddedStations", JSON.stringify(settings.userAddedStations));
            userAddedStations = settings.userAddedStations;
          }
          if (Array.isArray(settings.favoriteStations)) {
            localStorage.setItem("favoriteStations", JSON.stringify(settings.favoriteStations));
            favoriteStations = settings.favoriteStations;
          }
          if (Array.isArray(settings.pastSearches)) {
            localStorage.setItem("pastSearches", JSON.stringify(settings.pastSearches));
            pastSearches = settings.pastSearches;
            updatePastSearches();
          }
          if (Array.isArray(settings.deletedStations)) {
            localStorage.setItem("deletedStations", JSON.stringify(settings.deletedStations));
            deletedStations = settings.deletedStations;
          }
          if (settings.currentTab) {
            localStorage.setItem("currentTab", settings.currentTab);
            currentTab = settings.currentTab;
            loadStations();
          }
          if (settings.volume !== undefined) {
            localStorage.setItem("volume", settings.volume);
            audio.volume = parseFloat(settings.volume);
          }
          if (settings.eqLowShelf !== undefined) {
            localStorage.setItem("eqLowShelf", settings.eqLowShelf);
            if (equalizerFilters) equalizerFilters[0].gain.setValueAtTime(settings.eqLowShelf, audioContext.currentTime);
            document.getElementById("lowshelf").value = settings.eqLowShelf;
          }
          if (settings.eqPeaking !== undefined) {
            localStorage.setItem("eqPeaking", settings.eqPeaking);
            if (equalizerFilters) equalizerFilters[1].gain.setValueAtTime(settings.eqPeaking, audioContext.currentTime);
            document.getElementById("peaking").value = settings.eqPeaking;
          }
          if (settings.eqHighShelf !== undefined) {
            localStorage.setItem("eqHighShelf", settings.eqHighShelf);
            if (equalizerFilters) equalizerFilters[2].gain.setValueAtTime(settings.eqHighShelf, audioContext.currentTime);
            document.getElementById("highshelf").value = settings.eqHighShelf;
          }
          console.log("Settings imported:", settings);
          loadStations();
        } catch (error) {
          console.error("Error importing settings:", error);
          alert("Failed to import settings. Invalid file format.");
        }
      };
      reader.readAsText(file);
    }

    function normalizeCountry(country) {
      if (!country) return "";
      const countryMap = {
        "united states": "USA",
        "united kingdom": "UK",
        "russia": "Russia",
        "ukraine": "Ukraine",
        // Add more mappings as needed
      };
      return countryMap[country.toLowerCase()] || country;
    }

    function normalizeUrl(url) {
      if (!url) return "";
      try {
        const parsedUrl = new URL(url);
        return parsedUrl.origin + parsedUrl.pathname;
      } catch (e) {
        return url;
      }
    }

    function updatePastSearches() {
      if (!pastSearchesList) return;
      pastSearchesList.innerHTML = "";
      pastSearches.forEach(search => {
        const li = document.createElement("li");
        li.textContent = search;
        li.addEventListener("click", () => {
          searchQuery.value = search;
          searchBtn.click();
        });
        pastSearchesList.appendChild(li);
      });
    }

    function populateSearchSuggestions() {
      fetch("/stations.json")
        .then(response => response.json())
        .then(data => {
          const queries = new Set();
          const countries = new Set();
          const genres = new Set();
          data.forEach(station => {
            if (station.name) queries.add(station.name);
            if (station.country) countries.add(station.country);
            if (station.genre) genres.add(station.genre);
          });
          const queryDatalist = document.getElementById("querySuggestions");
          const countryDatalist = document.getElementById("countrySuggestions");
          const genreDatalist = document.getElementById("genreSuggestions");
          queries.forEach(q => {
            const option = document.createElement("option");
            option.value = q;
            queryDatalist.appendChild(option);
          });
          countries.forEach(c => {
            const option = document.createElement("option");
            option.value = c;
            countryDatalist.appendChild(option);
          });
          genres.forEach(g => {
            const option = document.createElement("option");
            option.value = g;
            genreDatalist.appendChild(option);
          });
        })
        .catch(error => console.error("Error fetching suggestions:", error));
    }

    function renderTabs() {
      tabsContainer.innerHTML = "";
      const defaultTabs = ["techno", "trance", "ukraine", "pop", "search"];
      const allTabs = [...defaultTabs, ...customTabs];
      allTabs.forEach(tab => {
        const button = document.createElement("button");
        button.className = `tab-btn${tab === currentTab ? " active" : ""}`;
        button.dataset.tab = tab;
        button.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
        button.addEventListener("click", () => {
          currentTab = tab;
          localStorage.setItem("currentTab", currentTab);
          loadStations();
          document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
          button.classList.add("active");
          searchInput.style.display = tab === "search" ? "flex" : "none";
        });
        tabsContainer.appendChild(button);
      });
      const addTabBtn = document.createElement("button");
      addTabBtn.className = "add-tab-btn";
      addTabBtn.textContent = "+";
      addTabBtn.addEventListener("click", () => toggleModal("new-tab-modal"));
      tabsContainer.appendChild(addTabBtn);
      searchInput.style.display = currentTab === "search" ? "flex" : "none";
    }

    function createTab() {
      const tabNameInput = document.getElementById("newTabName");
      const tabName = tabNameInput.value.trim();
      if (tabName && tabName.length <= 10 && !customTabs.includes(tabName.toLowerCase())) {
        customTabs.push(tabName.toLowerCase());
        localStorage.setItem("customTabs", JSON.stringify(customTabs));
        renderTabs();
        closeModal();
        currentTab = tabName.toLowerCase();
        localStorage.setItem("currentTab", currentTab);
        loadStations();
      } else {
        alert("Tab name must be unique, non-empty, and max 10 characters.");
      }
    }

    function renameTab() {
      const tabNameInput = document.getElementById("editTabName");
      const newTabName = tabNameInput.value.trim();
      if (newTabName && newTabName.length <= 10 && !customTabs.includes(newTabName.toLowerCase())) {
        const index = customTabs.indexOf(currentTab);
        if (index !== -1) {
          customTabs[index] = newTabName.toLowerCase();
          localStorage.setItem("customTabs", JSON.stringify(customTabs));
          if (stationLists[currentTab]) {
            stationLists[newTabName.toLowerCase()] = stationLists[currentTab];
            delete stationLists[currentTab];
            localStorage.setItem("stationLists", JSON.stringify(stationLists));
          }
          currentTab = newTabName.toLowerCase();
          localStorage.setItem("currentTab", currentTab);
          renderTabs();
          loadStations();
          closeModal();
        }
      } else {
        alert("New tab name must be unique, non-empty, and max 10 characters.");
      }
    }

    function deleteTab() {
      const index = customTabs.indexOf(currentTab);
      if (index !== -1) {
        customTabs.splice(index, 1);
        localStorage.setItem("customTabs", JSON.stringify(customTabs));
        if (stationLists[currentTab]) {
          delete stationLists[currentTab];
          localStorage.setItem("stationLists", JSON.stringify(stationLists));
        }
        currentTab = "techno";
        localStorage.setItem("currentTab", currentTab);
        renderTabs();
        loadStations();
        closeModal();
      }
    }

    function loadStations() {
      stationList.innerHTML = "";
      stationItems = [];
      currentIndex = 0;
      if (currentTab === "search") {
        searchInput.style.display = "flex";
        stationList.innerHTML = "<div class='station-item empty'>Enter station name, country or genre</div>";
        return;
      }
      searchInput.style.display = "none";
      const url = currentTab === "favorites" ? "/stations.json" : `/stations-${currentTab}.json`;
      fetch(url, { signal: abortController.signal })
        .then(response => response.json())
        .then(data => {
          let stations = data;
          if (currentTab === "favorites") {
            stations = favoriteStations;
          } else if (customTabs.includes(currentTab)) {
            stations = stationLists[currentTab] || [];
          }
          stations = stations.filter(station => !deletedStations.includes(normalizeUrl(station.value)));
          if (Object.keys(userAddedStations).includes(currentTab)) {
            stations = stations.concat(userAddedStations[currentTab] || []);
          }
          if (!stations.length) {
            stationList.innerHTML = "<div class='station-item empty'>No stations available</div>";
            return;
          }
          stations.forEach((station, index) => {
            const item = document.createElement("div");
            item.className = "station-item";
            item.dataset.index = index;
            item.dataset.name = station.name;
            item.dataset.value = station.value;
            item.innerHTML = `
              <div class="station-icon">🎵</div>
              <div class="station-text">
                <div class="station-name">${station.name}</div>
                <div class="station-genre">genre: ${station.genre || '-'}</div>
                <div class="station-country">country: ${station.country || '-'}</div>
              </div>
            `;
            item.addEventListener("click", () => changeStation(index));
            item.addEventListener("contextmenu", (e) => {
              e.preventDefault();
              showContextMenu(e, station, index);
            });
            stationList.appendChild(item);
            stationItems.push(item);
          });
          if (intendedPlaying && currentIndex < stationItems.length) {
            changeStation(currentIndex);
          }
        })
        .catch(error => {
          if (error.name === "AbortError") return;
          console.error("Error loading stations:", error);
          stationList.innerHTML = "<div class='station-item empty'>Failed to load stations</div>";
        });
    }

    function showContextMenu(e, station, index) {
      const existingMenu = document.querySelector(".context-menu");
      if (existingMenu) existingMenu.remove();
      const menu = document.createElement("div");
      menu.className = "context-menu";
      menu.style.position = "absolute";
      menu.style.left = `${e.pageX}px`;
      menu.style.top = `${e.pageY}px`;
      menu.style.background = "var(--container-bg)";
      menu.style.border = "1px solid var(--accent)";
      menu.style.borderRadius = "8px";
      menu.style.padding = "8px";
      menu.style.zIndex = "1000";
      const isFavorite = favoriteStations.some(fav => normalizeUrl(fav.value) === normalizeUrl(station.value));
      const favoriteText = isFavorite ? "Remove from Favorites" : "Add to Favorites";
      const customTabOptions = customTabs.map(tab => `
        <div class="context-menu-item" data-action="add-to-tab" data-tab="${tab}">
          Add to ${tab.charAt(0).toUpperCase() + tab.slice(1)}
        </div>
      `).join("");
      menu.innerHTML = `
        <div class="context-menu-item" data-action="${isFavorite ? 'remove-favorite' : 'add-favorite'}">${favoriteText}</div>
        ${customTabOptions}
        <div class="context-menu-item" data-action="delete-station">Delete Station</div>
      `;
      document.body.appendChild(menu);
      menu.querySelectorAll(".context-menu-item").forEach(item => {
        item.addEventListener("click", () => {
          const action = item.dataset.action;
          if (action === "add-favorite" && !isFavorite) {
            favoriteStations.push(station);
            localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
          } else if (action === "remove-favorite" && isFavorite) {
            favoriteStations = favoriteStations.filter(fav => normalizeUrl(fav.value) !== normalizeUrl(station.value));
            localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
            if (currentTab === "favorites") loadStations();
          } else if (action === "add-to-tab") {
            const tab = item.dataset.tab;
            stationLists[tab] = stationLists[tab] || [];
            if (!stationLists[tab].some(s => normalizeUrl(s.value) === normalizeUrl(station.value))) {
              stationLists[tab].push(station);
              localStorage.setItem("stationLists", JSON.stringify(stationLists));
            }
          } else if (action === "delete-station") {
            deletedStations.push(normalizeUrl(station.value));
            localStorage.setItem("deletedStations", JSON.stringify(deletedStations));
            loadStations();
          }
          menu.remove();
        });
      });
      document.addEventListener("click", () => menu.remove(), { once: true });
    }

    function changeStation(index) {
      if (!stationItems?.length || index >= stationItems.length) return;
      currentIndex = index;
      const station = stationItems[currentIndex];
      if (!station) return;
      currentStationInfo.querySelector(".station-name").textContent = station.dataset.name;
      currentStationInfo.querySelector(".station-genre").textContent = `genre: ${stationItems[currentIndex].querySelector(".station-genre").textContent.split(": ")[1]}`;
      currentStationInfo.querySelector(".station-country").textContent = `country: ${stationItems[currentIndex].querySelector(".station-country").textContent.split(": ")[1]}`;
      audio.src = station.dataset.value;
      if (intendedPlaying) {
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
      }
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: station.dataset.name,
          artist: "Radio S O",
          album: currentTab.charAt(0).toUpperCase() + currentTab.slice(1)
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

    function searchStations(query, country, genre) {
      fetch("/stations.json", { signal: abortController.signal })
        .then(response => response.json())
        .then(data => {
          const results = data.filter(station => {
            const matchesQuery = query ? station.name.toLowerCase().includes(query.toLowerCase()) : true;
            const matchesCountry = country ? normalizeCountry(station.country).toLowerCase() === country.toLowerCase() : true;
            const matchesGenre = genre ? station.genre.toLowerCase() === genre.toLowerCase() : true;
            return matchesQuery && matchesCountry && matchesGenre && !deletedStations.includes(normalizeUrl(station.value));
          });
          stationList.innerHTML = "";
          stationItems = [];
          if (!results.length) {
            stationList.innerHTML = "<div class='station-item empty'>No stations found</div>";
            return;
          }
          results.forEach((station, index) => {
            const item = document.createElement("div");
            item.className = "station-item";
            item.dataset.index = index;
            item.dataset.name = station.name;
            item.dataset.value = station.value;
            item.innerHTML = `
              <div class="station-icon">🎵</div>
              <div class="station-text">
                <div class="station-name">${station.name}</div>
                <div class="station-genre">genre: ${station.genre || '-'}</div>
                <div class="station-country">country: ${station.country || '-'}</div>
              </div>
            `;
            item.addEventListener("click", () => changeStation(index));
            item.addEventListener("contextmenu", (e) => {
              e.preventDefault();
              showContextMenu(e, station, index);
            });
            stationList.appendChild(item);
            stationItems.push(item);
          });
        })
        .catch(error => {
          if (error.name === "AbortError") return;
          console.error("Error searching stations:", error);
          stationList.innerHTML = "<div class='station-item empty'>Failed to search stations</div>";
        });
    }

    function debouncedTryAutoPlay() {
      if (isAutoPlayPending) return;
      isAutoPlayPending = true;
      const requestId = ++autoPlayRequestId;
      setTimeout(() => {
        if (!isAutoPlayPending || requestId !== autoPlayRequestId) return;
        if (!stationItems?.length || currentIndex >= stationItems.length) {
          isAutoPlayPending = false;
          return;
        }
        const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) {
          console.log("debouncedTryAutoPlay: Skip, station already playing");
          isAutoPlayPending = false;
          return;
        }
        if (streamAbortController) {
          streamAbortController.abort();
        }
        streamAbortController = new AbortController();
        audio.src = stationItems[currentIndex].dataset.value;
        audio.play().then(() => {
          lastSuccessfulPlayTime = Date.now();
          errorCount = 0;
          isAutoPlayPending = false;
          console.log("Playback started successfully");
        }).catch(error => {
          if (error.name === "AbortError") return;
          console.error("Playback error:", error);
          isAutoPlayPending = false;
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
      }, 500);
    }

    function resetStationInfo() {
      currentStationInfo.querySelector(".station-name").textContent = "Обирайте станцію";
      currentStationInfo.querySelector(".station-genre").textContent = "жанр: -";
      currentStationInfo.querySelector(".station-country").textContent = "країна: -";
      audio.src = "";
      isPlaying = false;
      intendedPlaying = false;
      playPauseBtn.textContent = "▶";
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      localStorage.setItem("isPlaying", isPlaying);
      localStorage.setItem("intendedPlaying", intendedPlaying);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
      }
    }

    function applyTheme(theme) {
      document.body.dataset.theme = theme;
      localStorage.setItem("selectedTheme", theme);
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
});