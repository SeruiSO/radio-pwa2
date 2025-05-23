const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("currentStationInfo");
let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {};
let stationItems;
let retryCount = 0;
const MAX_RETRIES = 5;
const FAST_RETRY_INTERVAL = 1000;
const SLOW_RETRY_INTERVAL = 5000;
const FAST_RETRY_DURATION = 15000;
let isAutoPlaying = false;
let retryTimer = null;
let retryStartTime = null;
let cachedStations = null;

// Налаштування аудіо
audio.preload = "auto";
audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

// Завантаження станцій
async function loadStations(attempt = 1) {
  document.getElementById("loader").style.display = "block";
  if (cachedStations) {
    stationLists = cachedStations;
    switchTab(currentTab);
    document.getElementById("loader").style.display = "none";
    return;
  }
  const controller = new AbortController();
  try {
    const response = await fetch("stations.json", { signal: controller.signal, cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    stationLists = await response.json();
    cachedStations = stationLists;
    const validTabs = [...Object.keys(stationLists), "best"];
    if (!validTabs.includes(currentTab)) {
      currentTab = validTabs[0] || "techno";
      localStorage.setItem("currentTab", currentTab);
    }
    currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
    switchTab(currentTab);
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.error("Помилка завантаження станцій (спроба " + attempt + "):", error);
    if ("caches" in window) {
      const cacheResponse = await caches.match("stations.json");
      if (cacheResponse) {
        stationLists = await cacheResponse.json();
        cachedStations = stationLists;
        const validTabs = [...Object.keys(stationLists), "best"];
        if (!validTabs.includes(currentTab)) {
          currentTab = validTabs[0] || "techno";
          localStorage.setItem("currentTab", currentTab);
        }
        currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
        switchTab(currentTab);
        document.getElementById("loader").style.display = "none";
        return;
      }
    }
    if (attempt < MAX_RETRIES) {
      setTimeout(() => loadStations(attempt + 1), Math.pow(2, attempt) * 1000);
    }
  } finally {
    document.getElementById("loader").style.display = "none";
  }
}

// Теми
const themes = {
  dark: {
    bodyBg: "#121212",
    containerBg: "rgba(30, 30, 30, 0.9)",
    accent: "#00e676",
    text: "#e0e0e0",
    glow: "0 0 3px rgba(0, 230, 118, 0.3)"
  },
  light: {
    bodyBg: "#f5f5f5",
    containerBg: "rgba(255, 255, 255, 0.95)",
    accent: "#ff4081",
    text: "#212121",
    glow: "0 0 3px rgba(255, 64, 129, 0.3)"
  },
  neon: {
    bodyBg: "#1a0033",
    containerBg: "rgba(50, 0, 100, 0.9)",
    accent: "#ffeb3b",
    text: "#ffffff",
    glow: "0 0 4px rgba(255, 235, 59, 0.5)"
  },
  vibrant: {
    bodyBg: "#004d40",
    containerBg: "rgba(0, 77, 64, 0.9)",
    accent: "#ff5722",
    text: "#ffffff",
    glow: "0 0 3px rgba(255, 87, 34, 0.3)"
  },
  cosmic: {
    bodyBg: "#0d1b2a",
    containerBg: "rgba(20, 33, 61, 0.9)",
    accent: "#00b7eb",
    text: "#e0e0e0",
    glow: "0 0 3px rgba(0, 183, 235, 0.4)"
  }
};
let currentTheme = localStorage.getItem("selectedTheme") || "dark";

function applyTheme(theme) {
  const root = document.documentElement;
  const { bodyBg, containerBg, accent, text, glow } = themes[theme];
  const accentRGB = accent.match(/\d+/g).join(",");
  const containerBgRGB = containerBg.match(/\d+/g).slice(0, 3).join(",");
  root.style.setProperty("--body-bg", bodyBg);
  root.style.setProperty("--container-bg", containerBg);
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--text", text);
  root.style.setProperty("--glow", glow);
  root.style.setProperty("--accent-rgb", accentRGB);
  root.style.setProperty("--container-bg-rgb", containerBgRGB);
  localStorage.setItem("selectedTheme", theme);
  currentTheme = theme;
  document.body.setAttribute("data-theme", theme);
}

function toggleTheme() {
  const themesOrder = ["dark", "light", "neon", "vibrant", "cosmic"];
  const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % themesOrder.length];
  applyTheme(nextTheme);
}

// Налаштування Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(registration => {
    registration.update();
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          if (confirm("Доступна нова версія радіо. Оновити?")) {
            window.location.reload();
          }
        }
      });
    });
  });

  navigator.serviceWorker.addEventListener("message", event => {
    if (event.data.type === "NETWORK_STATUS" && event.data.online && isPlaying && stationItems?.length && currentIndex < stationItems.length) {
      console.log("Отримано повідомлення від Service Worker: мережа відновлена");
      retryCount = 0;
      retryStartTime = null;
      tryAutoPlay();
    }
  });
}

