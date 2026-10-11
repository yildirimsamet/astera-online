# Accepted wreck and impact assets

The persistent debris field restores the owner-requested rocky ring from
`5d095d1^`: `/assets/models/debris/debris.glb`, 71,204 bytes, 2,087 triangles.
It is one complete annulus, rotated onto the galaxy disc and flattened to 0.6.
Open-space and planet fields retain their original placement and scale. The planet
pick remains hollow; focus and server decay affect only the field's own cloned
material, which is disposed on unmount.

The rejected new persistent field, its deterministic scatter helper, machinery,
conduit and all unused LOD files were removed. Its earlier performance claims do
not describe the accepted field.

The native GD curved plate `SM_Debris_11` remains solely as explosion ejecta:
`/assets/models/debris/wreck-plate-gd-v3.glb`, 156 triangles, 220,440 bytes.
Its 512px native albedo/normal and 256px ORM preserve metal panel detail.
Strategic impacts use up to 28 instanced pieces (4,368 triangles); ordinary
bombardment uses six (936 triangles). No additional material pass per piece.

Rebuild only that approved impact asset with `node tools/premium-debris-pack.mjs`.
Optional `--candidates` plus `tools/premium-debris-renders.mjs` writes research
artifacts under ignored `out/`, never into the active production manifest.
