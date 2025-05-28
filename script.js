const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("currentStationInfo");
const themeToggle = document.querySelector(".theme-toggle");
const networkStatusText = document.querySelector(".network-status-text");
const loadingSpinner = document.querySelector(".loading-spinner");

// Перевірка існування DOM-елементів
if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !networkStatusText || !loadingSpinner) {
  console.error("Один із необхідних DOM-елементів не знайдено");
  throw new Error("Не вдалося ініціалізувати програму через відсутність DOM-елементів");
}

let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {}; // Початково порожній об’єкт
let stationItems;
let isAutoPlaying = false;

// Налаштування аудіо
audio.preload = "auto";
audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

// Оновлення стану мережі в UI
function updateNetworkStatus(online) {
  if (online) {
    networkStatusText.textContent = "Онлайн";
    networkStatusText.classList.remove("offline");
    networkStatusText.classList.add("online");
  } else {
    networkStatusText.textContent = "Офлайн";
    networkStatusText.classList.remove("online");
    networkStatusText.classList.add("offline");
  }
}

// Завантаження станцій з повторними спробами
async function loadStations() {
  console.time("loadStations");
  loadingSpinner.classList.add("active");
  stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await fetch("stations.json", {
        cache: "no-cache",
        headers: {
          "If-Modified-Since": localStorage.getItem("stationsLastModified") || ""
        }
      });
      console.log("Статус відповіді:", response.status);
      if (response.status === 304) {
        const cachedData = await caches.match("stations.json");
        if (cachedData) {
          stationLists = await cachedData.json();
          console.log("Використовується кешована версія stations.json");
        } else {
          throw new Error("Кеш не знайдено");
        }
      } else if (response.ok) {
        stationLists = await response.json();
        localStorage.setItem("stationsLastModified", response.headers.get("Last-Modified") || "");
        console.log("Новий stations.json успішно завантажено");
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
      const validTabs = [...Object.keys(stationLists), "best"];
      if (!validTabs.includes(currentTab)) {
        currentTab = validTabs[0] || "techno";
        localStorage.setItem("currentTab", currentTab);
      }
      currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
      switchTab(currentTab);
      loadingSpinner.classList.remove("active");
      // Відтворюємо останню станцію, якщо isPlaying=true
      if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
        tryAutoPlay();
      }
      return;
    } catch (error) {
      console.error(`Спроба ${attempt + 1}: Помилка завантаження станцій:`, error);
      attempt++;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Затримка 5 секунд
      }
    }
  }
  stationList.innerHTML = "<div class='station-item empty'>Не вдалося завантажити станції</div>";
  loadingSpinner.classList.remove("active");
  console.timeEnd("loadStations");
}

// Теми
const themes = {
  "neon-pulse": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#00F0FF",
    text: "#F0F0F0",
    accentGradient: "#003C4B"
  },
  "lime-surge": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#B2FF59",
    text: "#E8F5E9",
    accentGradient: "#2E4B2F"
  },
  "flamingo-flash": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#FF4081",
    text: "#FCE4EC",
    accentGradient: "#4B1A2E"
  },
  "violet-vortex": {
    bodyBg: "#121212",
    containerBg: "#1A1A1A",
    accent: "#7C4DFF",
    text: "#EDE7F6",
    accentGradient: "#2E1A47"
  },
  "aqua-glow": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#26C6DA",
    text: "#B2EBF2",
    accentGradient: "#1A3C4B"
  },
  "cosmic-indigo": {
    bodyBg: "#121212",
    containerBg: "#1A1A1A",
    accent: "#3F51B5",
    text: "#BBDEFB",
    accentGradient: "#1A2A5A"
  },
  "mystic-jade": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#26A69A",
    text: "#B2DFDB",
    accentGradient: "#1A3C4B"
  },
  "aurora-haze": {
    bodyBg: "#121212",
    containerBg: "#1A1A1A",
    accent: "#64FFDA",
    text: "#E0F7FA",
    accentGradient: "#1A4B4B"
  },
  "starlit-amethyst": {
    bodyBg: "#0A0A0A",
    containerBg: "#121212",
    accent: "#B388FF",
    text: "#E1BEE7",
    accentGradient: "#2E1A47"
  },
  "lunar-frost": {
    bodyBg: "#F5F7FA",
    containerBg: "#FFFFFF",
    accent: "#40C4FF",
    text: "#212121",
    accentGradient: "#B3E5FC"
  }
};
let currentTheme = localStorage.getItem("selectedTheme") || "neon-pulse";

