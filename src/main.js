/**
 * Main Entry Point — GTA Radio Web App
 * Wires all modules together: engine, audio, input, and UI.
 */

import { loadManifest, getStation, getStationCount, wrapIndex } from './radioEngine.js';
import { initAudio, changeStation, getCurrentStationIndex, resumeAudioContext, setVolume, getVolume } from './audioTransition.js';
import { initInput } from './inputController.js';
import { initWheel, showWheel } from './stationWheel.js';
import { initNowPlaying, showNowPlaying } from './nowPlaying.js';

let currentIndex = 0;

async function boot() {
  // Show loading state
  const overlay = document.getElementById('start-overlay');
  const overlayText = overlay.querySelector('.overlay-text');
  overlayText.textContent = 'Loading stations...';

  // Load station manifest
  try {
    await loadManifest();
  } catch (err) {
    overlayText.textContent = 'Failed to load stations. Please refresh.';
    console.error('Manifest load error:', err);
    return;
  }

  overlayText.textContent = 'Click anywhere to start';
  overlay.classList.add('is-ready');

  // Initialize UI components (before audio, so they're ready)
  const wheelContainer = document.getElementById('station-wheel');
  const nowPlayingCard = document.getElementById('now-playing');
  const dialElement = document.getElementById('dial-area');

  initWheel(wheelContainer);
  initNowPlaying(nowPlayingCard);

  // Update background station list
  buildStationList();

  // Wait for user click to init audio (autoplay policy bypass)
  overlay.addEventListener('click', handleFirstInteraction, { once: true });
  overlay.addEventListener('touchend', handleFirstInteraction, { once: true });
}

async function handleFirstInteraction() {
  const overlay = document.getElementById('start-overlay');

  // Init audio context (must happen in user gesture)
  initAudio();
  await resumeAudioContext();

  // Hide overlay
  overlay.classList.add('is-hidden');

  // Init input controller
  const dialElement = document.getElementById('dial-area');
  initInput(handleStationChange, dialElement);

  // Init volume slider
  initVolumeControl();

  // Play first station
  currentIndex = 0;
  await tuneToStation(currentIndex, true);

  // Set up the background animation
  updateBackground(currentIndex);
}

/**
 * Initialize the volume control UI and link it to the audio engine.
 */
function initVolumeControl() {
  const slider = document.getElementById('volume-slider');
  if (!slider) return;

  // Set initial value from engine
  slider.value = getVolume();
  updateSliderProgress(slider);

  slider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    updateSliderProgress(slider);
  });

  // Handle active class for opacity while dragging
  slider.addEventListener('mousedown', () => slider.parentElement.classList.add('is-active'));
  slider.addEventListener('mouseup', () => slider.parentElement.classList.remove('is-active'));
  slider.addEventListener('touchstart', () => slider.parentElement.classList.add('is-active'));
  slider.addEventListener('touchend', () => slider.parentElement.classList.remove('is-active'));
}

/**
 * Update the CSS variable for the custom slider track progress appearance.
 */
function updateSliderProgress(slider) {
  const percent = slider.value * 100;
  slider.style.setProperty('--volume-percent', `${percent}%`);
}

/**
 * Handle input controller station change events.
 * @param {number} directionOrIndex
 * @param {boolean} isAbsolute - if true, directionOrIndex is an absolute station index
 */
async function handleStationChange(directionOrIndex, isAbsolute = false) {
  let newIndex;
  if (isAbsolute) {
    newIndex = directionOrIndex;
  } else {
    newIndex = wrapIndex(currentIndex + directionOrIndex);
  }

  if (newIndex === currentIndex) return;

  currentIndex = newIndex;
  await tuneToStation(currentIndex, false);
}

/**
 * Tune to a station: update audio, wheel, now-playing, and background.
 */
async function tuneToStation(index, instant) {
  // Show wheel immediately
  showWheel(index);

  // Start audio transition
  const success = await changeStation(index, instant);

  if (success) {
    // Show now playing card
    showNowPlaying(index);

    // Update media session metadata
    updateMediaSession(index);

    // Update background color
    updateBackground(index);

    // Update station list active state
    updateStationListActive(index);
  }
}

/**
 * Update navigator.mediaSession metadata for OS-level media controls.
 */
function updateMediaSession(index) {
  if (!('mediaSession' in navigator)) return;

  const station = getStation(index);
  if (!station) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: station.track,
    artist: station.name,
    album: 'GTA Radio',
  });
}

/**
 * Update the background gradient to match the station's theme color.
 */
function updateBackground(index) {
  const station = getStation(index);
  if (!station) return;

  const bg = document.getElementById('app-background');
  if (bg) {
    bg.style.setProperty('--active-color', station.color);
  }
}

/**
 * Build the ambient station list in the background.
 */
function buildStationList() {
  const list = document.getElementById('station-list');
  if (!list) return;
  list.innerHTML = '';

  const count = getStationCount();
  for (let i = 0; i < count; i++) {
    const station = getStation(i);
    const item = document.createElement('div');
    item.className = 'station-list-item';
    item.dataset.index = i;
    item.innerHTML = `
      <span class="sl-icon">${station.icon}</span>
      <div class="sl-info">
        <span class="sl-name">${station.name}</span>
        <span class="sl-track">${station.track}</span>
      </div>
    `;
    item.addEventListener('click', () => {
      handleStationChange(i, true);
    });
    list.appendChild(item);
  }
}

/**
 * Highlight the active station in the list.
 */
function updateStationListActive(index) {
  const items = document.querySelectorAll('.station-list-item');
  items.forEach((item, i) => {
    item.classList.toggle('is-active', i === index);
  });
}

// Boot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
