/**
 * Audio Recorder Module - Handles audio capture from microphone
 * Uses expo-av for React Native compatibility
 */

import { Audio } from 'expo-av';
import { AudioFrame } from './codec';

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  uri?: string;
}

export class AudioRecorder {
  private recording: Audio.Recording | null = null;
  private sound: Audio.Sound | null = null;
  private onFrameCaptured?: (frame: AudioFrame) => void;
  private recordingDuration: number = 0;

  async init(): Promise<void> {
    try {
      // Request microphone permissions
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Microphone permission denied');
      }

      // Configure audio session
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        interruptionModeIOS: Audio.InterruptionModeIOS.DuckOthers,
        playsInSilentModeIOS: true,
        interruptionModeAndroid: Audio.InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      console.log('[AudioRecorder] Initialized');
    } catch (err) {
      console.error('[AudioRecorder] Initialization failed:', err);
      throw err;
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(): Promise<void> {
    try {
      if (this.recording) {
        await this.stopRecording();
      }

      // Create new recording
      this.recording = new Audio.Recording();

      await this.recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      await this.recording.startAsync();
      this.recordingDuration = 0;

      console.log('[AudioRecorder] Recording started');
    } catch (err) {
      console.error('[AudioRecorder] Failed to start recording:', err);
      throw err;
    }
  }

  /**
   * Stop recording and return audio file URI
   */
  async stopRecording(): Promise<string | null> {
    try {
      if (!this.recording) {
        return null;
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();

      this.recording = null;
      this.recordingDuration = 0;

      console.log('[AudioRecorder] Recording stopped:', uri);
      return uri;
    } catch (err) {
      console.error('[AudioRecorder] Failed to stop recording:', err);
      throw err;
    }
  }

  /**
   * Get current recording state
   */
  getRecordingState(): RecordingState {
    if (!this.recording) {
      return {
        isRecording: false,
        duration: 0,
      };
    }

    return {
      isRecording: this.recording._isDoneRecording === false,
      duration: this.recordingDuration,
      uri: this.recording.getURI(),
    };
  }

  /**
   * Callback when audio frame is captured (for real-time compression)
   */
  onFrameCaptured(callback: (frame: AudioFrame) => void): void {
    this.onFrameCaptured = callback;
  }
}

/**
 * Audio Playback Module - Handles audio playback to speaker
 */
export class AudioPlayback {
  private sound: Audio.Sound | null = null;
  private isPlaying: boolean = false;

  async init(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        interruptionModeIOS: Audio.InterruptionModeIOS.DuckOthers,
        playsInSilentModeIOS: true,
        interruptionModeAndroid: Audio.InterruptionModeAndroid.DuckOthers,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      console.log('[AudioPlayback] Initialized');
    } catch (err) {
      console.error('[AudioPlayback] Initialization failed:', err);
      throw err;
    }
  }

  /**
   * Load and play audio from URI
   */
  async playAudio(uri: string): Promise<void> {
    try {
      // Unload previous sound
      if (this.sound) {
        await this.sound.unloadAsync();
      }

      // Load new sound
      const { sound } = await Audio.Sound.createAsync({ uri });
      this.sound = sound;

      // Play it
      await this.sound.playAsync();
      this.isPlaying = true;

      console.log('[AudioPlayback] Playing:', uri);

      // Track when playback finishes
      this.sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          this.isPlaying = false;
          console.log('[AudioPlayback] Finished');
        }
      });
    } catch (err) {
      console.error('[AudioPlayback] Failed to play audio:', err);
      throw err;
    }
  }

  /**
   * Pause playback
   */
  async pausePlayback(): Promise<void> {
    if (this.sound && this.isPlaying) {
      await this.sound.pauseAsync();
      this.isPlaying = false;
      console.log('[AudioPlayback] Paused');
    }
  }

  /**
   * Resume playback
   */
  async resumePlayback(): Promise<void> {
    if (this.sound && !this.isPlaying) {
      await this.sound.playAsync();
      this.isPlaying = true;
      console.log('[AudioPlayback] Resumed');
    }
  }

  /**
   * Stop playback
   */
  async stopPlayback(): Promise<void> {
    if (this.sound) {
      await this.sound.stopAsync();
      this.isPlaying = false;
      console.log('[AudioPlayback] Stopped');
    }
  }

  /**
   * Unload sound (cleanup)
   */
  async cleanup(): Promise<void> {
    if (this.sound) {
      await this.sound.unloadAsync();
      this.sound = null;
      this.isPlaying = false;
    }
  }

  /**
   * Check if audio is playing
   */
  isAudioPlaying(): boolean {
    return this.isPlaying;
  }
}
