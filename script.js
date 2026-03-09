/**
 * Radio Music - Modern Audio Player
 * Optimized for mobile devices with drag-and-drop, sleep timer, and performance improvements
 */

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================

const CONFIG = {
  ERROR_LIMIT: 5,
  RETRY_DELAY: 1000,
  MAX_RETRIES: 3,
  DEBOUNCE_DELAY: 150,
  LONG_PRESS_DURATION: 500,
  PULL_THRESHOLD: 80,
  VIRTUAL_SCROLL_BUFFER: 5,
  CACHE_VERSION: 'v79'
};

// ============================================
// STATE MANAGEMENT
// ============================================

class StateManager {
  constructor() {
    this.currentTab = this.load('currentTab', 'techno');
    this.currentIndex = 0;
    this.favoriteStations = this.load('favoriteStations', []);
    this.isPlaying = false;
    this.intendedPlaying = this.load('intendedPlaying', false);
    this.stationLists = this.load('stationLists', {});
    this.userAddedStations = this.load('userAddedStations', {});
    this.pastSearches = this.load('pastSearches', []);
    this.deletedStations = this.load('deletedStations', []);
    this.customTabs = this.load('customTabs', []).filter(t => typeof t === 'string' && t.trim());
    this.volume = parseFloat(this.load('volume', 0.9));
    this.selectedTheme = this.load('selectedTheme', 'shadow-pulse');
    
    // Runtime state (not persisted)
    this.isDragging = false;
    this.draggedItem = null;
    this.longPressTimer = null;
    this.touchStartY = 0;
    this.pullStartY = 0;
    this.isPulling = false;
    this.sleepTimerId = null;
    this.sleepTimerEndTime = null;
    this.autoPlayRequestId = 0;
    this.errorCount = 0;
    this.lastSuccessfulPlayTime = 0;
    this.stationItems = [];
    this.abortController = new AbortController();
  }

  load(key, defaultValue) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  persist() {
    this.save('currentTab', this.currentTab);
    this.save('favoriteStations', this.favoriteStations);
    this.save('isPlaying', this.isPlaying);
    this.save('intendedPlaying', this.intendedPlaying);
    this.save('stationLists', this.stationLists);
    this.save('userAddedStations', this.userAddedStations);
    this.save('pastSearches', this.pastSearches);
    this.save('deletedStations', this.deletedStations);
    this.save('customTabs', this.customTabs);
    this.save('volume', this.volume);
    this.save('selectedTheme', this.selectedTheme);
    this.save(`lastStation_${this.currentTab}`, this.currentIndex);
  }
}

const state = new StateManager();

// ============================================
// AUDIO MANAGER
// ============================================

class AudioManager {
  constructor() {
    this.audio = document.getElementById('audioPlayer');
    this.audio.preload = 'none';
    this.audio.volume = state.volume;
    this.retryCount = 0;
    this.currentUrl = null;
    this.isLoading = false;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.audio.addEventListener('playing', () => this.onPlaying());
    this.audio.addEventListener('pause', () => this.onPause());
    this.audio.addEventListener('error', (e) => this.onError(e));
    this.audio.addEventListener('waiting', () => this.onWaiting());
    this.audio.addEventListener('canplay', () => this.onCanPlay());
    this.audio.addEventListener('volumechange', () => {
      state.volume = this.audio.volume;
      state.persist();
    });

    // Handle audio session for mobile
    if ('audioSession' in navigator) {
      navigator.audioSession.type = 'playback';
    }
  }

  async play(url) {
    if (this.isLoading) return;
    
    const normalizedUrl = this.normalizeUrl(url);
    if (this.currentUrl === normalizedUrl && !this.audio.paused) {
      return; // Already playing this URL
    }

    this.isLoading = true;
    this.currentUrl = normalizedUrl;
    state.lastSuccessfulPlayTime = 0;

    ui.showLoading(true);
    ui.updatePlayButton(false);

    try {
      // Stop current playback
      this.audio.pause();
      this.audio.src = '';
      this.audio.load();

      // Small delay to ensure clean state
      await this.delay(100);

      // Set new source with cache-buster
      this.audio.src = `${url}?t=${Date.now()}`;
      
      // Attempt playback
      await this.audio.play();
      
      this.retryCount = 0;
      state.lastSuccessfulPlayTime = Date.now();
      state.errorCount = 0;
      
    } catch (error) {
      console.error('Playback error:', error);
      
      if (this.retryCount < CONFIG.MAX_RETRIES) {
        this.retryCount++;
        ui.showToast(`Повторна спроба (${this.retryCount}/${CONFIG.MAX_RETRIES})...`, 'warning');
        await this.delay(CONFIG.RETRY_DELAY * this.retryCount);
        this.isLoading = false;
        return this.play(url);
      } else {
        ui.showToast('Не вдалося відтворити станцію', 'error');
        this.reset();
      }
    } finally {
      this.isLoading = false;
      ui.showLoading(false);
    }
  }

  pause() {
    this.audio.pause();
    state.intendedPlaying = false;
    state.persist();
  }

  resume() {
    if (this.audio.src && this.audio.paused) {
      this.audio.play().catch(console.error);
      state.intendedPlaying = true;
      state.persist();
    }
  }

  toggle() {
    if (this.audio.paused) {
      state.intendedPlaying = true;
      state.persist();
      if (state.stationItems[state.currentIndex]) {
        const url = state.stationItems[state.currentIndex].dataset.value;
        this.play(url);
      }
    } else {
      this.pause();
    }
  }

  reset() {
    this.audio.pause();
    this.audio.src = '';
    this.currentUrl = null;
    this.retryCount = 0;
    ui.updatePlayButton(false);
    ui.updateWaveVisualizer(false);
  }

  onPlaying() {
    state.isPlaying = true;
    ui.updatePlayButton(true);
    ui.updateWaveVisualizer(true);
    ui.updateMediaSession(state.stationItems[state.currentIndex]);
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }

