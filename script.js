const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("currentStationInfo");
const statusMessage = document.getElementById("statusMessage");
let currentIndex = parseInt(localStorage.getItem("lastStation_techno")) || 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let currentTab = localStorage.getItem("currentTab") || "techno";
let isPlaying = localStorage.getItem("isPlaying") === "true";
let stationLists = {};
let stationItems = [];
let hasUserInteraction = false;
let retryCount = 0;
const MAX_RETRIES = 3;
const LOAD_TIMEOUT = 8000;

// Налаштування аудіо
audio.preload = "auto";
audio.volume = parseFloat(localStorage.getItem("volume")) || 0.5;

// Виявлення взаємодії користувача
const enableInteraction = () => {
  hasUserInteraction = true;
  tryAutoPlay();
};
document.addEventListener("click", enableInteraction, { once: true });
document.addEventListener("touchstart", enableInteraction, { once: true });

// Завантаження станцій
async function loadStations() {
  try {
    statusMessage.textContent = "Завантаження станцій...";
    statusMessage.style.display = "block";
    const response = await fetch("stations.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    stationLists = await response.json();
    switchTab(currentTab);
    statusMessage.style.display = "none";
    tryAutoPlay();
  } catch (error) {
    console.error("Помилка завантаження станцій:", error);
    if (caches) {
      const cacheResponse = await caches.match("stations.json");
      if (cacheResponse) {
        stationLists = await cacheResponse.json();
        switchTab(currentTab);
        statusMessage.style.display = "none";
        tryAutoPlay();
        return;
      }
    }
    statusMessage.textContent = "Не вдалося завантажити станції. Спробуйте пізніше.";
  }
}

// Керування темами
const themes = {
  dark: { bodyBg: "#121212", containerBg: "#1e1e1e", accent: "#00C4FF", text: "#fff" },
  light: { bodyBg: "#f5f5f5", containerBg: "#ffffff", accent: "#007BFF", text: "#333" },
  neon: { bodyBg: "#0a0a1a", containerBg: "#1a1a2e", accent: "#ff00ff", text: "#fff" }
};
let currentTheme = localStorage.getItem("selectedTheme") || "dark";

function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty("--body-bg", themes[theme].bodyBg);
  root.style.setProperty("--container-bg", themes[theme].containerBg);
  root.style.setProperty("--accent", themes[theme].accent);
  root.style.setProperty("--text", themes[theme].text);
  localStorage.setItem("selectedTheme", theme);
  currentTheme = theme;
}

function toggleTheme() {
  const themeOrder = ["dark", "light", "neon"];
  const nextTheme = themeOrder[(themeOrder.indexOf(currentTheme) + 1) % 3];
  applyTheme(nextTheme);
}

// Реєстрація Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(registration => {
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          statusMessage.textContent = "Доступна нова версія. Оновити?";
          statusMessage.style.display = "block";
          statusMessage.onclick = () => location.reload();
        }
      });
    });
  });
}

