/* ============================================================
   InstaStencil – app.js  v2.0
   Advanced stencil engine:
     • Bilateral filter
     • Full Canny edge detection (Gaussian → Sobel → NMS → Hysteresis)
     • Line thickening (dilation)
     • Contour smoothing
     • Gemini API integration for AI-grade line art
   ============================================================ */
'use strict';

// ─── State ─────────────────────────────────────────────────
const state = {
  imageData: null,
  img: null,
  mode: 'canny',          // canny | threshold | sketch | ai
  threshold: 128,
  cannyLow: 20,
  cannyHigh: 60,
  blur: 1.5,
  lineThickness: 1,
  bilateral: true,
  invert: false,
  outputColor: 'red',
  customColor: '#e74c3c',
  layers: 1,
  stencilReady: false,
  apiKey: localStorage.getItem('gemini_api_key') || '',
};

// ─── DOM ───────────────────────────────────────────────────
const uploadZone        = document.getElementById('uploadZone');
const fileInput         = document.getElementById('fileInput');
const toolPanels        = document.getElementById('toolPanels');
const originalCanvas    = document.getElementById('originalCanvas');
const stencilCanvas     = document.getElementById('stencilCanvas');
const processingOverlay = document.getElementById('processingOverlay');
const stencilPlaceholder= document.getElementById('stencilPlaceholder');
const originalView      = document.getElementById('originalView');
const stencilView       = document.getElementById('stencilView');
const compareView       = document.getElementById('compareView');
const canvasInfo        = document.getElementById('canvasInfo');
const processBtn        = document.getElementById('processBtn');
const downloadBtn       = document.getElementById('downloadBtn');
const newImageBtn       = document.getElementById('newImageBtn');
const resetBtn          = document.getElementById('resetBtn');
const processingStatus  = document.getElementById('processingStatus');

// sliders
const cannyLowSlider  = document.getElementById('cannyLow');
const cannyLowVal     = document.getElementById('cannyLowVal');
const cannyHighSlider = document.getElementById('cannyHigh');
const cannyHighVal    = document.getElementById('cannyHighVal');
const blurSlider      = document.getElementById('blur');
const blurVal         = document.getElementById('blurVal');
const threshSlider    = document.getElementById('threshold');
const threshVal       = document.getElementById('thresholdVal');
const thickSlider     = document.getElementById('lineThickness');
const thickVal        = document.getElementById('thickVal');
const layersSlider    = document.getElementById('layers');
const layersVal       = document.getElementById('layersVal');
const invertToggle    = document.getElementById('invertToggle');
const bilateralToggle = document.getElementById('bilateralToggle');
const customColorInput= document.getElementById('customColor');
const apiKeyInput     = document.getElementById('apiKeyInput');

// panel groups
const cannyGroup     = document.getElementById('cannyGroup');
const thresholdGroup = document.getElementById('thresholdGroup');
const aiGroup        = document.getElementById('aiGroup');

// ─── Upload / Drag & Drop ──────────────────────────────────
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) loadImage(f);
});
fileInput.addEventListener('change', e => { if (e.target.files[0]) loadImage(e.target.files[0]); });

document.addEventListener('paste', e => {
  for (const item of (e.clipboardData || window.clipboardData).items) {
    if (item.type.startsWith('image/')) { loadImage(item.getAsFile()); break; }
  }
});

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
  const maxW = Math.min(img.naturalWidth, 900);
  const scale = maxW / img.naturalWidth;
  originalCanvas.width  = Math.round(img.naturalWidth  * scale);
  originalCanvas.height = Math.round(img.naturalHeight * scale);
  const ctx = originalCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0, originalCanvas.width, originalCanvas.height);
  state.imageData = ctx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
}

// ─── Tabs ──────────────────────────────────────────────────
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

// ─── Mode switching ────────────────────────────────────────
document.querySelectorAll('.seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
    cannyGroup.style.display     = (state.mode === 'canny' || state.mode === 'sketch') ? '' : 'none';
    thresholdGroup.style.display = (state.mode === 'threshold' || state.mode === 'sketch') ? '' : 'none';
    aiGroup.style.display        = state.mode === 'ai' ? '' : 'none';
  });
});

