# Ene website showcase

The showcase has a welcome page with Ene's full-body greeting and a desk scene with four expressions. Its text, backdrop, desk and sample chat are ordinary HTML/CSS; only the character is animated media. It does not use a webcam, microphone, account or streaming service.

All five final 24 fps media families are installed and the player/layout pass the [production browser checks](../ops/reports/web-showcase.md). The [G4 acceptance report](../ops/reports/web-resource-acceptance.md) includes passing local Windows loading, sustained playback and ten-minute lifecycle measurements; actual Safari/iOS/Android remains untested. If a copied installation lacks `ene/manifest.json`, the page explains the missing package and offers a reload.

## Open locally

From the project folder, run:

```powershell
npm run web:dev
```

Open **http://127.0.0.1:5180/**. Leave that terminal open while using the page; **Ctrl+C** stops this server. It is separate from the webcam studio on port 4173. The installed Node/npm dependencies are shared, but its media directory and build are isolated.

Build and check the installed final package with:

```powershell
npm run web:build
node scripts/audit_web_bundle.mjs
npm run web:preview
```

The production preview opens at **http://127.0.0.1:4180/**. Vite serves `web-showcase/dist`, containing website code and the declared rendered files. The avatar, tracking models, voice tools, source PMX/VMD/Blend files and private recordings are outside that build. These commands only serve locally; they do not publish the site.

## Use the page

Choose **Welcome** or **At the desk**, or select one of the five moment buttons. **Pause**, **Play** and **Replay** control the selected animation. All controls work with Tab and Enter/Space. The desk and raised palm stay within the phone layout; the desk's height comes from the resource's normalized contact anchor.

The player initially loads the chosen poster, then only its selected animation. It checks a tiny local video's decoded transparency and uses animated WebP if WebM alpha does not work. Reduced-motion and supported data-saving settings start with a still; select Play to opt into movement. Offscreen and hidden-tab playback rests automatically. An explicit pause remains paused when the page becomes visible or the expression changes.

WebM pause retains its current frame. Animated WebP has no native pause timeline, so pausing removes the animation and shows its poster; Play starts the loop again. A missing or failed animation keeps a usable still and explains how to retry. Missing posters try PNG once. A failed manifest offers **Reload character**.

**View display options** contains light, dark and checkerboard backdrops plus an explicit **Compatibility (WebP)** choice. These are review controls; the normal page does not display file sizes or implementation details. The chat is an illustrative scene with no messaging backend.

## Reuse the player

Copy `web-showcase/src/manifest.ts`, `alpha.ts`, `player.ts` and `player.css` into a TypeScript website. Keep the final `ene/` media directory intact and retain the model credits/terms. Import the small player stylesheet and give the host a width:

```ts
import './player.css';
import { loadManifest } from './manifest';
import { ResourcePlayer } from './player';

const host = document.querySelector<HTMLElement>('#character')!;
host.style.width = '360px';
const { manifest, base } = await loadManifest('./ene/manifest.json');
const ene = new ResourcePlayer(host, manifest, base, 'home-greeting');

// On an expression control:
ene.select('desk-excited');
// Playback controls:
ene.pause();
ene.play();
ene.replay();
// When permanently removing this component:
ene.dispose();
```

`loadManifest` resolves asset paths against the manifest's directory. Supply another explicit manifest URL when integrating under a different path; files must remain in that directory or a child directory. A separate media origin needs appropriate CORS headers for decoded-alpha inspection. `player.status` and its `change` event provide playback state for your own accessible controls. Do not preload all five movie files just to build an expression menu.

The reusable component maintains fixed aspect ratio, loads one rendition per selection and retains at most one animation element. A short still-frame transition bridges state changes; it releases the superseded video/image before starting another. Its backdrop and desk are not part of the media or component, so your website supplies those layers.

The personal model package and generated media remain local/private under the supplied terms. Software licensing and character-use permission are separate. Final-file functional checks pass in Windows Chrome, Edge, Firefox and Playwright WebKit; actual Safari/iPhone/Android hardware remains unverified unless separately recorded.

The [resource rebuild guide](../ops/reports/web-resource-rebuild.md) covers changing a performance in its editable scene, rebuilding one media family, and pausing/resuming the renderer. Keep PNG masters and authoring scenes outside the website directory.
