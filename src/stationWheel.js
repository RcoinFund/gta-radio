/**
 * Station Wheel — GTA V-style circular station selector HUD
 * Appears during tuning, shows all stations in a ring with the active one highlighted.
 * Uses CSS transforms + custom spring animations.
 */

import { getStationCount, getStation } from './radioEngine.js';

let wheelContainer = null;
let wheelRing = null;
let hideTimer = null;
let currentRotation = 0;
let targetRotation = 0;
let animationFrame = null;
let isVisible = false;

const HIDE_DELAY = 2500;
const SPRING_STIFFNESS = 0.08;
const SPRING_DAMPING = 0.75;
let velocity = 0;

/**
 * Initialize the station wheel.
 * @param {HTMLElement} container - the wheel container element
 */
export function initWheel(container) {
  wheelContainer = container;

  // Create the ring element
  wheelRing = document.createElement('div');
  wheelRing.className = 'wheel-ring';
  wheelContainer.appendChild(wheelRing);

  buildStationNodes();
}

/**
 * Build the station label nodes around the ring.
 */
function buildStationNodes() {
  if (!wheelRing) return;
  wheelRing.innerHTML = '';

  const count = getStationCount();

  for (let i = 0; i < count; i++) {
    const station = getStation(i);

    const node = document.createElement('div');
    node.className = 'wheel-station';
    node.dataset.index = i;
    node.style.setProperty('--station-color', station.color);

    node.innerHTML = `
      <span class="wheel-station-icon">${station.icon}</span>
      <span class="wheel-station-name">${station.name}</span>
    `;

    wheelRing.appendChild(node);
  }
}

/**
 * Show the wheel and update active station.
 * @param {number} activeIndex
 */
export function showWheel(activeIndex) {
  if (!wheelContainer) return;

  // Calculate target rotation (rotate ring so active station is at top)
  const count = getStationCount();
  const angleStep = 360 / count;
  const rawTarget = -(activeIndex * angleStep);

  // Shortest path rotation logic
  let diff = (rawTarget - currentRotation) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  targetRotation = currentRotation + diff;

  // Show the wheel
  if (!isVisible) {
    wheelContainer.classList.add('is-visible');
    isVisible = true;
    currentRotation = targetRotation; // snap on first show
    applyRotation(currentRotation);
  }

  // Start spring animation
  startSpringAnimation();

  // Update active state on nodes
  const nodes = wheelRing.querySelectorAll('.wheel-station');
  nodes.forEach((node, i) => {
    node.classList.toggle('is-active', i === activeIndex);
  });

  // Reset hide timer
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    hideWheel();
  }, HIDE_DELAY);
}

/**
 * Hide the wheel with fade-out.
 */
export function hideWheel() {
  if (!wheelContainer || !isVisible) return;
  wheelContainer.classList.remove('is-visible');
  isVisible = false;
  cancelAnimationFrame(animationFrame);
}

/**
 * Spring-physics rotation animation.
 */
function startSpringAnimation() {
  cancelAnimationFrame(animationFrame);

  function tick() {
    const displacement = targetRotation - currentRotation;
    const springForce = displacement * SPRING_STIFFNESS;
    velocity = (velocity + springForce) * SPRING_DAMPING;
    currentRotation += velocity;

    applyRotation(currentRotation);

    // Stop when close enough and velocity is low
    if (Math.abs(displacement) < 0.1 && Math.abs(velocity) < 0.01) {
      currentRotation = targetRotation;
      applyRotation(currentRotation);
      return;
    }

    animationFrame = requestAnimationFrame(tick);
  }

  animationFrame = requestAnimationFrame(tick);
}

/**
 * Apply rotation transform to the ring.
 */
function applyRotation(degrees) {
  if (!wheelRing) return;

  const nodes = wheelRing.querySelectorAll('.wheel-station');
  const count = nodes.length;
  if (count === 0) return;

  const angleStep = 360 / count;
  const radius = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--wheel-size')) / 2 - 20 || 150;

  nodes.forEach((node, i) => {
    // Each station's angle = its base angle + the ring rotation
    const angleDeg = i * angleStep + degrees;
    const angleRad = angleDeg * (Math.PI / 180);

    // Position using trig — label stays horizontal (no rotate transform)
    const x = Math.cos(angleRad) * radius;
    const y = Math.sin(angleRad) * radius;

    node.style.transform = `translate(${x}px, ${y}px)`;
  });
}

/**
 * Get visibility state.
 */
export function isWheelVisible() {
  return isVisible;
}
