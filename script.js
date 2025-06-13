document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
  const homePage = document.getElementById("home-page");
  const detailsPage = document.getElementById("details-page");
  const stationDetails = document.getElementById("stationDetails");
  const backBtn = document.querySelector(".back-btn");
  const themeToggle = document.querySelector(".theme-toggle");

  audio.preload = "auto";
  audio.volume = 0.7;

  let currentTab = localStorage.getItem("currentTab") || "techno";
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
    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add("active");
    if (stationList.children.length) playStation();
  }

  function updateStationList() {
    const stations = stationLists[currentTab] || [];
    stationList.innerHTML = "";
    stations.forEach((station, index) => {
      const item = document.createElement("div");
      item.className = "station-item";
      item.textContent = `${station.emoji} ${station.name}`;
      item.addEventListener("click", () => showDetails(index));
      stationList.appendChild(item);
    });
  }

  function showDetails(index) {
    const station = stationLists[currentTab][index];
    currentIndex = index;
    stationDetails.innerHTML = `
      <h2>${station.name}</h2>
      <p>Genre: ${station.genre}</p>
      <p>Country: ${station.country}</p>
      <p>Stream: ${station.value}</p>
    `;
    homePage.classList.remove("active");
    detailsPage.classList.add("active");
  }

  function playStation() {
    const station = stationLists[currentTab][currentIndex];
    if (!station) return;
    audio.src = station.value;
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

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelector(".nav-item.active").classList.remove("active");
      item.classList.add("active");
      document.querySelector(".page.active").classList.remove("active");
      document.getElementById(`${item.dataset.page}-page`).classList.add("active");
    });
  });

  document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
  document.querySelector(".controls .control-btn:nth-child(2)").addEventListener("click", togglePlayPause);
  document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);

  backBtn.addEventListener("click", () => {
    detailsPage.classList.remove("active");
    homePage.classList.add("active");
  });

  themeToggle.addEventListener("click", () => {
    const themes = ["#1A1A2E", "#2E1A1A", "#1A2E1A"];
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