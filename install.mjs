const button = document.querySelector('#install-app');
const label = document.querySelector('#install-label');
const status = document.querySelector('#install-status');
const dialog = document.querySelector('#install-guide');
const intro = document.querySelector('#install-intro');
const steps = document.querySelector('#install-steps');
const note = document.querySelector('#install-note');
const nativeButton = document.querySelector('#install-native');
const displayMode = window.matchMedia('(display-mode: standalone)');
let offer = null;
let prompting = false;
let installedHere = false;

function isStandalone() {
  return displayMode.matches || navigator.standalone === true;
}
function isInstalled() {
  return installedHere || isStandalone();
}
function updateButton() {
  const installed = isInstalled();
  button.disabled = installed || prompting;
  label.textContent = installed ? '已加入主畫面' : prompting ? '正在開啟' : '加入主畫面';
  button.setAttribute('aria-label', installed ? '一問已加入主畫面' : '加入主畫面');
  button.title = installed ? '一問已加入主畫面' : '將一問加入主畫面';
  nativeButton.hidden = !offer || installed;
  nativeButton.disabled = prompting;
  if (installed && dialog.open) dialog.close();
}

export function installationGuide(agent, platform, touchPoints = 0) {
  const ios = /iPhone|iPad|iPod/i.test(agent) || (/Mac/i.test(platform) && touchPoints > 1);
  if (ios) return {
    steps: [
      '點一下瀏覽器的「分享」按鈕（方框向上箭嘴）。',
      '在分享選單中向下滑，選擇「加入主畫面」。',
      '保留名稱「一問」，如有「以網頁 App 開啟」選項，請開啟它，再按「加入」。'
    ],
    note: '如果找不到「加入主畫面」，請先用 Safari 開啟此網站，再按分享。'
  };
  if (/Android/i.test(agent)) return {
    steps: [
      '打開瀏覽器右上角的選單（⋮）。',
      '選擇「安裝應用程式」或「加入主畫面」。',
      '確認名稱「一問」，再按「安裝」或「加入」。'
    ],
    note: '如果選單沒有安裝選項，請使用 Chrome 開啟此網站。'
  };
  if (/Mac/i.test(platform) && /Safari/i.test(agent) && !/Chrome|Chromium|Edg|OPR/i.test(agent)) return {
    steps: [
      '在 Safari 的「檔案」選單選擇「加入 Dock」。',
      '確認名稱「一問」和印章圖示，再按「加入」。',
      '以後可直接從 Dock 開啟。'
    ],
    note: '如果沒有「加入 Dock」，請更新 Safari，或使用 Chrome／Edge 安裝。'
  };
  if (/Chrome|Chromium|Edg|OPR/i.test(agent)) return {
    steps: [
      '點一下網址列旁的安裝圖示，或打開瀏覽器選單。',
      '選擇「安裝一問」或「將此網站安裝為應用程式」。',
      '確認安裝後，即可從應用程式清單開啟一問。'
    ],
    note: '瀏覽器會決定何時提供安裝；如未出現，可稍候再試。'
  };
  return {
    steps: [
      '使用 Chrome 或 Edge 開啟此網站。',
      '按右上角「加入主畫面」，或使用瀏覽器選單的安裝選項。',
      '在安裝視窗確認名稱與圖示。'
    ],
    note: '這個瀏覽器未提供直接安裝。你亦可以先把一問加入書籤。'
  };
}

function showGuide() {
  const guide = installationGuide(navigator.userAgent, navigator.platform || '', navigator.maxTouchPoints || 0);
  intro.textContent = '把這枚印章留在主畫面，下次心中有問，輕觸便可回來。';
  steps.replaceChildren(...guide.steps.map((text) => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));
  note.textContent = guide.note;
  updateButton();
  if (!dialog.open) dialog.showModal();
}

async function requestInstall() {
  if (prompting || isInstalled()) return;
  if (!offer) { showGuide(); return; }
  const currentOffer = offer;
  offer = null;
  prompting = true;
  updateButton();
  if (dialog.open) dialog.close();
  try {
    // Keep prompt() in the initiating click gesture, before the first await.
    const promptResult = currentOffer.prompt();
    await promptResult;
    const choice = await currentOffer.userChoice;
    status.textContent = isInstalled() ? '一問已加入主畫面。'
      : choice.outcome === 'accepted'
        ? '已確認安裝，瀏覽器完成後即可從主畫面開啟一問。'
        : '已取消加入，隨時可以再試。';
  } catch {
    status.textContent = '瀏覽器未能開啟安裝視窗，可依步驟手動加入。';
    showGuide();
  } finally {
    prompting = false;
    updateButton();
  }
}

button.addEventListener('click', requestInstall);
nativeButton.addEventListener('click', requestInstall);
document.querySelector('#install-close').addEventListener('click', () => dialog.close());
document.querySelector('#install-understood').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  offer = event;
  updateButton();
});
window.addEventListener('appinstalled', () => {
  installedHere = true;
  offer = null;
  status.textContent = '一問已加入主畫面。';
  updateButton();
});
if (displayMode.addEventListener) displayMode.addEventListener('change', updateButton);
else if (displayMode.addListener) displayMode.addListener(updateButton);
updateButton();

function registerWorker() {
  if (!window.isSecureContext || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(new URL('./sw.js', import.meta.url), {
    scope: new URL('./', import.meta.url).pathname,
    updateViaCache: 'none'
  }).catch(() => { /* Manual home-screen instructions still work without a worker. */ });
}
if (document.readyState === 'complete') registerWorker();
else window.addEventListener('load', registerWorker, { once: true });
