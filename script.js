let currentTab = localStorage.getItem("currentTab") || "techno";
let hasUserInteracted = false;
let currentIndex = 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = localStorage.getItem("isPlaying") === "true" || false;
let stationLists = JSON.parse(localStorage.getItem("stationLists")) || {};
let stationItems = [];
let abortController = new AbortController();
let errorCount = 0;
const ERROR_LIMIT = 5;
let pastSearches = JSON.parse(localStorage.getItem("pastSearches")) || [];
let deletedStations = JSON.parse(localStorage.getItem("deletedStations")) || [];

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

  if (!audio || !stationList || !playPauseBtn || !currentStationInfo || !themeToggle || !shareButton || !searchInput || !searchQuery || !searchCountry || !searchGenre || !searchBtn || !pastSearchesList) {
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
      pastSearchesList: !!pastSearchesList
    });
    setTimeout(initializeApp, 100);
    return;
  }

  initializeApp();

  function initializeApp() {
    audio.preload = "auto";
    audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;

    updatePastSearches();
    populateSearchSuggestions();

    document.querySelectorAll(".tab-btn").forEach((btn, index) => {
      const tabs = ["best", "techno", "trance", "ukraine", "pop", "search"];
      const tab = tabs[index];
      btn.addEventListener("click", () => switchTab(tab));
    });

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
        "Pop", "Rock", "Dance", "Electronic", "Techno", "Trance", "House",
        "EDM", "Hip-Hop", "Rap", "Jazz", "Classical", "Country", "Reggae",
        "Blues", "Folk", "Metal", "R&B", "Soul", "Ambient"
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
        return /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(url) && !url.includes('example.com');
      } catch {
        return false;
      }
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
        const response = await fetch(`stations.json?t=${encodeURIComponent(Date.now())}`, {
          cache: "no-cache",
          headers: {
            "If-Modified-Since": localStorage.getItem("stationsLastModified") || ""
          },
          signal: abortController.signal
        });
        console.log(`Статус відповіді: ${response.status}`);
        if (response.status === 304) {
          console.log("Використовується кешована версія stations.json");
        } else if (response.ok) {
          const newStations = await response.json();
          console.log('Завантажені дані stations.json:', newStations);
          // Перевірка структури
          if (!newStations.techno || !newStations.trance || !newStations.ukraine || !newStations.pop) {
            console.error('Некоректна структура stations.json, очищення localStorage');
            localStorage.removeItem("stationLists");
            localStorage.removeItem("favoriteStations");
            localStorage.removeItem("deletedStations");
            stationLists = {};
            favoriteStations = [];
            deletedStations = [];
          }
          // Примусово оновлюємо станції
          Object.keys(newStations).forEach(tab => {
            if (!stationLists[tab]) stationLists[tab] = [];
            // Оновлюємо тільки якщо є нові favicon або нові станції
            const newStationsForTab = newStations[tab].map(s => ({
              ...s,
              favicon: isValidUrl(s.favicon) ? s.favicon : ""
            })).filter(
              s => !deletedStations.includes(s.value) &&
              (!stationLists[tab].some(existing => existing.value === s.value) ||
              stationLists[tab].some(existing => existing.value === s.value && !existing.favicon && s.favicon))
            );
            if (newStationsForTab.length > 0) {
              console.log(`Оновлення ${tab}: додано ${newStationsForTab.length} станцій`);
              // Замінюємо старі станції новими, якщо є favicon
              stationLists[tab] = stationLists[tab].map(existing => {
                const newStation = newStationsForTab.find(s => s.value === existing.value);
                return newStation || existing;
              });
              // Додаємо нові станції
              stationLists[tab].push(...newStationsForTab.filter(s => !stationLists[tab].some(existing => existing.value === s.value)));
            } else {
              console.log(`Додано до ${tab}: 0 станцій`);
            }
          });
          localStorage.setItem("stationsLastModified", response.headers.get("Last-Modified") || "");
          console.log("Новий stations.json успішно завантажено та оновлено");
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
        favoriteStations = favoriteStations.filter(name => 
          Object.values(stationLists).flat().some(s => s.name === name)
        );
        localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        const validTabs = [...Object.keys(stationLists), "best"];
        if (!validTabs.includes(currentTab)) {
          currentTab = validTabs[0] || "techno";
          localStorage.setItem("currentTab", currentTab);
        }
        currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
        switchTab(currentTab);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error("Помилка завантаження станцій:", error);
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
        params.append("limit", "1000");
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
        item.dataset.favicon = isValidUrl(station.favicon) ? station.favicon : "";
        const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" style="width: 32px; height: 32px; object-fit: contain; margin-right: 10px;" onerror="this.src='/icon-192.png'; console.log('Помилка favicon: ${station.favicon}');">` : "🎵 ";
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
        hasUserInteracted = true;
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
      hasUserInteracted = true;
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
      hasUserInteracted = true;
      const stationName = item.dataset.name;
      if (!stationLists[targetTab]) stationLists[targetTab] = [];
      if (!stationLists[targetTab].some(s => s.name === stationName)) {
        stationLists[targetTab].unshift({
          value: item.dataset.value,
          name: item.dataset.name,
          genre: item.dataset.genre,
          country: item.dataset.country,
          favicon: item.dataset.favicon || ""
        });
        localStorage.setItem("stationLists", JSON.stringify(stationLists));
        if (currentTab !== "search") {
          updateStationList();
        }
      } else {
        alert("Ця станція вже додана до обраної вкладки!");
      }
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
        text: "#FCE4FF",
        accentGradient: "#4B1A2E"
      },
      "violet-vortex": {
        bodyBg": "#121212",
        containerBg": "#1A1A",
        accent: "#7C4DFF",
        text: "#EDE7FF",
        accentGradient: "#2E1F4A"
      },
      "aqua-glow": {
        bodyBg": "#0A0A0A",
        containerBg": "#121212",
        accent: "#26C6DA",
        text: "#E5F2FF",
        accentGradient: "#1A4B4C"
      },
      "cosmic-indigo": {
        bodyBg: "#121212",
        containerBg": "#1A1A1A",
        accent: "#3F51B5",
        text: "#E7F0",
        accentGradient: "#1A2A5B"
      },
      "mystic-jade": {
        bodyBg": "#0A0A0A",
        containerBg": "#121212",
        accent: "#26A69A",
        text: "#E2FFF",
        accentGradient: "#1A4B",
      },
      "aurora-haze": {
        bodyBg": "#121212",
        containerBg": "#1A1A",
        accent: "#64FFDA",
        text: "#E0FFFF",
        accentGradient: "#1A4B4B"
      },
      "starlit-amethyst": {
        bodyBg": "#0A0A0A",
        containerBg": "#121212",
        accent: "#B388FF",
        text: "#E1E7EB",
        accentGradient: "#2E1A4A"
      },
      "lunar-frost": {
        bodyBg": "#F5F7FA",
        containerBg": "#FFFFFF",
        accent: "#40C4FF",
        text: "#212121",
        accentGradient: "#E0F5FC"
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
        "neon-pulse", "lime-surge", "flamingo-f", "violet-vortex",
        "aqua-glow", "cosmic-indi", "mystic-j", "aurora-h",
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
                console.log('Новий Service Worker активовано');
                if (window.confirm("Доступна нова версія PWA. Оновити?")) {
                  window.location.reload(true);
                }
              }
            });
          }
        });
      navigator.serviceWorker.addEventListener("message", event => {
        if (event.data.type === "CACHE_UPDATED" && event.data.reload) {
          console.log('Оновлено кеш, виконую примусове перезавантаження...');
          window.location.reload(true);
        }
        if (event.data.type === "NETWORK_STATUS" && event.data.online && isPlaying && stationItems?.length && currentIndex < stationItems.length) {
          console.log("Отримано повідомлення від Service Worker: мережа відновлена');
          audio.pause();
          audio.src = "";
          audio.src = stationItems[currentIndex].dataset.value;
          tryAutoPlay();
        }
      });
    }

    function tryAutoPlay() {
      if (!navigator.onLine()) {
        console.log('Пристрій офлайн, пропускаємо відтворення');
        return;
      }
      if (!isPlaying || !stationItems?.length || currentIndex >= stationItems.length || !hasUserInteracted) {
        console.log("Пропуск tryAutoPlay", { isPlaying, hasStationItems: !!stationItems?.length, isIndexValid: currentIndex < stationItems.length, hasUserInteracted });
        document.querySelectorAll(".equalizer-bar").forEach(bar => bar.classList.remove("playing"));
        if (!hasUserInteracted && isPlaying) {
          alert("Будь ласка, взаємодійте зі сторінкою (наприклад, натисніть кнопку), щоб увімкнути відтворення аудіо.");
        }
        return;
      }
      if (audio.src === stationItems[currentIndex].dataset.value && !audio.paused) {
        console.log("Пропуск tryAutoPlay: аудіо вже відтворюється з правильним src");
        return;
      }
      if (!isValidUrl(stationItems[currentIndex].dataset.value)) {
        console.error("Невалідний URL:", stationItems[currentIndex].dataset.value);
        errorCount++;
        if (errorCount >= ERROR_LIMIT) {
          console.error("Досягнуто ліміт помилок відтворення");
        }
        document.querySelectorAll(".equalizer-bar").forEach(bar => bar.classList.remove("playing"));
        return;
      }
      audio.pause();
      audio.src = "";
      audio.src = stationItems[currentIndex].dataset.value;
      console.log("Спроба відтворення:", audio.src);
      const playPromise = audio.play();

      playPromise
        .then(() => {
          errorCount = 0;
          console.log("Відтворення розпочато успішно");
          document.querySelectorAll(".equalizer-bar").forEach(bar => bar.classList.add("playing"));
        })
        .catch(error => {
          console.error("Помилка відтворення:", error);
          if (error.name !== "AbortError") {
            errorCount++;
            if (errorCount >= ERROR_LIMIT) {
              console.error("Досягнуто ліміт помилок відтворення");
            }
          }
          document.querySelectorAll(".equalizer-bar").forEach(bar => bar.classList.remove("playing"));
        });
    }

    function switchTab(tab) {
      if (!["techno", "trance", "ukraine", "pop", "best", "search"].includes(tab)) tab = "techno";
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
      document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
      const activeBtn = document.querySelector(`.tab-btn:nth-child(${["best", "techno", "trance", "ukraine", "pop", "search"].indexOf(tab) + 1})`);
      if (activeBtn) activeBtn.classList.add("active");
      if (stationItems?.length && currentIndex < stationItems.length) tryAutoPlay();
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
        stationList.innerHTML = `<div class='station-item empty'>${currentTab === "best" ? "Немає улюблених станцій" : "Немає станцій у цій категорії"}</div>`;
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
        item.dataset.favicon = isValidUrl(station.favicon) ? station.favicon : "";
        console.log(`Рендеринг станції ${station.name}, favicon: ${station.favicon}`);
        const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" style="width: 32px; height: 32px; object-fit: contain; margin-right: 10px;" onerror="this.src='/icon-192.png'; console.log('Помилка favicon: ${station.favicon}');">` : "🎵 ";
        const deleteButton = ["techno", "trance", "ukraine", "pop"].includes(currentTab)
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
        hasUserInteracted = true;
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
          if (confirm(`Ви впевнені, що хочете видалити станцію "${item.dataset.name}" зі списку?`)) {
            deleteStation(item.dataset.name);
          }
        }
      };

      if (stationItems.length && currentIndex < stationItems.length) {
        changeStation(currentIndex);
      }
    }

    function toggleFavorite(stationName) {
      hasUserInteracted = true;
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
      hasUserInteracted = true;
      stationLists[currentTab] = stationLists[currentTab].filter(s => s.name !== stationName);
      favoriteStations = favoriteStations.filter(name => name !== stationName);
      deletedStations.push(stationName);
      localStorage.setItem("stationLists", JSON.stringify(stationLists));
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
          stationIconElement.innerHTML = `<img src="${item.dataset.favicon}" alt="${item.dataset.name} icon" style="width: 32px; height: 32px; object-fit: contain;" onerror="this.src='/icon-192.png'; console.log('Помилка favicon: ${item.dataset.favicon}');">`;
          stationIconElement.style.backgroundImage = "none";
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
      hasUserInteracted = true;
      if (!stationItems?.length) return;
      currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
      if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
      changeStation(currentIndex);
    }

    function nextStation() {
      hasUserInteracted = true;
      if (!stationItems?.length) return;
      currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
      if (stationItems[currentIndex].classList.contains("empty")) currentIndex = 0;
      changeStation(currentIndex);
    }

    function togglePlayPause() {
      if (!playPauseBtn || !audio) {
        console.error("playPauseBtn або аудіо не знайдено");
        return;
      }
      hasUserInteracted = true;
      if (audio.paused) {
        isPlaying = true;
        tryAutoPlay();
        playPauseBtn.textContent = "⏸";
        document.querySelectorAll(".equalizer-bar").forEach(bar => bar.classList.add("playing"));
      } else {
        audio.pause();
        isPlaying = false;
        playPauseBtn.textContent = "▶";
        document.querySelectorAll(".equalizer-bar").forEach(bar => bar.classList.remove("playing"));
      }
      localStorage.setItem("isPlaying", isPlaying);
    }

    const eventListeners = {
      keydown: e => {
        hasUserInteracted = true;
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
          audio.pause();
          audio.src = "";
          audio.src = stationItems[currentIndex]?.dataset.value || "";
          tryAutoPlay();
        }
      },
      resume: () => {
        if (isPlaying && navigator.connection?.type !== "none") {
          if (!audio.paused) return;
          audio.pause();
          audio.src = "";
          audio.src = stationItems[currentIndex]?.dataset.value || "";
          tryAutoPlay();
        }
      },
      click: () => {
        hasUserInteracted = true;
      }
    };

    function addEventListeners() {
      document.addEventListener("keydown", eventListeners.keydown);
      document.addEventListener("visibilitychange", eventListeners.visibilitychange);
      document.addEventListener("resume", eventListeners.resume);
      document.addEventListener("click", eventListeners.click);
    }

    function removeEventListeners() {
      document.removeEventListener("keydown", eventListeners.keydown);
      document.removeEventListener("visibilitychange", eventListeners.visibilitychange);
      document.removeEventListener("resume", eventListeners.resume);
      document.removeEventListener("click", eventListeners.click);
    }

    audio.addEventListener("playing", () => {
      isPlaying = true;
      playPauseBtn.textContent = "⏸";
      document.querySelectorAll(".equalizer-bar").forEach(bar => bar.classList.add("playing"));
      localStorage.setItem("isPlaying", isPlaying);
    });

    audio.addEventListener("pause", () => {
      isPlaying = false;
      playPauseBtn.textContent = "▶";
      document.querySelectorAll(".equalizer-bar").forEach(bar => bar.classList.remove("playing"));
      localStorage.setItem("isPlaying", isPlaying);
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = null;
      }
    });

    audio.addEventListener("error", () => {
      document.querySelectorAll(".equalizer-bar").forEach(bar => bar.classList.remove("playing"));
      console.error("Помилка аудіо:", audio.error?.message || "Невідома помилка", "для URL:", audio.src);
      if (isPlaying && errorCount < ERROR_LIMIT) {
        errorCount++;
        setTimeout(nextStation, 1000);
      } else if (errorCount >= ERROR_LIMIT) {
        console.error("Досягнуто ліміт помилок відтворення");
      }
    });

    audio.addEventListener("volumechange", () => {
      localStorage.setItem("volume", audio.volume);
    });

    window.addEventListener("online", () => {
      console.log("Мережа відновлена");
      if (isPlaying && stationItems?.length && currentIndex < stationItems.length) {
        audio.pause();
        audio.src = "";
        audio.src = stationItems[currentIndex].dataset.value;
        tryAutoPlay();
      }
    });

    window.addEventListener("offline", () => {
      console.log("Втрачено з'єднання з мережею");
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