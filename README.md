# Photo Organizer

A desktop app to sort Google Takeout and Snapchat photo exports by date.

## Features
- Reads EXIF metadata from photos
- Reads Google Takeout `.json` sidecar files for accurate timestamps
- Reads Snapchat `memories_history.json` for Snapchat exports
- Falls back to file modification date when no metadata is found
- Copies (never deletes) your originals
- Configurable folder structure (Year/Month, Year/Month/Day, etc.)
- Duplicate handling: skip, rename, or overwrite
- Preview before committing

---

## Setup (first time)

You need [Node.js](https://nodejs.org/) installed (LTS version recommended).

```bash
# 1. Install dependencies
npm install

# 2. Run in development mode
npm start
```

---

## Building a distributable .exe / .dmg / AppImage

```bash
# Build for your current platform
npm run build
```

Output is in the `dist/` folder:
- **Windows**: `dist/Photo Organizer Setup.exe` (NSIS installer)
- **macOS**: `dist/Photo Organizer.dmg`
- **Linux**: `dist/Photo Organizer.AppImage`

To cross-compile (e.g. build Windows .exe on Mac), see [electron-builder docs](https://www.electron.build/multi-platform-build).

---

## How to use

1. **Source** — Select your unzipped Google Takeout or Snapchat export folder
2. **Output** — Pick where organised photos should be saved
3. **Options** — Choose folder structure and duplicate handling
4. **Preview** — Review the scan results
5. **Organise** — Watch progress and open the result folder

---

## Supported formats
`.jpg` `.jpeg` `.png` `.gif` `.webp` `.heic` `.mp4` `.mov` `.3gp`

---

## Metadata priority

1. Google Takeout JSON sidecar (`photo.jpg.json`)
2. Snapchat `memories_history.json`
3. EXIF `DateTimeOriginal` or `DateTime`
4. File modification time (fallback)

---

## Project structure

```
photo-organizer/
├── main.js          # Electron main process (Node.js, file system)
├── preload.js       # Secure IPC bridge
├── renderer/
│   ├── index.html   # UI
│   └── renderer.js  # UI logic
├── assets/          # App icons (add icon.ico / icon.icns here)
└── package.json
```
