const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".control-btn:nth-child(2)");
const currentStationInfo = document.querySelector(".current-station");
let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem(" 균isPlaying") === "true" || false;
let stationLists = {};
let stationItems;
let carouselIndex = 0;

// Теми
const themes = {
  cosmicDark: { bodyBg: "linear-gradient(135deg, #0a0a23, #1c2526)", containerBg: "#1c2526", accent: "#7e57c2", text: "#e0e0e0" },
  auraLight: { bodyBg: "#f5f7fa", containerBg: "#ffffff", accent: "#42a5f5", text: "#212121" },
  retroWave: { bodyBg: "linear-gradient(135deg, #1e1e2f, #2a2a3e)", containerBg: "#2a2a3e", accent: "#ff4081", text: "#e0e0e0" },
  cyberMint: { bodyBg: "#000000", containerBg: "#1a1a1a", accent: "#26a69a", text: "#e6f5f5" },
  solarGlow: { bodyBg: "linear-gradient(135deg, #1a1a1a, #2e2e2e)", containerBg: "#2e2e2e", accent: "#ffa726", text: "#f5efe6" }
};
let currentTheme = localStorage.getItem("selectedTheme") || "cosmicDark";

function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty("--body-bg", themes[theme].bodyBg);
  root.style.setProperty("--container-bg", themes[theme].containerBg);
  root.style.setProperty("--accent", themes[theme].accent);
  root.style.setProperty("--text", themes[theme].text);
  localStorage.setItem("selectedTheme", theme);
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
}

function toggleTheme() {
  const themesOrder = ["cosmicDark", "auraLight", "retroWave", "cyberMint", "solarGlow"];
  const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % themesOrder.length];
  applyTheme(nextTheme);
}

// Завантаження станцій
async function loadStations() {
  try {
    const response = await fetch("stations.json", { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    stationLists = await response.json();
    switchTab(currentTab);
  } catch (error) {
    console.error("Помилка завантаження станцій:", error);
  }
}

// Перемикання вкладок
function switchTab(tab) {
  if (!["techno", "trance", "ukraine", "best"].includes(tab)) tab = "techno";
  currentTab = tab;
  localStorage.setItem("currentTab", tab);
  currentIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
  updateStationList();
  updateCarousel();
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`).classList.add("active");
  if (stationItems?.length && currentIndex < stationItems.length) tryAutoPlay();
}

// Оновлення списку станцій
function updateStationList() {
  stationList.innerHTML = "";
  let stations = currentTab === "best"
    ? favoriteStations.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s)
    : stationLists[currentTab] || [];

  if (!stations.length && currentTab === "best") {
    stationList.innerHTML = '<div class="station-item empty">Немає улюблених станцій</div>';
    return;
  }

  stations.forEach((station, index) => {
    const item = document.createElement("div");
    item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
    item.dataset.value = station.value;
    item.dataset.name = station.name;
    item.dataset.genre = station.genre;
    item.dataset.country = station.country;
    item.innerHTML = `${station.emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">★</button>`;
    stationList.appendChild(item);
  });

  stationItems = stationList.querySelectorAll(".station-item:not(.empty)");
  stationList.onclick = e => {
    const item = e.target.closest(".station-item");
    const favoriteBtn = e.target.closest(".favorite-btn");
    if (item && !item.classList.contains("empty")) {
      currentIndex = Array.from(stationItems).indexOf(item);
      changeStation(currentIndex);
    }
    if (favoriteBtn) toggleFavorite(favoriteBtn.parentElement.dataset.name);
  };

  if (stationItems.length && currentIndex < stationItems.length) changeStation(currentIndex);
}

// Карусель популярних станцій
function updateCarousel() {
  const carouselInner = document.getElementById("carouselInner");
  let stations = favoriteStations.length > 0
    ? favoriteStations.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s)
    : Object.values(stationLists).flat().slice(0, 5);

  carouselInner.innerHTML = stations.map(station => `
    <div class="carousel-item" data-value="${station.value}" data-name="${station.name}" data-genre="${station.genre}" data-country="${station.country}">
      ${station.emoji} ${station.name}<br><small>${station.genre} | ${station.country}</small>
    </div>
  `).join("");

  carouselInner.style.transform = `translateX(0)`;
  carouselIndex = 0;
  carouselInner.onclick = e => {
    const item = e.target.closest(".carousel-item");
    if (item) {
      currentIndex = Array.from(stationItems).findIndex(s => s.dataset.name === item.dataset.name);
      changeStation(currentIndex);
    }
  };
}

