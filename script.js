document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
  const currentStationInfo = document.getElementById("currentStationInfo");
  const themeToggle = document.querySelector(".theme-toggle");

  audio.preload = "auto";
  audio.volume = 0.8;

  let currentTab = localStorage.getItem("currentTab") || "galaxy";
  let currentIndex = 0;
  let isPlaying = false;
  let stationLists = {};

  function loadStations() {
    stationList.innerHTML = "<div class='station-item'>Loading...</div>";
    fetch("stations.json")
      .then(response => response.json())
      .then(data => {
        stationLists = data;
        switchTab(currentTab);
      })
      .catch(() => stationList.innerHTML = "<div class='station-item'>Failed to load stations</div>");
  }

  function switchTab(tab) {
    currentTab = tab;
    localStorage.setItem("currentTab", tab);
    currentIndex = 0;
    updateStationList();
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelector(`.tab-btn:nth-child(${["galaxy", "ambient", "chill", "electro"].indexOf(tab) + 1})`).classList.add("active");
    if (stationList.children.length) playStation();
  }

  function updateStationList() {
    const stations = stationLists[currentTab] || [];
    stationList.innerHTML = "";
    stations.forEach((station, index) => {
      const item = document.createElement("div");
      item.className = "station-item";
      item.textContent = `${station.emoji} ${station.name}`;
      item.addEventListener("click", () => {
        currentIndex = index;
        playStation();
      });
      stationList.appendChild(item);
    });
  }

  function playStation() {
    const station = stationLists[currentTab][currentIndex];
    if (!station) return;
    audio.src = station.value;
    currentStationInfo.innerHTML = `
      <div class="station-info-content">
        <div class="station-text">
          <div class="station-name">${station.name}</div>
          <div class="station-genre">Genre: ${station.genre}</div>
          <div class="station-country">Origin: ${station.country}</div>
        </div>
      </div>
    `;
    if (isPlaying) {
      audio.play().then(() => {
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      }).catch(error => console.error("Play error:", error));
    }
  }

  function togglePlayPause() {
    if (audio.paused) {
      isPlaying = true;
      playPauseBtn.textContent = "⏸";
      audio.play().then(() => {
        document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
      }).catch(error => console.error("Play error:", error));
    } else {
      isPlaying = false;
      audio.pause();
      playPauseBtn.textContent = "▶";
      document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
    }
  }

  function prevStation() {
    currentIndex = (currentIndex > 0) ? currentIndex - 1 : stationLists[currentTab].length - 1;
    playStation();
  }

  function nextStation() {
    currentIndex = (currentIndex < stationLists[currentTab].length - 1) ? currentIndex + 1 : 0;
    playStation();
  }

  document.querySelectorAll(".tab-btn").forEach((btn, index) => {
    const tabs = ["galaxy", "ambient", "chill", "electro"];
    btn.addEventListener("click", () => switchTab(tabs[index]));
  });

  document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
  document.querySelector(".controls .control-btn:nth-child(2)").addEventListener("click", togglePlayPause);
  document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);

  themeToggle.addEventListener("click", () => {
    const themes = ["#1E1E2F", "#2F2E1E", "#1E2F2E"];
    document.documentElement.style.setProperty("--body-bg", themes[Math.floor(Math.random() * themes.length)]);
  });

  audio.addEventListener("playing", () => {
    playPauseBtn.textContent = "⏸";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "running");
  });

  audio.addEventListener("pause", () => {
    playPauseBtn.textContent = "▶";
    document.querySelectorAll(".wave-bar").forEach(bar => bar.style.animationPlayState = "paused");
  });

  loadStations();
});