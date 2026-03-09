/**
 * Now Playing Card — GTA V-style slide-in notification
 * Shows station name, track, genre, and a color accent.
 */

import { getStation } from './radioEngine.js';

let cardElement = null;
let dismissTimer = null;
const DISMISS_DELAY = 4000;

/**
 * Initialize the Now Playing card.
 * @param {HTMLElement} element - the card DOM element
 */
export function initNowPlaying(element) {
  cardElement = element;
}

/**
 * Show the Now Playing card for a station.
 * @param {number} stationIndex
 */
export function showNowPlaying(stationIndex) {
  const station = getStation(stationIndex);
  if (!station || !cardElement) return;

  // Update content
  cardElement.querySelector('.np-icon').textContent = station.icon;
  cardElement.querySelector('.np-station-name').textContent = station.name;
  cardElement.querySelector('.np-track-name').textContent = station.track;
  cardElement.querySelector('.np-genre').textContent = station.genre;
  cardElement.style.setProperty('--accent-color', station.color);

  // Trigger slide-in
  cardElement.classList.remove('is-visible');
  // Force reflow to restart animation
  void cardElement.offsetWidth;
  cardElement.classList.add('is-visible');

  // Auto-dismiss
  clearTimeout(dismissTimer);
  dismissTimer = setTimeout(() => {
    cardElement.classList.remove('is-visible');
  }, DISMISS_DELAY);
}

/**
 * Hide the card immediately.
 */
export function hideNowPlaying() {
  if (cardElement) {
    cardElement.classList.remove('is-visible');
    clearTimeout(dismissTimer);
  }
}
