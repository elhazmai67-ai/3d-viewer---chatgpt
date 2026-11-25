# PrintView 3D

Android-ready STL and 3MF multi-model viewer built with Vite, Three.js and Capacitor.

## Features
- Import multiple `.stl` and `.3mf` files (up to 10 models at once).
- Arrange all loaded models in one interactive 3D grid scene.
- Orbit, zoom, pan, fit-all and reset camera.
- Dimensions: X width, Y depth, Z height; switch mm/cm/in.
- Approximate mesh volume, triangle count and vertex count.
- Simplified material weight estimate for PLA, PETG, ABS, ASA, TPU or custom density.
- Local file processing; model files are not uploaded to a server.

## Run in a browser
Requirements: Node.js 20 or later.

```bash
npm install
npm run dev
```

## Build Android APK locally
Requirements: Node.js 20+, Android Studio, Android SDK and JDK 21.

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio, wait for Gradle sync, then choose **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

## Build APK using GitHub Actions
1. Create a new GitHub repository.
2. Extract this ZIP and upload all files/folders to the repository root.
3. Commit to `main` (or `master`).
4. Open the repository's **Actions** tab.
5. Select **Build PrintView 3D Android APK** and click **Run workflow**. A push to main/master also starts a build.
6. Open the completed workflow run, scroll to **Artifacts**, and download `PrintView-3D-Android-APK`.
7. Extract the artifact ZIP; install `app-debug.apk` on your Android phone. Android may ask you to allow installation from that source.

## Notes and limitations
- The viewer supports STL and 3MF mesh geometry. Some advanced 3MF project metadata, build-plate semantics, thumbnails or slicer-specific settings may not be represented.
- STL does not contain physical material density or print settings. Weight is an estimate based on mesh volume × selected density × infill percentage; real slicer estimates are more accurate.
- Mesh volume is calculated from triangle geometry. Open, non-manifold or incorrectly oriented meshes may produce an inaccurate volume.
- Very large/high-polygon models may be slow on phones. Start with a few models to test device performance.
- The current app arranges models together in a shared 3D scene (grid layout), not in separate independent camera windows.
- The app does not yet edit or repair meshes, slice models, or send jobs to a 3D printer.

## Project structure

```text
PrintView3D/
├── .github/workflows/android.yml
├── src/main.js
├── src/style.css
├── index.html
├── package.json
├── capacitor.config.json
└── README.md
```
