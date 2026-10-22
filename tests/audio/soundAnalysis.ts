import { bandPass, highPass } from '../../src/audio/filters';

export const SAMPLE_RATE = 44_100;

export const rms = (samples: ArrayLike<number>) =>
  Math.sqrt(Array.from(samples).reduce((sum, sample) => sum + sample * sample, 0) / samples.length);

const energy = (samples: Float32Array) => samples.reduce((sum, sample) => sum + sample * sample, 0);

export const seconds = (samples: Float32Array) => samples.length / SAMPLE_RATE;

/** When the 10 ms slice with the most energy starts, in seconds. */
export function envelopePeakSeconds(samples: Float32Array): number {
  const slice = SAMPLE_RATE / 100;
  let loudest = 0;
  let loudestLevel = -1;
  for (let start = 0; start + slice <= samples.length; start += slice) {
    const level = rms(samples.subarray(start, start + slice));
    if (level > loudestLevel) {
      loudest = start;
      loudestLevel = level;
    }
  }
  return loudest / SAMPLE_RATE;
}

/** Share of the sound's energy between `lowHz` and `highHz`. */
export function bandShare(samples: Float32Array, lowHz: number, highHz: number): number {
  return energy(bandPass(samples, SAMPLE_RATE, lowHz, highHz)) / energy(samples);
}

/** Share of the sound's energy above `cornerHz`. */
export function shareAbove(samples: Float32Array, cornerHz: number): number {
  return energy(highPass(samples, SAMPLE_RATE, cornerHz)) / energy(samples);
}

/** Which of `candidates` (in Hz) is loudest in `samples`, each measured as one DFT bin at that frequency. */
export function loudestOf(samples: Float32Array, candidates: readonly number[]): number {
  const strength = (hz: number) => {
    let real = 0;
    let imaginary = 0;
    samples.forEach((sample, i) => {
      const angle = (2 * Math.PI * hz * i) / SAMPLE_RATE;
      real += sample * Math.cos(angle);
      imaginary += sample * Math.sin(angle);
    });
    return Math.hypot(real, imaginary);
  };
  const strengths = candidates.map(strength);
  return candidates[strengths.indexOf(Math.max(...strengths))]!;
}