// Очищення таймера повторних спроб
function clearRetryTimer() {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}

// Запуск періодичних перевірок
function startRetryTimer() {
  clearRetryTimer();
  let slowRetryCount = 0;
  const maxSlowRetries = 5;
  retryTimer = setInterval(() => {
    if (navigator.onLine && isPlaying && stationItems?.length && currentIndex < stationItems.length && !isAutoPlaying && audio.paused) {
      console.log("Періодична спроба відновлення відтворення");
      tryAutoPlay();
      slowRetryCount++;
      if (slowRetryCount >= maxSlowRetries) {
        clearRetryTimer();
        console.log("Досягнуто максимум повільних спроб, зупиняємо таймер");
      }
    }
  }, SLOW_RETRY_INTERVAL);
}

// Автовідтворення
function tryAutoPlay() {
  if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length || isAutoPlaying) {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    return;
  }
  isAutoPlaying = true;
  const newSrc = stationItems[currentIndex].dataset.value;
  if (audio.src !== newSrc) {
    audio.src = newSrc;
    audio.load();
  }
  const lastTime = parseFloat(localStorage.getItem(`lastTime_${currentTab}_${currentIndex}`)) || 0;
  audio.currentTime = lastTime;
  const playPromise = audio.play();

  playPromise
    .then(() => {
      retryCount = 0;
      retryStartTime = null;
      isAutoPlaying = false;
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      clearRetryTimer();
    })
    .catch(error => {
      console.error("Помилка відтворення:", error);
      isAutoPlaying = false;
      handlePlaybackError();
    });
}

