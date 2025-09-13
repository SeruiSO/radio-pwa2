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
  const newTabModal = document.getElementById("newTabModal");
  const newTabInput = document.getElementById("newTabInput");
  const createTabBtn = document.querySelector(".new-tab-modal .modal-tab-btn");
  const cancelTabBtn = document.querySelector(".new-tab-modal .modal-cancel-btn");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !shareButton || !exportButton || !importButton || !importFileInput || !searchInput || !searchQuery || !searchCountry || !searchGenre || !searchBtn || !pastSearchesList || !tabsContainer || !newTabModal || !newTabInput || !createTabBtn || !cancelTabBtn) {
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
      newTabModal: !!newTabModal,
      newTabInput: !!newTabInput,
      createTabBtn: !!createTabBtn,
      cancelTabBtn: !!cancelTabBtn
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

    createTabBtn.addEventListener("click", () => {
      const tabName = newTabInput.value.trim();
      if (tabName && !customTabs.includes(tabName)) {
        customTabs.push(tabName);
        localStorage.setItem("customTabs", JSON.stringify(customTabs));
        renderTabs();
        newTabModal.style.display = "none";
        newTabInput.value = "";
      }
    });

    cancelTabBtn.addEventListener("click", () => {
      newTabModal.style.display = "none";
      newTabInput.value = "";
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

    function importSettings(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const settings = JSON.parse(event.target.result);
          localStorage.setItem("selectedTheme", settings.selectedTheme || "shadow-pulse");
          localStorage.setItem("customTabs", JSON.stringify(settings.customTabs || []));
          localStorage.setItem("userAddedStations", JSON.stringify(settings.userAddedStations || {}));
          localStorage.setItem("favoriteStations", JSON.stringify(settings.favoriteStations || []));
          localStorage.setItem("pastSearches", JSON.stringify(settings.pastSearches || []));
          localStorage.setItem("deletedStations", JSON.stringify(settings.deletedStations || []));
          localStorage.setItem("currentTab", settings.currentTab || "techno");
          location.reload();
        } catch (error) {
          console.error("Error importing settings:", error);
          alert("Invalid settings file");
        }
      };
      reader.readAsText(file);
    }

    function updatePastSearches() {
      pastSearchesList.innerHTML = "";
      pastSearches.forEach(search => {
        const div = document.createElement("div");
        div.classList.add("past-search");
        div.textContent = search;
        div.addEventListener("click", () => {
          searchQuery.value = search;
          searchBtn.click();
        });
        pastSearchesList.appendChild(div);
      });
    }

    function populateSearchSuggestions() {
      const countries = ["USA", "Ukraine", "UK", "Germany"];
      const genres = ["Pop", "Rock", "Techno", "Trance"];
      countries.forEach(country => {
        const option = document.createElement("option");
        option.value = country;
        searchCountry.list.appendChild(option);
      });
      genres.forEach(genre => {
        const option = document.createElement("option");
        option.value = genre;
        searchGenre.list.appendChild(option);
      });
    }

    function renderTabs() {
      tabsContainer.innerHTML = "";
      const tabs = ["Best", "Techno", "Trance", "UA", "Pop", "Search", ...customTabs];
      tabs.forEach(tab => {
        const btn = document.createElement("button");
        btn.classList.add("tab-btn");
        btn.textContent = tab;
        btn.addEventListener("click", () => switchTab(tab));
        tabsContainer.appendChild(btn);
      });
      const addTabBtn = document.createElement("button");
      addTabBtn.classList.add("add-tab-btn");
      addTabBtn.textContent = "+";
      addTabBtn.addEventListener("click", openNewTabModal);
      tabsContainer.appendChild(addTabBtn);
    }

    function openNewTabModal() {
      newTabModal.style.display = "block";
    }

    function switchTab(tab) {
      currentTab = tab;
      localStorage.setItem("currentTab", tab);
      loadStations();
    }

    function loadStations() {
      fetch("/stations.json").then(response => response.json()).then(data => {
        stationLists = data;
        renderStationList();
      }).catch(error => {
        console.error("Error loading stations:", error);
        stationList.innerHTML = "<div class='station-item empty'>Failed to load stations</div>";
      });
    }

    function renderStationList() {
      stationList.innerHTML = "";
      const stations = stationLists[currentTab] || [];
      if (stations.length === 0) {
        stationList.innerHTML = "<div class='station-item empty'>No stations available</div>";
        return;
      }
      stations.forEach(station => {
        const item = document.createElement("div");
        item.classList.add("station-item");
        item.textContent = station.name;
        item.dataset.value = station.url;
        item.addEventListener("click", () => changeStation(stationItems.indexOf(item)));
        stationList.appendChild(item);
      });
      stationItems = Array.from(stationList.children);
      if (intendedPlaying && currentIndex < stationItems.length) {
        changeStation(currentIndex);
      }
    }

    function changeStation(index) {
      if (index < 0 || index >= stationItems.length) return;
      currentIndex = index;
      audio.src = stationItems[index].dataset.value;
      audio.preload = "auto";
      if (intendedPlaying) {
        debouncedTryAutoPlay();
      }
      const stationName = stationItems[index].textContent;
      currentStationInfo.querySelector(".station-name").textContent = stationName;
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: stationName,
          artist: "Radio S O",
          album: currentTab
        });
      }
    }

    function searchStations(query, country, genre) {
      const filteredStations = Object.values(stationLists).flat().filter(station => {
        const matchesQuery = query ? station.name.toLowerCase().includes(query.toLowerCase()) : true;
        const matchesCountry = country ? station.country?.toUpperCase() === country : true;
        const matchesGenre = genre ? station.genre?.toLowerCase() === genre : true;
        return matchesQuery && matchesCountry && matchesGenre;
      });
      stationList.innerHTML = "";
      if (filteredStations.length === 0) {
        stationList.innerHTML = "<div class='station-item empty'>No stations found</div>";
        return;
      }
      filteredStations.forEach(station => {
        const item = document.createElement("div");
        item.classList.add("station-item");
        item.textContent = station.name;
        item.dataset.value = station.url;
        item.addEventListener("click", () => changeStation(stationItems.indexOf(item)));
        stationList.appendChild(item);
      });
      stationItems = Array.from(stationList.children);
    }

    function applyTheme(theme) {
      document.body.setAttribute("data-theme", theme);
      localStorage.setItem("selectedTheme", theme);
    }

    function resetStationInfo() {
      currentStationInfo.querySelector(".station-name").textContent = "Обирайте станцію";
      currentStationInfo.querySelector(".station-genre").textContent = "жанр: -";
      currentStationInfo.querySelector(".station-country").textContent = "країна: -";
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
      }
    }

    const debouncedTryAutoPlay = debounce(tryAutoPlay, 300);

    function debounce(func, delay) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
      };
    }

    function tryAutoPlay() {
      if (!intendedPlaying || audio.readyState >= 2) return;
      audio.load();
      audio.play().catch(error => {
        console.error("Auto-play error:", error);
      });
    }

    function normalizeUrl(url) {
      return url.toLowerCase().replace(/\/$/, "");
    }

    function normalizeCountry(country) {
      return country.toUpperCase();
    }

    function prevStation() {
      if (!stationItems?.length) return;
      currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
      if (stationItems[currentIndex].classList.contains("empty")) currentIndex = stationItems.length - 1;
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
        console.log("Відновлення відтворення (користувач або зовнішній тригер)");
        isPlaying = true;
        intendedPlaying = true;
        debouncedTryAutoPlay();
        playPauseBtn.textContent = "⏸";
        document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
      } else {
        console.log("Зупинка відтворення");
        audio.pause();
        isPlaying = false;
        intendedPlaying = false;  // Скидаємо намір при ручній паузі
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
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'RESUME_PLAYBACK' });
          }
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
        }, 500);
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
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'RESUME_PLAYBACK' });
        }
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
        if (audio.paused && intendedPlaying) {
          console.log("MediaSession play викликано (наприклад, від Bluetooth) - відновлення останньої станції");
          debouncedTryAutoPlay();
        }
      });

      navigator.mediaSession.setActionHandler("pause", () => {
        if (!audio.paused) {
          console.log("MediaSession pause викликано - зупинка відтворення");
          audio.pause();
          intendedPlaying = false;
          localStorage.setItem("intendedPlaying", intendedPlaying);
        }
      });

      navigator.mediaSession.setActionHandler("previoustrack", prevStation);
      navigator.mediaSession.setActionHandler("nexttrack", nextStation);
    }

    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", async () => {
        console.log("Зміна медіапристрою (можливе повторне підключення Bluetooth)");
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasAudioOutput = devices.some(device => device.kind === "audiooutput" && device.label.includes("Bluetooth"));
        if (intendedPlaying && audio.paused && hasAudioOutput) {
          console.log("Виявлено пристрій, схожий на Bluetooth - спроба автовідновлення");
          debouncedTryAutoPlay();
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'RESUME_PLAYBACK' });
          }
        }
      });
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).catch(err => console.warn("Дозвіл на медіа відхилено:", err));

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data.type === "RESUME_PLAYBACK" && intendedPlaying) {
        debouncedTryAutoPlay();
      }
    });

    applyTheme(currentTheme);
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