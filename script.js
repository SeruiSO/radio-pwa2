const audio = document.getElementById("audioPlayer");
const stationList = document.getElementById("stationList");
const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
const currentStationInfo = document.getElementById("currentStationInfo");
const searchInput = document.getElementById("stationSearch");
let currentIndex = parseInt(localStorage.getItem("lastStation")) || 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let currentTab = localStorage.getItem("currentTab") || "techno";
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = {};
let stationItems;
let hasUserInteraction = false;
let listenHistory = JSON.parse(localStorage.getItem("listenHistory")) || [];

document.addEventListener('click', () => {
  hasUserInteraction = true;
  if (audio.src && !audio.paused && !isPlaying && stationItems?.length > currentIndex) {
    changeStation(currentIndex);
    if (isPlaying) audio.play().catch(error => console.error("Playback error:", error));
  }
}, { once: true });

async function loadStations(attempt = 1) {
  try {
    const response = await fetch('stations.json');
    if (!response.ok) throw new Error('Failed to load stations.json: ' + response.statusText);
    stationLists = await response.json();
    const availableTabs = Object.keys(stationLists);
    if (!availableTabs.includes(currentTab)) {
      currentTab = availableTabs[0] || "techno";
      localStorage.setItem("currentTab", currentTab);
    }
    switchTab(currentTab);
    if (stationItems?.length > currentIndex && isPlaying) {
      changeStation(currentIndex);
      audio.play().catch(error => console.error("Autoplay error:", error));
    }
  } catch (error) {
    console.error("Load stations error (attempt " + attempt + "):", error);
    if ('caches' in window) {
      caches.match('stations.json').then(cacheResponse => {
        if (cacheResponse) {
          cacheResponse.json().then(cachedData => {
            stationLists = cachedData;
            const availableTabs = Object.keys(stationLists);
            if (!availableTabs.includes(currentTab)) {
              currentTab = availableTabs[0] || "techno";
              localStorage.setItem("currentTab", currentTab);
            }
            switchTab(currentTab);
            if (stationItems?.length > currentIndex && isPlaying) {
              changeStation(currentIndex);
              audio.play().catch(error => console.error("Autoplay error:", error));
            }
          });
        } else if (attempt < 3) {
          setTimeout(() => loadStations(attempt + 1), 1000);
        } else {
          stationList.innerHTML = '<div style="color: red; padding: 10px;">Помилка завантаження станцій.</div>';
        }
      });
    } else if (attempt < 3) {
      setTimeout(() => loadStations(attempt + 1), 1000);
    } else {
      stationList.innerHTML = '<div style="color: red; padding: 10px;">Помилка завантаження станцій.</div>';
    }
  }
}

loadStations();

const themes = {
  dark: { bodyBg: "linear-gradient(180deg, #0a0a1a, #1a1a2e)", containerBg: "transparent", accent: "#00d4ff", text: "#fff" },
  light: { bodyBg: "linear-gradient(180deg, #f0f0f0, #e0e0e0)", containerBg: "transparent", accent: "#007bff", text: "#000" },
  neon: { bodyBg: "linear-gradient(180deg, #0a0a1a, #2e1a3e)", containerBg: "transparent", accent: "#ff00cc", text: "#fff" },
  "light-alt": { bodyBg: "linear-gradient(180deg, #f5f5e6, #fff5e1)", containerBg: "transparent", accent: "#1e90ff", text: "#333" },
  "dark-alt": { bodyBg: "linear-gradient(180deg, #1a1a2a, #3e3e4e)", containerBg: "transparent", accent: "#00ff00", text: "#e0e0e0" }
};
let currentTheme = localStorage.getItem("selectedTheme") || "dark";

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(registration => {
    registration.update();
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          if (confirm('Доступна нова версія. Оновити?')) {
            window.location.reload();
          }
        }
      });
    });
  });
}

function applyTheme(theme) {
  document.body.style.background = themes[theme].bodyBg;
  document.querySelectorAll(".station-list, .control-btn, .theme-toggle, .current-station-info, .tab-btn, .share-btn").forEach(el => {
    el.style.borderColor = themes[theme].accent;
    el.style.color = themes[theme].text;
  });
  document.querySelectorAll(".station-item").forEach(el => {
    el.style.color = themes[theme].text;
  });
  document.querySelector("h1").style.color = themes[theme].accent;
  document.querySelector("#stationSearch").style.borderColor = themes[theme].accent;
  currentTheme = theme;
  localStorage.setItem("selectedTheme", theme);
}

function toggleTheme() {
  const themesOrder = ["dark", "light", "neon", "light-alt", "dark-alt"];
  const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % 5];
  applyTheme(nextTheme);
}