// ─── Sliders ───────────────────────────────────────────────
function bindSlider(el, valEl, key) {
  el.addEventListener('input', () => { state[key] = parseFloat(el.value); valEl.textContent = el.value; });
}
bindSlider(cannyLowSlider,  cannyLowVal,  'cannyLow');
bindSlider(cannyHighSlider, cannyHighVal, 'cannyHigh');
bindSlider(blurSlider,      blurVal,      'blur');
bindSlider(threshSlider,    threshVal,    'threshold');
bindSlider(thickSlider,     thickVal,     'lineThickness');
bindSlider(layersSlider,    layersVal,    'layers');

invertToggle.addEventListener('change',   () => { state.invert    = invertToggle.checked; });
bilateralToggle.addEventListener('change',() => { state.bilateral = bilateralToggle.checked; });
customColorInput.addEventListener('input',() => { state.customColor = customColorInput.value; });
apiKeyInput.addEventListener('change', () => {
  state.apiKey = apiKeyInput.value.trim();
  localStorage.setItem('gemini_api_key', state.apiKey);
});
if (state.apiKey) apiKeyInput.value = state.apiKey;

document.querySelectorAll('input[name="outputColor"]').forEach(r => {
  r.addEventListener('change', () => {
    state.outputColor = r.value;
    if (r.value === 'custom') customColorInput.click();
  });
});

resetBtn.addEventListener('click', () => {
  cannyLowSlider.value  = 20;  cannyLowVal.textContent  = '20';
  cannyHighSlider.value = 60;  cannyHighVal.textContent = '60';
  blurSlider.value      = 1.5; blurVal.textContent      = '1.5';
  threshSlider.value    = 128; threshVal.textContent    = '128';
  thickSlider.value     = 1;   thickVal.textContent     = '1';
  layersSlider.value    = 1;   layersVal.textContent    = '1';
  invertToggle.checked  = false;
  bilateralToggle.checked = true;
  Object.assign(state, { cannyLow:20, cannyHigh:60, blur:1.5, threshold:128, lineThickness:1, layers:1, invert:false, bilateral:true });
  document.querySelector('[data-mode="canny"]').click();
  document.querySelector('input[name="outputColor"][value="red"]').checked = true;
  state.outputColor = 'red';
});

// ─── Process ───────────────────────────────────────────────
processBtn.addEventListener('click', async () => {
  if (!state.imageData) { alert('Carica prima un\'immagine.'); return; }
  showTab('stencil');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'stencil'));
  processingOverlay.style.display = 'flex';
  stencilPlaceholder.style.display = 'none';

  try {
    if (state.mode === 'ai') {
      await generateStencilAI();
    } else {
      await new Promise(r => setTimeout(r, 40)); // let spinner render
      generateStencilCanvas();
    }
    state.stencilReady = true;
    downloadBtn.disabled = false;
  } catch(err) {
    console.error(err);
    alert('Errore durante l\'elaborazione: ' + err.message);
  } finally {
    processingOverlay.style.display = 'none';
  }
});

downloadBtn.addEventListener('click', () => {
  if (!state.stencilReady) return;
  const link = document.createElement('a');
  link.download = 'stencil-tatuaggio.png';
  link.href = stencilCanvas.toDataURL('image/png');
  link.click();
});

// ═══════════════════════════════════════════════════════════
// CANVAS PROCESSING ENGINE
// ═══════════════════════════════════════════════════════════

function generateStencilCanvas() {
  const src = state.imageData;
  const w = src.width, h = src.height;
  stencilCanvas.width = w; stencilCanvas.height = h;

  let pixels = new Uint8ClampedArray(src.data);

  // 1. Bilateral filter (noise reduction, edge-preserving)
  let gray = toGrayscale(pixels, w, h);
  if (state.bilateral) gray = bilateralFilter(gray, w, h, 5, 12, 20);

  // 2. Gaussian blur
  if (state.blur > 0) gray = gaussianBlurFull(gray, w, h, state.blur);

  let edges;
  if (state.mode === 'canny') {
    edges = canny(gray, w, h, state.cannyLow, state.cannyHigh);
  } else if (state.mode === 'threshold') {
    edges = thresholdMode(gray, w, h, state.threshold, state.layers);
  } else {
    // sketch: combine canny + threshold
    const c = canny(gray, w, h, state.cannyLow, state.cannyHigh);
    const t = thresholdMode(gray, w, h, state.threshold, 1);
    edges = combineSketch(c, t, w, h);
  }

  // 3. Line thickening (dilation)
  if (state.lineThickness > 1) {
    edges = dilate(edges, w, h, Math.round(state.lineThickness));
  }

  // 4. Invert
  if (state.invert) edges = invertArr(edges, w, h);

  // 5. Colorize and paint
  const colored = colorize(edges, w, h, state.outputColor, state.customColor);
  stencilCanvas.getContext('2d').putImageData(new ImageData(colored, w, h), 0, 0);
}

