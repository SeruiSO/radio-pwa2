const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("currentStationInfo");
let currentIndex = parseInt(localStorage.getItem("lastStation")) || 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let currentTab = localStorage.getItem("currentTab") || "techno";
let isPlaying = localStorage.getItem("isPlaying") === "true" || true; // За замовчуванням true
let stationLists = {};
let stationItems;

// Функція для завантаження станцій із кешем як резервом
async function loadStations(attempt = 1) {
  try {
    const response = await fetch('stations.json');
    if (!response.ok) throw new Error('Не вдалося завантажити stations.json: ' + response.statusText);
    const data = await response.json();
    console.log("stations.json завантажено з мережі:", data);
    stationLists = data;
    const availableTabs = Object.keys(stationLists);
    if (!availableTabs.includes(currentTab)) {
      currentTab = availableTabs[0] || "techno";
      localStorage.setItem("currentTab", currentTab);
    }
    switchTab(currentTab);
  } catch (error) {
    console.error("Помилка завантаження станцій (спроба " + attempt + "):", error);
    // Спроба отримати з кешу
    if ('caches' in window) {
      caches.match('stations.json').then(cacheResponse => {
        if (cacheResponse) {
          cacheResponse.json().then(cachedData => {
            console.log("stations.json завантажено з кешу:", cachedData);
            stationLists = cachedData;
            const availableTabs = Object.keys(stationLists);
            if (!availableTabs.includes(currentTab)) {
              currentTab = availableTabs[0] || "techno";
              localStorage.setItem("currentTab", currentTab);
            }
            switchTab(currentTab);
          }).catch(cacheError => {
            console.error("Помилка читання кешу:", cacheError);
          });
        } else if (attempt < 3) {
          setTimeout(() => loadStations(attempt + 1), 1000);
        } else {
          stationList.innerHTML = '<div style="color: red; padding: 10px;">Помилка завантаження станцій після кількох спроб. Перевірте, чи файл stations.json доступний у корені проєкту.</div>';
        }
      });
    } else if (attempt < 3) {
      setTimeout(() => loadStations(attempt + 1), 1000);
    } else {
      stationList.innerHTML = '<div style="color: red; padding: 10px;">Помилка завантаження станцій після кількох спроб. Перевірте, чи файл stations.json доступний у корені проєкту.</div>';
    }
  }
}

loadStations();

// Теми
const themes = {
  dark: { bodyBg: "#121212", containerBg: "#1e1e1e", accent: "#00C4FF", text: "#fff" },
  light: { bodyBg: "#f0f0f0", containerBg: "#fff", accent: "#007BFF", text: "#000" },
  neon: { bodyBg: "#0a0a1a", containerBg: "#1a1a2e", accent: "#00ffcc", text: "#fff" },
  "light-alt": { bodyBg: "#f5f5e6", containerBg: "#fff5e1", accent: "#1e90ff", text: "#333" },
  "dark-alt": { bodyBg: "#1a1a2a", containerBg: "#2e2e3e", accent: "#00ff00", text: "#e0e0e0" }
};
let currentTheme = localStorage.getItem("selectedTheme") || "dark";

// Налаштування Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then((registration) => {
    registration.update();
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
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data.type === 'UPDATE') {
      alert(event.data.message);
    }
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
    el.style.background = themes[theme].containerBg;
    el.style.borderColor = themes[theme].text;
    el.style.color = themes[theme].text;
  });
  document.querySelector(".controls-container").style.background = themes[theme].containerBg;
  document.querySelector(".controls-container").style.borderColor = themes[theme].accent;
  currentTheme = theme;
  localStorage.setItem("selectedTheme", theme);
}

function toggleTheme() {
  const themesOrder = ["dark", "light", "neon", "light-alt", "dark-alt"];
  const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % 5];
  applyTheme(nextTheme);
}

