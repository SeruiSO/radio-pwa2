let currentTab = localStorage.getItem("currentTab") || "techno";
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = JSON.parse(localStorage.getItem("stationLists")) || {};
let userAddedStations = JSON.parse(localStorage.getItem("userAddedStations")) || {};
let stationItems = [];
let abortController = new AbortController();
let pastSearches = JSON.parse(localStorage.getItem("pastSearches")) || [];
let deletedStations = JSON.parse(localStorage.getItem("deletedStations")) || [];
let customTabs = JSON.parse(localStorage.getItem("customTabs")) || [];
// Ensure customTabs is an array of strings
customTabs = Array.isArray(customTabs) ? customTabs.filter(tab => typeof tab === "string" && tab.trim()) : [];

document.addEventListener("DOMContentLoaded", () => {
  const audio = document.getElementById("audioPlayer");
  const stationList = document.getElementById("stationList");
  const playPauseBtn = document.querySelector(".controls .control-btn:nth-child(2)");
  const currentStationInfo = document.getElementById("currentStationInfo");
  const themeToggle = document.querySelector(".theme-toggle");
  const shareButton = document.querySelector(".share-button");
  const searchInput = document.getElementById("searchInput");
  const searchQuery = document.getElementById("searchQuery");
  const searchCountry = document.getElementById("searchCountry");
  const searchGenre = document.getElementById("searchGenre");
  const searchBtn = document.querySelector(".search-btn");
  const pastSearchesList = document.getElementById("pastSearches");
  const tabsContainer = document.getElementById("tabs");

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !shareButton || !searchInput || !searchQuery || !searchCountry || !searchGenre || !searchBtn || !pastSearchesList || !tabsContainer) {
    console.error("Один із необхідних DOM-елементів не знайдено", {
      audio: !!audio,
      stationList: !!stationList,
      playPauseBtn: !!playPauseBtn,
      currentStationInfo: !!currentStationInfo,
      themeToggle: !!themeToggle,
      shareButton: !!shareButton,
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
    audio.preload = "none"; // Вимикаємо автоматичне кешування
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

    updatePastSearches();
    populateSearchSuggestions();
    renderTabs();
    loadStations(); // Завантажуємо станції одразу

    shareButton.addEventListener("click", () => {
      const stationName = currentStationInfo.querySelector(".station-name").textContent || "Radio S O";
      const shareData = {
        title: "Radio S O",
        text: `Слухаю ${stationName} на Radio S O! Приєднуйтесь до улюблених радіостанцій!`,
        url: window.location.href
      };
      if (navigator.share) {
        navigator.share(shareData)
          .catch(error => console.error("Помилка при спробі поділитися:", error));
      } else {
        alert(`Функція поділитися не підтримується. Скопіюйте: ${shareData.text} ${shareData.url}`);
      }
    });

    document.querySelector(".controls .control-btn:nth-child(1)").addEventListener("click", prevStation);
    document.querySelector(".controls .control-btn:nth-child(2)").addEventListener("click", togglePlayPause);
    document.querySelector(".controls .control-btn:nth-child(3)").addEventListener("click", nextStation);

    searchBtn.addEventListener("click", () => {
      const query = searchQuery.value.trim();
      const country = normalizeCountry(searchCountry.value.trim());
      const genre = searchGenre.value.trim().toLowerCase();
      console.log("Пошук:", { query, country, genre });
      if (query || country || genre) {
        if (query && !pastSearches.includes(query)) {
          pastSearches.unshift(query);
          if (pastSearches.length > 5) pastSearches.pop();
          localStorage.setItem("pastSearches", JSON.stringify(pastSearches));
          updatePastSearches();
        }
        searchStations(query, country, genre);
      } else {
        console.warn("Усі поля пошуку порожні");
        stationList.innerHTML = "<div class='station-item empty'>Введіть назву, країну чи жанр</div>";
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

    function populateSearchSuggestions() {
      const suggestedCountries = [
        "Germany", "France", "United Kingdom", "Italy", "Spain", "Netherlands",
        "Switzerland", "Belgium", "Sweden", "Norway", "Denmark", "Austria",
        "Poland", "Ukraine", "Canada", "United States", "Australia", "Japan",
        "South Korea", "New Zealand"
      ];
      const suggestedGenres = [
        "Pop", "Rock", "Japan",
        "Electronic", "Jazz", "Classical", "Country", "Reggae",
        "Blues", "Folk", "Metal", "R&B", "Soul", "Ambient",
        "Techno", "Trance", "House", "EDM", "Hip-Hop", "Rap"
      ];
      const countryDatalist = document.getElementById("suggestedCountries");
      const genreDatalist = document.getElementById("suggestedGenres");

      countryDatalist.innerHTML = suggestedCountries.map(country => `<option value="${country}">`).join("");
      genreDatalist.innerHTML = suggestedGenres.map(genre => `<option value="${genre}">`).join("");
    }

    function updatePastSearches() {
      pastSearchesList.innerHTML = "";
      pastSearches.forEach(search => {
        const option = document.createElement("option");
        option.value = search;
        pastSearchesList.appendChild(option);
      });
    }

    function normalizeCountry(country) {
      if (!country) return "";
      const countryMap = {
        "ukraine": "Ukraine", "italy": "Italy", "german": "Germany",
        "germany": "Germany", "france": "France", "spain": "Spain",
        "usa": "United States", "united states": "United States",
        "uk": "United Kingdom", "united kingdom": "United Kingdom",
        "netherlands": "Netherlands", "canada": "Canada", "australia": "Australia",
        "switzerland": "Switzerland", "belgium": "Belgium", "poland": "Poland",
        "austria": "Austria", "sweden": "Sweden", "norway": "Norway",
        "denmark": "Denmark", "japan": "Japan", "south korea": "South Korea",
        "new zealand": "New Zealand"
      };
      const normalized = country.toLowerCase();
      return countryMap[normalized] || country.charAt(0).toUpperCase() + country.slice(1).toLowerCase();
    }

    function isValidUrl(url) {
      if (!url) return false;
      try {
        new URL(url);
        return /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(url);
      } catch {
        return false;
      }
    }

    function isAudioSupported(url) {
      const extension = url.split('.').pop().toLowerCase();
      const supportedFormats = ['mp3', 'aac', 'ogg', 'm3u', 'pls'];
      if (supportedFormats.includes(extension)) {
        return true;
      }
      console.warn(`Формат ${extension} може бути не підтримуваним:`, url);
      return false;
    }

    function resetStationInfo() {
      const stationNameElement = currentStationInfo.querySelector(".station-name");
      const stationGenreElement = currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = currentStationInfo.querySelector(".station-country");
      const stationIconElement = currentStationInfo.querySelector(".station-icon");
      if (stationNameElement) stationNameElement.textContent = "Обирайте станцію";
      else console.error("Елемент .station-name не знайдено");
      if (stationGenreElement) stationGenreElement.textContent = "жанр: -";
      else console.error("Елемент .station-genre не знайдено");
      if (stationCountryElement) stationCountryElement.textContent = "країна: -";
      else console.error("Елемент .station-country не знайдено");
      if (stationIconElement) {
        stationIconElement.innerHTML = "🎵";
        stationIconElement.style.backgroundImage = "none";
      } else console.error("Елемент .station-icon не знайдено");
    }

    async function loadStations() {
      console.time("loadStations");
      stationList.innerHTML = "<div class='station-item empty'>Завантаження...</div>";
      try {
        abortController.abort();
        abortController = new AbortController();
        const response = await fetch(`stations.json?t=${Date.now()}`, {
          cache: "no-store",
          signal: abortController.signal
        });
        console.log(`Статус відповіді: ${response.status}`);
        const mergedStationLists = {};
        if (response.ok) {
          const newStations = await response.json();
          // Process standard tabs from stations.json
          Object.keys(newStations).forEach(tab => {
            const uniqueStations = new Map();
            // Add user-added stations
            (userAddedStations[tab] || []).forEach(s => {
              if (!deletedStations.includes(s.name)) {
                uniqueStations.set(s.name, s);
              }
            });
            // Add stations from stations.json
            newStations[tab].forEach(s => {
              if (!deletedStations.includes(s.name)) {
                uniqueStations.set(s.name, s);
              }
            });
            mergedStationLists[tab] = Array.from(uniqueStations.values());
            console.log(`Додано до ${tab}:`, mergedStationLists[tab].map(s => s.name));
          });
        } else {
          console.warn("Не вдалося завантажити stations.json, використовуємо кешовані дані");
        }
        // Process custom tabs
        customTabs.forEach(tab => {
          const uniqueStations = new Map();
          (userAddedStations[tab] || []).forEach(s => {
            if (!deletedStations.includes(s.name)) {
              uniqueStations.set(s.name, s);
            }
          });
          (stationLists[tab] || []).forEach(s => {
            if (!deletedStations.includes(s.name)) {
              uniqueStations.set(s.name, s);
            }
          });
          mergedStationLists[tab] = Array.from(uniqueStations.values());
          console.log(`Збережено для кастомної вкладки ${tab}:`, mergedStationLists[tab].map(s => s.name));
        });
        stationLists = mergedStationLists;
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        favoriteStations = favoriteStations.filter(name => 
          Object.values(stationLists).flat().some(s => s.name === name)
        );
        localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
        const validTabs = [...Object.keys(stationLists), "best", "search", ...customTabs];
        if (!validTabs.includes(currentTab)) {
          currentTab = validTabs[0] || "techno";
          localStorage.setItem("currentTab", currentTab);
        }
        currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
        switchTab(currentTab);
        updateStationList(); // Оновлюємо список одразу після завантаження
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error("Помилка завантаження станцій:", error);
          customTabs.forEach(tab => {
            const uniqueStations = new Map();
            (userAddedStations[tab] || []).forEach(s => {
              if (!deletedStations.includes(s.name)) {
                uniqueStations.set(s.name, s);
              }
            });
            (stationLists[tab] || []).forEach(s => {
              if (!deletedStations.includes(s.name)) {
                uniqueStations.set(s.name, s);
              }
            });
            stationLists[tab] = Array.from(uniqueStations.values());
          });
          localStorage.setItem("stationLists", JSON.stringify(stationLists));
          stationList.innerHTML = "<div class='station-item empty'>Не вдалося завантажити станції</div>";
        }
      } finally {
        console.timeEnd("loadStations");
      }
    }

    async function searchStations(query, country, genre) {
      stationList.innerHTML = "<div class='station-item empty'>Пошук...</div>";
      try {
        abortController.abort();
        abortController = new AbortController();
        const params = new URLSearchParams();
        if (query) params.append("name", query);
        if (country) params.append("country", country);
        if (genre) params.append("tag", genre);
        params.append("order", "clickcount");
        params.append("reverse", "true");
        params.append("limit", "2000");
        const url = `https://de1.api.radio-browser.info/json/stations/search?${params.toString()}`;
        console.log("Запит до API:", url);
        const response = await fetch(url, {
          signal: abortController.signal
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        let stations = await response.json();
        stations = stations.filter(station => station.url_resolved && isValidUrl(station.url_resolved));
        console.log("Отримано станцій (після фільтрації HTTPS):", stations.length);
        renderSearchResults(stations);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error("Помилка пошуку станцій:", error);
          stationList.innerHTML = "<div class='station-item empty'>Не вдалося знайти станції</div>";
        }
      }
    }

    function renderSearchResults(stations) {
      if (!stations.length) {
        stationList.innerHTML = "<div class='station-item empty'>Нічого не знайдено</div>";
        stationItems = [];
        return;
      }
      const fragment = document.createDocumentFragment();
      stations.forEach((station, index) => {
        const item = document.createElement("div");
        item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
        item.dataset.value = station.url || station.url_resolved;
        item.dataset.name = station.name || "Unknown";
        item.dataset.genre = shortenGenre(station.tags || "Unknown");
        item.dataset.country = station.country || "Unknown";
        item.dataset.favicon = station.favicon && isValidUrl(station.favicon) ? station.favicon : "";
        const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" style="width: 32px; height: 32px; object-fit: contain; margin-right: 10px;" onerror="this.outerHTML='🎵 '">` : "🎵 ";
        item.innerHTML = `${iconHtml}<span class="station-name">${station.name}</span><button class="add-btn">ADD</button>`;
        fragment.appendChild(item);
      });
      stationList.innerHTML = "";
      stationList.appendChild(fragment);
      stationItems = document.querySelectorAll(".station-item");
      if (stationItems.length && currentIndex < stationItems.length) {
        changeStation(currentIndex);
      }
      stationList.onclick = e => {
        const item = e.target.closest(".station-item");
        const addBtn = e.target.closest(".add-btn");
        if (item && !item.classList.contains("empty")) {
          currentIndex = Array.from(stationItems).indexOf(item);
          changeStation(currentIndex);
        }
        if (addBtn) {
          e.stopPropagation();
          showTabModal(item);
        }
      };
    }

    function shortenGenre(tags) {
      const genres = tags.split(",").map(g => g.trim()).filter(g => g);
      return genres.length > 4 ? genres.slice(0, 4).join(", ") + "..." : genres.join(", ");
    }

    function showTabModal(item) {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.innerHTML = `
        <h2>Оберіть вкладку</h2>
        <div class="modal-tabs">
          <button class="modal-tab-btn" data-tab="techno">TECHNO</button>
          <button class="modal-tab-btn" data-tab="trance">Trance</button>
          <button class="modal-tab-btn" data-tab="ukraine">UA</button>
          <button class="modal-tab-btn" data-tab="pop">POP</button>
          ${customTabs.map(tab => `<button class="modal-tab-btn" data-tab="${tab}">${tab.toUpperCase()}</button>`).join('')}
          <button class="modal-cancel-btn">Відміна</button>
        </div>
      `;
      document.body.appendChild(overlay);
      document.body.appendChild(modal);
      const closeModal = () => {
        overlay.remove();
        modal.remove();
      };
      overlay.addEventListener("click", closeModal);
      modal.querySelectorAll(".modal-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const targetTab = btn.dataset.tab;
          saveStation(item, targetTab);
          closeModal();
        });
      });
      modal.querySelector(".modal-cancel-btn").addEventListener("click", closeModal);
    }

    function saveStation(item, targetTab) {
      const stationName = item.dataset.name;
      if (!stationLists[targetTab]) stationLists[targetTab] = [];
      if (!userAddedStations[targetTab]) userAddedStations[targetTab] = [];
      if (!stationLists[targetTab].some(s => s.name === stationName)) {
        const newStation = {
          value: item.dataset.value,
          name: item.dataset.name,
          genre: item.dataset.genre,
          country: item.dataset.country,
          favicon: item.dataset.favicon || ""
        };
        stationLists[targetTab].unshift(newStation);
        if (!userAddedStations[targetTab].some(s => s.name === stationName)) {
          userAddedStations[targetTab].unshift(newStation);
        }
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        console.log(`Додано станцію ${stationName} до ${targetTab}:`, newStation);
        if (currentTab !== "search") {
          updateStationList();
        }
      } else {
        alert("Ця станція вже додана до обраної вкладки!");
      }
    }

    function renderTabs() {
      const fixedTabs = ["best", "techno", "trance", "ukraine", "pop", "search"];
      tabsContainer.innerHTML = "";
      fixedTabs.forEach(tab => {
        const btn = document.createElement("button");
        btn.className = `tab-btn ${currentTab === tab ? "active" : ""}`;
        btn.dataset.tab = tab;
        btn.textContent = tab === "best" ? "Best" : tab === "ukraine" ? "UA" : tab === "search" ? "Search" : tab.charAt(0).toUpperCase() + tab.slice(1);
        tabsContainer.appendChild(btn);
      });
      customTabs.forEach(tab => {
        if (typeof tab !== "string" || !tab.trim()) return;
        const btn = document.createElement("button");
        btn.className = `tab-btn ${currentTab === tab ? "active" : ""}`;
        btn.dataset.tab = tab;
        btn.textContent = tab.toUpperCase();
        tabsContainer.appendChild(btn);
      });
      const addBtn = document.createElement("button");
      addBtn.className = "add-tab-btn";
      addBtn.textContent = "+";
      tabsContainer.appendChild(addBtn);

      tabsContainer.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
        if (customTabs.includes(btn.dataset.tab)) {
          let longPressTimer;
          btn.addEventListener("pointerdown", () => {
            longPressTimer = setTimeout(() => showEditTabModal(btn.dataset.tab), 500);
          });
          btn.addEventListener("pointerup", () => clearTimeout(longPressTimer));
          btn.addEventListener("pointerleave", () => clearTimeout(longPressTimer));
        }
      });

      addBtn.addEventListener("click", showNewTabModal);
    }

    function showNewTabModal() {
      const overlay = document.querySelector(".new-tab-modal");
      const modal = overlay.querySelector(".modal");
      const input = document.getElementById("newTabName");
      const createBtn = document.getElementById("createTabBtn");
      const cancelBtn = modal.querySelector(".modal-cancel-btn");

      overlay.style.display = "block";
      input.value = "";
      input.focus();

      const closeModal = () => {
        overlay.style.display = "none";
        createBtn.removeEventListener("click", createTabHandler);
        cancelBtn.removeEventListener("click", closeModal);
        overlay.removeEventListener("click", closeModal);
        input.removeEventListener("keypress", keypressHandler);
      };

      const createTabHandler = () => {
        const tabName = input.value.trim().toLowerCase();
        if (!tabName) {
          alert("Введіть назву вкладки!");
          return;
        }
        if (["best", "techno", "trance", "ukraine", "pop", "search"].includes(tabName) || customTabs.includes(tabName)) {
          alert("Ця назва вкладки вже існує!");
          return;
        }
        if (tabName.length > 20 || !/^[a-z0-9_-]+$/.test(tabName)) {
          alert("Назва вкладки не може перевищувати 20 символів і має містити лише латинські літери, цифри, дефіс або підкреслення.");
          return;
        }
        customTabs.push(tabName);
        stationLists[tabName] = [];
        userAddedStations[tabName] = [];
        localStorage.setItem("customTabs", JSON.stringify(customTabs));
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        console.log(`Створено нову вкладку ${tabName}`);
        renderTabs();
        switchTab(tabName);
        closeModal();
      };

      const keypressHandler = (e) => {
        if (e.key === "Enter") createBtn.click();
      };

      createBtn.addEventListener("click", createTabHandler);
      cancelBtn.addEventListener("click", closeModal);
      overlay.addEventListener("click", closeModal);
      input.addEventListener("keypress", keypressHandler);
    }

    function showEditTabModal(tab) {
      const overlay = document.querySelector(".edit-tab-modal");
      const modal = overlay.querySelector(".modal");
      const input = document.getElementById("renameTabName");
      const renameBtn = document.getElementById("renameTabBtn");
      const deleteBtn = document.getElementById("deleteTabBtn");
      const cancelBtn = document.querySelector(".modal-cancel-btn");

      overlay.style.display = "block";
      input.value = tab;
      input.focus();

      const closeModal = () => {
        overlay.style.display = "none";
        renameBtn.removeEventListener("click", renameTabHandler);
        deleteBtn.removeEventListener("click", deleteTabHandler);
        cancelBtn.removeEventListener("click", closeModal);
        overlay.removeEventListener("click", closeModal);
        input.removeEventListener("keypress", keypressHandler);
      };

      const renameTabHandler = () => {
        const newName = input.value.trim().toLowerCase();
        if (!newName) {
          alert("Введіть нову назву вкладки!");
          return;
        }
        if (["best", "techno", "trance", "ukraine", "pop", "search"].includes(newName) || customTabs.includes(newName)) {
          alert("Ця назва вкладки вже існує!");
          return;
        }
        if (newName.length > 20 || !/^[a-z0-9_-]+$/.test(newName)) {
          alert("Назва вкладки не може перевищувати 20 символів і має містити лише латинські літери, цифри, дефіс або підкреслення!");
          return;
        }
        const index = customTabs.indexOf(tab);
        customTabs[index] = newName;
        stationLists[newName] = stationLists[tab] || [];
        userAddedStations[newName] = userAddedStations[tab] || [];
        delete stationLists[tab];
        delete userAddedStations[tab];
        localStorage.setItem("customTabs", JSON.stringify(customTabs));
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
        if (currentTab === tab) switchTab(newName);
        renderTabs();
        closeModal();
      };

      const deleteTabHandler = () => {
        if (confirm(`Ви впевнені, що хочете видалити вкладку "${tab.toUpperCase()}"?`)) {
          customTabs = customTabs.filter(t => t !== tab);
          delete stationLists[tab];
          delete userAddedStations[tab];
          localStorage.setItem("customTabs", JSON.stringify(customTabs));
          localStorage.setItem("stationLists", JSON.stringify(stationLists));
          localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
          if (currentTab === tab) switchTab("techno");
          renderTabs();
          closeModal();
        }
      };

      const keypressHandler = (e) => {
        if (e.key === "Enter") renameBtn.click();
      };

      renameBtn.addEventListener("click", renameTabHandler);
      deleteBtn.addEventListener("click", deleteTabHandler);
      cancelBtn.addEventListener("click", closeModal);
      overlay.addEventListener("click", closeModal);
      input.addEventListener("keypress", keypressHandler);
    }

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
    if (!themes[currentTheme]) {
      currentTheme = "neon-pulse";
      localStorage.setItem("selectedTheme", currentTheme);
    }

    function applyTheme(theme) {
      if (!themes[theme]) {
        console.warn(`Тема ${theme} не знайдена, використовується 'neon-pulse'`);
        theme = "neon-pulse";
        localStorage.setItem("selectedTheme", theme);
      }
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
        "neon-pulse", "lime-surge", "flamingo-flash", "violet-vortex",
        "aqua-glow", "cosmic-indigo", "mystic-jade", "aurora-haze",
        "starlit-amethyst", "lunar-frost"
      ];
      const nextTheme = themesOrder[(themesOrder.indexOf(currentTheme) + 1) % themesOrder.length];
      applyTheme(nextTheme);
    }

    themeToggle.addEventListener("click", toggleTheme);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").then(registration => {
        registration.update();
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
                if (window.confirm("Доступна нова версія радіо. Оновити?")) {
                  window.location.reload();
                }
              }
            });
          }
        });
      });

      // Виправлено опечатку 'messaage' на 'message'
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "CACHE_UPDATED") {
          console.log("Отримано оновлення кешу, оновлюємо stationLists");
          const currentCacheVersion = localStorage.getItem("cacheVersion") || "0";
          if (currentCacheVersion !== event.data.cacheVersion) {
            stationLists = {};
            localStorage.setItem("stationLists", JSON.stringify(stationLists));
            favoriteStations = favoriteStations.filter((name) =>
              Object.values(stationLists).flat().some((s) => s.name === name)
            );
            localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
            localStorage.setItem("cacheVersion", event.data.cacheVersion);
            loadStations();
          }
        }
        if (event.data.type === "NETWORK_STATUS" && event.data.online && isPlaying && stationItems?.length && currentIndex < stationItems.length) {
          console.log("Мережа відновлена (Service Worker), пробуємо відновити потік");
          clearCacheAndPlayStream();
        }
      });
    }

    let reconnectStartTime = null;
    const MAX_RECONNECT_DURATION = 20 * 60 * 1000; // 20 хвилин
    let reconnectTimer = null;

    function clearCacheAndPlayStream() {
      if (!stationItems?.length || currentIndex >= stationItems.length || !isPlaying) {
        console.log("Пропуск clearCacheAndPlayStream", { isPlaying, hasStationItems: !!stationItems?.length, isIndexValid: currentIndex < stationItems.length });
        return;
      }
      const url = stationItems[currentIndex].dataset.value;
      if (!isValidUrl(url) || !isAudioSupported(url)) {
        console.error("Невалідний або непідтримуваний URL:", url);
        nextStation();
        return;
      }
      audio.pause();
      audio.src = "";
      audio.src = `${url}?t=${Date.now()}`;
      console.log("Очищено кеш, спроба відтворення потоку:", audio.src);
      const playPromise = audio.play();
      playPromise
        .then(() => {
          console.log("Потік відтворюється успішно");
          document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
          reconnectStartTime = null;
          clearTimeout(reconnectTimer);
        })
        .catch(error => {
          console.error("Помилка відтворення потоку:", error);
          document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
          if (error.name === "NotSupportedError") {
            console.warn("Формат не підтримується, переходимо до наступної станції");
            nextStation();
          } else {
            attemptReconnect();
          }
        });
    }

    function attemptReconnect() {
      if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length) {
        console.log("Пропуск attemptReconnect", { isPlaying, hasStationItems: !!stationItems?.length, isIndexValid: currentIndex < stationItems.length });
        return;
      }
      if (!reconnectStartTime) {
        reconnectStartTime = Date.now();
      }
      if (Date.now() - reconnectStartTime > MAX_RECONNECT_DURATION) {
        console.log("Досягнуто ліміт часу для повторного підключення (20 хвилин)");
        reconnectStartTime = null;
        isPlaying = false;
        localStorage.setItem("isPlaying", isPlaying);
        playPauseBtn.textContent = "▶";
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
        return;
      }
      console.log("Спроба повторного підключення до потоку...");
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(clearCacheAndPlayStream, 1000);
    }

    function monitorCache() {
      if (!audio.src || !isPlaying) return;
      const buffered = audio.buffered;
      if (buffered.length > 0) {
        const end = buffered.end(buffered.length - 1);
        const duration = end - audio.currentTime;
        if (duration > 10) {
          console.log("Кеш перевищує 10 секунд, очищаємо зайве");
          audio.pause();
          audio.src = "";
          audio.src = `${stationItems[currentIndex].dataset.value}?t=${Date.now()}`;
          audio.play().catch(error => console.error("Помилка при оновленні потоку:", error));
        }
      }
    }

    function tryAutoPlay() {
      if (!navigator.onLine) {
        console.log("Пристрій офлайн, відтворюємо кеш (до 10 секунд)");
        if (audio.buffered.length > 0 && isPlaying) {
          audio.play().catch(error => {
            console.error("Помилка відтворення кешу:", error);
            document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
          });
        }
        attemptReconnect();
        return;
      }
      if (!isPlaying || !stationItems?.length || currentIndex < stationItems.length) {
        console.log("Пропуск tryAutoPlay", { isPlaying, hasStationItems: !!stationItems?.length, isIndexValid: currentIndex < stationItems.length });
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
        return;
      }
      clearCacheAndPlayStream();
    }

    function switchTab(tab) {
      const validTabs = ["best", "techno", "trance", "ukraine", "pop", "search", ...customTabs];
      if (!validTabs.includes(tab)) {
        tab = "techno";
      }
      currentTab = tab;
      localStorage.setItem("currentTab", tab);
      const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
      const maxIndex = tab === "best" ? favoriteStations.length : tab === "search" ? 0 : stationLists[tab]?.length || 0;
      currentIndex = savedIndex < maxIndex ? savedIndex : 0;
      searchInput.style.display = tab === "search" ? "flex" : "none";
      searchQuery.value = "";
      searchCountry.value = "";
      searchGenre.value = "";
      if (tab === "search") populateSearchSuggestions();
      updateStationList();
      renderTabs();
      if (stationItems?.length && currentIndex < stationItems.length) {
        tryAutoPlay();
      }
    }

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
        stationList.innerHTML = `<div class="station-item empty">${currentTab === "best" ? "Немає улюблених станцій" : "Немає станцій у цій категорії"}</div>`;
        return;
      }

      const fragment = document.createDocumentFragment();
      stations.forEach((station, index) => {
        const item = document.createElement("div");
        item.className = `station-item ${index === currentIndex ? "selected" : ""}`;
        item.dataset.value = station.value;
        item.dataset.name = station.name;
        item.dataset.genre = shortenGenre(station.genre);
        item.dataset.country = station.country;
        item.dataset.favicon = station.favicon && isValidUrl(station.favicon) ? station.favicon : "";
        const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" style="width: 32px; height: 32px; object-fit: contain; margin-right: 10px;" onerror="this.outerHTML='🎵 '">` : "🎵 ";
        const deleteButton = ["techno", "trance", "ukraine", "pop", ...customTabs].includes(currentTab)
          ? `<button class="delete-btn">🗑</button>`
          : "";
        item.innerHTML = `
          ${iconHtml}
          <span class="station-name">${station.name}</span>
          <div class="buttons-container">
            ${deleteButton}
            <button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">★</button>
          </div>`;
        fragment.appendChild(item);
      });
      stationList.innerHTML = "";
      stationList.appendChild(fragment);
      stationItems = stationList.querySelectorAll(".station-item");

      if (stationItems.length && stationItems[currentIndex] && !stationItems[currentIndex].classList.contains("empty")) {
        stationItems[currentIndex].scrollIntoView({ behavior: "smooth", block: "center" });
      }

      stationList.onclick = e => {
        const item = e.target.closest(".station-item");
        const favoriteBtn = e.target.closest(".favorite-btn");
        const deleteBtn = e.target.closest(".delete-btn");
        if (item && !item.classList.contains("empty")) {
          currentIndex = Array.from(stationItems).indexOf(item);
          changeStation(currentIndex);
        }
        if (favoriteBtn) {
          e.stopPropagation();
          toggleFavorite(item.dataset.name);
        }
        if (deleteBtn) {
          e.stopPropagation();
          if (confirm(`Ви дійсно хочете видалити станцію "${item.dataset.name}" зі списку?`)) {
            deleteStation(item.dataset.name);
          }
        }
      };

      if (stationItems.length && currentIndex < stationItems.length) {
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
      if (currentTab === "best") switchTab("best");
      else updateStationList();
    }

    function deleteStation(stationName) {
      if (Array.isArray(stationLists[currentTab])) {
        stationLists[currentTab] = stationLists[currentTab].filter(s => s.name !== stationName);
        userAddedStations[currentTab] = userAddedStations[currentTab]?.filter(s => s.name !== stationName) || [];
      }
      favoriteStations = favoriteStations.filter(name => name !== stationName);
      if (!Array.isArray(deletedStations)) deletedStations = [];
      deletedStations.push(stationName);
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
      localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
      localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
      localStorage.setItem("deletedStations", JSON.stringify(deletedStations));
      console.log(`Видалено станцію ${stationName} з ${currentTab}, додано до deletedStations:`, deletedStations);
      if (stationLists[currentTab].length === 0) {
        currentIndex = 0;
      } else if (currentIndex >= stationLists[currentTab].length) {
        currentIndex = stationLists[currentTab].length - 1;
      }
      switchTab(currentTab);
    }

    function changeStation(index) {
      if (!stationItems || index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
      const item = stationItems[index];
      stationItems.forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");
      currentIndex = index;
      updateCurrentStation(item);
      localStorage.setItem(`lastStation_${currentTab}`, index);
      tryAutoPlay();
    }

    function updateCurrentStation(item) {
      if (!currentStationInfo) {
        console.error("currentStationInfo не знайдено");
        return;
      }
      const stationNameElement = currentStationInfo.querySelector(".station-name");
      const stationGenreElement = currentStationInfo.querySelector(".station-genre");
      const stationCountryElement = currentStationInfo.querySelector(".station-country");
      const stationIconElement = currentStationInfo.querySelector(".station-icon");

      console.log("Оновлення currentStationInfo з даними:", item.dataset);

      if (stationNameElement) {
        stationNameElement.textContent = item.dataset.name || "";
      } else {
        console.error("Елемент .station-name не знайдено");
      }
      if (stationGenreElement) {
        stationGenreElement.textContent = `жанр: ${item.dataset.genre || ""}`;
      } else {
        console.error("Елемент .station-genre не знайдено");
      }
      if (stationCountryElement) {
        stationCountryElement.textContent = `країна: ${item.dataset.country || ""}`;
      } else {
        console.error("Елемент .station-country не знайдено");
      }
      if (stationIconElement) {
        if (item.dataset.favicon && isValidUrl(item.dataset.favicon)) {
          stationIconElement.innerHTML = "";
          stationIconElement.style.backgroundImage = `url(${item.dataset.favicon})`;
          stationIconElement.style.backgroundSize = "contain";
          stationIconElement.style.backgroundRepeat = "no-repeat";
          stationIconElement.style.backgroundPosition = "center";
        } else {
          stationIconElement.innerHTML = "🎵";
          stationIconElement.style.backgroundImage = "none";
        }
      } else {
        console.error("Елемент .station-icon не знайдено");
      }
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: item.dataset.name || "Unknown Station",
          artist: `${item.dataset.genre || ""} | ${item.dataset.country || ""}`,
          album: "Radio Music S O"
        });
      }
    }

    function prevStation() {
      if (!stationItems?.length) return;
      currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
      if (stationItems[currentIndex].classList.contains("empty")) {
        currentIndex = 0;
      }
      changeStation(currentIndex);
    }

    function nextStation() {
      if (!stationItems?.length) return;
      currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
      if (stationItems[currentIndex].classList.contains("empty")) {
        currentIndex = 0;
      }
      changeStation(currentIndex);
    }

    function togglePlayPause() {
      if (!playPauseBtn || !audio) {
        console.error("playPauseBtn або аудіо не знайдено");
        return;
      }
      if (audio.paused) {
        isPlaying = true;
        tryAutoPlay();
        playPauseBtn.textContent = "⏸";
        document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
      } else {
        audio.pause();
        isPlaying = false;
        playPauseBtn.textContent = "▶";
        document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
        clearTimeout(reconnectTimer);
        reconnectStartTime = null;
      }
      localStorage.setItem("isPlaying", isPlaying);
    }

    const eventListeners = {
      keydown: e => {
        if (e.key === "ArrowLeft") {
          prevStation();
        } else if (e.key === "ArrowRight") {
          nextStation();
        } else if (e.key === " ") {
          e.preventDefault();
          togglePlayPause();
        }
      },
      visibilitychange: () => {
        if (!document.hidden && isPlaying && navigator.onLine) {
          console.log("Додаток повернувся в активний стан, пробуємо відновити потік");
          clearCacheAndPlayStream();
        }
      },
      resume: () => {
        if (isPlaying && navigator.connection?.type !== "none") {
          console.log("Додаток відновлено, пробуємо відновити потік");
          clearCacheAndPlayStream();
        }
      }
    };

    function addEventListeners() {
      document.addEventListener("keydown", eventListeners.keydown);
      document.addEventListener("visibilitychange", eventListeners.visibilitychange);
      document.addEventListener("resume", eventListeners.resume);
    }

    function removeEventListeners() {
      document.removeEventListener("keydown", eventListeners.keydown);
      document.removeEventListener("visibilitychange", eventListeners.visibilitychange);
      document.removeEventListener("resume", eventListeners.resume);
    }

    audio.addEventListener("playing", () => {
      isPlaying = true;
      playPauseBtn.textContent = "⏸";
      document.querySelectorAll(".wave-line").forEach(line => line.classList.add("playing"));
      localStorage.setItem("isPlaying", isPlaying);
      setInterval(monitorCache, 1000);
    });

    audio.addEventListener("pause", () => {
      isPlaying = false;
      playPauseBtn.textContent = "▶";
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      localStorage.setItem("isPlaying", isPlaying);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
      }
    });

    audio.addEventListener("error", () => {
      document.querySelectorAll(".wave-line").forEach(line => line.classList.remove("playing"));
      console.error("Помилка:", audio.error?.message || "Невідома помилка", "для URL:", audio.src);
      if (audio.error?.code === audio.error.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        console.warn("Формат не підтримується, переходимо до наступної станції");
        nextStation();
      } else {
        attemptReconnect();
      }
    });

    audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", audio.volume);
    });

    window.addEventListener("online", () => {
      console.log("Мережа відновлена");
      if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
        clearCacheAndPlayStream();
      }
    });

    window.addEventListener("offline", () => {
      console.log("Втрачено зв’язок");
      if (isPlaying && audio.buffered.length > 0) {
        console.log("Відтворюємо кеш (до 10 секунд)");
        audio.play().catch(error => console.error("Помилка відтворення кешу:", error));
        attemptReconnect();
      }
    });

    addEventListeners();

    window.addEventListener("beforeunload", () => {
      removeEventListeners();
    });

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", togglePlayPause);
      navigator.mediaSession.setActionHandler("pause", togglePlayPause);
      navigator.mediaSession.setActionHandler("previoustrack", prevStation);
      navigator.mediaSession.setActionHandler("nexttrack", nextStation);
    }

    applyTheme(currentTheme);
    loadStations();
  }
});