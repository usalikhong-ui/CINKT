export function randomIndex(size, source = globalThis.crypto) {
  if (!Number.isSafeInteger(size) || size <= 0 || size > 2 ** 32) throw new RangeError('Invalid answer count');
  const sample = new Uint32Array(1);
  const limit = Math.floor(2 ** 32 / size) * size;
  do { source.getRandomValues(sample); } while (sample[0] >= limit);
  return sample[0] % size;
}


function scheduleTear(ctx, master, track) {
  const start = ctx.currentTime + 0.035;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 1.6), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    const edge = Math.min(1, t * 12, (1.6 - t) * 14);
    const grain = 0.18 + 0.55 * Math.pow(Math.sin(t * 126 + Math.sin(t * 29) * 2.7), 6);
    data[i] = (Math.random() * 2 - 1) * edge * grain;
  }
  const rip = track(ctx.createBufferSource());
  const highpass = ctx.createBiquadFilter();
  const lowpass = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  rip.buffer = buffer;
  highpass.type = 'highpass';
  highpass.frequency.value = 650;
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(3800, start);
  lowpass.frequency.linearRampToValueAtTime(7200, start + 1.3);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(0.48, start + 0.15);
  gain.gain.linearRampToValueAtTime(0.32, start + 1.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.6);
  rip.connect(highpass).connect(lowpass).connect(gain).connect(master);
  rip.start(start);
  rip.stop(start + 1.62);
  // Brief, papery snaps along the seam, followed by a soft loose-page flutter.
  for (let i = 0; i < 19; i++) {
    const at = start + 0.06 + i * 0.075;
    const snap = track(ctx.createBufferSource());
    const bandpass = ctx.createBiquadFilter();
    const envelope = ctx.createGain();
    snap.buffer = buffer;
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1700 + (i % 6) * 470;
    bandpass.Q.value = 0.7;
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.linearRampToValueAtTime(0.28 + (i % 3) * 0.09, at + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.055);
    snap.connect(bandpass).connect(envelope).connect(master);
    snap.start(at, 0.25 + (i % 5) * 0.08, 0.06);
    snap.stop(at + 0.065);
  }
  const flutter = track(ctx.createBufferSource());
  const filter = ctx.createBiquadFilter();
  const envelope = ctx.createGain();
  flutter.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = 1300;
  envelope.gain.setValueAtTime(0.0001, start + 1.7);
  envelope.gain.linearRampToValueAtTime(0.45, start + 1.82);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + 2.15);
  flutter.connect(filter).connect(envelope).connect(master);
  flutter.start(start + 1.7, 0.4, 0.46);
  flutter.stop(start + 2.17);
}

export function initBook(root, sounds) {
  const q = (selector) => root.querySelector(selector);
  const stage = q('#book-stage');
  const draw = q('#draw-page');
  const drawLabel = q('#draw-label');
  const answer = q('#book-answer');
  const status = q('#book-status');
  const hint = q('#book-hint');
  const interaction = q('.interaction');
  let answers = [];
  let busy = false;
  let loading = false;
async function loadAnswers() {
  if (loading) return;
  loading = true;
  draw.disabled = true;
  drawLabel.textContent = '翻開書頁';
  status.textContent = '正在翻開書頁……';
  try {
    const response = await fetch(new URL('./answers.json', import.meta.url));
    if (!response.ok) throw new Error('Unable to open book');
    const content = await response.json();
    if (!Array.isArray(content) || content.length !== 2000 || content.some((text) => typeof text !== 'string' || !text.trim()) || new Set(content).size !== 2000) throw new Error('Incomplete book');
    answers = content;
    status.textContent = '把問題放在心裡，從書中撕下一頁。';
    drawLabel.textContent = '撕下一頁';
    hint.textContent = '默念一個問題，把餘下的交給紙頁';
  } catch {
    answers = [];
    status.textContent = '書頁暫時未能打開，請再試一次。';
    drawLabel.textContent = '重新翻開';
    hint.textContent = '輕按重試，讓書頁重新展開';
  } finally {
    loading = false;
    draw.disabled = false;
  }
}

draw.addEventListener('click', () => {
  if (busy || loading) return;
  if (!answers.length) { loadAnswers(); return; }
  let selected;
  try { selected = answers[randomIndex(answers.length)]; }
  catch { status.classList.remove('sr-answer'); interaction.classList.remove('result-ready'); status.textContent = '紙頁未能落下，請再試一次。'; return; }
  busy = true;
  draw.disabled = true;
  draw.setAttribute('aria-busy', 'true');
  drawLabel.textContent = '撕頁中';
  status.classList.remove('sr-answer');
  interaction.classList.remove('result-ready');
  status.textContent = '紙聲輕響，答案正在離開書脊……';
  hint.textContent = '靜一靜，讓字句慢慢落下';
  stage.classList.remove('revealed', 'tearing');
  answer.textContent = '';
  // Restart the physical tear cleanly for every new page.
  void stage.offsetWidth;
  stage.classList.add('tearing');
  sounds.play('book', scheduleTear);
  setTimeout(() => {
    answer.textContent = selected;
    answer.classList.toggle('long-answer', selected.length > 28);
    stage.classList.remove('tearing');
    stage.classList.add('revealed');
    status.classList.add('sr-answer');
    interaction.classList.add('result-ready');
    status.textContent = `這一頁的答案：${selected}`;
    hint.textContent = '把這句話，留給此刻的自己';
    drawLabel.textContent = '再撕一頁';
  }, 2400);
  setTimeout(() => {
    busy = false;
    draw.disabled = false;
    draw.removeAttribute('aria-busy');
  }, 2900);
});


  loadAnswers();
}
