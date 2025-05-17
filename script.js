const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("current-stationInfo");
const stationStatus = currentStationInfo.querySelector(".station-status");
let currentIndex = parseInt(localStorage.getItem("lastStation")) || 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let currentTab = localStorage.getItem("currentTab") || "techno";
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {};
let stationItems = [];
let hasUserInteraction = false;
const maxAttempts = 3;
let currentAttempts = 0;

// Ініціалізація після взаємодії
document.addEventListener('click', enableAudio, { once: true });
document.addEventListener('touchstart', enableAudio, { once: true });

function enableAudio() {
  hasUserInteraction = true;
  tryAutoPlay();
}

// Очищення невалідного localStorage
function clearInvalidStorage() {
  const tabs = ["techno", "trance", "ukraine", "best"];
  tabs.forEach(tab => {
    const lastStationKey = `lastStation_${tab}`;
    const lastIndex = parseInt(localStorage.getItem(lastStationKey)) || 0;
    const stations = tab === "best" ? getFavoriteStations() : stationLists[tab] || [];
    if (lastIndex >= stations.length || lastIndex < 0) {
      localStorage.removeItem(lastStationKey);
    }
  });
}

// Завантаження станцій
async function loadStations() {
  try {
    const response = await fetch('stations.json');
    if (!response.ok) throw new Error('Не вдалося завантажити станції');
    stationLists = await response.json();
    const availableTabs = Object.keys(stationLists);
    if (!availableTabs.includes(currentTab)) {
      currentTab = availableTabs[0] || "techno";
      localStorage.setItem("currentTab", currentTab);
    }
    clearInvalidStorage();
    switchTab(currentTab);
    tryAutoPlay();
  } catch (error) {
    console.error("Помилка завантаження:", error);
    if ('caches' in window) {
      const cacheResponse = await caches.match('stations.json');
      if (cacheResponse) {
        stationLists = await cacheResponse.json();
        const availableTabs = Object.keys(stationLists);
        if (!availableTabs.includes(currentTab)) {
          currentTab = availableTabs[0] || "techno";
          localStorage.setItem("currentTab", currentTab);
        }
        clearInvalidStorage();
        switchTab(currentTab);
        tryAutoPlay();
      } else {
        showStatus("Помилка завантаження станцій", true);
      }
    } else {
      showStatus("Помилка завантаження станцій", true);
    }
  }
}

loadStations();

// Теми
const themes = {
  dark: { bodyBg: "#0d0d0d", containerBg: "#1a1a1a", accent: "#00b4d8", text: "#f0f0f0", hover: "#48cae4" },
  light: { bodyBg: "#f5f5f5", containerBg: "#ffffff", accent: "#0077b6", text: "#1a1a1a", hover: "#0096c7" },
  neon: { bodyBg: "#1a0033", containerBg: "#2b0057", accent: "#ff2e63", text: "#e0b1cb", hover: "#ff7096" }
};
let currentTheme = localStorage.getItem("theme") || "dark";

// Реєстрація Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(registration => {
    registration.update();
  }).catch(error => console.error("Помилка реєстрації SW:", error));
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty('--body-bg', themes[theme].bodyBg);
  root.style.setProperty('--container-bg', themes[theme].containerBg);
  root.style.setProperty('--accent-color', themes[theme].accent);
  root.style.setProperty('--text-color', themes[theme].text);
  root.style.setProperty('--hover-color', themes[theme].hover);
  currentTheme = theme;
  localStorage.setItem("theme", theme);
}

function toggleTheme() {
  const themeOrder = ["dark", "light", "neon"];
  const nextTheme = themeOrder[(themeOrder.indexOf(currentTheme) + 1) % themeOrder.length];
  applyTheme(nextTheme);
}

document.querySelector(".theme-toggle").addEventListener("click", toggleTheme);

// Улюблені станції
function getFavoriteStations() {
  const allStations = [
    ...(stationLists.techno || []),
    ...(stationLists.trance || []),
    ...(stationLists.ukraine || [])
  ];
  return favoriteStations
    .map(name => allStations.find(station => station.name === name))
    .filter(station => station);
}

