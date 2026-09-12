import './style.css';
import { loadManifest, resourceIds, type ResourceId } from './manifest';
import { ResourcePlayer } from './player';

const names: Record<ResourceId, string> = {
  'home-greeting': 'Hello!', 'desk-normal': 'At ease', 'desk-confused': 'Wait, what?',
  'desk-surprised': 'Oh!', 'desk-excited': 'Let’s go!',
};
const expressions: Record<ResourceId, string> = {
  'home-greeting': 'A wave from your digital neighbour.', 'desk-normal': 'Just happy to be here.',
  'desk-confused': 'Give me a second. I’m thinking.', 'desk-surprised': 'Okay, I did not see that coming.',
  'desk-excited': 'Now that’s something to smile about.',
};
const arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="site-header">
    <a class="wordmark" href="#main" aria-label="Ene home"><span class="brand-mark" aria-hidden="true">e<span>:</span></span><span>ene<span class="wordmark-dot">.</span></span></a>
    <nav aria-label="Showcase layout"><button class="nav-button selected" data-mode="home" aria-pressed="true">Welcome</button><button class="nav-button" data-mode="desk" aria-pressed="false">At the desk</button></nav>
    <span class="header-note"><i aria-hidden="true"></i> a little digital company</span>
  </header>
  <main id="main" tabindex="-1">
    <section class="welcome-layout" aria-labelledby="welcome-title">
      <div class="welcome-copy">
        <p class="eyebrow"><span class="tiny-star" aria-hidden="true">✦</span> HELLO, WORLD. HELLO, YOU.</p>
        <h1 id="welcome-title">A little spark.<br>A whole lot<br> of <span>Ene.</span></h1>
        <p class="intro">Blue hair. Bright ideas. A familiar face for your corner of the internet.</p>
        <div class="hero-actions"><button id="say-hello" class="primary-button">Say hello ${arrow}</button><button class="text-button" data-mode="desk">Take a seat <span aria-hidden="true">↗</span></button></div>
        <div class="welcome-footnote"><span class="small-orbit" aria-hidden="true">✧</span><p>Small moments.<br><strong>A little more personality.</strong></p></div>
      </div>
      <div class="welcome-art">
        <div class="orbit orbit-one" aria-hidden="true"></div><div class="orbit orbit-two" aria-hidden="true"></div>
        <span class="art-coordinate" aria-hidden="true">01 / ENE</span><span class="art-spark spark-one" aria-hidden="true">✦</span><span class="art-spark spark-two" aria-hidden="true">+</span>
        <div id="home-slot" class="home-slot"></div>
        <div class="hello-note" aria-hidden="true">Oh, hey there! <span>↗</span></div>
        <span class="art-caption">YOUR DAILY DOSE OF DIGITAL SUNSHINE</span>
      </div>
    </section>
    <section class="desk-layout" aria-labelledby="desk-title" hidden>
      <div class="desk-heading"><div><p class="eyebrow">PULL UP A CHAIR</p><h1 id="desk-title">Good company.<br><span>Open tabs.</span></h1></div><p>A few ideas, a little curiosity,<br>and Ene in the corner.</p></div>
      <div class="stream-grid">
        <div class="stream-main">
          <div class="session-header"><span><i aria-hidden="true"></i> THE LITTLE IDEA ROOM</span><span>PERSONAL SHOWCASE</span></div>
          <div class="session-canvas">
            <div class="content-art" aria-hidden="true"><div class="content-grid"></div><div class="art-disc"></div><span class="content-kicker">TODAY’S REMINDER</span><p>Stay<br>curious<span>✳</span></p><span class="content-bottom">GOOD THINGS START WITH A LITTLE “WHAT IF?”</span></div>
            <div id="desk-slot" class="desk-slot"><div class="desk-surface" aria-hidden="true"><span class="desk-edge"></span></div></div>
          </div>
          <div class="session-footer"><div><h2>A quiet little corner of the internet</h2><p>Ideas, daydreams & a familiar blue-haired face.</p></div><span class="session-tag">JUST HANGING OUT</span></div>
        </div>
        <aside class="chat-card" aria-label="Illustrative conversation"><div class="chat-heading"><h2>The corner chat</h2><span>EXAMPLE</span></div><p class="chat-note">A little scene to set the mood.</p>
          <ul class="chat-messages"><li><span class="chat-avatar mint">m</span><div><strong>mika <time>12:04</time></strong><p>made it! brought snacks ✨</p></div></li><li><span class="chat-avatar peach">s</span><div><strong>sora <time>12:05</time></strong><p>this is my kind of afternoon</p></div></li><li><span class="chat-avatar lilac">y</span><div><strong>yuu <time>12:05</time></strong><p>Ene gets it.</p></div></li><li class="chat-reaction"><span aria-hidden="true">✦</span> a little good energy for everyone</li></ul>
          <div class="chat-bottom"><span aria-hidden="true">♡</span> You’re in good company.</div>
        </aside>
      </div>
    </section>
    <section class="moment-panel" aria-labelledby="moment-title">
      <div class="moment-heading"><div><p class="eyebrow">FIVE LITTLE MOMENTS</p><h2 id="moment-title">Every mood, still Ene.</h2></div><p id="expression-description">${expressions['home-greeting']}</p></div>
      <div class="moment-controls"><div class="state-buttons" role="group" aria-label="Choose Ene’s expression">${resourceIds.map((id, i) => `<button type="button" data-resource="${id}" aria-pressed="${i === 0}" class="state-button${i === 0 ? ' selected' : ''}"><span class="state-number" aria-hidden="true">0${i + 1}</span>${names[id]}</button>`).join('')}</div>
        <div class="transport" role="group" aria-label="Animation playback"><button id="play-pause" class="transport-button" disabled>Pause</button><button id="replay" class="transport-button" disabled aria-label="Replay animation"><span aria-hidden="true">↻</span> Replay</button></div>
      </div>
      <p id="player-status" class="player-status" role="status">Getting Ene ready…</p>
    </section>
    <details class="inspector"><summary>View display options</summary><div class="inspector-controls"><label>Preview backdrop<select id="backdrop"><option value="scene">Original scene</option><option value="light">Light</option><option value="dark">Dark</option><option value="checker">Checkerboard</option></select></label><label>Animation format<select id="format"><option value="auto">Automatic</option><option value="webp">Compatibility (WebP)</option></select></label><output id="media-details"></output></div></details>
  </main>
  <footer class="site-footer"><p><strong>ene.</strong> A little digital company.</p><p>Character model by <a href="https://www.deviantart.com/aurorayok" target="_blank" rel="noopener noreferrer">AuroraYok</a> · Personal, local showcase</p></footer>
