/* ============================================================
   InstaStencil – app.js
   Full image-to-stencil conversion engine (100% client-side)
   ============================================================ */

'use strict';

// ─── State ────────────────────────────────────────────────
const state = {
  imageData: null,       // original ImageData
  img: null,             // HTMLImageElement
  mode: 'threshold',
  threshold: 128,
  contrast: 0,
  blur: 0,
  edgeStrength: 50,
  invert: false,
  outputColor: 'black',
  customColor: '#6C63FF',
  layers: 1,
  stencilReady: false,
};

// ─── DOM References ───────────────────────────────────────
const uploadZone      = document.getElementById('uploadZone');
const uploadInner     = document.getElementById('uploadInner');
const fileInput       = document.getElementById('fileInput');
const toolPanels      = document.getElementById('toolPanels');
const originalCanvas  = document.getElementById('originalCanvas');
const stencilCanvas   = document.getElementById('stencilCanvas');
const processingOverlay = document.getElementById('processingOverlay');
const stencilPlaceholder = document.getElementById('stencilPlaceholder');
const originalView    = document.getElementById('originalView');
const stencilView     = document.getElementById('stencilView');
const compareView     = document.getElementById('compareView');
const canvasInfo      = document.getElementById('canvasInfo');
const processBtn      = document.getElementById('processBtn');
const downloadBtn     = document.getElementById('downloadBtn');
const newImageBtn     = document.getElementById('newImageBtn');
const resetBtn        = document.getElementById('resetBtn');

const thresholdSlider = document.getElementById('threshold');
const thresholdVal    = document.getElementById('thresholdVal');
const contrastSlider  = document.getElementById('contrast');
const contrastVal     = document.getElementById('contrastVal');
const blurSlider      = document.getElementById('blur');
const blurVal         = document.getElementById('blurVal');
const edgeSlider      = document.getElementById('edgeStrength');
const edgeVal         = document.getElementById('edgeVal');
const invertToggle    = document.getElementById('invertToggle');
const layersSlider    = document.getElementById('layers');
const layersVal       = document.getElementById('layersVal');
const customColorInput = document.getElementById('customColor');
const thresholdGroup  = document.getElementById('thresholdGroup');
const edgeGroup       = document.getElementById('edgeGroup');

// ─── Upload / Drag & Drop ─────────────────────────────────
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadImage(file);
});
fileInput.addEventListener('change', e => { if (e.target.files[0]) loadImage(e.target.files[0]); });
newImageBtn.addEventListener('click', () => {
  toolPanels.style.display = 'none';
  uploadZone.style.display = 'flex';
  fileInput.value = '';
  state.stencilReady = false;
  downloadBtn.disabled = true;
});

function loadImage(file) {
  if (file.size > 20 * 1024 * 1024) { alert('File too large. Max 20MB.'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      state.img = img;
      uploadZone.style.display = 'none';
      toolPanels.style.display = 'grid';
      drawOriginal(img);
      showTab('original');
      canvasInfo.textContent = `${img.naturalWidth} × ${img.naturalHeight} px · ${(file.size/1024).toFixed(0)} KB`;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function drawOriginal(img) {
  const maxW = Math.min(img.naturalWidth, 800);
  const scale = maxW / img.naturalWidth;
  originalCanvas.width  = img.naturalWidth  * scale;
  originalCanvas.height = img.naturalHeight * scale;
  const ctx = originalCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0, originalCanvas.width, originalCanvas.height);
  state.imageData = ctx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
}

// ─── Tab switching ────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showTab(btn.dataset.tab);
  });
});

function showTab(tab) {
  originalView.style.display = tab === 'original' ? 'flex' : 'none';
  stencilView.style.display  = tab === 'stencil'  ? 'flex' : 'none';
  compareView.style.display  = tab === 'compare'  ? 'flex' : 'none';
  if (tab === 'compare' && state.stencilReady) drawCompare();
}

// ─── Controls ─────────────────────────────────────────────
document.querySelectorAll('.seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
    thresholdGroup.style.display = state.mode === 'threshold' ? '' : 'none';
    edgeGroup.style.display      = (state.mode === 'edge' || state.mode === 'sketch') ? '' : 'none';
  });
});