function switchTab(tab) {
  if (!["techno", "trance", "ukraine", "best"].includes(tab)) tab = "techno";
  currentTab = tab;
  localStorage.setItem("currentTab", tab);
  const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
  currentIndex = savedIndex < (tab === "best" ? getFavoriteStations().length : stationLists[tab]?.length || 0) ? savedIndex : 0;
  updateStationList();
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`)?.classList.add("active");
  tryAutoPlay();
}

function updateStationList() {
  stationList.innerHTML = '';
  const stations = currentTab === "best" ? getFavoriteStations() : stationLists[currentTab] || [];
  if (stations.length === 0) {
    stationList.innerHTML = `<div class="empty-message">${currentTab === "best" ? "Додайте улюблені станції" : "Станції відсутні"}</div>`;
    return;
  }

  const favoriteList = favoriteStations
    .map(name => stations.find(station => station.name === name))
    .filter(station => station);
  const nonFavoriteList = stations.filter(station => !favoriteStations.includes(station.name));
  const sortedStations = currentTab === "best" ? stations : [...favoriteList, ...nonFavoriteList];

  sortedStations.forEach((station, index) => {
    const item = document.createElement("div");
    item.className = `station-item ${index === currentIndex ? 'selected' : ''}`;
    item.dataset.value = station.value;
    item.dataset.name = station.name;
    item.dataset.genre = station.genre;
    item.dataset.country = station.country;
    item.innerHTML = `
      <span>${station.emoji} ${station.name}</span>
      <button class="favorite-btn ${favoriteStations.includes(station.name) ? 'favorited' : ''}" aria-label="Додати до улюблених">★</button>
    `;
    stationList.appendChild(item);
  });

  stationItems = stationList.querySelectorAll(".station-item");
  stationList.onclick = (e) => {
    const item = e.target.closest('.station-item');
    const favoriteBtn = e.target.closest('.favorite-btn');
    if (item) {
      const index = Array.from(stationItems).indexOf(item);
      changeStation(index);
    }
    if (favoriteBtn) {
      const stationName = favoriteBtn.parentElement.dataset.name;
      toggleFavorite(stationName);
    }
  };

  if (stationItems.length > 0 && currentIndex < stationItems.length) {
    changeStation(currentIndex);
  }
}

function toggleFavorite(stationName) {
  favoriteStations = favoriteStations.includes(stationName)
    ? favoriteStations.filter(name => name !== stationName)
    : [...favoriteStations, stationName];
  localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
  updateStationList();
}

function showStatus(message, isError = false) {
  stationStatus.textContent = message;
  stationStatus.style.display = message ? "block" : "none";
  stationStatus.style.color = isError ? "#ff4d4d" : "var(--accent-color)";
  if (message) {
    setTimeout(() => {
      stationStatus.style.display = "none";
    }, 5000);
  }
}

function changeStation(index) {
  if (index < 0 || index >= stationItems.length) return;
  currentAttempts = 0;
  const item = stationItems[index];
  stationItems.forEach(item => item.classList.remove("selected"));
  item.classList.add("selected");
  currentIndex = index;
  audio.src = item.dataset.value;
  updateCurrentStationInfo(item);
  showStatus("Завантаження...");
  if (isPlaying && hasUserInteraction) {
    tryAutoPlay();
  }
  localStorage.setItem("isPlaying", isPlaying);
  localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
}

function updateCurrentStationInfo(item) {
  currentStationInfo.querySelector(".station-name").textContent = item.dataset.name || "Немає даних";
  currentStationInfo.querySelector(".station-genre").textContent = `жанр: ${item.dataset.genre || '-'}`;
  currentStationInfo.querySelector(".station-country").textContent = `країна: ${item.dataset.country || '-'}`;
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.dataset.name || "Невідома станція",
      artist: `${item.dataset.genre || '-'} | ${item.dataset.country || '-'}`,
      album: 'RadioVibe'
    });
  }
}

function tryAutoPlay() {
  if (!hasUserInteraction || !isPlaying || !stationItems.length || currentIndex >= stationItems.length) return;
  const timeout = setTimeout(() => {
    if (audio.paused) {
      showStatus("Станція недоступна, перемикаємо...", true);
      nextStation();
    }
  }, 8000);
  audio.play().then(() => {
    clearTimeout(timeout);
    showStatus("");
    playPauseBtn.textContent = "⏸";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
    isPlaying = true;
    localStorage.setItem("isPlaying", isPlaying);
  }).catch(error => {
    clearTimeout(timeout);
    console.error("Помилка відтворення:", error);
    if (++currentAttempts < maxAttempts) {
      showStatus(`Спроба ${currentAttempts + 1} підключення...`);
      setTimeout(tryAutoPlay, 1000);
    } else {
      showStatus("Станція недоступна, перемикаємо...", true);
      nextStation();
    }
  });
}

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
    if (hasUserInteraction) {
      tryAutoPlay();
    }
  } else {
    audio.pause();
    playPauseBtn.textContent = "▶";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    isPlaying = false;
    localStorage.setItem("isPlaying", isPlaying);
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") prevStation();
  if (e.key === "ArrowRight") nextStation();
  if (e.key === " ") {
    e.preventDefault();
    togglePlayPause();
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isPlaying && hasUserInteraction) {
    setTimeout(tryAutoPlay, 1500);
  }
});

window.addEventListener("online", () => {
  if (isPlaying && hasUserInteraction) {
    setTimeout(tryAutoPlay, 1500);
  }
});

window.addEventListener("offline", () => {
  showStatus("Офлайн, використовуємо кеш");
});

audio.addEventListener("error", () => {
  console.error("Помилка трансляції");
  if (++currentAttempts < maxAttempts) {
    showStatus(`Спроба ${currentAttempts + 1} підключення...`);
    setTimeout(tryAutoPlay, 1000);
  } else {
    showStatus("Станція недоступна, перемикаємо...", true);
    nextStation();
  }
});

audio.addEventListener("ended", () => {
  console.log("Потік завершено");
  setTimeout(tryAutoPlay, 1500);
});

audio.addEventListener("playing", () => {
  showStatus("");
  playPauseBtn.textContent = "⏸";
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
  isPlaying = true;
  localStorage.setItem("isPlaying", isPlaying);
});

audio.addEventListener("pause", () => {
  playPauseBtn.textContent = "▶";
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  isPlaying = false;
  localStorage.setItem("isPlaying", isPlaying);
});

navigator.mediaSession.setActionHandler("previoustrack", () => prevStation());
navigator.mediaSession.setActionHandler("nexttrack", () => nextStation());
navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());

applyTheme(currentTheme);
audio.volume = 0.5;