function switchTab(tab) {
  if (!["techno", "trance", "ukraine", "favorites", "recommendations"].includes(tab)) tab = "techno";
  currentTab = tab;
  localStorage.setItem("currentTab", tab);
  const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
  currentIndex = savedIndex < (getStationsForTab(tab)?.length || 0) ? savedIndex : 0;
  updateStationList();
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`).classList.add("active");
  gsap.to(".tab-btn", { scale: tab === currentTab ? 1.1 : 1, duration: 0.3 });
  if (stationItems?.length > currentIndex && isPlaying) {
    changeStation(currentIndex);
    audio.play().catch(error => console.error("Autoplay error:", error));
  }
}

function getStationsForTab(tab) {
  if (tab === "favorites") {
    return Object.values(stationLists).flat().filter(station => favoriteStations.includes(station.name));
  } else if (tab === "recommendations") {
    const favoriteGenres = listenHistory.reduce((acc, name) => {
      const station = Object.values(stationLists).flat().find(s => s.name === name);
      if (station) acc[station.genre] = (acc[station.genre] || 0) + 1;
      return acc;
    }, {});
    const topGenres = Object.entries(favoriteGenres).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([genre]) => genre);
    return Object.values(stationLists).flat().filter(station => topGenres.includes(station.genre));
  }
  return stationLists[tab] || [];
}

function updateStationList() {
  stationList.innerHTML = '';
  let stations = getStationsForTab(currentTab);
  const query = searchInput.value.toLowerCase();
  if (query) {
    stations = stations.filter(station =>
      station.name.toLowerCase().includes(query) ||
      station.genre.toLowerCase().includes(query) ||
      station.country.toLowerCase().includes(query)
    );
  }
  if (!stations || stations.length === 0) {
    stationList.innerHTML = `<div style="color: yellow; padding: 10px;">Немає станцій для ${currentTab === 'favorites' ? 'улюблених' : currentTab}.</div>`;
    return;
  }

  stations.forEach((station, index) => {
    const item = document.createElement("div");
    item.className = `station-item ${index === currentIndex ? 'selected' : ''}`;
    item.dataset.value = station.value;
    item.dataset.name = station.name;
    item.dataset.genre = station.genre;
    item.dataset.country = station.country;
    item.innerHTML = `${station.emoji} ${station.name}<button class="favorite-btn${favoriteStations.includes(station.name) ? ' favorited' : ''}">★</button>`;
    stationList.appendChild(item);
    gsap.from(item, { opacity: 0, y: 20, duration: 0.5, delay: index * 0.1 });
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
      gsap.to(favoriteBtn, { scale: 1.5, duration: 0.2, yoyo: true, repeat: 1 });
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

function changeStation(index) {
  if (index < 0 || index >= stationItems.length) return;
  const item = stationItems[index];
  stationItems.forEach(item => item.classList.remove("selected"));
  item.classList.add("selected");
  currentIndex = index;
  audio.src = item.dataset.value;
  updateCurrentStationInfo(item);
  listenHistory.push(item.dataset.name);
  localStorage.setItem("listenHistory", JSON.stringify(listenHistory.slice(-100)));
  fetchMetadata(item.dataset.value);
  if (isPlaying && hasUserInteraction) {
    audio.play().catch(error => console.error("Playback error:", error));
  }
  localStorage.setItem("isPlaying", isPlaying);
  localStorage.setItem(`lastStation_${currentTab}`, currentIndex);
  gsap.to(item, { scale: 1.05, duration: 0.2, yoyo: true, repeat: 1 });
}

function updateCurrentStationInfo(item) {
  currentStationInfo.querySelector(".station-name").textContent = item.dataset.name || "Немає даних";
  currentStationInfo.querySelector(".station-genre").textContent = `жанр: ${item.dataset.genre || '-'}`;
  currentStationInfo.querySelector(".station-country").textContent = `країна: ${item.dataset.country || '-'}`;
  currentStationInfo.querySelector(".now-playing").textContent = `Зараз грає: -`;
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.dataset.name || "Невідома станція",
      artist: `${item.dataset.genre || '-'} | ${item.dataset.country || '-'}`,
      album: 'VibeWave Radio'
    });
  }
}

function fetchMetadata(url) {
  try {
    const icy = new IcyMetadata(url);
    icy.on('metadata', (metadata) => {
      const nowPlaying = metadata.StreamTitle || '-';
      currentStationInfo.querySelector(".now-playing").textContent = `Зараз грає: ${nowPlaying}`;
    });
  } catch (error) {
    console.error("Metadata error:", error);
  }
}

function shareStation() {
  if (stationItems?.[currentIndex]) {
    const station = stationItems[currentIndex];
    const shareData = {
      title: `Слухаю ${station.dataset.name} на VibeWave Radio!`,
      text: `Приєднуйся до прослуховування ${station.dataset.name} (${station.dataset.genre}, ${station.dataset.country})`,
      url: window.location.href
    };
    if (navigator.share) {
      navigator.share(shareData).catch(error => console.error("Share error:", error));
    } else {
      alert(`Поділитися: ${shareData.title}\n${shareData.text}`);
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
    if (hasUserInteraction) {
      audio.play().catch(error => console.error("Playback error:", error));
      playPauseBtn.textContent = "⏸";
      isPlaying = true;
    }
  } else {
    audio.pause();
    playPauseBtn.textContent = "▶";
    isPlaying = false;
  }
  localStorage.setItem("isPlaying", isPlaying);
}

searchInput.addEventListener("input", () => updateStationList());

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") prevStation();
  if (e.key === "ArrowRight") nextStation();
  if (e.key === " ") {
    e.preventDefault();
    togglePlayPause();
  }
});

audio.addEventListener("playing", () => {
  playPauseBtn.textContent = "⏸";
  isPlaying = true;
  localStorage.setItem("isPlaying", isPlaying);
});

audio.addEventListener("pause", () => {
  playPauseBtn.textContent = "▶";
  isPlaying = false;
  localStorage.setItem("isPlaying", isPlaying);
});

navigator.mediaSession.setActionHandler("previoustrack", () => prevStation());
navigator.mediaSession.setActionHandler("nexttrack", () => nextStation());
navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());

applyTheme(currentTheme);
audio.volume = 0.5;

if (isPlaying) {
  setTimeout(() => {
    if (stationItems?.length > currentIndex) {
      changeStation(currentIndex);
      audio.play().catch(error => console.error("Autoplay error:", error));
    }
  }, 1000);
}