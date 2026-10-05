# Rei v2 appearance review

Date: 2026-10-05.
Status: User review and physical tests remain open.

Rei v2 is a separate appearance candidate.
The [plan](rei-v2-plan.md) defines its scope.
The original Rei remains available in the model list.

## Files

| File | Use |
| --- | --- |
| [Image comparison](../reports/local/rei-v2/index.html) | Compare ten views of the original and edited models. |
| [Rei v2 VRM](../../../../assets/avatars/rei-v2.vrm) | Load the edited model in a VRM application. |
| [Blender source](../../../../assets/work/rei-v2/rei-v2.blend) | Edit the model, materials, and expressions. |
| [Recipe](../../../../config/avatars/rei-v2.json) | Specify repeatable changes to the original VRM. |
| [Build report](../reports/rei-v2-build.json) | Check source hashes, changes, and preserved data. |
| [Browser report](../reports/rei-v2-comparison.json) | Check expressions, poses, springs, and output dimensions. |

The model binaries, Blender file, and images remain local.
Git excludes those files.
The source terms remain in `public/avatars/rei-v2-notices/`.
Rei v2 has the original asset restrictions.
The use of open-source tools does not remove those restrictions.

## Appearance checks

1. Open the image comparison.
2. Compare the hair boundaries in the front and side views.
3. Compare the eyelashes, eyebrows, eyes, and jaw boundary.
4. Examine the mouth and closed eyelids for unwanted lines.
5. Examine the shoulders and cuffs in both raised-arm views.
6. Compare the extended and bent fingers in the peace-sign view.
7. Compare the studio, warm, and violet light settings.
8. Record the preferred model and any visible defect.

Both models use equal camera and light settings in each pair.
Both models use the same direct poses.
The brow comparison uses the new controls only on Rei v2.
These images do not establish camera accuracy.

| Item | User result |
| --- | --- |
| Hair outlines | Not reviewed |
| Face and eye appearance | Not reviewed |
| Blink and mouth appearance | Not reviewed |
| Brow movement | Not reviewed |
| Shoulders, cuffs, and fingers | Not reviewed |
| Preferred light setting | Not selected |
| Overall appearance | Not accepted |

## VModel setup

1. Start VModel with the existing local launcher.
2. Select **Rei v2 · Appearance test**.
3. Set **Face controls** to **More detail**.
4. Set **Light** to **Warm**.
5. Set **Frame** to **Upper body** or **Face**.
6. Set **Camera field of view** to `42`.
7. Set **Output size** to **1080p**.
8. Start the camera.
9. Face the camera with relaxed brows and a closed mouth.
10. Select **Recenter & calibrate**.
11. Select **Neutral** to use continuous facial controls.

More detail uses the available mouth and brow controls.
It uses camera estimates, not measured speech sounds.
Some models lack the added Rei v2 brow controls.
In More detail mode, Smile and Surprise replace continuous facial controls until you select Neutral.
Basic mode retains the earlier face controls.
VModel saves appearance settings for each model hash.
It saves facial calibration for each model, camera, movement mode, and camera size.

## Physical checks

1. Open the output window.
2. Verify both `1920 × 1080` and `1080 × 1920` output sizes.
3. Raise each eyebrow separately.
4. Close each eye separately.
5. Open your mouth, smile, and round your lips.
6. Cover your face for one second.
7. Remove the cover and examine recovery.
8. Run the existing [human procedure](human-test.md) with Rei v2.
9. Record a 15-minute combined camera and output session.
10. Save the trace, video, settings, computer details, and observations together.

The original motion targets remain unchanged.
The target computer must supply the performance evidence.
Software graphics tests cannot establish GPU frame time, camera delay, or gesture accuracy.
If 1080p is too slow, record the result before you compare 720p.
Do not treat a lower output size as a passed 1080p test.

## Rebuild and check

Run these commands from the repository root:

```bash
python scripts/build_rei_v2.py
blender --background --python-exit-code 1 --python scripts/rei_v2_blender.py
blender --background --python-exit-code 1 --python scripts/check_rei_v2_blender.py
npm test
npm run build
npm run test:rei-v2
node scripts/v2_studio_smoke.mjs rei-v2
```

The recipe requires the original Rei file with the recorded hash.
The Blender command requires the local add-ons from the existing setup.
The recipe produces the tested VRM directly.
The Blender file supplies editable source work.
Changes made in Blender require a separate export and the same checks.