// Обробка помилок відтворення
function handlePlaybackError() {
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  if (!retryStartTime) retryStartTime = Date.now();
  const elapsedTime = Date.now() - retryStartTime;

  if (retryCount === 0) {
    const notification = document.createElement("div");
    notification.textContent = "Втрачено з'єднання, намагаємося відновити...";
    notification.style.cssText = "position: fixed; top: 10px; right: 10px; padding: 10px; background: #ff4444; color: #fff; border-radius: 5px; z-index: 1000;";
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  if (elapsedTime < FAST_RETRY_DURATION && retryCount < MAX_RETRIES) {
    retryCount++;
    setTimeout(() => {
      tryAutoPlay();
    }, FAST_RETRY_INTERVAL);
  } else {
    retryCount = 0;
    startRetryTimer();
  }
}

// Перемикання вкладок
function switchTab(tab) {
  if (!["techno", "trance", "ukraine", "best"].includes(tab)) tab = "techno";
  currentTab = tab;
  localStorage.setItem("currentTab", tab);
  const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
  const maxIndex = tab === "best" ? favoriteStations.length : stationLists[tab]?.length || 0;
  currentIndex = savedIndex < maxIndex ? savedIndex : 0;
  updateStationList();
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`);
  if (activeBtn) activeBtn.classList.add("active");
  if (stationItems?.length && currentIndex < stationItems.length) tryAutoPlay();
}

// Оновлення списку станцій
function updateStationList() {
  stationList.innerHTML = "";
  let stations = currentTab === "best"
    ? favoriteStations
        .map(name => Object.values(stationLists).flat().find(s => s.name === name))
        .filter(s => s)
    : stationLists[currentTab] || [];

  if (!stations.length) {
    currentIndex = 0;
    stationItems = [];
    if (currentTab === "best") {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "station-item empty";
      emptyMessage.textContent = "Немає улюблених станцій";
      stationList.appendChild(emptyMessage);
    }
    return;
  }

  const favoriteList = currentTab === "best"
    ? stations
    : stations.filter(station => favoriteStations.includes(station.name));
  const nonFavoriteList = currentTab === "best" ? [] : stations.filter(station => !favoriteStations.includes(station.name));
  const sortedStations = [...favoriteList, ...nonFavoriteList];

  sortedStations.forEach((station, index) => {
    const item = document.createElement("div");
    item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
    item.dataset.value = station.value;
    item.dataset.name = station.name;
    item.dataset.genre = station.genre;
    item.dataset.country = station.country;
    item.innerHTML = `${station.emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">★</button>`;
    stationList.appendChild(item);
  });

  stationItems = stationList.querySelectorAll(".station-item");

  if (stationItems.length && currentIndex < stationItems.length) {
    changeStation(currentIndex);
  }
}

// Дебонсинг для обробки кліків
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

stationList.onclick = debounce(e => {
  const item = e.target.closest(".station-item");
  const favoriteBtn = e.target.closest(".favorite-btn");
  if (item && !item.classList.contains("empty")) {
    currentIndex = Array.from(stationItems).indexOf(item);
    changeStation(currentIndex);
  }
  if (favoriteBtn) {
    toggleFavorite(favoriteBtn.parentElement.dataset.name);
  }
}, 200);

// Перемикання улюблених станцій
function toggleFavorite(stationName) {
  if (favoriteStations.includes(stationName)) {
    favoriteStations = favoriteStations.filter(name => name !== stationName);
  } else {
    favoriteStations.unshift(stationName);
  }
  localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
  if (currentTab === "best") switchTab("best");
  else updateStationList();
}

// Зміна станції
function changeStation(index) {
  if (index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
  retryCount = 0;
  retryStartTime = null;
  clearRetryTimer();
  const item = stationItems[index];
  stationItems.forEach(i => i.classList.remove("selected"));
  item.classList.add("selected");
  currentIndex = index;
  audio.src = item.dataset.value;
  updateCurrentStationInfo(item);
  localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
  tryAutoPlay();
}

// Оновлення інформації про станцію
function updateCurrentStationInfo(item) {
  currentStationInfo.querySelector(".station-name").textContent = item.dataset.name || "Немає даних";
  currentStationInfo.querySelector(".station-genre").textContent = `жанр: ${item.dataset.genre || "-"}`;
  currentStationInfo.querySelector(".station-country").textContent = `країна: ${item.dataset.country || "-"}`;
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.dataset.name || "Невідома станція",
      artist: `${item.dataset.genre || "-"} | ${item.dataset.country || "-"}`,
      album: "Radio Music",
      artwork: [
        { src: "icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "icon-512.png", sizes: "512x512", type: "image/png" }
      ]
    });
  }
}

// Керування відтворенням
function prevStation() {
  currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
  if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
  changeStation(currentIndex);
}

function nextStation() {
  currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
  if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
  changeStation(currentIndex);
}

function togglePlayPause() {
  const playIcon = playPauseBtn.querySelector(".play-icon");
  const pauseIcon = playPauseBtn.querySelector(".pause-icon");
  if (audio.paused) {
    isPlaying = true;
    tryAutoPlay();
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
  } else {
    audio.pause();
    isPlaying = false;
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    clearRetryTimer();
  }
  localStorage.setItem("isPlaying", isPlaying);
}

