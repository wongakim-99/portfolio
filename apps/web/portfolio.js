const lamp = document.querySelector('#lamp');
const lampText = document.querySelector('#lamp-text');
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => document.documentElement.dataset.theme
  ? document.documentElement.dataset.theme === 'dark' : darkQuery.matches;

function syncLamp() {
  const dark = isDark();
  lamp.setAttribute('aria-pressed', String(!dark));
  lampText.textContent = dark ? '스탠드 켜기' : '스탠드 끄기';
}

lamp.addEventListener('click', () => {
  const dark = !isDark();
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem('lamp', JSON.stringify(dark ? 'off' : 'on')); } catch {}
  syncLamp();
});
darkQuery.addEventListener('change', syncLamp);
syncLamp();
