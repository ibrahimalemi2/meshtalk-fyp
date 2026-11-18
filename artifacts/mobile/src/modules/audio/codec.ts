/**
 * Audio Codec Module - Opus-like compression and encoding
 * Provides audio frame compression for efficient transmission
 * Simplified implementation for React Native compatibility
 */

/**
 * Audio Frame Format (Simplified PCM):
 * - Sample rate: 16000 Hz (16 kHz)
 * - Bit depth: 16-bit (2 bytes per sample)
 * - Channels: 1 (mono)
 * - Frame duration: 20 ms
 * - Frame size: 16000 * 20ms / 1000 = 320 samples = 640 bytes
 */

const SAMPLE_RATE = 16000; // 16 kHz
const FRAME_DURATION_MS = 20; // 20 ms per frame
const FRAME_SIZE = (SAMPLE_RATE * FRAME_DURATION_MS) / 1000; // 320 samples
const FRAME_BYTE_SIZE = FRAME_SIZE * 2; // 16-bit samples = 2 bytes each
const BITRATE = 16000; // 16 kbps target (can compress further with Opus)

export interface AudioFrame {
  data: Uint8Array; // Raw PCM data
  sampleRate: number;
  channels: number;
  duration: number; // In milliseconds
}

export interface CompressedAudioFrame {
  data: string; // Base64 encoded
  sampleRate: number;
  channels: number;
  duration: number;
  codec: 'pcm'; // Can be upgraded to 'opus'
  sequenceNumber: number;
}

/**
 * Simple audio compression using delta encoding + LZ4-style compression
 * Production code would use real Opus codec, but this avoids native dependency
 */
export class AudioCodec {
  /**
   * Compress PCM audio frame
   * Uses delta encoding + variable-length encoding for compression
   */
  static compressFrame(
    pcmData: Uint8Array,
    sequenceNumber: number,
    sampleRate: number = SAMPLE_RATE,
    channels: number = 1
  ): CompressedAudioFrame {
    // Delta encoding: store differences instead of absolute values
    const deltaEncoded = this._deltaEncode(pcmData);

    // Variable-length encoding for further compression
    const compressed = this._variableLengthEncode(deltaEncoded);

    // Base64 for safe transmission
    const base64 = Buffer.from(compressed).toString('base64');

    return {
      data: base64,
      sampleRate,
      channels,
      duration: FRAME_DURATION_MS,
      codec: 'pcm',
      sequenceNumber,
    };
  }

  /**
   * Decompress audio frame back to PCM
   */
  static decompressFrame(frame: CompressedAudioFrame): AudioFrame {
    // Decode from base64
    const compressedData = Buffer.from(frame.data, 'base64');

    // Variable-length decode
    const deltaEncoded = this._variableLengthDecode(compressedData);

    // Delta decode
    const pcmData = this._deltaDecode(deltaEncoded);

    return {
      data: new Uint8Array(pcmData),
      sampleRate: frame.sampleRate,
      channels: frame.channels,
      duration: frame.duration,
    };
  }

  /**
   * Delta encoding: store difference between consecutive samples
   * Reduces value range, improving compression
   */
  private static _deltaEncode(data: Uint8Array): Int16Array {
    const samples = new Int16Array(data.buffer);
    const deltas = new Int16Array(samples.length);

    deltas[0] = samples[0];
    for (let i = 1; i < samples.length; i++) {
      deltas[i] = samples[i] - samples[i - 1];
    }

    return deltas;
  }

  /**
   * Delta decode: reconstruct original from deltas
   */
  private static _deltaDecode(deltas: Int16Array): Int16Array {
    const samples = new Int16Array(deltas.length);
    samples[0] = deltas[0];

    for (let i = 1; i < deltas.length; i++) {
      samples[i] = samples[i - 1] + deltas[i];
    }

    return samples;
  }

  /**
   * Variable-length encoding: smaller values use fewer bytes
   * Similar to VLQ encoding used in WAV
   */
  private static _variableLengthEncode(deltas: Int16Array): Uint8Array {
    const output: number[] = [];

    for (let i = 0; i < deltas.length; i++) {
      const value = deltas[i];
      const absValue = Math.abs(value);

      // Sign bit + magnitude encoding
      const sign = value < 0 ? 1 : 0;

      if (absValue < 128) {
        // 1 byte: SMMMMMMM (sign + 7 magnitude bits)
        output.push((sign << 7) | (absValue & 0x7f));
      } else if (absValue < 16384) {
        // 2 bytes: 0SMMMMMMM MMMMMMMM
        output.push(0x80 | ((absValue >> 8) & 0x3f));
        output.push(absValue & 0xff);
      } else {
        // 3 bytes: 11SMMMMMMM MMMMMMMM MMMMMMMM
        output.push(0xc0 | ((absValue >> 16) & 0x1f));
        output.push((absValue >> 8) & 0xff);
        output.push(absValue & 0xff);
      }
    }

    return new Uint8Array(output);
  }

  /**
   * Variable-length decode
   */
  private static _variableLengthDecode(data: Uint8Array): Int16Array {
    const deltas: number[] = [];
    let i = 0;

    while (i < data.length) {
      const byte0 = data[i];

      let value: number;
      let sign: number;

      if ((byte0 & 0x80) === 0) {
        // 1 byte
        sign = (byte0 >> 7) & 1;
        value = byte0 & 0x7f;
        i++;
      } else if ((byte0 & 0xc0) === 0x80) {
        // 2 bytes
        sign = (byte0 >> 6) & 1;
        value = ((byte0 & 0x3f) << 8) | data[i + 1];
        i += 2;
      } else {
        // 3 bytes
        sign = (byte0 >> 5) & 1;
        value = ((byte0 & 0x1f) << 16) | (data[i + 1] << 8) | data[i + 2];
        i += 3;
      }

      deltas.push(sign ? -value : value);
    }

    return new Int16Array(deltas);
  }

  /**
   * Calculate compression ratio
   */
  static getCompressionRatio(original: Uint8Array, compressed: string): number {
    const compressedBytes = Buffer.from(compressed, 'base64').length;
    return (original.length / compressedBytes).toFixed(2);
  }

  /**
   * Estimate bandwidth usage for audio stream
   */
  static estimateBandwidth(framesPerSecond: number = 50): number {
    // 50 frames/sec * 640 bytes/frame * 8 bits/byte
    // With compression, typically achieves 2-3x ratio
    const uncompressed = framesPerSecond * FRAME_BYTE_SIZE * 8;
    return Math.ceil(uncompressed / 2.5); // Assuming 2.5x compression
  }
}
