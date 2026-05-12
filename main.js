const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    backgroundColor: '#0f0f0f',
    show: false,
    title: 'Photo Organizer'
  });

  mainWindow.loadFile('renderer/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC: pick source folder ──────────────────────────────────────────────────
ipcMain.handle('pick-source', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select your Google / Snapchat export folder'
  });
  return result.canceled ? null : result.filePaths[0];
});

// ── IPC: pick output folder ──────────────────────────────────────────────────
ipcMain.handle('pick-output', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select where to save organised photos'
  });
  return result.canceled ? null : result.filePaths[0];
});

// ── IPC: scan source folder and return preview list ──────────────────────────
ipcMain.handle('scan-folder', async (event, sourcePath) => {
  const results = [];
  const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.mp4', '.mov', '.3gp']);

  function walkDir(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!IMAGE_EXTS.has(ext)) continue;

        // Skip tiny files (thumbnails)
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size < 5000) continue;
        } catch { continue; }

        results.push({ filePath: fullPath, fileName: entry.name, ext });
      }
    }
  }

  walkDir(sourcePath);
  return results;
});

// ── IPC: get date from a single file (EXIF + JSON sidecar + fallback) ────────
ipcMain.handle('get-file-date', async (event, filePath) => {
  return getFileDate(filePath);
});

// ── IPC: run the full organise operation ─────────────────────────────────────
ipcMain.handle('organise-photos', async (event, { sourceFiles, outputPath, folderStructure, duplicateAction }) => {
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  const log = [];

  for (const file of sourceFiles) {
    try {
      const date = getFileDate(file.filePath);
      const destDir = buildDestPath(outputPath, date, folderStructure);

      fs.mkdirSync(destDir, { recursive: true });

      // Build date-prefixed filename: 2024-06-15_143022_original.jpg
      const datePfx = formatDatePrefix(date);
      const newName  = `${datePfx}_${file.fileName}`;
      let destFile   = path.join(destDir, newName);

      // Handle duplicates
      if (fs.existsSync(destFile)) {
        if (duplicateAction === 'skip') {
          skipped++;
          log.push({ status: 'skipped', file: file.fileName });
          processed++;
          event.sender.send('progress', { processed, total: sourceFiles.length });
          continue;
        } else if (duplicateAction === 'rename') {
          destFile = getUniqueFilePath(destFile);
        }
        // 'overwrite' falls through
      }

      fs.copyFileSync(file.filePath, destFile);

      // Set file timestamps to the real photo date so Explorer shows it correctly
      try { fs.utimesSync(destFile, date, date); } catch { /* non-fatal */ }

      log.push({ status: 'ok', file: file.fileName, dest: destFile });
    } catch (err) {
      errors++;
      log.push({ status: 'error', file: file.fileName, message: err.message });
    }

    processed++;
    event.sender.send('progress', { processed, total: sourceFiles.length });
  }

  return { processed, skipped, errors, log };
});

// ── IPC: open output folder in Finder/Explorer ───────────────────────────────
ipcMain.handle('open-folder', async (event, folderPath) => {
  shell.openPath(folderPath);
});

// ── IPC: read output folder tree (year → month folders → file counts) ────────
ipcMain.handle('read-output-tree', async (event, outputPath) => {
  const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic']);
  const VIDEO_EXTS = new Set(['.mp4', '.mov', '.3gp']);

  function readDir(dir, depth) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return []; }

    const result = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth < 3) {
          const children = readDir(fullPath, depth + 1);
          const fileCount = children.reduce((n, c) => n + (c.type === 'file' ? 1 : c.fileCount || 0), 0);
          result.push({ type: 'folder', name: entry.name, path: fullPath, children, fileCount });
        }
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        const isImg = IMAGE_EXTS.has(ext);
        const isVid = VIDEO_EXTS.has(ext);
        if (isImg || isVid) {
          const stat = fs.statSync(fullPath);
          result.push({ type: 'file', name: entry.name, path: fullPath,
                        ext, isVideo: isVid, size: stat.size, mtime: stat.mtime });
        }
      }
    }
    return result;
  }

  const tree = readDir(outputPath, 0);
  return tree;
});

