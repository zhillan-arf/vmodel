# Rebuild Ene's website animations

The local toolchain is already installed. Run these commands from the repository root in PowerShell. They use the existing Ene Cyber legs source, Blender/MMD Tools, FFmpeg/libvpx/libwebp and the separate website showcase. They do not need a camera, microphone, paid service or model upload.

The five resource names are `home-greeting`, `desk-normal`, `desk-confused`, `desk-surprised` and `desk-excited`. Each resource has two sizes, transparent WebM and animated WebP, and WebP/PNG posters. The greeting is five seconds; the four desk states are three seconds. All source actions and WebM renditions run at 24 fps. WebP uses integer-millisecond frame delays, making a complete loop one millisecond shorter in the measured encoder output.

## Rebuild existing media

```powershell
python scripts/produce_web_resources.py desk-confused
```

This verifies the accepted scene hash and reuses complete, matching RGBA master frames. It renders missing or damaged frames, checks their PNG integrity and SHA-256, encodes both sizes, fully decodes every result and verifies alpha/timing/size before staging the family. Repeating the command uses verified caches. Omit the resource argument to process all five in order, using one render or encode process at a time.

```powershell
python scripts/produce_web_resources.py
python scripts/audit_web_production.py
```

Only completed families appear in the temporary `web-showcase/public/ene/partial-manifest.json`. Once all five are complete, the script writes `manifest.json` and removes the temporary manifest. The final public folder contains exactly 40 family files, one known-alpha probe and one manifest. It is locally staged and ignored by Git; this command does not deploy a site.

The exact per-family master locations are recorded in [the private production build manifest](../../assets/work/ene-web/production-build.json). Their content-addressed directories prevent old and revised source frames from mixing. The per-frame index records source frame numbers, settings, camera, hashes and measured render times. PNG masters stay in `assets/work/ene-web/`, outside the served showcase.

## Pause a long render

```powershell
New-Item -ItemType File -Path assets/work/ene-web/production.pause
```

Blender completes its current frame, records a paused checkpoint and exits. If encoding is already running, that family finishes encoding before the batch observes the flag. The batch does not start another stage while the flag exists. After the process has stopped:

```powershell
Remove-Item -LiteralPath assets/work/ene-web/production.pause
python scripts/produce_web_resources.py
```

The renderer fixes CPU threads at four and uses one Blender process. Stop it through the pause flag before comparing webcam/voice/browser performance. Normal code and document work can continue during rendering.

## Change a performance through the supported recipe

The five editable pre-secondary scenes are `assets/work/ene-web/<resource>-authoring.blend`. The matching `<resource>.blend` scenes contain the final body/face keys and baked secondary motion. Both reopen with active editable actions; original PMX/VMD, G1 source and the VRM remain separate.

For reproducible changes, edit [performance configuration](../../config/web-resources/performances.json) or [the authoring script](../../scripts/author_web_performances.py), then regenerate only the selected isolated scene. Regeneration builds from the configuration and source; it does not import manual changes from an authoring scene, so preserve any manually edited scene separately before running it.

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe' -b --python-exit-code 1 --python scripts/author_web_performances.py -- desk-confused
& 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe' -b --python-exit-code 1 --python scripts/audit_web_performances.py -- desk-confused
& 'C:/Program Files/Blender Foundation/Blender 5.1/blender.exe' -b --python-exit-code 1 --python scripts/audit_web_baselines.py
python scripts/produce_web_resources.py desk-confused
```

Review changed expressions, fingertips, contact, hair, framing and the loop before accepting a regenerated scene. The geometry checks prove finite positions, matching loop endpoints and locked desk anchors; they do not replace visual review or certify every possible collision. The secondary motion is a deterministic authored angular-following bake with warm-up, not an unrestricted collision simulation.

The frame after each scene's output range is the matching loop endpoint: frame 121 for the greeting, frame 73 for desk states. It is retained for editing/auditing and excluded from output. The visible motion comes from actual Ene bones and face keys. The greeting is a new Ene-specific nod/wave informed by the inspected VMD gesture, as documented in [its adaptation report](web-resource-greeting.md).

## Inspect or integrate the output

```powershell
npm run web:dev
```

The separate showcase runs at `http://127.0.0.1:5180`. To verify its distributable code and locally staged media:

```powershell
npm run web:build
npm run web:preview
```

Preview uses `http://127.0.0.1:4180`. The existing VTuber camera app has separate commands and assets. The showcase's source manifest uses relative URLs, normalized anchors and measured dimensions/bytes/hashes; [its schema](../../config/web-resources/manifest.schema.json) is the integration contract. Keep the player and its known-alpha probe/fallback behavior when embedding it elsewhere. Animated WebP has no native media timeline: pause substitutes the poster, and resume can restart the animation.

Final encoded/source comparisons can be recreated locally:

```powershell
python scripts/prepare_web_production_review.py
node scripts/review_web_production.mjs
```

These place private matched-frame comparisons under `ops/reports/local/web-production-review/`. The actual final production and browser acceptance reports record what was observed; a successful build alone does not establish real Safari/iPhone/Android coverage.

Credit remains **AuroraYok / yokkaulove** for this Ene edit, with the supplied model's contributor readmes retained. The user's permission covers this local project. Keep original PMX/VMD, Blend scenes, VRM, textures and master sequences out of the served/distributed software. Rendered character media are separately staged for this authorized local website use; no public deployment occurs in this workflow.
