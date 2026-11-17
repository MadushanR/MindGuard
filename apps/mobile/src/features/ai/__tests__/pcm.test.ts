import { decodePcm16, encodePcm16, SpeechActivity } from "../live/pcm";

test("PCM frames use signed little-endian 16-bit samples and saturate safely", () => {
  const encoded = encodePcm16(new Float32Array([-2, -1, 0, 1, 2]));
  expect(encoded).toBe("AIAAgAAA/3//fw==");
  const decoded = decodePcm16(encoded);
  expect(decoded[0]).toBe(-1);
  expect(decoded[2]).toBe(0);
  expect(decoded[3]).toBeCloseTo(1, 4);
});
test("malformed and incomplete approved audio never reaches a playback buffer", () => {
  for (const value of ["", "?abc", "AAA", "AA==", "AAA==="]) {
    expect(() => decodePcm16(value)).toThrow("INVALID_APPROVED_AUDIO");
  }
});
test("local speech activity needs sustained signal and resets after silence", () => {
  const detector = new SpeechActivity();
  const speech = new Float32Array(2400).fill(0.1);
  expect(detector.accept(speech)).toBe(false);
  expect(detector.accept(speech)).toBe(true);
  expect(detector.accept(speech)).toBe(false);
  expect(detector.accept(new Float32Array(2400))).toBe(false);
  expect(detector.accept(speech)).toBe(false);
  expect(detector.accept(speech)).toBe(true);
});