function carouselPrev() {
  if (carouselIndex > 0) {
    carouselIndex--;
    document.getElementById("carouselInner").style.transform = `translateX(-${carouselIndex * 320}px)`;
  }
}

function carouselNext() {
  const items = document.querySelectorAll(".carousel-item").length;
  if (carouselIndex < items - 1) {
    carouselIndex++;
    document.getElementById("carouselInner").style.transform = `translateX(-${carouselIndex * 320}px)`;
  }
}

// Зміна станції
function changeStation(index) {
  if (index < 0 || index >= stationItems.length) return;
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
}

// Керування відтворенням
function tryAutoPlay() {
  if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length) {
    document.querySelectorAll(".eq-bar").forEach(bar => bar.style.animationPlayState = "paused");
    return;
  }
  audio.play().then(() => {
    isPlaying = true;
    playPauseBtn.textContent = "⏸";
    document.querySelectorAll(".eq-bar").forEach(bar => bar.style.animationPlayState = "running");
  }).catch(error => console.error("Помилка відтворення:", error));
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

function setVolume(value) {
  audio.volume = value;
  localStorage.setItem("volume", value);
}

// Пошук станцій
function toggleSearch() {
  const searchBar = document.getElementById("searchBar");
  searchBar.style.display = searchBar.style.display === "none" ? "flex" : "none";
}

function searchStations() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  stationList.innerHTML = "";
  let stations = currentTab === "best"
    ? favoriteStations.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s)
    : stationLists[currentTab] || [];

  stations = stations.filter(s => 
    s.name.toLowerCase().includes(query) || 
    s.genre.toLowerCase().includes(query) || 
    s.country.toLowerCase().includes(query)
  );

  stations.forEach((station, index) => {
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
}

function clearSearch() {
  document.getElementById("searchInput").value = "";
  updateStationList();
}

// Таймер сну
function toggleSleepTimer() {
  const timer = document.getElementById("sleepTimer");
  timer.style.display = timer.style.display === "none" ? "flex" : "none";
}

function setSleepTimer() {
  const minutes = parseInt(document.getElementById("timerSelect").value);
  if (minutes > 0) {
    setTimeout(() => {
      audio.pause();
      isPlaying = false;
      playPauseBtn.textContent = "▶";
      document.getElementById("timerSelect").value = "0";
    }, minutes * 60 * 1000);
  }
}

// Поділитися станцією
function shareStation() {
  const station = stationItems[currentIndex];
  if (navigator.share && station) {
    navigator.share({
      title: `Слухаю ${station.dataset.name} на Radio Vibe`,
      text: `Заходь слухати ${station.dataset.name} (${station.dataset.genre}, ${station.dataset.country})!`,
      url: window.location.href
    }).catch(error => console.error("Помилка поширення:", error));
  } else {
    alert("Поширення не підтримується. Скопіюйте посилання!");
  }
}

// Жести для мобільних
let touchStartX = 0;
document.addEventListener("touchstart", e => touchStartX = e.changedTouches[0].screenX);
document.addEventListener("touchend", e => {
  const touchEndX = e.changedTouches[0].screenX;
  if (touchStartX - touchEndX > 50) nextStation();
  if (touchEndX - touchStartX > 50) prevStation();
});

// Ініціалізація
audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;
applyTheme(currentTheme);
loadStations();