function switchTab(tab) {
  if (!["techno", "trance", "ukraine"].includes(tab)) tab = "techno";
  currentTab = tab;
  localStorage.setItem("currentTab", tab);
  currentIndex = 0;
  updateStationList();
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`);
  if (activeBtn) activeBtn.classList.add("active");
}

async function checkStationAvailability(url) {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal, method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

function updateStationList() {
  stationList.innerHTML = '';
  const stations = stationLists[currentTab] || [];
  if (!stations || stations.length === 0) {
    stationList.innerHTML = '<div style="color: yellow; padding: 10px;">Немає станцій для вкладки "' + currentTab + '".</div>';
    return;
  }

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
    stationList.appendChild(item);
  });

  stationItems = stationList.querySelectorAll(".station-item");
  console.log("stationItems для вкладки", currentTab, ":", stationItems.length);

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
  } else {
    console.log("Не вдалося ініціалізувати станцію: stationItems порожній або currentIndex недійсний.");
  }
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

async function changeStation(index) {
  if (index < 0 || index >= stationItems.length) return;
  const item = stationItems[index];
  stationItems.forEach(item => item.classList.remove("selected", "offline"));
  item.classList.add("selected");
  currentIndex = index;
  audio.src = item.dataset.value;
  updateCurrentStationInfo(item);
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
  
  const isOnline = await checkStationAvailability(item.dataset.value);
  if (isOnline) {
    audio.play().catch(error => console.error("Помилка відтворення:", error));
    isPlaying = true;
    playPauseBtn.textContent = "⏸";
    currentStationInfo.querySelector(".network-status").textContent = "";
    currentStationInfo.querySelector(".network-status").classList.remove("disconnected");
  } else {
    item.classList.add('offline');
    currentStationInfo.querySelector(".network-status").textContent = "❌";
    currentStationInfo.querySelector(".network-status").classList.add("disconnected");
  }
  localStorage.setItem("isPlaying", isPlaying);
  localStorage.setItem("lastStation", index);
}

function updateCurrentStationInfo(item) {
  currentStationInfo.querySelector(".station-name").textContent = item.dataset.name || "Немає даних";
  currentStationInfo.querySelector(".station-genre").textContent = `жанр: ${item.dataset.genre || '-'}`;
  currentStationInfo.querySelector(".station-country").textContent = `країна: ${item.dataset.country || '-'}`;
  const networkStatus = currentStationInfo.querySelector(".network-status");
  networkStatus.textContent = "";
  networkStatus.className = "network-status";
  if (item.classList.contains('offline')) {
    networkStatus.textContent = "❌";
    networkStatus.classList.add("disconnected");
  }
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.dataset.name || "Невідома станція",
      artist: `${item.dataset.genre || '-'} | ${item.dataset.country || '-'}`,
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

function togglePlayPause() {
  if (audio.paused) {
    audio.play().catch(error => console.error("Помилка відтворення:", error));
    playPauseBtn.textContent = "⏸";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
    isPlaying = true;
  } else {
    audio.pause();
    playPauseBtn.textContent = "▶";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    isPlaying = false;
  }
  localStorage.setItem("isPlaying", isPlaying);
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
  if (!document.hidden && isPlaying) {
    setTimeout(() => {
      audio.play().catch(error => console.error("Помилка автовідтворення:", error));
    }, 500);
  }
});

window.addEventListener("online", () => {
  if (isPlaying) {
    setTimeout(() => {
      audio.play().catch(error => console.error("Помилка автовідтворення:", error));
    }, 1500);
  }
});

let reconnectAttempts = 0;
audio.addEventListener("error", () => {
  if (reconnectAttempts < 3) {
    setTimeout(() => {
      audio.load();
      audio.play().catch(error => console.error("Помилка перепідключення:", error));
      reconnectAttempts++;
    }, 2000);
  } else {
    currentStationInfo.querySelector(".network-status").textContent = "❌";
    currentStationInfo.querySelector(".network-status").classList.add("disconnected");
  }
});

audio.addEventListener("waiting", () => {
  currentStationInfo.querySelector(".network-status").textContent = "⏳";
  currentStationInfo.querySelector(".network-status").classList.add("buffering");
});
audio.addEventListener("playing", () => {
  currentStationInfo.querySelector(".network-status").textContent = "";
  currentStationInfo.querySelector(".network-status").classList.remove("buffering", "disconnected");
  reconnectAttempts = 0;
});

navigator.mediaSession.setActionHandler("previoustrack", () => prevStation());
navigator.mediaSession.setActionHandler("nexttrack", () => nextStation());
navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());

applyTheme(currentTheme);
window.addEventListener("blur", () => {
  if (document.hidden) localStorage.setItem("lastStation", currentIndex);
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
audio.volume = 0.5;

if (isPlaying) {
  audio.play().catch(error => console.error("Помилка автовідтворення:", error));
}