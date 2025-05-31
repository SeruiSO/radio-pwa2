const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("currentStationInfo");
const themeToggle = document.querySelector(".theme-toggle");

// Перевірка DOM-елементів
if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle) {
  console.error("Один із необхідних DOM-елементів не знайдено");
  throw new Error("Не вдалося ініціалізувати програму через відсутність DOM-елементів");
}

let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {};
let stationItems;
let isAutoPlaying = false;
let audioContext;
let isUserInteracted = false;
let abortController = new AbortController();

// Налаштування аудіо
audio.preload = "auto";
audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

// Функція для скидання інформації про станцію
function resetStationInfo() {
  const stationNameElement = currentStationInfo.querySelector(".station-name");
  const stationGenreElement = currentStationInfo.querySelector(".station-genre");
  const stationCountryElement = currentStationInfo.querySelector(".station-country");
  
  if (stationNameElement) stationNameElement.textContent = "Обирайте станцію";
  if (stationGenreElement) stationGenreElement.textContent = "жанр: -";
  if (stationCountryElement) stationCountryElement.textContent = "країна: -";
}

// Завантаження станцій з підтримкою переривання
async function loadStations() {
  console.time("loadStations");
  stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
  
  try {
    abortController.abort();
    abortController = new AbortController();
    
    const response = await fetch(`stations.json?t=${Date.now()}`, {
      cache: "no-cache",
      headers: {
        "If-Modified-Since": localStorage.getItem("stationsLastModified") || ""
      },
      signal: abortController.signal
    });

    if (response.status === 304) {
      const cachedData = await caches.match("stations.json");
      if (cachedData) {
        stationLists = await cachedData.json();
      } else {
        throw new Error("Кеш не знайдено");
      }
    } else if (response.ok) {
      stationLists = await response.json();
      localStorage.setItem("stationsLastModified", response.headers.get("Last-Modified") || "");
    }

    const validTabs = [...Object.keys(stationLists), "best"];
    currentTab = localStorage.getItem("currentTab") || "techno";
    if (!validTabs.includes(currentTab)) currentTab = validTabs[0] || "techno";
    
    currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
    switchTab(currentTab);

    document.addEventListener('click', handleFirstInteraction, { once: true });
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error("Помилка завантаження станцій:", error);
      stationList.innerHTML = `<div class='station-item empty'>Помилка: ${error.message}</div>`;
    }
  } finally {
    console.timeEnd("loadStations");
  }
}

function handleFirstInteraction() {
  isUserInteracted = true;
  if (localStorage.getItem("isPlaying") === "true") {
    tryAutoPlay();
  }
}

// Теми (залишається без змін)
const themes = {
  "neon-pulse": { /* ... */ },
  // ... інші теми
};

let currentTheme = localStorage.getItem("selectedTheme") || "neon-pulse";

function applyTheme(theme) { /* ... */ }
function toggleTheme() { /* ... */ }

themeToggle.addEventListener("click", toggleTheme);

// Service Worker з очищенням старого кешу
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(registration => {
    registration.update();
  });
}

// Покращене автовідтворення з підтримкою Bluetooth
function tryAutoPlay() {
  if (!isUserInteracted || !navigator.onLine) return;
  
  if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length || isAutoPlaying) {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    return;
  }

  isAutoPlaying = true;
  audio.src = stationItems[currentIndex].dataset.value;
  
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  const playPromise = audio.play();

  playPromise
    .then(() => {
      isAutoPlaying = false;
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      
      // Оновлення MediaSession для Bluetooth
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: stationItems[currentIndex].dataset.name,
          artist: `${stationItems[currentIndex].dataset.genre} | ${stationItems[currentIndex].dataset.country}`,
          album: "Radio Music"
        });
      }
    })
    .catch(error => {
      console.error("Помилка відтворення:", error);
      isAutoPlaying = false;
    });
}

// Покращене переключення станцій
function changeStation(index) {
  if (index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
  
  abortController.abort();
  abortController = new AbortController();
  
  const item = stationItems[index];
  stationItems.forEach(i => i.classList.remove("selected"));
  item.classList.add("selected");
  currentIndex = index;
  
  // Прокрутка до вибраної станції
  item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  
  audio.src = item.dataset.value;
  updateCurrentStationInfo(item);
  localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
  
  if (isPlaying) {
    tryAutoPlay();
  }
}

// Оновлення улюблених без переривання
function toggleFavorite(stationName) {
  if (favoriteStations.includes(stationName)) {
    favoriteStations = favoriteStations.filter(name => name !== stationName);
  } else {
    favoriteStations.unshift(stationName);
  }
  localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
  
  if (currentTab === "best") {
    updateStationList();
  } else {
    const favoriteBtn = document.querySelector(`.station-item[data-name="${stationName}"] .favorite-btn`);
    if (favoriteBtn) {
      favoriteBtn.classList.toggle("favorited");
    }
  }
}

// Фоновий режим та Media Session
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", togglePlayPause);
  navigator.mediaSession.setActionHandler("pause", togglePlayPause);
  navigator.mediaSession.setActionHandler("previoustrack", prevStation);
  navigator.mediaSession.setActionHandler("nexttrack", nextStation);
}

// Ініціалізація
applyTheme(currentTheme);
loadStations();

// Моніторинг мережі з повторними спробами
let retryCount = 0;
const MAX_RETRIES = 5;

window.addEventListener("online", () => {
  console.log("Мережа відновлена");
  retryCount = 0;
  if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
    audio.pause();
    audio.src = stationItems[currentIndex].dataset.value;
    tryAutoPlay();
  }
});

window.addEventListener("offline", () => {
  console.log("Втрачено з'єднання");
  if (isPlaying) {
    const retryInterval = Math.min(1000 * 2 ** retryCount, 30000);
    if (retryCount < MAX_RETRIES) {
      setTimeout(() => {
        if (navigator.onLine && isPlaying) {
          audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
        }
      }, retryInterval);
      retryCount++;
    }
  }
});