```javascript
// Ініціалізація основних змінних
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
let autoPlayRequestId = 0;
customTabs = Array.isArray(customTabs) ? customTabs.filter(tab => typeof tab === "string" && tab.trim()) : [];

// Локалізація
const translations = {
  uk: {
    search: 'Пошук',
    play: 'Відтворити',
    pause: 'Пауза',
    prev: 'Попередня',
    next: 'Наступна',
    station: 'Станція',
    genre: 'Жанр',
    country: 'Країна',
    bitrate: 'Бітрейт',
    language: 'Мова',
    emptySearch: 'Введіть назву, країну, жанр, бітрейт або мову',
    error: 'Помилка відтворення',
    networkError: 'Проблема з мережею. Перевірте підключення.',
    formatError: 'Формат радіостанції не підтримується.',
    sleepTimer: 'Таймер сну завершився',
    settingsExported: 'Налаштування експортовано',
    invalidSettings: 'Недійсний файл налаштувань!',
    invalidUrl: 'Недійсна або небезпечна URL-адреса'
  },
  en: {
    search: 'Search',
    play: 'Play',
    pause: 'Pause',
    prev: 'Previous',
    next: 'Next',
    station: 'Station',
    genre: 'Genre',
    country: 'Country',
    bitrate: 'Bitrate',
    language: 'Language',
    emptySearch: 'Enter station name, country, genre, bitrate, or language',
    error: 'Playback error',
    networkError: 'Network issue. Check your connection.',
    formatError: 'Station format not supported.',
    sleepTimer: 'Sleep timer finished',
    settingsExported: 'Settings exported',
    invalidSettings: 'Invalid settings file!',
    invalidUrl: 'Invalid or unsafe URL'
  }
};
let currentLang = localStorage.getItem('language') || 'uk';

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('language', lang);
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = translations[lang][el.dataset.i18n] || el.textContent;
  });
}

// IndexedDB для офлайн-режиму
async function initDB() {
  const db = await openDB('radio-so-db', 1, {
    upgrade(db) {
      db.createObjectStore('stations', { keyPath: 'id' });
    }
  });
  return db;
}

async function cacheStation(station) {
  const db = await initDB();
  await db.put('stations', station);
}

async function getCachedStations() {
  const db = await initDB();
  return await db.getAll('stations');
}

// Перевірка безпеки URL
function isSafeUrl(url) {
  const safeProtocols = ['https:', 'http:'];
  try {
    const parsedUrl = new URL(url);
    return safeProtocols.includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}

// Функція debounce
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Ініціалізація програми
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
  const searchBitrate = document.getElementById("searchBitrate");
  const searchLanguage = document.getElementById("searchLanguage");
  const searchBtn = document.querySelector(".search-btn");
  const pastSearchesList = document.getElementById("pastSearches");
  const tabsContainer = document.getElementById("tabs");
  const sleepTimerBtn = document.querySelector(".sleep-timer-btn");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !shareButton || !exportButton || !importButton || !importFileInput || !searchInput || !searchQuery || !searchCountry || !searchGenre || !searchBitrate || !searchLanguage || !searchBtn || !pastSearchesList || !tabsContainer) {
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
      searchBitrate: !!searchBitrate,
      searchLanguage: !!searchLanguage,
      searchBtn: !!searchBtn,
      pastSearchesList: !!pastSearchesList,
      tabsContainer: !!tabsContainer
    });
    setTimeout(initializeApp, 100);
    return;
  }

  initializeApp();

  async function initializeApp() {
    audio.preload = "auto";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;
    setLanguage(currentLang);
    updatePastSearches();
    populateSearchSuggestions();
    renderTabs();

    // Події для кнопок
    shareButton.addEventListener("click", () => {
      const stationName = currentStationInfo.querySelector(".station-name").textContent || "Radio S O";
      const shareData = {
        title: "Radio S O",
        text: `Listening to ${stationName} on Radio S O!`,
        url: window.location.href
      };
      if (navigator.share) {
        navigator.share(shareData).catch(error => console.error("Error sharing:", error));
      } else {
        alert(`${translations[currentLang].shareNotSupported}: ${shareData.text} ${shareData.url}`);
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
      const bitrate = searchBitrate.value.trim();
      const language = searchLanguage.value.trim().toLowerCase();
      if (query || country || genre || bitrate || language) {
        if (query && !pastSearches.includes(query)) {
          pastSearches.unshift(query);
          if (pastSearches.length > 5) pastSearches.pop();
          localStorage.setItem("pastSearches", JSON.stringify(pastSearches));
          updatePastSearches();
        }
        searchStations(query, country, genre, bitrate, language);
      } else {
        stationList.innerHTML = `<div class='station-item empty'>${translations[currentLang].emptySearch}</div>`;
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
    searchBitrate.addEventListener("keypress", (e) => {
      if (e.key === "Enter") searchBtn.click();
    });
    searchLanguage.addEventListener("keypress", (e) => {
      if (e.key === "Enter") searchBtn.click();
    });

    sleepTimerBtn.addEventListener("click", () => {
      const minutes = prompt("Введіть час таймера сну (хвилини):");
      if (minutes && !isNaN(minutes) && minutes > 0) {
        startSleepTimer(minutes);
      }
    });

    // Голосове керування
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.lang = currentLang === 'uk' ? 'uk-UA' : 'en-US';
      recognition.onresult = (event) => {
        const command = event.results[0][0].transcript.toLowerCase();
        if (command.includes('техно') || command.includes('techno')) {
          switchTab('techno');
        } else if (command.includes('пауза') || command.includes('pause')) {
          togglePlayPause();
        } else if (command.includes('наступна') || command.includes('next')) {
          nextStation();
        }
      };
      document.querySelector(".voice-control-btn").addEventListener("click", () => {
        recognition.start();
      });
    }

    // Експорт налаштувань
    function exportSettings() {
      const settings = {
        selectedTheme: localStorage.getItem("selectedTheme") || "neon-pulse",
        customTabs,
        userAddedStations,
        favoriteStations,
        pastSearches,
        deletedStations,
        currentTab,
        language: currentLang
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
      alert(translations[currentLang].settingsExported);
    }

    // Імпорт налаштувань
    function importSettings(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const settings = JSON.parse(e.target.result);
          if (!settings || typeof settings !== "object") {
            alert(translations[currentLang].invalidSettings);
            return;
          }
          const validThemes = [
            "shadow-pulse", "dark-abyss", "emerald-glow", "retro-wave",
            "neon-pulse", "lime-surge", "flamingo-flash", "aqua-glow",
            "aurora-haze", "starlit-amethyst", "lunar-frost", "high-contrast"
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
            }
          }
          if (settings.userAddedStations && typeof settings.userAddedStations === "object") {
            const validStations = {};
            Object.keys(settings.userAddedStations).forEach(tab => {
              if (["techno", "trance", "ukraine", "pop", ...customTabs].includes(tab)) {
                validStations[tab] = settings.userAddedStations[tab].filter(s =>
                  s && typeof s === "object" &&
                  s.name && typeof s.name === "string" &&
                  s.value && isSafeUrl(s.value) &&
                  s.genre && typeof s.genre === "string"
                );
              }
            });
            userAddedStations = validStations;
            localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
          }
          if (Array.isArray(settings.favoriteStations)) {
            favoriteStations = settings.favoriteStations.filter(s => s && typeof s === "string");
            localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
          }
          if (Array.isArray(settings.pastSearches)) {
            pastSearches = settings.pastSearches.filter(s => typeof s === "string").slice(0, 5);
            localStorage.setItem("pastSearches", JSON.stringify(pastSearches));
            updatePastSearches();
          }
          if (Array.isArray(settings.deletedStations)) {
            deletedStations = settings.deletedStations.filter(s => s && typeof s === "string");
            localStorage.setItem("deletedStations", JSON.stringify(deletedStations));
          }
          if (settings.currentTab && ["best", "techno", "trance", "ukraine", "pop", "search", ...customTabs].includes(settings.currentTab)) {
            currentTab = settings.currentTab;
            localStorage.setItem("currentTab", currentTab);
          }
          if (settings.language && ['uk', 'en'].includes(settings.language)) {
            setLanguage(settings.language);
          }
          renderTabs();
          loadStations();
        } catch (error) {
          console.error("Import error:", error);
          alert(translations[currentLang].invalidSettings);
        }
      };
      reader.readAsText(file);
    }

    // Пошук станцій
    function searchStations(query, country, genre, bitrate, language) {
      const cacheKey = `search_${query}_${country}_${genre}_${bitrate}_${language}`;
      const cachedResults = JSON.parse(localStorage.getItem(cacheKey));
      if (cachedResults) {
        renderStations(cachedResults);
        return;
      }
      fetch(`/stations.json?query=${encodeURIComponent(query)}&country=${encodeURIComponent(country)}&genre=${encodeURIComponent(genre)}&bitrate=${encodeURIComponent(bitrate)}&language=${encodeURIComponent(language)}`, {
        signal: abortController.signal
      })
        .then(response => response.json())
        .then(data => {
          localStorage.setItem(cacheKey, JSON.stringify(data));
          renderStations(data);
          data.forEach(station => cacheStation(station));
        })
        .catch(error => {
          console.error("Search error:", error);
          stationList.innerHTML = `<div class='station-item empty'>${translations[currentLang].error}</div>`;
        });
    }

    // Завантаження подкастів
    async function fetchPodcasts(rssUrl) {
      try {
        const response = await fetch(rssUrl);
        const xml = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xml, "text/xml");
        const items = xmlDoc.querySelectorAll("item");
        const episodes = Array.from(items).map(item => ({
          title: item.querySelector("title")?.textContent || "Untitled",
          url: item.querySelector("enclosure")?.getAttribute("url") || "",
          genre: "podcast"
        }));
        renderStations(episodes);
      } catch (error) {
        console.error("Podcast fetch error:", error);
        stationList.innerHTML = `<div class='station-item empty'>${translations[currentLang].error}</div>`;
      }
    }

    // Таймер сну
    function startSleepTimer(minutes) {
      setTimeout(() => {
        audio.pause();
        togglePlayPause();
        alert(translations[currentLang].sleepTimer);
      }, minutes * 60 * 1000);
    }

    // Аналітика прослуховування
    function trackListeningTime(stationId, duration) {
      const stats = JSON.parse(localStorage.getItem('listeningStats')) || {};
      stats[stationId] = (stats[stationId] || 0) + duration;
      localStorage.setItem('listeningStats', JSON.stringify(stats));
    }

    // Нормалізація URL
    function normalizeUrl(url) {
      try {
        return new URL(url).href;
      } catch {
        return url;
      }
    }

    // Нормалізація країни
    function normalizeCountry(country) {
      return country.trim().toLowerCase();
    }

    // Оновлення історії пошуку
    function updatePastSearches() {
      pastSearchesList.innerHTML = pastSearches.map(search => `
        <div class="past-search-item" data-search="${search}">${search}</div>
      `).join("");
      document.querySelectorAll(".past-search-item").forEach(item => {
        item.addEventListener("click", () => {
          searchQuery.value = item.dataset.search;
          searchBtn.click();
        });
      });
    }

    // Заповнення пропозицій пошуку
    function populateSearchSuggestions() {
      // Реалізуйте логіку для автодоповнення
    }

    // Рендеринг вкладок
    function renderTabs() {
      tabsContainer.innerHTML = `
        ${["best", "techno", "trance", "ukraine", "pop", "search", "podcasts", ...customTabs].map(tab => `
          <div class="tab-btn ${tab === currentTab ? 'active' : ''}" data-tab="${tab}">${tab.charAt(0).toUpperCase() + tab.slice(1)}</div>
        `).join("")}
        <div class="add-tab-btn">+</div>
      `;
      document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
      });
      document.querySelector(".add-tab-btn").addEventListener("click", showNewTabModal);
    }

    // Перемикання вкладок
    function switchTab(tab) {
      currentTab = tab;
      localStorage.setItem("currentTab", currentTab);
      document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
      document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add("active");
      if (tab === "podcasts") {
        fetchPodcasts("https://example.com/podcasts.rss");
      } else {
        loadStations();
      }
    }

    // Завантаження станцій
    function loadStations() {
      stationItems = [];
      if (!navigator.onLine) {
        getCachedStations().then(stations => renderStations(stations));
        return;
      }
      fetch("/stations.json")
        .then(response => response.json())
        .then(data => {
          renderStations(data);
          data.forEach(station => cacheStation(station));
        })
        .catch(error => {
          console.error("Load stations error:", error);
          getCachedStations().then(stations => renderStations(stations));
        });
    }

    // Рендеринг станцій
    function renderStations(stations) {
      stationList.innerHTML = stations.length
        ? stations.map((station, index) => `
            <div class="station-item" data-index="${index}" data-name="${station.name}" data-value="${station.value}" data-genre="${station.genre}" data-country="${station.country}" data-favicon="${station.favicon || ''}">
              <div class="station-icon">${station.favicon ? `<img src="${station.favicon}" alt="${station.name}">` : '🎵'}</div>
              <div class="station-text">
                <div class="station-name">${station.name}</div>
                <div class="station-genre">${translations[currentLang].genre}: ${station.genre || ''}</div>
                <div class="station-country">${translations[currentLang].country}: ${station.country || ''}</div>
              </div>
            </div>
          `).join("")
        : `<div class="station-item empty">${translations[currentLang].emptySearch}</div>`;
      stationItems = document.querySelectorAll(".station-item:not(.empty)");
      stationItems.forEach(item => {
        item.addEventListener("click", () => changeStation(parseInt(item.dataset.index)));
      });
      if (intendedPlaying && currentIndex < stationItems.length) {
        changeStation(currentIndex);
      }
    }

    // Зміна станції
    function changeStation(index) {
      if (!stationItems?.length || index >= stationItems.length) return;
      currentIndex = index;
      const item = stationItems[currentIndex];
      if (!item || !isSafeUrl(item.dataset.value)) {
        console.error("Invalid or unsafe URL:", item?.dataset.value);
        alert(translations[currentLang].invalidUrl);
        return;
      }
      audio.src = item.dataset.value;
      if (intendedPlaying) {
        debouncedTryAutoPlay();
      }
      updateStationInfo(item);
      localStorage.setItem("currentIndex", currentIndex);
      trackListeningTime(item.dataset.name, Date.now() - lastSuccessfulPlayTime);
      lastSuccessfulPlayTime = Date.now();
    }

    // Оновлення інформації про станцію
    function updateStationInfo(item) {
      const stationNameElement = currentStationInfo.querySelector(".station-name");
      const stationGenreElement = currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = currentStationInfo.querySelector(".station-country");
      const stationIconElement = currentStationInfo.querySelector(".station-icon");
      if (stationNameElement) {
        stationNameElement.textContent = item.dataset.name || "Unknown Station";
      }
      if (stationGenreElement) {
        stationGenreElement.textContent = `${translations[currentLang].genre}: ${item.dataset.genre || ""}`;
      }
      if (stationCountryElement) {
        stationCountryElement.textContent = `${translations[currentLang].country}: ${item.dataset.country || ""}`;
      }
      if (stationIconElement) {
        if (item.dataset.favicon && isSafeUrl(item.dataset.favicon)) {
          stationIconElement.innerHTML = `<img src="${item.dataset.favicon}" alt="${item.dataset.name}">`;
        } else {
          stationIconElement.innerHTML = "🎵";
          stationIconElement.style.backgroundImage = "none";
        }
      }
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.dataset.name || "Unknown Station",
          artist: `${item.dataset.genre || ""} | ${item.dataset.country || ""}`,
          album: "Radio Music S O",
          artwork: item.dataset.favicon && isSafeUrl(item.dataset.favicon) ? [
            { src: item.dataset.favicon, sizes: "96x96", type: "image/png" },
            { src: item.dataset.favicon, sizes: "128x128", type: "image/png" },
            { src: item.dataset.favicon, sizes: "192x192", type: "image/png" },
            { src: item.dataset.favicon, sizes: "256x256", type: "image/png" },
            { src: item.dataset.favicon, sizes: "384x384", type: "image/png" },
            { src: item.dataset.favicon, sizes: "512x512", type: "image/png" }
          ] : []
        });
      }
    }

    // Попередня станція
    function prevStation() {
      if (!stationItems?.length) return;
      currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
      if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
      changeStation(currentIndex);
    }

    // Наступна станція
    function nextStation() {
      if (!stationItems?.length) return;
      currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
      if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
      changeStation(currentIndex);
    }

    // Перемикання відтворення/паузи
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
        playPauseBtn.setAttribute('aria-label', translations[currentLang].pause);
        document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
      } else {
        audio.pause();
        isPlaying = false;
        intendedPlaying = false;
        playPauseBtn.textContent = "▶";
        playPauseBtn.setAttribute('aria-label', translations[currentLang].play);
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      }
      localStorage.setItem("isPlaying", isPlaying);
      localStorage.setItem("intendedPlaying", intendedPlaying);
    }

    // Спроба автозапуску
    const debouncedTryAutoPlay = debounce(() => {
      if (!intendedPlaying || !stationItems?.length || currentIndex >= stationItems.length) return;
      autoPlayRequestId++;
      const currentRequestId = autoPlayRequestId;
      if (streamAbortController) streamAbortController.abort();
      streamAbortController = new AbortController();
      audio.src = stationItems[currentIndex].dataset.value;
      audio.play().catch(error => {
        if (currentRequestId !== autoPlayRequestId) return;
        console.error("Auto-play error:", error);
      });
    }, 1000);

    // Обробники подій
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
          return;
        }
        const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) {
          return;
        }
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
      },
      resume: () => {
        if (!intendedPlaying || !navigator.onLine || !stationItems?.length || currentIndex >= stationItems.length) {
          return;
        }
        const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) {
          return;
        }
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
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

    // Обробка подій аудіо
    audio.addEventListener("playing", () => {
      isPlaying = true;
      playPauseBtn.textContent = "⏸";
      playPauseBtn.setAttribute('aria-label', translations[currentLang].pause);
      document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
      localStorage.setItem("isPlaying", isPlaying);
      if (errorTimeout) {
        clearTimeout(errorTimeout);
        errorTimeout = null;
      }
      lastSuccessfulPlayTime = Date.now();
    });

    audio.addEventListener("pause", () => {
      isPlaying = false;
      playPauseBtn.textContent = "▶";
      playPauseBtn.setAttribute('aria-label', translations[currentLang].play);
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      localStorage.setItem("isPlaying", isPlaying);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
      }
      trackListeningTime(stationItems[currentIndex]?.dataset.name, Date.now() - lastSuccessfulPlayTime);
    });

    audio.addEventListener("error", () => {
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      const errorCode = audio.error?.code;
      let errorMessage = translations[currentLang].error;
      if (errorCode === MediaError.MEDIA_ERR_NETWORK) {
        errorMessage = translations[currentLang].networkError;
      } else if (errorCode === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        errorMessage = translations[currentLang].formatError;
      }
      alert(errorMessage);
      console.error("Audio error:", {
        code: errorCode,
        message: audio.error?.message || "Unknown error",
        url: audio.src
      });
      if (intendedPlaying && errorCount < ERROR_LIMIT && !errorTimeout) {
        errorCount++;
        errorTimeout = setTimeout(debouncedTryAutoPlay, 1000);
      } else if (errorCount >= ERROR_LIMIT) {
        resetStationInfo();
      }
    });

    audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", audio.volume);
    });

    window.addEventListener("online", () => {
      if (intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
      }
    });

    window.addEventListener("offline", () => {
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      errorCount = 0;
    });

    addEventListeners();

    window.addEventListener("beforeunload", () => {
      removeEventListeners();
      trackListeningTime(stationItems[currentIndex]?.dataset.name, Date.now() - lastSuccessfulPlayTime);
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

    applyTheme(localStorage.getItem("selectedTheme") || "neon-pulse");
    loadStations();
    if (intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
      const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
      const normalizedAudioSrc = normalizeUrl(audio.src);
      if (normalizedAudioSrc !== normalizedCurrentUrl || audio.paused || audio.error || audio.readyState < 2 || audio.currentTime === 0) {
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
      }
    }
  }
});

// Ініціалізація IndexedDB
import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@7/build/index.js';
```