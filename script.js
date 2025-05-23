const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".control-btn:nth-child(2)");
const currentStationInfo = document.querySelector(".current-station-info");
const stationSearch = document.getElementById("stationSearch");
const volumeSlider = document.getElementById("volumeSlider");
let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true";
let stationLists = {};
let stationItems = [];
let isAutoPlaying = false;

// Themes with genre-based background effects
const themes = {
  dark: { bodyBg: "#121212", containerBg: "#1e1e2f", accent: "#ff4081", text: "#e0e0e0" },
  light: { bodyBg: "#f5f5f5", containerBg: "#ffffff", accent: "#3f51b5", text: "#212121" },
  neon: { bodyBg: "#0a0a1a", containerBg: "#1a1a2e", accent: "#00e676", text: "#e8e8e8" }
};
let currentTheme = localStorage.getItem("selectedTheme") || "dark";

function applyTheme(theme) {
  const root = document.documentElement;
  Object.keys(themes[theme]).forEach(key => {
    root.style.setProperty(`--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, themes[theme][key]);
  });
  localStorage.setItem("selectedTheme", theme);
  currentTheme = theme;
}

function toggleTheme() {
  const themeKeys = Object.keys(themes);
  const nextTheme = themeKeys[(themeKeys.indexOf(currentTheme) + 1) % themeKeys.length];
  applyTheme(nextTheme);
}

// Load stations
async function loadStations() {
  try {
    const response = await fetch("stations.json", { cache: "no-cache" });
    if (!response.ok) throw new Error("Failed to fetch stations");
    stationLists = await response.json();
    switchTab(currentTab);
  } catch (error) {
    console.error("Error loading stations:", error);
    if ("caches" in window) {
      const cacheResponse = await caches.match("stations.json");
      if (cacheResponse) {
        stationLists = await cacheResponse.json();
        switchTab(currentTab);
      }
    }
  }
}

// Update background based on genre
function updateBackground(genre) {
  const background = document.querySelector(".background-effect");
  const genreColors = {
    "Techno": "rgba(255, 64, 129, 0.2)",
    "Trance": "rgba(64, 196, 255, 0.2)",
    "Pop": "rgba(255, 193, 7, 0.2)",
    "Rock": "rgba(233, 30, 99, 0.2)",
    "Jazz": "rgba(156, 39, 176, 0.2)",
    default: "rgba(255, 64, 129, 0.2)"
  };
  background.style.background = `radial-gradient(circle, ${genreColors[genre] || genreColors.default}, transparent)`;
}

// Station search
stationSearch.addEventListener("input", () => {
  const query = stationSearch.value.toLowerCase();
  updateStationList(query);
});

// Switch tabs
function switchTab(tab) {
  currentTab = tab;
  localStorage.setItem("currentTab", tab);
  currentIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
  updateStationList();
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`).classList.add("active");
  if (stationItems.length) changeStation(currentIndex);
}

// Update station list
function updateStationList(query = "") {
  stationList.innerHTML = "";
  let stations = currentTab === "best"
    ? favoriteStations.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(Boolean)
    : stationLists[currentTab] || [];

  if (query) {
    stations = stations.filter(s => 
      s.name.toLowerCase().includes(query) || 
      s.genre.toLowerCase().includes(query) || 
      s.country.toLowerCase().includes(query)
    );
  }

  if (!stations.length) {
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "station-item empty";
    emptyMessage.textContent = currentTab === "best" ? "No favorite stations" : "No stations found";
    stationList.appendChild(emptyMessage);
    stationItems = [];
    return;
  }

  stations.forEach((station, index) => {
    const item = document.createElement("div");
    item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
    item.dataset.value = station.value;
    item.dataset.name = station.name;
    item.dataset.genre = station.genre;
    item.dataset.country = station.country;
    item.innerHTML = `${station.emoji} ${station.name} <button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">⭐</button>`;
    stationList.appendChild(item);
  });

  stationItems = stationList.querySelectorAll(".station-item");
  if (stationItems.length && currentIndex < stationItems.length) {
    changeStation(currentIndex);
  }
}

// Toggle favorite
function toggleFavorite(stationName) {
  favoriteStations = favoriteStations.includes(stationName)
    ? favoriteStations.filter(name => name !== stationName)
    : [stationName, ...favoriteStations];
  localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
  updateStationList(stationSearch.value);
}

// Change station
function changeStation(index) {
  if (index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
  currentIndex = index;
  stationItems.forEach(i => i.classList.remove("selected"));
  stationItems[index].classList.add("selected");
  audio.src = stationItems[index].dataset.value;
  updateCurrentStationInfo(stationItems[index]);
  localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
  tryAutoPlay();
  updateBackground(stationItems[index].dataset.genre);
}

// Update station info
function updateCurrentStationInfo(item) {
  currentStationInfo.querySelector(".station-name").textContent = item.dataset.name;
  currentStationInfo.querySelector(".station-genre").textContent = `Genre: ${item.dataset.genre}`;
  currentStationInfo.querySelector(".station-country").textContent = `Country: ${item.dataset.country}`;
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.dataset.name,
      artist: item.dataset.genre,
      album: "Radio S O"
    });
  }
}

