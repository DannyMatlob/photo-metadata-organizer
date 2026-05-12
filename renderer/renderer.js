// ── State ───────────────────────────────────────────────────────────────────
const state = {
  sourceType:      'google',
  sourcePath:      null,
  outputPath:      null,
  folderStructure: 'year-month-name',
  duplicateAction: 'skip',
  scannedFiles:    [],
  currentStep:     1
};

// ── Easter egg (march17) ─────────────────────────────────────────────────────
let keySequence = '';
const easterEggCode = 'march17';

document.addEventListener('keypress', (e) => {
  keySequence += e.key.toLowerCase();
  if (keySequence.length > easterEggCode.length) {
    keySequence = keySequence.slice(-easterEggCode.length);
  }
  if (keySequence === easterEggCode) {
    triggerEasterEgg();
    keySequence = '';
  }
});

function triggerEasterEgg() {
  document.body.classList.toggle('easter-egg');
  const icon = document.querySelector('.titlebar-icon');
  const title = document.querySelector('.titlebar-title');
  if (document.body.classList.contains('easter-egg')) {
    icon.textContent = '❤️';
    title.textContent = 'Happy Birthday!!';
    createConfetti();
  } else {
    icon.textContent = '📷';
    title.textContent = 'Photo Organizer';
  }
}

function createConfetti() {
  const container = document.getElementById('confetti-container');
  container.classList.add('active');
  const colors = ['pink', 'hotpink', 'purple', 'lavender'];
  
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = `confetti ${colors[Math.floor(Math.random() * colors.length)]}`;
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.top = Math.random() * 100 + '%';
    confetti.style.delay = Math.random() * 0.5 + 's';
    confetti.style.setProperty('--tx', (Math.random() - 0.5) * 200 + 'px');
    confetti.style.setProperty('--ty', (Math.random() - 0.5) * 200 + 'px');
    confetti.style.setProperty('--duration', (Math.random() * 1.5 + 2.5) + 's');
    container.appendChild(confetti);
  }
  
  setTimeout(() => {
    container.innerHTML = '';
    container.classList.remove('active');
  }, 4500);
}

// ── Navigation ───────────────────────────────────────────────────────────────
function goTo(step) {
  document.getElementById(`screen-${state.currentStep}`).classList.remove('visible');
  document.getElementById(`screen-${step}`).classList.add('visible');

  document.querySelectorAll('.step-item').forEach(el => {
    const s = parseInt(el.dataset.step);
    el.classList.remove('active', 'done', 'pending');
    if (s === step)       el.classList.add('active');
    else if (s < step)    el.classList.add('done');
    else                  el.classList.add('pending');
  });

  state.currentStep = step;
}

// ── Source type toggle ────────────────────────────────────────────────────────
function setSource(type) {
  state.sourceType = type;
  ['google','snapchat','both'].forEach(t => {
    const btnId = t === 'snapchat' ? 'btn-snap' : `btn-${t}`;
    document.getElementById(btnId).classList.toggle('active', t === type);
  });
}

// ── Folder pickers ────────────────────────────────────────────────────────────
async function pickSource() {
  const p = await window.api.pickSource();
  if (!p) return;
  state.sourcePath = p;
  const el = document.getElementById('source-path');
  el.textContent = p;
  el.classList.add('set');
  document.getElementById('btn-next-1').disabled = false;
}

async function pickOutput() {
  const p = await window.api.pickOutput();
  if (!p) return;
  state.outputPath = p;
  const el = document.getElementById('output-path');
  el.textContent = p;
  el.classList.add('set');
  document.getElementById('btn-next-2').disabled = false;
}

async function browseExisting() {
  const p = await window.api.pickOutput();
  if (!p) return;
  state.outputPath = p;
  goTo(6);
  await loadBrowser();
}

