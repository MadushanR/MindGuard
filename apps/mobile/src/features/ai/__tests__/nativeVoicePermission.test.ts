import { AudioManager } from "react-native-audio-api";
import { VoiceAudio } from "../live/VoiceAudio";

jest.mock("react-native-audio-api", () => ({
  AudioManager: {
    checkRecordingPermissions: jest.fn(),
    requestRecordingPermissions: jest.fn(),
  },
}));

beforeEach(() => jest.resetAllMocks());

test("an existing microphone grant never reopens the Android permission activity", async () => {
  jest.mocked(AudioManager.checkRecordingPermissions).mockResolvedValue("Granted");
  expect(await new VoiceAudio().requestPermission()).toBe(true);
  expect(AudioManager.requestRecordingPermissions).not.toHaveBeenCalled();
});

test("a missing grant requests permission and honors the OS result", async () => {
  jest.mocked(AudioManager.checkRecordingPermissions).mockResolvedValue("Undetermined");
  jest.mocked(AudioManager.requestRecordingPermissions).mockResolvedValueOnce("Denied").mockResolvedValueOnce("Granted");
  const audio = new VoiceAudio();
  expect(await audio.requestPermission()).toBe(false);
  expect(await audio.requestPermission()).toBe(true);
});
