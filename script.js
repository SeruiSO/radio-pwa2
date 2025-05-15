const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("currentStationInfo");
let currentIndex = parseInt(localStorage.getItem("lastStationIndex")) || 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let currentTab = localStorage.getItem("lastStationTab") || "techno";
let isPlaying = localStorage.getItem("isPlaying") === "true";
let stationLists = {};
let stationItems;

// Завантаження станцій із JSON
fetch('stations.json')
  .then(response => response.json())
  .then(data => {
    stationLists = data;
    switchTab(currentTab); // Відновлення останньої вкладки
    if (isPlaying && stationItems?.length > 0) {
      changeStation(currentIndex); // Відновлення відтворення
    }
  })
  .catch(error => console.error("Помилка завантаження станцій:", error));

// Функція для відтворення з повторними спробами
async function playWithRetry(url, retries, delay) {
  for (let i = 0; i < retries; i++) {
    try {
      audio.src = url;
      await audio.play();
      isPlaying = true;
      playPauseBtn.textContent = "⏸";
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      localStorage.setItem("isPlaying", isPlaying);
      return;
    } catch (error) {
      console.error(`Спроба ${i + 1} не вдалася:`, error);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error("Не вдалося відтворити станцію після всіх спроб");
}

// Теми
const themes = {
  black: {
    bodyBg: "#1A1A1A",
    containerBg: "#2A2A2A",
    accent: "#00B7EB",
    text: "#FFFFFF",
    font: "'Roboto', sans-serif"
  },
  light: {
    bodyBg: "#F5F5F5",
    containerBg: "#FFFFFF",
    accent: "#007BFF",
    text: "#1A1A1A",
    font: "'Roboto', sans-serif"
  },
  neonBlue: {
    bodyBg: "#0A0A1A",
    containerBg: "#1A1A2E",
    accent: "#00FFFF",
    text: "#E0E0E0",
    font: "'Roboto', sans-serif"
  },
  darkWhite: {
    bodyBg: "#121212",
    containerBg: "#1E1E1E",
    accent: "#FFFFFF",
    text: "#E0E0E0",
    font: "'Roboto', sans-serif"
  }
};
let currentTheme = localStorage.getItem("selectedTheme") || "black";

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
  if (!themes[theme]) {
    console.warn(`Тема ${theme} не знайдена, застосовується black`);
    theme = "black";
  }
  const themeStyles = themes[theme];
  console.log(`Застосовується тема: ${theme}`);

  document.body.style.background = themeStyles.bodyBg;
  document.body.style.fontFamily = themeStyles.font;
  document.body.style.color = themeStyles.text;

  const container = document.querySelector(".container");
  if (container) container.style.background = themeStyles.containerBg;

  const h1 = document.querySelector("h1");
  if (h1) h1.style.color = themeStyles.accent;

  document.querySelectorAll(".station-list, .control-btn, .theme-toggle, .current-station-info, .tab-btn").forEach(el => {
    el.style.background = themeStyles.containerBg;
    el.style.borderColor = themeStyles.accent;
    el.style.color = themeStyles.text;
    el.style.fontFamily = themeStyles.font;
  });

  document.querySelectorAll(".station-item").forEach(el => {
    el.style.background = themeStyles.containerBg;
    el.style.borderColor = themeStyles.text;
    el.style.color = themeStyles.text;
    el.style.fontFamily = themeStyles.font;
  });

  document.querySelectorAll(".station-item.selected").forEach(el => {
    el.style.background = themeStyles.accent;
    el.style.color = (theme === "neonBlue" || theme === "darkWhite") ? "#1A1A1A" : "#FFFFFF";
    el.style.borderColor = themeStyles.accent;
  });

  document.querySelectorAll(".tab-btn.active").forEach(el => {
    el.style.background = themeStyles.accent;
    el.style.color = (theme === "neonBlue" || theme === "darkWhite") ? "#1A1A1A" : "#FFFFFF";
    el.style.borderColor = themeStyles.accent;
  });

  const controlsContainer = document.querySelector(".controls-container");
  if (controlsContainer) {
    controlsContainer.style.background = themeStyles.containerBg;
    controlsContainer.style.borderColor = themeStyles.accent;
  }

  currentTheme = theme;
  localStorage.setItem("selectedTheme", theme);
}

function toggleTheme() {
  const themesOrder = ["black", "light", "neonBlue", "darkWhite"];
  const currentIndex = themesOrder.indexOf(currentTheme);
  const nextTheme = themesOrder[(currentIndex + 1) % themesOrder.length];
  console.log(`Перемикання з ${currentTheme} на ${nextTheme}`);
  applyTheme(nextTheme);
}

function switchTab(tab) {
  if (!["techno", "trance", "ukraine"].includes(tab)) {
    console.warn(`Вкладка ${tab} не підтримується, використовується techno`);
    tab = "techno";
  }
  currentTab = tab;
  localStorage.setItem("lastStationTab", tab);
  currentIndex = 0;
  updateStationList();
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  const activeTab = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if (activeTab) {
    activeTab.classList.add("active");
    console.log(`Вкладка ${tab} активована`);
  } else {
    console.warn(`Кнопка вкладки ${tab} не знайдена`);
  }
  changeStation(currentIndex);
}

function updateStationList() {
  if (!stationLists[currentTab]) {
    console.warn(`Дані для вкладки ${currentTab} відсутні`);
    return;
  }
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
  if (stationItems.length > 0) {
    stationItems[currentIndex].classList.add("selected");
  }
  applyTheme(currentTheme); // Повторно застосовуємо тему
  console.log(`Оновлено список станцій для ${currentTab}, вибрано індекс ${currentIndex}`);
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
  if (stationItems && stationItems.length > index && index >= 0) {
    stationItems.forEach(item => item.classList.remove("selected"));
    stationItems[index].classList.add("selected");
    currentIndex = index;
    const stationUrl = stationItems[index].dataset.value;
    updateCurrentStationInfo(stationItems[index]);
    if (isPlaying) {
      playWithRetry(stationUrl, 3, 2000);
    } else {
      audio.src = stationUrl;
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    }
    localStorage.setItem("lastStationIndex", index);
    localStorage.setItem("lastStationTab", currentTab);
    console.log(`Змінено станцію на індекс ${index}, URL: ${stationUrl}`);
  } else {
    console.warn(`Неможливо змінити станцію: індекс ${index}, stationItems: ${stationItems?.length}`);
  }
}

function updateCurrentStationInfo(item) {
  if (item) {
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
    playWithRetry(audio.src, 3, 2000);
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

function handleBluetoothConnection() {
  if (navigator.bluetooth && isPlaying) {
    playWithRetry(audio.src, 3, 2000);
  }
}

navigator.mediaSession.setActionHandler("previoustrack", () => prevStation());
navigator.mediaSession.setActionHandler("nexttrack", () => nextStation());
navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());

applyTheme(currentTheme);
window.addEventListener("blur", () => {
  if (document.hidden) {
    localStorage.setItem("lastStationIndex", currentIndex);
    localStorage.setItem("lastStationTab", currentTab);
  }
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