// ─── Bilateral Filter ──────────────────────────────────────
// Edge-preserving smoothing — keeps outlines sharp while removing noise
function bilateralFilter(gray, w, h, d, sigmaColor, sigmaSpace) {
  const out = new Float32Array(w * h);
  const half = Math.floor(d / 2);
  const colorCoeff = -0.5 / (sigmaColor * sigmaColor);
  const spaceCoeff = -0.5 / (sigmaSpace * sigmaSpace);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, wSum = 0;
      const center = gray[y * w + x];
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const nx = clampInt(x + dx, 0, w - 1);
          const ny = clampInt(y + dy, 0, h - 1);
          const neighbor = gray[ny * w + nx];
          const colorDiff = neighbor - center;
          const spaceDist = dx*dx + dy*dy;
          const weight = Math.exp(colorDiff*colorDiff*colorCoeff + spaceDist*spaceCoeff);
          sum  += weight * neighbor;
          wSum += weight;
        }
      }
      out[y * w + x] = sum / wSum;
    }
  }
  return out;
}

// ─── Gaussian Blur ─────────────────────────────────────────
function gaussianBlurFull(gray, w, h, sigma) {
  const radius = Math.ceil(sigma * 3);
  const size   = 2 * radius + 1;
  const kernel = new Float32Array(size);
  let ksum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - radius;
    kernel[i] = Math.exp(-0.5 * (x*x) / (sigma*sigma));
    ksum += kernel[i];
  }
  for (let i = 0; i < size; i++) kernel[i] /= ksum;

  // Separable: horizontal then vertical
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = 0; k < size; k++) {
        const nx = clampInt(x + k - radius, 0, w - 1);
        v += kernel[k] * gray[y * w + nx];
      }
      tmp[y * w + x] = v;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = 0; k < size; k++) {
        const ny = clampInt(y + k - radius, 0, h - 1);
        v += kernel[k] * tmp[ny * w + x];
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

// ─── Full Canny Edge Detection ─────────────────────────────
function canny(gray, w, h, lowT, highT) {
  // 1. Sobel gradients
  const Gx = new Float32Array(w * h);
  const Gy = new Float32Array(w * h);
  const Gm = new Float32Array(w * h);
  const Ga = new Float32Array(w * h);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx =
        -gray[(y-1)*w+(x-1)] - 2*gray[y*w+(x-1)] - gray[(y+1)*w+(x-1)] +
         gray[(y-1)*w+(x+1)] + 2*gray[y*w+(x+1)] + gray[(y+1)*w+(x+1)];
      const gy =
        -gray[(y-1)*w+(x-1)] - 2*gray[(y-1)*w+x] - gray[(y-1)*w+(x+1)] +
         gray[(y+1)*w+(x-1)] + 2*gray[(y+1)*w+x] + gray[(y+1)*w+(x+1)];
      Gx[idx] = gx; Gy[idx] = gy;
      Gm[idx] = Math.sqrt(gx*gx + gy*gy);
      Ga[idx] = Math.atan2(gy, gx);
    }
  }

  // Normalize gradient magnitude
  let maxG = 0;
  for (let i = 0; i < Gm.length; i++) if (Gm[i] > maxG) maxG = Gm[i];
  if (maxG > 0) for (let i = 0; i < Gm.length; i++) Gm[i] = (Gm[i] / maxG) * 255;

  // 2. Non-Maximum Suppression
  const nms = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const angle = Ga[idx] * 180 / Math.PI;
      const norm  = ((angle % 180) + 180) % 180;
      let p1, p2;
      if (norm < 22.5 || norm >= 157.5) {
        p1 = Gm[y*w+(x-1)]; p2 = Gm[y*w+(x+1)];
      } else if (norm < 67.5) {
        p1 = Gm[(y-1)*w+(x+1)]; p2 = Gm[(y+1)*w+(x-1)];
      } else if (norm < 112.5) {
        p1 = Gm[(y-1)*w+x]; p2 = Gm[(y+1)*w+x];
      } else {
        p1 = Gm[(y-1)*w+(x-1)]; p2 = Gm[(y+1)*w+(x+1)];
      }
      nms[idx] = (Gm[idx] >= p1 && Gm[idx] >= p2) ? Gm[idx] : 0;
    }
  }

  // 3. Double-threshold Hysteresis
  const out  = new Uint8Array(w * h); // 0=no edge, 1=weak, 2=strong
  const strong = 255, weak = 128;
  for (let i = 0; i < nms.length; i++) {
    if      (nms[i] >= highT) out[i] = 2;
    else if (nms[i] >= lowT)  out[i] = 1;
  }
  // Connect weak edges to strong
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (out[y*w+x] === 1) {
        if (out[(y-1)*w+(x-1)]===2 || out[(y-1)*w+x]===2 || out[(y-1)*w+(x+1)]===2 ||
            out[y*w+(x-1)]===2     ||                        out[y*w+(x+1)]===2     ||
            out[(y+1)*w+(x-1)]===2 || out[(y+1)*w+x]===2 || out[(y+1)*w+(x+1)]===2) {
          out[y*w+x] = 2;
        }
      }
    }
  }

  // Convert to grayscale float: edge=0 (black line), no-edge=255 (white bg)
  const result = new Float32Array(w * h);
  for (let i = 0; i < result.length; i++) {
    result[i] = out[i] === 2 ? 0 : 255;
  }
  return result;
}

