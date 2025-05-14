const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("currentStationInfo");
const volumeControl = document.getElementById("volumeControl");
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let currentTab = localStorage.getItem("currentTab") || "techno";
let isPlaying = localStorage.getItem("isPlaying") === "true";
let stationLists = {};
let stationItems;

// Завантаження станцій із JSON
fetch('stations.json')
  .then(response => response.json())
  .then(data => {
    stationLists = data;
    // Завантажуємо останню станцію для поточної вкладки
    currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
    switchTab(currentTab);
    // Автовідтворення останньої станції при запуску
    if (isPlaying) {
      tryPlayAudio(0);
    }
  })
  .catch(error => console.error("Помилка завантаження станцій:", error));

// Теми
const themes = {
  dark: { bodyBg: "#121212", containerBg: "#1e1e1e", accent: "#00C4FF", text: "#fff" },
  light: { bodyBg: "#f0f0f0", containerBg: "#fff", accent: "#007BFF", text: "#000" },
  neon: { bodyBg: "#0a0a1a", containerBg: "#1a1a2e", accent: "#00ffcc", text: "#fff" },
  "black-white": { bodyBg: "#000000", containerBg: "#000000", accent: "#ffffff", text: "#ffffff" }
};
let currentTheme = localStorage.getItem("selectedTheme") || "dark";

// Налаштування Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then((registration) => {
    setInterval(() => {
      registration.update();
    }, 5 * 60 * 1000); // Перевірка оновлень кожні 5 хвилин

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          if (confirm('Доступна нова версія радіо. Оновити?')) {
            window.location.reload();
          }
        }
      });
    });
  });
}

function applyTheme(theme) {
  document.body.style.background = themes[theme].bodyBg;
  document.querySelector(".container").style.background = themes[theme].containerBg;
  document.querySelector("h1").style.color = themes[theme].accent;
  document.querySelectorAll(".station-list, .control-btn, .theme-toggle, .current-station-info, .tab-btn").forEach(el => {
    el.style.background = themes[theme].containerBg;
    el.style.borderColor = themes[theme].accent;
    el.style.color = themes[theme].text;
  });
  document.querySelectorAll(".station-item").forEach(el => {
    el.style.background = themes[theme].bodyBg;
    el.style.borderColor = themes[theme].text;
    el.style.color = themes[theme].text;
  });
  document.querySelectorAll(".station-item:hover, .station-item.selected").forEach(el => {
    el.style.background = themes[theme].accent;
    el.style.borderColor = themes[theme].accent;
    el.style.color = themes[theme].bodyBg;
  });
  document.querySelector(".controls-container").style.background = themes[theme].containerBg;
  document.querySelector(".controls-container").style.borderColor = themes[theme].accent;
  document.querySelector(".volume-slider input").style.background = themes[theme].accent;
  document.querySelectorAll(".wave-bar").forEach(bar => {
    bar.style.background = themes[theme].accent;
  });
  document.querySelector(".station-list::-webkit-scrollbar-thumb").style.background = themes[theme].accent;
  currentTheme = theme;
  localStorage.setItem("selectedTheme", theme);
}

function toggleTheme() {
  const themesOrder = ["dark", "light", "neon", "black-white"];
  const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % 4];
  applyTheme(nextTheme);
}

function switchTab(tab) {
  if (!["techno", "trance", "ukraine"].includes(tab)) tab = "techno";
  currentTab = tab;
  localStorage.setItem("currentTab", tab);
  // Завантажуємо останню станцію для нової вкладки
  currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
  updateStationList();
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`).classList.add("active");
  changeStation(currentIndex);
}

function updateStationList() {
  const stations = stationLists[currentTab];
  stationList.innerHTML = '';

  const favoriteList = favoriteStations
    .map(name => stations.find(station => station.name === name))
    .filter(station => station);
  const nonFavoriteList = stations.filter(station => !favoriteStations.includes(station.name));

  const sortedStations = [...favoriteList, ...nonFavoriteList];

  sortedStations.forEach((station, index) => {
    const item = document.createElement("div");
    item.className = `station-item ${index === currentIndex ? 'selected' : ''}`;
    item.dataset.value = station.value;
    item.dataset.name = station.name;
    item.dataset.genre = station.genre;
    item.dataset.country = station.country;
    item.innerHTML = `${station.emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? ' favorited' : ''}">★</button>`;
    item.addEventListener("click", () => changeStation(index));
    item.querySelector(".favorite-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(station.name);
    });
    stationList.appendChild(item);
  });

  stationItems = stationList.querySelectorAll(".station-item");
}

