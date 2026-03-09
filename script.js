/**
 * Radio Music - Fixed Version
 * All critical bugs resolved
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  ERROR_LIMIT: 3,
  RETRY_DELAY: 1000,
  MAX_RETRIES: 2,
  LONG_PRESS_DURATION: 600,
  PULL_THRESHOLD: 80,
  DEBOUNCE_DELAY: 100
};

// ============================================
// STATE
// ============================================

const state = {
  currentTab: localStorage.getItem('currentTab') || 'techno',
  currentIndex: 0,
  favoriteStations: JSON.parse(localStorage.getItem('favoriteStations') || '[]'),
  isPlaying: false,
  intendedPlaying: localStorage.getItem('intendedPlaying') === 'true',
  stationLists: JSON.parse(localStorage.getItem('stationLists') || '{}'),
  userAddedStations: JSON.parse(localStorage.getItem('userAddedStations') || '{}'),
  customTabs: JSON.parse(localStorage.getItem('customTabs') || '[]').filter(t => typeof t === 'string' && t.trim()),
  pastSearches: JSON.parse(localStorage.getItem('pastSearches') || '[]'),
  deletedStations: JSON.parse(localStorage.getItem('deletedStations') || '[]'),
  volume: parseFloat(localStorage.getItem('volume')) || 0.9,
  selectedTheme: localStorage.getItem('selectedTheme') || 'shadow-pulse',
  
  // Runtime
  isDragging: false,
  draggedItem: null,
  draggedIndex: null,
  sleepTimerId: null,
  sleepTimerEndTime: null,
  stationItems: [],
  editingTab: null,
  touchStartY: 0,
  touchStartX: 0,
  longPressTimer: null,
  isPulling: false,
  pullStartY: 0
};

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {
  audio: null,
  stationList: null,
  currentStationInfo: null,
  playBtn: null,
  prevBtn: null,
  nextBtn: null,
  themeToggle: null,
  shareBtn: null,
  exportBtn: null,
  importBtn: null,
  importFile: null,
  sleepTimerBtn: null,
  searchInput: null,
  searchQuery: null,
  searchCountry: null,
  searchGenre: null,
  searchBtn: null,
  tabsContainer: null,
  loadingIndicator: null,
  pullIndicator: null,
  toastContainer: null,
  sleepModal: null,
  newTabModal: null,
  editTabModal: null
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function saveState() {
  localStorage.setItem('currentTab', state.currentTab);
  localStorage.setItem('favoriteStations', JSON.stringify(state.favoriteStations));
  localStorage.setItem('intendedPlaying', state.intendedPlaying);
  localStorage.setItem('stationLists', JSON.stringify(state.stationLists));
  localStorage.setItem('userAddedStations', JSON.stringify(state.userAddedStations));
  localStorage.setItem('customTabs', JSON.stringify(state.customTabs));
  localStorage.setItem('pastSearches', JSON.stringify(state.pastSearches));
  localStorage.setItem('deletedStations', JSON.stringify(state.deletedStations));
  localStorage.setItem('volume', state.volume);
  localStorage.setItem('selectedTheme', state.selectedTheme);
  localStorage.setItem(`lastStation_${state.currentTab}`, state.currentIndex);
}

function showToast(message, type = 'info', duration = 3000) {
  const container = elements.toastContainer;
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  
  container.appendChild(toast);
  
  setTimeout(() => toast.remove(), duration);
}

function isValidUrl(url) {
  if (!url) return false;
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
}

function normalizeCountry(country) {
  if (!country) return '';
  const map = {
    'ukraine': 'Ukraine', 'germany': 'Germany', 'german': 'Germany',
    'usa': 'United States', 'uk': 'United Kingdom', 'france': 'France',
    'italy': 'Italy', 'spain': 'Spain', 'poland': 'Poland', 'україна': 'Ukraine'
  };
  return map[country.toLowerCase()] || country;
}

function shortenGenre(genre) {
  if (!genre) return '-';
  const genres = genre.split(/[,/]/).map(g => g.trim()).filter(g => g);
  return genres.length > 2 ? genres.slice(0, 2).join(', ') + '...' : genres.join(', ');
}

// ============================================
// AUDIO MANAGEMENT
// ============================================

let audioRetryCount = 0;
let currentAudioUrl = null;

function initAudio() {
  elements.audio = document.getElementById('audioPlayer');
  elements.audio.preload = 'none';
  elements.audio.volume = state.volume;
  elements.audio.crossOrigin = 'anonymous';
  
  elements.audio.addEventListener('playing', onAudioPlaying);
  elements.audio.addEventListener('pause', onAudioPause);
  elements.audio.addEventListener('error', onAudioError);
  elements.audio.addEventListener('waiting', () => showLoading(true));
  elements.audio.addEventListener('canplay', () => showLoading(false));
  elements.audio.addEventListener('volumechange', () => {
    state.volume = elements.audio.volume;
    saveState();
  });
}

function onAudioPlaying() {
  state.isPlaying = true;
  updatePlayButton(true);
  updateWaveVisualizer(true);
  updateCurrentStationPlaying(true);
  
  const item = state.stationItems[state.currentIndex];
  if (item) updateMediaSession(item);
  
  if (navigator.vibrate) navigator.vibrate(30);
}

function onAudioPause() {
  state.isPlaying = false;
  updatePlayButton(false);
  updateWaveVisualizer(false);
  updateCurrentStationPlaying(false);
}

function onAudioError(e) {
  console.error('Audio error:', e);
  showLoading(false);
  updateWaveVisualizer(false);
  
  if (state.intendedPlaying && audioRetryCount < CONFIG.MAX_RETRIES) {
    audioRetryCount++;
    showToast(`Повторна спроба ${audioRetryCount}/${CONFIG.MAX_RETRIES}...`, 'warning');
    setTimeout(() => {
      if (currentAudioUrl) playAudio(currentAudioUrl);
    }, CONFIG.RETRY_DELAY * audioRetryCount);
  } else {
    showToast('Помилка відтворення', 'error');
    audioRetryCount = 0;
  }
}

async function playAudio(url) {
  if (!url || !isValidUrl(url)) {
    showToast('Некоректне посилання', 'error');
    return;
  }
  
  showLoading(true);
  currentAudioUrl = url;
  
  try {
    // Stop current
    elements.audio.pause();
    elements.audio.src = '';
    elements.audio.load();
    
    await new Promise(r => setTimeout(r, 100));
    
    // Set new source
    const cacheBuster = url.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`;
    elements.audio.src = url + cacheBuster;
    
    await elements.audio.play();
    audioRetryCount = 0;
    state.intendedPlaying = true;
    saveState();
    
  } catch (err) {
    console.error('Play error:', err);
    onAudioError(err);
  } finally {
    showLoading(false);
  }
}

function togglePlay() {
  if (state.isPlaying) {
    elements.audio.pause();
    state.intendedPlaying = false;
    saveState();
  } else {
    const item = state.stationItems[state.currentIndex];
    if (item) {
      playAudio(item.dataset.value);
    } else {
      showToast('Спочатку оберіть станцію', 'info');
    }
  }
}

// ============================================
// UI UPDATES
// ============================================

function updatePlayButton(isPlaying) {
  if (elements.playBtn) {
    elements.playBtn.textContent = isPlaying ? '⏸' : '▶';
    elements.playBtn.classList.toggle('playing', isPlaying);
  }
  if (elements.currentStationInfo) {
    elements.currentStationInfo.classList.toggle('playing', isPlaying);
  }
}

function updateWaveVisualizer(isPlaying) {
  document.querySelectorAll('.wave-line').forEach(el => {
    el.classList.toggle('playing', isPlaying);
  });
}

function updateCurrentStationPlaying(isPlaying) {
  if (elements.currentStationInfo) {
    elements.currentStationInfo.classList.toggle('playing', isPlaying);
  }
}

function showLoading(show) {
  if (elements.loadingIndicator) {
    elements.loadingIndicator.classList.toggle('hidden', !show);
  }
}

function updateCurrentStation(item) {
  if (!item || !elements.currentStationInfo) return;
  
  const name = item.dataset.name || 'Невідома станція';
  const genre = item.dataset.genre || '-';
  const country = item.dataset.country || '-';
  const favicon = item.dataset.favicon;
  
  const nameEl = elements.currentStationInfo.querySelector('.station-name');
  const genreEl = elements.currentStationInfo.querySelector('.station-genre');
  const countryEl = elements.currentStationInfo.querySelector('.station-country');
  const iconEl = elements.currentStationInfo.querySelector('.station-icon');
  
  if (nameEl) nameEl.textContent = name;
  if (genreEl) genreEl.textContent = `жанр: ${genre}`;
  if (countryEl) countryEl.textContent = `країна: ${country}`;
  
  if (iconEl) {
    if (favicon && isValidUrl(favicon)) {
      iconEl.style.backgroundImage = `url(${favicon})`;
      iconEl.innerHTML = '';
      iconEl.style.backgroundSize = 'contain';
      iconEl.style.backgroundRepeat = 'no-repeat';
      iconEl.style.backgroundPosition = 'center';
    } else {
      iconEl.style.backgroundImage = 'none';
      iconEl.innerHTML = '🎵';
    }
  }
}

function updateMediaSession(item) {
  if (!item || !('mediaSession' in navigator)) return;
  
  const name = item.dataset.name || 'Невідома станція';
  const genre = item.dataset.genre || '';
  const country = item.dataset.country || '';
  const favicon = item.dataset.favicon;
  
  navigator.mediaSession.metadata = new MediaMetadata({
    title: name,
    artist: `${genre} | ${country}`,
    album: 'Radio Music',
    artwork: favicon && isValidUrl(favicon) ? [
      { src: favicon, sizes: '96x96', type: 'image/png' },
      { src: favicon, sizes: '128x128', type: 'image/png' },
      { src: favicon, sizes: '192x192', type: 'image/png' }
    ] : []
  });
}

// ============================================
// THEME
// ============================================

const themes = {
  'shadow-pulse': { accent: '#00E676' },
  'dark-abyss': { accent: '#AA00FF' },
  'emerald-glow': { accent: '#2EC4B6' },
  'retro-wave': { accent: '#FF69B4' },
  'neon-pulse': { accent: '#00F0FF' },
  'lime-surge': { accent: '#B2FF59' },
  'flamingo-flash': { accent: '#FF4081' },
  'aqua-glow': { accent: '#26C6DA' },
  'aurora-haze': { accent: '#64FFDA' },
  'starlit-amethyst': { accent: '#B388FF' },
  'lunar-frost': { accent: '#40C4FF' }
};

function applyTheme(themeName) {
  const theme = themes[themeName] || themes['shadow-pulse'];
  document.documentElement.setAttribute('data-theme', themeName);
  
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.accent);
  
  state.selectedTheme = themeName;
  saveState();
}

function toggleTheme() {
  const names = Object.keys(themes);
  const current = names.indexOf(state.selectedTheme);
  const next = names[(current + 1) % names.length];
  applyTheme(next);
  showToast(`Тема: ${next}`, 'success');
}

// ============================================
// STATION LIST & RENDERING
// ============================================

function renderStationList() {
  const list = elements.stationList;
  if (!list) return;
  
  let stations = [];
  
  if (state.currentTab === 'best') {
    stations = state.favoriteStations
      .map(name => Object.values(state.stationLists).flat().find(s => s && s.name === name))
      .filter(s => s);
  } else if (state.currentTab === 'search') {
    list.innerHTML = '<div class="station-item empty">Введіть пошуковий запит</div>';
    state.stationItems = [];
    return;
  } else {
    stations = state.stationLists[state.currentTab] || [];
  }
  
  if (!stations.length) {
    const msg = state.currentTab === 'best' ? 'Немає обраних станцій' : 'Немає станцій';
    list.innerHTML = `<div class="station-item empty">${msg}</div>`;
    state.stationItems = [];
    return;
  }
  
  list.innerHTML = '';
  const fragment = document.createDocumentFragment();
  
  stations.forEach((station, index) => {
    const item = createStationElement(station, index);
    fragment.appendChild(item);
  });
  
  list.appendChild(fragment);
  state.stationItems = Array.from(list.querySelectorAll('.station-item:not(.empty)'));
  
  // Restore selection
  const savedIndex = parseInt(localStorage.getItem(`lastStation_${state.currentTab}`)) || 0;
  state.currentIndex = Math.min(savedIndex, state.stationItems.length - 1);
  
  if (state.stationItems[state.currentIndex]) {
    state.stationItems[state.currentIndex].classList.add('selected');
    updateCurrentStation(state.stationItems[state.currentIndex]);
  }
}

function createStationElement(station, index) {
  const item = document.createElement('div');
  item.className = 'station-item';
  item.dataset.value = station.value || '';
  item.dataset.name = station.name || '';
  item.dataset.genre = shortenGenre(station.genre);
  item.dataset.country = station.country || '';
  item.dataset.favicon = station.favicon || '';
  item.dataset.index = index;
  
  const isFav = state.favoriteStations.includes(station.name);
  const canDelete = ['techno', 'trance', 'ukraine', 'pop', ...state.customTabs].includes(state.currentTab);
  const canDrag = canDelete && state.currentTab !== 'best';
  
  // Icon
  let iconHtml = '';
  if (station.favicon && isValidUrl(station.favicon)) {
    iconHtml = `<img src="${station.favicon}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">`;
  }
  
  item.innerHTML = `
    ${iconHtml}
    <div class="station-icon-fallback" style="display: ${station.favicon ? 'none' : 'flex'}; width: 40px; height: 40px; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">📻</div>
    <span class="station-name">${station.name}</span>
    <div class="buttons-container">
      ${canDelete ? `<button class="delete-btn" title="Видалити">🗑</button>` : ''}
      <button class="favorite-btn ${isFav ? 'favorited' : ''}" title="Обране">★</button>
      ${canDrag ? `<button class="drag-handle" title="Перетягнути (утримуйте)">⋮⋮</button>` : ''}
    </div>
  `;
  
  // Click to play
  item.addEventListener('click', (e) => {
    if (state.isDragging) return;
    if (e.target.closest('.buttons-container')) return;
    selectStation(index);
  });
  
  // Favorite
  const favBtn = item.querySelector('.favorite-btn');
  if (favBtn) {
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(station.name);
    });
  }
  
  // Delete
  const delBtn = item.querySelector('.delete-btn');
  if (delBtn) {
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Видалити "${station.name}"?`)) {
        deleteStation(station.name);
      }
    });
  }
  
  // Drag handle
  const dragHandle = item.querySelector('.drag-handle');
  if (dragHandle) {
    setupDragHandle(item, dragHandle, index);
  }
  
  return item;
}

function selectStation(index) {
  if (index < 0 || index >= state.stationItems.length) return;
  
  state.currentIndex = index;
  state.stationItems.forEach(el => el.classList.remove('selected'));
  state.stationItems[index].classList.add('selected');
  
  const item = state.stationItems[index];
  updateCurrentStation(item);
  
  state.intendedPlaying = true;
  saveState();
  
  playAudio(item.dataset.value);
  
  item.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function toggleFavorite(name) {
  const idx = state.favoriteStations.indexOf(name);
  if (idx > -1) {
    state.favoriteStations.splice(idx, 1);
    showToast('Прибрано з обраного', 'info');
  } else {
    state.favoriteStations.unshift(name);
    showToast('Додано до обраного', 'success');
    if (navigator.vibrate) navigator.vibrate(30);
  }
  saveState();
  renderStationList();
}

function deleteStation(name) {
  const tab = state.currentTab;
  const stations = state.stationLists[tab];
  if (!stations) return;
  
  const station = stations.find(s => s.name === name);
  if (!station) return;
  
  // Remove
  state.stationLists[tab] = stations.filter(s => s.name !== name);
  if (state.userAddedStations[tab]) {
    state.userAddedStations[tab] = state.userAddedStations[tab].filter(s => s.name !== name);
  }
  
  // Track deleted
  if (!station.isFromSearch && !state.deletedStations.includes(name)) {
    state.deletedStations.push(name);
  }
  
  // Remove from favorites
  state.favoriteStations = state.favoriteStations.filter(n => n !== name);
  
  // Adjust index
  if (state.currentIndex >= state.stationLists[tab].length) {
    state.currentIndex = Math.max(0, state.stationLists[tab].length - 1);
  }
  
  saveState();
  renderStationList();
  showToast('Видалено', 'info');
}

function prevStation() {
  if (!state.stationItems.length) return;
  let idx = state.currentIndex - 1;
  if (idx < 0) idx = state.stationItems.length - 1;
  selectStation(idx);
}

function nextStation() {
  if (!state.stationItems.length) return;
  let idx = state.currentIndex + 1;
  if (idx >= state.stationItems.length) idx = 0;
  selectStation(idx);
}

// ============================================
// DRAG AND DROP
// ============================================

function setupDragHandle(item, handle, index) {
  // Touch
  handle.addEventListener('touchstart', (e) => {
    e.preventDefault();
    state.longPressTimer = setTimeout(() => startDrag(item, index), CONFIG.LONG_PRESS_DURATION);
  }, { passive: false });
  
  handle.addEventListener('touchmove', () => {
    clearTimeout(state.longPressTimer);
  });
  
  handle.addEventListener('touchend', () => {
    clearTimeout(state.longPressTimer);
    endDrag();
  });
  
  handle.addEventListener('touchcancel', () => {
    clearTimeout(state.longPressTimer);
    endDrag();
  });
  
  // Mouse
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    state.longPressTimer = setTimeout(() => startDrag(item, index), CONFIG.LONG_PRESS_DURATION);
  });
  
  document.addEventListener('mouseup', () => {
    clearTimeout(state.longPressTimer);
    endDrag();
  });
}

function startDrag(item, index) {
  if (state.currentTab === 'search' || state.currentTab === 'best') return;
  if (state.isDragging) return;
  
  state.isDragging = true;
  state.draggedItem = item;
  state.draggedIndex = index;
  
  item.classList.add('dragging');
  if (navigator.vibrate) navigator.vibrate(50);
  
  // Setup move handlers
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('mousemove', onDragMove);
}

function onDragMove(e) {
  if (!state.isDragging || !state.draggedItem) return;
  if (e.type === 'touchmove') e.preventDefault();
  
  const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
  const list = elements.stationList;
  const rect = list.getBoundingClientRect();
  
  // Find target
  const items = Array.from(list.querySelectorAll('.station-item:not(.empty)'));
  const relativeY = clientY - rect.top + list.scrollTop;
  
  let targetIndex = -1;
  for (let i = 0; i < items.length; i++) {
    const itemRect = items[i].getBoundingClientRect();
    const itemMiddle = itemRect.top - rect.top + list.scrollTop + itemRect.height / 2;
    
    if (relativeY < itemMiddle && i !== state.draggedIndex) {
      targetIndex = i;
      break;
    }
  }
  
  if (targetIndex === -1) targetIndex = items.length - 1;
  
  // Visual feedback
  items.forEach((el, i) => {
    el.classList.remove('drag-over', 'drag-over-bottom');
    if (i === targetIndex && i !== state.draggedIndex) {
      el.classList.add(i < state.draggedIndex ? 'drag-over' : 'drag-over-bottom');
    }
  });
  
  state.targetIndex = targetIndex;
}

function endDrag() {
  if (!state.isDragging) return;
  
  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('mousemove', onDragMove);
  
  if (state.draggedItem && state.targetIndex !== undefined && state.targetIndex !== state.draggedIndex) {
    reorderStations(state.draggedIndex, state.targetIndex);
  }
  
  if (state.draggedItem) {
    state.draggedItem.classList.remove('dragging');
  }
  
  document.querySelectorAll('.station-item').forEach(el => {
    el.classList.remove('drag-over', 'drag-over-bottom');
  });
  
  state.isDragging = false;
  state.draggedItem = null;
  state.draggedIndex = null;
  state.targetIndex = undefined;
}

function reorderStations(from, to) {
  const tab = state.currentTab;
  const stations = state.stationLists[tab];
  if (!stations || from === to) return;
  
  const [moved] = stations.splice(from, 1);
  stations.splice(to, 0, moved);
  
  // Update user stations
  state.userAddedStations[tab] = [...stations];
  state.stationLists[tab] = stations;
  state.currentIndex = to;
  
  saveState();
  renderStationList();
  showToast('Порядок змінено', 'success');
  if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
}

// ============================================
// TABS
// ============================================

function renderTabs() {
  const container = elements.tabsContainer;
  if (!container) return;
  
  const fixed = ['best', 'techno', 'trance', 'ukraine', 'pop', 'search'];
  const labels = { best: 'Best', techno: 'Techno', trance: 'Trance', ukraine: 'UA', pop: 'Pop', search: '🔍' };
  
  container.innerHTML = '';
  
  // Fixed tabs
  fixed.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${state.currentTab === tab ? 'active' : ''}`;
    btn.dataset.tab = tab;
    btn.textContent = labels[tab] || tab;
    btn.addEventListener('click', () => switchTab(tab));
    container.appendChild(btn);
  });
  
  // Custom tabs
  state.customTabs.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = `tab-btn ${state.currentTab === tab ? 'active' : ''}`;
    btn.dataset.tab = tab;
    btn.textContent = tab.toUpperCase();
    btn.addEventListener('click', () => switchTab(tab));
    
    // Long press for edit
    let timer;
    btn.addEventListener('pointerdown', () => {
      timer = setTimeout(() => showEditTabModal(tab), 600);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt => {
      btn.addEventListener(evt, () => clearTimeout(timer));
    });
    
    container.appendChild(btn);
  });
  
  // Add button
  const addBtn = document.createElement('button');
  addBtn.className = 'add-tab-btn';
  addBtn.textContent = '+';
  addBtn.addEventListener('click', () => showModal(elements.newTabModal));
  container.appendChild(addBtn);
}

function switchTab(tab) {
  const valid = [...Object.keys(state.stationLists), 'best', 'search', ...state.customTabs];
  if (!valid.includes(tab)) tab = 'techno';
  
  state.currentTab = tab;
  state.currentIndex = parseInt(localStorage.getItem(`lastStation_${tab}`)) || 0;
  
  // Update search visibility
  if (elements.searchInput) {
    elements.searchInput.style.display = tab === 'search' ? 'flex' : 'none';
  }
  
  if (tab === 'search') populateSearchSuggestions();
  
  renderTabs();
  renderStationList();
  saveState();
  
  // Resume playback
  if (state.intendedPlaying && tab !== 'search' && state.stationItems[state.currentIndex]) {
    playAudio(state.stationItems[state.currentIndex].dataset.value);
  }
}

// ============================================
// MODALS
// ============================================

function showModal(modal) {
  if (!modal) return;
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('visible'), 10);
}

function hideModal(modal) {
  if (!modal) return;
  modal.classList.remove('visible');
  setTimeout(() => modal.style.display = 'none', 300);
}

function setupModals() {
  // New tab
  const createBtn = document.getElementById('createTabBtn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      const input = document.getElementById('newTabName');
      const name = input.value.trim().toLowerCase();
      
      if (!name) {
        showToast('Введіть назву', 'warning');
        return;
      }
      
      if (!/^[a-z0-9_-]{1,10}$/.test(name)) {
        showToast('Тільки латиниця, цифри, -_', 'warning');
        return;
      }
      
      const reserved = ['best', 'techno', 'trance', 'ukraine', 'pop', 'search'];
      if (reserved.includes(name) || state.customTabs.includes(name)) {
        showToast('Вкладка існує', 'warning');
        return;
      }
      
      if (state.customTabs.length >= 7) {
        showToast('Максимум 7 вкладок', 'warning');
        return;
      }
      
      state.customTabs.push(name);
      state.stationLists[name] = [];
      state.userAddedStations[name] = [];
      
      input.value = '';
      hideModal(elements.newTabModal);
      saveState();
      renderTabs();
      switchTab(name);
      showToast('Вкладку створено', 'success');
    });
  }
  
  // Edit tab
  const renameBtn = document.getElementById('renameTabBtn');
  if (renameBtn) {
    renameBtn.addEventListener('click', () => {
      const oldName = state.editingTab;
      const input = document.getElementById('renameTabName');
      const newName = input.value.trim().toLowerCase();
      
      if (!newName || !/^[a-z0-9_-]{1,10}$/.test(newName)) {
        showToast('Некоректна назва', 'warning');
        return;
      }
      
      const reserved = ['best', 'techno', 'trance', 'ukraine', 'pop', 'search'];
      if (reserved.includes(newName) || state.customTabs.includes(newName)) {
        showToast('Назва зайнята', 'warning');
        return;
      }
      
      const idx = state.customTabs.indexOf(oldName);
      state.customTabs[idx] = newName;
      
      state.stationLists[newName] = state.stationLists[oldName];
      state.userAddedStations[newName] = state.userAddedStations[oldName];
      delete state.stationLists[oldName];
      delete state.userAddedStations[oldName];
      
      if (state.currentTab === oldName) state.currentTab = newName;
      
      input.value = '';
      hideModal(elements.editTabModal);
      saveState();
      renderTabs();
      showToast('Перейменовано', 'success');
    });
  }
  
  // Delete tab
  const deleteBtn = document.getElementById('deleteTabBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      const tab = state.editingTab;
      if (!confirm(`Видалити "${tab.toUpperCase()}"?`)) return;
      
      state.customTabs = state.customTabs.filter(t => t !== tab);
      delete state.stationLists[tab];
      delete state.userAddedStations[tab];
      
      if (state.currentTab === tab) state.currentTab = 'techno';
      
      hideModal(elements.editTabModal);
      saveState();
      switchTab(state.currentTab);
      renderTabs();
      showToast('Вкладку видалено', 'success');
    });
  }
  
  // Cancel buttons
  document.querySelectorAll('.modal-cancel-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      hideModal(modal);
    });
  });
  
  // Close on overlay click
  [elements.newTabModal, elements.editTabModal, elements.sleepModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) hideModal(modal);
      });
    }
  });
}

function showEditTabModal(tab) {
  state.editingTab = tab;
  const input = document.getElementById('renameTabName');
  if (input) input.value = tab;
  showModal(elements.editTabModal);
}

// ============================================
// SLEEP TIMER
// ============================================

function setupSleepTimer() {
  if (!elements.sleepTimerBtn) return;
  
  elements.sleepTimerBtn.addEventListener('click', () => {
    updateSleepTimerDisplay();
    showModal(elements.sleepModal);
  });
  
  // Preset buttons
  document.querySelectorAll('.timer-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = btn.dataset.minutes;
      
      if (mins === 'custom') {
        document.querySelector('.timer-options').style.display = 'none';
        document.querySelector('.custom-timer').style.display = 'flex';
      } else {
        setSleepTimer(parseInt(mins));
      }
    });
  });
  
  // Custom timer
  const setCustomBtn = document.querySelector('.set-custom-timer');
  if (setCustomBtn) {
    setCustomBtn.addEventListener('click', () => {
      const input = document.getElementById('customMinutes');
      const mins = parseInt(input.value);
      
      if (mins && mins > 0 && mins <= 180) {
        setSleepTimer(mins);
        input.value = '';
        document.querySelector('.custom-timer').style.display = 'none';
        document.querySelector('.timer-options').style.display = 'grid';
      } else {
        showToast('Введіть 1-180 хв', 'warning');
      }
    });
  }
  
  // Cancel
  const cancelBtn = document.querySelector('.cancel-timer');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', cancelSleepTimer);
  }
}

function setSleepTimer(minutes) {
  cancelSleepTimer();
  
  const ms = minutes * 60000;
  state.sleepTimerEndTime = Date.now() + ms;
  
  state.sleepTimerId = setTimeout(() => {
    elements.audio.pause();
    state.intendedPlaying = false;
    saveState();
    updatePlayButton(false);
    updateWaveVisualizer(false);
    showToast('Таймер сну: зупинено', 'info');
    cancelSleepTimer();
  }, ms);
  
  hideModal(elements.sleepModal);
  showToast(`Таймер: ${minutes} хв`, 'success');
  updateSleepTimerDisplay();
}

function cancelSleepTimer() {
  if (state.sleepTimerId) {
    clearTimeout(state.sleepTimerId);
    state.sleepTimerId = null;
    state.sleepTimerEndTime = null;
    updateSleepTimerDisplay();
    showToast('Таймер скасовано', 'info');
  }
}

function updateSleepTimerDisplay() {
  const activeDiv = document.querySelector('.active-timer');
  const optionsDiv = document.querySelector('.timer-options');
  const customDiv = document.querySelector('.custom-timer');
  
  if (!activeDiv) return;
  
  if (state.sleepTimerId) {
    activeDiv.style.display = 'block';
    if (optionsDiv) optionsDiv.style.display = 'none';
    if (customDiv) customDiv.style.display = 'none';
    updateTimerCountdown();
  } else {
    activeDiv.style.display = 'none';
    if (optionsDiv) optionsDiv.style.display = 'grid';
    if (customDiv) customDiv.style.display = 'none';
  }
}

function updateTimerCountdown() {
  if (!state.sleepTimerId || !state.sleepTimerEndTime) return;
  
  const remaining = Math.max(0, state.sleepTimerEndTime - Date.now());
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  
  const display = document.getElementById('timerDisplay');
  if (display) {
    display.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  if (remaining > 0 && state.sleepTimerId) {
    requestAnimationFrame(updateTimerCountdown);
  }
}

// ============================================
// SEARCH
// ============================================

function populateSearchSuggestions() {
  const countries = ['Germany', 'France', 'United Kingdom', 'Italy', 'Spain', 'Netherlands', 'Switzerland', 'Ukraine', 'USA', 'Poland'];
  const genres = ['Pop', 'Rock', 'Dance', 'Electronic', 'Techno', 'Trance', 'House', 'EDM', 'Jazz'];
  
  const countryList = document.getElementById('suggestedCountries');
  const genreList = document.getElementById('suggestedGenres');
  const pastList = document.getElementById('pastSearches');
  
  if (countryList) countryList.innerHTML = countries.map(c => `<option value="${c}">`).join('');
  if (genreList) genreList.innerHTML = genres.map(g => `<option value="${g}">`).join('');
  if (pastList) pastList.innerHTML = state.pastSearches.map(s => `<option value="${s}">`).join('');
}

async function searchStations() {
  const query = elements.searchQuery.value.trim();
  const country = normalizeCountry(elements.searchCountry.value.trim());
  const genre = elements.searchGenre.value.trim();
  
  if (!query && !country && !genre) {
    showToast('Введіть параметри пошуку', 'warning');
    return;
  }
  
  // Save search
  if (query && !state.pastSearches.includes(query)) {
    state.pastSearches.unshift(query);
    if (state.pastSearches.length > 5) state.pastSearches.pop();
    saveState();
    populateSearchSuggestions();
  }
  
  showLoading(true);
  elements.stationList.innerHTML = '<div class="station-item empty">Пошук...</div>';
  
  try {
    const params = new URLSearchParams();
    if (query) params.append('name', query);
    if (country) params.append('country', country);
    if (genre) params.append('tag', genre);
    params.append('order', 'clickcount');
    params.append('reverse', 'true');
    params.append('limit', '50');
    params.append('hidebroken', 'true');
    
    const url = `https://de1.api.radio-browser.info/json/stations/search?${params}`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Search failed');
    
    let stations = await response.json();
    stations = stations.filter(s => s.url_resolved && s.url_resolved.startsWith('https://'));
    
    renderSearchResults(stations);
    
  } catch (error) {
    console.error('Search error:', error);
    elements.stationList.innerHTML = '<div class="station-item empty">Помилка пошуку</div>';
    showToast('Помилка пошуку', 'error');
  } finally {
    showLoading(false);
  }
}

function renderSearchResults(stations) {
  const list = elements.stationList;
  if (!list) return;
  
  if (!stations.length) {
    list.innerHTML = '<div class="station-item empty">Нічого не знайдено</div>';
    state.stationItems = [];
    return;
  }
  
  list.innerHTML = '';
  
  stations.forEach((station, index) => {
    const item = document.createElement('div');
    item.className = 'station-item';
    item.dataset.value = station.url_resolved;
    item.dataset.name = station.name;
    item.dataset.genre = shortenGenre(station.tags || station.genre);
    item.dataset.country = station.country || '-';
    item.dataset.favicon = station.favicon || '';
    
    const iconHtml = station.favicon ? `<img src="${station.favicon}" alt="" loading="lazy" onerror="this.style.display='none'">` : '';
    
    item.innerHTML = `
      ${iconHtml}
      <div class="station-icon-fallback" style="display: ${station.favicon ? 'none' : 'flex'}; width: 40px; height: 40px; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">📻</div>
      <span class="station-name">${station.name}</span>
      <button class="add-btn" title="Додати">+</button>
    `;
    
    // Play on click
    item.addEventListener('click', (e) => {
      if (e.target.closest('.add-btn')) {
        showAddToTabModal(item);
      } else {
        playSearchResult(item, index);
      }
    });
    
    list.appendChild(item);
  });
  
  state.stationItems = Array.from(list.querySelectorAll('.station-item'));
}

function playSearchResult(item, index) {
  state.currentIndex = index;
  state.stationItems.forEach(el => el.classList.remove('selected'));
  item.classList.add('selected');
  
  updateCurrentStation(item);
  state.intendedPlaying = true;
  saveState();
  playAudio(item.dataset.value);
}

function showAddToTabModal(item) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.display = 'flex';
  
  const tabs = ['techno', 'trance', 'ukraine', 'pop', ...state.customTabs];
  const labels = { techno: 'Techno', trance: 'Trance', ukraine: 'UA', pop: 'Pop' };
  
  overlay.innerHTML = `
    <div class="modal">
      <h2>Додати до вкладки</h2>
      <div class="modal-tabs">
        ${tabs.map(tab => `
          <button class="modal-tab-btn" data-tab="${tab}">${labels[tab] || tab.toUpperCase()}</button>
        `).join('')}
        <button class="modal-cancel-btn">Скасувати</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  setTimeout(() => overlay.classList.add('visible'), 10);
  
  overlay.querySelectorAll('.modal-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      addStationToTab(item, btn.dataset.tab);
      hideModal(overlay);
      setTimeout(() => overlay.remove(), 300);
    });
  });
  
  overlay.querySelector('.modal-cancel-btn').addEventListener('click', () => {
    hideModal(overlay);
    setTimeout(() => overlay.remove(), 300);
  });
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hideModal(overlay);
      setTimeout(() => overlay.remove(), 300);
    }
  });
}

function addStationToTab(item, tab) {
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
    showToast('Станція вже існує', 'warning');
    return;
  }
  
  state.stationLists[tab].unshift(station);
  state.userAddedStations[tab].unshift(station);
  saveState();
  
  showToast(`Додано до ${tab}`, 'success');
}

// ============================================
// DATA LOADING
// ============================================

async function loadStations() {
  showLoading(true);
  
  try {
    const response = await fetch(`stations.json?t=${Date.now()}`, {
      cache: 'no-store'
    });
    
    if (!response.ok) throw new Error('Failed to load');
    
    const newStations = await response.json();
    mergeStations(newStations);
    
    const validTabs = [...Object.keys(state.stationLists), 'best', 'search', ...state.customTabs];
    if (!validTabs.includes(state.currentTab)) {
      state.currentTab = 'techno';
    }
    
    renderTabs();
    switchTab(state.currentTab);
    showToast('Станції оновлено', 'success');
    
  } catch (error) {
    console.error('Load error:', error);
    renderTabs();
    switchTab(state.currentTab);
    showToast('Використано кеш', 'warning');
  } finally {
    showLoading(false);
  }
}

function mergeStations(newStations) {
  const merged = {};
  
  Object.keys(newStations).forEach(tab => {
    const unique = new Map();
    
    // User stations first
    (state.userAddedStations[tab] || []).forEach(s => {
      if (s && !state.deletedStations.includes(s.name)) unique.set(s.name, s);
    });
    
    // Then fetched
    newStations[tab].forEach(s => {
      if (s && !state.deletedStations.includes(s.name)) unique.set(s.name, s);
    });
    
    merged[tab] = Array.from(unique.values());
  });
  
  // Custom tabs
  state.customTabs.forEach(tab => {
    const unique = new Map();
    (state.userAddedStations[tab] || []).forEach(s => {
      if (s && !state.deletedStations.includes(s.name)) unique.set(s.name, s);
    });
    (state.stationLists[tab] || []).forEach(s => {
      if (s && !state.deletedStations.includes(s.name)) unique.set(s.name, s);
    });
    merged[tab] = Array.from(unique.values());
  });
  
  state.stationLists = merged;
  saveState();
  
  // Clean favorites
  state.favoriteStations = state.favoriteStations.filter(name => 
    Object.values(state.stationLists).flat().some(s => s && s.name === name)
  );
}

// ============================================
// IMPORT/EXPORT & SHARE
// ============================================

function exportSettings() {
  const data = {
    version: 'v73',
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
  
  showToast('Налаштування експортовано', 'success');
}

function importSettings(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || typeof data !== 'object') throw new Error('Invalid format');
      
      if (data.selectedTheme && themes[data.selectedTheme]) {
        applyTheme(data.selectedTheme);
      }
      
      if (Array.isArray(data.customTabs)) {
        state.customTabs = data.customTabs.filter(t => typeof t === 'string' && t.trim());
      }
      if (data.userAddedStations) state.userAddedStations = data.userAddedStations;
      if (Array.isArray(data.favoriteStations)) state.favoriteStations = data.favoriteStations;
      if (Array.isArray(data.pastSearches)) state.pastSearches = data.pastSearches.slice(0, 5);
      if (Array.isArray(data.deletedStations)) state.deletedStations = data.deletedStations;
      
      saveState();
      loadStations();
      showToast('Налаштування імпортовано', 'success');
      
    } catch (err) {
      console.error('Import error:', err);
      showToast('Помилка імпорту', 'error');
    }
    
    event.target.value = '';
  };
  reader.readAsText(file);
}

function share() {
  const item = state.stationItems[state.currentIndex];
  const name = item ? item.dataset.name : 'Radio Music';
  
  const shareData = {
    title: 'Radio Music',
    text: `Слухаю ${name} в Radio Music!`,
    url: window.location.href
  };
  
  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
    showToast('Посилання скопійовано', 'success');
  }
}

// ============================================
// PULL TO REFRESH
// ============================================

function setupPullToRefresh() {
  const list = elements.stationList;
  if (!list) return;
  
  list.addEventListener('touchstart', (e) => {
    if (list.scrollTop <= 0) {
      state.isPulling = true;
      state.pullStartY = e.touches[0].clientY;
    }
  }, { passive: true });
  
  list.addEventListener('touchmove', (e) => {
    if (!state.isPulling) return;
    
    const diff = e.touches[0].clientY - state.pullStartY;
    if (diff > 0 && diff < CONFIG.PULL_THRESHOLD * 2) {
      elements.pullIndicator.classList.add('visible');
      elements.pullIndicator.style.transform = `translateX(-50%) translateY(${Math.min(diff * 0.3, 30)}px)`;
      
      if (diff >= CONFIG.PULL_THRESHOLD) {
        elements.pullIndicator.classList.add('releasing');
      }
    }
  }, { passive: true });
  
  list.addEventListener('touchend', (e) => {
    if (!state.isPulling) return;
    
    const diff = e.changedTouches[0].clientY - state.pullStartY;
    
    elements.pullIndicator.classList.remove('visible', 'releasing');
    elements.pullIndicator.style.transform = '';
    
    if (diff >= CONFIG.PULL_THRESHOLD) {
      loadStations();
    }
    
    state.isPulling = false;
  });
}

// ============================================
// KEYBOARD & GESTURES
// ============================================

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    
    switch(e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        prevStation();
        break;
      case 'ArrowRight':
        e.preventDefault();
        nextStation();
        break;
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
    }
  });
}

function setupPlayerGestures() {
  const player = elements.currentStationInfo;
  if (!player) return;
  
  let startX = 0;
  
  player.addEventListener('touchstart', (e) => {
    startX = e.changedTouches[0].screenX;
  }, { passive: true });
  
  player.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0].screenX;
    const diff = startX - endX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextStation();
      else prevStation();
    }
  }, { passive: true });
}

// ============================================
// INITIALIZATION
// ============================================

function initElements() {
  elements.audio = document.getElementById('audioPlayer');
  elements.stationList = document.getElementById('stationList');
  elements.currentStationInfo = document.getElementById('currentStationInfo');
  elements.playBtn = document.querySelector('.play-btn');
  elements.prevBtn = document.querySelector('.prev-btn');
  elements.nextBtn = document.querySelector('.next-btn');
  elements.themeToggle = document.querySelector('.theme-toggle');
  elements.shareBtn = document.querySelector('.share-button');
  elements.exportBtn = document.querySelector('.export-button');
  elements.importBtn = document.querySelector('.import-button');
  elements.importFile = document.getElementById('importFileInput');
  elements.sleepTimerBtn = document.querySelector('.sleep-timer-btn');
  elements.searchInput = document.getElementById('searchInput');
  elements.searchQuery = document.getElementById('searchQuery');
  elements.searchCountry = document.getElementById('searchCountry');
  elements.searchGenre = document.getElementById('searchGenre');
  elements.searchBtn = document.querySelector('.search-btn');
  elements.tabsContainer = document.getElementById('tabs');
  elements.loadingIndicator = document.getElementById('loadingIndicator');
  elements.pullIndicator = document.getElementById('pullIndicator');
  elements.toastContainer = document.getElementById('toastContainer');
  elements.sleepModal = document.querySelector('.sleep-timer-modal');
  elements.newTabModal = document.querySelector('.new-tab-modal');
  elements.editTabModal = document.querySelector('.edit-tab-modal');
}

function initEventListeners() {
  // Playback
  if (elements.playBtn) elements.playBtn.addEventListener('click', togglePlay);
  if (elements.prevBtn) elements.prevBtn.addEventListener('click', prevStation);
  if (elements.nextBtn) elements.nextBtn.addEventListener('click', nextStation);
  
  // Top controls
  if (elements.themeToggle) elements.themeToggle.addEventListener('click', toggleTheme);
  if (elements.shareBtn) elements.shareBtn.addEventListener('click', share);
  if (elements.exportBtn) elements.exportBtn.addEventListener('click', exportSettings);
  if (elements.importBtn) elements.importBtn.addEventListener('click', () => elements.importFile?.click());
  if (elements.importFile) elements.importFile.addEventListener('change', importSettings);
  
  // Search
  if (elements.searchBtn) elements.searchBtn.addEventListener('click', searchStations);
  [elements.searchQuery, elements.searchCountry, elements.searchGenre].forEach(el => {
    if (el) el.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchStations();
    });
  });
  
  // Visibility
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.intendedPlaying && navigator.onLine) {
      const item = state.stationItems[state.currentIndex];
      if (item && elements.audio.paused) {
        playAudio(item.dataset.value);
      }
    }
  });
  
  // Online/Offline
  window.addEventListener('online', () => {
    showToast('Підключено', 'success');
    if (state.intendedPlaying) {
      const item = state.stationItems[state.currentIndex];
      if (item) playAudio(item.dataset.value);
    }
  });
  
  window.addEventListener('offline', () => {
    showToast('Офлайн режим', 'warning');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initElements();
  initAudio();
  initEventListeners();
  setupModals();
  setupSleepTimer();
  setupPullToRefresh();
  setupKeyboard();
  setupPlayerGestures();
  applyTheme(state.selectedTheme);
  
  loadStations();
  
  // Resume if needed
  if (state.intendedPlaying) {
    setTimeout(() => {
      const item = state.stationItems[state.currentIndex];
      if (item && navigator.onLine) {
        playAudio(item.dataset.value);
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