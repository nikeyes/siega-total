/** Keeps the band between `lowHz` and `highHz` evenly loud: a Butterworth high-pass, then a Butterworth low-pass. */
export function bandPass(samples: Float32Array, sampleRate: number, lowHz: number, highHz: number): Float32Array {
  return butterworth(butterworth(samples, sampleRate, lowHz, 'highpass'), sampleRate, highHz, 'lowpass');
}

/** A biquad with Q = 1/√2, from the Audio EQ Cookbook. */
function butterworth(input: Float32Array, sampleRate: number, cornerHz: number, type: 'highpass' | 'lowpass'): Float32Array {
  const omega = (2 * Math.PI * cornerHz) / sampleRate;
  const cos = Math.cos(omega);
  const alpha = Math.sin(omega) / Math.SQRT2;
  const a0 = 1 + alpha;
  const b0 = (type === 'lowpass' ? 1 - cos : 1 + cos) / 2 / a0;
  const [b1, b2, a1, a2] = [type === 'lowpass' ? 2 * b0 : -2 * b0, b0, (-2 * cos) / a0, (1 - alpha) / a0];
  const output = new Float32Array(input.length);
  let [x1, x2, y1, y2] = [0, 0, 0, 0];
  for (let i = 0; i < input.length; i++) {
    const y = b0 * input[i]! + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    [x2, x1, y2, y1] = [x1, input[i]!, y1, y];
    output[i] = y;
  }
  return output;
}

/** Keeps what is below `cornerHz`: a Butterworth low-pass. */
export function lowPass(samples: Float32Array, sampleRate: number, cornerHz: number): Float32Array {
  return butterworth(samples, sampleRate, cornerHz, 'lowpass');
}

/** Keeps what is above `cornerHz`: a Butterworth high-pass. */
export function highPass(samples: Float32Array, sampleRate: number, cornerHz: number): Float32Array {
  return butterworth(samples, sampleRate, cornerHz, 'highpass');
}
