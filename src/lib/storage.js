// Tiny localStorage persistence layer (Excel is the real "DB",
// localStorage keeps the in-progress session so a refresh never loses a ball).
const KEY = 'gameslate-v1';
const LEGACY_KEYS = ['cricket-scoreboard-v1'];

function readJson(k) {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('saveState failed', e);
  }
}

export function loadState() {
  // try GameSlate key first, then migrate any pre-rename data
  let data = readJson(KEY);
  if (!data) {
    for (const k of LEGACY_KEYS) {
      const old = readJson(k);
      if (old) { saveState(old); localStorage.removeItem(k); data = old; break; }
    }
  }
  return data;
}

export function clearState() {
  localStorage.removeItem(KEY);
  LEGACY_KEYS.forEach(k => localStorage.removeItem(k));
}