// Перемикання вкладок
function switchTab(tab) {
  if (!["techno", "trance", "ukraine", "best"].includes(tab)) tab = "techno";
  currentTab = tab;
  localStorage.setItem("currentTab", tab);
  currentIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
  updateStationList();
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`).classList.add("active");
  tryAutoPlay();
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
    stationList.innerHTML = `<div style="color: #ff4444; padding: 10px;">${
      currentTab === "best" ? "Додайте улюблені станції!" : "Немає станцій."
    }</div>`;
    return;
  }

  const sortedStations = currentTab === "best"
    ? stations
    : [
        ...stations.filter(s => favoriteStations.includes(s.name)),
        ...stations.filter(s => !favoriteStations.includes(s.name))
      ];

  sortedStations.forEach((station, index) => {
    const item = document.createElement("div");
    item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
    item.dataset.value = station.value;
    item.dataset.name = station.name;
    item.dataset.genre = station.genre;
    item.dataset.country = station.country;
    item.innerHTML = `
      ${station.emoji} ${station.name}
      <button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">★</button>
    `;
    stationList.appendChild(item);
  });

  stationItems = stationList.querySelectorAll(".station-item");
  stationList.onclick = e => {
    const item = e.target.closest(".station-item");
    const favoriteBtn = e.target.closest(".favorite-btn");
    if (item) {
      currentIndex = Array.from(stationItems).indexOf(item);
      changeStation(currentIndex);
    }
    if (favoriteBtn) {
      toggleFavorite(favoriteBtn.parentElement.dataset.name);
    }
  };

  if (stationItems.length && currentIndex < stationItems.length) {
    changeStation(currentIndex);
  }
}

// Перемикання улюблених станцій
function toggleFavorite(stationName) {
  favoriteStations = favoriteStations.includes(stationName)
    ? favoriteStations.filter(name => name !== stationName)
    : [stationName, ...favoriteStations];
  localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
  if (currentTab === "best") switchTab("best");
  else updateStationList();
}

// Зміна станції
function changeStation(index) {
  if (index < 0 || index >= stationItems.length) return;
  retryCount = 0;
  const item = stationItems[index];
  stationItems.forEach(i => i.classList.remove("selected"));
  item.classList.add("selected");
  currentIndex = index;
  audio.src = item.dataset.value;
  updateCurrentStationInfo(item);
  localStorage.setItem(`lastStation_${currentTab}`, index);
  statusMessage.textContent = "Підключення...";
  statusMessage.style.display = "block";
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
      album: "Radio Vibe"
    });
  }
}

// Автовідтворення
function tryAutoPlay() {
  if (!isPlaying || !hasUserInteraction || !stationItems.length || currentIndex >= stationItems.length) return;
  const playPromise = audio.play();
  const timeout = setTimeout(() => {
    if (audio.paused) handlePlaybackError();
  }, LOAD_TIMEOUT);

  playPromise
    .then(() => {
      clearTimeout(timeout);
      statusMessage.style.display = "none";
      retryCount = 0;
    })
    .catch(() => {
      clearTimeout(timeout);
      handlePlaybackError();
    });
}

// Обробка помилок відтворення
function handlePlaybackError() {
  if (retryCount >= MAX_RETRIES) {
    statusMessage.textContent = `Станція недоступна. Виберіть іншу.`;
    statusMessage.style.display = "block";
    nextStation();
    return;
  }
  retryCount++;
  statusMessage.textContent = `Спроба ${retryCount}/${MAX_RETRIES}...`;
  setTimeout(tryAutoPlay, 2000);
}

// Керування відтворенням
function prevStation() {
  currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
  changeStation(currentIndex);
}

function nextStation() {
  currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
  changeStation(currentIndex);
}

function togglePlayPause() {
  if (audio.paused) {
    isPlaying = true;
    tryAutoPlay();
    playPauseBtn.textContent = "⏸";
  } else {
    audio.pause();
    isPlaying = false;
    playPauseBtn.textContent = "▶";
    statusMessage.style.display = "none";
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
  playPauseBtn.textContent = "⏸";
  document.querySelectorAll(".wave-bar").forEach(bar => (bar.style.animationPlayState = "running"));
  localStorage.setItem("isPlaying", isPlaying);
});

audio.addEventListener("pause", () => {
  isPlaying = false;
  playPauseBtn.textContent = "▶";
  document.querySelectorAll(".wave-bar").forEach(bar => (bar.style.animationPlayState = "paused"));
  localStorage.setItem("isPlaying", isPlaying);
});

audio.addEventListener("error", () => handlePlaybackError());
audio.addEventListener("ended", () => handlePlaybackError());

audio.addEventListener("volumechange", () => {
  localStorage.setItem("volume", audio.volume);
});

// Моніторинг мережі
window.addEventListener("online", () => {
  statusMessage.textContent = "Мережа відновлена. Підключення...";
  statusMessage.style.display = "block";
  tryAutoPlay();
});

window.addEventListener("offline", () => {
  statusMessage.textContent = "Немає мережі. Використовується кеш.";
  statusMessage.style.display = "block";
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isPlaying) {
    setTimeout(tryAutoPlay, 1500);
  }
});

// Media Session API
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", togglePlayPause);
  navigator.mediaSession.setActionHandler("pause", togglePlayPause);
  navigator.mediaSession.setActionHandler("previoustrack", prevStation);
  navigator.mediaSession.setActionHandler("nexttrack", nextStation);
}

// Очищення localStorage
function cleanLocalStorage() {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith("lastStation_") && !["techno", "trance", "ukraine", "best"].includes(key.replace("lastStation_", ""))) {
      localStorage.removeItem(key);
    }
  });
}

// Ініціалізація
cleanLocalStorage();
applyTheme(currentTheme);
loadStations();