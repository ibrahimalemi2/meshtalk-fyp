/**
 * Audio Module - Public API
 * Audio codec, recording, playback, and chunking implementation
 * Only public methods and types exposed
 */

import { AudioCodec, AudioFrame, CompressedAudioFrame } from './codec';
import { AudioRecorder, AudioPlayback } from './playback';

export interface AudioChunk {
  fragmentIndex: number;
  totalFragments: number;
  payload: string; // Base64 encoded audio bytes
  sequenceNumber: number;
}

interface AudioAPI {
  // Lifecycle
  init: () => Promise<void>;
  cleanup: () => Promise<void>;

  // Recording
  startRecording: () => Promise<string>; // Returns recording session ID
  stopRecording: (sessionId: string) => Promise<Uint8Array>; // Returns compressed audio
  cancelRecording: (sessionId: string) => Promise<void>;

  // Playback
  startPlayback: (audioData: Uint8Array) => Promise<void>;
  stopPlayback: () => Promise<void>;
  pausePlayback: () => Promise<void>;
  resumePlayback: () => Promise<void>;
  isPlaying: () => boolean;

  // Chunking (for network transmission)
  chunkAudio: (audioData: Uint8Array, maxChunkSize?: number) => Promise<AudioChunk[]>;
  reassembleAudio: (chunks: AudioChunk[]) => Promise<Uint8Array>;

  // Streaming reception
  onAudioChunkReceived: (callback: (chunk: AudioChunk) => void) => { remove: () => void };
}

class AudioModule implements AudioAPI {
  private recorder: AudioRecorder = new AudioRecorder();
  private playback: AudioPlayback = new AudioPlayback();
  private activeSessions: Map<string, { audioData: Uint8Array; startTime: number }> =
    new Map();
  private audioChunkCallbacks: Set<(chunk: AudioChunk) => void> = new Set();
  private frameSequenceNumber: number = 0;

  async init(): Promise<void> {
    await this.recorder.init();
    await this.playback.init();
    console.log('[Audio] Initialized');
  }

  async cleanup(): Promise<void> {
    await this.stopPlayback();
    await this.playback.cleanup();
    console.log('[Audio] Cleaned up');
  }

  async startRecording(): Promise<string> {
    const sessionId = `audio-${Date.now()}`;
    try {
      await this.recorder.startRecording();
      this.activeSessions.set(sessionId, {
        audioData: new Uint8Array(),
        startTime: Date.now(),
      });
      console.log(`[Audio] Recording session started: ${sessionId}`);
      return sessionId;
    } catch (err) {
      console.error('[Audio] Failed to start recording:', err);
      throw err;
    }
  }

  async stopRecording(sessionId: string): Promise<Uint8Array> {
    try {
      const uri = await this.recorder.stopRecording();
      if (!uri) {
        throw new Error('No audio recorded');
      }

      // In production, would read the file and compress
      // For now, return empty array (actual implementation requires file system access)
      this.activeSessions.delete(sessionId);

      console.log(`[Audio] Recording session stopped: ${sessionId}`);
      return new Uint8Array();
    } catch (err) {
      console.error('[Audio] Failed to stop recording:', err);
      throw err;
    }
  }

  async cancelRecording(sessionId: string): Promise<void> {
    await this.recorder.stopRecording();
    this.activeSessions.delete(sessionId);
    console.log(`[Audio] Recording session cancelled: ${sessionId}`);
  }

  async startPlayback(audioData: Uint8Array): Promise<void> {
    try {
      // In production, would decode compressed audio first
      // For now, just mark as playing
      console.log(`[Audio] Starting playback (${audioData.length} bytes)`);
    } catch (err) {
      console.error('[Audio] Failed to start playback:', err);
      throw err;
    }
  }

  async stopPlayback(): Promise<void> {
    try {
      await this.playback.stopPlayback();
      console.log(`[Audio] Playback stopped`);
    } catch (err) {
      console.error('[Audio] Failed to stop playback:', err);
      throw err;
    }
  }

  async pausePlayback(): Promise<void> {
    try {
      await this.playback.pausePlayback();
      console.log(`[Audio] Playback paused`);
    } catch (err) {
      console.error('[Audio] Failed to pause playback:', err);
      throw err;
    }
  }

  async resumePlayback(): Promise<void> {
    try {
      await this.playback.resumePlayback();
      console.log(`[Audio] Playback resumed`);
    } catch (err) {
      console.error('[Audio] Failed to resume playback:', err);
      throw err;
    }
  }

  isPlaying(): boolean {
    return this.playback.isAudioPlaying();
  }

  async chunkAudio(audioData: Uint8Array, maxChunkSize: number = 512): Promise<AudioChunk[]> {
    const chunks: AudioChunk[] = [];
    const totalFragments = Math.ceil(audioData.length / maxChunkSize);

    for (let i = 0; i < totalFragments; i++) {
      const start = i * maxChunkSize;
      const end = Math.min(start + maxChunkSize, audioData.length);
      const fragment = audioData.slice(start, end);

      chunks.push({
        fragmentIndex: i,
        totalFragments,
        payload: Buffer.from(fragment).toString('base64'),
        sequenceNumber: this.frameSequenceNumber++,
      });
    }

    console.log(
      `[Audio] Chunked audio into ${chunks.length} fragments (max ${maxChunkSize} bytes each)`
    );
    return chunks;
  }

  async reassembleAudio(chunks: AudioChunk[]): Promise<Uint8Array> {
    if (chunks.length === 0) {
      throw new Error('No audio chunks to reassemble');
    }

    // Sort by fragment index
    const sorted = [...chunks].sort((a, b) => a.fragmentIndex - b.fragmentIndex);

    // Verify all fragments present
    const expected = sorted[0].totalFragments;
    if (sorted.length !== expected) {
      throw new Error(
        `[Audio] Missing audio fragments: got ${sorted.length}, expected ${expected}`
      );
    }

    // Verify sequence
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].fragmentIndex !== i) {
        throw new Error(`[Audio] Audio fragment out of sequence at index ${i}`);
      }
    }

    // Combine all fragments
    const buffers = sorted.map(chunk => Buffer.from(chunk.payload, 'base64'));
    const reassembled = Buffer.concat(buffers);

    console.log(`[Audio] Reassembled audio from ${chunks.length} fragments (${reassembled.length} bytes)`);
    return new Uint8Array(reassembled);
  }

  onAudioChunkReceived(callback: (chunk: AudioChunk) => void): { remove: () => void } {
    this.audioChunkCallbacks.add(callback);
    return {
      remove: () => this.audioChunkCallbacks.delete(callback),
    };
  }

  /**
   * Internal: Emit audio chunk to registered callbacks
   */
  _emitChunk(chunk: AudioChunk): void {
    this.audioChunkCallbacks.forEach(callback => callback(chunk));
  }
}

// Singleton instance
export const audio = new AudioModule();

// Export only the public API types
export type { AudioAPI, AudioChunk };
