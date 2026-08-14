(function () {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const toastEl = byId('toast');
  let toastTimer;

  function toast(message, delay = 3200) {
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), delay);
  }

  // Load custom songs from local storage
  let customSongs = [];
  try {
    const saved = localStorage.getItem('bhakti-custom-songs');
    if (saved) customSongs = JSON.parse(saved);
  } catch (_) {}

  // Load deleted song IDs from local storage
  let deletedSongIds = [];
  try {
    const savedDeleted = localStorage.getItem('bhakti-deleted-songs');
    if (savedDeleted) deletedSongIds = JSON.parse(savedDeleted);
  } catch (_) {}

  // Helper to extract YouTube video ID
  function getYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url.trim();
  }

  const customSongsList = byId('customSongsList');
  const addSongForm = byId('addSongForm');
  const songDeitySelect = byId('songDeity');

  // Render list of all songs for the selected deity
  function renderSongsList() {
    customSongsList.innerHTML = '';
    const selectedDeityKey = songDeitySelect.value;
    
    // Find deity in default data
    const defaultDeity = window.DEITY_DATA.find(d => d.key === selectedDeityKey);
    const defaultTracks = defaultDeity ? defaultDeity.tracks : [];
    
    // Get custom tracks for this deity
    const customTracks = customSongs.filter(s => s.deityKey === selectedDeityKey);
    
    // Filter active default tracks
    const activeDefaultTracks = defaultTracks.filter(t => !deletedSongIds.includes(t.id));
    
    if (activeDefaultTracks.length === 0 && customTracks.length === 0) {
      customSongsList.innerHTML = '<p style="font-size: 11px; color: var(--muted); text-align: center; margin: 15px 0;">No songs in this deity\'s playlist.</p>';
      return;
    }

    // Render active default songs
    activeDefaultTracks.forEach(song => {
      const item = document.createElement('div');
      item.className = 'custom-song-item';
      item.innerHTML = `
        <div class="custom-song-info">
          <b>${song.shortName} <span style="font-weight: 400; font-size: 10px; opacity: 0.8;">(${song.type})</span></b>
          <small style="color: var(--muted); font-size: 9px; font-weight: 600; text-transform: uppercase;">Default Song</small>
        </div>
        <button type="button" class="custom-song-delete-btn" aria-label="Delete song">×</button>
      `;
      item.querySelector('.custom-song-delete-btn').addEventListener('click', () => {
        deleteDefaultSong(song.id);
      });
      customSongsList.appendChild(item);
    });

    // Render custom songs
    customTracks.forEach(song => {
      const item = document.createElement('div');
      item.className = 'custom-song-item';
      item.style.borderColor = 'rgba(var(--accent-rgb), 0.3)';
      item.innerHTML = `
        <div class="custom-song-info">
          <b>${song.shortName} <span style="font-weight: 400; font-size: 10px; opacity: 0.8;">(${song.type})</span></b>
          <small style="color: var(--accent); font-size: 9px; font-weight: 600; text-transform: uppercase;">Custom Added</small>
        </div>
        <button type="button" class="custom-song-delete-btn" aria-label="Delete song">×</button>
      `;
      item.querySelector('.custom-song-delete-btn').addEventListener('click', () => {
        deleteCustomSong(song.id);
      });
      customSongsList.appendChild(item);
    });
  }

  // Delete default song (add to deleted list)
  function deleteDefaultSong(id) {
    if (!deletedSongIds.includes(id)) {
      deletedSongIds.push(id);
      try {
        localStorage.setItem('bhakti-deleted-songs', JSON.stringify(deletedSongIds));
      } catch (_) {}
      renderSongsList();
      toast('Default song removed from playlist!');
    }
  }

  // Delete custom song
  function deleteCustomSong(id) {
    customSongs = customSongs.filter(s => s.id !== id);
    try {
      localStorage.setItem('bhakti-custom-songs', JSON.stringify(customSongs));
    } catch (_) {}
    renderSongsList();
    toast('Custom song deleted!');
  }

  // Listen to deity selection change to reload list
  songDeitySelect.addEventListener('change', renderSongsList);

  // Add song form handler
  addSongForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const deityKey = songDeitySelect.value;
    const rawUrl = byId('songUrl').value;
    const rawTitle = byId('songTitle').value.trim();
    const rawType = byId('songType').value.trim();
    const rawShortName = byId('songShortName').value.trim();
    const rawSubline = byId('songSubline').value.trim();
    const rawLead = byId('songLead').value.trim();

    // Fallbacks
    const type = rawType || 'Bhajan';
    const title = rawTitle || `Devotional ${type}`;
    const shortName = rawShortName || title.split('·')[0].split('-')[0].trim();
    const subline = rawSubline || 'Devotional Melody';
    const lead = rawLead || `${shortName} is a beautiful ${type} dedicated to Lord ${deityKey.toUpperCase()}.`;

    const id = getYouTubeId(rawUrl);
    if (!id || id.length !== 11) {
      toast('Invalid YouTube Link/ID!');
      return;
    }

    if (customSongs.some(s => s.id === id)) {
      toast('This song is already in your custom list!');
      return;
    }

    // If it was previously a deleted default song, undelete it!
    if (deletedSongIds.includes(id)) {
      deletedSongIds = deletedSongIds.filter(val => val !== id);
      try {
        localStorage.setItem('bhakti-deleted-songs', JSON.stringify(deletedSongIds));
      } catch (_) {}
      addSongForm.reset();
      renderSongsList();
      toast('Default song restored!');
      return;
    }

    const newTrack = {
      deityKey,
      id,
      title,
      shortName,
      type,
      subline,
      lead,
      quality: 'Peaceful, Devotional',
      note: 'Manually added by devotee.'
    };

    customSongs.push(newTrack);
    try {
      localStorage.setItem('bhakti-custom-songs', JSON.stringify(customSongs));
    } catch (_) {}

    addSongForm.reset();
    renderSongsList();
    toast('Song added successfully!');
  });

  // Initial render
  renderSongsList();
})();
