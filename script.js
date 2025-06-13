// Declaration of variables at the top to avoid Temporal Dead Zone
let currentTab = localStorage.getItem("currentTab") || "techno";
let hasUserInteracted = false;
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {};
let stationItems = [];
let abortController = new AbortController();
let errorCount = 0;
const ERROR_LIMIT = 5;

// Wait for DOM to load
document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
  const currentStationInfo = document.getElementById("currentStationInfo");
  const themeToggle = document.querySelector(".theme-toggle");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle) {
    console.error("One of the required DOM elements not found");
    setTimeout(initializeApp, 100);
    return;
  }

  initializeApp();

  function initializeApp() {
    audio.preload = "auto";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

    const tabButtons = document.querySelectorAll(".tab-btn");
    if (tabButtons.length === 0) {
      console.error("Elements with class .tab-btn not found in DOM");
      return;
    }
    tabButtons.forEach((btn, index) => {
      const tabs = ["best", "techno", "trance", "ukraine", "pop", "search"];
      const tab = tabs[index];
      btn.addEventListener("click", () => switchTab(tab));
    });

    document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
    document.querySelector(".controls .control-btn:nth-child(2)").addEventListener("click", togglePlayPause);
    document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);

    function isValidUrl(url) {
      return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(url);
    }

    function resetStationInfo() {
      const stationNameElement = currentStationInfo.querySelector(".station-name");
      const stationGenreElement = currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = currentStationInfo.querySelector(".station-country");
      if (stationNameElement) stationNameElement.textContent = "Обирайте станцію";
      if (stationGenreElement) stationGenreElement.textContent = "жанр: -";
      if (stationCountryElement) stationCountryElement.textContent = "країна: -";
    }

    async function loadStations() {
      console.time("loadStations");
      stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
      try {
        abortController.abort();
        abortController = new AbortController();
        const response = await fetch(`stations.json?t=${Date.now()}`, {
          cache: "no-cache",
          headers: { "If-Modified-Since": localStorage.getItem("stationsLastModified") || "" },
          signal: abortController.signal
        });
        if (response.status === 304) {
          const cachedData = await caches.match("stations.json");
          if (cachedData) stationLists = await cachedData.json();
          else throw new Error("Cache not found");
        } else if (response.ok) {
          stationLists = await response.json();
          localStorage.setItem("stationsLastModified", response.headers.get("Last-Modified") || "");
        } else throw new Error(`HTTP ${response.status}`);
        favoriteStations = favoriteStations.filter(name => Object.values(stationLists).flat().some(s => s.name === name));
        localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
        const validTabs = [...Object.keys(stationLists), "best", "search"];
        if (!validTabs.includes(currentTab)) {
          currentTab = validTabs[0] || "techno";
          localStorage.setItem("currentTab", currentTab);
        }
        currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
        switchTab(currentTab);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error("Error loading stations:", error);
          stationList.innerHTML = "<div class='station-item empty'>Не вдалося завантажити станції</div>";
        }
      } finally {
        console.timeEnd("loadStations");
      }
    }

    const themes = {
      "neon-pulse": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#00F0FF", text: "#F0F0F0", accentGradient: "#003C4B" },
      "lime-surge": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#B2FF59", text: "#E8F5E9", accentGradient: "#2E4B2F" },
      "flamingo-flash": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#FF4081", text: "#FCE4EC", accentGradient: "#4B1A2E" },
      "violet-vortex": { bodyBg: "#121212", containerBg: "#1A1A1A", accent: "#7C4DFF", text: "#EDE7F6", accentGradient: "#2E1A47" },
      "aqua-glow": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#26C6DA", text: "#B2EBF2", accentGradient: "#1A3C4B" },
      "cosmic-indigo": { bodyBg: "#121212", containerBg: "#1A1A1A", accent: "#3F51B5", text: "#BBDEFB", accentGradient: "#1A2A5A" },
      "mystic-jade": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#26A69A", text: "#B2DFDB", accentGradient: "#1A3C4B" },
      "aurora-haze": { bodyBg: "#121212", containerBg: "#1A1A1A", accent: "#64FFDA", text: "#E0F7FA", accentGradient: "#1A4B4B" },
      "starlit-amethyst": { bodyBg: "#0A0A0A", containerBg: "#121212", accent: "#B388FF", text: "#E1BEE7", accentGradient: "#2E1A47" },
      "lunar-frost": { bodyBg: "#F5F7FA", containerBg: "#FFFFFF", accent: "#40C4FF", text: "#212121", accentGradient: "#B3E5FC" }
    };
    let currentTheme = localStorage.getItem("selectedTheme") || "neon-pulse";

    function applyTheme(theme) {
      const root = document.documentElement;
      root.style.setProperty("--body-bg", themes[theme].bodyBg);
      root.style.setProperty("--container-bg", themes[theme].containerBg);
      root.style.setProperty("--accent", themes[theme].accent);
      root.style.setProperty("--text", themes[theme].text);
      root.style.setProperty("--accent-gradient", themes[theme].accentGradient);
      localStorage.setItem("selectedTheme", theme);
      currentTheme = theme;
      document.documentElement.setAttribute("data-theme", theme);
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) themeColorMeta.setAttribute("content", themes[theme].accent);
    }

    function toggleTheme() {
      const themesOrder = ["neon-pulse", "lime-surge", "flamingo-flash", "violet-vortex", "aqua-glow", "cosmic-indigo", "mystic-jade", "aurora-haze", "starlit-amethyst", "lunar-frost"];
      const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % themesOrder.length];
      applyTheme(nextTheme);
    }

    themeToggle.addEventListener("click", toggleTheme);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").then(registration => {
        registration.update();
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
                if (window.confirm("Доступна нова версія радіо. Оновити?")) window.location.reload();
              }
            });
          }
        });
      }).catch(error => console.error("Service Worker registration failed:", error));

      navigator.serviceWorker.addEventListener("message", event => {
        if (event.data.type === "NETWORK_STATUS" && event.data.online && isPlaying && stationItems.length && currentIndex < stationItems.length) {
          console.log("Received message from Service Worker: network restored");
          audio.pause();
          audio.src = "";
          audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
        }
      });
    }

    function tryAutoPlay() {
      if (!navigator.onLine) {
        console.log("Device offline, skipping playback");
        return;
      }
      if (!isPlaying || !stationItems.length || currentIndex >= stationItems.length || !hasUserInteracted) {
        console.log("Skipping tryAutoPlay", { isPlaying, hasStationItems: !!stationItems.length, isIndexValid: currentIndex < stationItems.length, hasUserInteracted });
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
        return;
      }
      if (audio.src === stationItems[currentIndex].dataset.value && !audio.paused) return;
      if (!isValidUrl(stationItems[currentIndex].dataset.value)) {
        console.error("Invalid URL:", stationItems[currentIndex].dataset.value);
        errorCount++;
        if (errorCount >= ERROR_LIMIT) console.error("Reached error limit for playback");
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
        return;
      }
      audio.pause();
      audio.src = "";
      audio.src = stationItems[currentIndex].dataset.value;
      const playPromise = audio.play();
      playPromise.then(() => {
        errorCount = 0;
        console.log("Playback started successfully");
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      }).catch(error => {
        console.error("Playback error:", error);
        if (error.name !== "AbortError") {
          errorCount++;
          if (errorCount >= ERROR_LIMIT) console.error("Reached error limit for playback");
        }
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      });
    }

    function switchTab(tab) {
      if (!["techno", "trance", "ukraine", "pop", "best", "search"].includes(tab)) tab = "techno";
      currentTab = tab;
      localStorage.setItem("currentTab", tab);
      const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
      const maxIndex = tab === "best" ? favoriteStations.length : tab === "search" ? 0 : stationLists[tab]?.length || 0;
      currentIndex = savedIndex < maxIndex ? savedIndex : 0;
      updateStationList();
      document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
      const activeBtn = document.querySelector(`.tab-btn:nth-child(${["best", "techno", "trance", "ukraine", "pop", "search"].indexOf(tab) + 1})`);
      if (activeBtn) activeBtn.classList.add("active");
      if (stationItems.length && currentIndex < stationItems.length) tryAutoPlay();
    }

    function updateStationList() {
      if (!stationList) {
        console.error("stationList not found");
        return;
      }
      let stations = currentTab === "best"
        ? favoriteStations.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s)
        : stationLists[currentTab] || [];

      if (currentTab === "search") {
        stationList.innerHTML = `<input type="text" id="searchInput" placeholder="Search stations..." class="station-item" style="border: 1px solid var(--text); background: var(--container-bg); color: var(--text); padding: 10px; margin: 5px 0;">`;
        const searchInput = document.getElementById("searchInput");
        searchInput.addEventListener("input", async (e) => {
          const query = e.target.value.trim();
          if (query.length < 2) {
            stationList.innerHTML = `<input type="text" id="searchInput" placeholder="Search stations..." class="station-item" style="border: 1px solid var(--text); background: var(--container-bg); color: var(--text); padding: 10px; margin: 5px 0;">`;
            stationItems = [];
            return;
          }
          try {
            const response = await fetch(`https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const searchResults = await response.json();
            const fragment = document.createDocumentFragment();
            searchResults.forEach((station, index) => {
              if (isValidUrl(station.url_resolved || station.url)) {
                const item = document.createElement("div");
                item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
                item.dataset.value = station.url_resolved || station.url;
                item.dataset.name = station.name;
                item.dataset.genre = station.tags || "Unknown";
                item.dataset.country = station.country || "Unknown";
                item.innerHTML = `${"🎶"} ${station.name} <button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}" data-name="${station.name}">★</button>`;
                fragment.appendChild(item);
              }
            });
            stationList.innerHTML = `<input type="text" id="searchInput" placeholder="Search stations..." class="station-item" style="border: 1px solid var(--text); background: var(--container-bg); color: var(--text); padding: 10px; margin: 5px 0;">`;
            if (fragment.childNodes.length > 0) {
              stationList.appendChild(fragment);
            } else {
              stationList.innerHTML += "<div class='station-item empty'>Нічого не знайдено</div>";
            }
            stationItems = stationList.querySelectorAll(".station-item:not(#searchInput)");

            stationList.onclick = (e) => {
              const item = e.target.closest(".station-item:not(#searchInput)");
              const favoriteBtn = e.target.closest(".favorite-btn");
              hasUserInteracted = true;
              if (item) {
                currentIndex = Array.from(stationItems).indexOf(item);
                changeStation(currentIndex);
              }
              if (favoriteBtn) {
                e.stopPropagation();
                const stationName = favoriteBtn.getAttribute("data-name");
                toggleFavorite(stationName);
              }
            };
          } catch (error) {
            console.error("Search stations error:", error);
            stationList.innerHTML = `<input type="text" id="searchInput" placeholder="Search stations..." class="station-item" style="border: 1px solid var(--text); background: var(--container-bg); color: var(--text); padding: 10px; margin: 5px 0;"><div class='station-item empty'>Помилка завантаження</div>`;
            stationItems = [];
          }
        });
        return;
      }

      if (!stations.length) {
        currentIndex = 0;
        stationItems = [];
        stationList.innerHTML = `<div class='station-item empty'>${currentTab === "best" ? "Немає улюблених станцій" : "Немає станцій у цій категорії"}</div>`;
        return;
      }

      const fragment = document.createDocumentFragment();
      stations.forEach((station, index) => {
        const item = document.createElement("div");
        item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
        item.dataset.value = station.value;
        item.dataset.name = station.name;
        item.dataset.genre = station.genre;
        item.dataset.country = station.country;
        item.innerHTML = `${station.emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}" data-name="${station.name}">★</button>`;
        fragment.appendChild(item);
      });
      stationList.innerHTML = "";
      stationList.appendChild(fragment);
      stationItems = stationList.querySelectorAll(".station-item");

      if (stationItems.length && currentIndex < stationItems.length && !stationItems[currentIndex].classList.contains("empty")) {
        stationItems[currentIndex].scrollIntoView({ behavior: "smooth", block: "start" });
      }

      stationList.onclick = (e) => {
        const item = e.target.closest(".station-item");
        const favoriteBtn = e.target.closest(".favorite-btn");
        hasUserInteracted = true;
        if (item && !item.classList.contains("empty")) {
          currentIndex = Array.from(stationItems).indexOf(item);
          changeStation(currentIndex);
        }
        if (favoriteBtn) {
          e.stopPropagation();
          const stationName = favoriteBtn.getAttribute("data-name");
          toggleFavorite(stationName);
        }
      };

      if (stationItems.length && currentIndex < stationItems.length) changeStation(currentIndex);
    }

    function toggleFavorite(stationName) {
      hasUserInteracted = true;
      if (favoriteStations.includes(stationName)) {
        favoriteStations = favoriteStations.filter(name => name !== stationName);
      } else {
        favoriteStations.unshift(stationName);
      }
      localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
      if (currentTab === "best") switchTab("best");
      else updateStationList();
    }

    function changeStation(index) {
      if (index < 0 || index >= stationItems.length || !stationItems[index] || stationItems[index].classList.contains("empty")) return;
      const item = stationItems[index];
      stationItems.forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");
      currentIndex = index;
      updateCurrentStationInfo(item);
      localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
      tryAutoPlay();
    }

    function updateCurrentStationInfo(item) {
      if (!currentStationInfo) {
        console.error("currentStationInfo not found");
        return;
      }
      const stationNameElement = currentStationInfo.querySelector(".station-name");
      const stationGenreElement = currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = currentStationInfo.querySelector(".station-country");

      if (stationNameElement) stationNameElement.textContent = item.dataset.name || "Unknown";
      if (stationGenreElement) stationGenreElement.textContent = `жанр: ${item.dataset.genre || "Unknown"}`;
      if (stationCountryElement) stationCountryElement.textContent = `країна: ${item.dataset.country || "Unknown"}`;
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.dataset.name || "Unknown Station",
          artist: `${item.dataset.genre || "Unknown"} | ${item.dataset.country || "Unknown"}`,
          album: "Radio Music"
        });
      }
    }

    function prevStation() {
      hasUserInteracted = true;
      if (!stationItems || stationItems.length === 0) return;
      currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
      if (stationItems[currentIndex] && stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
      changeStation(currentIndex);
    }

    function nextStation() {
      hasUserInteracted = true;
      if (!stationItems || stationItems.length === 0) return;
      currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
      if (stationItems[currentIndex] && stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
      changeStation(currentIndex);
    }

    function togglePlayPause() {
      if (!playPauseBtn || !audio) {
        console.error("playPauseBtn or audio not found");
        return;
      }
      hasUserInteracted = true;
      if (audio.paused) {
        isPlaying = true;
        tryAutoPlay();
        playPauseBtn.textContent = "⏸";
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      } else {
        audio.pause();
        isPlaying = false;
        playPauseBtn.textContent = "▶";
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      }
      localStorage.setItem("isPlaying", isPlaying);
    }

    const eventListeners = {
      keydown: e => {
        hasUserInteracted = true;
        if (e.key === "ArrowLeft") prevStation();
        if (e.key === "ArrowRight") nextStation();
        if (e.key === " ") {
          e.preventDefault();
          togglePlayPause();
        }
      },
      visibilitychange: () => {
        if (!document.hidden && isPlaying && navigator.onLine && stationItems.length && currentIndex < stationItems.length && stationItems[currentIndex]) {
          if (!audio.paused) return;
          audio.pause();
          audio.src = "";
          audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
        }
      },
      resume: () => {
        if (isPlaying && navigator.connection?.type !== "none" && stationItems.length && currentIndex < stationItems.length && stationItems[currentIndex]) {
          if (!audio.paused) return;
          audio.pause();
          audio.src = "";
          audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
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
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      localStorage.setItem("isPlaying", isPlaying);
    });

    audio.addEventListener("pause", () => {
      isPlaying = false;
      playPauseBtn.textContent = "▶";
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
    });

    audio.addEventListener("error", () => {
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      console.error("Audio error:", audio.error?.message, "for URL:", audio.src);
      if (isPlaying && errorCount < ERROR_LIMIT) {
        errorCount++;
        setTimeout(nextStation, 1000);
      } else if (errorCount >= ERROR_LIMIT) console.error("Reached error limit for playback");
    });

    audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", audio.volume);
    });

    window.addEventListener("online", () => {
      console.log("Network restored");
      if (isPlaying && stationItems.length && currentIndex < stationItems.length) {
        audio.pause();
        audio.src = "";
        audio.src = stationItems[currentIndex].dataset.value;
        tryAutoPlay();
      }
    });

    window.addEventListener("offline", () => console.log("Lost network connection"));

    addEventListeners();

    window.addEventListener("beforeunload", removeEventListeners);

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", togglePlayPause);
      navigator.mediaSession.setActionHandler("pause", togglePlayPause);
      navigator.mediaSession.setActionHandler("previoustrack", prevStation);
      navigator.mediaSession.setActionHandler("nexttrack", nextStation);
    }

    document.addEventListener("click", () => hasUserInteracted = true);

    applyTheme(currentTheme);
    loadStations();
  }
});