// Playback controls
function tryAutoPlay() {
  if (!isPlaying || !stationItems.length || currentIndex >= stationItems.length) {
    document.querySelectorAll(".eq-bar").forEach(bar => bar.style.animationPlayState = "paused");
    return;
  }
  audio.play().then(() => {
    isPlaying = true;
    playPauseBtn.textContent = "⏸";
    document.querySelectorAll(".eq-bar").forEach(bar => bar.style.animationPlayState = "running");
  }).catch(error => {
    console.error("Playback error:", error);
    document.querySelectorAll(".eq-bar").forEach(bar => bar.style.animationPlayState = "paused");
  });
}

function togglePlayPause() {
  if (audio.paused) {
    isPlaying = true;
    tryAutoPlay();
  } else {
    audio.pause();
    isPlaying = false;
    playPauseBtn.textContent = "▶";
    document.querySelectorAll(".eq-bar").forEach(bar => bar.style.animationPlayState = "paused");
  }
  localStorage.setItem("isPlaying", isPlaying);
}

function prevStation() {
  currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
  changeStation(currentIndex);
}

function nextStation() {
  currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
  changeStation(currentIndex);
}

// Volume control
volumeSlider.addEventListener("input", () => {
  audio.volume = volumeSlider.value;
  localStorage.setItem("volume", audio.volume);
});

// Event listeners
audio.addEventListener("playing", () => {
  isPlaying = true;
  playPauseBtn.textContent = "⏸";
  document.querySelectorAll(".eq-bar").forEach(bar => bar.style.animationPlayState = "running");
});

audio.addEventListener("pause", () => {
  isPlaying = false;
  playPauseBtn.textContent = "▶";
  document.querySelectorAll(".eq-bar").forEach(bar => bar.style.animationPlayState = "paused");
});

stationList.addEventListener("click", e => {
  const item = e.target.closest(".station-item");
  const favoriteBtn = e.target.closest(".favorite-btn");
  if (item && !item.classList.contains("empty")) {
    currentIndex = Array.from(stationItems).indexOf(item);
    changeStation(currentIndex);
  }
  if (favoriteBtn) toggleFavorite(favoriteBtn.parentElement.dataset.name);
});

document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft") prevStation();
  if (e.key === "ArrowRight") nextStation();
  if (e.key === " ") {
    e.preventDefault();
    togglePlayPause();
  }
});

// Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(reg => reg.update());
}

// Media Session
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", togglePlayPause);
  navigator.mediaSession.setActionHandler("pause", togglePlayPause);
  navigator.mediaSession.setActionHandler("previoustrack", prevStation);
  navigator.mediaSession.setActionHandler("nexttrack", nextStation);
}

// Initialization
applyTheme(currentTheme);
audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;
volumeSlider.value = audio.volume;
loadStations();