function applyTheme(theme) {
  const root = document.documentElement;
  root.style.setProperty("--body-bg", themes[theme].bodyBg);
  root.style.setProperty("--container-bg", themes[theme].containerBg);
  root.style.setProperty("--accent", themes[theme].accent);
  root.style.setProperty("--text", themes[theme].text);
  root.style.setProperty("--accent-gradient", themes[theme].accentGradient);
  localStorage.setItem("selectedTheme", theme);
  currentTheme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", themes[theme].accent);
  }
}

function toggleTheme() {
  const themesOrder = [
    "neon-pulse",
    "lime-surge",
    "flamingo-flash",
    "violet-vortex",
    "aqua-glow",
    "cosmic-indigo",
    "mystic-jade",
    "aurora-haze",
    "starlit-amethyst",
    "lunar-frost"
  ];
  const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % themesOrder.length];
  applyTheme(nextTheme);
}

// Додаємо обробник події для кнопки
themeToggle.addEventListener("click", toggleTheme);

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
    if (event.data.type === "NETWORK_STATUS") {
      updateNetworkStatus(event.data.online);
      if (event.data.online && isPlaying && stationItems?.length && currentIndex < stationItems.length) {
        console.log("Отримано повідомлення від Service Worker: мережа відновлена");
        if (audio.src !== stationItems[currentIndex].dataset.value) {
          audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
        }
      }
    } else if (event.data.type === "BLUETOOTH_RECONNECT" || event.data.type === "NETWORK_RECONNECT") {
      console.log(`Отримано повідомлення від Service Worker: ${event.data.type === "BLUETOOTH_RECONNECT" ? "Bluetooth" : "Мережа"} підключено`);
      if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
        if (audio.src !== stationItems[currentIndex].dataset.value) {
          audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
        }
      }
    }
  });
}

// Автовідтворення
function tryAutoPlay() {
  if (!navigator.onLine) {
    console.log("Пристрій офлайн, пропускаємо відтворення");
    updateNetworkStatus(false);
    return;
  }
  if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length || isAutoPlaying) {
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    return;
  }
  // Перевіряємо, чи джерело вже встановлено і відтворюється
  if (audio.src === stationItems[currentIndex].dataset.value && !audio.paused) {
    console.log("Станція вже відтворюється, пропускаємо");
    return;
  }

  isAutoPlaying = true;
  audio.src = stationItems[currentIndex].dataset.value;
  const playPromise = audio.play();

  playPromise
    .then(() => {
      isAutoPlaying = false;
      isPlaying = true;
      playPauseBtn.textContent = "⏸";
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      localStorage.setItem("isPlaying", isPlaying);
      localStorage.setItem("lastActivity", Date.now());
      updateNetworkStatus(true);
    })
    .catch(error => {
      console.error("Помилка відтворення:", error);
      isAutoPlaying = false;
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      updateNetworkStatus(false);
      if (document.hidden && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "REQUEST_RECONNECT",
          reason: error.name === "NotAllowedError" ? "media" : "network"
        });
      }
    });
}

