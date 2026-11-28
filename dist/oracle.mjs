import { drawIndex } from './lottery.mjs';
import { sticks, stickSource } from './fortune-sticks.mjs';
import { readingsForStick } from './fortune-aspects.mjs';

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
  const result = q('#oracle-result');
  const resultNumber = q('#oracle-result-number');
  const resultTitle = q('#oracle-result-title');
  const resultGrade = q('#oracle-result-grade');
  const poem = q('#oracle-poem');
  if (!result) return;
  const cachedPanel = q('#oracle-details');
  const readings = document.createElement('div');
  readings.className = 'lot-reading';
  readings.id = 'oracle-details';
  readings.innerHTML = `
    <h3>白話解籤</h3>
    <p id="oracle-reading"></p>
    <div class="lot-topics-header">
      <h3>逐項解讀</h3>
      <button class="lot-topics-all" id="oracle-all-topics" type="button" aria-controls="oracle-topics">收起全部</button>
    </div>
    <div class="lot-topics" id="oracle-topics"></div>
  `;
  if (cachedPanel) cachedPanel.replaceWith(readings);
  else result.insertBefore(readings, q('#oracle-source'));
  const explanation = q('#oracle-reading');
  const source = q('#oracle-source');
  const topics = q('#oracle-topics');
  const toggleTopics = q('#oracle-all-topics');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let busy = false;

  let topicRows = [];

  function setTopicOpen(row, open) {
    row.text.hidden = !open;
    row.button.setAttribute('aria-expanded', String(open));
  }

  function reflectTopicState() {
    toggleTopics.textContent = topicRows.some(row => row.text.hidden) ? '展開全部' : '收起全部';
  }

  toggleTopics.addEventListener('click', () => {
    const open = topicRows.some(row => row.text.hidden);
    for (const row of topicRows) setTopicOpen(row, open);
    reflectTopicState();
  });

  ask.addEventListener('click', () => {
    if (busy) return;

    let index;
    try {
      index = drawIndex(sticks.length);
    } catch {
      status.textContent = '未能抽籤，請再試一次。';
      return;
    }

    const number = index + 1;
    const label = `第 ${number} 籤`;
    const [title, grade, lines, reading] = sticks[index];
    busy = true;
    ask.disabled = true;
    ask.setAttribute('aria-busy', 'true');
    askLabel.textContent = '搖籤中';
    fortune.hidden = true;
    result.hidden = true;
    scene.classList.remove('has-result');
    scene.classList.add('shaking');
    status.textContent = '心中默念，靜候一籤……';
    hint.textContent = '籤聲起，心慢下來';
    sounds.play('oracle', scheduleSound);

    setTimeout(() => {
      scene.classList.remove('shaking');
      answer.textContent = label.replaceAll(' ', '');
      fortune.hidden = false;
      scene.classList.add('has-result');
      askLabel.textContent = '籤落';
    }, 2100);

    setTimeout(() => {
      resultNumber.textContent = label;
      resultTitle.textContent = title;
      resultGrade.textContent = grade;
      const verses = lines.map(line => {
        const verse = document.createElement('span');
        verse.textContent = line;
        return verse;
      });
      poem.replaceChildren(...verses);
      explanation.textContent = reading;
      topicRows = readingsForStick(number).map(({ title, text }, index) => {
        const section = document.createElement('section');
        const button = document.createElement('button');
        const body = document.createElement('p');
        button.type = 'button';
        button.className = 'lot-topic-button';
        button.textContent = title;
        body.id = `oracle-topic-${index + 1}`;
        body.textContent = text;
        button.setAttribute('aria-controls', body.id);
        section.append(button, body);
        const row = { section, button, text: body };
        setTopicOpen(row, true);
        button.addEventListener('click', () => {
          setTopicOpen(row, body.hidden);
          reflectTopicState();
        });
        return row;
      });
      topics.replaceChildren(...topicRows.map(row => row.section));
      reflectTopicState();
      source.href = new URL(`${number}/zh-TW`, stickSource);
      result.hidden = false;
      status.textContent = `抽得${label}「${title}」，${grade}。`;
      hint.textContent = '籤詩、白話解籤同十二項解說已顯示於下方';
      askLabel.textContent = '再問一籤';
      ask.disabled = false;
      ask.removeAttribute('aria-busy');
      busy = false;

      if (!root.hidden && (document.activeElement === ask || document.activeElement === document.body)) {
        result.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      }
    }, 3000);
  });
}