  onPause() {
    state.isPlaying = false;
    ui.updatePlayButton(false);
    ui.updateWaveVisualizer(false);
    ui.updateCurrentStationPlaying(false);
  }

  onError(error) {
    console.error('Audio error:', error);
    ui.updateWaveVisualizer(false);
    
    if (state.intendedPlaying && state.errorCount < CONFIG.ERROR_LIMIT) {
      state.errorCount++;
      setTimeout(() => {
        if (state.stationItems[state.currentIndex]) {
          const url = state.stationItems[state.currentIndex].dataset.value;
          this.play(url);
        }
      }, CONFIG.RETRY_DELAY);
    }
  }

  onWaiting() {
    ui.showLoading(true);
  }

  onCanPlay() {
    ui.showLoading(false);
  }

  normalizeUrl(url) {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      return urlObj.origin + urlObj.pathname;
    } catch {
      return url;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const audioManager = new AudioManager();

// ============================================
// UI MANAGER
// ============================================

class UIManager {
  constructor() {
    this.elements = {
      audio: document.getElementById('audioPlayer'),
      stationList: document.getElementById('stationList'),
      currentStationInfo: document.getElementById('currentStationInfo'),
      playBtn: document.querySelector('.play-btn'),
      prevBtn: document.querySelector('.prev-btn'),
      nextBtn: document.querySelector('.next-btn'),
      themeToggle: document.querySelector('.theme-toggle'),
      shareBtn: document.querySelector('.share-button'),
      exportBtn: document.querySelector('.export-button'),
      importBtn: document.querySelector('.import-button'),
      importFile: document.getElementById('importFileInput'),
      sleepTimerBtn: document.querySelector('.sleep-timer-btn'),
      searchInput: document.getElementById('searchInput'),
      searchQuery: document.getElementById('searchQuery'),
      searchCountry: document.getElementById('searchCountry'),
      searchGenre: document.getElementById('searchGenre'),
      searchBtn: document.querySelector('.search-btn'),
      tabsContainer: document.getElementById('tabs'),
      loadingIndicator: document.getElementById('loadingIndicator'),
      pullIndicator: document.getElementById('pullIndicator'),
      toastContainer: document.getElementById('toastContainer'),
      sleepModal: document.querySelector('.sleep-timer-modal'),
      newTabModal: document.querySelector('.new-tab-modal'),
      editTabModal: document.querySelector('.edit-tab-modal')
    };

    this.themes = {
      'shadow-pulse': { accent: '#00E676', gradient: 'linear-gradient(45deg, #00B248, #00E676)' },
      'dark-abyss': { accent: '#AA00FF', gradient: 'linear-gradient(45deg, #6A1B9A, #AA00FF)' },
      'emerald-glow': { accent: '#2EC4B6', gradient: 'linear-gradient(45deg, #1B998B, #2EC4B6)' },
      'retro-wave': { accent: '#FF69B4', gradient: 'linear-gradient(45deg, #C71585, #FF69B4)' },
      'neon-pulse': { accent: '#00F0FF', gradient: 'linear-gradient(45deg, #0077B6, #00F0FF)' },
      'lime-surge': { accent: '#B2FF59', gradient: 'linear-gradient(45deg, #00B248, #B2FF59)' },
      'flamingo-flash': { accent: '#FF4081', gradient: 'linear-gradient(45deg, #C71585, #FF4081)' },
      'aqua-glow': { accent: '#26C6DA', gradient: 'linear-gradient(45deg, #0077B6, #26C6DA)' },
      'aurora-haze': { accent: '#64FFDA', gradient: 'linear-gradient(45deg, #1B998B, #64FFDA)' },
      'starlit-amethyst': { accent: '#B388FF', gradient: 'linear-gradient(45deg, #6A1B9A, #B388FF)' },
      'lunar-frost': { accent: '#40C4FF', gradient: 'linear-gradient(45deg, #0077B6, #40C4FF)' }
    };

    this.setupEventListeners();
    this.applyTheme(state.selectedTheme);
  }

  setupEventListeners() {
    // Playback controls
    this.elements.playBtn.addEventListener('click', () => audioManager.toggle());
    this.elements.prevBtn.addEventListener('click', () => stationManager.prev());
    this.elements.nextBtn.addEventListener('click', () => stationManager.next());

    // Top controls
    this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
    this.elements.shareBtn.addEventListener('click', () => this.share());
    this.elements.exportBtn.addEventListener('click', () => this.exportSettings());
    this.elements.importBtn.addEventListener('click', () => this.elements.importFile.click());
    this.elements.importFile.addEventListener('change', (e) => this.importSettings(e));
    this.elements.sleepTimerBtn.addEventListener('click', () => this.showSleepTimer());

    // Search
    this.elements.searchBtn.addEventListener('click', () => stationManager.search());
    [this.elements.searchQuery, this.elements.searchCountry, this.elements.searchGenre].forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') stationManager.search();
      });
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      
      switch(e.key) {
        case 'ArrowLeft':
          stationManager.prev();
          break;
        case 'ArrowRight':
          stationManager.next();
          break;
        case ' ':
          e.preventDefault();
          audioManager.toggle();
          break;
      }
    });

    // Visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.intendedPlaying && navigator.onLine) {
        const currentItem = state.stationItems[state.currentIndex];
        if (currentItem) {
          const url = currentItem.dataset.value;
          if (audioManager.audio.paused || audioManager.audio.error) {
            audioManager.play(url);
          }
        }
      }
    });

    // Online/Offline
    window.addEventListener('online', () => {
      this.showToast('Підключено до мережі', 'success');
      if (state.intendedPlaying) {
        const currentItem = state.stationItems[state.currentIndex];
        if (currentItem) {
          audioManager.play(currentItem.dataset.value);
        }
      }
    });

    window.addEventListener('offline', () => {
      this.showToast('Відсутнє підключення', 'warning');
    });

    // Pull to refresh
    this.setupPullToRefresh();

    // Media session
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => audioManager.toggle());
      navigator.mediaSession.setActionHandler('pause', () => audioManager.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => stationManager.prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => stationManager.next());
    }

    // Touch gestures for player
    this.setupPlayerGestures();
  }

  setupPullToRefresh() {
    const list = this.elements.stationList;
    let startY = 0;
    let isPulling = false;

    list.addEventListener('touchstart', (e) => {
      if (list.scrollTop === 0) {
        startY = e.touches[0].clientY;
        isPulling = true;
      }
    }, { passive: true });

    list.addEventListener('touchmove', (e) => {
      if (!isPulling) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      if (diff > 0 && diff < CONFIG.PULL_THRESHOLD) {
        this.elements.pullIndicator.classList.add('visible');
        this.elements.pullIndicator.style.transform = `translateX(-50%) translateY(${diff * 0.3}px)`;
      } else if (diff >= CONFIG.PULL_THRESHOLD) {
        this.elements.pullIndicator.classList.add('releasing');
      }
    }, { passive: true });

    list.addEventListener('touchend', (e) => {
      if (!isPulling) return;
      
      const currentY = e.changedTouches[0].clientY;
      const diff = currentY - startY;

      this.elements.pullIndicator.classList.remove('visible', 'releasing');
      this.elements.pullIndicator.style.transform = '';

      if (diff >= CONFIG.PULL_THRESHOLD) {
        stationManager.loadStations();
        this.showToast('Оновлено', 'success');
      }

      isPulling = false;
    });
  }

  setupPlayerGestures() {
    const player = this.elements.currentStationInfo;
    let touchStartX = 0;
    let touchEndX = 0;

    player.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    player.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe(touchStartX, touchEndX);
    }, { passive: true });
  }

  handleSwipe(startX, endX) {
    const threshold = 50;
    const diff = startX - endX;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        stationManager.next(); // Swipe left
      } else {
        stationManager.prev(); // Swipe right
      }
    }
  }

  // Theme management
  applyTheme(themeName) {
    const theme = this.themes[themeName] || this.themes['shadow-pulse'];
    document.documentElement.setAttribute('data-theme', themeName);
    
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme.accent);
    }

    state.selectedTheme = themeName;
    state.persist();
  }

  toggleTheme() {
    const themeNames = Object.keys(this.themes);
    const currentIndex = themeNames.indexOf(state.selectedTheme);
    const nextTheme = themeNames[(currentIndex + 1) % themeNames.length];
    this.applyTheme(nextTheme);
    this.showToast(`Тема: ${nextTheme}`, 'success');
  }

  // UI Updates
  updatePlayButton(isPlaying) {
    this.elements.playBtn.textContent = isPlaying ? '⏸' : '▶';
    this.elements.playBtn.classList.toggle('playing', isPlaying);
    this.elements.currentStationInfo.classList.toggle('playing', isPlaying);
  }

  updateWaveVisualizer(isPlaying) {
    const waves = document.querySelectorAll('.wave-line');
    waves.forEach(wave => wave.classList.toggle('playing', isPlaying));
  }

  updateCurrentStationPlaying(isPlaying) {
    this.elements.currentStationInfo.classList.toggle('playing', isPlaying);
  }

  showLoading(show) {
    this.elements.loadingIndicator.classList.toggle('hidden', !show);
  }

  updateCurrentStation(item) {
    if (!item) return;

    const name = item.dataset.name || 'Невідома станція';
    const genre = item.dataset.genre || '-';
    const country = item.dataset.country || '-';
    const favicon = item.dataset.favicon;

    const nameEl = this.elements.currentStationInfo.querySelector('.station-name');
    const genreEl = this.elements.currentStationInfo.querySelector('.station-genre');
    const countryEl = this.elements.currentStationInfo.querySelector('.station-country');
    const iconEl = this.elements.currentStationInfo.querySelector('.station-icon');

    nameEl.textContent = name;
    genreEl.textContent = `жанр: ${genre}`;
    countryEl.textContent = `країна: ${country}`;

    if (favicon && this.isValidUrl(favicon)) {
      iconEl.style.backgroundImage = `url(${favicon})`;
      iconEl.innerHTML = '';
    } else {
      iconEl.style.backgroundImage = 'none';
      iconEl.innerHTML = '🎵';
    }
  }

  updateMediaSession(item) {
    if (!item || !('mediaSession' in navigator)) return;

    const name = item.dataset.name || 'Невідома станція';
    const genre = item.dataset.genre || '';
    const country = item.dataset.country || '';
    const favicon = item.dataset.favicon;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: name,
      artist: `${genre} | ${country}`,
      album: 'Radio Music',
      artwork: favicon && this.isValidUrl(favicon) ? [
        { src: favicon, sizes: '96x96', type: 'image/png' },
        { src: favicon, sizes: '128x128', type: 'image/png' },
        { src: favicon, sizes: '192x192', type: 'image/png' },
        { src: favicon, sizes: '256x256', type: 'image/png' },
        { src: favicon, sizes: '384x384', type: 'image/png' },
        { src: favicon, sizes: '512x512', type: 'image/png' }
      ] : []
    });
  }

  // Toast notifications
  showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
    this.elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, duration);
  }

  // Modal management
  showModal(modal) {
    modal.classList.add('visible');
  }

  hideModal(modal) {
    modal.classList.remove('visible');
  }

  showSleepTimer() {
    this.showModal(this.elements.sleepModal);
    this.updateSleepTimerDisplay();
  }

  updateSleepTimerDisplay() {
    const activeTimer = this.elements.sleepModal.querySelector('.active-timer');
    const timerDisplay = document.getElementById('timerDisplay');
    
    if (state.sleepTimerId) {
      activeTimer.style.display = 'block';
      this.updateTimerCountdown();
    } else {
      activeTimer.style.display = 'none';
    }
  }

  updateTimerCountdown() {
    if (!state.sleepTimerEndTime) return;
    
    const now = Date.now();
    const remaining = Math.max(0, state.sleepTimerEndTime - now);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    const display = document.getElementById('timerDisplay');
    if (display) {
      display.textContent = `Залишилось: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    if (remaining > 0) {
      requestAnimationFrame(() => this.updateTimerCountdown());
    }
  }

  // Import/Export
  exportSettings() {
    const data = {
      version: CONFIG.CACHE_VERSION,
      selectedTheme: state.selectedTheme,
      customTabs: state.customTabs,
      userAddedStations: state.userAddedStations,
      favoriteStations: state.favoriteStations,
      pastSearches: state.pastSearches,
      deletedStations: state.deletedStations,
      currentTab: state.currentTab,
      volume: state.volume
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `radio_settings_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showToast('Налаштування експортовано', 'success');
  }

  importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // Validate
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid file format');
        }

        // Apply settings
        if (data.selectedTheme && this.themes[data.selectedTheme]) {
          this.applyTheme(data.selectedTheme);
        }
        
        if (Array.isArray(data.customTabs)) {
          state.customTabs = data.customTabs.filter(t => typeof t === 'string' && t.trim());
        }
        
        if (data.userAddedStations && typeof data.userAddedStations === 'object') {
          state.userAddedStations = data.userAddedStations;
        }
        
        if (Array.isArray(data.favoriteStations)) {
          state.favoriteStations = data.favoriteStations;
        }
        
        if (Array.isArray(data.pastSearches)) {
          state.pastSearches = data.pastSearches.slice(0, 5);
        }
        
        if (Array.isArray(data.deletedStations)) {
          state.deletedStations = data.deletedStations;
        }

        state.persist();
        stationManager.loadStations();
        this.showToast('Налаштування імпортовано', 'success');
        
      } catch (error) {
        console.error('Import error:', error);
        this.showToast('Помилка імпорту', 'error');
      }
      
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  share() {
    const currentItem = state.stationItems[state.currentIndex];
    const stationName = currentItem ? currentItem.dataset.name : 'Radio Music';
    
    const shareData = {
      title: 'Radio Music',
      text: `Слухаю ${stationName} в Radio Music!`,
      url: window.location.href
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      this.showToast('Посилання скопійовано', 'success');
    }
  }

  isValidUrl(url) {
    if (!url) return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

const ui = new UIManager();

// ============================================
// STATION MANAGER
// ============================================

class StationManager {
  constructor() {
    this.setupTabs();
    this.setupModals();
    this.setupSleepTimer();
    this.setupDragAndDrop();
  }

  // ==================== DATA LOADING ====================

  async loadStations() {
    ui.showLoading(true);
    
    try {
      state.abortController.abort();
      state.abortController = new AbortController();

      const response = await fetch(`stations.json?t=${Date.now()}`, {
        cache: 'no-store',
        signal: state.abortController.signal
      });

      if (!response.ok) throw new Error('Failed to load');

      const newStations = await response.json();
      this.mergeStations(newStations);
      
      // Validate current tab
      const validTabs = [...Object.keys(state.stationLists), 'best', 'search', ...state.customTabs];
      if (!validTabs.includes(state.currentTab)) {
        state.currentTab = 'techno';
      }

      this.switchTab(state.currentTab);
      ui.showToast('Станції оновлено', 'success');
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Load error:', error);
        // Use cached data
        this.switchTab(state.currentTab);
        ui.showToast('Використано кешовані дані', 'warning');
      }
    } finally {
      ui.showLoading(false);
    }
  }

  mergeStations(newStations) {
    const merged = {};

    // Process predefined tabs
    Object.keys(newStations).forEach(tab => {
      const unique = new Map();
      
      // Add user stations first (priority)
      (state.userAddedStations[tab] || []).forEach(s => {
        if (!state.deletedStations.includes(s.name)) {
          unique.set(s.name, s);
        }
      });
      
      // Add fetched stations
      newStations[tab].forEach(s => {
        if (!state.deletedStations.includes(s.name)) {
          unique.set(s.name, s);
        }
      });
      
      merged[tab] = Array.from(unique.values());
    });

    // Process custom tabs
    state.customTabs.forEach(tab => {
      const unique = new Map();
      
      (state.userAddedStations[tab] || []).forEach(s => {
        if (!state.deletedStations.includes(s.name)) {
          unique.set(s.name, s);
        }
      });
      
      (state.stationLists[tab] || []).forEach(s => {
        if (!state.deletedStations.includes(s.name)) {
          unique.set(s.name, s);
        }
      });
      
      merged[tab] = Array.from(unique.values());
    });

    state.stationLists = merged;
    state.persist();

    // Clean up favorites
    state.favoriteStations = state.favoriteStations.filter(name => 
      Object.values(state.stationLists).flat().some(s => s.name === name)
    );
  }

  // ==================== TAB MANAGEMENT ====================

  setupTabs() {
    this.renderTabs();
    
    // Add tab button
    document.querySelector('.add-tab-btn').addEventListener('click', () => {
      ui.showModal(ui.elements.newTabModal);
      document.getElementById('newTabName').focus();
    });
  }

  renderTabs() {
    const fixedTabs = ['best', 'techno', 'trance', 'ukraine', 'pop', 'search'];
    const container = ui.elements.tabsContainer;
    
    // Clear except add button
    container.innerHTML = '';
    
    // Fixed tabs
    fixedTabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.className = `tab-btn ${state.currentTab === tab ? 'active' : ''}`;
      btn.dataset.tab = tab;
      btn.textContent = this.getTabLabel(tab);
      btn.addEventListener('click', () => this.switchTab(tab));
      container.appendChild(btn);
    });

    // Custom tabs
    state.customTabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.className = `tab-btn ${state.currentTab === tab ? 'active' : ''}`;
      btn.dataset.tab = tab;
      btn.textContent = tab.toUpperCase();
      btn.addEventListener('click', () => this.switchTab(tab));
      
      // Long press for edit
      let pressTimer;
      btn.addEventListener('pointerdown', () => {
        pressTimer = setTimeout(() => this.showEditTabModal(tab), 500);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt => {
        btn.addEventListener(evt, () => clearTimeout(pressTimer));
      });
      
      container.appendChild(btn);
    });

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'add-tab-btn';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => ui.showModal(ui.elements.newTabModal));
    container.appendChild(addBtn);
  }

  getTabLabel(tab) {
    const labels = {
      best: 'Best',
      techno: 'Techno',
      trance: 'Trance',
      ukraine: 'UA',
      pop: 'Pop',
      search: 'Search'
    };
    return labels[tab] || tab;
  }

  switchTab(tab) {
    const validTabs = [...Object.keys(state.stationLists), 'best', 'search', ...state.customTabs];
    if (!validTabs.includes(tab)) tab = 'techno';

    state.currentTab = tab;
    state.currentIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
    
    // Update UI
    ui.elements.searchInput.classList.toggle('visible', tab === 'search');
    if (tab === 'search') this.populateSearchSuggestions();

    this.renderStationList();
    this.renderTabs();
    state.persist();

    // Resume playback if intended
    if (state.intendedPlaying && tab !== 'search') {
      const item = state.stationItems[state.currentIndex];
      if (item) {
        audioManager.play(item.dataset.value);
      }
    }
  }

  // ==================== STATION LIST RENDERING ====================

  renderStationList() {
    const list = ui.elements.stationList;
    let stations = [];

    if (state.currentTab === 'best') {
      stations = state.favoriteStations
        .map(name => Object.values(state.stationLists).flat().find(s => s.name === name))
        .filter(s => s);
    } else if (state.currentTab === 'search') {
      // Search results handled separately
      list.innerHTML = '<div class="station-item empty">Введіть пошуковий запит</div>';
      state.stationItems = [];
      return;
    } else {
      stations = state.stationLists[state.currentTab] || [];
    }

    if (!stations.length) {
      list.innerHTML = `<div class="station-item empty">${
        state.currentTab === 'best' ? 'Немає обраних станцій' : 'Немає станцій у цій категорії'
      }</div>`;
      state.stationItems = [];
      return;
    }

    // Virtual scrolling optimization
    this.renderVirtualList(list, stations);
  }

  renderVirtualList(container, stations) {
    // Simple rendering with recycling for now
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    stations.forEach((station, index) => {
      const item = this.createStationItem(station, index);
      fragment.appendChild(item);
    });

    container.appendChild(fragment);
    state.stationItems = Array.from(container.querySelectorAll('.station-item:not(.empty)'));

    // Restore selection
    if (state.stationItems[state.currentIndex]) {
      state.stationItems[state.currentIndex].classList.add('selected');
      this.scrollToCurrent();
    }
  }

  createStationItem(station, index) {
    const item = document.createElement('div');
    item.className = `station-item ${index === state.currentIndex ? 'selected' : ''}`;
    item.dataset.value = station.value;
    item.dataset.name = station.name;
    item.dataset.genre = this.shortenGenre(station.genre);
    item.dataset.country = station.country;
    item.dataset.favicon = station.favicon || '';
    item.dataset.index = index;
    item.draggable = false; // Custom drag implementation

    const isFavorited = state.favoriteStations.includes(station.name);
    const canDelete = ['techno', 'trance', 'ukraine', 'pop', ...state.customTabs].includes(state.currentTab);

    const iconHtml = station.favicon && ui.isValidUrl(station.favicon)
      ? `<img src="${station.favicon}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">`
      : '';

    item.innerHTML = `
      ${iconHtml}
      <div class="station-icon-fallback" style="display: ${station.favicon ? 'none' : 'flex'}; width: 40px; height: 40px; align-items: center; justify-content: center; font-size: 24px;">📻</div>
      <span class="station-name">${station.name}</span>
      <div class="buttons-container">
        ${canDelete ? `<button class="delete-btn" title="Видалити">🗑</button>` : ''}
        <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" title="${isFavorited ? 'Прибрати з обраного' : 'Додати до обраного'}">★</button>
        ${canDelete ? `<button class="drag-handle" title="Перетягнути">⋮⋮</button>` : ''}
      </div>
    `;

    // Event listeners
    item.addEventListener('click', (e) => {
      if (state.isDragging) return;
      if (e.target.closest('.buttons-container')) return;
      this.selectStation(index);
    });

    // Favorite button
    const favBtn = item.querySelector('.favorite-btn');
    if (favBtn) {
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFavorite(station.name);
      });
    }

    // Delete button
    const delBtn = item.querySelector('.delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Видалити "${station.name}"?`)) {
          this.deleteStation(station.name);
        }
      });
    }

    // Drag handle
    const dragHandle = item.querySelector('.drag-handle');
    if (dragHandle) {
      this.setupItemDrag(item, dragHandle, index);
    }

    return item;
  }

  shortenGenre(genre) {
    if (!genre) return '-';
    const genres = genre.split(',').map(g => g.trim()).filter(g => g);
    return genres.length > 3 ? genres.slice(0, 3).join(', ') + '...' : genres.join(', ');
  }

  // ==================== DRAG AND DROP ====================

  setupDragAndDrop() {
    // Global touch handling for drag
    document.addEventListener('touchmove', (e) => {
      if (state.isDragging && state.draggedItem) {
        e.preventDefault();
        this.handleDragMove(e.touches[0]);
      }
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
      if (state.isDragging) {
        this.handleDragEnd();
      }
    });
  }

  setupItemDrag(item, handle, index) {
    let touchStartY = 0;
    let touchStartTime = 0;

    handle.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
      
      state.longPressTimer = setTimeout(() => {
        this.startDrag(item, index);
      }, CONFIG.LONG_PRESS_DURATION);
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
      const diff = Math.abs(e.touches[0].clientY - touchStartY);
      if (diff > 10) {
        clearTimeout(state.longPressTimer);
      }
    }, { passive: true });

    handle.addEventListener('touchend', () => {
      clearTimeout(state.longPressTimer);
    });

    // Mouse support
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.startDrag(item, index);
    });
  }

  startDrag(item, index) {
    if (state.currentTab === 'search' || state.currentTab === 'best') return;

    state.isDragging = true;
    state.draggedItem = item;
    state.draggedIndex = index;

    item.classList.add('dragging');
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    ui.showToast('Перетягніть для зміни порядку', 'info', 1500);
  }

  handleDragMove(touch) {
    if (!state.draggedItem) return;

    const list = ui.elements.stationList;
    const items = Array.from(list.querySelectorAll('.station-item:not(.empty)'));
    const touchY = touch.clientY + list.scrollTop;

    // Find target
    let targetIndex = -1;
    for (let i = 0; i < items.length; i++) {
      const rect = items[i].getBoundingClientRect();
      const itemTop = rect.top + list.scrollTop;
      const itemMiddle = itemTop + rect.height / 2;

      if (touchY < itemMiddle && i !== state.draggedIndex) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex === -1 && items.length > 0) {
      targetIndex = items.length - 1;
    }

    // Visual feedback
    items.forEach((item, i) => {
      item.classList.remove('drag-over', 'drag-over-bottom');
      if (i === targetIndex && i !== state.draggedIndex) {
        if (i < state.draggedIndex) {
          item.classList.add('drag-over');
        } else {
          item.classList.add('drag-over-bottom');
        }
      }
    });

    state.targetIndex = targetIndex;
  }

  handleDragEnd() {
    if (!state.draggedItem) return;

    const fromIndex = state.draggedIndex;
    const toIndex = state.targetIndex !== undefined ? state.targetIndex : fromIndex;

    if (fromIndex !== toIndex && toIndex >= 0) {
      this.reorderStations(fromIndex, toIndex);
    }

    // Cleanup
    state.draggedItem.classList.remove('dragging');
    document.querySelectorAll('.station-item').forEach(item => {
      item.classList.remove('drag-over', 'drag-over-bottom');
    });

    state.isDragging = false;
    state.draggedItem = null;
    state.draggedIndex = null;
    state.targetIndex = undefined;
  }

  reorderStations(fromIndex, toIndex) {
    const tab = state.currentTab;
    const stations = state.stationLists[tab] || [];
    
    if (!stations.length) return;

    // Reorder array
    const [moved] = stations.splice(fromIndex, 1);
    stations.splice(toIndex, 0, moved);

    // Update userAddedStations to persist order
    state.userAddedStations[tab] = [...stations];
    
    state.stationLists[tab] = stations;
    state.currentIndex = toIndex;
    state.persist();

    // Re-render
    this.renderStationList();
    
    ui.showToast('Порядок змінено', 'success');
    
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([30, 50, 30]);
    }
  }

  // ==================== STATION ACTIONS ====================

  selectStation(index) {
    state.currentIndex = index;
    const item = state.stationItems[index];
    if (!item) return;

    // Update selection UI
    state.stationItems.forEach(i => i.classList.remove('selected'));
    item.classList.add('selected');

    // Update current station info
    ui.updateCurrentStation(item);

    // Start playback
    state.intendedPlaying = true;
    state.persist();
    audioManager.play(item.dataset.value);

    this.scrollToCurrent();
  }

  scrollToCurrent() {
    const item = state.stationItems[state.currentIndex];
    if (item) {
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  toggleFavorite(stationName) {
    const index = state.favoriteStations.indexOf(stationName);
    if (index > -1) {
      state.favoriteStations.splice(index, 1);
      ui.showToast('Прибрано з обраного', 'info');
    } else {
      state.favoriteStations.unshift(stationName);
      ui.showToast('Додано до обраного', 'success');
      
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
    
    state.persist();
    this.renderStationList();
  }

  deleteStation(stationName) {
    const tab = state.currentTab;
    const stations = state.stationLists[tab];
    if (!stations) return;

    const station = stations.find(s => s.name === stationName);
    if (!station) return;

    // Remove from lists
    state.stationLists[tab] = stations.filter(s => s.name !== stationName);
    state.userAddedStations[tab] = (state.userAddedStations[tab] || []).filter(s => s.name !== stationName);

    // Add to deleted if not from search
    if (!station.isFromSearch && !state.deletedStations.includes(stationName)) {
      state.deletedStations.push(stationName);
    }

    // Remove from favorites
    state.favoriteStations = state.favoriteStations.filter(n => n !== stationName);

    // Adjust index
    if (state.currentIndex >= state.stationLists[tab].length) {
      state.currentIndex = Math.max(0, state.stationLists[tab].length - 1);
    }

    state.persist();
    this.renderStationList();
    ui.showToast('Станцію видалено', 'info');
  }

  prev() {
    if (!state.stationItems.length) return;
    let newIndex = state.currentIndex - 1;
    if (newIndex < 0) newIndex = state.stationItems.length - 1;
    this.selectStation(newIndex);
  }

  next() {
    if (!state.stationItems.length) return;
    let newIndex = state.currentIndex + 1;
    if (newIndex >= state.stationItems.length) newIndex = 0;
    this.selectStation(newIndex);
  }

  // ==================== SEARCH ====================

  populateSearchSuggestions() {
    const countries = [
      'Germany', 'France', 'United Kingdom', 'Italy', 'Spain', 'Netherlands',
      'Switzerland', 'Belgium', 'Sweden', 'Norway', 'Ukraine', 'USA',
      'Canada', 'Australia', 'Japan', 'Poland'
    ];
    
    const genres = [
      'Pop', 'Rock', 'Dance', 'Electronic', 'Techno', 'Trance', 
      'House', 'EDM', 'Hip-Hop', 'Jazz', 'Classical'
    ];

    const countryDatalist = document.getElementById('suggestedCountries');
    const genreDatalist = document.getElementById('suggestedGenres');
    const pastDatalist = document.getElementById('pastSearches');

    countryDatalist.innerHTML = countries.map(c => `<option value="${c}">`).join('');
    genreDatalist.innerHTML = genres.map(g => `<option value="${g}">`).join('');
    pastDatalist.innerHTML = state.pastSearches.map(s => `<option value="${s}">`).join('');
  }

  async search() {
    const query = ui.elements.searchQuery.value.trim();
    const country = this.normalizeCountry(ui.elements.searchCountry.value.trim());
    const genre = ui.elements.searchGenre.value.trim();

    if (!query && !country && !genre) {
      ui.showToast('Введіть параметри пошуку', 'warning');
      return;
    }

    // Save search
    if (query && !state.pastSearches.includes(query)) {
      state.pastSearches.unshift(query);
      if (state.pastSearches.length > 5) state.pastSearches.pop();
      state.persist();
      this.populateSearchSuggestions();
    }

    ui.showLoading(true);
    ui.elements.stationList.innerHTML = '<div class="station-item empty">Пошук...</div>';

    try {
      const params = new URLSearchParams();
      if (query) params.append('name', query);
      if (country) params.append('country', country);
      if (genre) params.append('tag', genre);
      params.append('order', 'clickcount');
      params.append('reverse', 'true');
      params.append('limit', '100');

      const url = `https://de1.api.radio-browser.info/json/stations/search?${params}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Search failed');

      let stations = await response.json();
      stations = stations.filter(s => s.url_resolved && s.url_resolved.startsWith('https://'));

      this.renderSearchResults(stations);

    } catch (error) {
      console.error('Search error:', error);
      ui.elements.stationList.innerHTML = '<div class="station-item empty">Помилка пошуку</div>';
      ui.showToast('Помилка пошуку', 'error');
    } finally {
      ui.showLoading(false);
    }
  }

  renderSearchResults(stations) {
    const list = ui.elements.stationList;
    
    if (!stations.length) {
      list.innerHTML = '<div class="station-item empty">Нічого не знайдено</div>';
      state.stationItems = [];
      return;
    }

    list.innerHTML = '';
    const fragment = document.createDocumentFragment();

    stations.forEach((station, index) => {
      const item = document.createElement('div');
      item.className = 'station-item';
      item.dataset.value = station.url_resolved;
      item.dataset.name = station.name;
      item.dataset.genre = this.shortenGenre(station.tags);
      item.dataset.country = station.country || '-';
      item.dataset.favicon = station.favicon || '';

      const iconHtml = station.favicon && ui.isValidUrl(station.favicon)
        ? `<img src="${station.favicon}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : '';

      item.innerHTML = `
        ${iconHtml}
        <div class="station-icon-fallback" style="display: ${station.favicon ? 'none' : 'flex'}; width: 40px; height: 40px; align-items: center; justify-content: center; font-size: 24px;">📻</div>
        <span class="station-name">${station.name}</span>
        <button class="add-btn" title="Додати до вкладки">+</button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.add-btn')) {
          this.showAddToTabModal(item);
        } else {
          this.playSearchResult(item, index);
        }
      });

      fragment.appendChild(item);
    });

    list.appendChild(fragment);
    state.stationItems = Array.from(list.querySelectorAll('.station-item'));
  }

  playSearchResult(item, index) {
    state.currentIndex = index;
    ui.updateCurrentStation(item);
    state.intendedPlaying = true;
    state.persist();
    audioManager.play(item.dataset.value);
  }

  showAddToTabModal(item) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay visible';
    
    const tabs = ['techno', 'trance', 'ukraine', 'pop', ...state.customTabs];
    
    overlay.innerHTML = `
      <div class="modal">
        <h2>Додати до вкладки</h2>
        <div class="modal-tabs">
          ${tabs.map(tab => `
            <button class="modal-tab-btn" data-tab="${tab}">${ui.getTabLabel(tab)}</button>
          `).join('')}
          <button class="modal-cancel-btn">Скасувати</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelectorAll('.modal-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.addStationToTab(item, btn.dataset.tab);
        overlay.remove();
      });
    });

    overlay.querySelector('.modal-cancel-btn').addEventListener('click', () => {
      overlay.remove();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  addStationToTab(item, tab) {
    const station = {
      value: item.dataset.value,
      name: item.dataset.name,
      genre: item.dataset.genre,
      country: item.dataset.country,
      favicon: item.dataset.favicon,
      isFromSearch: true
    };

    if (!state.stationLists[tab]) state.stationLists[tab] = [];
    if (!state.userAddedStations[tab]) state.userAddedStations[tab] = [];

    if (state.stationLists[tab].some(s => s.name === station.name)) {
      ui.showToast('Станція вже існує', 'warning');
      return;
    }

    state.stationLists[tab].unshift(station);
    state.userAddedStations[tab].unshift(station);
    state.persist();

    ui.showToast(`Додано до ${ui.getTabLabel(tab)}`, 'success');
  }

  normalizeCountry(country) {
    if (!country) return '';
    const map = {
      'ukraine': 'Ukraine', 'germany': 'Germany', 'german': 'Germany',
      'usa': 'United States', 'uk': 'United Kingdom', 'france': 'France',
      'italy': 'Italy', 'spain': 'Spain', 'poland': 'Poland'
    };
    return map[country.toLowerCase()] || country;
  }

  // ==================== MODALS ====================

  setupModals() {
    // New tab modal
    document.getElementById('createTabBtn').addEventListener('click', () => {
      const name = document.getElementById('newTabName').value.trim().toLowerCase();
      
      if (!name) {
        ui.showToast('Введіть назву', 'warning');
        return;
      }
      
      if (!/^[a-z0-9_-]{1,10}$/.test(name)) {
        ui.showToast('Назва: 1-10 символів, латиниця, цифри, -_', 'warning');
        return;
      }
      
      const reserved = ['best', 'techno', 'trance', 'ukraine', 'pop', 'search'];
      if (reserved.includes(name) || state.customTabs.includes(name)) {
        ui.showToast('Така вкладка вже існує', 'warning');
        return;
      }
      
      if (state.customTabs.length >= 7) {
        ui.showToast('Максимум 7 вкладок', 'warning');
        return;
      }

      state.customTabs.push(name);
      state.stationLists[name] = [];
      state.userAddedStations[name] = [];
      state.persist();
      
      this.renderTabs();
      ui.hideModal(ui.elements.newTabModal);
      document.getElementById('newTabName').value = '';
      ui.showToast('Вкладку створено', 'success');
    });

    // Edit tab modal
    document.getElementById('renameTabBtn').addEventListener('click', () => {
      const oldName = this.editingTab;
      const newName = document.getElementById('renameTabName').value.trim().toLowerCase();
      
      if (!newName || !/^[a-z0-9_-]{1,10}$/.test(newName)) {
        ui.showToast('Некоректна назва', 'warning');
        return;
      }
      
      const reserved = ['best', 'techno', 'trance', 'ukraine', 'pop', 'search'];
      if (reserved.includes(newName) || state.customTabs.includes(newName)) {
        ui.showToast('Назва зайнята', 'warning');
        return;
      }

      const index = state.customTabs.indexOf(oldName);
      state.customTabs[index] = newName;
      
      state.stationLists[newName] = state.stationLists[oldName];
      state.userAddedStations[newName] = state.userAddedStations[oldName];
      delete state.stationLists[oldName];
      delete state.userAddedStations[oldName];
      
      if (state.currentTab === oldName) {
        state.currentTab = newName;
      }
      
      state.persist();
      this.renderTabs();
      ui.hideModal(ui.elements.editTabModal);
      ui.showToast('Вкладку перейменовано', 'success');
    });

    document.getElementById('deleteTabBtn').addEventListener('click', () => {
      const tab = this.editingTab;
      if (!confirm(`Видалити вкладку "${tab.toUpperCase()}"?`)) return;

      state.customTabs = state.customTabs.filter(t => t !== tab);
      delete state.stationLists[tab];
      delete state.userAddedStations[tab];
      
      if (state.currentTab === tab) {
        state.currentTab = 'techno';
      }
      
      state.persist();
      this.switchTab(state.currentTab);
      this.renderTabs();
      ui.hideModal(ui.elements.editTabModal);
      ui.showToast('Вкладку видалено', 'success');
    });

    // Cancel buttons
    document.querySelectorAll('.modal-cancel-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) ui.hideModal(modal);
      });
    });

    // Close on overlay click
    [ui.elements.newTabModal, ui.elements.editTabModal, ui.elements.sleepModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) ui.hideModal(modal);
      });
    });
  }

  showEditTabModal(tab) {
    this.editingTab = tab;
    document.getElementById('renameTabName').value = tab;
    ui.showModal(ui.elements.editTabModal);
  }

  // ==================== SLEEP TIMER ====================

  setupSleepTimer() {
    // Timer options
    document.querySelectorAll('.timer-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const minutes = btn.dataset.minutes;
        
        if (minutes === 'custom') {
          document.querySelector('.custom-timer').style.display = 'flex';
          document.querySelector('.timer-options').style.display = 'none';
        } else {
          this.setSleepTimer(parseInt(minutes));
        }
      });
    });

    // Custom timer
    document.querySelector('.set-custom-timer').addEventListener('click', () => {
      const input = document.getElementById('customMinutes');
      const minutes = parseInt(input.value);
      
      if (minutes && minutes > 0 && minutes <= 180) {
        this.setSleepTimer(minutes);
        input.value = '';
        document.querySelector('.custom-timer').style.display = 'none';
        document.querySelector('.timer-options').style.display = 'grid';
      } else {
        ui.showToast('Введіть 1-180 хвилин', 'warning');
      }
    });

    // Cancel timer
    document.querySelector('.cancel-timer').addEventListener('click', () => {
      this.cancelSleepTimer();
    });
  }

  setSleepTimer(minutes) {
    this.cancelSleepTimer();

    const ms = minutes * 60000;
    state.sleepTimerEndTime = Date.now() + ms;
    
    state.sleepTimerId = setTimeout(() => {
      audioManager.pause();
      ui.showToast('Таймер сну: відтворення зупинено', 'info');
      this.cancelSleepTimer();
    }, ms);

    ui.updateSleepTimerDisplay();
    ui.showToast(`Таймер встановлено: ${minutes} хв`, 'success');
    ui.hideModal(ui.elements.sleepModal);
  }

  cancelSleepTimer() {
    if (state.sleepTimerId) {
      clearTimeout(state.sleepTimerId);
      state.sleepTimerId = null;
      state.sleepTimerEndTime = null;
      ui.updateSleepTimerDisplay();
      ui.showToast('Таймер скасовано', 'info');
    }
  }
}

const stationManager = new StationManager();

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Load initial data
  stationManager.loadStations();

  // Resume if needed
  if (state.intendedPlaying) {
    setTimeout(() => {
      const item = state.stationItems[state.currentIndex];
      if (item && navigator.onLine) {
        audioManager.play(item.dataset.value);
      }
    }, 500);
  }

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            if (confirm('Доступна нова версія. Оновити?')) {
              window.location.reload();
            }
          }
        });
      });
    });
  }
});