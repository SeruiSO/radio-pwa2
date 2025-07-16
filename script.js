document.addEventListener('DOMContentLoaded', () => {
  // Елементи DOM
  const audio = new Audio();
  const tabsButton = document.querySelector('.tabs-button');
  const tabsDropdown = document.querySelector('#tabsDropdown');
  const menuButton = document.querySelector('.menu-button');
  const menuDropdown = document.querySelector('#menuDropdown');
  const themeButton = document.querySelector('#themeButton');
  const shareButton = document.querySelector('#shareButton');
  const exportButton = document.querySelector('#exportButton');
  const importButton = document.querySelector('#importButton');
  const stationList = document.querySelector('#stationList');
  const currentStationInfo = document.querySelector('#currentStationInfo');
  const stationName = document.querySelector('#stationName');
  const stationGenre = document.querySelector('#stationGenre');
  const stationCountry = document.querySelector('#stationCountry');
  const waveVisualizer = document.querySelector('#waveVisualizer');
  const playButton = document.querySelector('#playButton');
  const prevButton = document.querySelector('.prev-btn');
  const nextButton = document.querySelector('.next-btn');
  const searchInput = document.querySelector('#searchInput');
  const searchQuery = document.querySelector('#searchQuery');
  const clearSearch = document.querySelector('#clearSearch');
  const searchButton = document.querySelector('#searchButton');
  const searchCountry = document.querySelector('#searchCountry');
  const searchGenre = document.querySelector('#searchGenre');
  const pastSearchesList = document.querySelector('#pastSearches');
  const countriesList = document.querySelector('#countries');
  const genresList = document.querySelector('#genres');
  const modalOverlay = document.querySelector('#modalOverlay');
  const newTabModal = document.querySelector('#newTabModal');
  const editTabModal = document.querySelector('#editTabModal');
  const newTabInput = document.querySelector('#newTabInput');
  const editTabInput = document.querySelector('#editTabInput');
  const addTabButton = document.querySelector('#addTabButton');
  const cancelTabButton = document.querySelector('#cancelTabButton');
  const saveTabButton = document.querySelector('#saveTabButton');
  const cancelEditTabButton = document.querySelector('#cancelEditTabButton');

  // Змінні стану
  let currentTab = localStorage.getItem('currentTab') || 'techno';
  let currentIndex = parseInt(localStorage.getItem(`lastStation_${currentTab}`)) || 0;
  let favoriteStations = JSON.parse(localStorage.getItem('favoriteStations')) || [];
  let isPlaying = localStorage.getItem('isPlaying') === 'true' || false;
  let intendedPlaying = localStorage.getItem('intendedPlaying') === 'true' || false;
  let stationLists = JSON.parse(localStorage.getItem('stationLists')) || {};
  let userAddedStations = JSON.parse(localStorage.getItem('userAddedStations')) || {};
  let deletedStations = JSON.parse(localStorage.getItem('deletedStations')) || [];
  let customTabs = JSON.parse(localStorage.getItem('customTabs')) || [];
  let pastSearches = JSON.parse(localStorage.getItem('pastSearches')) || [];
  let stationItems = [];
  let abortController = new AbortController();
  let errorCount = 0;
  const ERROR_LIMIT = 15;
  let isAutoPlayPending = false;
  let lastSuccessfulPlayTime = 0;
  let streamAbortController = null;
  let errorTimeout = null;
  let autoPlayRequestId = 0;
  let visualizerType = localStorage.getItem('visualizerType') || 'bars';
  customTabs = Array.isArray(customTabs) ? customTabs.filter(tab => typeof tab === 'string' && tab.trim()) : [];

  // Ініціалізація
  audio.preload = 'auto';
  audio.volume = parseFloat(localStorage.getItem('volume')) || 0.9;
  initializeApp();

  function initializeApp() {
    if (!audio || !stationList || !playButton || !currentStationInfo || !themeButton || !shareButton || !exportButton || !importButton || !searchInput || !searchQuery || !searchCountry || !searchGenre || !searchButton || !pastSearchesList || !tabsDropdown) {
      console.error('Missing DOM elements', {
        audio: !!audio, stationList: !!stationList, playButton: !!playButton, currentStationInfo: !!currentStationInfo,
        themeButton: !!themeButton, shareButton: !!shareButton, exportButton: !!exportButton, importButton: !!importButton,
        searchInput: !!searchInput, searchQuery: !!searchQuery, searchCountry: !!searchCountry, searchGenre: !!searchGenre,
        searchButton: !!searchButton, pastSearchesList: !!pastSearchesList, tabsDropdown: !!tabsDropdown
      });
      setTimeout(initializeApp, 100);
      return;
    }

    updatePastSearches();
    populateSearchSuggestions();
    updateVisualizer();
    renderTabs();
    loadStations();
    applyTheme(localStorage.getItem('selectedTheme') || 'deep-obsidian');
    updateMarquee();
    switchTab(currentTab); // Ініціалізація видимості searchInput

    // Обробка вкладок
    tabsButton.addEventListener('click', () => {
      tabsDropdown.classList.toggle('show');
    });

    tabsDropdown.addEventListener('click', (e) => {
      const tabButton = e.target.closest('button');
      if (tabButton && tabButton.dataset.tab) {
        switchTab(tabButton.dataset.tab);
        tabsDropdown.classList.remove('show');
      }
    });

    // Обробка меню
    menuButton.addEventListener('click', () => {
      menuDropdown.classList.toggle('show');
    });

    themeButton.addEventListener('click', toggleTheme);
    shareButton.addEventListener('click', () => {
      const stationName = stationName.textContent || 'Radio Music';
      const shareData = {
        title: 'Radio Music',
        text: `Listening to ${stationName} on Radio Music!`,
        url: window.location.href
      };
      if (navigator.share) {
        navigator.share(shareData).catch(error => console.error('Error sharing:', error));
      } else {
        alert(`Share not supported. Copy: ${shareData.text} ${shareData.url}`);
      }
      menuDropdown.classList.remove('show');
    });

    exportButton.addEventListener('click', exportSettings);
    importButton.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = importSettings;
      input.click();
      menuDropdown.classList.remove('show');
    });

    // Закриття dropdown
    document.addEventListener('click', (e) => {
      if (!tabsButton.contains(e.target) && !tabsDropdown.contains(e.target)) {
        tabsDropdown.classList.remove('show');
      }
      if (!menuButton.contains(e.target) && !menuDropdown.contains(e.target)) {
        menuDropdown.classList.remove('show');
      }
    });

    // Обробка контролерів
    prevButton.addEventListener('click', prevStation);
    nextButton.addEventListener('click', nextStation);
    playButton.addEventListener('click', togglePlayPause);

    // Обробка списку станцій
    stationList.addEventListener('click', (e) => {
      const item = e.target.closest('.station-item');
      if (item && !item.classList.contains('empty')) {
        const addBtn = e.target.closest('.add-btn');
        const favoriteBtn = e.target.closest('.favorite-btn');
        const deleteBtn = e.target.closest('.delete-btn');
        if (addBtn) {
          e.stopPropagation();
          showTabModal(item);
        } else if (favoriteBtn) {
          e.stopPropagation();
          toggleFavorite(item.dataset.name);
        } else if (deleteBtn) {
          e.stopPropagation();
          deleteStation(item.dataset.name);
        } else {
          currentIndex = Array.from(stationItems).indexOf(item);
          changeStation(currentIndex);
        }
      }
    });

    // Обробка пошуку
    searchButton.addEventListener('click', () => {
      const query = searchQuery.value.trim();
      const country = normalizeCountry(searchCountry.value.trim());
      const genre = searchGenre.value.trim().toLowerCase();
      if (query || country || genre) {
        if (query && !pastSearches.includes(query)) {
          pastSearches.unshift(query);
          if (pastSearches.length > 5) pastSearches.pop();
          localStorage.setItem('pastSearches', JSON.stringify(pastSearches));
          updatePastSearches();
        }
        searchStations(query, country, genre);
      } else {
        stationList.innerHTML = '<div class="station-item empty">Enter station name, country or genre</div>';
      }
    });

    searchQuery.addEventListener('input', () => {
      clearSearch.style.display = searchQuery.value ? 'block' : 'none';
    });

    clearSearch.addEventListener('click', () => {
      searchQuery.value = '';
      clearSearch.style.display = 'none';
      if (currentTab === 'search') searchStations('', searchCountry.value.trim(), searchGenre.value.trim().toLowerCase());
    });

    searchQuery.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchButton.click();
    });
    searchCountry.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchButton.click();
    });
    searchGenre.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchButton.click();
    });

    // Обробка візуалізатора
    waveVisualizer.addEventListener('click', () => {
      const types = ['bars', 'circles', 'waves'];
      visualizerType = types[(types.indexOf(visualizerType) + 1) % types.length];
      localStorage.setItem('visualizerType', visualizerType);
      updateVisualizer();
    });

    // Обробка audio подій
    audio.addEventListener('playing', () => {
      isPlaying = true;
      playButton.textContent = '⏸️';
      playButton.setAttribute('aria-label', 'Зупинити');
      document.querySelectorAll('.wave-line, .circle, .wave').forEach(el => el.classList.add('playing'));
      localStorage.setItem('isPlaying', isPlaying);
      if (errorTimeout) {
        clearTimeout(errorTimeout);
        errorTimeout = null;
      }
    });

    audio.addEventListener('pause', () => {
      isPlaying = false;
      playButton.textContent = '▶️';
      playButton.setAttribute('aria-label', 'Відтворити');
      document.querySelectorAll('.wave-line, .circle, .wave').forEach(el => el.classList.remove('playing'));
      localStorage.setItem('isPlaying', isPlaying);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
      }
    });

    audio.addEventListener('error', () => {
      document.querySelectorAll('.wave-line, .circle, .wave').forEach(el => el.classList.remove('playing'));
      console.error('Audio error:', audio.error?.message || 'Unknown error', 'for URL:', audio.src);
      if (intendedPlaying && errorCount < ERROR_LIMIT && !errorTimeout) {
        errorCount++;
        errorTimeout = setTimeout(() => {
          debouncedTryAutoPlay();
          errorTimeout = null;
        }, 1000);
      } else if (errorCount >= ERROR_LIMIT) {
        console.error('Reached playback error limit');
        resetStationInfo();
      }
    });

    audio.addEventListener('volumechange', () => {
      localStorage.setItem('volume', audio.volume);
    });

    // Обробка мережі
    window.addEventListener('online', () => {
      console.log('Network restored');
      if (intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
      }
    });

    window.addEventListener('offline', () => {
      console.log('Network connection lost');
      document.querySelectorAll('.wave-line, .circle, .wave').forEach(el => el.classList.remove('playing'));
      errorCount = 0;
    });

    // Обробка вкладок і модальних вікон
    addTabButton.addEventListener('click', showNewTabModal);
    cancelTabButton.addEventListener('click', () => {
      newTabModal.style.display = 'none';
      modalOverlay.style.display = 'none';
      newTabInput.value = '';
    });

    saveTabButton.addEventListener('click', () => {
      const oldTab = saveTabButton.dataset.oldTab;
      const newTab = editTabInput.value.trim().toLowerCase();
      if (newTab && !customTabs.includes(newTab) && !['best', 'techno', 'trance', 'ua', 'pop', 'search'].includes(newTab)) {
        if (newTab.length > 10 || !/^[a-z0-9_-]+$/.test(newTab)) {
          alert('Tab name cannot exceed 10 characters and must contain only Latin letters, numbers, hyphen or underscore.');
          return;
        }
        const index = customTabs.indexOf(oldTab);
        customTabs[index] = newTab;
        stationLists[newTab] = stationLists[oldTab] || [];
        userAddedStations[newTab] = userAddedStations[oldTab] || [];
        delete stationLists[oldTab];
        delete userAddedStations[oldTab];
        localStorage.setItem('customTabs', JSON.stringify(customTabs));
        localStorage.setItem('stationLists', JSON.stringify(stationLists));
        localStorage.setItem('userAddedStations', JSON.stringify(userAddedStations));
        if (currentTab === oldTab) switchTab(newTab);
        renderTabs();
        editTabModal.style.display = 'none';
        modalOverlay.style.display = 'none';
      } else {
        alert('This tab name already exists or is invalid!');
      }
    });

    cancelEditTabButton.addEventListener('click', () => {
      editTabModal.style.display = 'none';
      modalOverlay.style.display = 'none';
      editTabInput.value = '';
    });

    // Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then(registration => {
        registration.update();
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                if (window.confirm('New version of radio available. Update?')) {
                  window.location.reload();
                }
              }
            });
          }
        });
      });

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'CACHE_UPDATED') {
          const currentCacheVersion = localStorage.getItem('cacheVersion') || '0';
          if (currentCacheVersion !== event.data.cacheVersion) {
            favoriteStations = favoriteStations.filter(name =>
              Object.values(stationLists).flat().some(s => s.name === name)
            );
            localStorage.setItem('favoriteStations', JSON.stringify(favoriteStations));
            localStorage.setItem('cacheVersion', event.data.cacheVersion);
            loadStations();
          }
        }
        if (event.data.type === 'NETWORK_STATUS' && event.data.online && intendedPlaying && stationItems?.length && currentIndex < stationItems.length) {
          console.log('Network restored (SW), trying to play');
          debouncedTryAutoPlay();
        }
      });
    }

    // Media Session
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        if (intendedPlaying) return;
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (!isPlaying) return;
        togglePlayPause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', prevStation);
      navigator.mediaSession.setActionHandler('nexttrack', nextStation);
    }

    // Обробка подій
    const eventListeners = {
      keydown: e => {
        if (e.key === 'ArrowLeft') prevStation();
        if (e.key === 'ArrowRight') nextStation();
        if (e.key === ' ') {
          e.preventDefault();
          togglePlayPause();
        }
      },
      visibilitychange: () => {
        if (document.hidden || !intendedPlaying || !navigator.onLine || !stationItems?.length || currentIndex >= stationItems.length) {
          console.log('visibilitychange: Skip, tab hidden or invalid state');
          return;
        }
        const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) {
          console.log('visibilitychange: Skip playback, station already playing');
        } else {
          console.log('visibilitychange: Starting playback after visibility change');
          isAutoPlayPending = false;
          debouncedTryAutoPlay();
        }
      },
      resume: () => {
        if (!intendedPlaying || !navigator.onLine || !stationItems?.length || currentIndex >= stationItems.length) {
          console.log('resume: Skip, invalid state');
          return;
        }
        const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
        const normalizedAudioSrc = normalizeUrl(audio.src);
        if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) {
          console.log('resume: Skip playback, station already playing');
        } else {
          console.log('resume: Starting playback after app resume');
          isAutoPlayPending = false;
          debouncedTryAutoPlay();
        }
      }
    };

    function addEventListeners() {
      document.addEventListener('keydown', eventListeners.keydown);
      document.addEventListener('visibilitychange', eventListeners.visibilitychange);
      document.addEventListener('resume', eventListeners.resume);
    }

    function removeEventListeners() {
      document.removeEventListener('keydown', eventListeners.keydown);
      document.removeEventListener('visibilitychange', eventListeners.visibilitychange);
      document.removeEventListener('resume', eventListeners.resume);
    }

    addEventListeners();
    window.addEventListener('beforeunload', removeEventListeners);
  }

  function updateVisualizer() {
    waveVisualizer.className = `wave-visualizer ${visualizerType}`;
    waveVisualizer.innerHTML = `<div class="visualizer-type">${visualizerType === 'bars' ? 'S' : visualizerType === 'circles' ? 'C' : 'W'}</div>`;
    if (visualizerType === 'bars') {
      for (let i = 0; i < 12; i++) {
        const line = document.createElement('div');
        line.className = `wave-line ${isPlaying ? 'playing' : ''}`;
        waveVisualizer.appendChild(line);
      }
    } else if (visualizerType === 'circles') {
      for (let i = 0; i < 3; i++) {
        const circle = document.createElement('div');
        circle.className = `circle ${isPlaying ? 'playing' : ''}`;
        waveVisualizer.appendChild(circle);
      }
    } else if (visualizerType === 'waves') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.className = `wave ${isPlaying ? 'playing' : ''}`;
      path.setAttribute('d', 'M0 30 Q20 10 40 30 T80 30 T120 30 T160 30');
      svg.appendChild(path);
      waveVisualizer.appendChild(svg);
    }
  }

  function updateMarquee() {
    if (stationName.scrollWidth > stationName.clientWidth) {
      stationName.classList.add('marquee');
    } else {
      stationName.classList.remove('marquee');
    }
  }

  function normalizeCountry(country) {
    if (!country) return '';
    const countryMap = {
      ukraine: 'Ukraine', italy: 'Italy', german: 'Germany', germany: 'Germany',
      france: 'France', spain: 'Spain', usa: 'United States', 'united states': 'United States',
      uk: 'United Kingdom', 'united kingdom': 'United Kingdom', netherlands: 'Netherlands',
      canada: 'Canada', australia: 'Australia', switzerland: 'Switzerland', belgium: 'Belgium',
      poland: 'Poland', austria: 'Austria', sweden: 'Sweden', norway: 'Norway',
      denmark: 'Denmark', japan: 'Japan', 'south korea': 'South Korea', 'new zealand': 'New Zealand'
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

  function normalizeUrl(url) {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      return urlObj.origin + urlObj.pathname;
    } catch {
      return url;
    }
  }

  function resetStationInfo() {
    stationName.textContent = 'Select station';
    stationGenre.textContent = 'genre: -';
    stationCountry.textContent = 'country: -';
    const stationIconElement = currentStationInfo.querySelector('.station-icon');
    if (stationIconElement) {
      stationIconElement.innerHTML = '🎵';
      stationIconElement.style.backgroundImage = 'none';
    }
    updateMarquee();
  }

  async function loadStations() {
    console.time('loadStations');
    stationList.innerHTML = '<div class="station-item empty">Loading...</div>';
    try {
      abortController.abort();
      abortController = new AbortController();
      let url = currentTab === 'search' ? `https://de1.api.radio-browser.info/json/stations/search?order=clickcount&reverse=true&limit=2000` : `stations.json?t=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store', signal: abortController.signal });
      console.log(`Response status: ${response.status}`);
      const mergedStationLists = {};
      if (response.ok) {
        const newStations = await response.json();
        if (currentTab === 'search') {
          renderSearchResults(newStations.filter(station => station.url_resolved && isValidUrl(station.url_resolved)));
        } else {
          Object.keys(newStations).forEach(tab => {
            const uniqueStations = new Map();
            (userAddedStations[tab] || []).forEach(s => {
              if (!deletedStations.includes(s.name)) uniqueStations.set(s.name, s);
            });
            newStations[tab].forEach(s => {
              if (!deletedStations.includes(s.name)) uniqueStations.set(s.name, s);
            });
            mergedStationLists[tab] = Array.from(uniqueStations.values());
            console.log(`Added to ${tab}:`, mergedStationLists[tab].map(s => s.name));
          });
          customTabs.forEach(tab => {
            const uniqueStations = new Map();
            (userAddedStations[tab] || []).forEach(s => {
              if (!deletedStations.includes(s.name)) uniqueStations.set(s.name, s);
            });
            (stationLists[tab] || []).forEach(s => {
              if (!deletedStations.includes(s.name)) uniqueStations.set(s.name, s);
            });
            mergedStationLists[tab] = Array.from(uniqueStations.values());
            console.log(`Saved for custom tab ${tab}:`, mergedStationLists[tab].map(s => s.name));
          });
          stationLists = mergedStationLists;
          localStorage.setItem('stationLists', JSON.stringify(stationLists));
          favoriteStations = favoriteStations.filter(name =>
            Object.values(stationLists).flat().some(s => s.name === name)
          );
          localStorage.setItem('favoriteStations', JSON.stringify(favoriteStations));
          updateStationList();
        }
      } else {
        console.warn('Failed to load stations.json, using cached data');
        updateStationList();
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error loading stations:', error);
        customTabs.forEach(tab => {
          const uniqueStations = new Map();
          (userAddedStations[tab] || []).forEach(s => {
            if (!deletedStations.includes(s.name)) uniqueStations.set(s.name, s);
          });
          (stationLists[tab] || []).forEach(s => {
            if (!deletedStations.includes(s.name)) uniqueStations.set(s.name, s);
          });
          stationLists[tab] = Array.from(uniqueStations.values());
        });
        localStorage.setItem('stationLists', JSON.stringify(stationLists));
        stationList.innerHTML = '<div class="station-item empty">Failed to load stations</div>';
      }
    } finally {
      console.timeEnd('loadStations');
    }
  }

  async function searchStations(query, country, genre) {
    stationList.innerHTML = '<div class="station-item empty">Searching...</div>';
    try {
      abortController.abort();
      abortController = new AbortController();
      const params = new URLSearchParams();
      if (query) params.append('name', query);
      if (country) params.append('country', country);
      if (genre) params.append('tag', genre);
      params.append('order', 'clickcount');
      params.append('reverse', 'true');
      params.append('limit', '2000');
      const url = `https://de1.api.radio-browser.info/json/stations arm/search?${params.toString()}`;
      console.log('API request:', url);
      const response = await fetch(url, { signal: abortController.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let stations = await response.json();
      stations = stations.filter(station => station.url_resolved && isValidUrl(station.url_resolved));
      console.log('Received stations (after HTTPS filter):', stations.length);
      renderSearchResults(stations);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error searching stations:', error);
        stationList.innerHTML = '<div class="station-item empty">Failed to find stations</div>';
      }
    }
  }

  function renderSearchResults(stations) {
    stationList.innerHTML = '';
    stationItems = [];
    if (!stations.length) {
      stationList.innerHTML = '<div class="station-item empty">Nothing found</div>';
      return;
    }
    const fragment = document.createDocumentFragment();
    stations.forEach((station, index) => {
      const item = document.createElement('div');
      item.className = `station-item ${index === currentIndex ? 'selected' : ''}`;
      item.dataset.value = station.url_resolved;
      item.dataset.name = station.name || 'Unknown';
      item.dataset.genre = shortenGenre(station.tags || 'Unknown');
      item.dataset.country = station.country || 'Unknown';
      item.dataset.favicon = station.favicon && isValidUrl(station.favicon) ? station.favicon : '';
      const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" onerror="this.outerHTML='🎵 '">` : '🎵 ';
      item.innerHTML = `
        ${iconHtml}
        <div class="station-name">${station.name}</div>
        <div class="buttons-container">
          <button class="add-btn" aria-label="Додати до вкладки">➕</button>
        </div>`;
      fragment.appendChild(item);
    });
    stationList.appendChild(fragment);
    stationItems = document.querySelectorAll('.station-item');
    if (stationItems.length && currentIndex < stationItems.length) {
      changeStation(currentIndex);
    }
  }

  function shortenGenre(tags) {
    const genres = tags.split(',').map(g => g.trim()).filter(g => g);
    return genres.length > 4 ? genres.slice(0, 4).join(', ') + '...' : genres.join(', ');
  }

  function showTabModal(item) {
    modalOverlay.style.display = 'block';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <h2>Додати до вкладки</h2>
      <div class="modal-tabs">
        <button class="modal-tab-btn" data-tab="techno">TECHNO</button>
        <button class="modal-tab-btn" data-tab="trance">TRANCE</button>
        <button class="modal-tab-btn" data-tab="ua">UA</button>
        <button class="modal-tab-btn" data-tab="pop">POP</button>
        ${customTabs.map(tab => `<button class="modal-tab-btn" data-tab="${tab}">${tab.toUpperCase()}</button>`).join('')}
        <button class="modal-cancel-btn">Скасувати</button>
      </div>`;
    document.body.appendChild(modal);
    const closeModal = () => {
      modalOverlay.style.display = 'none';
      modal.remove();
    };
    modal.querySelectorAll('.modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        saveStation(item, btn.dataset.tab);
        closeModal();
      });
    });
    modal.querySelector('.modal-cancel-btn').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);
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
        favicon: item.dataset.favicon || '',
        isFromSearch: currentTab === 'search'
      };
      stationLists[targetTab].unshift(newStation);
      userAddedStations[targetTab].unshift(newStation);
      localStorage.setItem('stationLists', JSON.stringify(stationLists));
      localStorage.setItem('userAddedStations', JSON.stringify(userAddedStations));
      console.log(`Added station ${stationName} to ${targetTab}:`, newStation);
      if (currentTab !== 'search') updateStationList();
    } else {
      alert('This station is already added to the selected tab!');
    }
  }

  function renderTabs() {
    const fixedTabs = ['best', 'techno', 'trance', 'ua', 'pop', 'search'];
    tabsDropdown.innerHTML = '';
    fixedTabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.dataset.tab = tab;
      btn.textContent = tab === 'search' ? '🔍 Search' : tab === 'ua' ? '🇺🇦 UA' : tab.charAt(0).toUpperCase() + tab.slice(1);
      if (tab === currentTab) btn.classList.add('active');
      tabsDropdown.appendChild(btn);
    });
    customTabs.forEach(tab => {
      if (typeof tab !== 'string' || !tab.trim()) return;
      const btn = document.createElement('button');
      btn.dataset.tab = tab;
      btn.innerHTML = `${tab.toUpperCase()} <span class="edit-tab" style="margin-left: 8px;">✏️</span>`;
      if (tab === currentTab) btn.classList.add('active');
      tabsDropdown.appendChild(btn);
    });
    const addBtn = document.createElement('button');
    addBtn.textContent = '➕ Додати вкладку';
    addBtn.addEventListener('click', () => {
      newTabModal.style.display = 'block';
      modalOverlay.style.display = 'block';
    });
    tabsDropdown.appendChild(addBtn);

    tabsDropdown.querySelectorAll('button').forEach(btn => {
      if (customTabs.includes(btn.dataset.tab)) {
        let longPressTimer;
        btn.querySelector('.edit-tab').addEventListener('click', () => {
          editTabInput.value = btn.dataset.tab;
          editTabModal.style.display = 'block';
          modalOverlay.style.display = 'block';
          saveTabButton.dataset.oldTab = btn.dataset.tab;
        });
        btn.addEventListener('pointerdown', () => {
          longPressTimer = setTimeout(() => {
            editTabInput.value = btn.dataset.tab;
            editTabModal.style.display = 'block';
            modalOverlay.style.display = 'block';
            saveTabButton.dataset.oldTab = btn.dataset.tab;
          }, 500);
        });
        btn.addEventListener('pointerup', () => clearTimeout(longPressTimer));
        btn.addEventListener('pointerleave', () => clearTimeout(longPressTimer));
      }
    });
  }

  function showNewTabModal() {
    newTabModal.style.display = 'block';
    modalOverlay.style.display = 'block';
    newTabInput.value = '';
    newTabInput.focus();
    const createTabHandler = () => {
      const tabName = newTabInput.value.trim().toLowerCase();
      if (!tabName) {
        alert('Enter tab name!');
        return;
      }
      if (['best', 'techno', 'trance', 'ua', 'pop', 'search'].includes(tabName) || customTabs.includes(tabName)) {
        alert('This tab name already exists!');
        return;
      }
      if (tabName.length > 10 || !/^[a-z0-9_-]+$/.test(tabName)) {
        alert('Tab name cannot exceed 10 characters and must contain only Latin letters, numbers, hyphen or underscore.');
        return;
      }
      if (customTabs.length >= 7) {
        alert('Maximum of 7 custom tabs reached!');
        return;
      }
      customTabs.push(tabName);
      stationLists[tabName] = [];
      userAddedStations[tabName] = [];
      localStorage.setItem('customTabs', JSON.stringify(customTabs));
      localStorage.setItem('stationLists', JSON.stringify(stationLists));
      localStorage.setItem('userAddedStations', JSON.stringify(userAddedStations));
      renderTabs();
      switchTab(tabName);
      newTabModal.style.display = 'none';
      modalOverlay.style.display = 'none';
    };
    addTabButton.onclick = createTabHandler;
    newTabInput.onkeypress = e => {
      if (e.key === 'Enter') createTabHandler();
    };
  }

  function exportSettings() {
    const settings = {
      selectedTheme: localStorage.getItem('selectedTheme') || 'deep-obsidian',
      customTabs,
      userAddedStations,
      favoriteStations,
      pastSearches,
      deletedStations,
      currentTab
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'radio_settings.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('Settings exported:', settings);
    menuDropdown.classList.remove('show');
  }

  function importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target.result);
        if (!settings || typeof settings !== 'object') {
          alert('Invalid settings file!');
          return;
        }
        const validThemes = ['deep-obsidian', 'void-nexus', 'shadow-pulse', 'dark-abyss', 'cosmic-dream', 'midnight-aurora', 'emerald-glow', 'retro-wave', 'arctic-fusion', 'golden-haze'];
        if (settings.selectedTheme && validThemes.includes(settings.selectedTheme)) {
          applyTheme(settings.selectedTheme);
        }
        if (Array.isArray(settings.customTabs)) {
          const validTabs = settings.customTabs.filter(tab =>
            typeof tab === 'string' && tab.trim() && tab.length <= 10 && /^[a-z0-9_-]+$/.test(tab) &&
            !['best', 'techno', 'trance', 'ua', 'pop', 'search'].includes(tab) && !customTabs.includes(tab)
          );
          if (validTabs.length + customTabs.length <= 7) {
            customTabs = validTabs;
            localStorage.setItem('customTabs', JSON.stringify(customTabs));
          }
        }
        if (settings.userAddedStations && typeof settings.userAddedStations === 'object') {
          const validStations = {};
          Object.keys(settings.userAddedStations).forEach(tab => {
            if (['techno', 'trance', 'ua', 'pop', ...customTabs].includes(tab)) {
              const stations = Array.isArray(settings.userAddedStations[tab]) ?
                settings.userAddedStations[tab].filter(s =>
                  s && typeof s === 'object' && s.name && typeof s.name === 'string' &&
                  s.value && isValidUrl(s.value) && s.genre && typeof s.genre === 'string' &&
                  s.country && typeof s.country === 'string'
                ) : [];
              validStations[tab] = stations;
            }
          });
          userAddedStations = validStations;
          localStorage.setItem('userAddedStations', JSON.stringify(userAddedStations));
        }
        if (Array.isArray(settings.favoriteStations)) {
          favoriteStations = settings.favoriteStations.filter(name => typeof name === 'string');
          localStorage.setItem('favoriteStations', JSON.stringify(favoriteStations));
        }
        if (Array.isArray(settings.pastSearches)) {
          pastSearches = settings.pastSearches.filter(search => typeof search === 'string').slice(0, 5);
          localStorage.setItem('pastSearches', JSON.stringify(pastSearches));
          updatePastSearches();
        }
        if (Array.isArray(settings.deletedStations)) {
          deletedStations = settings.deletedStations.filter(name => typeof name === 'string');
          localStorage.setItem('deletedStations', JSON.stringify(deletedStations));
        }
        if (settings.currentTab && ['best', 'techno', 'trance', 'ua', 'pop', 'search', ...customTabs].includes(settings.currentTab)) {
          currentTab = settings.currentTab;
          localStorage.setItem('currentTab', currentTab);
        }
        loadStations();
        switchTab(currentTab);
        alert('Settings imported successfully!');
      } catch (error) {
        console.error('Error importing settings:', error);
        alert('Error importing settings. Please check the file format.');
      }
    };
    reader.readAsText(file);
  }

  function updatePastSearches() {
    pastSearchesList.innerHTML = pastSearches.map(search => `<option value="${search}">`).join('');
  }

  function populateSearchSuggestions() {
    const suggestedCountries = [
      'Germany', 'France', 'United Kingdom', 'Italy', 'Spain', 'Netherlands', 'Switzerland',
      'Belgium', 'Sweden', 'Norway', 'Denmark', 'Austria', 'Poland', 'Ukraine', 'Canada',
      'United States', 'Australia', 'Japan', 'South Korea', 'New Zealand'
    ];
    const suggestedGenres = [
      'Pop', 'Rock', 'Dance', 'Electronic', 'Techno', 'Trance', 'House', 'EDM', 'Hip-Hop',
      'Rap', 'Jazz', 'Classical', 'Country', 'Reggae', 'Blues', 'Folk', 'Metal', 'R&B', 'Soul', 'Ambient'
    ];
    countriesList.innerHTML = suggestedCountries.map(country => `<option value="${country}">`).join('');
    genresList.innerHTML = suggestedGenres.map(genre => `<option value="${genre}">`).join('');
  }

  function updateStationList() {
    let stations = currentTab === 'best'
      ? favoriteStations.map(name => Object.values(stationLists).flat().find(s => s.name === name)).filter(s => s)
      : stationLists[currentTab] || [];
    stationList.innerHTML = '';
    stationItems = [];
    if (!stations.length) {
      currentIndex = 0;
      stationList.innerHTML = `<div class="station-item empty">${currentTab === 'best' ? 'No favorite stations' : 'No stations in this category'}</div>`;
      return;
    }
    const fragment = document.createDocumentFragment();
    stations.forEach((station, index) => {
      const item = document.createElement('div');
      item.className = `station-item ${index === currentIndex ? 'selected' : ''}`;
      item.dataset.value = station.value;
      item.dataset.name = station.name;
      item.dataset.genre = shortenGenre(station.genre);
      item.dataset.country = station.country;
      item.dataset.favicon = station.favicon && isValidUrl(station.favicon) ? station.favicon : '';
      const iconHtml = item.dataset.favicon ? `<img src="${item.dataset.favicon}" alt="${station.name} icon" onerror="this.outerHTML='🎵 '; console.warn('Error loading favicon:', '${item.dataset.favicon}');">` : '🎵 ';
      const deleteButton = ['techno', 'trance', 'ua', 'pop', ...customTabs].includes(currentTab)
        ? `<button class="delete-btn" aria-label="Видалити станцію">🗑</button>`
        : '';
      item.innerHTML = `
        ${iconHtml}
        <div class="station-name">${station.name}</div>
        <div class="buttons-container">
          ${deleteButton}
          <button class="favorite-btn${favoriteStations.includes(station.name) ? ' favorited' : ''}" aria-label="Додати до улюблених">★</button>
        </div>`;
      fragment.appendChild(item);
    });
    stationList.appendChild(fragment);
    stationItems = stationList.querySelectorAll('.station-item');
    if (stationItems.length && currentIndex < stationItems.length && !stationItems[currentIndex].classList.contains('empty')) {
      stationItems[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      changeStation(currentIndex);
    }
  }

  function toggleFavorite(stationName) {
    if (favoriteStations.includes(stationName)) {
      favoriteStations = favoriteStations.filter(name => name !== stationName);
    } else {
      favoriteStations.unshift(stationName);
    }
    localStorage.setItem('favoriteStations', JSON.stringify(favoriteStations));
    if (currentTab === 'best') switchTab('best');
    else updateStationList();
  }

  function deleteStation(stationName) {
    if (Array.isArray(stationLists[currentTab])) {
      const station = stationLists[currentTab].find(s => s.name === stationName);
      if (!station) {
        console.warn(`Station ${stationName} not found in ${currentTab}`);
        return;
      }
      stationLists[currentTab] = stationLists[currentTab].filter(s => s.name !== stationName);
      userAddedStations[currentTab] = userAddedStations[currentTab]?.filter(s => s.name !== stationName) || [];
      if (!station.isFromSearch && !deletedStations.includes(stationName)) {
        deletedStations.push(stationName);
        localStorage.setItem('deletedStations', JSON.stringify(deletedStations));
      }
      localStorage.setItem('stationLists', JSON.stringify(stationLists));
      localStorage.setItem('userAddedStations', JSON.stringify(userAddedStations));
      favoriteStations = favoriteStations.filter(name => name !== stationName);
      localStorage.setItem('favoriteStations', JSON.stringify(favoriteStations));
      if (stationLists[currentTab].length === 0) {
        currentIndex = 0;
      } else if (currentIndex >= stationLists[currentTab].length) {
        currentIndex = stationLists[currentTab].length - 1;
      }
      switchTab(currentTab);
    }
  }

  function changeStation(index) {
    if (!stationItems || index < 0 || index >= stationItems.length || stationItems[index].classList.contains('empty')) return;
    const item = stationItems[index];
    stationItems.forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');
    currentIndex = index;
    updateCurrentStation(item);
    localStorage.setItem(`lastStation_${currentTab}`, index);
    if (intendedPlaying) {
      const normalizedCurrentUrl = normalizeUrl(item.dataset.value);
      const normalizedAudioSrc = normalizeUrl(audio.src);
      if (normalizedAudioSrc !== normalizedCurrentUrl || audio.paused || audio.error || audio.readyState < 2 || audio.currentTime === 0) {
        console.log('changeStation: Starting playback after station change');
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
      } else {
        console.log('changeStation: Skip playback, station already playing');
      }
    }
  }

  function updateCurrentStation(item) {
    if (!currentStationInfo || !item.dataset) {
      console.error('currentStationInfo or item.dataset not found');
      resetStationInfo();
      return;
    }
    stationName.textContent = item.dataset.name || '';
    stationGenre.textContent = item.dataset.genre || '';
    stationCountry.textContent = item.dataset.country || '';
    const stationIconElement = currentStationInfo.querySelector('.station-icon');
    if (stationIconElement) {
      if (item.dataset.favicon && isValidUrl(item.dataset.favicon)) {
        stationIconElement.innerHTML = '';
        stationIconElement.style.backgroundImage = `url(${item.dataset.favicon})`;
        stationIconElement.style.backgroundSize = 'contain';
        stationIconElement.style.backgroundRepeat = 'no-repeat';
        stationIconElement.style.backgroundPosition = 'center';
      } else {
        stationIconElement.innerHTML = '🎵';
        stationIconElement.style.backgroundImage = 'none';
      }
    }
    updateMarquee();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.dataset.name || 'Unknown Station',
        artist: `${item.dataset.genre || ''} | ${item.dataset.country || ''}`,
        album: 'Radio Music',
        artwork: item.dataset.favicon && isValidUrl(item.dataset.favicon) ? [
          { src: item.dataset.favicon, sizes: '96x96', type: 'image/png' },
          { src: item.dataset.favicon, sizes: '128x128', type: 'image/png' },
          { src: item.dataset.favicon, sizes: '192x192', type: 'image/png' },
          { src: item.dataset.favicon, sizes: '256x256', type: 'image/png' },
          { src: item.dataset.favicon, sizes: '384x384', type: 'image/png' },
          { src: item.dataset.favicon, sizes: '512x512', type: 'image/png' }
        ] : []
      });
    }
  }

  function prevStation() {
    if (!stationItems?.length) return;
    currentIndex = currentIndex > 0 ? currentIndex - 1 : stationItems.length - 1;
    if (stationItems[currentIndex].classList.contains('empty')) currentIndex = 0;
    changeStation(currentIndex);
  }

  function nextStation() {
    if (!stationItems?.length) return;
    currentIndex = currentIndex < stationItems.length - 1 ? currentIndex + 1 : 0;
    if (stationItems[currentIndex].classList.contains('empty')) currentIndex = 0;
    changeStation(currentIndex);
  }

  function togglePlayPause() {
    if (audio.paused) {
      isPlaying = true;
      intendedPlaying = true;
      debouncedTryAutoPlay();
      playButton.textContent = '⏸️';
      playButton.setAttribute('aria-label', 'Зупинити');
      document.querySelectorAll('.wave-line, .circle, .wave').forEach(el => el.classList.add('playing'));
    } else {
      audio.pause();
      isPlaying = false;
      intendedPlaying = false;
      playButton.textContent = '▶️';
      playButton.setAttribute('aria-label', 'Відтворити');
      document.querySelectorAll('.wave-line, .circle, .wave').forEach(el => el.classList.remove('playing'));
    }
    localStorage.setItem('isPlaying', isPlaying);
    localStorage.setItem('intendedPlaying', intendedPlaying);
  }

  function debouncedTryAutoPlay(retryCount = 2, delay = 1000) {
    if (isAutoPlayPending) {
      console.log('debouncedTryAutoPlay: Skip, previous tryAutoPlay still active');
      return;
    }
    const now = Date.now();
    const currentStationUrl = stationItems?.[currentIndex]?.dataset?.value;
    const normalizedCurrentUrl = normalizeUrl(currentStationUrl);
    const normalizedAudioSrc = normalizeUrl(audio.src);
    if (now - lastSuccessfulPlayTime < 500 && normalizedAudioSrc === normalizedCurrentUrl) {
      console.log('debouncedTryAutoPlay: Skip, recently played successfully for same station');
      return;
    }
    if (autoPlayTimeout) clearTimeout(autoPlayTimeout);
    autoPlayRequestId++;
    const currentRequestId = autoPlayRequestId;
    autoPlayTimeout = setTimeout(() => tryAutoPlay(retryCount, delay, currentRequestId), 0);
  }

  let autoPlayTimeout = null;
  async function tryAutoPlay(retryCount = 2, delay = 1000, requestId) {
    if (isAutoPlayPending) {
      console.log('tryAutoPlay: Skip, another tryAutoPlay active');
      return;
    }
    if (requestId !== autoPlayRequestId) {
      console.log('tryAutoPlay: Skip, outdated request ID', { requestId, current: autoPlayRequestId });
      return;
    }
    isAutoPlayPending = true;
    try {
      if (!navigator.onLine) {
        console.log('Device offline: skipping playback');
        return;
      }
      if (!intendedPlaying || !stationItems?.length || currentIndex >= stationItems.length) {
        console.log('Skip tryAutoPlay: invalid state', { intendedPlaying, hasStationItems: !!stationItems?.length, isIndexValid: currentIndex < stationItems.length });
        document.querySelectorAll('.wave-line, .circle, .wave').forEach(el => el.classList.remove('playing'));
        return;
      }
      const currentStationUrl = stationItems[currentIndex].dataset.value;
      const initialStationUrl = currentStationUrl;
      const normalizedCurrentUrl = normalizeUrl(currentStationUrl);
      const normalizedAudioSrc = normalizeUrl(audio.src);
      if (normalizedAudioSrc === normalizedCurrentUrl && !audio.paused && !audio.error && audio.readyState >= 2 && audio.currentTime > 0) {
        console.log('Skip tryAutoPlay: audio already playing with correct src, no errors and active stream');
        return;
      }
      if (!isValidUrl(currentStationUrl)) {
        console.error('Invalid URL:', currentStationUrl);
        errorCount++;
        if (errorCount >= ERROR_LIMIT) {
          console.error('Reached playback error limit');
          resetStationInfo();
        }
        return;
      }

      const attemptPlay = async (attemptsLeft) => {
        if (streamAbortController) {
          streamAbortController.abort();
          console.log('Previous audio stream canceled');
          streamAbortController = null;
        }
        if (stationItems[currentIndex].dataset.value !== initialStationUrl) {
          console.log('tryAutoPlay: Station changed, canceling playback for', initialStationUrl);
          return;
        }
        if (requestId !== autoPlayRequestId) {
          console.log('tryAutoPlay: Skip attempt, outdated request ID', { requestId, current: autoPlayRequestId });
          return;
        }
        streamAbortController = new AbortController();
        audio.pause();
        audio.src = null;
        audio.load();
        audio.src = currentStationUrl + '?nocache=' + Date.now();
        console.log(`Playback attempt (${attemptsLeft} left):`, audio.src);
        try {
          await audio.play();
          errorCount = 0;
          isPlaying = true;
          lastSuccessfulPlayTime = Date.now();
          console.log('Playback started successfully');
          document.querySelectorAll('.wave-line, .circle, .wave').forEach(el => el.classList.add('playing'));
          localStorage.setItem('isPlaying', isPlaying);
          updateCurrentStation(stationItems[currentIndex]);
        } catch (error) {
          if (error.name === 'AbortError') {
            console.log('Stream request canceled');
            return;
          }
          console.error('Playback error:', error);
          document.querySelectorAll('.wave-line, .circle, .wave').forEach(el => el.classList.remove('playing'));
          if (attemptsLeft > 1) {
            if (stationItems[currentIndex].dataset.value !== initialStationUrl) {
              console.log('tryAutoPlay: Station changed during retry, canceling');
              return;
            }
            if (requestId !== autoPlayRequestId) {
              console.log('tryAutoPlay: Skip retry, outdated request ID', { requestId, current: autoPlayRequestId });
              return;
            }
            console.log(`Retrying in ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            await attemptPlay(attemptsLeft - 1);
          } else {
            errorCount++;
            if (errorCount >= ERROR_LIMIT) {
              console.error('Reached playback error limit');
              resetStationInfo();
            }
          }
        } finally {
          streamAbortController = null;
        }
      };
      await attemptPlay(retryCount);
    } finally {
      isAutoPlayPending = false;
      streamAbortController = null;
    }
  }

  function switchTab(tab) {
    const validTabs = ['best', 'techno', 'trance', 'ua', 'pop', 'search', ...customTabs];
    if (!validTabs.includes(tab)) {
      tab = 'techno';
    }
    currentTab = tab;
    localStorage.setItem('currentTab', tab);
    const savedIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
    const maxIndex = tab === 'best' ? favoriteStations.length - 1 : tab === 'search' ? 0 : stationLists[tab]?.length - 1 || 0;
    currentIndex = savedIndex <= maxIndex && savedIndex >= 0 ? savedIndex : 0;
    searchInput.classList.toggle('show', tab === 'search');
    searchQuery.value = '';
    searchCountry.value = '';
    searchGenre.value = '';
    clearSearch.style.display = 'none';
    if (tab === 'search') populateSearchSuggestions();
    updateStationList();
    renderTabs();
    if (stationItems?.length && currentIndex < stationItems.length && intendedPlaying) {
      const normalizedCurrentUrl = normalizeUrl(stationItems[currentIndex].dataset.value);
      const normalizedAudioSrc = normalizeUrl(audio.src);
      if (normalizedAudioSrc !== normalizedCurrentUrl || audio.paused || audio.error || audio.readyState < 2 || audio.currentTime === 0) {
        console.log('switchTab: Starting playback after tab change');
        isAutoPlayPending = false;
        debouncedTryAutoPlay();
      } else {
        console.log('switchTab: Skip playback, station already playing');
      }
    }
  }

  function toggleTheme() {
    const themes = [
      'deep-obsidian', 'void-nexus', 'shadow-pulse', 'dark-abyss', 'cosmic-dream',
      'midnight-aurora', 'emerald-glow', 'retro-wave', 'arctic-fusion', 'golden-haze'
    ];
    const currentTheme = localStorage.getItem('selectedTheme') || 'deep-obsidian';
    const currentIndex = themes.indexOf(currentTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    applyTheme(nextTheme);
    menuDropdown.classList.remove('show');
  }

  function applyTheme(theme) {
    const themeStyles = {
      'deep-obsidian': {
        '--body-bg': 'linear-gradient(180deg, #1A1A1A, #000000)',
        '--container-bg': '#1A1A1A',
        '--accent': '#00A3CC',
        '--text': '#F0F0F0',
        '--accent-gradient': 'linear-gradient(45deg, #006D8F, #00A3CC)',
        '--shadow': 'rgba(0, 163, 204, 0.4)'
      },
      'void-nexus': {
        '--body-bg': 'linear-gradient(180deg, #0D0D0D, #000000)',
        '--container-bg': '#0D0D0D',
        '--accent': '#FF2E63',
        '--text': '#E0E0E0',
        '--accent-gradient': 'linear-gradient(45deg, #C724B1, #FF2E63)',
        '--shadow': 'rgba(255, 46, 99, 0.4)'
      },
      'shadow-pulse': {
        '--body-bg': 'linear-gradient(180deg, #1C2526, #000000)',
        '--container-bg': '#1C2526',
        '--accent': '#4B0082',
        '--text': '#D3D3D3',
        '--accent-gradient': 'linear-gradient(45deg, #2F004F, #4B0082)',
        '--shadow': 'rgba(75, 0, 130, 0.4)'
      },
      'dark-abyss': {
        '--body-bg': 'linear-gradient(180deg, #121212, #000000)',
        '--container-bg': '#121212',
        '--accent': '#008080',
        '--text': '#E8E8E8',
        '--accent-gradient': 'linear-gradient(45deg, #005F5F, #008080)',
        '--shadow': 'rgba(0, 128, 128, 0.4)'
      },
      'cosmic-dream': {
        '--body-bg': 'linear-gradient(180deg, #1B263B, #000000)',
        '--container-bg': '#1B263B',
        '--accent': '#FF6347',
        '--text': '#F5F5F5',
        '--accent-gradient': 'linear-gradient(45deg, #C73E1D, #FF6347)',
        '--shadow': 'rgba(255, 99, 71, 0.4)'
      },
      'midnight-aurora': {
        '--body-bg': 'linear-gradient(180deg, #0B1622, #000000)',
        '--container-bg': '#0B1622',
        '--accent': '#00CED1',
        '--text': '#E6E6E6',
        '--accent-gradient': 'linear-gradient(45deg, #008B8B, #00CED1)',
        '--shadow': 'rgba(0, 206, 209, 0.4)'
      },
      'emerald-glow': {
        '--body-bg': 'linear-gradient(180deg, #1A3C34, #000000)',
        '--container-bg': '#1A3C34',
        '--accent': '#32CD32',
        '--text': '#F0FFF0',
        '--accent-gradient': 'linear-gradient(45deg, #228B22, #32CD32)',
        '--shadow': 'rgba(50, 205, 50, 0.4)'
      },
      'retro-wave': {
        '--body-bg': 'linear-gradient(180deg, #2A213A, #000000)',
        '--container-bg': '#2A213A',
        '--accent': '#FF69B4',
        '--text': '#F8F8FF',
        '--accent-gradient': 'linear-gradient(45deg, #C71585, #FF69B4)',
        '--shadow': 'rgba(255, 105, 180, 0.4)'
      },
      'arctic-fusion': {
        '--body-bg': 'linear-gradient(180deg, #E6F0FA, #B0C4DE)',
        '--container-bg': '#E6F0FA',
        '--accent': '#4682B4',
        '--text': '#000000',
        '--accent-gradient': 'linear-gradient(45deg, #2F4F4F, #4682B4)',
        '--shadow': 'rgba(70, 130, 180, 0.4)'
      },
      'golden-haze': {
        '--body-bg': 'linear-gradient(180deg, #3C2F2F, #000000)',
        '--container-bg': '#3C2F2F',
        '--accent': '#FFD700',
        '--text': '#FFF8DC',
        '--accent-gradient': 'linear-gradient(45deg, #DAA520, #FFD700)',
        '--shadow': 'rgba(255, 215, 0, 0.4)'
      }
    };

    if (themeStyles[theme]) {
      Object.entries(themeStyles[theme]).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
      localStorage.setItem('selectedTheme', theme);
      console.log(`Theme applied: ${theme}`);
    } else {
      console.warn(`Theme ${theme} not found, applying default`);
      applyTheme('deep-obsidian');
    }
  }
});