# VModel quickstart

The local studio includes Ene Cyber legs and Rei. Existing OBS scenes keep their Ene names and capture either selected model. Live movement quality and final recordings are still being tested. The [acceptance report](../ops/001-zhil/sprint-001/reports/acceptance.md) records completed components and remaining checks.

## Open your studio

Double-click **Start VModel.cmd** in the project's **deploy** folder. It opens the local studio in your browser. After the initial setup, the avatar and tracking models run on the laptop without a cloud account.

The launcher uses the tested installed Chrome and reuses an already running studio. **Stop VModel.cmd** stops only the server it owns; the production app then releases an active camera after detecting that disconnect, normally within four seconds. Close the studio/output windows when finished. The normal **Stop** button releases the camera immediately without closing the app.

If a build is missing, **Setup VModel.cmd** installs the pinned app dependencies, provisions the tracking files and builds the app. Initial setup needs an internet connection and the already installed Node.js and Python 3.10 or newer. Codex handles authoring tools and model preparation; you do not need to rig the model yourself.

## Choose a model and move

Choose **Ene** or **Rei** from **Model**. Switching models also updates the output view; your camera and studio settings stay available.

1. Click **Start camera** and allow camera access for the local page. Choose your laptop camera if more than one is listed.
2. Face the camera in comfortable lighting. Click **Recenter & calibrate**.
3. Start with **Seated**. Turn your head, blink, open your mouth, lean and raise your arms. Keep hands visible when testing finger tracking.
4. For **Standing**, move back until both your head and feet fit in the camera frame, then calibrate again.
5. Click **Stop** when finished. The camera stream and tracking worker are released.

The camera preview is hidden by default. **Show camera preview** helps check framing; it remains in the controls and does not appear in the output window. Lost/hidden limbs return toward an idle pose. Single-camera tracking cannot reliably see behind your body.

**Camera size** offers a lighter 640×480 input or 1280×720 for more detail. Press **Start camera** after changing it. **Hair & accessory motion** defaults to Gentle; choose Full for more movement or Off to disable secondary motion.

Use **Head movement range** to reduce or increase turns, **Mouth sensitivity** if Ene's mouth feels too subtle, and **Response speed** to balance smoothness against quicker movement. Hands work best facing the camera with wrists visible. Standing mode uses a simple ground-height correction while both feet are visible; it is not foot locking or reliable jump capture.

## Frame and capture

Choose **Full avatar** or **Close-up**, then **16:9** for landscape or **9:16** for portrait. Use **Zoom** to frame Ene and choose a background. **Open output** creates a clean window that shares the camera with the controls. Capture its avatar canvas in OBS Window Capture. Keep both windows visible. The separate window adds rendering work; **Clean view** uses the current window when you need lower load. In Clean view, press **Escape** to restore controls, **Space** to stop the camera, or **C** to recenter.

Output is composed at 1280×720 or 720×1280. Resizing a window preserves that shape and adds margins if needed; crop those margins when fitting the canvas in OBS. **Green screen** selects a key color, but Ene's faint digital edges need care when keying. A normal opaque background preserves those details.

Your look settings save separately for each avatar. Neutral calibration saves for the same avatar, camera, capture size and movement mode; switching any of those calls for a new neutral pose. **Save settings** and **Load settings** transfer the current avatar's look settings. **Reset settings** clears its saved neutral poses as well. Recalibrate whenever your seat or camera position changes.

OBS is installed locally. **Start OBS.cmd** opens its prepared scenes; **Attach OBS Landscape.cmd** and **Attach OBS Portrait.cmd** select and automatically crop your visible Ene output. Reattach after resizing. Stop recording before leaving Clean view or navigating its window. See [OBS setup](obs-setup.md). Virtual-camera registration was canceled at the Windows prompt and is still pending; final audio routing and recording acceptance remain in progress. An opaque background is the current capture baseline.

## If something goes wrong

- **Permission denied:** allow camera access for this local address in the browser's site settings and retry.
- **Camera busy:** close another application using the physical camera. OBS should capture the avatar window, not the same physical webcam.
- **Slow movement:** try **Low power**, disable hand tracking and use a single clean view. The full combined performance benchmark is still pending.
- **No model:** use **Load another VRM**, or restore `assets/avatars/ene.vrm` and rerun setup. PMX requires conversion; VMD is an animation file.
- **Tracking stopped:** stop/start the camera and report the message beneath the stage. A saved compatible calibration returns automatically; recenter if your position changed.
- **Port in use:** close the conflicting program using port 4173; the launcher will not terminate unrelated programs.

Your source model remains in `ops/001-zhil/sprint-001/resources/ENE/`. The editable imported source is `assets/work/ene/source.blend`; the export working scene is `assets/work/ene/vrm-work.blend`. Keep the model package and generated avatar local, with its original attribution/readmes.

The [conversion recipe](avatar-conversion.md) documents the validated avatar and how to regenerate it. The [avatar report](../ops/001-zhil/sprint-001/reports/ene-avatar-validation.md) covers the rig, expressions, texture checks and spring tests. Use the [recording guide](recording.md) and [movement check](live-check.md) for the next steps. The complete live performance/recording acceptance is still in progress.

## Optional character voice

[Start Voice Studio.cmd](../deploy/Start%20Voice%20Studio.cmd) opens the local voice controls at `http://127.0.0.1:5082/`. Three provisional converted reference voices can be compared, selected and saved. Enable headphone monitoring to hear the reference. Microphone access requires an explicit character-microphone or natural-voice action. Live character conversion on this laptop still misses its timing target and mutes late audio. English voice quality and physical lip sync remain unaccepted.

From Command Prompt in the `deploy` folder, `"Start VModel.cmd" -Voice` opens both avatar and voice controls; optional voice failure does not stop avatar startup. `"Start VModel.cmd" -NoBrowser -Voice` starts their services without opening windows. `"Start VModel.cmd" -StopVoice`, or [Stop Voice Studio.cmd](../deploy/Stop%20Voice%20Studio.cmd), stops only the identity-checked voice service and leaves the avatar service running. Default `Start VModel.cmd` continues to start the avatar independently.

Separate character and natural-voice sources are already installed in both Ene OBS scenes, so no manual source setup is needed. **Start natural voice → OBS** deliberately sends your own speech; failures never select this mode and **Stop / mute** silences both routes. See the [voice quickstart](voice-quickstart.md) for monitoring, Stop/reconnect and remaining limits. Converted reference transport and mocked natural controls pass; physical natural-device behavior, continuous character-speech quality, live conversion performance and lip sync remain unaccepted.

Voice receivers retry after a short service interruption. With voice and OBS outputs stopped, running **Start Voice Studio.cmd** again also refreshes the verified silent receivers without changing settings or sync. The microphone never restarts automatically.
