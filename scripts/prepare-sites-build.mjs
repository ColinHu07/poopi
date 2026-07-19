import { copyFile, mkdir, readdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const buildDirectory = resolve(projectRoot, 'dist');
const clientDirectory = resolve(buildDirectory, 'client');
const serverDirectory = resolve(projectRoot, 'dist', 'server');

// Sites exposes static files to the Worker from dist/client. Expo exports them
// at the root of dist, so move the complete static export into that directory
// before adding the Worker entry point.
await mkdir(clientDirectory, { recursive: true });
for (const entry of await readdir(buildDirectory)) {
  if (entry === 'client' || entry === 'server') {
    continue;
  }
  await rename(resolve(buildDirectory, entry), resolve(clientDirectory, entry));
}

await mkdir(serverDirectory, { recursive: true });
await copyFile(resolve(projectRoot, 'hosting', 'sites-worker.js'), resolve(serverDirectory, 'index.js'));