function bindSlider(slider, valEl, stateKey) {
  slider.addEventListener('input', () => {
    state[stateKey] = parseFloat(slider.value);
    valEl.textContent = slider.value;
  });
}
bindSlider(thresholdSlider, thresholdVal, 'threshold');
bindSlider(contrastSlider,  contrastVal,  'contrast');
bindSlider(blurSlider,      blurVal,      'blur');
bindSlider(edgeSlider,      edgeVal,      'edgeStrength');
bindSlider(layersSlider,    layersVal,    'layers');

invertToggle.addEventListener('change', () => { state.invert = invertToggle.checked; });
customColorInput.addEventListener('input', () => { state.customColor = customColorInput.value; });
document.querySelectorAll('input[name="outputColor"]').forEach(r => {
  r.addEventListener('change', () => {
    state.outputColor = r.value;
    if (r.value === 'custom') customColorInput.click();
  });
});

resetBtn.addEventListener('click', () => {
  thresholdSlider.value = 128; thresholdVal.textContent = '128';
  contrastSlider.value  = 0;   contrastVal.textContent  = '0';
  blurSlider.value      = 0;   blurVal.textContent      = '0';
  edgeSlider.value      = 50;  edgeVal.textContent      = '50';
  invertToggle.checked  = false;
  layersSlider.value    = 1;   layersVal.textContent    = '1';
  document.querySelector('[data-mode="threshold"]').click();
  Object.assign(state, { threshold:128, contrast:0, blur:0, edgeStrength:50, invert:false, layers:1, mode:'threshold', outputColor:'black' });
  document.querySelector('input[name="outputColor"][value="black"]').checked = true;
});

// ─── Process Button ───────────────────────────────────────
processBtn.addEventListener('click', () => {
  if (!state.imageData) { alert('Please upload an image first.'); return; }
  showTab('stencil');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'stencil'));
  processingOverlay.style.display = 'flex';
  stencilPlaceholder.style.display = 'none';

  // Run processing asynchronously to allow spinner to render
  setTimeout(() => {
    try {
      generateStencil();
      state.stencilReady = true;
      downloadBtn.disabled = false;
    } catch(err) {
      console.error(err);
      alert('Processing failed. Please try another image.');
    } finally {
      processingOverlay.style.display = 'none';
    }
  }, 60);
});

// ─── Download ─────────────────────────────────────────────
downloadBtn.addEventListener('click', () => {
  if (!state.stencilReady) return;
  const link = document.createElement('a');
  link.download = 'stencil.png';
  link.href = stencilCanvas.toDataURL('image/png');
  link.click();
});

// ─── Core Image Processing ────────────────────────────────

function generateStencil() {
  const src = state.imageData;
  const w = src.width, h = src.height;

  stencilCanvas.width  = w;
  stencilCanvas.height = h;
  const ctx = stencilCanvas.getContext('2d');

  // Step 1: get pixel array copy
  let pixels = new Uint8ClampedArray(src.data);

  // Step 2: apply contrast
  if (state.contrast !== 0) pixels = applyContrast(pixels, state.contrast);

  // Step 3: convert to grayscale
  let gray = toGrayscale(pixels, w, h);

  // Step 4: blur
  if (state.blur > 0) gray = gaussianBlur(gray, w, h, state.blur);

  // Step 5: apply stencil mode
  let result;
  if (state.mode === 'threshold') {
    result = applyThreshold(gray, w, h, state.threshold, state.layers);
  } else if (state.mode === 'edge') {
    result = applyEdgeDetect(gray, w, h, state.edgeStrength);
  } else {
    // sketch: combine edge + threshold
    const edges = applyEdgeDetect(gray, w, h, state.edgeStrength);
    const thresh = applyThreshold(gray, w, h, state.threshold, 1);
    result = combineSketch(edges, thresh, w, h);
  }

  // Step 6: invert
  if (state.invert) result = invertPixels(result);

  // Step 7: colorize
  const colorized = colorize(result, w, h, state.outputColor, state.customColor);

  // Step 8: draw
  const imgData = new ImageData(colorized, w, h);
  ctx.putImageData(imgData, 0, 0);
}

// ─── Image Processing Helpers ─────────────────────────────

function applyContrast(pixels, amount) {
  const factor = (259 * (amount + 255)) / (255 * (259 - amount));
  const out = new Uint8ClampedArray(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    out[i]   = clamp(factor * (pixels[i]   - 128) + 128);
    out[i+1] = clamp(factor * (pixels[i+1] - 128) + 128);
    out[i+2] = clamp(factor * (pixels[i+2] - 128) + 128);
    out[i+3] = pixels[i+3];
  }
  return out;
}

