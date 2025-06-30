let currentTab = localStorage.getItem("currentTab") || "home";
let currentIndex = parseInt(localStorage.getItem("currentIndex")) || 0;
let favoriteStations = JSON.parse(localStorage.getItem("favoriteStations")) || [];
let isPlaying = false;
let intendedPlaying = localStorage.getItem("intendedPlaying") === "true" || false;
let stationLists = JSON.parse(localStorage.getItem("stationLists")) || {};
let userAddedStations = JSON.parse(localStorage.getItem("userAddedStations")) || {};
let stationItems = [];
let pastSearches = JSON.parse(localStorage.getItem("pastSearches")) || [];
let deletedStations = JSON.parse(localStorage.getItem("deletedStations")) || [];
let customTabs = JSON.parse(localStorage.getItem("customTabs")) || [];
let isAutoPlayPending = false;
let lastSuccessfulPlayTime = 0;
let streamAbortController = null;
let autoPlayRequestId = 0;

const themes = {
    "cyberpunk-neon": {
        primaryBg: "#0D0D1A",
        cardBg: "#1A1A2E",
        accent: "#FF007A",
        text: "#FFFFFF",
        accentRgb: "255, 0, 122"
    },
    "retro-synthwave": {
        primaryBg: "#1A0A2E",
        cardBg: "#2A1A4E",
        accent: "#FF2E63",
        text: "#E0B0FF",
        accentRgb: "255, 46, 99"
    },
    "midnight-glow": {
        primaryBg: "#0A1A2E",
        cardBg: "#1A2A4E",
        accent: "#FFD700",
        text: "#E0F7FA",
        accentRgb: "255, 215, 0"
    },
    "tropical-beat": {
        primaryBg: "#0A2E2A",
        cardBg: "#1A4E4A",
        accent: "#FF6F61",
        text: "#E0F7FA",
        accentRgb: "255, 111, 97"
    },
    "holo-spark": {
        primaryBg: "#0A1A2E",
        cardBg: "#1A2A4E",
        accent: "#00F7FF",
        text: "#E0F7FA",
        accentRgb: "0, 247, 255"
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const audio = document.getElementById("audioPlayer");
    const stationCards = document.getElementById("stationCards");
    const miniPlayer = document.getElementById("miniPlayer");
    const nowPlaying = document.getElementById("nowPlaying");
    const playPauseBtn = miniPlayer.querySelector(".play-pause-btn");
    const nowPlayingPlayPause = nowPlaying.querySelector(".play-pause");
    const settingsBtn = document.querySelector(".settings-btn");
    const searchPanel = document.getElementById("searchPanel");
    const settingsPanel = document.getElementById("settingsPanel");
    const navButtons = document.querySelectorAll(".nav-btn");
    const searchQuery = document.getElementById("searchQuery");
    const searchBtn = document.querySelector(".search-btn");
    const pastSearchesList = document.getElementById("pastSearches");
    const filterChips = document.getElementById("filterChips");

    if (!audio || !stationCards || !miniPlayer || !nowPlaying || !playPauseBtn || !settingsBtn || !searchPanel || !settingsPanel || !searchQuery || !searchBtn || !pastSearchesList || !filterChips) {
        console.error("Required DOM elements missing");
        setTimeout(initializeApp, 100);
        return;
    }

    initializeApp();

    function initializeApp() {
        audio.volume = parseFloat(localStorage.getItem("volume")) || 0.9;
        applyTheme(localStorage.getItem("selectedTheme") || "cyberpunk-neon");
        updatePastSearches();
        populateFilterChips();
        renderTabs();
        loadStations();

        miniPlayer.addEventListener("click", () => {
            nowPlaying.style.display = isPlaying || intendedPlaying ? "flex" : "none";
            updateNowPlaying();
        });

        playPauseBtn.addEventListener("click", togglePlayPause);
        nowPlayingPlayPause.addEventListener("click", togglePlayPause);
        nowPlaying.querySelector(".prev").addEventListener("click", prevStation);
        nowPlaying.querySelector(".next").addEventListener("click", nextStation);
        nowPlaying.querySelector(".share-btn").addEventListener("click", shareStation);

        navButtons.forEach(btn => {
            btn.addEventListener("click", () => switchTab(btn.dataset.tab));
        });

        settingsBtn.addEventListener("click", () => {
            settingsPanel.style.display = "flex";
            renderThemeCarousel();
            renderTabsManager();
        });

        searchBtn.addEventListener("click", () => {
            const query = searchQuery.value.trim();
            if (query) {
                if (!pastSearches.includes(query)) {
                    pastSearches.unshift(query);
                    if (pastSearches.length > 5) pastSearches.pop();
                    localStorage.setItem("pastSearches", JSON.stringify(pastSearches));
                    updatePastSearches();
                }
                searchStations(query);
            }
        });

        searchQuery.addEventListener("keypress", e => {
            if (e.key === "Enter") searchBtn.click();
        });
    }

    function renderTabs() {
        const nav = document.querySelector(".bottom-nav");
        if (!nav) {
            console.error("Bottom navigation element not found");
            return;
        }
        const staticTabs = [
            { id: "home", icon: "🏠", label: "Дім" },
            { id: "search", icon: "🔍", label: "Пошук" },
            { id: "favorites", icon: "⭐", label: "Обране" },
            { id: "settings", icon: "⚙️", label: "Налаштування" }
        ];
        // Фільтруємо customTabs, щоб уникнути некоректних значень
        const validCustomTabs = customTabs.filter(tab => typeof tab === "string" && tab.trim() !== "");
        const allTabs = [
            ...staticTabs,
            ...validCustomTabs.map(tab => ({
                id: tab,
                icon: "📻",
                label: tab.toUpperCase()
            }))
        ];
        nav.innerHTML = allTabs.map(tab => {
            const isActive = tab.id === currentTab ? " active" : "";
            return `<button class="nav-btn${isActive}" data-tab="${tab.id}" aria-label="${tab.label}">${tab.icon}</button>`;
        }).join("");
        nav.querySelectorAll(".nav-btn").forEach(btn => {
            btn.addEventListener("click", () => switchTab(btn.dataset.tab));
        });
    }

    function applyTheme(theme) {
        if (!themes[theme]) theme = "cyberpunk-neon";
        const root = document.documentElement;
        root.style.setProperty("--primary-bg", themes[theme].primaryBg);
        root.style.setProperty("--card-bg", themes[theme].cardBg);
        root.style.setProperty("--accent", themes[theme].accent);
        root.style.setProperty("--text", themes[theme].text);
        root.style.setProperty("--accent-rgb", themes[theme].accentRgb);
        localStorage.setItem("selectedTheme", theme);
        document.querySelector('meta[name="theme-color"]').setAttribute("content", themes[theme].accent);
    }

    function renderThemeCarousel() {
        const carousel = document.getElementById("themeCarousel");
        carousel.innerHTML = Object.keys(themes).map(theme => `
            <div class="theme-preview" data-theme="${theme}" style="background: linear-gradient(135deg, ${themes[theme].primaryBg}, ${themes[theme].cardBg});"></div>
        `).join("");
        carousel.querySelectorAll(".theme-preview").forEach(preview => {
            preview.addEventListener("click", () => applyTheme(preview.dataset.theme));
        });
    }

    function renderTabsManager() {
        const manager = document.getElementById("tabsManager");
        manager.innerHTML = customTabs.map(tab => `
            <div class="tab-item" data-tab="${tab}">
                <span>${tab.toUpperCase()}</span>
                <button class="edit-tab-btn">✏️</button>
            </div>
        `).join("");
        manager.querySelectorAll(".edit-tab-btn").forEach(btn => {
            btn.addEventListener("click", () => showEditTabModal(btn.parentElement.dataset.tab));
        });
    }

    function updatePastSearches() {
        pastSearchesList.innerHTML = pastSearches.map(search => `<option value="${search}">`).join("");
    }

    function populateFilterChips() {
        const genres = ["Pop", "Rock", "Techno", "Trance", "House", "EDM"];
        const countries = ["Ukraine", "Germany", "United States", "United Kingdom"];
        filterChips.innerHTML = [
            ...genres.map(g => `<span class="chip" data-type="genre" data-value="${g}">${g}</span>`),
            ...countries.map(c => `<span class="chip" data-type="country" data-value="${c}">${c}</span>`)
        ].join("");
        filterChips.querySelectorAll(".chip").forEach(chip => {
            chip.addEventListener("click", () => {
                chip.classList.toggle("active");
                searchStations(searchQuery.value.trim());
            });
        });
    }

    async function loadStations() {
        stationCards.innerHTML = '<div class="station-card empty">Завантаження...</div>';
        try {
            const response = await fetch(`stations.json?t=${Date.now()}`, { cache: "no-store" });
            if (response.ok) {
                const newStations = await response.json();
                Object.keys(newStations).forEach(tab => {
                    const uniqueStations = new Map();
                    (userAddedStations[tab] || []).forEach(s => {
                        if (!deletedStations.includes(s.name)) uniqueStations.set(s.name, s);
                    });
                    newStations[tab].forEach(s => {
                        if (!deletedStations.includes(s.name)) uniqueStations.set(s.name, s);
                    });
                    stationLists[tab] = Array.from(uniqueStations.values());
                });
            }
            customTabs.forEach(tab => {
                const uniqueStations = new Map();
                (userAddedStations[tab] || []).forEach(s => {
                    if (!deletedStations.includes(s.name)) uniqueStations.set(s.name, s);
                });
                stationLists[tab] = Array.from(uniqueStations.values());
            });
            localStorage.setItem("stationLists", JSON.stringify(stationLists));
            switchTab(currentTab);
        } catch (error) {
            console.error("Error loading stations:", error);
            stationCards.innerHTML = '<div class="station-card empty">Помилка завантаження</div>';
        }
    }

    async function searchStations(query) {
        stationCards.innerHTML = '<div class="station-card empty">Пошук...</div>';
        try {
            const params = new URLSearchParams({ name: query, order: "clickcount", reverse: "true", limit: "100" });
            const activeChips = Array.from(filterChips.querySelectorAll(".chip.active"));
            activeChips.forEach(chip => {
                if (chip.dataset.type === "genre") params.append("tag", chip.dataset.value.toLowerCase());
                if (chip.dataset.type === "country") params.append("country", chip.dataset.value);
            });
            const response = await fetch(`https://de1.api.radio-browser.info/json/stations/search?${params.toString()}`);
            if (!response.ok) throw new Error("Search failed");
            let stations = await response.json();
            stations = stations.filter(s => s.url_resolved && /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(s.url_resolved));
            renderStationCards(stations);
        } catch (error) {
            console.error("Search error:", error);
            stationCards.innerHTML = '<div class="station-card empty">Нічого не знайдено</div>';
        }
    }

    function renderStationCards(stations) {
        stationCards.innerHTML = "";
        if (!stations.length) {
            stationCards.innerHTML = '<div class="station-card empty">Нічого не знайдено</div>';
            return;
        }
        const fragment = document.createDocumentFragment();
        stations.forEach((station, index) => {
            const card = document.createElement("div");
            card.className = `station-card ${index === currentIndex ? "selected" : ""}`;
            card.dataset.value = station.url_resolved;
            card.dataset.name = station.name;
            card.dataset.genre = station.tags || "Невідомо";
            card.dataset.country = station.country || "Невідомо";
            card.dataset.favicon = station.favicon && /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(station.favicon) ? station.favicon : "";
            const iconHtml = card.dataset.favicon ? `<img src="${card.dataset.favicon}" alt="${station.name} icon" onerror="this.outerHTML='🎵';">` : "🎵";
            card.innerHTML = `
                ${iconHtml}
                <span class="station-name">${station.name}</span>
                <div class="buttons-container">
                    <button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">⭐</button>
                    <button class="add-btn">+</button>
                </div>`;
            fragment.appendChild(card);
        });
        stationCards.appendChild(fragment);
        stationItems = stationCards.querySelectorAll(".station-card");
        if (stationItems.length && currentIndex < stationItems.length) changeStation(currentIndex);
        stationCards.addEventListener("click", handleCardClick);
    }

    function handleCardClick(e) {
        const card = e.target.closest(".station-card");
        const favoriteBtn = e.target.closest(".favorite-btn");
        const addBtn = e.target.closest(".add-btn");
        if (card && !card.classList.contains("empty")) {
            currentIndex = Array.from(stationItems).indexOf(card);
            changeStation(currentIndex);
        }
        if (favoriteBtn) {
            e.stopPropagation();
            toggleFavorite(card.dataset.name);
        }
        if (addBtn) {
            e.stopPropagation();
            showAddStationModal(card);
        }
    }

    function toggleFavorite(stationName) {
        if (favoriteStations.includes(stationName)) {
            favoriteStations = favoriteStations.filter(name => name !== stationName);
        } else {
            favoriteStations.unshift(stationName);
        }
        localStorage.setItem("favoriteStations", JSON.stringify(favoriteStations));
        if (currentTab === "favorites") switchTab("favorites");
        else updateStationList();
    }

    function showAddStationModal(card) {
        const modal = document.querySelector(".add-station-modal");
        const modalTabs = document.getElementById("modalTabs");
        modalTabs.innerHTML = [
            "techno", "trance", "ukraine", "pop", ...customTabs
        ].map(tab => `<button class="modal-tab-btn" data-tab="${tab}">${tab.toUpperCase()}</button>`).join("");
        modal.style.display = "block";
        modalTabs.querySelectorAll(".modal-tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                saveStation(card, btn.dataset.tab);
                modal.style.display = "none";
            });
        });
        modal.querySelector(".modal-cancel-btn").addEventListener("click", () => modal.style.display = "none");
    }

    function saveStation(card, targetTab) {
        const station = {
            value: card.dataset.value,
            name: card.dataset.name,
            genre: card.dataset.genre,
            country: card.dataset.country,
            favicon: card.dataset.favicon
        };
        if (!stationLists[targetTab]) stationLists[targetTab] = [];
        if (!userAddedStations[targetTab]) userAddedStations[targetTab] = [];
        if (!stationLists[targetTab].some(s => s.name === station.name)) {
            stationLists[targetTab].unshift(station);
            userAddedStations[targetTab].unshift(station);
            localStorage.setItem("stationLists", JSON.stringify(stationLists));
            localStorage.setItem("userAddedStations", JSON.stringify(userAddedStations));
            if (currentTab !== "search") updateStationList();
        } else {
            alert("Ця станція вже додана до вкладки!");
        }
    }

    function switchTab(tab) {
        currentTab = tab;
        localStorage.setItem("currentTab", tab);
        document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
        const activeBtn = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
        if (activeBtn) activeBtn.classList.add("active");
        searchPanel.style.display = tab === "search" ? "flex" : "none";
        settingsPanel.style.display = tab === "settings" ? "flex" : "none";
        nowPlaying.style.display = tab === "settings" || tab === "search" ? "none" : nowPlaying.style.display;
        updateStationList();
    }

    function updateStationList() {
        let stations = currentTab === "favorites"
            ? favoriteStations.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s)
            : currentTab === "search" ? [] : stationLists[currentTab] || [];
        stationCards.innerHTML = "";
        if (!stations.length) {
            stationCards.innerHTML = `<div class="station-card empty">${currentTab === "favorites" ? "Немає обраних станцій" : "Немає станцій у цій категорії"}</div>`;
            return;
        }
        const fragment = document.createDocumentFragment();
        stations.forEach((station, index) => {
            const card = document.createElement("div");
            card.className = `station-card ${index === currentIndex ? "selected" : ""}`;
            card.dataset.value = station.value;
            card.dataset.name = station.name;
            card.dataset.genre = station.genre;
            card.dataset.country = station.country;
            card.dataset.favicon = station.favicon;
            const iconHtml = station.favicon ? `<img src="${station.favicon}" alt="${station.name} icon" onerror="this.outerHTML='🎵';">` : "🎵";
            const deleteButton = ["techno", "trance", "ukraine", "pop", ...customTabs].includes(currentTab)
                ? `<button class="delete-btn">🗑</button>`
                : "";
            card.innerHTML = `
                ${iconHtml}
                <span class="station-name">${station.name}</span>
                <div class="buttons-container">
                    ${deleteButton}
                    <button class="favorite-btn${favoriteStations.includes(station.name) ? " favorited" : ""}">⭐</button>
                </div>`;
            fragment.appendChild(card);
        });
        stationCards.appendChild(fragment);
        stationItems = stationCards.querySelectorAll(".station-card");
        if (stationItems.length && currentIndex < stationItems.length) changeStation(currentIndex);
    }

    function changeStation(index) {
        if (!stationItems || index < 0 || index >= stationItems.length || stationItems[index].classList.contains("empty")) return;
        stationItems.forEach(item => item.classList.remove("selected"));
        stationItems[index].classList.add("selected");
        currentIndex = index;
        localStorage.setItem("currentIndex", index);
        updateNowPlaying();
        if (intendedPlaying) debouncedTryAutoPlay();
    }

    function updateNowPlaying() {
        if (!stationItems[currentIndex]) return;
        const item = stationItems[currentIndex];
        nowPlaying.querySelector(".station-name").textContent = item.dataset.name;
        nowPlaying.querySelector(".station-genre").textContent = `Жанр: ${item.dataset.genre}`;
        nowPlaying.querySelector(".station-country").textContent = `Країна: ${item.dataset.country}`;
        const icon = nowPlaying.querySelector(".station-icon");
        if (item.dataset.favicon) {
            icon.style.backgroundImage = `url(${item.dataset.favicon})`;
            icon.innerHTML = "";
        } else {
            icon.style.backgroundImage = "none";
            icon.innerHTML = "🎵";
        }
        if ("mediaSession" in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: item.dataset.name,
                artist: `${item.dataset.genre} | ${item.dataset.country}`,
                album: "VibeWave",
                artwork: item.dataset.favicon ? [{ src: item.dataset.favicon, sizes: "192x192", type: "image/png" }] : []
            });
        }
    }

    function togglePlayPause() {
        if (isPlaying) {
            audio.pause();
            isPlaying = false;
            intendedPlaying = false;
            playPauseBtn.textContent = "▶";
            nowPlayingPlayPause.textContent = "▶";
            nowPlaying.querySelectorAll(".wave-circle").forEach(circle => circle.classList.remove("playing"));
        } else {
            isPlaying = true;
            intendedPlaying = true;
            debouncedTryAutoPlay();
            playPauseBtn.textContent = "⏸";
            nowPlayingPlayPause.textContent = "⏸";
            nowPlaying.querySelectorAll(".wave-circle").forEach(circle => circle.classList.add("playing"));
        }
        localStorage.setItem("isPlaying", isPlaying);
        localStorage.setItem("intendedPlaying", intendedPlaying);
        miniPlayer.classList.toggle("playing", isPlaying);
    }

    function prevStation() {
        if (!stationItems.length) return;
        currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
        changeStation(currentIndex);
    }

    function nextStation() {
        if (!stationItems.length) return;
        currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
        changeStation(currentIndex);
    }

    function shareStation() {
        const stationName = nowPlaying.querySelector(".station-name").textContent || "VibeWave";
        const shareData = {
            title: "VibeWave",
            text: `Слухаю ${stationName} на VibeWave! Приєднуйся!`,
            url: window.location.href
        };
        if (navigator.share) {
            navigator.share(shareData).catch(error => console.error("Share error:", error));
        } else {
            alert(`Поділитися не підтримується. Скопіюйте: ${shareData.text} ${shareData.url}`);
        }
    }

    function debouncedTryAutoPlay(retryCount = 2, delay = 1000) {
        if (isAutoPlayPending) return;
        autoPlayRequestId++;
        setTimeout(() => tryAutoPlay(retryCount, delay, autoPlayRequestId), 0);
    }

    async function tryAutoPlay(retryCount, delay, requestId) {
        if (isAutoPlayPending || requestId !== autoPlayRequestId) return;
        isAutoPlayPending = true;
        try {
            if (!navigator.onLine || !intendedPlaying || !stationItems.length || currentIndex >= stationItems.length) return;
            const currentStationUrl = stationItems[currentIndex].dataset.value;
            if (!currentStationUrl || !/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(currentStationUrl)) return;
            if (streamAbortController) streamAbortController.abort();
            streamAbortController = new AbortController();
            audio.src = currentStationUrl + "?nocache=" + Date.now();
            await audio.play();
            isPlaying = true;
            lastSuccessfulPlayTime = Date.now();
            playPauseBtn.textContent = "⏸";
            nowPlayingPlayPause.textContent = "⏸";
            nowPlaying.querySelectorAll(".wave-circle").forEach(circle => circle.classList.add("playing"));
            miniPlayer.classList.add("playing");
        } catch (error) {
            if (error.name !== "AbortError" && retryCount > 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
                tryAutoPlay(retryCount - 1, delay, requestId);
            }
        } finally {
            isAutoPlayPending = false;
            streamAbortController = null;
        }
    }

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js").then(reg => reg.update());
        navigator.serviceWorker.addEventListener("message", event => {
            if (event.data.type === "NETWORK_STATUS" && event.data.online && intendedPlaying) {
                debouncedTryAutoPlay();
            }
        });
    }

    audio.addEventListener("playing", () => {
        isPlaying = true;
        playPauseBtn.textContent = "⏸";
        nowPlayingPlayPause.textContent = "⏸";
        nowPlaying.querySelectorAll(".wave-circle").forEach(circle => circle.classList.add("playing"));
        miniPlayer.classList.add("playing");
    });

    audio.addEventListener("pause", () => {
        isPlaying = false;
        playPauseBtn.textContent = "▶";
        nowPlayingPlayPause.textContent = "▶";
        nowPlaying.querySelectorAll(".wave-circle").forEach(circle => circle.classList.remove("playing"));
        miniPlayer.classList.remove("playing");
    });

    audio.addEventListener("error", () => {
        nowPlaying.querySelectorAll(".wave-circle").forEach(circle => circle.classList.remove("playing"));
        miniPlayer.classList.remove("playing");
    });

    audio.addEventListener("volumechange", () => {
        localStorage.setItem("volume", audio.volume);
    });

    document.addEventListener("keydown", e => {
        if (e.key === "ArrowLeft") prevStation();
        if (e.key === "ArrowRight") nextStation();
        if (e.key === " ") {
            e.preventDefault();
            togglePlayPause();
        }
    });
});