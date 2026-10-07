import { copyFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'public/tracking');
await mkdir(path.join(directory, 'wasm'), { recursive: true });
const wasm = path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
for (const file of await readdir(wasm)) await copyFile(path.join(wasm, file), path.join(directory, 'wasm', file));
const assets = [
  ['face_landmarker.task', 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff'],
  ['hand_landmarker.task', 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1'],
];
const checksum = data => createHash('sha256').update(data).digest('hex');
await Promise.all(assets.map(async ([name, url, expected]) => {
  const destination = path.join(directory, name);
  if (await readFile(destination).then(data => checksum(data) === expected).catch(() => false)) {
    console.log(`${name}: cached and verified`);
    return;
  }
  console.log(`Downloading ${name}…`);
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`${name}: download failed (${response.status})`);
  const data = Buffer.from(await response.arrayBuffer());
  if (checksum(data) !== expected) throw new Error(`${name}: checksum mismatch. The downloaded model was not saved.`);
  const temporary = `${destination}.${process.pid}.download`;
  await writeFile(temporary, data);
  await rename(temporary, destination);
  console.log(`${name}: downloaded and verified (${data.length} bytes)`);
})).catch(error => {
  throw new Error(`Tracking setup failed: ${error.message}\nCheck your internet connection, then run npm run prepare:assets to retry.`, { cause: error });
});
console.log('Tracking assets ready. Camera sessions use local assets only.');