// Відстеження підключения Bluetooth
function setupBluetoothAutoPlay() {
  if ("mediaDevices" in navigator) {
    navigator.mediaDevices.ondevicechange = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(device => device.kind === "audiooutput");
        const hasBluetooth = audioOutputs.some(device => device.label.toLowerCase().includes("bluetooth"));

        if (hasBluetooth && stationItems?.length && currentIndex < stationItems.length) {
          console.log("Виявлено Bluetooth-пристрій");
          localStorage.setItem("lastActivity", Date.now());
          if (!isPlaying) {
            isPlaying = true;
            tryAutoPlay();
          }
          navigator.serviceWorker.controller?.postMessage({
            type: "BLUETOOTH_STATUS",
            connected: true
          });
        } else if (!hasBluetooth) {
          console.log("Bluetooth-пристрій відключено");
          navigator.serviceWorker.controller?.postMessage({
            type: "BLUETOOTH_STATUS",
            connected: false
          });
        }
      } catch (error) {
        console.error("Помилка при відстеженні Bluetooth:", error);
      }
    };
  }

  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", () => {
      if (stationItems?.length && currentIndex < stationItems.length) {
        console.log("Команда play від Bluetooth");
        isPlaying = true;
        localStorage.setItem("lastActivity", Date.now());
        tryAutoPlay();
      }
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audio.pause();
      isPlaying = false;
      playPauseBtn.textContent = "▶";
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
      localStorage.setItem("isPlaying", isPlaying);
    });
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
  if (stationItems?.length && currentIndex < stationItems.length) {
    updateCurrentStationInfo(stationItems[currentIndex]);
    if (isPlaying && audio.src !== stationItems[currentIndex].dataset.value) {
      changeStation(currentIndex);
    } else if (isPlaying) {
      tryAutoPlay();
    }
  }
}

// Оновлення списку станцій
function updateStationList() {
  if (!stationList) {
    console.error("stationList не знайдено");
    return;
  }
  let stations = currentTab === "best"
    ? favoriteStations
        .map(name => Object.values(stationLists).flat().find(s => s.name === name))
        .filter(s => s)
    : stationLists[currentTab] || [];

  if (!stations.length) {
    currentIndex = 0;
    stationItems = [];
    stationList.innerHTML = `<div class='station-item empty'>${currentTab === "best" ? "Немає улюблених станцій" : "Немає станцій у цій категорії"}`;
    return;
  }

  const fragment = document.createDocumentFragment();
  stations.forEach((station, index) => {
    const item = document.createElement("div");
    item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
    item.dataset.value = station.value;
    item.dataset.name = station.name;
    item.dataset.genre = station.genre;
    item.dataset.country = station.country;
    item.innerHTML = `${station.emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}>★</button>`;
    fragment.appendChild(item);
  });
  stationList.innerHTML = "";
  stationList.appendChild(fragment);
  stationItems = stationList.querySelectorAll(".station-item");

  stationList.onclick = e => {
    const item = e.target.closest(".station-item");
    const favoriteBtn = e.target.closest(".favorite-btn");
    if (favoriteBtn) {
      toggleFavorite(favoriteBtn.parentElement.dataset.name);
    } else if (item && !item.classList.contains("empty")) {
      currentIndex = Array.from(stationItems).indexOf(item);
      changeStation(currentIndex);
    }
  };

  if (stationItems.length && currentIndex < stationItems.length) {
    updateCurrentStationInfo(stationItems[currentIndex]);
  }
}

// Перемикання улюбленных станцій
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
  const item = stationItems[index];
  stationItems?.forEach(i => i.classList.remove("selected"));
  item.classList.add("selected");
  currentIndex = index;
  updateCurrentStationInfo(item);
  localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
  if (audio.src !== item.dataset.value) {
    audio.src = item.dataset.value;
    tryAutoPlay();
  }
}