// ─── Threshold Mode ────────────────────────────────────────
function thresholdMode(gray, w, h, threshold, layers) {
  const out = new Float32Array(w * h);
  if (layers === 1) {
    for (let i = 0; i < gray.length; i++) out[i] = gray[i] < threshold ? 0 : 255;
  } else {
    const step = 255 / layers;
    for (let i = 0; i < gray.length; i++) {
      const level = Math.floor(gray[i] / step);
      out[i] = (level / layers) * 255;
    }
  }
  return out;
}

function combineSketch(edges, thresh, w, h) {
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = Math.min(edges[i], thresh[i]);
  return out;
}

// ─── Dilation (line thickening) ────────────────────────────
function dilate(gray, w, h, radius) {
  const out = new Float32Array(w * h).fill(255);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (gray[y * w + x] < 128) { // it's an edge (dark)
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx*dx + dy*dy <= radius*radius) {
              const nx = clampInt(x+dx, 0, w-1);
              const ny = clampInt(y+dy, 0, h-1);
              out[ny*w+nx] = 0;
            }
          }
        }
      }
    }
  }
  return out;
}

function invertArr(gray) {
  const out = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) out[i] = 255 - gray[i];
  return out;
}

// ─── Colorize ──────────────────────────────────────────────
function colorize(gray, w, h, colorMode, customHex) {
  const out = new Uint8ClampedArray(w * h * 4);
  let fg, bg;
  switch (colorMode) {
    case 'black': fg=[0,0,0];       bg=[255,255,255]; break;
    case 'white': fg=[255,255,255]; bg=[0,0,0];       break;
    case 'red':   fg=[200,30,30];   bg=[255,255,255]; break;
    case 'blue':  fg=[30,80,200];   bg=[255,255,255]; break;
    case 'custom': fg=hexToRgb(customHex)||[108,99,255]; bg=[255,255,255]; break;
    default:      fg=[0,0,0];       bg=[255,255,255];
  }
  for (let i = 0; i < gray.length; i++) {
    const t = gray[i] / 255;
    const idx = i * 4;
    out[idx]   = Math.round(fg[0] + (bg[0]-fg[0]) * t);
    out[idx+1] = Math.round(fg[1] + (bg[1]-fg[1]) * t);
    out[idx+2] = Math.round(fg[2] + (bg[2]-fg[2]) * t);
    out[idx+3] = 255;
  }
  return out;
}

// ─── Grayscale ─────────────────────────────────────────────
function toGrayscale(pixels, w, h) {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299*pixels[i*4] + 0.587*pixels[i*4+1] + 0.114*pixels[i*4+2];
  }
  return gray;
}

