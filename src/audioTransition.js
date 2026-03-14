/**
 * Audio Transition Layer
 * Manages station switching with static burst, crossfade, and volume ramping.
 * Uses Web Audio API for precise gain control and programmatic static generation.
 */

import { getPlayheadPosition, getStation } from './radioEngine.js';

let audioCtx = null;
let mainAudio = null;         // The <audio> element for music
let mainSource = null;        // MediaElementSourceNode
let mainGain = null;          // GainNode for smooth fading
let staticBuffer = null;      // Pre-generated static burst buffer
let isTransitioning = false;
let currentStationIndex = -1;
let userVolume = 1.0;          // Persisted user volume setting

/**
 * Initialize the audio system. Must be called from a user gesture.
 */
export function initAudio() {
  if (audioCtx) return audioCtx;

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Create the main audio element
  mainAudio = new Audio();
  mainAudio.crossOrigin = 'anonymous';
  mainAudio.preload = 'auto';
  mainAudio.loop = true;

  // Connect through Web Audio API gain node
  mainSource = audioCtx.createMediaElementSource(mainAudio);
  mainGain = audioCtx.createGain();
  mainGain.gain.value = 0;

  mainSource.connect(mainGain);
  mainGain.connect(audioCtx.destination);

  // Pre-generate static burst
  staticBuffer = generateStaticBurst(0.35);

  return audioCtx;
}

/**
 * Resume audio context (must be called from user gesture to bypass autoplay).
 */
export async function resumeAudioContext() {
  if (audioCtx && audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
}

/**
 * Set the user's desired radio volume (0 to 1).
 */
export function setVolume(value) {
  userVolume = Math.max(0, Math.min(1, value));
  if (mainGain) {
    const now = audioCtx.currentTime;
    mainGain.gain.cancelScheduledValues(now);
    mainGain.gain.setTargetAtTime(userVolume, now, 0.05);
  }
}

/**
 * Get the current volume level.
 */
export function getVolume() {
  return userVolume;
}

/**
 * Generate a white-noise static burst buffer.
 * @param {number} durationSecs
 * @returns {AudioBuffer}
 */
function generateStaticBurst(durationSecs) {
  const sampleRate = audioCtx.sampleRate;
  const length = Math.floor(sampleRate * durationSecs);
  const buffer = audioCtx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    // White noise with amplitude envelope (quick attack, quick decay)
    const envelope = Math.min(1, i / (sampleRate * 0.01)) *
                     Math.min(1, (length - i) / (sampleRate * 0.05));
    data[i] = (Math.random() * 2 - 1) * 0.7 * envelope;
  }

  return buffer;
}

/**
 * Play the static burst sound effect.
 * @returns {Promise} resolves when the static finishes.
 */
function playStaticBurst() {
  return new Promise((resolve) => {
    if (!staticBuffer || !audioCtx) {
      resolve();
      return;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = staticBuffer;

    // Bandpass filter to make it sound like radio static
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.5;

    const staticGain = audioCtx.createGain();
    staticGain.gain.value = 0.8;

    source.connect(filter);
    filter.connect(staticGain);
    staticGain.connect(audioCtx.destination);

    source.onended = resolve;
    source.start(0);
  });
}

/**
 * Smoothly ramp gain to a target value.
 * @param {GainNode} gainNode
 * @param {number} targetValue
 * @param {number} durationMs
 * @returns {Promise}
 */
function rampGain(gainNode, targetValue, durationMs) {
  return new Promise((resolve) => {
    const now = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(gainNode.gain.value, now);
    gainNode.gain.linearRampToValueAtTime(targetValue, now + durationMs / 1000);
    setTimeout(resolve, durationMs);
  });
}

/**
 * Change to a new station with static burst transition.
 * @param {number} newIndex - station index
 * @param {boolean} instant - skip animation (for initial play)
 * @returns {Promise<boolean>} true if successful
 */
export async function changeStation(newIndex, instant = false) {
  if (!audioCtx || isTransitioning) return false;
  if (newIndex === currentStationIndex) return false;

  const station = getStation(newIndex);
  if (!station) return false;

  isTransitioning = true;

  try {
    await resumeAudioContext();

    if (!instant) {
      // Fade out current audio quickly
      await rampGain(mainGain, 0, 60);

      // Play static burst
      await playStaticBurst();
    }

    // Pause and swap source
    mainAudio.pause();
    mainAudio.src = station.file;
    mainAudio.load();

    // Seek to virtual playhead position
    const position = getPlayheadPosition(newIndex);

    await new Promise((resolve, reject) => {
      const onCanPlay = () => {
        mainAudio.removeEventListener('canplay', onCanPlay);
        mainAudio.removeEventListener('error', onError);

        // Seek to computed playhead
        try {
          mainAudio.currentTime = position;
        } catch (e) {
          // Some browsers may throw if seeking before fully loaded
          console.warn('Seek failed, starting from current position:', e);
        }
        resolve();
      };

      const onError = (e) => {
        mainAudio.removeEventListener('canplay', onCanPlay);
        mainAudio.removeEventListener('error', onError);
        reject(e);
      };

      mainAudio.addEventListener('canplay', onCanPlay);
      mainAudio.addEventListener('error', onError);
    });

    // Play and fade in
    await mainAudio.play();
    currentStationIndex = newIndex;

    // Fade in volume
    const fadeTime = instant ? 100 : 400;
    await rampGain(mainGain, userVolume, fadeTime);

    return true;
  } catch (err) {
    console.error('Station change failed:', err);
    return false;
  } finally {
    isTransitioning = false;
  }
}

/**
 * Get the current station index.
 */
export function getCurrentStationIndex() {
  return currentStationIndex;
}

/**
 * Is a transition currently in progress?
 */
export function isInTransition() {
  return isTransitioning;
}

/**
 * Get the main audio element (for media session metadata, etc.)
 */
export function getAudioElement() {
  return mainAudio;
}