// Оновлення інформації о станції
function updateCurrentStationInfo(item) {
  if (!currentStationInfo) {
    console.error("currentStationInfo не знайдено");
    return;
  }
  const stationNameElement = currentStationInfo.querySelector(".station-name");
  const stationGenreElement = currentStationInfo.querySelector(".station-genre");
  const stationCountryElement = currentStationInfo.querySelector(".station-country");

  if (stationNameElement) {
    stationNameElement.textContent = item.dataset.name || "Обирайте станцію";
  }
  if (stationGenreElement) {
    stationGenreElement.textContent = `Жанр: ${item.dataset.genre || "-"}`;
  }
  if (stationCountryElement) {
    stationCountryElement.textContent = `Країна: ${item.dataset.country || "-"}`;
  }
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.dataset.name || "Обирайте станцію",
      artist: `${item.dataset.genre || "-"} | ${item.dataset.country || "-"}`,
      album: "Radio Music"
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
  if (!playPauseBtn || !audio) {
    console.error("playPauseBtn або audio не знайдено");
    return;
  }
  if (audio.paused) {
    isPlaying = true;
    tryAutoPlay();
    playPauseBtn.textContent = "⏸";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
  } else {
    audio.pause();
    isPlaying = false;
    playPauseBtn.textContent = "▶";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  }
  localStorage.setItem("isPlaying", isPlaying);
}

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
    if (!document.hidden && isPlaying && navigator.onLine) {
      if (!audio.paused) return;
      if (stationItems?.length && currentIndex < stationItems.length) {
        audio.src = stationItems[currentIndex].dataset.value;
        tryAutoPlay();
      }
    }
  },
  resume: () => {
    if (isPlaying && navigator.connection?.type !== "none") {
      if (!audio.paused) return;
      if (stationItems?.length && currentIndex < stationItems.length) {
        audio.src = stationItems[currentIndex].dataset.value;
        tryAutoPlay();
      }
    }
  }
};

// Додаємо слухачі
function addEventListeners() {
  document.addEventListener("keydown", eventListeners.keydown);
  document.addEventListener("visibilitychange", eventListeners.visibilitychange);
  document.addEventListener("resume", eventListeners.resume);
}

// Очищення слухачів
function removeEventListeners() {
  document.removeEventListener("keydown", eventListeners.keydown);
  document.removeEventListener("visibilitychange", eventListeners.visibilitychange);
  document.removeEventListener("resume", eventListeners.resume);
}

// Додаємо слухачі подій
audio.addEventListener("playing", () => {
  isPlaying = true;
  playPauseBtn.textContent = "⏸";
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
  localStorage.setItem("lastActivity", Date.now());
  localStorage.setItem("isPlaying", isPlaying);
});

audio.addEventListener("pause", () => {
  isPlaying = false;
  playPauseBtn.textContent = "▶";
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  localStorage.setItem("isPlaying", isPlaying);
});

audio.addEventListener("error", () => {
  document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
});

audio.addEventListener("volumechange", () => {
  localStorage.setItem("volume", audio.volume);
});

// Моніторинг мережі
window.addEventListener("online", () => {
  console.log("Мережа відновлена");
  updateNetworkStatus(true);
  if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
    if (audio.src !== stationItems[currentIndex].dataset.value) {
      audio.src = stationItems[currentIndex].dataset.value;
      tryAutoPlay();
    }
  }
});

window.addEventListener("offline", () => {
  console.log("Втрачено з'єднання з мережею");
  updateNetworkStatus(false);
});

// Ініціалізація слухачів
addEventListeners();

// Очищення слухачів перед оновленням сторінки
window.addEventListener("beforeunload", () => {
  removeEventListeners();
});

// Media Session API
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", togglePlayPause);
  navigator.mediaSession.setActionHandler("pause", togglePlayPause);
  navigator.mediaSession.setActionHandler("previoustrack", prevStation);
  navigator.mediaSession.setActionHandler("nexttrack", nextStation);
}

// Ініціалізація Bluetooth
setupBluetoothAutoPlay();

// Ініціалізація
applyTheme(currentTheme);
loadStations();
updateNetworkStatus(navigator.onLine);