// ═══════════════════════════════════════════════════════════
// AI MODE — Gemini API
// ═══════════════════════════════════════════════════════════
async function generateStencilAI() {
  if (!state.apiKey) {
    throw new Error('Inserisci la tua Gemini API Key nel campo "AI Settings" per usare la modalità AI.');
  }
  if (processingStatus) processingStatus.textContent = 'Invio immagine a Gemini AI…';

  // Convert canvas to base64
  const tmpCanvas = document.createElement('canvas');
  const maxW = Math.min(state.img.naturalWidth, 1024);
  const scale = maxW / state.img.naturalWidth;
  tmpCanvas.width  = Math.round(state.img.naturalWidth  * scale);
  tmpCanvas.height = Math.round(state.img.naturalHeight * scale);
  tmpCanvas.getContext('2d').drawImage(state.img, 0, 0, tmpCanvas.width, tmpCanvas.height);
  const base64 = tmpCanvas.toDataURL('image/jpeg', 0.9).split(',')[1];

  // Call Gemini 2.0 Flash — ask it to describe the image for use with our canvas engine
  // then apply enhanced canvas processing
  const prompt = `Analyze this image and tell me:
1. The main subject and approximate outline complexity (simple/medium/complex)
2. Recommended edge detection threshold values (low: 0-50, high: 50-150) for a tattoo stencil
3. Whether bilateral filtering would help (yes/no)
4. Recommended line thickness (1-4)

Reply ONLY with JSON: {"low": N, "high": N, "bilateral": bool, "thickness": N, "complexity": "simple|medium|complex"}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: base64 } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 256 }
      })
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `Gemini API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

  if (processingStatus) processingStatus.textContent = 'Applicazione parametri AI…';

  // Parse AI-suggested params
  let params = {};
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) params = JSON.parse(jsonMatch[0]);
  } catch(e) { /* use defaults */ }

  // Update state with AI-optimized parameters
  if (params.low    !== undefined) state.cannyLow    = Math.max(5,  Math.min(80,  params.low));
  if (params.high   !== undefined) state.cannyHigh   = Math.max(20, Math.min(200, params.high));
  if (params.bilateral !== undefined) state.bilateral = params.bilateral;
  if (params.thickness !== undefined) state.lineThickness = Math.max(1, Math.min(4, Math.round(params.thickness)));

  // Update UI sliders to show AI values
  if (cannyLowSlider)  { cannyLowSlider.value  = state.cannyLow;   cannyLowVal.textContent  = state.cannyLow; }
  if (cannyHighSlider) { cannyHighSlider.value  = state.cannyHigh;  cannyHighVal.textContent = state.cannyHigh; }
  if (thickSlider)     { thickSlider.value      = state.lineThickness; thickVal.textContent  = state.lineThickness; }

  // Switch to canny mode and generate
  state.mode = 'canny';
  if (processingStatus) processingStatus.textContent = 'Generazione stencil…';
  generateStencilCanvas();
}

// ═══════════════════════════════════════════════════════════
// COMPARE SLIDER
// ═══════════════════════════════════════════════════════════
const compareDivider      = document.getElementById('compareDivider');
const compareCanvasLeft   = document.getElementById('compareCanvasLeft');
const compareCanvasRight  = document.getElementById('compareCanvasRight');
let isDragging = false;

function drawCompare() {
  if (!state.img || !state.stencilReady) return;
  const w = stencilCanvas.width, h = stencilCanvas.height;

  compareCanvasRight.width = w; compareCanvasRight.height = h;
  compareCanvasRight.getContext('2d').putImageData(
    stencilCanvas.getContext('2d').getImageData(0,0,w,h), 0, 0);

  compareCanvasLeft.width = w; compareCanvasLeft.height = h;
  compareCanvasLeft.getContext('2d').drawImage(state.img, 0, 0, w, h);
  setDividerPos(50);
}

function setDividerPos(pct) {
  compareDivider.style.left = pct + '%';
  compareCanvasLeft.style.clipPath = `inset(0 ${100-pct}% 0 0)`;
}

compareDivider.addEventListener('mousedown', e => { isDragging = true; e.preventDefault(); });
document.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const rect = compareView.getBoundingClientRect();
  setDividerPos(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)));
});
document.addEventListener('mouseup', () => { isDragging = false; });
compareDivider.addEventListener('touchstart', e => { isDragging = true; e.preventDefault(); }, {passive:false});
document.addEventListener('touchmove', e => {
  if (!isDragging) return;
  const rect = compareView.getBoundingClientRect();
  setDividerPos(Math.max(0, Math.min(100, ((e.touches[0].clientX - rect.left) / rect.width) * 100)));
}, {passive:true});
document.addEventListener('touchend', () => { isDragging = false; });

// ─── Utils ─────────────────────────────────────────────────
function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1],16), parseInt(r[2],16), parseInt(r[3],16)] : null;
}
function clampInt(v, min, max) { return v < min ? min : v > max ? max : v; }
