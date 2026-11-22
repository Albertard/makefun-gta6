// All sound is synthesised with WebAudio: engine hum, sirens, gunshots, punches, cash
// and a small bass-and-hats groove. No audio files, no network. The context is created
// on the first user gesture, so nothing plays before the player presses a key.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenTimer = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** Call from a user gesture: creates and resumes the audio context. */
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function burst(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function engine(level) {
    if (!ctx || muted) return;
    if (!engineOsc) {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 400;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    }
    const target = level > 0.02 ? 0.05 + level * 0.09 : 0;
    engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
    engineOsc.frequency.setTargetAtTime(55 + level * 130, ctx.currentTime, 0.08);
    engineFilter.frequency.setTargetAtTime(300 + level * 900, ctx.currentTime, 0.08);
  }

  function siren(on) {
    if (!ctx) return;
    if (on && !sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenGain = ctx.createGain();
      sirenGain.gain.value = muted ? 0 : 0.05;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenTimer = window.setInterval(() => {
        if (!sirenOsc) return;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, ctx.currentTime, 0.05);
      }, 380);
    } else if (!on && sirenOsc) {
      window.clearInterval(sirenTimer);
      sirenTimer = null;
      sirenOsc.stop();
      sirenOsc = null;
      sirenGain = null;
    }
  }

  // A 16-step groove: A-minor bassline with a hat tick, scheduled a bar ahead.
  const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 73.42, 0];
  function music(on) {
    if (!ctx) return;
    if (on && !musicTimer) {
      musicStep = 0;
      musicTimer = window.setInterval(() => {
        if (muted) return;
        const note = BASS[musicStep % 16];
        if (note > 0) blip(note, 0.22, 'triangle', 0.16);
        if (musicStep % 4 === 2) burst(0.05, 0.05, 6000);
        musicStep += 1;
      }, 140);
    } else if (!on && musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) siren(false);
    },
    get muted() { return muted; },
    engine,
    siren,
    music,
    shot() { burst(0.12, 0.35, 2400); blip(160, 0.08, 'square', 0.2, 60); },
    punch() { burst(0.08, 0.25, 500); },
    pickup() { blip(660, 0.09, 'sine', 0.2); window.setTimeout(() => blip(990, 0.12, 'sine', 0.2), 90); },
    cash() { blip(880, 0.1, 'sine', 0.22); window.setTimeout(() => blip(1174, 0.14, 'sine', 0.22), 100); },
    crash(strength) { burst(0.25, Math.min(0.5, 0.15 + strength), 900); },
    honk() { blip(370, 0.18, 'square', 0.12); },
    jingle() {
      [523, 659, 784, 1046].forEach((freq, i) => {
        window.setTimeout(() => blip(freq, 0.18, 'sine', 0.22), i * 110);
      });
    },
    busted() { blip(220, 0.4, 'sawtooth', 0.2, 110); },
  };
}
