# Astera Online — orbital loading film

Editable source: `astera-loading.blend` (Blender 5.2.2 LTS).

The active scene is **Astera • Orbital Loading**. The recovered planet scene **Scene** is preserved separately. The original Astera logo is packed inside the file; no external image or font is needed to open and render it. All motion is stored as native animation keys, with no script drivers or runtime handlers.

## Playback and delivery

Final files are under `out/astera-loading/`:

- `astera-loading.webm` — VP9 browser delivery, silent, 1920 × 1080.
- `astera-loading.mp4` — H.264 fallback, silent, 1920 × 1080, fast-start.
- `poster.png` — full-resolution lossless still; `poster.webp` — smaller browser / reduced-motion fallback.
- `preview.html` — standalone looping player, with no application changes.
- `frames/loading-0001.png` through `loading-0240.png` — full-resolution master sequence.
- `preview-v1-*.png`, `preview-v2-*.png`, `preview-v3-*.png` — visual iteration evidence.
- `scene-tests.log`, `media-verification.json`, `final-render.log` — validation.

The loop is **8 seconds at 30 fps**. Render **frames 1–240**. Frame **241** is an endpoint for matching the start, and must not be exported as a duplicate frame. The titanium ring has 32 identical sectors and turns 11.25° every 8 seconds, equivalent to a 256-second full revolution. Its geometry matches at the boundary while movement continues in the same direction. Camera, illumination and stars follow small periodic paths.

The main collections are **01 • Astera Identity**, **02 • Orbital Structure**, **03 • Deep Space**, and **04 • Camera and Cinematic Lights**. The original lockup plane keeps its native aspect ratio and uses smooth alpha blending. Its material applies restrained saturation, an alpha contrast curve that softens the source artwork's supplied haze, and a small, returning light variation. The inclined physical ring has chamfered titanium rails, graphite recesses and small navigation accents; its rear is subdued. No compositor flare or added bloom is required.

## Re-render

From the repository root (the NVIDIA offload environment selects the discrete GPU on this laptop):

```sh
mkdir -p out/astera-loading/frames
env __NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia \
  /home/yildirim/Desktop/Blender-5.2.2/blender \
  --background assets/source/cinematics/astera-loading/astera-loading.blend \
  --render-anim
```

Or open the `.blend` in Blender, keep the production scene active, and choose **Render → Render Animation**. The saved render camera, Eevee settings, frame range and PNG sequence path are configured.

To validate the saved scene:

```sh
/home/yildirim/Desktop/Blender-5.2.2/blender \
  --background assets/source/cinematics/astera-loading/astera-loading.blend \
  --python-exit-code 1 \
  --python assets/source/cinematics/astera-loading/test_scene.py
```

To rebuild the production scene from the inspected recovery file:

```sh
env __NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia \
  /home/yildirim/Desktop/Blender-5.2.2/blender --background /tmp/quit.blend \
  --python-exit-code 1 \
  --python assets/source/cinematics/astera-loading/build_scene.py -- --preview
```

Rebuilding requires the original repository logo. Start from the inspected recovery file, not the finished production file, to avoid duplicate scenes. Rendering and editing the finished packed `.blend` do not depend on `/tmp/quit.blend`.

Encode the master sequence using ffmpeg:

```sh
ffmpeg -framerate 30 -start_number 1 \
  -i out/astera-loading/frames/loading-%04d.png -frames:v 240 \
  -an -c:v libvpx-vp9 -crf 28 -b:v 0 -pix_fmt yuv420p \
  -row-mt 1 -deadline good -cpu-used 2 \
  out/astera-loading/astera-loading.webm

ffmpeg -framerate 30 -start_number 1 \
  -i out/astera-loading/frames/loading-%04d.png -frames:v 240 \
  -an -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p \
  -movflags +faststart \
  out/astera-loading/astera-loading.mp4
```

Use `autoplay muted loop playsinline`, with the poster visible until the video can play. Keep the full frame visible (`object-fit: contain`) so narrow displays retain the identity and ring. Respect reduced motion by displaying the poster instead of starting the video. Avoid adding an artificial progress value or minimum wait time.

## Validation

Six scene tests cover original source preservation, packed artwork and aspect ratio, an upright centred wordmark at every frame, lettering clearance, bounded geometry, periodic animation endpoints and continuous slow ring motion. Visual review includes three preview iterations plus the final full-resolution sequence and encoded seam. See `production-notes.md` for source inspection and scope.
