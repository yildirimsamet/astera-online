# Astera Online app icon

`AsteraOnlineLogo.png`: original owner-supplied image (2026-11-03), preserved unchanged.

`app-icon-master.png`: full-bleed adaptation produced with the built-in imagegen tool from that original. The baked rounded tile/rim was removed, surrounding art extended to opaque square edges, and lettering composed inside the circular mask. The owner requested that the icon fill the phone's rounded shape without an inset tile or empty border. Prompt: `app-icon.prompt.txt`.

`play-store-icon.png`: 512 × 512 RGB PNG, Lanczos downsampled and losslessly compressed without metadata. Android uses the same opaque image for launcher/splash. Its adaptive foreground has a 16% inset on the Android 108 dp layer, covering the 72 dp masked viewport with slight overscan. Legacy 48/72/96/144/192 px circular variants mask the full image, without shrinking it. Notifications retain the separate monochrome emblem.

Web favicons (32/64 px plus ICO), Apple touch (180 px), PWA icons (192/512 px, including maskable), and shared logo PNGs use this same master. All six localized manifests point at the updated icons with a cache version; application identity/start URLs stay stable.

Production /assets/ is immutable for one year. Shared website logo URLs therefore use the content hash directory `logos/99a78ad6f43f/`; the previous unversioned artwork stays intact for older clients.

`play-store-icon-512-rgba.png` is the 512 × 512, 32-bit RGBA PNG prepared for the Google Play store listing upload; its visible pixels match the other icon variants.
