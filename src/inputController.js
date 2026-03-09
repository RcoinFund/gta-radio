/**
 * Unified Input Controller
 * Converts scroll, keyboard, circular drag, and media keys into
 * a single changeStation(direction) command.
 */

import { getStationCount } from './radioEngine.js';

let onChangeCallback = null;
let scrollThrottleTimer = null;
const SCROLL_THROTTLE_MS = 250;

// Circular drag state
let isDragging = false;
let dialElement = null;
let lastAngle = 0;
let accumulatedAngle = 0;

/**
 * Initialize all input listeners.
 * @param {Function} callback - called with (direction: 1|-1) on station change
 * @param {HTMLElement} dialEl - the circular dial element for drag input
 */
export function initInput(callback, dialEl) {
  onChangeCallback = callback;
  dialElement = dialEl;

  // Keyboard
  window.addEventListener('keydown', handleKeydown);

  // Scroll wheel
  window.addEventListener('wheel', handleWheel, { passive: false });

  // Circular drag
  if (dialElement) {
    dialElement.addEventListener('mousedown', handleDragStart);
    dialElement.addEventListener('touchstart', handleTouchStart, { passive: false });
  }
  window.addEventListener('mousemove', handleDragMove);
  window.addEventListener('mouseup', handleDragEnd);
  window.addEventListener('touchmove', handleTouchMove, { passive: false });
  window.addEventListener('touchend', handleDragEnd);

  // Media Session API
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      emitChange(1);
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      emitChange(-1);
    });
  }
}

/**
 * Emit a station change event.
 * @param {number} direction - 1 for next, -1 for previous
 */
function emitChange(direction) {
  if (onChangeCallback) {
    onChangeCallback(direction);
  }
}

/**
 * Handle keyboard input.
 */
function handleKeydown(e) {
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      e.preventDefault();
      emitChange(1);
      break;
    case 'ArrowLeft':
    case 'ArrowDown':
      e.preventDefault();
      emitChange(-1);
      break;
    default:
      // Number keys 1-9 → direct station preset
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && num <= getStationCount()) {
        e.preventDefault();
        // Emit as an absolute index (we'll handle this specially)
        if (onChangeCallback) {
          onChangeCallback(num - 1, true); // true = absolute index
        }
      }
      break;
  }
}

/**
 * Handle scroll wheel (throttled).
 */
function handleWheel(e) {
  e.preventDefault();

  if (scrollThrottleTimer) return;

  const direction = e.deltaY > 0 ? 1 : -1;
  emitChange(direction);

  scrollThrottleTimer = setTimeout(() => {
    scrollThrottleTimer = null;
  }, SCROLL_THROTTLE_MS);
}

/**
 * Get angle from center of the dial element.
 */
function getAngleFromCenter(clientX, clientY) {
  if (!dialElement) return 0;
  const rect = dialElement.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
}

/**
 * Handle drag start on the dial.
 */
function handleDragStart(e) {
  isDragging = true;
  lastAngle = getAngleFromCenter(e.clientX, e.clientY);
  accumulatedAngle = 0;
  dialElement.classList.add('is-dragging');
  e.preventDefault();
}

function handleTouchStart(e) {
  if (e.touches.length === 1) {
    isDragging = true;
    lastAngle = getAngleFromCenter(e.touches[0].clientX, e.touches[0].clientY);
    accumulatedAngle = 0;
    if (dialElement) dialElement.classList.add('is-dragging');
    e.preventDefault();
  }
}

/**
 * Handle drag move — calculate rotation delta.
 */
function handleDragMove(e) {
  if (!isDragging) return;

  const currentAngle = getAngleFromCenter(e.clientX, e.clientY);
  let delta = currentAngle - lastAngle;

  // Handle wraparound at ±180
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  accumulatedAngle += delta;
  lastAngle = currentAngle;

  // Step size: 360 / number of stations
  const stepSize = 360 / Math.max(1, getStationCount());

  if (Math.abs(accumulatedAngle) >= stepSize) {
    const direction = accumulatedAngle > 0 ? 1 : -1;
    emitChange(direction);
    accumulatedAngle = 0;
  }
}

function handleTouchMove(e) {
  if (!isDragging || e.touches.length !== 1) return;
  e.preventDefault();

  const touch = e.touches[0];
  const currentAngle = getAngleFromCenter(touch.clientX, touch.clientY);
  let delta = currentAngle - lastAngle;

  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  accumulatedAngle += delta;
  lastAngle = currentAngle;

  const stepSize = 360 / Math.max(1, getStationCount());
  if (Math.abs(accumulatedAngle) >= stepSize) {
    const direction = accumulatedAngle > 0 ? 1 : -1;
    emitChange(direction);
    accumulatedAngle = 0;
  }
}

/**
 * Handle drag end.
 */
function handleDragEnd() {
  isDragging = false;
  accumulatedAngle = 0;
  if (dialElement) dialElement.classList.remove('is-dragging');
}

/**
 * Clean up all event listeners.
 */
export function destroyInput() {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('wheel', handleWheel);
  window.removeEventListener('mousemove', handleDragMove);
  window.removeEventListener('mouseup', handleDragEnd);
  window.removeEventListener('touchmove', handleTouchMove);
  window.removeEventListener('touchend', handleDragEnd);

  if (dialElement) {
    dialElement.removeEventListener('mousedown', handleDragStart);
    dialElement.removeEventListener('touchstart', handleTouchStart);
  }

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('nexttrack', null);
    navigator.mediaSession.setActionHandler('previoustrack', null);
  }
}
