# Bloom — flower crown AR

Summon a 3D flower crown with your hand, move and resize it between your fingertips, then wear it on your head. Built with TypeScript, Three.js and MediaPipe; everything runs in the browser.

## Quick start

Install **Node.js 22.12 or newer** and npm. Node 20.19+ in the 20.x line also works. If you use nvm, run `nvm install` and `nvm use` in this folder.

```sh
git clone https://github.com/hunainahmedj/bloom.git
cd bloom
npm ci
npm start
```

Open **[http://127.0.0.1:5173/](http://127.0.0.1:5173/)**.

Installation prepares the WebAssembly runtime and downloads about 11 MB of tracking models from Google. This happens automatically; no API key, account, environment file or backend is needed. Once installed, camera tracking uses the local files.

## Try it

1. Choose **Change look** to explore Garden, Rose and Wildflower crowns, plus Natural, Party, Gloomy and Cutesy moods.
2. Select **Start camera** and allow camera access.
3. Hold an open hand in view briefly to summon the crown. Spread your fingers to grow it; curl them to shrink it. Turn your hand to rotate it.
4. Bring the crown above your head and hold briefly to wear it. It fits the tracked head automatically.
5. While wearing it, extend your index finger, curl the others and keep your thumb open. Point and hold over **Change look**, then over an option, for about 0.7 seconds to select it.

Pinch the worn crown to take it off. Closing your fist while carrying it keeps holding it; use **Set crown down** to release it. Fullscreen keeps the controls inside the scene. The compact look menu closes after live selections; tap the scene or press Escape to dismiss it. Stop camera returns to the draggable 3D preview.

Flowers gently bloom and move, with falling petals and pollen while worn. Party adds stars; Cutesy adds hearts. Effects off and reduced-motion preferences settle animation. Filters affect the displayed camera image, while tracking sees the original pixels.

## Commands

| Command | Purpose |
| --- | --- |
| `npm start` or `npm run dev` | Start the local development app |
| `npm test` | Run the automated tests |
| `npm run build` | Type-check and produce the static app in `dist/` |
| `npm run preview` | Serve the production build locally at port 4173 |
| `npm run prepare:assets` | Restore or verify the tracking assets |

For a production preview, run `npm run build` followed by `npm run preview`. To host the built app elsewhere, serve `dist/` over **HTTPS**; webcam access works on localhost during development. The dev server binds to this computer only.

GitHub Actions runs installation, tests and the build on pushes and pull requests.

## Troubleshooting

- **Setup download failed:** check your internet connection and run `npm run prepare:assets`. Model downloads are checksum verified; missing or corrupt cached models are downloaded again.
- **Port 5173 is busy:** run `npm start -- --port 5174` and open the URL printed in the terminal.
- **Camera blocked or unavailable:** allow camera access in the browser's site settings, or close another app using the camera. Startup can be cancelled with Stop camera.
- **Tracking feels unreliable:** use good light and keep your face and entire hand in frame. One face and one controlling hand are tracked. Head/hair occlusion is approximate; individual hair strands and hand occlusion are not simulated. Live accuracy varies by camera, lighting and device.
- **No camera available:** you can still explore all models and effects in the draggable preview.

## Privacy

Camera frames are processed in a browser worker. Bloom does not upload camera frames, record a video, save photos or identify people. It requests video only, with no microphone access. Stopping the camera tears down the stream and tracking worker.

## Development

`src/` contains rendering, gestures, smoothing and UI. `scripts/prepare-assets.mjs` creates the ignored `public/tracking/` files. `tests/` includes unit tests and synthetic/manual browser fixtures; these fixtures are excluded from the production entry point. `/tests/tracking-smoke.html` verifies local model loading and inference with a synthetic video, without requesting the webcam.

The crown geometry is authored for this project. See [third-party notices](THIRD_PARTY_NOTICES.md) for dependency and model sources.