// Обробники подій
document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") prevStation();
  if (e.key === "ArrowRight") nextStation();
  if (e.key === " ") {
    e.preventDefault();
    togglePlayPause();
  }
});

audio.addEventListener("playing", () => {
  isPlaying = true;
  playPauseBtn.querySelector(".play-icon").style.display = "none";
  playPauseBtn.querySelector(".pause-icon").style.display = "block";
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
  localStorage.setItem("isPlaying", isPlaying);
  clearRetryTimer();
});

audio.addEventListener("pause", () => {
  isPlaying = false;
  playPauseBtn.querySelector(".play-icon").style.display = "block";
  playPauseBtn.querySelector(".pause-icon").style.display = "none";
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  localStorage.setItem("isPlaying", isPlaying);
  startRetryTimer();
});

audio.addEventListener("error", () => handlePlaybackError());
audio.addEventListener("ended", () => handlePlaybackError());

audio.addEventListener("timeupdate", () => {
  if (isPlaying) {
    localStorage.setItem(`lastTime_${currentTab}_${currentIndex}`, audio.currentTime);
  }
});

audio.addEventListener("volumechange", () => {
  localStorage.setItem("volume", audio.volume);
});

// Моніторинг мережі
window.addEventListener("online", () => {
  console.log("Мережа відновлена (window.online)");
  if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
    retryCount = 0;
    retryStartTime = null;
    tryAutoPlay();
  }
});

window.addEventListener("offline", () => {
  console.log("Втрачено з'єднання з мережею");
  clearRetryTimer();
});

// Обробка зміни видимості
document.addEventListener("visibilitychange", () => {
  if (document.hidden && isPlaying && navigator.onLine) {
    if (!audio.paused) {
      console.log("Аудіо відтворюється у фоновому режимі, пропускаємо startRetryTimer");
      return;
    }
    startRetryTimer();
  } else if (!document.hidden && isPlaying && navigator.onLine) {
    if (!audio.paused) {
      console.log("Аудіо вже відтворюється, пропускаємо tryAutoPlay");
      return;
    }
    retryCount = 0;
    retryStartTime = null;
    tryAutoPlay();
  }
});

// Обробка переривань (наприклад, дзвінки)
document.addEventListener("resume", () => {
  if (isPlaying && navigator.connection?.type !== "none") {
    if (!audio.paused) {
      console.log("Аудіо вже відтворюється після resume, пропускаємо tryAutoPlay");
      return;
    }
    retryCount = 0;
    retryStartTime = null;
    tryAutoPlay();
  }
});

// Обробка змін аудіопристроїв
navigator.mediaDevices.addEventListener("devicechange", async () => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioDevices = devices.filter(device => device.kind === "audiooutput");
  console.log("Зміна аудіопристроїв:", audioDevices);
  if (isPlaying && audio.paused && navigator.onLine) {
    retryCount = 0;
    retryStartTime = null;
    tryAutoPlay();
  }
});

// Media Session API
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", togglePlayPause);
  navigator.mediaSession.setActionHandler("pause", togglePlayPause);
  navigator.mediaSession.setActionHandler("previoustrack", prevStation);
  navigator.mediaSession.setActionHandler("nexttrack", nextStation);
  navigator.mediaSession.setActionHandler("seekforward", () => {
    audio.currentTime = Math.min(audio.currentTime + 10, audio.duration || Infinity);
  });
  navigator.mediaSession.setActionHandler("seekbackward", () => {
    audio.currentTime = Math.max(audio.currentTime - 10, 0);
  });
}

// Ініціалізація
applyTheme(currentTheme);
loadStations();

// Автовідтворення при завантаженні сторінки
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (isPlaying && stationItems?.length && currentIndex < stationItems.length && !stationItems[currentIndex].classList.contains("empty")) {
      tryAutoPlay();
    }
    if (isPlaying && navigator.onLine && audio.paused) {
      startRetryTimer();
    }
  }, 0);
});