function toGrayscale(pixels, w, h) {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = pixels[i*4], g = pixels[i*4+1], b = pixels[i*4+2];
    gray[i] = 0.299*r + 0.587*g + 0.114*b;
  }
  return gray;
}

function gaussianBlur(gray, w, h, radius) {
  // Simple box blur approximation (3-pass for gaussian effect)
  const r = Math.round(radius);
  let buf = gray.slice();
  for (let pass = 0; pass < 3; pass++) buf = boxBlur(buf, w, h, r);
  return buf;
}

function boxBlur(gray, w, h, r) {
  const out = new Float32Array(w * h);
  // Horizontal
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let sum = 0, count = 0;
    for (let x = -r; x <= r; x++) {
      const xi = Math.max(0, Math.min(w-1, x));
      sum += gray[y*w + xi]; count++;
    }
    for (let x = 0; x < w; x++) {
      tmp[y*w + x] = sum / count;
      const removeX = Math.max(0, Math.min(w-1, x - r));
      const addX    = Math.max(0, Math.min(w-1, x + r + 1));
      sum += gray[y*w + addX] - gray[y*w + removeX];
    }
  }
  // Vertical
  for (let x = 0; x < w; x++) {
    let sum = 0, count = 0;
    for (let y = -r; y <= r; y++) {
      const yi = Math.max(0, Math.min(h-1, y));
      sum += tmp[yi*w + x]; count++;
    }
    for (let y = 0; y < h; y++) {
      out[y*w + x] = sum / count;
      const removeY = Math.max(0, Math.min(h-1, y - r));
      const addY    = Math.max(0, Math.min(h-1, y + r + 1));
      sum += tmp[addY*w + x] - tmp[removeY*w + x];
    }
  }
  return out;
}

function applyThreshold(gray, w, h, threshold, layers) {
  const out = new Float32Array(w * h);
  if (layers === 1) {
    for (let i = 0; i < gray.length; i++) {
      out[i] = gray[i] < threshold ? 0 : 255;
    }
  } else {
    // Multi-tone: quantize into N levels
    const step = 255 / layers;
    for (let i = 0; i < gray.length; i++) {
      const level = Math.floor(gray[i] / step);
      out[i] = (level / layers) * 255;
    }
  }
  return out;
}

function applyEdgeDetect(gray, w, h, strength) {
  // Sobel operator
  const out = new Float32Array(w * h);
  const s = strength / 100;
  for (let y = 1; y < h-1; y++) {
    for (let x = 1; x < w-1; x++) {
      const idx = y * w + x;
      const gx =
        -gray[(y-1)*w+(x-1)] - 2*gray[y*w+(x-1)] - gray[(y+1)*w+(x-1)] +
         gray[(y-1)*w+(x+1)] + 2*gray[y*w+(x+1)] + gray[(y+1)*w+(x+1)];
      const gy =
        -gray[(y-1)*w+(x-1)] - 2*gray[(y-1)*w+x] - gray[(y-1)*w+(x+1)] +
         gray[(y+1)*w+(x-1)] + 2*gray[(y+1)*w+x] + gray[(y+1)*w+(x+1)];
      const mag = Math.sqrt(gx*gx + gy*gy) * s;
      out[idx] = clamp(255 - mag); // invert: edges are dark
    }
  }
  // Fill borders
  for (let x = 0; x < w; x++) { out[x] = 255; out[(h-1)*w+x] = 255; }
  for (let y = 0; y < h; y++) { out[y*w] = 255; out[y*w+w-1] = 255; }
  return out;
}

function combineSketch(edges, thresh, w, h) {
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.min(edges[i], thresh[i]);
  }
  return out;
}

function invertPixels(gray) {
  const out = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) out[i] = 255 - gray[i];
  return out;
}

