// Web Audio API procedural synthesizer for Minesweeper sound effects
// 100% zero external dependencies, works offline and on all modern browsers

class SoundController {
  constructor() {
    this.audioCtx = null;
    const stored = localStorage.getItem('minesweeper_sound_muted');
    this.muted = stored === 'true';
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  isMuted() {
    return this.muted;
  }

  setMuted(mute) {
    this.muted = mute;
    localStorage.setItem('minesweeper_sound_muted', String(mute));
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // Soft click / reveal sound
  playClick() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  // Flag placed or removed
  playFlag(isPlacing = true) {
    if (this.muted) return;
    try {
      this.init();
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const startFreq = isPlacing ? 600 : 900;
      const endFreq = isPlacing ? 900 : 600;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  // Chording reveal sound
  playChord() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      [440, 554.37, 659.25].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.03);

        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.03 + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + i * 0.03);
        osc.stop(ctx.currentTime + i * 0.03 + 0.09);
      });
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  // Glorious victory fanfare
  playVictory() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.12);

        gain.gain.setValueAtTime(0.3, ctx.currentTime + index * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.12 + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + index * 0.12);
        osc.stop(ctx.currentTime + index * 0.12 + 0.45);
      });
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  // Realistic explosion rumble
  playExplosion() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;

      // Noise buffer for blast
      const bufferSize = ctx.sampleRate * 0.5;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      // Filter for deep rumble
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.5);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start();
      whiteNoise.stop(ctx.currentTime + 0.5);

      // Low oscillator punch
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.4);

      oscGain.gain.setValueAtTime(0.3, ctx.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }
}

export const sounds = new SoundController();
