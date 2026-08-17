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

  const nativeAudio = new Audio();
  let audioCtx = null;
  let analyser = null;
  let source = null;
  let dataArray = null;

  function isDirectAudio(urlOrId) {
    if (!urlOrId) return false;
    const clean = urlOrId.toLowerCase().trim();
    return (
      clean.endsWith('.mp3') || 
      clean.endsWith('.m4a') || 
      clean.endsWith('.wav') || 
      clean.endsWith('.ogg') ||
      (clean.startsWith('http') && (clean.includes('/mp3') || clean.includes('/audio') || clean.includes('.mp3'))) ||
      clean.startsWith('audio/')
    );
  }

  function initWebAudio() {
    if (audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      source = audioCtx.createMediaElementSource(nativeAudio);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
    } catch (e) {
      console.warn('Web Audio API initialized on user interaction:', e);
    }
  }
  
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
    nativeAudio.volume = isMuted ? 0 : volume / 100;
    updateVolumeUI();
  }

  // YouTube IFrame API and Native Audio Control
  function attemptAutoplay() {
    clearTimeout(autoplayTimer);
    const track = currentTrack();
    
    if (isDirectAudio(track.id)) {
      if (playerReady && player) player.pauseVideo();
      nativeAudio.src = track.id;
      nativeAudio.load();
      initWebAudio();
      applyVolume();
      
      nativeAudio.play()
        .then(() => setPlaying(true))
        .catch(() => showSoundGate());
    } else {
      nativeAudio.pause();
      if (!playerReady || !player) return;
      player.loadVideoById(track.id);
      applyVolume();
      autoplayTimer = setTimeout(() => {
        if (!playing) showSoundGate();
      }, 1800);
    }
  }

  function cueSelected(autoplay) {
    const track = currentTrack();
    
    if (isDirectAudio(track.id)) {
      if (playerReady && player) player.pauseVideo();
      nativeAudio.src = track.id;
      nativeAudio.load();
      
      if (autoplay) {
        initWebAudio();
        applyVolume();
        nativeAudio.play()
          .then(() => setPlaying(true))
          .catch(() => setPlaying(false));
      } else {
        setPlaying(false);
      }
    } else {
      nativeAudio.pause();
      if (!player) return;
      if (autoplay) {
        try {
          player.loadVideoById(track.id);
          applyVolume();
        } catch (e) {
          console.error(e);
        }
      } else {
        try {
          player.cueVideoById(track.id);
        } catch (e) {
          console.error(e);
        }
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
      initBgParticles();
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
    const track = currentTrack();
    if (isDirectAudio(track.id)) {
      if (playing) {
        nativeAudio.pause();
        setPlaying(false);
      } else {
        initWebAudio();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        applyVolume();
        nativeAudio.play()
          .then(() => setPlaying(true))
          .catch((e) => console.error(e));
      }
      return;
    }
    
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
    const track = currentTrack();
    if (isDirectAudio(track.id)) {
      nativeAudio.src = track.id;
      nativeAudio.load();
      initWebAudio();
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
      applyVolume();
      nativeAudio.play()
        .then(() => setPlaying(true))
        .catch((e) => console.error(e));
      return;
    }
    if (!playerReady || !player) return;
    player.loadVideoById(track.id);
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

  function getHinduCalendarDetails(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const dayName = days[date.getDay()];
    const dateNum = date.getDate();
    const monthName = months[date.getMonth()];
    
    const gregorianStr = `${dayName}, ${dateNum} ${monthName}`;
    
    const refNewMoon = new Date('2024-12-30T00:00:00Z');
    const msPerDay = 86400000;
    const synodicMonth = 29.530588853;
    const diffDays = (date.getTime() - refNewMoon.getTime()) / msPerDay;
    
    let lunarAge = diffDays % synodicMonth;
    if (lunarAge < 0) lunarAge += synodicMonth;
    
    const tithiNum = Math.floor((lunarAge / synodicMonth) * 30) + 1;
    let paksha = tithiNum <= 15 ? 'Shukla' : 'Krishna';
    let tithiIdx = tithiNum <= 15 ? tithiNum : tithiNum - 15;
    
    const tithiNames = [
      'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami',
      'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
      'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima'
    ];
    
    let tithiName = '';
    if (tithiNum === 30) tithiName = 'Amavasya';
    else if (tithiNum === 15) tithiName = 'Purnima';
    else tithiName = `${tithiNames[tithiIdx - 1]} (${paksha})`;
    
    let hinduMonth = 'Shravan';
    const m = date.getMonth();
    if (m === 0) hinduMonth = 'Pausha/Magha';
    else if (m === 1) hinduMonth = 'Magha/Phalguna';
    else if (m === 2) hinduMonth = 'Phalguna/Chaitra';
    else if (m === 3) hinduMonth = 'Chaitra/Vaishakha';
    else if (m === 4) hinduMonth = 'Vaishakha/Jyeshtha';
    else if (m === 5) hinduMonth = 'Jyeshtha/Ashadha';
    else if (m === 6) hinduMonth = 'Ashadha/Shravan';
    else if (m === 7) hinduMonth = 'Shravan';
    else if (m === 8) hinduMonth = 'Bhadrapada';
    else if (m === 9) hinduMonth = 'Ashvina';
    else if (m === 10) hinduMonth = 'Kartika';
    else if (m === 11) hinduMonth = 'Margashirsha';
    
    let festival = '';
    const dateKey = `${m + 1}-${date.getDate()}`;
    if (date.getFullYear() === 2026) {
      if (dateKey === '8-17') festival = 'Shravan Somvar';
      else if (dateKey === '8-28') festival = 'Raksha Bandhan';
      else if (dateKey === '9-4') festival = 'Janmashtami';
      else if (dateKey === '9-14') festival = 'Ganesh Chaturthi';
      else if (dateKey === '10-20') festival = 'Vijayadashami';
      else if (dateKey === '11-8') festival = 'Deepavali';
    }
    
    if (!festival && date.getDay() === 1 && hinduMonth === 'Shravan') {
      festival = 'Shravan Somvar';
    }
    
    return {
      gregorian: gregorianStr,
      tithi: `${tithiName} · ${hinduMonth}`,
      festival: festival ? `🪔 ${festival}` : ''
    };
  }

  // Clock ticks
  function tickClock() {
    const now = new Date();
    el.clock.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    
    const details = getHinduCalendarDetails(now);
    const hinduDateEl = byId('hinduDate');
    if (hinduDateEl) {
      hinduDateEl.innerHTML = `
        <div>${details.gregorian}</div>
        <div style="color: var(--accent); margin-top: 1px;">${details.tithi}</div>
        ${details.festival ? `<div style="color: #ffd54f; font-size: 8px; margin-top: 2px;">${details.festival}</div>` : ''}
      `;
    }
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
    const track = currentTrack();
    if (isDirectAudio(track.id)) {
      el.currentTime.textContent = formatTime((val / 100) * nativeAudio.duration);
    } else if (playerReady && player) {
      el.currentTime.textContent = formatTime((val / 100) * player.getDuration());
    }
  });

  el.timeline.addEventListener('change', () => {
    const track = currentTrack();
    if (isDirectAudio(track.id)) {
      const dur = nativeAudio.duration;
      if (dur > 0) {
        nativeAudio.currentTime = (Number(el.timeline.value) / 1000) * dur;
      }
    } else {
      if (!playerReady || !player) return;
      const dur = player.getDuration();
      if (dur > 0) {
        player.seekTo((Number(el.timeline.value) / 1000) * dur, true);
      }
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
    if (document.activeElement === el.timeline) return;
    const track = currentTrack();
    const isDirect = isDirectAudio(track.id);
    
    if (isDirect) {
      const dur = nativeAudio.duration;
      const cur = nativeAudio.currentTime;
      if (dur > 0) {
        const progress = Math.min(1000, Math.max(0, (cur / dur) * 1000));
        el.timeline.value = progress;
        el.timeline.style.setProperty('--progress', `${progress / 10}%`);
        el.currentTime.textContent = formatTime(cur);
        el.duration.textContent = formatTime(dur);
      }
    } else {
      if (!playerReady || !player) return;
      const dur = player.getDuration();
      const cur = player.getCurrentTime();
      if (dur > 0) {
        const progress = Math.min(1000, Math.max(0, (cur / dur) * 1000));
        el.timeline.value = progress;
        el.timeline.style.setProperty('--progress', `${progress / 10}%`);
        el.currentTime.textContent = formatTime(cur);
        el.duration.textContent = formatTime(dur);
      }
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
    const volFactor = isMuted ? 0 : volume / 100;
    const track = currentDeity() ? currentTrack() : null;
    const isDirect = track ? isDirectAudio(track.id) : false;
    
    if (isDirect && playing && analyser && dataArray) {
      analyser.getByteFrequencyData(dataArray);
    }
    
    vBars.forEach((bar, index) => {
      let targetScale = 0.08;
      
      if (playing && volFactor > 0) {
        if (isDirect && analyser && dataArray) {
          const total = vBars.length;
          const pct = index / total;
          const freqIndex = Math.floor(pct * dataArray.length * 0.7);
          const rawValue = dataArray[freqIndex] || 0;
          
          targetScale = 0.08 + (rawValue / 255) * 0.88 * volFactor;
        } else {
          const time = Date.now() * 0.004;
          const total = vBars.length;
          const pct = index / total;
          
          let base = 0.08;
          if (pct < 0.15) {
            base = Math.sin(time * 1.6 + index * 0.4) * 0.35 + 0.45;
            base += Math.random() * 0.2;
          } else if (pct < 0.70) {
            base = Math.sin(time * 2.8 + index * 0.15) * 0.28 + 0.32;
            base += Math.random() * 0.16;
          } else {
            base = Math.sin(time * 5.5 + index * 0.08) * 0.16 + 0.22;
            base += Math.random() * 0.12;
          }
          
          const volumeMultiplier = 0.15 + 0.85 * volFactor;
          targetScale = Math.max(0.08, base * volumeMultiplier);
        }
      }
      
      const currentTransform = bar.style.transform || 'scaleY(0.08)';
      const match = currentTransform.match(/scaleY\(([^)]+)\)/);
      const currentScale = match ? parseFloat(match[1]) : 0.08;
      
      const nextScale = currentScale + (targetScale - currentScale) * 0.3;
      bar.style.transform = `scaleY(${Math.max(0.08, nextScale)})`;
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
      const deity = currentDeity();
      const deityKey = deity ? deity.key : 'ganesha';
      this.deityKey = deityKey;
      
      if (deityKey === 'shiva') {
        // Shiva: Smoke clouds (large, slow, rising)
        this.x = Math.random() * bgCanvas.width;
        this.y = init ? Math.random() * bgCanvas.height : bgCanvas.height + 60;
        this.size = Math.random() * 40 + 30;
        this.speedY = Math.random() * 0.15 + 0.12;
        this.speedX = Math.random() * 0.1 - 0.05;
        this.alpha = Math.random() * 0.05 + 0.025;
        this.fadeSpeed = Math.random() * 0.0003 + 0.00015;
        this.angle = Math.random() * 360;
        this.spin = Math.random() * 0.2 - 0.1;
      } else if (deityKey === 'krishna') {
        // Krishna: Leaves and flower petals blowing horizontally (left to right)
        this.x = init ? Math.random() * bgCanvas.width : -30;
        this.y = Math.random() * bgCanvas.height;
        this.size = Math.random() * 6 + 4;
        this.speedX = Math.random() * 0.7 + 0.4;
        this.speedY = (Math.random() - 0.5) * 0.15;
        this.alpha = Math.random() * 0.5 + 0.2;
        this.fadeSpeed = 0;
        this.angle = Math.random() * 360;
        this.spin = Math.random() * 1.2 + 0.4;
        this.type = Math.random() > 0.5 ? 'leaf' : 'petal';
      } else {
        // Ganesha, Rama, Hanuman, Durga: Gentle floating sparkles and petals
        this.x = Math.random() * bgCanvas.width;
        this.y = init ? Math.random() * bgCanvas.height : bgCanvas.height + 20;
        this.size = Math.random() * 3.5 + 1.2;
        this.speedY = Math.random() * 0.32 + 0.12;
        this.speedX = Math.random() * 0.16 - 0.08;
        this.alpha = Math.random() * 0.45 + 0.15;
        this.fadeSpeed = Math.random() * 0.0018 + 0.0008;
        this.angle = Math.random() * 360;
        this.spin = Math.random() * 0.4 - 0.2;
        this.type = Math.random() > 0.6 ? 'petal' : 'sparkle';
      }
    }
    update() {
      if (!bgCanvas) return;
      const activeDeityKey = currentDeity() ? currentDeity().key : 'ganesha';
      if (this.deityKey !== activeDeityKey) {
        this.reset(false);
        return;
      }
      
      if (this.deityKey === 'shiva') {
        this.y -= this.speedY;
        this.x += this.speedX;
        this.alpha -= this.fadeSpeed;
        if (this.alpha <= 0 || this.y < -this.size * 1.5) {
          this.reset(false);
        }
      } else if (this.deityKey === 'krishna') {
        this.x += this.speedX;
        this.y += this.speedY;
        this.angle += this.spin;
        if (this.x > bgCanvas.width + 30 || this.y < -30 || this.y > bgCanvas.height + 30) {
          this.reset(false);
        }
      } else {
        this.y -= this.speedY;
        this.x += this.speedX;
        this.angle += this.spin;
        this.alpha -= this.fadeSpeed;
        if (this.alpha <= 0 || this.y < -15) {
          this.reset(false);
        }
      }
    }
    draw(rgb) {
      if (!bgCtx) return;
      
      if (this.deityKey === 'shiva') {
        bgCtx.save();
        bgCtx.beginPath();
        const grad = bgCtx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
        grad.addColorStop(0, `rgba(160, 185, 200, ${this.alpha})`);
        grad.addColorStop(0.5, `rgba(120, 150, 170, ${this.alpha * 0.4})`);
        grad.addColorStop(1, 'rgba(120, 150, 170, 0)');
        bgCtx.fillStyle = grad;
        bgCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        bgCtx.fill();
        bgCtx.restore();
      } else if (this.deityKey === 'krishna') {
        bgCtx.save();
        bgCtx.translate(this.x, this.y);
        bgCtx.rotate(this.angle * Math.PI / 180);
        bgCtx.beginPath();
        if (this.type === 'leaf') {
          // Soft green leaf
          bgCtx.fillStyle = `rgba(46, 125, 50, ${this.alpha})`;
          bgCtx.moveTo(0, -this.size);
          bgCtx.quadraticCurveTo(this.size * 0.7, -this.size * 0.5, 0, this.size);
          bgCtx.quadraticCurveTo(-this.size * 0.7, -this.size * 0.5, 0, -this.size);
        } else {
          // Soft pink lotus petal
          bgCtx.fillStyle = `rgba(244, 143, 177, ${this.alpha})`;
          bgCtx.moveTo(0, -this.size);
          bgCtx.quadraticCurveTo(this.size * 0.8, -this.size * 0.3, this.size * 0.2, this.size);
          bgCtx.quadraticCurveTo(-this.size * 0.8, -this.size * 0.3, 0, -this.size);
        }
        bgCtx.fill();
        bgCtx.restore();
      } else {
        bgCtx.save();
        if (this.type === 'petal') {
          bgCtx.translate(this.x, this.y);
          bgCtx.rotate(this.angle * Math.PI / 180);
          bgCtx.beginPath();
          if (this.deityKey === 'ganesha' || this.deityKey === 'durga') {
            // Hibiscus red petals
            bgCtx.fillStyle = `rgba(198, 40, 40, ${this.alpha * 0.7})`;
          } else {
            // Orange marigold petals for Hanuman/Rama
            bgCtx.fillStyle = `rgba(230, 81, 0, ${this.alpha * 0.7})`;
          }
          bgCtx.moveTo(0, -this.size);
          bgCtx.quadraticCurveTo(this.size * 0.8, -this.size * 0.4, 0, this.size);
          bgCtx.quadraticCurveTo(-this.size * 0.8, -this.size * 0.4, 0, -this.size);
          bgCtx.fill();
        } else {
          bgCtx.beginPath();
          const grad = bgCtx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 2);
          grad.addColorStop(0, `rgba(${rgb}, ${this.alpha})`);
          grad.addColorStop(1, `rgba(${rgb}, 0)`);
          bgCtx.fillStyle = grad;
          bgCtx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
          bgCtx.fill();
        }
        bgCtx.restore();
      }
    }
  }

  function resizeBgCanvas() {
    if (!bgCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    bgCanvas.width = window.innerWidth * dpr;
    bgCanvas.height = window.innerHeight * dpr;
    if (bgCtx) {
      bgCtx.setTransform(1, 0, 0, 1, 0, 0);
      bgCtx.scale(dpr, dpr);
    }
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
    bgCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    
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
  
  // Native audio event listeners
  nativeAudio.addEventListener('ended', () => {
    selectTrack(trackIndex + 1, true);
  });

  loadYouTubeScript();
})();
