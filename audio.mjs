// One audio context and one mute preference serve both rituals.
export function createSoundController(button, label, initialMode) {
  let muted = false;
  let activeMode = initialMode;
  let context;
  let master;
  const buses = new Map();
  const sources = new Map();
  const generations = new Map([['oracle', 0], ['book', 0]]);
  try { muted = localStorage.getItem('yiwen-muted') === 'true'; } catch {}

  function stopMode(mode) {
    generations.set(mode, generations.get(mode) + 1);
    for (const node of sources.get(mode) || []) {
      try { node.stop(); } catch {}
    }
    sources.get(mode)?.clear();
  }
  function updateButton() {
    button.setAttribute('aria-pressed', String(!muted));
    button.setAttribute('aria-label', muted ? '開啟音效' : '關閉音效');
    label.textContent = muted ? '音效關閉' : '音效開啟';
    if (context && master) {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(muted ? 0 : 0.65, context.currentTime);
    }
  }
  button.addEventListener('click', () => {
    muted = !muted;
    updateButton();
    try { localStorage.setItem('yiwen-muted', String(muted)); } catch {}
  });
  updateButton();

  return {
    setMode(mode) {
      if (mode !== activeMode) stopMode(activeMode);
      activeMode = mode;
      for (const [name, bus] of buses) {
        bus.gain.cancelScheduledValues(context.currentTime);
        bus.gain.setValueAtTime(name === activeMode ? 1 : 0, context.currentTime);
      }
    },
    play(mode, schedule) {
      if (muted || mode !== activeMode) return;
      stopMode(mode);
      const generation = generations.get(mode);
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        if (!context) {
          context = new Audio();
          master = context.createGain();
          master.gain.value = muted ? 0 : 0.65;
          master.connect(context.destination);
        }
        if (!buses.has(mode)) {
          const bus = context.createGain();
          bus.gain.value = mode === activeMode ? 1 : 0;
          bus.connect(master);
          buses.set(mode, bus);
          sources.set(mode, new Set());
        }
        // resume() is invoked synchronously from the initiating button gesture.
        context.resume().then(() => {
          if (mode !== activeMode || generation !== generations.get(mode) || muted) return;
          const track = (node) => {
            const list = sources.get(mode);
            list.add(node);
            node.onended = () => list.delete(node);
            return node;
          };
          schedule(context, buses.get(mode), track);
        }).catch(() => {});
      } catch { /* Visual rituals remain available without browser audio. */ }
    }
  };
}
