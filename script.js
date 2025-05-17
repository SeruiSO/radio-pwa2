const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("currentStationInfo");
let currentIndex = parseInt(localStorage.getItem("lastStation")) || 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let currentTab = localStorage.getItem("currentTab") || "techno";
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {};
let stationItems;
let hasUserInteraction = false;

// Дозвіл на відтворення після першого кліку
document.addEventListener('click', () => {
  hasUserInteraction = true;
  if (audio.src && !audio.paused && !isPlaying && stationItems?.length > currentIndex) {
    changeStation(currentIndex);
    if (isPlaying) audioatoare: audio.play().catch(error => console.error("Помилка відтворення:", error));
  }
}, { once: true });

// Перевірка доступності URL станції
async function checkStationUrl(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal, method: 'HEAD' });
    clearTimeout(timeout);
    return response.ok;
  } catch (error) {
    console.error('Станція недоступна:', url);
    return false;
  }
}

// Завантаження всіх вкладок із stations.json
async function loadStations(attempt = 1) {
  try {
    const response = await fetch('stations.json');
    if (!response.ok) throw new Error('Не вдалося завантажити stations.json: ' + response.statusText);
    const data = await response.json();
    console.log("stations.json завантажено:", data);
    stationLists = data; // Зберігаємо всі вкладки
    const availableTabs = Object.keys(data);
    if (!availableTabs.includes(currentTab) && currentTab !== "best") {
      currentTab = availableTabs[0] || "techno";
      localStorage.setItem("currentTab", currentTab);
    }
    switchTab(currentTab);
    if (stationItems?.length > currentIndex && isPlaying) {
      changeStation(currentIndex);
      audio.play().catch(error => console.error("Помилка автовідтворення:", error));
    }
  } catch (error) {
    console.error(`Помилка завантаження станцій (спроба ${attempt}):`, error);
    if ('caches' in window) {
      caches.match('stations.json').then(cacheResponse => {
        if (cacheResponse) {
          cacheResponse.json().then(cachedData => {
            console.log("stations.json з кешу:", cachedData);
            stationLists = cachedData;
            const availableTabs = Object.keys(cachedData);
            if (!availableTabs.includes(currentTab) && currentTab !== "best") {
              currentTab = availableTabs[0] || "techno";
              localStorage.setItem("currentTab", currentTab);
            }
            switchTab(currentTab);
            if (stationItems?.length > currentIndex && isPlaying) {
              changeStation(currentIndex);
              audio.play().catch(error => console.error("Помилка автовідтворення:", error));
            }
          });
        } else if (attempt < 3) {
          setTimeout(() => loadStations(attempt + 1), 1000);
        } else {
          stationList.innerHTML = '<div style="color: red; padding: 10px;">Помилка завантаження станцій. Перевірте файл stations.json.</div>';
        }
      });
    } else if (attempt < 3) {
      setTimeout(() => loadStations(attempt + 1), 1000);
    } else {
      stationList.innerHTML = '<div style="color: red; padding: 10px;">Помилка завантаження станцій. Перевірте файл stations.json.</div>';
    }
  }
}

loadStations();

// Теми
const themes = {
  midnight: {
    bodyBg: "linear-gradient(180deg, #0a0a1a, #1a1a2e)",
    containerBg: "#1e1e2e",
    accent: "#7b68ee",
    text: "#e0e0e0",
    secondary: "#00c4ff"
  },
  polar: {
    bodyBg: "#f5f5f5",
    containerBg: "#ffffff",
    accent: "#1e90ff",
    text: "#333333",
    secondary: "#6c757d"
  },
  cyberglow: {
    bodyBg: "linear-gradient(180deg, #0a0a1a, #1a1a2e)",
    containerBg: "#1e1e2e",
    accent: "#00ffcc",
    text: "#ffffff",
    secondary: "#ff007a"
  }
};
let currentTheme = localStorage.getItem("selectedTheme") || "midnight";

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
  const themesOrder = ["midnight", "polar", "cyberglow"];
  const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % 3];
  applyTheme(nextTheme);
}

