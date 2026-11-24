import { drawOutcome } from './lottery.mjs';

function knock(ctx, master, track, at, pitch, level = 0.22, length = 0.065) {
  const osc = track(ctx.createOscillator());
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(pitch, at);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.6, at + length);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(level, at + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(master);
  osc.start(at);
  osc.stop(at + length + 0.01);
}
function scheduleSound(ctx, master, track) {
  const start = ctx.currentTime + 0.02;
  const noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.045), ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.009));
  for (let i = 0; i < 23; i++) {
    const at = start + i * 0.088;
    knock(ctx, master, track, at, 650 + (i % 5) * 135, i % 3 === 0 ? 0.17 : 0.09);
    const source = track(ctx.createBufferSource());
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = noise;
    filter.type = 'bandpass';
    filter.frequency.value = 1500 + (i % 4) * 280;
    filter.Q.value = 1.4;
    gain.gain.value = 0.19;
    source.connect(filter).connect(gain).connect(master);
    source.start(at + 0.025);
    source.stop(at + 0.08);
  }
  knock(ctx, master, track, start + 2.18, 1050, 0.24, 0.11);
  knock(ctx, master, track, start + 2.76, 520, 0.32, 0.14);
  knock(ctx, master, track, start + 2.88, 710, 0.13, 0.08);
}

export function initOracle(root, sounds) {
  const q = (selector) => root.querySelector(selector);
  const ask = q('#ask');
  const askLabel = q('#ask-label');
  const scene = q('#scene');
  const status = q('#oracle-status');
  const hint = q('#oracle-hint');
  const fortune = q('#fortune');
  const answer = q('#answer');
const answers = {
  yes: { text: '是', message: '是。心中所想，不妨向前一步。', hint: '願你心之所向，皆有回響' },
  no: { text: '否', message: '否。停一停，或許會看見另一條路。', hint: '慢一點，也有慢一點的風景' },
  later: { text: '宜改天再問', message: '宜改天再問。時機未到，讓答案再等一等。', hint: '留一點餘地給明天' }
};
let busy = false;
ask.addEventListener('click', () => {
  if (busy) return;
  let result;
  try { result = drawOutcome(); }
  catch {
    status.textContent = '未能抽籤，請再試一次。';
    return;
  }
  busy = true;
  ask.disabled = true;
  ask.setAttribute('aria-busy', 'true');
  askLabel.textContent = '搖籤中';
  fortune.hidden = true;
  scene.classList.remove('has-result');
  scene.classList.add('shaking');
  status.textContent = '心中默念，靜候一籤……';
  hint.textContent = '籤聲起，心慢下來';
  sounds.play('oracle', scheduleSound);
  setTimeout(() => {
    scene.classList.remove('shaking');
    answer.textContent = answers[result].text;
    fortune.classList.toggle('rare', result === 'later');
    fortune.hidden = false;
    scene.classList.add('has-result');
    askLabel.textContent = '籤落';
  }, 2100);
  setTimeout(() => {
    status.textContent = answers[result].message;
    hint.textContent = answers[result].hint;
    askLabel.textContent = '再問一籤';
    ask.disabled = false;
    ask.removeAttribute('aria-busy');
    busy = false;
  }, 3000);
});
}