function toggleFavorite(stationName) {
  if (favoriteStations.includes(stationName)) {
    favoriteStations = favoriteStations.filter(name => name !== stationName);
  } else {
    favoriteStations.unshift(stationName);
  }
  localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
  updateStationList();
}

function changeStation(index) {
  stationItems.forEach(item => item.classList.remove("selected"));
  stationItems[index].classList.add("selected");
  currentIndex = index;
  audio.src = stationItems[index].dataset.value;
  updateCurrentStationInfo(stationItems[index]);
  if (audio.paused) {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  } else {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
  }
  if (isPlaying) {
    tryPlayAudio(0);
  }
  localStorage.setItem(`lastStation_${currentTab}`, index);
}

function updateCurrentStationInfo(item) {
  currentStationInfo.querySelector(".station-name").textContent = item.dataset.name;
  currentStationInfo.querySelector(".station-genre").textContent = `жанр: ${item.dataset.genre}`;
  currentStationInfo.querySelector(".station-country").textContent = `країна: ${item.dataset.country}`;
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.dataset.name,
      artist: `${item.dataset.genre} | ${item.dataset.country}`,
      album: 'Радіо Музика'
    });
  }
}

function prevStation() {
  currentIndex = (currentIndex > 0) ? currentIndex - 1 : stationItems.length - 1;
  changeStation(currentIndex);
}

function nextStation() {
  currentIndex = (currentIndex < stationItems.length - 1) ? currentIndex + 1 : 0;
  changeStation(currentIndex);
}

async function tryPlayAudio(attempt) {
  const maxAttempts = 3;
  if (attempt >= maxAttempts) {
    console.error("Не вдалося відтворити після 3 спроб");
    return;
  }
  try {
    await audio.play();
    playPauseBtn.textContent = "⏸";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
    isPlaying = true;
    localStorage.setItem("isPlaying", isPlaying);
  } catch (error) {
    console.error(`Помилка відтворення, спроба ${attempt + 1}:`, error);
    setTimeout(() => tryPlayAudio(attempt + 1), 2000);
  }
}

function togglePlayPause() {
  if (audio.paused) {
    tryPlayAudio(0);
  } else {
    audio.pause();
    playPauseBtn.textContent = "▶";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    isPlaying = false;
    localStorage.setItem("isPlaying", isPlaying);
  }
}

function toggleVolumeSlider() {
  const slider = document.getElementById("volumeSlider");
  slider.style.display = slider.style.display === "none" ? "block" : "none";
}

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") prevStation();
  if (e.key === "ArrowRight") nextStation();
  if (e.key === " ") {
    e.preventDefault();
    togglePlayPause();
  }
});

function handleBluetoothConnection() {
  if (navigator.bluetooth && !audio.paused) {
    tryPlayAudio(0);
  }
}

navigator.mediaSession.setActionHandler("previoustrack", () => prevStation());
navigator.mediaSession.setActionHandler("nexttrack", () => nextStation());
navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());

applyTheme(currentTheme);
window.addEventListener("blur", () => {
  if (document.hidden) localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
});
window.addEventListener("visibilitychange", () => {
  if (!document.hidden && navigator.bluetooth) handleBluetoothConnection();
});

audio.addEventListener("playing", () => {
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
audio.addEventListener("error", () => console.error("Помилка трансляції"));
audio.volume = 0.5;

volumeControl.addEventListener("input", () => {
  audio.volume = volumeControl.value / 100;
});