const status = document.querySelector('#status');
const players = [...document.querySelectorAll('audio')];
const source = document.querySelector('#source-audio');
const names = ['bright', 'soft', 'cool'];
const playbackStarts = Object.fromEntries(['source', ...names].map(name => [name, 0]));
let manifest;
let activeComparison = null;
let ready = false;
const cacheKey = 'vmodel-voice-reference-v1';

for (const select of document.querySelectorAll('[data-score]')) {
  for (const [value, label] of [['', 'Not rated'], ['1', '1 · Poor'], ['2', '2 · Fair'], ['3', '3 · Okay'], ['4', '4 · Good'], ['5', '5 · Great']]) {
    select.add(new Option(label, value));
  }
}

function snapshot() {
  return {
    schemaVersion: 1, auditionId: 'reference-v1', provisional: true,
    speechSource: 'Public-domain LJ Speech reference, not the user',
    trainedEnglishControlIncluded: false, liveDefaultAccepted: false,
    timestamp: new Date().toISOString(),
    preference: document.querySelector('#preference').value || null,
    notes: document.querySelector('#notes').value,
    ratings: Object.fromEntries(names.map(name => [name,
      Object.fromEntries([...document.querySelectorAll(`[data-voice="${name}"] [data-score]`)].map(select => [select.dataset.score, select.value ? Number(select.value) : null]))])),
    playbackStarts: { ...playbackStarts },
    audioHashes: Object.fromEntries((manifest?.items || []).map(item => [item.id, item.sha256])),
  };
}

function restore(saved) {
  if (saved?.schemaVersion !== 1 || saved.auditionId !== 'reference-v1') return;
  if (saved.audioHashes && manifest.items.some(item => saved.audioHashes[item.id] !== item.sha256)) return;
  document.querySelector('#preference').value = [...names, 'none'].includes(saved.preference) ? saved.preference : '';
  document.querySelector('#notes').value = typeof saved.notes === 'string' ? saved.notes.slice(0, 2000) : '';
  for (const name of names) {
    for (const select of document.querySelectorAll(`[data-voice="${name}"] [data-score]`)) {
      const score = saved.ratings?.[name]?.[select.dataset.score];
      select.value = Number.isInteger(score) && score >= 1 && score <= 5 ? String(score) : '';
    }
    playbackStarts[name] = Number.isSafeInteger(saved.playbackStarts?.[name]) ? Math.max(0, saved.playbackStarts[name]) : 0;
  }
  playbackStarts.source = Number.isSafeInteger(saved.playbackStarts?.source) ? Math.max(0, saved.playbackStarts.source) : 0;
}

function cache() {
  if (!ready) return;
  try { localStorage.setItem(cacheKey, JSON.stringify(snapshot())); } catch { /* Save/export still work. */ }
}

function resetComparison() {
  activeComparison = null;
  for (const button of document.querySelectorAll('[data-compare]')) button.textContent = 'Compare with original';
}

async function play(player) {
  for (const other of players) if (other !== player) other.pause();
  player.currentTime = 0;
  try { await player.play(); } catch { status.textContent = 'Playback could not start. Use the play button on the clip.'; }
}

for (const player of players) {
  player.addEventListener('play', () => {
    for (const other of players) if (other !== player) other.pause();
    const voice = player.closest('[data-voice]');
    playbackStarts[voice?.dataset.voice || 'source'] += 1;
    if (voice) voice.classList.add('playing');
    cache();
  });
  player.addEventListener('pause', () => player.closest('[data-voice]')?.classList.remove('playing'));
  player.addEventListener('ended', () => player.closest('[data-voice]')?.classList.remove('playing'));
  player.addEventListener('error', () => { status.textContent = 'A local clip could not load. Restart the listening room after preparing its audio files.'; });
}

for (const button of document.querySelectorAll('[data-compare]')) {
  button.addEventListener('click', async () => {
    const name = button.dataset.compare;
    if (activeComparison === name) {
      resetComparison();
      await play(document.querySelector(`[data-voice="${name}"] audio`));
      status.textContent = `Playing ${name}. Compare the same words with the original performance.`;
    } else {
      resetComparison();
      activeComparison = name;
      button.textContent = `Now play ${name[0].toUpperCase() + name.slice(1)}`;
      await play(source);
      status.textContent = `Playing the original English reference. Then choose “Now play ${name[0].toUpperCase() + name.slice(1)}”.`;
    }
  });
}

document.querySelector('#stop').addEventListener('click', () => {
  for (const player of players) { player.pause(); player.currentTime = 0; }
  resetComparison();
  status.textContent = 'All audio stopped.';
});

document.querySelector('#feedback').addEventListener('submit', async event => {
  event.preventDefault();
  if (!ready) return;
  const button = document.querySelector('#save');
  button.disabled = true;
  try {
    const response = await fetch('/ratings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot()) });
    if (!response.ok) throw new Error('Save failed');
    cache();
    status.textContent = 'Saved on this laptop. This is a reference impression; your own voice and a live audition come next.';
  } catch {
    status.textContent = 'Could not save to the local server. Export notes to keep a copy.';
  } finally { button.disabled = false; }
});

document.querySelector('#export').addEventListener('click', () => {
  if (!ready) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'ene-voice-reference-notes.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

for (const input of document.querySelectorAll('select,textarea')) {
  input.addEventListener('input', cache);
}

try {
  const response = await fetch('/manifest.json');
  if (!response.ok) throw new Error('Missing manifest');
  manifest = await response.json();
  document.querySelector('#transcript').textContent = `“${manifest.transcript}”`;
  for (const item of manifest.items) {
    const player = item.id === 'source' ? source : document.querySelector(`[data-voice="${item.id}"] audio`);
    if (player) player.src = item.url;
  }
  const persisted = await fetch('/ratings');
  if (persisted.ok) restore(await persisted.json());
  try { const cached = localStorage.getItem(cacheKey); if (cached) restore(JSON.parse(cached)); } catch { /* Corrupt/unavailable storage is optional. */ }
  ready = true;
  status.textContent = 'Ready. Listen to the original, then try each character voice. No preference has been accepted automatically.';
} catch {
  status.textContent = 'Reference clips are unavailable. Run scripts/voice/prepare_auditions.py before opening this page.';
}