function switchTab(tab) {
  if (!["techno", "trance", "ukraine", "best"].includes(tab)) tab = "techno";
  currentTab = tab;
  localStorage.setItem("currentTab", tab);
  const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
  currentIndex = savedIndex < (tab === "best" ? getFavoriteStations().length : stationLists[tab]?.length || 0) ? savedIndex : 0;
  updateStationList();
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`);
  if (activeBtn) activeBtn.classList.add("active");
  if (stationItems?.length > currentIndex && isPlaying) {
    changeStation(currentIndex);
    audio.play().catch(error => console.error("Помилка автовідтворення:", error));
  }
}

// Формування списку улюблених станцій із усіх вкладок
function getFavoriteStations() {
  const allStations = [];
  ["techno", "trance", "ukraine"].forEach(tab => {
    if (stationLists[tab]) {
      stationLists[tab].forEach(station => {
        if (favoriteStations.includes(station.name)) {
          allStations.push({ ...station, originalTab: tab });
        }
      });
    }
  });
  return allStations;
}

function updateStationList() {
  const fragment = document.createDocumentFragment();
  let stations = currentTab === "best" ? getFavoriteStations() : stationLists[currentTab] || [];
  if (!stations || stations.length === 0) {
    stationList.innerHTML = '<div style="color: yellow; padding: 10px;">Немає станцій для вкладки "' + currentTab + '".</div>';
    return;
  }

  if (currentTab !== "best") {
    const favoriteList = favoriteStations
      .map(name => stations.find(station => station.name === name))
      .filter(station => station);
    const nonFavoriteList = stations.filter(station => !favoriteStations.includes(station.name));
    stations = [...favoriteList, ...nonFavoriteList];
  }

  stations.forEach((station, index) => {
    const item = document.createElement("div");
    item.className = `station-item ${index === currentIndex ? 'selected' : ''}`;
    item.dataset.value = station.value;
    item.dataset.name = station.name;
    item.dataset.genre = station.genre;
    item.dataset.country = station.country;
    item.dataset.originalTab = station.originalTab || currentTab;
    item.innerHTML = `${station.emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? ' favorited' : ''}">★</button>`;
    fragment.appendChild(item);
  });

  stationList.replaceChildren(fragment);
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
  stationItems.forEach(item => item.classList.remove("selected"));
  item.classList.add("selected");
  currentIndex = index;
  const url = item.dataset.value;
  if (await checkStationUrl(url)) {
    audio.src = url;
  } else {
    nextStation();
    return;
  }
  updateCurrentStationInfo(item);
  if (audio.paused) {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  } else {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
  }
  if (isPlaying && hasUserInteraction) {
    audio.play().catch(error => console.error("Помилка відтворення:", error));
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
    if (hasUserInteraction) {
      audio.play().catch(error => console.error("Помилка відтворення:", error));
      playPauseBtn.textContent = "⏸";
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      isPlaying = true;
    }
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

audio.addEventListener('suspend', () => {
  isPlaying = false;
  localStorage.setItem('isPlaying', isPlaying);
  console.log('Відтворення призупинено системою');
});

audio.addEventListener('resume', () => {
  if (isPlaying && hasUserInteraction) {
    audio.play().catch(error => console.error('Помилка відновлення:', error));
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isPlaying) {
    setTimeout(() => {
      if (hasUserInteraction) audio.play().catch(error => console.error("Помилка автовідтворення:", error));
    }, 100);
  }
});

document.addEventListener('resume', () => {
  if (isPlaying && hasUserInteraction) {
    setTimeout(() => audio.play().catch(error => console.error('Помилка відновлення:', error)), 100);
  }
});

window.addEventListener("online", () => {
  if (isPlaying && hasUserInteraction) {
    audio.play().catch(error => console.error("Помилка автовідтворення:", error));
  }
});

window.addEventListener("offline", () => {
  stationList.innerHTML = '<div style="color: yellow; padding: 10px;">Відсутнє інтернет-з’єднання. Використовується кеш.</div>';
});

audio.addEventListener("error", () => {
  console.error('Помилка потоку:', audio.error);
  if (isPlaying) {
    setTimeout(() => {
      audio.load();
      audio.play().catch(error => console.error('Помилка перепідключення:', error));
    }, 2000);
  }
});

audio.addEventListener("waiting", () => {
  currentStationInfo.innerHTML += '<div class="loading">Буферизація...</div>';
});

audio.addEventListener("playing", () => {
  document.querySelector('.loading')?.remove();
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
window.addEventListener("blur", () => {
  if (document.hidden) localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
});

audio.volume = 0.5;

if (isPlaying) {
  setTimeout(() => {
    if (stationItems?.length > currentIndex) {
      changeStation(currentIndex);
      audio.play().catch(error => console.error("Помилка автовідтворення:", error));
    }
  }, 1000);
}