function colorize(gray, w, h, colorMode, customHex) {
  const out = new Uint8ClampedArray(w * h * 4);
  let fg, bg;
  switch (colorMode) {
    case 'black': fg = [0,0,0]; bg = [255,255,255]; break;
    case 'white': fg = [255,255,255]; bg = [0,0,0]; break;
    case 'red':   fg = [231,76,60]; bg = [255,255,255]; break;
    case 'blue':  fg = [52,152,219]; bg = [255,255,255]; break;
    case 'custom':
      fg = hexToRgb(customHex) || [108,99,255]; bg = [255,255,255]; break;
    default: fg = [0,0,0]; bg = [255,255,255];
  }
  for (let i = 0; i < gray.length; i++) {
    const t = gray[i] / 255; // 1 = white/bg, 0 = dark/fg
    const idx = i * 4;
    out[idx]   = lerp(fg[0], bg[0], t);
    out[idx+1] = lerp(fg[1], bg[1], t);
    out[idx+2] = lerp(fg[2], bg[2], t);
    out[idx+3] = 255;
  }
  return out;
}

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1],16), parseInt(r[2],16), parseInt(r[3],16)] : null;
}

function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }
function lerp(a, b, t) { return Math.round(a + (b-a) * t); }

// ─── Compare Slider ───────────────────────────────────────
const compareDivider = document.getElementById('compareDivider');
const compareCanvasLeft  = document.getElementById('compareCanvasLeft');
const compareCanvasRight = document.getElementById('compareCanvasRight');
let isDragging = false;

function drawCompare() {
  if (!state.img || !state.stencilReady) return;
  const img = state.img;
  const ctx2 = stencilCanvas.getContext('2d');
  const stencilImg = ctx2.getImageData(0, 0, stencilCanvas.width, stencilCanvas.height);

  compareCanvasRight.width  = stencilCanvas.width;
  compareCanvasRight.height = stencilCanvas.height;
  const ctxR = compareCanvasRight.getContext('2d');
  ctxR.putImageData(stencilImg, 0, 0);

  compareCanvasLeft.width  = stencilCanvas.width;
  compareCanvasLeft.height = stencilCanvas.height;
  const ctxL = compareCanvasLeft.getContext('2d');
  ctxL.drawImage(img, 0, 0, stencilCanvas.width, stencilCanvas.height);
  setDividerPos(50);
}

function setDividerPos(pct) {
  const w = compareCanvasRight.width;
  const px = (pct / 100) * w;
  compareDivider.style.left = pct + '%';
  compareCanvasLeft.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
}

compareDivider.addEventListener('mousedown', e => { isDragging = true; e.preventDefault(); });
compareView.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const rect = compareView.getBoundingClientRect();
  const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  setDividerPos(pct);
});
document.addEventListener('mouseup', () => { isDragging = false; });

// Touch support for compare
compareDivider.addEventListener('touchstart', e => { isDragging = true; e.preventDefault(); }, {passive:false});
compareView.addEventListener('touchmove', e => {
  if (!isDragging) return;
  const rect = compareView.getBoundingClientRect();
  const pct = Math.max(0, Math.min(100, ((e.touches[0].clientX - rect.left) / rect.width) * 100));
  setDividerPos(pct);
}, {passive:true});
document.addEventListener('touchend', () => { isDragging = false; });

// ─── Live sample stencils in hero ────────────────────────
function renderHeroSample(imgEl, containerId, threshold) {
  const container = document.getElementById(containerId);
  if (!container || !imgEl) return;
  const c = document.createElement('canvas');
  c.width = 100; c.height = 100;
  container.appendChild(c);
  const ctx = c.getContext('2d');
  const tmpImg = new Image();
  tmpImg.crossOrigin = 'anonymous';
  tmpImg.onload = () => {
    ctx.drawImage(tmpImg, 0, 0, 100, 100);
    const data = ctx.getImageData(0, 0, 100, 100);
    const gray = toGrayscale(data.data, 100, 100);
    const threshed = applyThreshold(gray, 100, 100, threshold, 1);
    const colored = colorize(threshed, 100, 100, 'black', '#000');
    ctx.putImageData(new ImageData(colored, 100, 100), 0, 0);
  };
  tmpImg.onerror = () => {
    // If CORS fails, fill with a pattern
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = '#1a1a2e';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Stencil', 50, 50);
    ctx.fillText('Preview', 50, 63);
  };
  tmpImg.src = imgEl.src;
}

window.addEventListener('load', () => {
  const imgs = document.querySelectorAll('.sample-img');
  if (imgs[0]) renderHeroSample(imgs[0], 'sampleStencil1', 100);
  if (imgs[1]) renderHeroSample(imgs[1], 'sampleStencil2', 140);
});

// ─── Paste from clipboard support ────────────────────────
document.addEventListener('paste', e => {
  const items = (e.clipboardData || window.clipboardData).items;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) { loadImage(file); break; }
    }
  }
});
