(function () {
  'use strict';

  let deities = JSON.parse(JSON.stringify(window.DEITY_DATA || []));
  const byId = (id) => document.getElementById(id);

  // Load custom songs and deleted default songs from local storage
  let customSongs = [];
  let deletedSongIds = [];
  try {
    const saved = localStorage.getItem('bhakti-custom-songs');
    if (saved) customSongs = JSON.parse(saved);
    const savedDeleted = localStorage.getItem('bhakti-deleted-songs');
    if (savedDeleted) deletedSongIds = JSON.parse(savedDeleted);
  } catch (_) {}

  // Merge custom songs into the deities tracks list
  customSongs.forEach(song => {
    const targetDeity = deities.find(d => d.key === song.deityKey);
    if (targetDeity) {
      if (!targetDeity.tracks.some(t => t.id === song.id)) {
        targetDeity.tracks.push(song);
      }
    }
  });

  // Filter out deleted default songs
  deities.forEach(deity => {
    deity.tracks = deity.tracks.filter(track => !deletedSongIds.includes(track.id));
  });

  const el = {
    app: byId('app'),
    artA: byId('artA'),
    artB: byId('artB'),
    clock: byId('clockTime'),
    deityBar: byId('deityBar'),
    listenerCount: byId('listenerCount'),
    listenerLabel: byId('listenerLabel'),
    manifestoLbl: byId('manifestoLbl'),
    deityHindiName: byId('deityHindiName'),
    deityEnglishName: byId('deityEnglishName'),
    swipeArea: byId('swipeArea'),
    trackForm: byId('trackForm'),
    trackTitle: byId('trackTitle'),
    trackType: byId('trackType'),
    trackPosition: byId('trackPosition'),
    trackCover: byId('trackCover'),
    timeline: byId('timeline'),
    currentTime: byId('currentTime'),
    duration: byId('duration'),
    play: byId('playBtn'),
    previous: byId('trackPrevious'),
    next: byId('trackNext'),
    timerBtn: byId('timerBtn'),
    timerBadge: byId('timerBadge'),
    timerMenu: byId('timerMenu'),
    timerClose: byId('timerClose'),
    timerCancel: byId('timerCancel'),
    timerStatus: byId('timerStatus'),
    timerOptions: Array.from(document.querySelectorAll('[data-timer-minutes]')),
    list: byId('trackList'),
    listBtn: byId('listBtn'),
    listClose: byId('listClose'),
    listHeading: byId('listHeading'),
    listItems: byId('trackListItems'),
    knowledgeBtn: byId('knowledgeBtn'),
    knowledge: byId('knowledgeDrawer'),
    knowledgeClose: byId('knowledgeClose'),
    sheetBackdrop: byId('sheetBackdrop'),
    knowledgeDeity: byId('knowledgeDeity'),
    knowledgeTitle: byId('knowledgeTitle'),
    knowledgeLead: byId('knowledgeLead'),
    knowledgeForm: byId('knowledgeForm'),
    knowledgeQuality: byId('knowledgeQuality'),
    knowledgeNote: byId('knowledgeNote'),
    aboutBtn: byId('aboutBtn'),
    aboutDialog: byId('aboutDialog'),
    aboutClose: byId('aboutClose'),
    sevaBtn: byId('sevaBtn'),
    sevaDialog: byId('sevaDialog'),
    sevaClose: byId('sevaClose'),
    toast: byId('toast'),
    soundGate: byId('soundGate'),
    soundGateTrack: byId('soundGateTrack'),
    volumeMuteBtn: byId('volumeMuteBtn'),
    volumeSlider: byId('volumeSlider')
  };

  let deityIndex = storedDeityIndex();
  let trackIndex = storedTrackIndex(deityIndex);
  let activeArt = 'A';
  let player = null;
  let playerReady = false;
  let playing = false;
  let changing = false;
  
  let touchX = 0;
  let touchY = 0;
  let touchNavigationEnabled = false;
  let toastTimer = null;
  let autoplayTimer = null;
  
  let sleepTimerEnd = 0;
  let sleepTimerInterval = null;
  
  let volume = storedVolume();
  let isMuted = false;
  let consecutiveErrors = 0;

  const currentDeity = () => deities[deityIndex];
  const currentTrack = () => currentDeity().tracks[trackIndex];

  // Storage helper keys
  function storedDeityIndex() {
    try {
      const idx = localStorage.getItem('bhakti-deity-index');
      if (idx !== null) {
        const parsed = parseInt(idx, 10);
        if (parsed >= 0 && parsed < deities.length) return parsed;
      }
    } catch (_) {}
    return 0; // Default Ganesha
  }

  function storedTrackIndex(dIdx) {
    try {
      const key = `bhakti-track-index-${deities[dIdx].key}`;
      const idx = localStorage.getItem(key);
      if (idx !== null) {
        const parsed = parseInt(idx, 10);
        if (parsed >= 0 && parsed < deities[dIdx].tracks.length) return parsed;
      }
    } catch (_) {}
    return 0;
  }

  function storedVolume() {
    try {
      const vol = localStorage.getItem('bhakti-volume');
      if (vol !== null) {
        const parsed = parseInt(vol, 10);
        if (parsed >= 0 && parsed <= 100) return parsed;
      }
    } catch (_) {}
    return 80;
  }

  function saveState() {
    try {
      localStorage.setItem('bhakti-deity-index', String(deityIndex));
      localStorage.setItem(`bhakti-track-index-${currentDeity().key}`, String(trackIndex));
    } catch (_) {}
  }

  function saveVolume() {
    try {
      localStorage.setItem('bhakti-volume', String(volume));
    } catch (_) {}
  }

  // Visual Setup
  function initDeitySelector() {
    el.deityBar.innerHTML = '';
    deities.forEach((deity, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `deity-tab ${idx === deityIndex ? 'is-active' : ''}`;
      btn.role = 'tab';
      btn.ariaSelected = idx === deityIndex ? 'true' : 'false';
      btn.textContent = deity.name;
      btn.addEventListener('click', () => {
        if (idx === deityIndex || changing) return;
        selectDeity(idx);
      });
      el.deityBar.appendChild(btn);
    });
  }

  function updateDeitySelectorActive() {
    Array.from(el.deityBar.children).forEach((btn, idx) => {
      btn.className = `deity-tab ${idx === deityIndex ? 'is-active' : ''}`;
      btn.ariaSelected = idx === deityIndex ? 'true' : 'false';
    });
    // Auto-scroll active tab into view
    const activeBtn = el.deityBar.children[deityIndex];
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  function setArtwork(url, immediate) {
    const incoming = activeArt === 'A' ? el.artB : el.artA;
    const outgoing = activeArt === 'A' ? el.artA : el.artB;

    if (url) {
      incoming.style.backgroundImage = `url("${url}")`;
    } else {
      incoming.style.backgroundImage = '';
    }

    if (immediate) {
      outgoing.classList.remove('is-active');
      incoming.classList.add('is-active');
    } else {
      requestAnimationFrame(() => {
        incoming.classList.add('is-active');
        outgoing.classList.remove('is-active');
      });
    }
    activeArt = activeArt === 'A' ? 'B' : 'A';
  }

  function renderList() {
    const deity = currentDeity();
    el.listHeading.textContent = `${deity.name} Selections`;
    el.listItems.innerHTML = '';
    
    deity.tracks.forEach((item, index) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const active = (index === trackIndex);
      button.className = active ? 'is-active' : '';
      button.setAttribute('aria-pressed', active ? 'true' : 'false');

      // Define status badges
      let statusLabel = '';
      if (active) {
        statusLabel = playing ? '<span class="track-status-badge playing">NOW PLAYING</span>' : '<span class="track-status-badge paused">PAUSED</span>';
      } else if (index === (trackIndex + 1) % deity.tracks.length) {
        statusLabel = '<span class="track-status-badge next">NEXT</span>';
      } else if (index === (trackIndex - 1 + deity.tracks.length) % deity.tracks.length) {
        statusLabel = '<span class="track-status-badge prev">PREVIOUS</span>';
      }

      // Play/Pause icon logic inside the track number column
      let playIconHtml = '';
      if (active) {
        playIconHtml = playing 
          ? `<svg viewBox="0 0 24 24" style="width:12px; height:12px; fill:var(--accent); display:block;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
          : `<svg viewBox="0 0 24 24" style="width:12px; height:12px; fill:var(--accent); display:block;"><path d="M8 5v14l11-7z"/></svg>`;
      } else {
        playIconHtml = `<span class="track-num-val">0${index + 1}</span><span class="track-hover-play" style="display:none;"><svg viewBox="0 0 24 24" style="width:10px; height:10px; fill:currentColor; display:block;"><path d="M8 5v14l11-7z"/></svg></span>`;
      }

      button.innerHTML = `
        <span class="playlist-item-num-container" style="width: 20px; display: grid; place-items: center; color: var(--accent); font-weight: 700; font-size: 10px;">${playIconHtml}</span>
        <span>
          <b>${item.shortName}</b>
          <small>${item.type}</small>
        </span>
        <span style="display: flex; align-items: center; gap: 8px;">
          ${statusLabel}
          <span class="bullet" style="color: var(--accent); font-size: 10px;">●</span>
        </span>
      `;
      button.addEventListener('click', () => {
        if (active) {
          togglePlayback();
        } else {
          selectTrack(index, true);
        }
      });
      li.append(button);
      el.listItems.append(li);
    });
  }

  function renderKnowledge() {
    const item = currentTrack();
    el.knowledgeDeity.textContent = currentDeity().name.toUpperCase();
    el.knowledgeTitle.innerHTML = `Why ${item.shortName}<br>for ${currentDeity().name}?`;
    el.knowledgeLead.textContent = item.lead;
    el.knowledgeForm.textContent = item.type;
    el.knowledgeQuality.textContent = item.quality;
    el.knowledgeNote.textContent = item.note;
  }

  function renderTrack() {
    const item = currentTrack();
    el.trackForm.textContent = item.type.toUpperCase();
    el.trackTitle.textContent = item.title;
    el.trackType.textContent = item.subline;
    el.trackPosition.textContent = `${trackIndex + 1} of ${currentDeity().tracks.length}`;
    
    // Set vinyl disc image fallback
    el.trackCover.src = `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`;
    
    el.timeline.value = 0;
    el.timeline.style.setProperty('--progress', '0%');
    el.currentTime.textContent = '0:00';
    el.duration.textContent = '0:00';
    renderList();
    renderKnowledge();
  }

  function renderDeity(immediate = false) {
    const deity = currentDeity();
    el.app.dataset.deity = deity.key;
    document.documentElement.style.setProperty('--accent', deity.accent);
    document.documentElement.style.setProperty('--accent-rgb', deity.accentRgb);
    document.querySelector('meta[name="theme-color"]').content = deity.accent;

    el.manifestoLbl.textContent = deity.manifesto;
    el.deityHindiName.innerHTML = `<span>${deity.hindi}</span>`;
    el.deityEnglishName.textContent = deity.name === 'Durga' ? 'Goddess Durga' : `Lord ${deity.name}`;

    setArtwork(deity.art, immediate);
    renderTrack();
  }

  function toast(message, delay = 3200) {
    clearTimeout(toastTimer);
    el.toast.textContent = message;
    el.toast.classList.add('is-visible');
    toastTimer = setTimeout(() => el.toast.classList.remove('is-visible'), delay);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  }

  // Volume Operations
  function updateVolumeUI() {
    el.volumeSlider.value = volume;
    el.volumeSlider.style.setProperty('--progress', `${volume}%`);
    if (volume === 0 || isMuted) {
      el.volumeMuteBtn.querySelector('.icon-volume').hidden = true;
      el.volumeMuteBtn.querySelector('.icon-muted').hidden = false;
    } else {
      el.volumeMuteBtn.querySelector('.icon-volume').hidden = false;
      el.volumeMuteBtn.querySelector('.icon-muted').hidden = true;
    }
  }

  function applyVolume() {
    if (playerReady && player) {
      player.setVolume(isMuted ? 0 : volume);
    }
    updateVolumeUI();
  }

  // YouTube IFrame API Control
  function attemptAutoplay() {
    if (!playerReady || !player) return;
    clearTimeout(autoplayTimer);
    player.loadVideoById(currentTrack().id);
    applyVolume();
    autoplayTimer = setTimeout(() => {
      if (!playing) showSoundGate();
    }, 1800);
  }

  function cueSelected(autoplay) {
    if (!player) return;
    if (autoplay) {
      try {
        player.loadVideoById(currentTrack().id);
        applyVolume();
      } catch (e) {
        console.error(e);
      }
    } else {
      try {
        player.cueVideoById(currentTrack().id);
      } catch (e) {
        console.error(e);
      }
    }
  }

  function selectDeity(index) {
    if (changing) return;
    changing = true;
    const resume = playing;
    closeList();
    closeTimerMenu();
    document.querySelector('.wordmark').classList.add('is-changing');

    setTimeout(() => {
      deityIndex = index;
      trackIndex = storedTrackIndex(index);
      saveState();
      renderDeity(false);
      updateDeitySelectorActive();
      cueSelected(resume);
      document.querySelector('.wordmark').classList.remove('is-changing');
      changing = false;
    }, 240);
  }

  function selectTrack(index, autoplay = false) {
    const totalTracks = currentDeity().tracks.length;
    trackIndex = (index + totalTracks) % totalTracks;
    saveState();
    renderTrack();
    cueSelected(autoplay || playing);
  }

  function setPlaying(value) {
    playing = value;
    el.app.classList.toggle('is-playing', value);
    el.play.setAttribute('aria-label', value ? 'Pause' : 'Play');
    el.play.setAttribute('aria-pressed', value ? 'true' : 'false');
    renderList();
  }

  function togglePlayback() {
    if (!playerReady || !player) {
      toast('Connecting to temple speaker…');
      return;
    }
    if (playing) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }

  function showSoundGate() {
    if (playing || !el.soundGate) return;
    el.soundGateTrack.textContent = currentTrack().shortName;
    el.soundGate.hidden = false;
  }

  function hideSoundGate() {
    clearTimeout(autoplayTimer);
    if (el.soundGate) el.soundGate.hidden = true;
  }

  function enterWithSound() {
    hideSoundGate();
    if (!playerReady || !player) return;
    player.loadVideoById(currentTrack().id);
    applyVolume();
    player.playVideo();
  }

  // Draw simulated UPI payment QR code
  function drawUPIQR() {
    const canvas = el.sevaDialog.querySelector('#upiQrCode');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#100603';
    // Corners indicators
    const drawAnchor = (x, y) => {
      ctx.fillRect(x, y, 26, 26);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 4, y + 4, 18, 18);
      ctx.fillStyle = '#100603';
      ctx.fillRect(x + 8, y + 8, 10, 10);
    };

    drawAnchor(10, 10);
    drawAnchor(size - 36, 10);
    drawAnchor(10, size - 36);

    // Random pixels matrix
    for (let r = 0; r < 22; r++) {
      for (let c = 0; c < 22; c++) {
        if ((r < 6 && c < 6) || (r < 6 && c > 15) || (r > 15 && c < 6)) continue;
        if (Math.random() > 0.46) {
          ctx.fillRect(12 + c * 6.2, 12 + r * 6.2, 4.5, 4.5);
        }
      }
    }
  }

  // Sleep Timer Operations
  function formatTimerRemaining(ms) {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }

  function renderSleepTimer() {
    const remaining = Math.max(0, sleepTimerEnd - Date.now());
    const active = remaining > 0;
    el.timerBtn.classList.toggle('is-active', active);
    el.timerBadge.hidden = !active;
    el.timerBadge.textContent = active ? `${Math.ceil(remaining / 60000)}m` : '';
    el.timerStatus.textContent = active ? `Music pauses in ${formatTimerRemaining(remaining)}` : 'No sleep timer set';
    el.timerCancel.disabled = !active;
    el.timerBtn.setAttribute('aria-label', active ? `Sleep timer: ${formatTimerRemaining(remaining)} remaining` : 'Set sleep timer');
  }

  function closeTimerMenu() {
    el.timerMenu.classList.remove('is-open');
    el.timerMenu.setAttribute('aria-hidden', 'true');
    el.timerBtn.setAttribute('aria-expanded', 'false');
  }

  function openTimerMenu() {
    closeList();
    renderSleepTimer();
    el.timerMenu.classList.add('is-open');
    el.timerMenu.setAttribute('aria-hidden', 'false');
    el.timerBtn.setAttribute('aria-expanded', 'true');
  }

  function toggleTimerMenu() {
    if (el.timerMenu.classList.contains('is-open')) closeTimerMenu();
    else openTimerMenu();
  }

  function clearSleepTimer(notify = true) {
    clearInterval(sleepTimerInterval);
    sleepTimerInterval = null;
    sleepTimerEnd = 0;
    renderSleepTimer();
    if (notify) toast('Sleep timer disabled.');
  }

  function finishSleepTimer() {
    clearSleepTimer(false);
    closeTimerMenu();
    hideSoundGate();
    if (playerReady && player) player.pauseVideo();
    setPlaying(false);
    toast('Sleep timer finished. Music stopped.');
  }

  function updateSleepTimer() {
    if (!sleepTimerEnd) return;
    if (Date.now() >= sleepTimerEnd) {
      finishSleepTimer();
    } else {
      renderSleepTimer();
    }
  }

  function setSleepTimer(minutes) {
    if (minutes <= 0) {
      clearSleepTimer(true);
      closeTimerMenu();
      return;
    }
    clearInterval(sleepTimerInterval);
    sleepTimerEnd = Date.now() + minutes * 60 * 1000;
    sleepTimerInterval = setInterval(updateSleepTimer, 1000);
    renderSleepTimer();
    closeTimerMenu();
    toast(`Sleep timer set for ${minutes} minutes.`);
  }

  // Drawers and Modals Toggle
  function openList() {
    closeTimerMenu();
    el.list.classList.add('is-open');
    el.list.setAttribute('aria-hidden', 'false');
    el.listBtn.classList.add('is-active');
    el.listBtn.setAttribute('aria-expanded', 'true');
  }

  function closeList() {
    el.list.classList.remove('is-open');
    el.list.setAttribute('aria-hidden', 'true');
    el.listBtn.classList.remove('is-active');
    el.listBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleList() {
    if (el.list.classList.contains('is-open')) closeList();
    else openList();
  }

  function openKnowledge() {
    closeList();
    closeTimerMenu();
    document.body.classList.add('sheet-open');
    el.knowledge.setAttribute('aria-hidden', 'false');
    setTimeout(() => el.knowledgeClose.focus(), 300);
  }

  // Clock ticks
  function tickClock() {
    const now = new Date();
    el.clock.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }

  function closeKnowledge() {
    document.body.classList.remove('sheet-open');
    el.knowledge.setAttribute('aria-hidden', 'true');
  }

  // Listeners heartbeat counter fluctuation
  function mockListenerHeartbeat() {
    let count = parseInt(el.listenerCount.textContent, 10) || 108;
    // Add/remove a random number of people (max 5)
    const shift = Math.floor(Math.random() * 9) - 4;
    count = Math.max(10, count + shift);
    el.listenerCount.textContent = String(count);
    el.listenerLabel.textContent = count === 1 ? 'listening' : 'listening';
  }

  // Player callbacks
  function handlePlayerState(event) {
    if (!window.YT || !window.YT.PlayerState) return;
    if (event.data === window.YT.PlayerState.PLAYING) {
      setPlaying(true);
      hideSoundGate();
      consecutiveErrors = 0; // Reset consecutive errors on successful play
      try {
        if (typeof event.target.setPlaybackQuality === 'function') {
          event.target.setPlaybackQuality('medium');
        }
      } catch (e) {}
    }
    if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.CUED) {
      setPlaying(false);
    }
    if (event.data === window.YT.PlayerState.ENDED) {
      selectTrack(trackIndex + 1, true); // Play next song
    }
  }

  function handlePlayerError(event) {
    setPlaying(false);
    consecutiveErrors++;

    if (location.protocol === 'file:') {
      toast('Opening index.html directly from file system blocks YouTube API. Please run run.bat to start the local server!', 6000);
      return;
    }

    if (consecutiveErrors >= 3) {
      toast('Connection failed. Please check your internet or select a different song.', 5000);
      consecutiveErrors = 0;
      return;
    }

    toast('Temple signal lost. Swapping song…');
    setTimeout(() => selectTrack(trackIndex + 1, true), 3000);
  }

  // YouTube API callback
  window.onYouTubeIframeAPIReady = function () {
    const config = {
      height: '100',
      width: '100',
      videoId: currentTrack().id,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        playsinline: 1,
        rel: 0,
        modestbranding: 1
      },
      events: {
        onReady: (event) => {
          player = event.target;
          playerReady = true;
          el.play.disabled = false;
          applyVolume();
          attemptAutoplay();
        },
        onStateChange: handlePlayerState,
        onError: handlePlayerError,
        onAutoplayBlocked: showSoundGate
      }
    };
    if (location.protocol !== 'file:') config.playerVars.origin = location.origin;
    player = new window.YT.Player('youtubePlayer', config);
  };

  function loadYouTubeScript() {
    if (window.YT && window.YT.Player) {
      return window.onYouTubeIframeAPIReady();
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.onerror = () => toast('Could not load temple sound. Check internet.', 5000);
    document.head.append(tag);
  }

  // Add Listeners
  el.play.addEventListener('click', togglePlayback);
  el.soundGate.addEventListener('click', enterWithSound);
  el.previous.addEventListener('click', () => selectTrack(trackIndex - 1, true));
  el.next.addEventListener('click', () => selectTrack(trackIndex + 1, true));
  el.timerBtn.addEventListener('click', toggleTimerMenu);
  el.timerClose.addEventListener('click', closeTimerMenu);
  
  el.timerOptions.forEach((btn) => {
    btn.addEventListener('click', () => setSleepTimer(Number(btn.dataset.timerMinutes)));
  });

  if (el.listBtn) el.listBtn.addEventListener('click', toggleList);
  if (el.listClose) el.listClose.addEventListener('click', closeList);
  
  el.knowledgeBtn.addEventListener('click', openKnowledge);
  el.knowledgeClose.addEventListener('click', closeKnowledge);
  el.sheetBackdrop.addEventListener('click', closeKnowledge);

  el.aboutBtn.addEventListener('click', () => el.aboutDialog.showModal());
  el.aboutClose.addEventListener('click', () => el.aboutDialog.close());
  el.aboutDialog.addEventListener('click', (e) => {
    if (e.target === el.aboutDialog) el.aboutDialog.close();
  });

  el.sevaBtn.addEventListener('click', () => {
    el.sevaDialog.showModal();
    drawUPIQR();
  });
  el.sevaClose.addEventListener('click', () => el.sevaDialog.close());
  el.sevaDialog.addEventListener('click', (e) => {
    if (e.target === el.sevaDialog) el.sevaDialog.close();
  });

  // Seek Progress Interaction
  el.timeline.addEventListener('input', () => {
    const val = Number(el.timeline.value) / 10;
    el.timeline.style.setProperty('--progress', `${val}%`);
    if (playerReady && player) {
      el.currentTime.textContent = formatTime((val / 100) * player.getDuration());
    }
  });

  el.timeline.addEventListener('change', () => {
    if (!playerReady || !player) return;
    const dur = player.getDuration();
    if (dur > 0) {
      player.seekTo((Number(el.timeline.value) / 1000) * dur, true);
    }
  });

  // Volume slider interaction
  el.volumeSlider.addEventListener('input', () => {
    volume = Number(el.volumeSlider.value);
    isMuted = (volume === 0);
    saveVolume();
    applyVolume();
  });

  el.volumeMuteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    applyVolume();
  });

  // Swipe interactions
  el.swipeArea.addEventListener('touchstart', (e) => {
    // Enable swipe navigation if not clicking interactive UI components
    touchNavigationEnabled = !e.target.closest('button, a, input, .player, .playlist, .sleep-timer, .deity-bar');
    touchX = e.changedTouches[0].clientX;
    touchY = e.changedTouches[0].clientY;
  }, { passive: true });

  el.swipeArea.addEventListener('touchend', (e) => {
    if (!touchNavigationEnabled) return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;

    // Left/Right swiping shifts deities
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      const count = deities.length;
      const nextIdx = (deityIndex + (dx > 0 ? -1 : 1) + count) % count;
      selectDeity(nextIdx);
    }
    // Up/Down swiping shifts tracks
    else if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      selectTrack(trackIndex + (dy > 0 ? 1 : -1), true);
    }
  }, { passive: true });

  // Key shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeList();
      closeTimerMenu();
      if (document.body.classList.contains('sheet-open')) closeKnowledge();
      return;
    }
    // Skip shortcut processing if focus is inside dynamic menus, inputs or open dialogs
    if (el.aboutDialog.open || el.sevaDialog.open || document.body.classList.contains('sheet-open') || el.timerMenu.classList.contains('is-open')) return;
    if (e.target.matches('input, button, a')) return;

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayback();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectTrack(trackIndex - 1, true);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectTrack(trackIndex + 1, true);
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const count = deities.length;
      selectDeity((deityIndex - 1 + count) % count);
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      selectDeity((deityIndex + 1) % deities.length);
    }
  });

  // Track ticker intervals
  setInterval(() => {
    tickClock();
    if (!playerReady || !player || document.activeElement === el.timeline) return;
    const dur = player.getDuration();
    const cur = player.getCurrentTime();
    if (dur > 0) {
      const progress = Math.min(1000, Math.max(0, (cur / dur) * 1000));
      el.timeline.value = progress;
      el.timeline.style.setProperty('--progress', `${progress / 10}%`);
      el.currentTime.textContent = formatTime(cur);
      el.duration.textContent = formatTime(dur);
    }
  }, 400);



  // Visualizer initialization and animation handler
  let vBars = [];
  function initVisualizer() {
    const equalizer = byId('equalizer');
    if (!equalizer) return;
    equalizer.innerHTML = '';
    const barCount = Math.floor(window.innerWidth / 12);
    for (let i = 0; i < barCount; i++) {
      const bar = document.createElement('span');
      bar.className = 'v-bar';
      equalizer.appendChild(bar);
    }
    vBars = Array.from(equalizer.querySelectorAll('.v-bar'));
  }

  function animateVisualizer() {
    if (!playing) {
      vBars.forEach(bar => {
        const transformStr = bar.style.transform || 'scaleY(0.08)';
        const match = transformStr.match(/scaleY\(([^)]+)\)/);
        const curScale = match ? parseFloat(match[1]) : 0.08;
        if (curScale > 0.08) {
          bar.style.transform = `scaleY(${Math.max(0.08, curScale - 0.04)})`;
        }
      });
      requestAnimationFrame(animateVisualizer);
      return;
    }

    vBars.forEach((bar, index) => {
      const time = Date.now() * 0.004;
      const base = Math.sin(time + index * 0.15) * 0.22 + 0.35;
      const noise = Math.random() * 0.15;
      const scale = Math.max(0.08, base + noise);
      bar.style.transform = `scaleY(${scale})`;
    });

    requestAnimationFrame(animateVisualizer);
  }

  // Background particles canvas setup
  const bgCanvas = byId('bgCanvas');
  const bgCtx = bgCanvas ? bgCanvas.getContext('2d') : null;
  let bgParticles = [];
  const maxBgParticles = 45;

  class BgParticle {
    constructor() {
      this.reset(true);
    }
    reset(init = false) {
      if (!bgCanvas) return;
      this.x = Math.random() * bgCanvas.width;
      this.y = init ? Math.random() * bgCanvas.height : bgCanvas.height + 20;
      this.size = Math.random() * 3 + 1.2;
      this.speedY = Math.random() * 0.35 + 0.15;
      this.alpha = Math.random() * 0.4 + 0.1;
      this.fadeSpeed = Math.random() * 0.002 + 0.001;
      this.angle = Math.random() * 360;
      this.spin = Math.random() * 0.4 - 0.2;
    }
    update() {
      if (!bgCanvas) return;
      this.y -= this.speedY;
      this.x += Math.sin(this.angle * Math.PI / 180) * 0.2;
      this.angle += this.spin;
      this.alpha -= this.fadeSpeed;
      if (this.alpha <= 0 || this.y < -10 || this.x < -10 || this.x > bgCanvas.width + 10) {
        this.reset(false);
      }
    }
    draw(rgb) {
      if (!bgCtx) return;
      bgCtx.save();
      bgCtx.beginPath();
      const grad = bgCtx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2);
      grad.addColorStop(0, `rgba(${rgb}, ${this.alpha})`);
      grad.addColorStop(1, `rgba(${rgb}, 0)`);
      bgCtx.fillStyle = grad;
      bgCtx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
      bgCtx.fill();
      bgCtx.restore();
    }
  }

  function resizeBgCanvas() {
    if (!bgCanvas) return;
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
  }

  function initBgParticles() {
    if (!bgCanvas) return;
    bgParticles = [];
    for (let i = 0; i < maxBgParticles; i++) {
      bgParticles.push(new BgParticle());
    }
  }

  function animateBgParticles() {
    if (!bgCtx || !bgCanvas) return;
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    
    const deity = currentDeity();
    const rgb = deity.accentRgb || '255, 130, 37';
    
    bgParticles.forEach(p => {
      p.update();
      p.draw(rgb);
    });
    
    requestAnimationFrame(animateBgParticles);
  }

  window.addEventListener('resize', () => {
    initVisualizer();
    resizeBgCanvas();
  });

  // Setup loop
  renderDeity(true);
  initDeitySelector();
  tickClock();
  updateVolumeUI();
  renderSleepTimer();
  initVisualizer();
  animateVisualizer();
  
  // Initialize and start background particles
  resizeBgCanvas();
  initBgParticles();
  animateBgParticles();
  
  // Random listener heartbeats every 8 seconds
  setInterval(mockListenerHeartbeat, 8000);
  
  loadYouTubeScript();
})();
