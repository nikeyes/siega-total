import type { Direction } from '../logic/blade';
import { joystickDirection } from '../logic/input';

/** How far the knob can travel from the touch origin. */
const KNOB_MAX_DISTANCE_PX = 50;

export interface Joystick {
  getDirection(): Direction | null;
}

/** A floating joystick that appears where the first pointer touches the container. */
export function createJoystick(container: HTMLElement): Joystick {
  const base = document.createElement('div');
  base.className = 'joystick-base';
  const knob = document.createElement('div');
  knob.className = 'joystick-knob';
  base.appendChild(knob);
  container.appendChild(base);

  let activePointerId: number | null = null;
  let originX = 0;
  let originY = 0;
  let currentX = 0;
  let currentY = 0;

  container.addEventListener('pointerdown', (event) => {
    if (activePointerId !== null) return;
    activePointerId = event.pointerId;
    originX = currentX = event.clientX;
    originY = currentY = event.clientY;
    base.style.left = `${originX}px`;
    base.style.top = `${originY}px`;
    moveKnob();
    base.classList.add('visible');
    // Last, so the joystick state is complete even if the browser refuses the capture.
    container.setPointerCapture(event.pointerId);
  });

  container.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointerId) return;
    currentX = event.clientX;
    currentY = event.clientY;
    moveKnob();
  });

  function release(event: PointerEvent): void {
    if (event.pointerId !== activePointerId) return;
    activePointerId = null;
    base.classList.remove('visible');
  }
  container.addEventListener('pointerup', release);
  container.addEventListener('pointercancel', release);

  function moveKnob(): void {
    const dx = currentX - originX;
    const dy = currentY - originY;
    const distance = Math.hypot(dx, dy);
    const limit = distance > KNOB_MAX_DISTANCE_PX ? KNOB_MAX_DISTANCE_PX / distance : 1;
    knob.style.transform = `translate(${dx * limit}px, ${dy * limit}px)`;
  }

  function getDirection(): Direction | null {
    if (activePointerId === null) return null;
    return joystickDirection(originX, originY, currentX, currentY);
  }

  return { getDirection };
}
