# Record Ene with OBS

All `.cmd` launchers are in the project's **deploy** folder.

The local OBS capture setup is ready for testing. Virtual-camera registration, live audio routing and final recording acceptance are still in progress.

1. Open **Start VModel.cmd**, start your camera and calibrate. Choose your frame and background.
2. Choose **16:9** or **9:16**, then **Open output**. Keep this dedicated avatar window visible.
3. Open **Start OBS.cmd**. Then run **Attach OBS Landscape.cmd** or **Attach OBS Portrait.cmd** to match your choice. The helper selects the visible Ene output and crops away browser controls and margins.
4. Check the OBS preview before recording. If you resize the output or change orientation, run the matching Attach helper again. Close extra Ene outputs if the helper reports ambiguity.
5. Stop recording and hide the source with its eye icon in OBS before closing or navigating the captured window. Keep it dedicated to Ene. Window-title selection does not prevent an already captured window from showing a different tab or page, or acquiring another window with the same title.

The profiles use 1280×720 landscape or 720×1280 portrait at 30 fps. A portrait window on this laptop may contain fewer native pixels and be enlarged for recording; a taller display allows a sharper source. Both profiles initially use MKV recording so an interrupted session is more recoverable. In OBS, use **File → Remux Recordings** when you need an MP4 copy.

For lower rendering load, use **Clean view** in the studio instead of a second output window, then run the same Attach helper. **Space** stops the camera and **C** recenters. **Stop recording before pressing Escape**, which restores the studio controls inside that window.

Keep the captured window visible. On this laptop, minimizing it blanked capture; hiding it through Windows froze the last frame, and showing it again did not immediately resume. If capture freezes, disable the source, show the Ene window and reattach before starting another recording. [Window lifecycle evidence](../ops/reports/obs-window-lifecycle.md) records these checks.

Opaque backgrounds preserve Ene's faint digital leg edges. Green screen is optional; chroma key may remove faint edge details or leave green fringes. Check the result against your intended background.

## Audio and virtual webcam

Both **Ene Landscape** and **Ene Portrait** already include **Ene Converted Voice Bridge** and **Ene Natural Voice Bridge**, separate transparent Browser Sources with **Control audio via OBS** enabled and monitoring off. No automatic microphone or desktop capture is configured. Open **Start Voice Studio.cmd** for the three provisional character voices, or deliberately click **Start natural voice → OBS** to use your own speech. The service starts muted, and you do not need to add audio sources manually. Only one mode can send audio; failures never switch to natural voice. The utility **Ene Voice Studio** scene contains these two audio sources; keep an Ene avatar scene selected for avatar recordings.

The converted-reference route passed a bounded recording check; live conversion speed, listening quality and physical lip sync remain unaccepted. Natural mode passed synthetic/mocked-media checks; its physical-device acceptance remains open. No sync offset was invented: new sources start at OBS's zero default and repeat setup preserves existing offsets. See the [voice quickstart](voice-quickstart.md), [converted-source verification](../ops/reports/voice-obs-setup.json) and [natural-source verification](../ops/reports/voice-obs-natural-setup.json). For repair, `node scripts/voice/configure_obs_voice.mjs --attach` restores the converted source, or add `--natural` for the natural source, while voice and OBS outputs are stopped. Each setup preserves the other source, avatar settings and selected scene and refuses unrelated same-name URLs.

Both voice receivers mute and retry after a short service interruption, without starting a microphone or changing modes. For a page that stayed offline, stop voice playback and OBS outputs and run **Start Voice Studio.cmd** again. Its hidden helper refreshes only the two verified local silent receivers and preserves their settings/sync and the selected scene. Active voice/output, unrelated sources or changed keys are left alone; key changes require the repair command above. [Restart and silent-refresh evidence](../ops/reports/voice-receiver-reconnect.md) records the exact tested limits.

OBS Virtual Camera carries video; another app still needs a separately selected audio input. The converted OBS Browser Source does not install a virtual microphone for call apps.

The Windows registration attempt was canceled, so Virtual Camera is not installed yet. When ready, double-click **Install OBS Camera.cmd** and approve the Windows administrator prompt for the verified OBS components. Restart OBS afterward. The helper preserves an existing OBS camera registration and does not start capture. Keep the project folder in place after registration, since Windows refers to the supplied camera modules there.

Virtual-camera playback in another local application still needs verification. Starting it is not the same as starting a public stream; no streaming account or key has been configured.

## Local configuration

OBS and its saved profiles/scenes live in `.tools/obs/`. The Attach helpers use OBS's password-protected WebSocket interface on port 4455. Its private password is in the ignored portable configuration; do not include that folder when sharing project code. The app itself serves only on the laptop's loopback interface.

See [capture evidence](../ops/reports/obs-capture.md) for the exact tested setup and remaining checks.

## Never minimize the Ene output window

**Minimizing the output window stops the avatar and blanks the capture.** This is measured, not a precaution: a minimized Chrome window delivers **zero** animation frames, and OBS has nothing current to capture, so the scene goes blank.

- **Covering it is fine.** Put any window you like in front of it, full screen included. Measured at a full 60 frames per second while completely covered.
- **Minimizing it is not.** Frame delivery drops to zero until you restore the window.
- **Restoring fixes it immediately**, with no restart and no settings to change.

If the avatar freezes or your OBS scene goes white mid-stream, check the taskbar first: the output window has almost certainly been minimized.

Details and measurements: [minimizing the output window](../ops/reports/capture-minimize-cause.md).