`;

const host = document.createElement('div');
host.id = 'ene-character';
document.querySelector('#home-slot')!.append(host);
const playButton = document.querySelector<HTMLButtonElement>('#play-pause')!;
const replayButton = document.querySelector<HTMLButtonElement>('#replay')!;
const status = document.querySelector<HTMLParagraphElement>('#player-status')!;
let player: ResourcePlayer | undefined;
let current: ResourceId = 'home-greeting';

function showCharacter() {
  const rect = host.getBoundingClientRect();
  const visibleHeight = Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top));
  if (visibleHeight < Math.min(rect.height, innerHeight) * .65) {
    host.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
}

function layout(mode: 'home' | 'desk') {
  document.querySelector<HTMLElement>('.welcome-layout')!.hidden = mode !== 'home';
  document.querySelector<HTMLElement>('.desk-layout')!.hidden = mode !== 'desk';
  document.body.dataset.mode = mode;
  document.querySelector(`#${mode}-slot`)!.append(host);
  document.querySelectorAll<HTMLButtonElement>('.nav-button').forEach(button => {
    const selected = button.dataset.mode === mode; button.setAttribute('aria-pressed', String(selected)); button.classList.toggle('selected', selected);
  });
}
function choose(id: ResourceId) {
  current = id; layout(id === 'home-greeting' ? 'home' : 'desk');
  document.querySelectorAll<HTMLButtonElement>('button[data-resource]').forEach(button => {
    const selected = button.dataset.resource === id; button.setAttribute('aria-pressed', String(selected)); button.classList.toggle('selected', selected);
  });
  document.querySelector('#expression-description')!.textContent = expressions[id];
  if (player) {
    document.querySelector<HTMLElement>('#desk-slot')!.style.setProperty('--anchor-y', `${player.manifest.resources[id].anchor.y * 100}%`);
    player.select(id);
  }
  showCharacter();
}
document.querySelectorAll<HTMLButtonElement>('button[data-resource]').forEach(button => button.addEventListener('click', () => choose(button.dataset.resource as ResourceId)));
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.addEventListener('click', () => choose(button.dataset.mode === 'home' ? 'home-greeting' : current.startsWith('desk-') ? current : 'desk-normal')));
document.querySelector('#say-hello')!.addEventListener('click', () => { choose('home-greeting'); player?.replay(); });
playButton.addEventListener('click', () => {
  if (player?.status.requestedPlayback) player.pause();
  else { player?.play(); showCharacter(); }
});
replayButton.addEventListener('click', () => { player?.replay(); showCharacter(); });
document.querySelector<HTMLSelectElement>('#format')!.addEventListener('change', event => player?.setFormat((event.target as HTMLSelectElement).value as 'auto' | 'webp'));
document.querySelector<HTMLSelectElement>('#backdrop')!.addEventListener('change', event => document.body.dataset.backdrop = (event.target as HTMLSelectElement).value);

try {
  const { manifest, base } = await loadManifest(`${import.meta.env.BASE_URL}ene/manifest.json`);
  player = new ResourcePlayer(host, manifest, base, current);
  document.querySelector<HTMLElement>('#desk-slot')!.style.setProperty('--anchor-y', `${manifest.resources[current].anchor.y * 100}%`);
  const update = () => {
    const state = player!.status;
    status.textContent = state.message;
    playButton.textContent = state.requestedPlayback ? 'Pause' : 'Play';
    playButton.setAttribute('aria-label', `${state.requestedPlayback ? 'Pause' : 'Play'} animation`);
    const resource = manifest.resources[state.resource], rendition = resource.renditions[state.size];
    document.querySelector('#media-details')!.textContent = `${resource.label} · ${rendition.width} × ${rendition.height} · ${state.format.toUpperCase()} · ${resource.durationSeconds} s loop`;
  };
  player.addEventListener('change', update); playButton.disabled = false; replayButton.disabled = false; update();
  window.addEventListener('pagehide', () => player?.pause());
  // A bfcache return keeps explicit pause intent instead of unexpectedly restarting.
} catch (error) {
  status.textContent = error instanceof Error ? error.message : 'Ene’s files could not be loaded.';
  host.classList.add('missing-character'); host.textContent = 'Ene will be right back.';
  const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'transport-button'; retry.textContent = 'Reload character';
  retry.addEventListener('click', () => location.reload()); status.after(retry);
}