// ── Options ───────────────────────────────────────────────────────────────────
function selectStructure(el, value) {
  document.querySelectorAll('#structure-grid .option-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  state.folderStructure = value;
}

function selectDupe(el, value) {
  el.closest('.card').querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  state.duplicateAction = value;
}

// ── Scan ──────────────────────────────────────────────────────────────────────
async function runScan() {
  const spinner = document.getElementById('scan-spinner');
  spinner.classList.add('visible');

  try {
    const files = await window.api.scanFolder(state.sourcePath);
    state.scannedFiles = files;

    // Sample dates for preview (check first 200 files for speed)
    const sample = files.slice(0, 200);
    let withMeta = 0;
    const previewLog = document.getElementById('preview-log');
    previewLog.innerHTML = '';

    const previewPaths = [];
    for (const f of sample.slice(0, 30)) {
      const date = await window.api.getFileDate(f.filePath);
      if (date) {
        const d = new Date(date);
        const isReal = d.getFullYear() > 2000;
        if (isReal) withMeta++;
        previewPaths.push({ file: f.fileName, date: d });
      }
    }

    // Extrapolate stats
    const ratio = sample.length > 0 ? withMeta / Math.min(sample.length, 30) : 0;
    const totalWithMeta = Math.round(files.length * ratio);

    document.getElementById('stat-total').textContent    = files.length.toLocaleString();
    document.getElementById('stat-exif').textContent     = totalWithMeta.toLocaleString();
    document.getElementById('stat-fallback').textContent = (files.length - totalWithMeta).toLocaleString();
    document.getElementById('stat-size').textContent     = '~' + estimateSize(files.length);

    // Build preview log
    for (const { file, date } of previewPaths.slice(0, 20)) {
      const destExample = buildExamplePath(date);
      const line = document.createElement('div');
      line.className = 'ok';
      line.textContent = `${file}  →  ${destExample}`;
      previewLog.appendChild(line);
    }
    if (files.length > 30) {
      const more = document.createElement('div');
      more.textContent = `… and ${(files.length - 30).toLocaleString()} more files`;
      more.style.color = 'var(--muted)';
      previewLog.appendChild(more);
    }

    goTo(4);
  } catch (err) {
    alert('Scan failed: ' + err.message);
  } finally {
    spinner.classList.remove('visible');
  }
}

function estimateSize(count) {
  const avgMB = 3.5;
  const total = count * avgMB;
  if (total > 1024) return (total / 1024).toFixed(1) + ' GB';
  return Math.round(total) + ' MB';
}

function buildExamplePath(date) {
  const d = new Date(date);
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const mName = months[d.getMonth()];
  const day   = String(d.getDate()).padStart(2, '0');

  switch (state.folderStructure) {
    case 'year-month-name': return `${year}/${month}-${mName}/`;
    case 'year-month':      return `${year}/${month}/`;
    case 'year':            return `${year}/`;
    case 'year-month-day':  return `${year}/${month}/${day}/`;
    default:                return `${year}/${month}-${mName}/`;
  }
}

// ── Organise ──────────────────────────────────────────────────────────────────
async function startOrganise() {
  goTo(5);
  document.getElementById('result-section').style.display = 'none';

  const progBar   = document.getElementById('prog-bar');
  const progCount = document.getElementById('prog-count');
  const progPct   = document.getElementById('prog-pct');
  const runLog    = document.getElementById('run-log');
  const total     = state.scannedFiles.length;

  runLog.innerHTML = '';

  window.api.onProgress(({ processed, total: t }) => {
    const pct = Math.round((processed / t) * 100);
    progBar.style.width   = pct + '%';
    progCount.textContent = `${processed.toLocaleString()} / ${t.toLocaleString()}`;
    progPct.textContent   = pct + '%';
  });

  try {
    const result = await window.api.organisePhotos({
      sourceFiles:     state.scannedFiles,
      outputPath:      state.outputPath,
      folderStructure: state.folderStructure,
      duplicateAction: state.duplicateAction
    });

    window.api.removeProgress();

    // Show result log
    for (const entry of result.log.slice(0, 100)) {
      const line = document.createElement('div');
      line.className = entry.status;
      if (entry.status === 'ok')      line.textContent = `✓ ${entry.file}`;
      else if (entry.status === 'skipped') line.textContent = `– ${entry.file} (skipped)`;
      else                            line.textContent = `✗ ${entry.file}: ${entry.message}`;
      runLog.appendChild(line);
    }

    document.getElementById('progress-title').textContent = 'All done! 🎉';
    document.getElementById('progress-sub').textContent   = 'Your photos have been organised.';

    document.getElementById('res-done').textContent = result.processed.toLocaleString();
    document.getElementById('res-skip').textContent = result.skipped.toLocaleString();
    document.getElementById('res-err').textContent  = result.errors.toLocaleString();
    document.getElementById('result-section').style.display = 'flex';

  } catch (err) {
    window.api.removeProgress();
    document.getElementById('progress-title').textContent = 'Something went wrong';
    document.getElementById('progress-sub').textContent   = err.message;
  }
}

async function openOutput() {
  await window.api.openFolder(state.outputPath);
}

async function openBrowser() {
  goTo(6);
  await loadBrowser();
}

// ── Results Browser ───────────────────────────────────────────────────────────
const browser = {
  tree:           [],
  selectedFolder: null,
  selectedFile:   null,
  thumbCache:     {}   // path → data-url
};

async function loadBrowser() {
  const treePane = document.getElementById('tree-pane');
  treePane.innerHTML = '<div style="padding:20px; color:var(--muted); font-size:12px">Scanning output folder…</div>';
  document.getElementById('grid-pane').className = 'grid-pane empty';
  document.getElementById('grid-pane').innerHTML = '<span>Select a folder on the left</span>';
  document.getElementById('detail-pane').innerHTML = `
    <div class="detail-empty">
      <div style="font-size:28px">🖼</div>
      <span>Click a photo to see details</span>
    </div>`;

  try {
    browser.tree = await window.api.readOutputTree(state.outputPath);
    renderTree();

    // Count total files
    let total = 0;
    function countFiles(nodes) { for (const n of nodes) { if (n.type === 'file') total++; else countFiles(n.children || []); } }
    countFiles(browser.tree);
    document.getElementById('browser-subtitle').textContent =
      `${total.toLocaleString()} files in ${state.outputPath}`;
  } catch (err) {
    treePane.innerHTML = `<div style="padding:14px; color:var(--danger); font-size:12px">Error: ${err.message}</div>`;
  }
}

function renderTree() {
  const pane = document.getElementById('tree-pane');
  pane.innerHTML = '';

  function makeNode(node, depth) {
    const el = document.createElement('div');
    el.className = 'tree-node' + (depth > 0 ? ' indent' : '');
    if (depth > 1) el.style.paddingLeft = (14 + depth * 14) + 'px';

    if (node.type === 'folder') {
      const hasChildren = (node.children || []).some(c => c.type === 'folder');
      el.innerHTML = `
        <span class="tree-arrow">${hasChildren ? '▶' : ' '}</span>
        <span>📁</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis">${node.name}</span>
        <span class="tree-count">${node.fileCount || ''}</span>`;
      el._node     = node;
      el._open     = false;
      el._children = [];

      el.onclick = async (e) => {
        e.stopPropagation();

        // Select styling
        pane.querySelectorAll('.tree-node').forEach(n => n.classList.remove('active'));
        el.classList.add('active');

        // Toggle children
        if (hasChildren) {
          el._open = !el._open;
          el.classList.toggle('open', el._open);
          const arrow = el.querySelector('.tree-arrow');
          if (arrow) arrow.textContent = el._open ? '▼' : '▶';

          if (el._open) {
            const subFolders = (node.children || []).filter(c => c.type === 'folder');
            for (const child of subFolders) {
              const sub = makeNode(child, depth + 1);
              el._children.push(sub);
              el.insertAdjacentElement('afterend', sub);
            }
          } else {
            el._children.forEach(c => c.remove());
            el._children = [];
          }
        }

        // Load files in this folder
        browser.selectedFolder = node.path;
        browser.selectedFile   = null;
        await loadGrid(node.path);
      };
    }

    return el;
  }

  // Top-level nodes only (depth 0)
  for (const node of browser.tree) {
    if (node.type === 'folder') {
      pane.appendChild(makeNode(node, 0));
    }
  }
}

async function loadGrid(folderPath) {
  const gridPane = document.getElementById('grid-pane');
  gridPane.className = 'grid-pane';
  gridPane.innerHTML = '';

  const files = await window.api.readFolderFiles(folderPath);

  if (files.length === 0) {
    gridPane.className = 'grid-pane empty';
    gridPane.innerHTML = '<span>No photos in this folder</span>';
    return;
  }

  for (const file of files) {
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    thumb.title = file.name;

    if (file.isVideo) {
      thumb.innerHTML = `<div class="thumb-placeholder">🎬</div><span class="vid-badge">video</span>`;
    } else {
      thumb.innerHTML = `<div class="thumb-placeholder">⏳</div>`;
      // Lazy-load thumbnail
      loadThumb(file, thumb);
    }

    thumb.onclick = () => selectFile(file, thumb);
    gridPane.appendChild(thumb);
  }
}

async function loadThumb(file, el) {
  // Use cache to avoid re-reading
  if (!browser.thumbCache[file.path]) {
    browser.thumbCache[file.path] = await window.api.readImageB64(file.path);
  }
  const b64 = browser.thumbCache[file.path];
  if (b64) {
    el.innerHTML = `<img src="${b64}" alt="${file.name}" loading="lazy">`;
  } else {
    el.innerHTML = `<div class="thumb-placeholder">🖼</div>`;
  }
}

async function selectFile(file, thumbEl) {
  // Highlight thumb
  document.querySelectorAll('.photo-thumb').forEach(t => t.classList.remove('active'));
  thumbEl.classList.add('active');
  browser.selectedFile = file;

  const detail = document.getElementById('detail-pane');

  // Big preview
  let previewHtml;
  if (file.isVideo) {
    previewHtml = `<div class="detail-preview"><div class="detail-placeholder">🎬</div></div>`;
  } else {
    if (!browser.thumbCache[file.path]) {
      browser.thumbCache[file.path] = await window.api.readImageB64(file.path);
    }
    const b64 = browser.thumbCache[file.path];
    previewHtml = b64
      ? `<div class="detail-preview"><img src="${b64}" alt="${file.name}"></div>`
      : `<div class="detail-preview"><div class="detail-placeholder">🖼</div></div>`;
  }

  const sizeFmt = formatBytes(file.size);
  const realDate = file.photoDate ? new Date(file.photoDate) : new Date(file.mtime);
  const dateFmt = realDate.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  const timeFmt = realDate.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  const dateSource = file.photoDate ? 'Photo date' : 'File date (estimated)';

  detail.innerHTML = `
    ${previewHtml}
    <div class="detail-meta">
      <div class="detail-row">
        <span class="detail-key">Filename</span>
        <span class="detail-val">${file.name}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Type</span>
        <span class="detail-val">${file.isVideo ? 'Video' : 'Image'} (${file.ext.toUpperCase()})</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Size</span>
        <span class="detail-val">${sizeFmt}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">${dateSource}</span>
        <span class="detail-val">${dateFmt} at ${timeFmt}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Path</span>
        <span class="detail-val" style="color:var(--muted); font-size:11px; font-family:'DM Mono',monospace">${file.path}</span>
      </div>
    </div>
    <button class="btn" style="font-size:12px; padding:8px 12px" onclick="window.api.openFolder('${escapePath(file.path)}')">
      📂 Show in Explorer
    </button>`;
}

function formatBytes(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1024*1024)  return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(1) + ' MB';
}

function escapePath(p) {
  return p.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function startOver() {
  state.sourcePath   = null;
  state.outputPath   = null;
  state.scannedFiles = [];
  browser.tree           = [];
  browser.selectedFolder = null;
  browser.selectedFile   = null;
  browser.thumbCache     = {};
  document.getElementById('source-path').textContent  = 'No folder selected';
  document.getElementById('source-path').classList.remove('set');
  document.getElementById('output-path').textContent  = 'No folder selected';
  document.getElementById('output-path').classList.remove('set');
  document.getElementById('btn-next-1').disabled = true;
  document.getElementById('btn-next-2').disabled = true;
  document.getElementById('progress-title').textContent = 'Organising photos…';
  document.getElementById('progress-sub').textContent   = 'Please wait, do not close the window';
  document.getElementById('prog-bar').style.width = '0%';
  goTo(1);
}
