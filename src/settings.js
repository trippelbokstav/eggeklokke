// Settings: saved on this phone, so the app opens ready to go (just tap the egg).
// Holds the look (system/light/dark), the language, "My values" (your own times + home altitude)
// and the last egg size and yolk you picked. Also builds the settings sheet (⋯ in the corner).
import { LANGS, t } from './i18n.js';
import { standardTimesAt, fmt } from './timer.js';

const KEY = 'eggeklokke-settings-v1';
const DEFAULTS = { theme: 'system', lang: 'en', times: null, home: 0, size: 'm', done: 'smile' };

export function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return { ...DEFAULTS }; }
}
export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage blocked: the app still works */ }
}

const TIME_MIN = 120;   // 2:00
const TIME_MAX = 1200;  // 20:00
const TIME_STEP = 15;   // seconds per tap
const ALT_STEP = 50;

// s: the settings object (changed in place). onChange(what) tells main.js what to apply.
// openLab(): opens the developer lab.
export function createSettingsSheet(s, onChange, openLab) {
  const sheet = document.createElement('div');
  sheet.id = 'settings';
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  document.body.appendChild(sheet);

  const times = () => s.times || standardTimesAt(s.home);

  function render() {
    const tm = times();
    sheet.setAttribute('aria-label', t('settings'));
    sheet.innerHTML = `
      <div class="sheet">
        <div class="sheet-head">
          <h2>${t('settings')}</h2>
          <button type="button" class="sheet-close" data-act="close" aria-label="${t('close')}">✕</button>
        </div>

        <section>
          <h3>${t('appearance')}</h3>
          <div class="seg3" role="group" aria-label="${t('appearance')}">
            ${['system', 'light', 'dark'].map((m) => `<button type="button" data-theme-pick="${m}" aria-pressed="${s.theme === m}">${t(m)}</button>`).join('')}
          </div>
        </section>

        <section>
          <h3><label for="langPick">${t('language')}</label></h3>
          <select id="langPick">${LANGS.map(([c, n]) => `<option value="${c}"${c === s.lang ? ' selected' : ''}>${n}</option>`).join('')}</select>
        </section>

        <section>
          <h3>${t('myValues')}</h3>
          <p class="sheet-note">${t('myValuesNote')}</p>
          ${['soft', 'smile', 'hard'].map((d) => `
            <div class="vrow">
              <span>${t(d)}</span>
              <div class="vstep">
                <button type="button" data-time="${d}" data-dir="-1" aria-label="− ${t(d)}">−</button>
                <output>${fmt(tm[d])}</output>
                <button type="button" data-time="${d}" data-dir="1" aria-label="+ ${t(d)}">+</button>
              </div>
            </div>`).join('')}
          <div class="vrow">
            <span>${t('homeAlt')}</span>
            <div class="vstep">
              <button type="button" data-home="-1" aria-label="− ${t('homeAlt')}">−</button>
              <output>${s.home} m</output>
              <button type="button" data-home="1" aria-label="+ ${t('homeAlt')}">+</button>
            </div>
          </div>
          <button type="button" class="sheet-link" data-act="reset"${s.times ? '' : ' disabled'}>${t('reset')}</button>
        </section>

        <section>
          <h3>${t('eggSizes')}</h3>
          <ul class="sheet-list"><li>${t('gramsS')}</li><li>${t('gramsM')}</li><li>${t('gramsL')}</li></ul>
          <p class="sheet-note">${t('sizesNote')}</p>
        </section>

        <section>
          <button type="button" class="sheet-link" data-act="lab">${t('lab')}</button>
        </section>
      </div>`;
  }

  sheet.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) { if (e.target === sheet) close(); return; }
    if (b.dataset.act === 'close') return close();
    if (b.dataset.act === 'lab') { close(); return openLab(); }
    if (b.dataset.act === 'reset') { s.times = null; done('times'); return; }
    if (b.dataset.themePick) { s.theme = b.dataset.themePick; done('theme'); return; }
    if (b.dataset.time) {
      const tm = { ...times() };
      tm[b.dataset.time] = Math.min(TIME_MAX, Math.max(TIME_MIN, tm[b.dataset.time] + TIME_STEP * +b.dataset.dir));
      s.times = tm;
      done('times');
      return;
    }
    if (b.dataset.home) {
      s.home = Math.min(2500, Math.max(0, s.home + ALT_STEP * +b.dataset.home));
      done('home');
    }
  });
  sheet.addEventListener('change', (e) => {
    if (e.target.id === 'langPick') { s.lang = e.target.value; done('lang'); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) close(); });

  function done(what) {
    saveSettings(s);
    onChange(what);
    render();
  }
  function open() { render(); sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add('open')); }
  function close() { sheet.classList.remove('open'); setTimeout(() => { sheet.hidden = true; }, 250); }

  return { open, close, render };
}
