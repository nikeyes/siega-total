import { Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { createBurstView } from '../../src/render/burst';

const LIFETIME = 0.5;

function landedPieces() {
  const landed: Array<{ x: number; z: number }> = [];
  const view = createBurstView(new Scene(), { poolSize: 8, lifetimeSeconds: LIFETIME, onExpire: (x, z) => landed.push({ x, z }) });
  return { view, landed };
}

describe('createBurstView', () => {
  it('lands every thrown piece once its lifetime is over', () => {
    const { view, landed } = landedPieces();
    view.spawn(1, 2, 0x00ff00, 3);
    view.update(LIFETIME);
    expect(landed).toHaveLength(3);
  });

  it('lands nothing that was in the air when it was cleared', () => {
    const { view, landed } = landedPieces();
    view.spawn(1, 2, 0x00ff00, 3);
    view.update(LIFETIME / 2);
    view.clear();
    view.update(LIFETIME);
    expect(landed).toHaveLength(0);
  });

  it('throws and lands new pieces after being cleared', () => {
    const { view, landed } = landedPieces();
    view.spawn(1, 2, 0x00ff00, 3);
    view.clear();
    view.spawn(4, 5, 0x00ff00, 2);
    view.update(LIFETIME);
    expect(landed).toHaveLength(2);
  });
});
