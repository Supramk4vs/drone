/**
 * Zero-dependency Procedural Tactical Audio Synthesizer
 * Built using the Web Audio API for authentic military sound effects
 */

class TacticalAudioService {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private laserOsc: OscillatorNode | null = null;
  private laserGain: GainNode | null = null;
  private isLaserRunning: boolean = false;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.isLaserRunning) {
      this.stopLaser();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Radar sweep ping
  public playRadarPing() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const now = this.ctx.currentTime;

    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.12);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Lock acquired tone (high military lock double beep)
  public playLockAcquired() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [0, 0.09].forEach((delay) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(2400, now + delay);

      gain.gain.setValueAtTime(0.12, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.07);
    });
  }

  // 30mm Kinetic Flak Cannon Shot + Airburst
  public playFlakShot() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Initial heavy muzzle blast
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);

    oscGain.gain.setValueAtTime(0.35, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);

    // 2. High-frequency crack/snap (mechanical discharge)
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'sawtooth';
    snapOsc.frequency.setValueAtTime(800, now);
    snapOsc.frequency.exponentialRampToValueAtTime(100, now + 0.08);

    snapGain.gain.setValueAtTime(0.2, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    snapOsc.connect(snapGain);
    snapGain.connect(this.ctx.destination);
    snapOsc.start(now);
    snapOsc.stop(now + 0.1);

    // 3. Airburst shrapnel detonation 0.25s later
    setTimeout(() => {
      this.playAirburstNoise();
    }, 220);
  }

  private playAirburstNoise() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.4);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.42);
  }

  // RF Directional Jammer Pulse (electromagnetic pulsing buzz)
  public playJammerPulse() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const mainGain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, now);

    lfo.type = 'square';
    lfo.frequency.setValueAtTime(45, now); // 45 Hz jitter

    lfoGain.gain.setValueAtTime(80, now);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    mainGain.gain.setValueAtTime(0.18, now);
    mainGain.gain.exponentialRampToValueAtTime(0.01, now + 0.65);

    osc.connect(mainGain);
    mainGain.connect(this.ctx.destination);

    lfo.start(now);
    osc.start(now);
    lfo.stop(now + 0.7);
    osc.stop(now + 0.7);
  }

  // High-Energy Laser DEW continuous firing hum
  public startLaser() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || this.isLaserRunning) return;

    const now = this.ctx.currentTime;
    this.laserOsc = this.ctx.createOscillator();
    this.laserGain = this.ctx.createGain();

    this.laserOsc.type = 'sawtooth';
    this.laserOsc.frequency.setValueAtTime(440, now);
    this.laserOsc.frequency.linearRampToValueAtTime(520, now + 0.5);

    this.laserGain.gain.setValueAtTime(0.01, now);
    this.laserGain.gain.linearRampToValueAtTime(0.12, now + 0.1);

    this.laserOsc.connect(this.laserGain);
    this.laserGain.connect(this.ctx.destination);

    this.laserOsc.start(now);
    this.isLaserRunning = true;
  }

  public stopLaser() {
    if (!this.isLaserRunning || !this.laserGain || !this.laserOsc || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.laserGain.gain.linearRampToValueAtTime(0.001, now + 0.08);
    this.laserOsc.stop(now + 0.1);
    this.isLaserRunning = false;
    this.laserOsc = null;
    this.laserGain = null;
  }

  // Cyber / GPS Spoofing arpeggio chirp
  public playSpoofChirp() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = [880, 1174, 1318, 1760, 2093];

    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const time = now + idx * 0.06;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.09, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(time);
      osc.stop(time + 0.09);
    });
  }

  // Drone destruction explosion
  public playDroneExplosion() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Low rumble
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.8);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.86);

    // Fireball noise
    this.playAirburstNoise();
  }

  // Perimeter klaxon alarm
  public playAlarmKlaxon() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(700, now);
    osc.frequency.linearRampToValueAtTime(950, now + 0.25);
    osc.frequency.linearRampToValueAtTime(700, now + 0.5);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.53);
  }

  // Tactical Voice Synthesizer using Web Speech API
  public speak(phrase: string) {
    if (this.isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.rate = 1.15;
      utterance.pitch = 0.85; // lower pitch for commanding military tone
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    } catch {
      // ignore
    }
  }
}

export const tacticalAudio = new TacticalAudioService();
