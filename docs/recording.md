# Make a video with Ene

The recording path has passed short local tests. Your final camera/voice performance still needs acceptance; the reference clips are examples of the output format.

1. Open **Start VModel.cmd**, choose your camera, click **Start camera**, then **Recenter & calibrate**.
2. Choose **16:9** for a landscape video or **9:16** for a vertical short. Set the frame, zoom and background, then **Open output**.
3. Open **Start OBS.cmd** and run the matching **Attach OBS Landscape.cmd** or **Attach OBS Portrait.cmd**. Check that the OBS preview shows only Ene and responds to movement.
4. Confirm the intended audio source moves the OBS meter. The starter scenes deliberately contain no default microphone or desktop audio source; final converted-voice routing is still being integrated. Do not assume a silent starter scene is ready for a speech recording.
5. Click **Start Recording** in OBS. Speak and move, then click **Stop Recording**. Wait until OBS has finished writing the file before switching profiles or closing it.
6. Open **File → Show Recordings**. The profile saves MKV files in the project's `recordings/` folder. To make an MP4, use **File → Remux Recordings**, choose the MKV and start remuxing. Keep the original MKV until you have checked the MP4.
7. Play the result before posting it. Check voice level, mouth timing, portrait framing and whether hands/hair remain visible. No launcher uploads or posts your video.

For the final check, record at least one minute in each orientation: speak, blink, turn your head and raise/bend each arm while showing your hands. The [movement checklist](live-check.md) also covers standing. Keep raw webcam footage out of these recordings.

Keep the Ene output window visible and dedicated to the avatar. Reattach after resizing. **Never minimize it while recording.** A minimized window produces no frames at all — measured at 60 frames per second normally and 0 while minimized — so the avatar freezes and the recording goes blank until you restore it. Covering it with other windows is fine; the studio also tells you afterwards if its window was hidden. Before leaving Clean view or changing/closing the captured window, stop recording and disable its source with the eye icon in OBS. See [OBS setup](obs-setup.md) for the measured window limitations.

The [recording report](../ops/reports/obs-recording.md) links the short landscape/portrait MP4 fixtures and the tested encoder settings. Those clips use prerecorded reference audio; they do not certify live voice performance.