// ── IPC: read files in a specific folder (flat list for grid view) ────────────
ipcMain.handle('read-folder-files', async (event, folderPath) => {
  const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic']);
  const VIDEO_EXTS = new Set(['.mp4', '.mov', '.3gp']);
  let entries;
  try { entries = fs.readdirSync(folderPath, { withFileTypes: true }); }
  catch { return []; }

  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    const isImg = IMAGE_EXTS.has(ext);
    const isVid = VIDEO_EXTS.has(ext);
    if (!isImg && !isVid) continue;
    const fullPath = path.join(folderPath, entry.name);
    const stat = fs.statSync(fullPath);
    // Re-derive photo date from the filename prefix if present (YYYY-MM-DD_HHMMSS_...)
    const photoDate = parseDateFromFilename(entry.name) || stat.mtime;
    files.push({ name: entry.name, path: fullPath, ext, isVideo: isVid,
                 size: stat.size, mtime: stat.mtime, photoDate });
  }
  files.sort((a, b) => a.name.localeCompare(b.name));
  return files;
});

// ── IPC: read image as base64 for display ────────────────────────────────────
ipcMain.handle('read-image-b64', async (event, filePath) => {
  try {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    const data = fs.readFileSync(filePath);
    return `data:image/${mime};base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function getFileDate(filePath) {
  // 1. Try Google Takeout JSON sidecar  (photo.jpg → photo.jpg.json)
  const jsonSidecar = filePath + '.json';
  if (fs.existsSync(jsonSidecar)) {
    try {
      const meta = JSON.parse(fs.readFileSync(jsonSidecar, 'utf8'));
      const ts = meta?.photoTakenTime?.timestamp || meta?.creationTime?.timestamp;
      if (ts) return new Date(parseInt(ts) * 1000);
    } catch { /* fall through */ }
  }

  // 2. Try Snapchat memories JSON index (memories_history.json in same dir or parents)
  const snapDate = trySnapchatDate(filePath);
  if (snapDate) return snapDate;

  // 3. Try EXIF (synchronous read of first 128KB)
  try {
    const ExifReader = require('exifreader');
    const buf = Buffer.alloc(128 * 1024);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const tags = ExifReader.load(buf);
    const raw = tags['DateTimeOriginal']?.description || tags['DateTime']?.description;
    if (raw) {
      // EXIF format: "YYYY:MM:DD HH:MM:SS"
      const fixed = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      const d = new Date(fixed);
      if (!isNaN(d)) return d;
    }
  } catch { /* fall through */ }

  // 4. Fall back to file modification time
  try {
    return fs.statSync(filePath).mtime;
  } catch {
    return new Date();
  }
}

function trySnapchatDate(filePath) {
  // Walk up directories looking for memories_history.json
  let dir = path.dirname(filePath);
  for (let i = 0; i < 4; i++) {
    const candidate = path.join(dir, 'memories_history.json');
    if (fs.existsSync(candidate)) {
      try {
        const data = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        const memories = data?.['Saved Media'] || [];
        const baseName = path.basename(filePath);
        const match = memories.find(m => m['Media Type'] && m.Date && baseName.includes(m.Date?.replace(/[: ]/g, '')));
        if (match?.Date) return new Date(match.Date);
      } catch { /* fall through */ }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function buildDestPath(outputPath, date, folderStructure) {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  const monthName = monthNames[date.getMonth()];
  const day = date.getDate().toString().padStart(2, '0');

  switch (folderStructure) {
    case 'year-month-name': return path.join(outputPath, year, `${month}-${monthName}`);
    case 'year-month':      return path.join(outputPath, year, month);
    case 'year':            return path.join(outputPath, year);
    case 'year-month-day':  return path.join(outputPath, year, month, day);
    default:                return path.join(outputPath, year, `${month}-${monthName}`);
  }
}

function getUniqueFilePath(filePath) {
  const ext = path.extname(filePath);
  const base = filePath.slice(0, -ext.length);
  let i = 1;
  while (fs.existsSync(`${base}_${i}${ext}`)) i++;
  return `${base}_${i}${ext}`;
}

// Build "2024-06-15_143022" prefix from a Date object
function formatDatePrefix(date) {
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const Y  = date.getFullYear();
  const M  = pad(date.getMonth() + 1);
  const D  = pad(date.getDate());
  const h  = pad(date.getHours());
  const m  = pad(date.getMinutes());
  const s  = pad(date.getSeconds());
  return `${Y}-${M}-${D}_${h}${m}${s}`;
}

// Parse a Date back out of a prefixed filename like "2024-06-15_143022_IMG_1234.jpg"
function parseDateFromFilename(name) {
  const m = name.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})_/);
  if (!m) return null;
  const [, Y, Mo, D, h, mi, s] = m;
  const d = new Date(+Y, +Mo - 1, +D, +h, +mi, +s);
  return isNaN(d) ? null : d;
}
