# Intermittent black rectangles — investigation, 2026-10-12

The owner reports very brief black squares or rectangles in Chrome on this PC.
Another desktop user has reported the symptom too. The large rectangles in the
owner's supplied image are annotations showing approximate locations, not a
captured faulty frame. The owner requested continuous gentle camera movement
during reproduction attempts.

## Relevant upstream evidence

[Three.js issue 27878](https://github.com/mrdoob/three.js/issues/27878) documents
flashing black quads with Bloom and custom shaders. Investigation identified NaN
values produced by the shader and spread by Bloom. Its maintainers and Chromium
developers explain that GPU implementations handle invalid arithmetic differently;
the application must avoid it. This is a matching failure mechanism, not proof
of the cause of Astera's current report.

[Postprocessing issue 547](https://github.com/pmndrs/postprocessing/issues/547)
reports camera-dependent black squares whose size increases with Bloom levels.

There are also [NVIDIA PRIME desktop presentation reports](https://forums.developer.nvidia.com/t/noticeable-flickering-around-recently-changed-screen-areas-on-multiple-laptops-with-nvidia-prime/335316).
Those reports concern screen presentation outside the shader pipeline and do not
establish that Astera's fault is a driver bug. No browser, OS or driver settings
were changed on the owner's machine.

## Measurements

Local, ignored artifacts: `out/premium-assets/black-artifacts/`.

- Chrome 141 with ANGLE OpenGL ES, using the PC's actual Intel UHD and NVIDIA
  GTX 1650 Ti GPUs. SwiftShader was not the basis for these reproduction attempts.
- Intel: 100 frames reading the scene, luminance pass and all down/up Bloom levels;
  then 1,680 frames across the native drive and all six paid engine effects.
- NVIDIA: 4,200 frames with continuous gentle camera movement across those seven
  drive choices on the Scorpion skin. Every presented WebGL frame was checked for
  black runs; scene/luminance values were also sampled periodically.
- NVIDIA normal galaxy components: another 1,440 frames across the fleet, planet,
  asteroid and wreck scenes with gentle camera movement.
- No nonfinite values or black rectangles were reproduced in those framebuffer
  measurements. The live luminance pass was enabled and its compiled GPU shader
  contained `asteraFinite`, not just the source string in application memory.
- A separate half-float texture experiment deliberately injected NaN, positive
  infinity and negative infinity. With the luminance guard absent, invalid values
  spread through every Bloom level, affecting 4,096 channels in the final 64×64
  blur target. With the shipped guard present, all levels remained finite. This
  validates the measurement and that particular existing guard on this GPU.
- Readback forces GPU synchronization and could hide a presentation/timing fault.
  Therefore two additional 45-second Chrome videos were captured without per-frame
  readback: the Scorpion/Aurora inspector and ordinary fleet scene. The camera kept
  moving gently. Video analysis flags dark sky/compression blocks as candidates;
  the inspected candidate images do not show the reported flashing rectangles.
  These recordings do not prove the intermittent fault is gone.

The controlled plume boundary probe also produced no nonfinite render-target
values on either tested GPU. No speculative shader rewrite was applied based on
that probe.

## Current conclusion

The owner ended this investigation on 2026-10-12 after the reproduction attempts
did not capture the fault. No speculative rendering change was applied.
The intermittent report remains unresolved. The existing Bloom-input guard is
working in the tested live scene and in the injected-invalid-pixel experiment.
The engine program cache and transparent draw-order defects were independently
reproduced and corrected; they must not be presented as a proven fix for this
separate report. A captured faulty frame, correlated with the pre/post-Bloom
buffers and browser presentation, is still needed to identify its source.
