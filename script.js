let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let intendedPlaying = localStorage.getItem("intendedPlaying") === "true" || false;
let stationLists = JSON.parse(localStorage.getItem("stationLists")) || {};
let userAddedStations = JSON.parse(localStorage.getItem("userAddedStations")) || {};
let stationItems = [];
let abortController = new AbortController();
let errorCount = 0;
const ERROR_LIMIT = 15;
let pastSearches = JSON.parse(localStorage.getItem("pastSearches")) || [];
let deletedStations = JSON.parse(localStorage.getItem("deletedStations")) || [];
let customTabs = JSON.parse(localStorage.getItem("customTabs")) || [];
let isAutoPlayPending = false;
let lastSuccessfulPlayTime = 0;
let streamAbortController = null;
let errorTimeout = null;
let autoPlayRequestId = 0; // Unique ID for autoplay requests
let searchState = JSON.parse(localStorage.getItem("searchState")) || { query: "", country: "", genre: "" };
customTabs = Array.isArray(customTabs) ? customTabs.filter(tab => typeof tab === "string" && tab.trim()) : [];

document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
  const currentStationInfo = document.getElementById("currentStationInfo");
  const themeToggle = document.querySelector(".theme-toggle");
  const shareButton = document.querySelector(".share-button");
  const exportButton = document.querySelector(".export-button");
  const importButton = document.querySelector(".import-button");
  const importFileInput = document.getElementById("importFileInput");
  const searchInput = document.getElementById("searchInput");
  const searchQuery = document.getElementById("searchQuery");
  const searchCountry = document.getElementById("searchCountry");
  const searchGenre = document.getElementById("searchGenre");
  const searchBtn = document.querySelector(".search-btn");
  const pastSearchesList = document.getElementById("pastSearches");
  const tabsContainer = document.getElementById("tabs");
  const lyricsDisplay = document.createElement("div");
  lyricsDisplay.id = "lyricsDisplay";
  currentStationInfo.after(lyricsDisplay);
  const miniPlayer = document.createElement("div");
  miniPlayer.id = "miniPlayer";
  miniPlayer.classList.add("hidden");
  miniPlayer.innerHTML = `
    <span class="mini-station-name">No Station</span>
    <span class="mini-play-pause">▶</span>
  `;
  document.body.appendChild(miniPlayer);

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !shareButton || !exportButton || !importButton || !importFileInput || !searchInput || !searchQuery || !searchCountry || !searchGenre || !searchBtn || !pastSearchesList || !tabsContainer) {
    console.error("One of required DOM elements not found", {
      audio: !!audio,
      stationList: !!stationList,
      playPauseBtn: !!playPauseBtn,
      currentStationInfo: !!currentStationInfo,
      themeToggle: !!themeToggle,
      shareButton: !!shareButton,
      exportButton: !!exportButton,
      importButton: !!importButton,
      importFileInput: !!importFileInput,
      searchInput: !!searchInput,
      searchQuery: !!searchQuery,
      searchCountry: !!searchCountry,
      searchGenre: !!searchGenre,
      searchBtn: !!searchBtn,
      pastSearchesList: !!pastSearchesList,
      tabsContainer: !!tabsContainer
    });
    setTimeout(initializeApp, 100);
    return;
  }

  initializeApp();

  function initializeApp() {
    audio.preload = "auto";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

    // iOS audio session configuration for background playback
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      audio.setAttribute("playsinline", "");
      audio.setAttribute("webkit-playsinline", "");
    }

    updatePastSearches();
    populateSearchSuggestions();
    renderTabs();

    // Restore search state
    searchQuery.value = searchState.query;
    searchCountry.value = searchState.country;
    searchGenre.value = searchState.genre;

    shareButton.addEventListener("click", () => {
      const stationName = currentStationInfo.querySelector(".station-name").textContent || "Radio S O";
      const shareData = {
        title: "Radio S O",
        text: `Listening to ${stationName} on Radio S O! Join my favorite radio stations!`,
        url: window.location.href
      };
      if (navigator.share) {
        navigator.share(shareData)
          .catch(error => console.error("Error sharing:", error));
      } else {
        alert(`Share function not supported. Copy: ${shareData.text} ${shareData.url}`);
      }
    });

    exportButton.addEventListener("click", exportSettings);
    importButton.addEventListener("click", () => importFileInput.click());
    importFileInput.addEventListener("change", importSettings);

    document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
    document.querySelector(".controls .control-btn:nth-child(2)").addEventListener("click", togglePlayPause);
    document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);

    searchBtn.addEventListener("click", () => {
      const query = searchQuery.value.trim();
      const country = normalizeCountry(searchCountry.value.trim());
      const genre = searchGenre.value.trim().toLowerCase();
      console.log("Search:", { query, country, genre });
      if (query || country || genre) {
        // Save search state
        searchState = { query, country, genre };
        localStorage.setItem("searchState", JSON.stringify(searchState));

        if (query && !pastSearches.includes(query)) {
          pastSearches.unshift(query);
          if (pastSearches.length > 5) pastSearches.pop();
          localStorage.setItem("pastSearches", JSON.stringify(pastSearches));
          updatePastSearches();
        }
        searchStations(query, country, genre);
      } else {
        console.warn("All search fields are empty");
        stationList.innerHTML = "<div class='station-item empty'>Enter station name, country or genre</div>";
      }
    });

    searchQuery.addEventListener("keypress", (e) => {
      if (e.key === "Enter") searchBtn.click();
    });

    searchCountry.addEventListener("keypress", (e) => {
      if (e.key === "Enter") searchBtn.click();
    });

    searchGenre.addEventListener("keypress", (e) => {
      if (e.key === "Enter") searchBtn.click();
    });

    // Mini-player interactions
    miniPlayer.querySelector(".mini-play-pause").addEventListener("click", togglePlayPause);
    miniPlayer.addEventListener("swipeup", () => { /* Expand player logic */ });
    miniPlayer.addEventListener("swipedown", () => miniPlayer.classList.add("hidden"));

    // Drag and drop for stations
    stationList.addEventListener("dragstart", handleDragStart);
    stationList.addEventListener("dragover", handleDragOver);
    stationList.addEventListener("drop", handleDrop);
    stationList.addEventListener("dragend", handleDragEnd);

    function handleDragStart(e) {
      if (e.target.classList.contains("drag-handle")) {
        const item = e.target.closest(".station-item");
        item.classList.add("dragging");
        e.dataTransfer.setData("text/plain", Array.from(stationList.children).indexOf(item));
      }
    }

    function handleDragOver(e) {
      e.preventDefault();
      const dragging = document.querySelector(".dragging");
      if (!dragging) return;
      const items = Array.from(stationList.children);
      const draggedIndex = items.indexOf(dragging);
      const targetIndex = items.indexOf(e.target.closest(".station-item"));
      if (targetIndex > -1 && draggedIndex !== targetIndex) {
        stationList.insertBefore(dragging, targetIndex > draggedIndex ? items[targetIndex].nextSibling : items[targetIndex]);
        // Update stationLists or userAddedStations accordingly
        updateStationOrder();
      }
    }

    function handleDrop(e) {
      e.preventDefault();
    }

    function handleDragEnd(e) {
      const item = e.target.closest(".station-item");
      if (item) item.classList.remove("dragging");
    }

    function updateStationOrder() {
      // Logic to update the order in stationLists[currentTab]
      const newOrder = Array.from(stationList.children).map(item => ({
        value: item.dataset.value,
        name: item.querySelector(".station-name").textContent,
        genre: item.dataset.genre,
        emoji: item.dataset.emoji,
        country: item.dataset.country,
        favicon: item.dataset.favicon
      }));
      stationLists[currentTab] = newOrder;
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
    }

    function exportSettings() {
      const settings = {
        selectedTheme: localStorage.getItem("selectedTheme") || "shadow-pulse",
        customTabs: JSON.parse(localStorage.getItem("customTabs")) || [],
        userAddedStations: JSON.parse(localStorage.getItem("userAddedStations")) || {},
        favoriteStations: JSON.parse(localStorage.getItem("favoriteStations")) || [],
        pastSearches: JSON.parse(localStorage.getItem("pastSearches")) || [],
        deletedStations: JSON.parse(localStorage.getItem("deletedStations")) || [],
        currentTab: localStorage.getItem("currentTab") || "techno",
        searchState: JSON.parse(localStorage.getItem("searchState")) || {}
      };
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "radio_settings.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log("Settings exported:", settings);
    }

    function importSettings(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const settings = JSON.parse(e.target.result);
          if (!settings || typeof settings !== "object") {
            alert("Invalid settings file!");
            return;
          }
          const validThemes = [
            "shadow-pulse", "dark-abyss", "emerald-glow", "retro-wave",
            "neon-pulse", "lime-surge", "flamingo-flash", "aqua-glow",
            "aurora-haze", "starlit-amethyst", "lunar-frost"
          ];
          if (settings.selectedTheme && validThemes.includes(settings.selectedTheme)) {
            localStorage.setItem("selectedTheme", settings.selectedTheme);
            applyTheme(settings.selectedTheme);
          }
          if (Array.isArray(settings.customTabs)) {
            customTabs = settings.customTabs.filter(tab => typeof tab === "string" && tab.trim());
            localStorage.setItem("customTabs", JSON.stringify(customTabs));
            renderTabs();
          }
          if (settings.userAddedStations && typeof settings.userAddedStations === "object") {
            userAddedStations = settings.userAddedStations;
            localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
          }
          if (Array.isArray(settings.favoriteStations)) {
            favoriteStations = settings.favoriteStations;
            localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
          }
          if (Array.isArray(settings.pastSearches)) {
            pastSearches = settings.pastSearches;
            localStorage.setItem("pastSearches", JSON.stringify(pastSearches));
            updatePastSearches();
          }
          if (Array.isArray(settings.deletedStations)) {
            deletedStations = settings.deletedStations;
            localStorage.setItem("deletedStations", JSON.stringify(deletedStations));
          }
          if (settings.currentTab) {
            currentTab = settings.currentTab;
            localStorage.setItem("currentTab", currentTab);
            switchTab(currentTab);
          }
          if (settings.searchState) {
            searchState = settings.searchState;
            localStorage.setItem("searchState", JSON.stringify(searchState));
            searchQuery.value = searchState.query || "";
            searchCountry.value = searchState.country || "";
            searchGenre.value = searchState.genre || "";
            if (currentTab === "search") {
              searchStations(searchState.query, searchState.country, searchState.genre);
            }
          }
          loadStations();
          alert("Settings imported successfully!");
        } catch (error) {
          console.error("Error importing settings:", error);
          alert("Error importing settings. Check console for details.");
        }
      };
      reader.readAsText(file);
    }

    function updatePastSearches() {
      pastSearchesList.innerHTML = pastSearches.map(search => `<option value="${search}">`).join("");
    }

    function populateSearchSuggestions() {
      const suggestedCountries = document.getElementById("suggestedCountries");
      const suggestedGenres = document.getElementById("suggestedGenres");
      const countries = new Set();
      const genres = new Set();
      Object.values(stationLists).flat().forEach(station => {
        if (station.country) countries.add(station.country);
        if (station.genre) genres.add(station.genre);
      });
      suggestedCountries.innerHTML = Array.from(countries).map(c => `<option value="${c}">`).join("");
      suggestedGenres.innerHTML = Array.from(genres).map(g => `<option value="${g}">`).join("");
    }

    function renderTabs() {
      tabsContainer.innerHTML = "";
      ["best", "techno", "trance", "ukraine", "pop", "search"].forEach(tab => {
        const btn = document.createElement("button");
        btn.classList.add("tab-btn");
        btn.dataset.tab = tab;
        btn.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
        btn.addEventListener("click", () => switchTab(tab));
        tabsContainer.appendChild(btn);
      });
      customTabs.forEach(tab => {
        const btn = document.createElement("button");
        btn.classList.add("tab-btn");
        btn.dataset.tab = tab;
        btn.textContent = tab;
        btn.addEventListener("click", () => switchTab(tab));
        btn.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          showEditTabModal(tab);
        });
        tabsContainer.appendChild(btn);
      });
      const addBtn = document.createElement("button");
      addBtn.classList.add("add-tab-btn");
      addBtn.textContent = "+";
      addBtn.addEventListener("click", showNewTabModal);
      tabsContainer.appendChild(addBtn);
      document.querySelector(`.tab-btn[data-tab="${currentTab}"]`)?.classList.add("active");
      if (currentTab === "search") {
        searchInput.style.display = "flex";
      } else {
        searchInput.style.display = "none";
      }
    }

    function switchTab(tab) {
      document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
      document.querySelector(`.tab-btn[data-tab="${tab}"]`)?.classList.add("active");
      currentTab = tab;
      localStorage.setItem("currentTab", currentTab);
      if (tab === "search") {
        searchInput.style.display = "flex";
        if (searchState.query || searchState.country || searchState.genre) {
          searchStations(searchState.query, searchState.country, searchState.genre);
        } else {
          stationList.innerHTML = "<div class='station-item empty'>Enter search criteria</div>";
        }
      } else {
        searchInput.style.display = "none";
        loadStations();
      }
    }

    function showNewTabModal() {
      const modal = document.querySelector(".new-tab-modal");
      modal.style.display = "flex";
      const input = document.getElementById("newTabName");
      input.value = "";
      input.focus();
      document.getElementById("createTabBtn").addEventListener("click", createNewTab);
      document.querySelector(".new-tab-modal .modal-cancel-btn").addEventListener("click", hideNewTabModal);
    }

    function hideNewTabModal() {
      document.querySelector(".new-tab-modal").style.display = "none";
      document.getElementById("createTabBtn").removeEventListener("click", createNewTab);
      document.querySelector(".new-tab-modal .modal-cancel-btn").removeEventListener("click", hideNewTabModal);
    }

    function createNewTab() {
      const tabName = document.getElementById("newTabName").value.trim();
      if (tabName && !customTabs.includes(tabName)) {
        customTabs.push(tabName);
        localStorage.setItem("customTabs", JSON.stringify(customTabs));
        stationLists[tabName] = [];
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        renderTabs();
        switchTab(tabName);
      }
      hideNewTabModal();
    }

    function showEditTabModal(tab) {
      const modal = document.querySelector(".edit-tab-modal");
      modal.style.display = "flex";
      const input = document.getElementById("renameTabName");
      input.value = tab;
      input.focus();
      document.getElementById("renameTabBtn").addEventListener("click", () => renameTab(tab));
      document.getElementById("deleteTabBtn").addEventListener("click", () => deleteTab(tab));
      document.querySelector(".edit-tab-modal .modal-cancel-btn").addEventListener("click", hideEditTabModal);
    }

    function hideEditTabModal() {
      document.querySelector(".edit-tab-modal").style.display = "none";
      document.getElementById("renameTabBtn").removeEventListener("click", renameTab);
      document.getElementById("deleteTabBtn").removeEventListener("click", deleteTab);
      document.querySelector(".edit-tab-modal .modal-cancel-btn").removeEventListener("click", hideEditTabModal);
    }

    function renameTab(oldName) {
      const newName = document.getElementById("renameTabName").value.trim();
      if (newName && newName !== oldName && !customTabs.includes(newName)) {
        const index = customTabs.indexOf(oldName);
        customTabs[index] = newName;
        localStorage.setItem("customTabs", JSON.stringify(customTabs));
        if (stationLists[oldName]) {
          stationLists[newName] = stationLists[oldName];
          delete stationLists[oldName];
          localStorage.setItem("stationLists", JSON.stringify(stationLists));
        }
        if (currentTab === oldName) {
          currentTab = newName;
          localStorage.setItem("currentTab", currentTab);
        }
        renderTabs();
        switchTab(currentTab);
      }
      hideEditTabModal();
    }

    function deleteTab(tab) {
      if (confirm(`Delete tab "${tab}"?`)) {
        customTabs = customTabs.filter(t => t !== tab);
        localStorage.setItem("customTabs", JSON.stringify(customTabs));
        delete stationLists[tab];
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        if (currentTab === tab) {
          currentTab = "techno";
          localStorage.setItem("currentTab", currentTab);
        }
        renderTabs();
        switchTab(currentTab);
      }
      hideEditTabModal();
    }

    async function loadStations() {
      if (!stationLists[currentTab]) {
        try {
          const response = await fetch("stations.json");
          const data = await response.json();
          stationLists = data;
          localStorage.setItem("stationLists", JSON.stringify(stationLists));
        } catch (error) {
          console.error("Error loading stations:", error);
        }
      }
      updateStationList();
      if (stationItems.length > 0) {
        currentIndex = parseInt(localStorage.getItem("currentIndex")) || 0;
        if (currentIndex >= stationItems.length) currentIndex = 0;
        changeStation(currentIndex, false);
      }
    }

    function updateStationList() {
      stationList.innerHTML = "";
      const stations = (stationLists[currentTab] || []).filter(station => !deletedStations.includes(station.value));
      if (stations.length === 0) {
        stationList.innerHTML = "<div class='station-item empty'>No stations available</div>";
        return;
      }
      stations.forEach((station, index) => {
        const item = document.createElement("div");
        item.classList.add("station-item");
        item.dataset.index = index;
        item.dataset.value = station.value;
        item.dataset.genre = station.genre;
        item.dataset.country = station.country;
        item.dataset.emoji = station.emoji;
        item.dataset.favicon = station.favicon;
        item.innerHTML = `
          <img src="${station.favicon || 'default_favicon.png'}" alt="favicon" onerror="this.src='default_favicon.png';">
          <span class="station-name">${station.name}</span>
          <span class="favorite-btn ${favoriteStations.includes(station.value) ? 'favorited' : ''}">${favoriteStations.includes(station.value) ? '❤️' : '♡'}</span>
          <span class="delete-btn">🗑</span>
          <span class="drag-handle">☰</span>
        `;
        item.querySelector(".favorite-btn").addEventListener("click", () => toggleFavorite(station.value));
        item.querySelector(".delete-btn").addEventListener("click", () => deleteStation(station.value));
        item.addEventListener("click", () => changeStation(index));
        stationList.appendChild(item);
      });
      stationItems = Array.from(stationList.querySelectorAll(".station-item:not(.empty)"));
    }

    function toggleFavorite(url) {
      const index = favoriteStations.indexOf(url);
      if (index > -1) {
        favoriteStations.splice(index, 1);
      } else {
        favoriteStations.push(url);
      }
      localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
      updateStationList();
    }

    function deleteStation(url) {
      if (confirm("Delete this station?")) {
        deletedStations.push(url);
        localStorage.setItem("deletedStations", JSON.stringify(deletedStations));
        updateStationList();
      }
    }

    function normalizeUrl(url) {
      try {
        const u = new URL(url);
        u.searchParams.sort();
        return u.toString().replace(/\/$/, "");
      } catch {
        return url;
      }
    }

    function normalizeCountry(country) {
      const map = {
        "ua": "Україна",
        "ukraine": "Україна",
        "uk": "Україна"
      };
      return map[country.toLowerCase()] || country;
    }

    function searchStations(query, country, genre) {
      const results = Object.values(stationLists).flat().filter(station => {
        const matchesQuery = query ? station.name.toLowerCase().includes(query.toLowerCase()) : true;
        const matchesCountry = country ? normalizeCountry(station.country || "").toLowerCase().includes(country.toLowerCase()) : true;
        const matchesGenre = genre ? (station.genre || "").toLowerCase().includes(genre) : true;
        return matchesQuery && matchesCountry && matchesGenre && !deletedStations.includes(station.value);
      });
      stationList.innerHTML = "";
      if (results.length === 0) {
        stationList.innerHTML = "<div class='station-item empty'>No results found</div>";
      } else {
        results.forEach((station, index) => {
          const item = document.createElement("div");
          item.classList.add("station-item");
          item.dataset.index = index;
          item.dataset.value = station.value;
          item.dataset.genre = station.genre;
          item.dataset.country = station.country;
          item.dataset.emoji = station.emoji;
          item.dataset.favicon = station.favicon;
          item.innerHTML = `
            <img src="${station.favicon || 'default_favicon.png'}" alt="favicon" onerror="this.src='default_favicon.png';">
            <span class="station-name">${station.name}</span>
            <span class="favorite-btn ${favoriteStations.includes(station.value) ? 'favorited' : ''}">${favoriteStations.includes(station.value) ? '❤️' : '♡'}</span>
            <span class="delete-btn">🗑</span>
            <span class="drag-handle">☰</span>
          `;
          item.querySelector(".favorite-btn").addEventListener("click", () => toggleFavorite(station.value));
          item.querySelector(".delete-btn").addEventListener("click", () => deleteStation(station.value));
          item.addEventListener("click", () => changeStation(index));
          stationList.appendChild(item);
        });
      }
      stationItems = Array.from(stationList.querySelectorAll(".station-item:not(.empty)"));
    }

    function changeStation(index, play = true) {
      document.querySelectorAll(".station-item").forEach(item => item.classList.remove("active"));
      const item = stationItems[index];
      if (!item) return;
      item.classList.add("active");
      currentIndex = index;
      localStorage.setItem("currentIndex", currentIndex);
      const name = item.querySelector(".station-name").textContent;
      const genre = item.dataset.genre || "-";
      const country = item.dataset.country || "-";
      const emoji = item.dataset.emoji || "🎵";
      const favicon = item.dataset.favicon;
      currentStationInfo.querySelector(".station-name").textContent = name;
      currentStationInfo.querySelector(".station-genre").textContent = `жанр: ${genre}`;
      currentStationInfo.querySelector(".station-country").textContent = `країна: ${country}`;
      currentStationInfo.querySelector(".station-icon").textContent = emoji;
      miniPlayer.querySelector(".mini-station-name").textContent = name;
      if (favicon && isValidUrl(favicon)) {
        currentStationInfo.querySelector(".station-icon").innerHTML = `<img src="${favicon}" alt="icon" style="width:100%;height:100%;border-radius:50%;">`;
      }
      const url = item.dataset.value;
      audio.src = url;
      if (play && intendedPlaying) {
        tryAutoPlay();
      }
      updateMediaSession(item);
      fetchLyrics(name); // Assuming some API or logic to fetch lyrics
    }

    function isValidUrl(url) {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }

    function tryAutoPlay() {
      if (!intendedPlaying || !navigator.onLine || !stationItems.length || currentIndex >= stationItems.length) {
        console.log("tryAutoPlay: Skip, invalid state");
        return;
      }
      const currentUrl = stationItems[currentIndex].dataset.value;
      if (!currentUrl) {
        console.log("tryAutoPlay: No URL");
        return;
      }
      if (streamAbortController) {
        streamAbortController.abort();
      }
      streamAbortController = new AbortController();
      audio.src = currentUrl;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          console.log("Playback started successfully");
          lastSuccessfulPlayTime = Date.now();
          errorCount = 0;
          isPlaying = true;
          playPauseBtn.textContent = "⏸";
          document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
          currentStationInfo.querySelector(".station-icon").classList.remove("buffering");
          localStorage.setItem("isPlaying", true);
          // Haptic feedback
          if (navigator.vibrate) navigator.vibrate(50);
          // Show mini-player
          miniPlayer.classList.remove("hidden");
          miniPlayer.querySelector(".mini-play-pause").textContent = "⏸";
        }).catch(error => {
          if (error.name === "AbortError") {
            console.log("Playback aborted");
          } else {
            console.error("Playback failed:", error);
            currentStationInfo.querySelector(".station-icon").classList.add("buffering");
            if (errorCount < ERROR_LIMIT) {
              errorCount++;
              setTimeout(tryAutoPlay, 1000);
            } else {
              console.error("Reached error limit");
              resetStationInfo();
            }
          }
        });
      }
    }

    // Remove debouncedTryAutoPlay, use direct tryAutoPlay with timeouts

    function resetStationInfo() {
      currentStationInfo.querySelector(".station-name").textContent = "Обирайте станцію";
      currentStationInfo.querySelector(".station-genre").textContent = "жанр: -";
      currentStationInfo.querySelector(".station-country").textContent = "країна: -";
      currentStationInfo.querySelector(".station-icon").textContent = "🎵";
      lyricsDisplay.style.display = "none";
      lyricsDisplay.textContent = "";
      miniPlayer.querySelector(".mini-station-name").textContent = "No Station";
      miniPlayer.classList.add("hidden");
    }

    function updateMediaSession(item) {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.querySelector(".station-name").textContent,
          artist: `${item.dataset.genre || ""} | ${item.dataset.country || ""}`,
          album: "Radio Music S O",
          artwork: item.dataset.favicon && isValidUrl(item.dataset.favicon) ? [
            { src: item.dataset.favicon, sizes: "96x96", type: "image/png" },
            { src: item.dataset.favicon, sizes: "128x128", type: "image/png" },
            { src: item.dataset.favicon, sizes: "192x192", type: "image/png" },
            { src: item.dataset.favicon, sizes: "256x256", type: "image/png" },
            { src: item.dataset.favicon, sizes: "384x384", type: "image/png" },
            { src: item.dataset.favicon, sizes: "512x512", type: "image/png" }
          ] : []
        });
      }
    }

    function prevStation() {
      if (!stationItems?.length) return;
      currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
      if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
      changeStation(currentIndex);
      // Crossfade logic: fade out current, fade in new
      audio.volume = 0;
      setTimeout(() => { audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9; }, 500);
    }

    function nextStation() {
      if (!stationItems?.length) return;
      currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
      if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
      changeStation(currentIndex);
      // Crossfade
      audio.volume = 0;
      setTimeout(() => { audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9; }, 500);
    }

    function togglePlayPause() {
      if (!playPauseBtn || !audio) {
        console.error("playPauseBtn or audio not found");
        return;
      }
      if (audio.paused) {
        intendedPlaying = true;
        tryAutoPlay();
        playPauseBtn.textContent = "⏸";
        miniPlayer.querySelector(".mini-play-pause").textContent = "⏸";
        document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
      } else {
        audio.pause();
        isPlaying = false;
        intendedPlaying = false;
        playPauseBtn.textContent = "▶";
        miniPlayer.querySelector(".mini-play-pause").textContent = "▶";
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      }
      localStorage.setItem("isPlaying", isPlaying);
      localStorage.setItem("intendedPlaying", intendedPlaying);
    }

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
        if (document.hidden || !intendedPlaying || !navigator.onLine || !stationItems?.length || currentIndex >= stationItems.length) {
          console.log("visibilitychange: Skip, tab hidden or invalid state");
          return;
        }
        const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) {
          console.log("visibilitychange: Skip playback, station already playing");
        } else {
          console.log("visibilitychange: Starting playback after visibility change");
          tryAutoPlay();
        }
      },
      resume: () => {
        if (!intendedPlaying || !navigator.onLine || !stationItems?.length || currentIndex >= stationItems.length) {
          console.log("resume: Skip, invalid state");
          return;
        }
        const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) {
          console.log("resume: Skip playback, station already playing");
        } else {
          console.log("resume: Starting playback after app resume");
          tryAutoPlay();
        }
      },
      online: () => {
        console.log("Network restored");
        if (intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
          tryAutoPlay();
        }
      },
      offline: () => {
        console.log("Network connection lost");
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
        errorCount = 0;
        // Attempt reconnect when back online
      }
    };

    function addEventListeners() {
      document.addEventListener("keydown", eventListeners.keydown);
      document.addEventListener("visibilitychange", eventListeners.visibilitychange);
      document.addEventListener("resume", eventListeners.resume);
      window.addEventListener("online", eventListeners.online);
      window.addEventListener("offline", eventListeners.offline);
    }

    function removeEventListeners() {
      document.removeEventListener("keydown", eventListeners.keydown);
      document.removeEventListener("visibilitychange", eventListeners.visibilitychange);
      document.removeEventListener("resume", eventListeners.resume);
      window.removeEventListener("online", eventListeners.online);
      window.removeEventListener("offline", eventListeners.offline);
    }

    audio.addEventListener("playing", () => {
      isPlaying = true;
      playPauseBtn.textContent = "⏸";
      miniPlayer.querySelector(".mini-play-pause").textContent = "⏸";
      document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
      currentStationInfo.querySelector(".station-icon").classList.remove("buffering");
      localStorage.setItem("isPlaying", isPlaying);
      if (errorTimeout) {
        clearTimeout(errorTimeout);
        errorTimeout = null;
      }
    });

    audio.addEventListener("pause", () => {
      isPlaying = false;
      playPauseBtn.textContent = "▶";
      miniPlayer.querySelector(".mini-play-pause").textContent = "▶";
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      localStorage.setItem("isPlaying", isPlaying);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
      }
    });

    audio.addEventListener("error", () => {
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      currentStationInfo.querySelector(".station-icon").classList.add("buffering");
      console.error("Audio error:", audio.error?.message || "Unknown error", "for URL:", audio.src);
      if (intendedPlaying && errorCount < ERROR_LIMIT && !errorTimeout) {
        errorCount++;
        errorTimeout = setTimeout(() => {
          tryAutoPlay();
          errorTimeout = null;
        }, 1000);
      } else if (errorCount >= ERROR_LIMIT) {
        console.error("Reached playback error limit");
        resetStationInfo();
      }
    });

    audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", audio.volume);
    });

    audio.addEventListener("waiting", () => {
      currentStationInfo.querySelector(".station-icon").classList.add("buffering");
    });

    audio.addEventListener("canplay", () => {
      currentStationInfo.querySelector(".station-icon").classList.remove("buffering");
    });

    // Lyrics integration (placeholder)
    function fetchLyrics(stationName) {
      // Simulate fetching lyrics or metadata
      lyricsDisplay.textContent = "Lyrics or track info not available for this station.";
      lyricsDisplay.style.display = "block";
    }

    addEventListeners();

    window.addEventListener("beforeunload", () => {
      removeEventListeners();
      if (streamAbortController) {
        streamAbortController.abort();
        streamAbortController = null;
      }
    });

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => {
        if (intendedPlaying) return;
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        if (!isPlaying) return;
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler("previoustrack", prevStation);
      navigator.mediaSession.setActionHandler("nexttrack", nextStation);
    }

    // Theme application (assuming function exists)
    // applyTheme(currentTheme);

    loadStations();
    if (intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
      const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
      const normalizedAudioSrc = normalizeUrl(audio.src);
      if (normalizedAudioSrc !== normalizedCurrentUrl || audio.paused || audio.error || audio.readyState < 2 || audio.currentTime === 0) {
        console.log("initializeApp: Starting playback after initialization");
        tryAutoPlay();
      } else {
        console.log("initializeApp: Skip playback, station already playing");
      }
    } else {
      console.log("initializeApp: Skip playback, invalid state");
    }
  }
});