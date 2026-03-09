/**
 * Radio Engine — Virtual Playhead System
 * Calculates where each station "should be" at any moment using a global epoch.
 */

let manifest = null;
let epoch = 0;

/**
 * Load the station manifest from JSON.
 */
export async function loadManifest() {
  const res = await fetch('./stationManifest.json');
  manifest = await res.json();
  epoch = new Date(manifest.epoch).getTime();
  // Auto-detect durations by loading audio metadata
  await Promise.all(manifest.stations.map((station, i) => detectDuration(station, i)));
  return manifest;
}

/**
 * Try to detect audio duration from metadata if the manifest value seems wrong.
 */
function detectDuration(station, index) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = station.file;

    const timeout = setTimeout(() => {
      // If metadata doesn't load in 5s, keep manifest value
      resolve();
    }, 5000);

    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout);
      if (audio.duration && isFinite(audio.duration)) {
        station.duration = audio.duration;
      }
      resolve();
    });

    audio.addEventListener('error', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

/**
 * Get the virtual playhead position (in seconds) for a given station.
 * Position = (Date.now() - epoch) % duration
 */
export function getPlayheadPosition(stationIndex) {
  if (!manifest) return 0;
  const station = manifest.stations[stationIndex];
  if (!station || !station.duration) return 0;

  const elapsed = (Date.now() - epoch) / 1000; // seconds since epoch
  return elapsed % station.duration;
}

/**
 * Get station data by index.
 */
export function getStation(index) {
  if (!manifest) return null;
  return manifest.stations[index] || null;
}

/**
 * Get total station count.
 */
export function getStationCount() {
  if (!manifest) return 0;
  return manifest.stations.length;
}

/**
 * Get the full manifest.
 */
export function getManifest() {
  return manifest;
}

/**
 * Wrap an index within station bounds.
 */
export function wrapIndex(index) {
  const count = getStationCount();
  if (count === 0) return 0;
  return ((index % count) + count) % count;
}
