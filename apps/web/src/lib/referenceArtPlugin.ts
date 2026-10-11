import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import shipArt from '../galaxy/referenceArtManifest.json';

const inside = (parent: string, child: string): boolean => {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
};

/** Prepared local art only. The APK archive, raw exports and credentials have no route. */
export function referenceArtPlugin(repository: string): Plugin | null {
  const candidates = [process.env.ASTERA_REFS, resolve(repository, 'astera-refs'),
    resolve(repository, '../blindspace-komutan-gemisi/astera-refs')];
  const directory = candidates.find((path): path is string => Boolean(path && existsSync(resolve(path, 'dist/v2/manifest.json'))));
  if (!directory) return null;
  const root = realpathSync(directory);
  const prepared = resolve(repository, '.dev/reference-art');
  const required = [
    ...['rock-s', 'rock-m', 'rock-l'].map(name => resolve(root, `dist/selected/${name}.glb`)),
    resolve(root, 'dist/fx/explosion.webp'),
    ...Object.keys(shipArt).flatMap(hull => ['', '_lod'].map(suffix => resolve(prepared, `ships/${hull.toLowerCase()}${suffix}.glb`))),
  ];
  if (required.some(file => !existsSync(file) || !statSync(file).isFile())) {
    console.warn('[reference-art] Incomplete optional pack; using Astera assets. Prepare with node tools/premium-reference-assets.mjs');
    return null;
  }
  const types: Readonly<Record<string, string>> = {
    json: 'application/json', glb: 'model/gltf-binary', ogg: 'audio/ogg', wav: 'audio/wav',
    png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', html: 'text/html',
  };
  return {
    name: 'astera-local-reference-art',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const raw = request.url?.split('?')[0] ?? '';
        if (!raw.startsWith('/__ref/')) { next(); return; }
        if (request.method !== 'GET' && request.method !== 'HEAD') { response.statusCode = 405; response.end(); return; }
        let path: string;
        try { path = decodeURIComponent(raw); } catch { response.statusCode = 400; response.end(); return; }
        if (path.includes('\\') || path.includes('\0') || path.split('/').some(part => part === '..' || part === '.')) {
          response.statusCode = 403; response.end(); return;
        }
        const name = path.slice('/__ref/'.length);
        const preparedName = name.startsWith('prepared/ships/') ? name.slice('prepared/'.length) : null;
        const scope = preparedName ? resolve(prepared, 'ships') : name.startsWith('dist/') ? resolve(root, 'dist')
          : name.startsWith('audio/') ? resolve(root, 'audio') : null;
        const type = types[name.slice(name.lastIndexOf('.') + 1)];
        if (!scope || !type) { response.statusCode = 404; response.end(); return; }
        let file: string;
        try {
          file = realpathSync(preparedName ? resolve(prepared, preparedName) : resolve(root, name));
          if (!inside(scope, file) || !statSync(file).isFile()) {
            response.statusCode = 403; response.end(); return;
          }
        } catch { response.statusCode = 404; response.end(); return; }
        response.setHeader('Content-Type', type);
        response.setHeader('Cache-Control', 'private, max-age=3600');
        if (request.method === 'HEAD') { response.end(); return; }
        const stream = createReadStream(file);
        stream.on('error', () => { response.destroy(); });
        stream.pipe(response);
      });
    },
  };
}
