/**
 * A BLUR OF EACH SHIP PAINTING (owner phone playtest 2026-11-19): 24 by 16 pixels, drawn at once under the
 * painting until it lands, so the ship's page never opens on a black frame. Made from the paintings in
 * `public/assets/images/starter` (Pillow: LANCZOS to 24x16, WebP quality 40); remake them when one changes.
 */
export const HERO_PLACEHOLDERS: Readonly<Record<string, string>> = {
  'seed-patched': 'data:image/webp;base64,UklGRqgAAABXRUJQVlA4IJwAAADwAwCdASoYABAAPu1iqU2ppaOiMAgBMB2JZACdAywBai/TZaUWkxQIAP7s/Qmac1vlnqT6bFTMl3wyiRMeLaVsX4KBbMNQs2mzPO2dTDbkVpKDg3ujwWXXo0X06ZDhpSH80Pak7+4gbs2Ovl0Lo3McjQ0B62KBBa7lfO5pqZApwMBidY1L8VtYvUvBK+rZeKsdCYDW9UNSBCunwAA=',
  'seed-renewed': 'data:image/webp;base64,UklGRr4AAABXRUJQVlA4ILIAAACwBACdASoYABAAPu1iqU2ppaOiMAgBMB2JZgC7MoAlshbysW1mGe0ZaFPwuCZQAP7s/QmadNspEpwyWXm59vFBz/PF6gMEs5uEKdYQKhyvoIncqv+U4gl976uXnr1bxTje2n9dagU2S/G580b/ND15FesoIRJ1z1hPK565UopNPKf5rNI3leP/ClLpXS5j9+RlpJIUHLq0oZSiGpRNG4R8tAL2ue6BhmPuKW6EB19ILAAA',
  'seed-wrecked': 'data:image/webp;base64,UklGRp4AAABXRUJQVlA4IJIAAAAwBACdASoYABAAPu1iqU2ppaOiMAgBMB2JQBOgBA/+iqM5YNHrlc1DGkwA/uz9CZp029B3Sjr4HgZ7KeJDl99/maAh0cznYFyMNTG8WStCVypMaMA3spzN2i7pCLIs9lyMKquXvI+YFF6eEZDYcEV5mSW7+65Dep21MH+p+WIXoTQBystVhSVmN1A/LyokBooAAA==',
  'spine-patched': 'data:image/webp;base64,UklGRpAAAABXRUJQVlA4IIQAAAAwBACdASoYABAAPu1iqU2ppaOiMAgBMB2JYwCsACIj+se7zep/4KEDLIAA/uy61hW4Y8ndcscG/kWn9j4QaHiByyoc1Xb/+YC5Ov/fMLIpI/KPuy5GFrqmchExn07pLdIAHYi6bH+3hfdVqQ0xT+CtianKXwSvphSdk7khc89XSRIAAAA=',
  'spine-renewed': 'data:image/webp;base64,UklGRqYAAABXRUJQVlA4IJoAAADQAwCdASoYABAAPu1iqU2ppaOiMAgBMB2JQBadBA/9IMdGv5hjDwAA/uz9CZp029AB4y3kyFvbnV5/G0m9dbjNAP2CuuXY5w4nR8JV1wbtLYL0WrBPuElk3Obo+jTke2UHvrpCnIuGJ3jUjPD6NK/pt9J5TErhEogFmcn0KnrEwsV2nX/LWHbirqgVvFoeSA8O0jyQOXYIwAAA',
  'spine-wrecked': 'data:image/webp;base64,UklGRpAAAABXRUJQVlA4IIQAAAAQBACdASoYABAAPu1iqU2ppaOiMAgBMB2JQBadA3aXBBUPHJFA0JajYAD+7Qh4IAbjKKKzJ0oqa70L2NOoTJBX11Xc9sw6jCrMHkB6WMJl3Cx13lbke2UHtZQQiVVki6iTkSZHYWfXONI38ErvmHibA6n+7Mh/T1LwR0XJi+7gc7dMIAA=',
  'wedge-patched': 'data:image/webp;base64,UklGRpAAAABXRUJQVlA4IIQAAABwBACdASoYABAAPu1iqU2ppaQiMAgBMB2JQBOgBA/+BF7tjpRiDNtUf8KuAAD+7P0JmnTb0EU2Xu2wobX3l9gJq9lZ/Ivvluiex5M78cAw7aYNRkwX+4zypGfDm1FlPaQpP27kHlz5jjTHuq47/2znP9xB6YgZKrCixzamoCALEiHCoAA=',
  'wedge-renewed': 'data:image/webp;base64,UklGRsoAAABXRUJQVlA4IL4AAAAQBQCdASoYABAAPu1iqU2ppaOiMAgBMB2JagC7MoGv/2RgRG4t/rsLeSrkV++UPA4AAP7s/QmadNsyXPYzmmDlyRjmMnDIfE0yYI3gvJACfEICwOKMz2Ph9z1KkrtRLf9p5VR8w2ODJAi4btNXbgK8PVAGcS+1uW7yu5BbZVpXdbG84Xg9vlDjv9bV97blrQXitm1PII+MbTRgU5OPD/ZBGyONnaUh3ZvpDjrNxEEq81ylLCjqob+lJzuXoAAA',
  'wedge-wrecked': 'data:image/webp;base64,UklGRowAAABXRUJQVlA4IIAAAAAwBACdASoYABAAPu1iqU2ppaQiMAgBMB2JYwCsACB/8Bh7wxZljhg/loAA/uz9CZp029BFJpF/6WORINerG5KSSzhcn45YiPKYhMXMnPER501PJZvg/spdirZplIxnFRI49QW3+a8B8PIdW8rLzMxXYpyC7RnfClNpqIAvKSXAAA==',
};
