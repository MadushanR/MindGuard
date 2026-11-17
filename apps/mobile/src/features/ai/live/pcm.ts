const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function encodePcm16(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    result += alphabet[(n >>> 18) & 63] + alphabet[(n >>> 12) & 63] +
      (i + 1 < bytes.length ? alphabet[(n >>> 6) & 63] : "=") +
      (i + 2 < bytes.length ? alphabet[n & 63] : "=");
  }
  return result;
}

export function decodePcm16(value: string): Float32Array<ArrayBuffer> {
  if (!value.length || value.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value))
    throw new Error("INVALID_APPROVED_AUDIO");
  const length = value.length / 4 * 3 - (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
  if (length % 2 || length > 1440000) throw new Error("INVALID_APPROVED_AUDIO");
  const bytes = new Uint8Array(length);
  for (let i = 0, offset = 0; i < value.length; i += 4) {
    const n = (alphabet.indexOf(value[i]) << 18) | (alphabet.indexOf(value[i + 1]) << 12) |
      (Math.max(0, alphabet.indexOf(value[i + 2])) << 6) | Math.max(0, alphabet.indexOf(value[i + 3]));
    if (offset < length) bytes[offset++] = (n >>> 16) & 255;
    if (offset < length) bytes[offset++] = (n >>> 8) & 255;
    if (offset < length) bytes[offset++] = n & 255;
  }
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(length / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return samples;
}

/** Local interruption aid only; this never authorizes generation or safety routing. */
export class SpeechActivity {
  private activeFrames = 0;
  private speaking = false;
  accept(samples: Float32Array): boolean {
    let energy = 0;
    for (const sample of samples) energy += sample * sample;
    const loud = Math.sqrt(energy / Math.max(1, samples.length)) > 0.035;
    this.activeFrames = loud ? this.activeFrames + 1 : 0;
    if (!loud) this.speaking = false;
    if (this.activeFrames >= 2 && !this.speaking) {
      this.speaking = true;
      return true;
    }
    return false;
  }
}
