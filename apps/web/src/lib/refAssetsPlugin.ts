import { createReadStream, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

const inside = (parent: string, child: string): boolean => {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
};

/** Serves prepared references only; raw device files have no HTTP route. */
export function refAssetsPlugin(directory: string | undefined, repository: string): Plugin | null {
  if (!directory) return null;
  const root = realpathSync(directory);
  const repo = realpathSync(repository);
  if (inside(repo, root) && root !== resolve(repo, 'astera-refs')) {
    throw new Error('Local APK references belong in the ignored astera-refs directory');
  }
  return {
    name: 'astera-external-references',
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
        let scope: string;
        if (name === 'manifest.json') scope = root;
        else if (name.startsWith('dist/')) scope = resolve(root, 'dist');
        else if (name.startsWith('audio/')) scope = resolve(root, 'audio');
        else { response.statusCode = 404; response.end(); return; }
        let file: string;
        try {
          file = realpathSync(resolve(root, name));
          if (!inside(root, file) || !inside(scope, file) || !statSync(file).isFile()) {
            response.statusCode = 403; response.end(); return;
          }
        } catch { response.statusCode = 404; response.end(); return; }
        response.setHeader('Cache-Control', 'no-store');
        const extension = name.slice(name.lastIndexOf('.') + 1);
        const mime: Readonly<Record<string, string>> = { json: 'application/json', glb: 'model/gltf-binary',
          ogg: 'audio/ogg', wav: 'audio/wav', png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', html: 'text/html' };
        response.setHeader('Content-Type', mime[extension] ?? 'application/octet-stream');
        if (request.method === 'HEAD') { response.end(); return; }
        const stream = createReadStream(file);
        stream.on('error', () => { response.destroy(); });
        stream.pipe(response);
      });
    },
  };
}
