/* ============================================================
   InstaStencil – app.js v3.0 (Italiano)
   Motore di elaborazione avanzato:
     • Modalità TRACCIATO: contour tracing + canvas path rendering
       → linee continue, levigata, stile illustrazione tatuaggio
     • Canny completo (Gaussian→Sobel→NMS→Hysteresis)
     • Filtro bilaterale (edge-preserving)
     • Ispessimento morfologico (dilation)
     • Integrazione Gemini API
   ============================================================ */
'use strict';

// ─── Stato ─────────────────────────────────────────────────
const state = {
  imageData: null,
  img: null,
  mode: 'tracciato',
  sensitivita: 30,
  dettaglio: 60,
  cannyLow: 20,
  cannyHigh: 60,
  threshold: 128,
  blur: 1.5,
  lineThickness: 2,
  bilateral: true,
  invert: false,
  outputColor: 'red',
  customColor: '#c81e1e',
  layers: 1,
  stencilReady: false,
  apiKey: localStorage.getItem('gemini_api_key') || '',
};

const modeDescriptions = {
  tracciato: 'Traccia tutti gli outline con linee continue e levigata. Ideale per stencil da tatuaggio.',
  canny:     'Rilevamento bordi Canny completo (NMS + Isteresi). Ottimo per soggetti con contrasto netto.',
  soglia:    'Conversione in bianco e nero per soglia di luminosità. Funziona bene con immagini già ad alto contrasto.',
  ai:        'Gemini AI analizza l\'immagine e imposta automaticamente i parametri ottimali per il tuo stencil.',
};

// ─── DOM ───────────────────────────────────────────────────
const uploadZone         = document.getElementById('uploadZone');
const fileInput          = document.getElementById('fileInput');
const toolPanels         = document.getElementById('toolPanels');
const originalCanvas     = document.getElementById('originalCanvas');
const stencilCanvas      = document.getElementById('stencilCanvas');
const processingOverlay  = document.getElementById('processingOverlay');
const stencilPlaceholder = document.getElementById('stencilPlaceholder');
const originalView       = document.getElementById('originalView');
const stencilView        = document.getElementById('stencilView');
const compareView        = document.getElementById('compareView');
const canvasInfo         = document.getElementById('canvasInfo');
const processBtn         = document.getElementById('processBtn');
const downloadBtn        = document.getElementById('downloadBtn');
const newImageBtn        = document.getElementById('newImageBtn');
const resetBtn           = document.getElementById('resetBtn');
const processingStatus   = document.getElementById('processingStatus');
const modeDescText       = document.getElementById('modeDescText');

// sliders
const sensSlider      = document.getElementById('sensitivita');
const sensVal         = document.getElementById('sensVal');
const dettaglioSlider = document.getElementById('dettaglio');
const dettaglioVal    = document.getElementById('dettaglioVal');
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

// gruppi pannello
const tracciatoGroup = document.getElementById('tracciatoGroup');
const cannyGroup     = document.getElementById('cannyGroup');
const sogliaGroup    = document.getElementById('sogliaGroup');
const aiGroup        = document.getElementById('aiGroup');

// ─── Upload / Trascina & Rilascia ──────────────────────────
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) caricaImmagine(f);
});
fileInput.addEventListener('change', e => { if (e.target.files[0]) caricaImmagine(e.target.files[0]); });
document.addEventListener('paste', e => {
  for (const item of (e.clipboardData || window.clipboardData).items)
    if (item.type.startsWith('image/')) { caricaImmagine(item.getAsFile()); break; }
});
newImageBtn.addEventListener('click', () => {
  toolPanels.style.display = 'none';
  uploadZone.style.display = 'flex';
  fileInput.value = '';
  state.stencilReady = false;
  downloadBtn.disabled = true;
});

function caricaImmagine(file) {
  if (file.size > 20 * 1024 * 1024) { alert('File troppo grande. Max 20MB.'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      state.img = img;
      uploadZone.style.display = 'none';
      toolPanels.style.display = 'grid';
      disegnaOriginale(img);
      mostraTab('originale');
      canvasInfo.textContent = `${img.naturalWidth} × ${img.naturalHeight} px · ${(file.size/1024).toFixed(0)} KB`;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function disegnaOriginale(img) {
  const maxW = Math.min(img.naturalWidth, 900);
  const scale = maxW / img.naturalWidth;
  originalCanvas.width  = Math.round(img.naturalWidth  * scale);
  originalCanvas.height = Math.round(img.naturalHeight * scale);
  const ctx = originalCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0, originalCanvas.width, originalCanvas.height);
  state.imageData = ctx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
}

// ─── Tab ───────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mostraTab(btn.dataset.tab);
  });
});

function mostraTab(tab) {
  originalView.style.display = tab === 'originale' ? 'flex' : 'none';
  stencilView.style.display  = tab === 'stencil'   ? 'flex' : 'none';
  compareView.style.display  = tab === 'confronto' ? 'flex' : 'none';
  if (tab === 'confronto' && state.stencilReady) disegnaConfronto();
}

// ─── Cambio Modalità ───────────────────────────────────────
document.querySelectorAll('.seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
    tracciatoGroup.style.display = state.mode === 'tracciato' ? ''       : 'none';
    cannyGroup.style.display     = state.mode === 'canny'     ? ''       : 'none';
    sogliaGroup.style.display    = state.mode === 'soglia'    ? ''       : 'none';
    aiGroup.style.display        = state.mode === 'ai'        ? ''       : 'none';
    if (modeDescText) modeDescText.textContent = modeDescriptions[state.mode] || '';
  });
});

// ─── Slider ────────────────────────────────────────────────
function bindSlider(el, valEl, key) {
  if (!el) return;
  el.addEventListener('input', () => { state[key] = parseFloat(el.value); if(valEl) valEl.textContent = el.value; });
}
bindSlider(sensSlider,      sensVal,       'sensitivita');
bindSlider(dettaglioSlider, dettaglioVal,  'dettaglio');
bindSlider(cannyLowSlider,  cannyLowVal,   'cannyLow');
bindSlider(cannyHighSlider, cannyHighVal,  'cannyHigh');
bindSlider(blurSlider,      blurVal,       'blur');
bindSlider(threshSlider,    threshVal,     'threshold');
bindSlider(thickSlider,     thickVal,      'lineThickness');
bindSlider(layersSlider,    layersVal,     'layers');

invertToggle.addEventListener('change',    () => { state.invert    = invertToggle.checked; });
bilateralToggle.addEventListener('change', () => { state.bilateral = bilateralToggle.checked; });
customColorInput.addEventListener('input', () => { state.customColor = customColorInput.value; });
if (apiKeyInput) {
  apiKeyInput.addEventListener('change', () => {
    state.apiKey = apiKeyInput.value.trim();
    localStorage.setItem('gemini_api_key', state.apiKey);
  });
  if (state.apiKey) apiKeyInput.value = state.apiKey;
}

document.querySelectorAll('input[name="outputColor"]').forEach(r => {
  r.addEventListener('change', () => {
    state.outputColor = r.value;
    if (r.value === 'custom') customColorInput.click();
  });
});

resetBtn.addEventListener('click', () => {
  sensSlider.value      = 30;  sensVal.textContent      = '30';
  dettaglioSlider.value = 60;  dettaglioVal.textContent = '60';
  cannyLowSlider.value  = 20;  cannyLowVal.textContent  = '20';
  cannyHighSlider.value = 60;  cannyHighVal.textContent = '60';
  blurSlider.value      = 1.5; blurVal.textContent      = '1.5';
  threshSlider.value    = 128; threshVal.textContent    = '128';
  thickSlider.value     = 2;   thickVal.textContent     = '2';
  layersSlider.value    = 1;   layersVal.textContent    = '1';
  invertToggle.checked  = false;
  bilateralToggle.checked = true;
  Object.assign(state, { sensitivita:30, dettaglio:60, cannyLow:20, cannyHigh:60, blur:1.5, threshold:128, lineThickness:2, layers:1, invert:false, bilateral:true, outputColor:'red', mode:'tracciato' });
  document.querySelector('[data-mode="tracciato"]').click();
  document.querySelector('input[name="outputColor"][value="red"]').checked = true;
});

// ─── Genera Stencil ────────────────────────────────────────
processBtn.addEventListener('click', async () => {
  if (!state.imageData) { alert('Carica prima un\'immagine.'); return; }
  mostraTab('stencil');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'stencil'));
  processingOverlay.style.display = 'flex';
  stencilPlaceholder.style.display = 'none';
  if (processingStatus) processingStatus.textContent = 'Elaborazione in corso…';

  try {
    if (state.mode === 'ai') {
      await generaStencilAI();
    } else {
      await new Promise(r => setTimeout(r, 50));
      generaStencilCanvas();
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
//  MOTORE CANVAS
// ═══════════════════════════════════════════════════════════
function generaStencilCanvas() {
  const src = state.imageData;
  const w = src.width, h = src.height;
  stencilCanvas.width = w; stencilCanvas.height = h;

  let pixels = new Uint8ClampedArray(src.data);
  let gray = toGrayscale(pixels, w, h);

  // Filtro bilaterale
  if (state.bilateral) gray = bilateralFilter(gray, w, h, 5, 12, 20);

  // Levigatura gaussiana
  if (state.blur > 0) gray = gaussianBlur(gray, w, h, state.blur);

  if (state.mode === 'tracciato') {
    generaTracciato(gray, w, h);
  } else {
    let edges;
    if (state.mode === 'canny') {
      edges = canny(gray, w, h, state.cannyLow, state.cannyHigh);
    } else {
      edges = thresholdMode(gray, w, h, state.threshold, state.layers);
    }
    if (state.lineThickness > 1) edges = dilata(edges, w, h, state.lineThickness);
    if (state.invert) edges = invertArr(edges);
    const colored = colorizza(edges, w, h, state.outputColor, state.customColor);
    stencilCanvas.getContext('2d').putImageData(new ImageData(colored, w, h), 0, 0);
  }
}

// ═══════════════════════════════════════════════════════════
//  MODALITÀ TRACCIATO — Contour Tracing + Path Rendering
//  Produce linee continue e levigata come il line art professionale
// ═══════════════════════════════════════════════════════════
function generaTracciato(gray, w, h) {
  const ctx = stencilCanvas.getContext('2d');

  // 1. Sfondo bianco (o nero se invert)
  ctx.fillStyle = state.invert ? '#000000' : '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // 2. Rileva bordi con Canny usando sensitivita/dettaglio
  const low  = Math.max(1, state.sensitivita * 0.5);
  const high = Math.max(low + 5, state.dettaglio * 0.65);
  const edgeMap = canny(gray, w, h, low, high);

  // 3. Mappa binaria dei bordi: true = bordo
  const isBordo = new Uint8Array(w * h);
  for (let i = 0; i < edgeMap.length; i++) {
    isBordo[i] = edgeMap[i] < 128 ? 1 : 0;
  }

  // 4. Estrai contorni con algoritmo di chain tracing
  const contorni = estraiContorni(isBordo, w, h);

  // 5. Disegna contorni come path levigata su canvas
  const colore = getColor(state.outputColor, state.customColor);
  const spessore = Math.max(0.8, state.lineThickness * 0.6);

  ctx.strokeStyle = state.invert ? '#ffffff' : colore;
  ctx.lineWidth   = spessore;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  // Raggruppa contorni per lunghezza — scarta quelli troppo corti (rumore)
  const minLen = 3;
  for (const contorno of contorni) {
    if (contorno.length < minLen) continue;
    disegnaContornoLevigato(ctx, contorno);
  }

  // 6. Se spessore > 2, fai un secondo passaggio per ispessire
  if (state.lineThickness >= 3) {
    ctx.lineWidth = spessore * 1.6;
    ctx.globalAlpha = 0.4;
    for (const contorno of contorni) {
      if (contorno.length < minLen) continue;
      disegnaContornoLevigato(ctx, contorno);
    }
    ctx.globalAlpha = 1.0;
  }
}

// Estrai contorni dalla mappa binaria dei bordi
function estraiContorni(isBordo, w, h) {
  const visitato = new Uint8Array(w * h);
  const contorni = [];

  // 8 direzioni di esplorazione (chain code)
  const dx = [1, 1, 0,-1,-1,-1, 0, 1];
  const dy = [0, 1, 1, 1, 0,-1,-1,-1];

  for (let y = 1; y < h-1; y++) {
    for (let x = 1; x < w-1; x++) {
      const idx = y * w + x;
      if (!isBordo[idx] || visitato[idx]) continue;

      // Avvia un nuovo contorno da questo pixel
      const contorno = [];
      const coda = [[x, y]];
      visitato[idx] = 1;

      while (coda.length > 0) {
        const [cx, cy] = coda.shift();
        contorno.push([cx, cy]);

        // Esplora i vicini in ordine per formare catene continue
        for (let d = 0; d < 8; d++) {
          const nx = cx + dx[d];
          const ny = cy + dy[d];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (isBordo[ni] && !visitato[ni]) {
            visitato[ni] = 1;
            coda.push([nx, ny]);
          }
        }
      }

      if (contorno.length >= 2) contorni.push(contorno);
    }
  }
  return contorni;
}

// Disegna un contorno come curva Bezier levigata
function disegnaContornoLevigato(ctx, punti) {
  if (punti.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(punti[0][0], punti[0][1]);

  if (punti.length === 2) {
    ctx.lineTo(punti[1][0], punti[1][1]);
  } else if (punti.length <= 4) {
    for (let i = 1; i < punti.length; i++) {
      ctx.lineTo(punti[i][0], punti[i][1]);
    }
  } else {
    // Curva catmull-rom → bezier levigata
    for (let i = 1; i < punti.length - 2; i++) {
      const p0 = punti[Math.max(0, i-1)];
      const p1 = punti[i];
      const p2 = punti[i+1];
      const p3 = punti[Math.min(punti.length-1, i+2)];

      // Tangenti Catmull-Rom
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2[0], p2[1]);
    }
    // Ultimo segmento
    const last = punti[punti.length-1];
    ctx.lineTo(last[0], last[1]);
  }
  ctx.stroke();
}

// ═══════════════════════════════════════════════════════════
//  ALGORITMI DI ELABORAZIONE IMMAGINE
// ═══════════════════════════════════════════════════════════

function bilateralFilter(gray, w, h, d, sigmaColor, sigmaSpace) {
  const out = new Float32Array(w * h);
  const half = Math.floor(d / 2);
  const colorCoeff = -0.5 / (sigmaColor * sigmaColor);
  const spaceCoeff = -0.5 / (sigmaSpace * sigmaSpace);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, wSum = 0;
      const center = gray[y*w+x];
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const nx = clampInt(x+dx, 0, w-1), ny = clampInt(y+dy, 0, h-1);
          const nb = gray[ny*w+nx];
          const diff = nb - center;
          const dist = dx*dx + dy*dy;
          const weight = Math.exp(diff*diff*colorCoeff + dist*spaceCoeff);
          sum += weight * nb; wSum += weight;
        }
      }
      out[y*w+x] = sum / wSum;
    }
  }
  return out;
}

function gaussianBlur(gray, w, h, sigma) {
  const radius = Math.ceil(sigma * 3);
  const size = 2*radius+1;
  const kernel = new Float32Array(size);
  let ksum = 0;
  for (let i = 0; i < size; i++) {
    const x = i - radius;
    kernel[i] = Math.exp(-0.5 * x*x / (sigma*sigma));
    ksum += kernel[i];
  }
  for (let i = 0; i < size; i++) kernel[i] /= ksum;
  const tmp = new Float32Array(w*h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = 0; k < size; k++) v += kernel[k] * gray[y*w + clampInt(x+k-radius,0,w-1)];
      tmp[y*w+x] = v;
    }
  const out = new Float32Array(w*h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = 0; k < size; k++) v += kernel[k] * tmp[clampInt(y+k-radius,0,h-1)*w+x];
      out[y*w+x] = v;
    }
  return out;
}

function canny(gray, w, h, lowT, highT) {
  // Sobel
  const Gm = new Float32Array(w*h), Ga = new Float32Array(w*h);
  for (let y = 1; y < h-1; y++) {
    for (let x = 1; x < w-1; x++) {
      const gx = -gray[(y-1)*w+(x-1)] - 2*gray[y*w+(x-1)] - gray[(y+1)*w+(x-1)]
                 +gray[(y-1)*w+(x+1)] + 2*gray[y*w+(x+1)] + gray[(y+1)*w+(x+1)];
      const gy = -gray[(y-1)*w+(x-1)] - 2*gray[(y-1)*w+x] - gray[(y-1)*w+(x+1)]
                 +gray[(y+1)*w+(x-1)] + 2*gray[(y+1)*w+x] + gray[(y+1)*w+(x+1)];
      Gm[y*w+x] = Math.sqrt(gx*gx + gy*gy);
      Ga[y*w+x] = Math.atan2(gy, gx);
    }
  }
  // Normalizza
  let maxG = 0;
  for (let i = 0; i < Gm.length; i++) if (Gm[i] > maxG) maxG = Gm[i];
  if (maxG > 0) for (let i = 0; i < Gm.length; i++) Gm[i] = Gm[i] / maxG * 255;
  // NMS
  const nms = new Float32Array(w*h);
  for (let y = 1; y < h-1; y++) {
    for (let x = 1; x < w-1; x++) {
      const idx = y*w+x;
      const ang = ((Ga[idx]*180/Math.PI) % 180 + 180) % 180;
      let p1, p2;
      if (ang < 22.5 || ang >= 157.5)       { p1=Gm[y*w+(x-1)]; p2=Gm[y*w+(x+1)]; }
      else if (ang < 67.5)                   { p1=Gm[(y-1)*w+(x+1)]; p2=Gm[(y+1)*w+(x-1)]; }
      else if (ang < 112.5)                  { p1=Gm[(y-1)*w+x]; p2=Gm[(y+1)*w+x]; }
      else                                   { p1=Gm[(y-1)*w+(x-1)]; p2=Gm[(y+1)*w+(x+1)]; }
      nms[idx] = (Gm[idx]>=p1 && Gm[idx]>=p2) ? Gm[idx] : 0;
    }
  }
  // Isteresi
  const out = new Uint8Array(w*h);
  for (let i = 0; i < nms.length; i++) {
    if      (nms[i] >= highT) out[i] = 2;
    else if (nms[i] >= lowT)  out[i] = 1;
  }
  for (let y = 1; y < h-1; y++) {
    for (let x = 1; x < w-1; x++) {
      if (out[y*w+x]===1) {
        const n = out;
        if (n[(y-1)*w+(x-1)]===2||n[(y-1)*w+x]===2||n[(y-1)*w+(x+1)]===2||
            n[y*w+(x-1)]===2    ||                   n[y*w+(x+1)]===2    ||
            n[(y+1)*w+(x-1)]===2||n[(y+1)*w+x]===2||n[(y+1)*w+(x+1)]===2)
          out[y*w+x]=2;
      }
    }
  }
  const result = new Float32Array(w*h);
  for (let i = 0; i < result.length; i++) result[i] = out[i]===2 ? 0 : 255;
  return result;
}

function thresholdMode(gray, w, h, threshold, layers) {
  const out = new Float32Array(w*h);
  if (layers===1) {
    for (let i = 0; i < gray.length; i++) out[i] = gray[i] < threshold ? 0 : 255;
  } else {
    const step = 255/layers;
    for (let i = 0; i < gray.length; i++) out[i] = (Math.floor(gray[i]/step)/layers)*255;
  }
  return out;
}

function dilata(gray, w, h, radius) {
  const out = new Float32Array(w*h).fill(255);
  const r2 = radius*radius;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (gray[y*w+x] < 128) {
        for (let dy=-radius; dy<=radius; dy++) {
          for (let dx=-radius; dx<=radius; dx++) {
            if (dx*dx+dy*dy<=r2) {
              const nx=clampInt(x+dx,0,w-1), ny=clampInt(y+dy,0,h-1);
              out[ny*w+nx]=0;
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
  for (let i = 0; i < gray.length; i++) out[i] = 255-gray[i];
  return out;
}

function colorizza(gray, w, h, colorMode, customHex) {
  const out = new Uint8ClampedArray(w*h*4);
  let fg, bg;
  switch(colorMode) {
    case 'black': fg=[0,0,0];       bg=[255,255,255]; break;
    case 'white': fg=[255,255,255]; bg=[0,0,0];       break;
    case 'red':   fg=[200,30,30];   bg=[255,255,255]; break;
    case 'blue':  fg=[30,80,200];   bg=[255,255,255]; break;
    case 'custom': fg=hexToRgb(customHex)||[108,99,255]; bg=[255,255,255]; break;
    default: fg=[0,0,0]; bg=[255,255,255];
  }
  for (let i = 0; i < gray.length; i++) {
    const t=gray[i]/255, idx=i*4;
    out[idx]  =Math.round(fg[0]+(bg[0]-fg[0])*t);
    out[idx+1]=Math.round(fg[1]+(bg[1]-fg[1])*t);
    out[idx+2]=Math.round(fg[2]+(bg[2]-fg[2])*t);
    out[idx+3]=255;
  }
  return out;
}

function getColor(colorMode, customHex) {
  switch(colorMode) {
    case 'black':  return '#000000';
    case 'white':  return '#ffffff';
    case 'red':    return '#c81e1e';
    case 'blue':   return '#1e50c8';
    case 'custom': return customHex || '#6C63FF';
    default:       return '#000000';
  }
}

function toGrayscale(pixels, w, h) {
  const gray = new Float32Array(w*h);
  for (let i = 0; i < w*h; i++)
    gray[i] = 0.299*pixels[i*4] + 0.587*pixels[i*4+1] + 0.114*pixels[i*4+2];
  return gray;
}

function hexToRgb(hex) {
  const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)] : null;
}
function clampInt(v,min,max){return v<min?min:v>max?max:v;}

// ═══════════════════════════════════════════════════════════
//  MODALITÀ AI — Gemini API
// ═══════════════════════════════════════════════════════════
async function generaStencilAI() {
  if (!state.apiKey)
    throw new Error('Inserisci la tua Gemini API Key nella sezione "Impostazioni AI".');

  if (processingStatus) processingStatus.textContent = 'Invio immagine a Gemini AI…';

  const tmpCanvas = document.createElement('canvas');
  const maxW = Math.min(state.img.naturalWidth, 1024);
  const scale = maxW / state.img.naturalWidth;
  tmpCanvas.width  = Math.round(state.img.naturalWidth  * scale);
  tmpCanvas.height = Math.round(state.img.naturalHeight * scale);
  tmpCanvas.getContext('2d').drawImage(state.img, 0, 0, tmpCanvas.width, tmpCanvas.height);
  const base64 = tmpCanvas.toDataURL('image/jpeg', 0.9).split(',')[1];

  const prompt = `Analizza questa immagine per la creazione di uno stencil professionale da tatuaggio. 
Rispondi SOLO con JSON: {"sensitivita": N, "dettaglio": N, "bilateral": bool, "thickness": N}
Dove:
- sensitivita: 5-80 (basso = più dettagli)
- dettaglio: 20-150 (soglia alta del Canny)
- bilateral: true se l'immagine ha molto rumore
- thickness: 1-5 (spessore linee consigliato)`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: base64 } }
        ]}],
        generationConfig: { temperature: 0.1, maxOutputTokens: 128 }
      })
    }
  );
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `Errore Gemini API ${response.status}`);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

  if (processingStatus) processingStatus.textContent = 'Applicazione parametri AI…';
  let params = {};
  try { const m=text.match(/\{[\s\S]*\}/); if(m) params=JSON.parse(m[0]); } catch(e){}

  if (params.sensitivita !== undefined) { state.sensitivita = clampInt(params.sensitivita,5,80); sensSlider.value=state.sensitivita; sensVal.textContent=state.sensitivita; }
  if (params.dettaglio   !== undefined) { state.dettaglio   = clampInt(params.dettaglio,20,150); dettaglioSlider.value=state.dettaglio; dettaglioVal.textContent=state.dettaglio; }
  if (params.bilateral   !== undefined) { state.bilateral   = params.bilateral; bilateralToggle.checked=state.bilateral; }
  if (params.thickness   !== undefined) { state.lineThickness= clampInt(Math.round(params.thickness),1,5); thickSlider.value=state.lineThickness; thickVal.textContent=state.lineThickness; }

  state.mode = 'tracciato';
  if (processingStatus) processingStatus.textContent = 'Generazione tracciato…';
  generaStencilCanvas();
}

// ═══════════════════════════════════════════════════════════
//  SLIDER CONFRONTO
// ═══════════════════════════════════════════════════════════
const compareDivider     = document.getElementById('compareDivider');
const compareCanvasLeft  = document.getElementById('compareCanvasLeft');
const compareCanvasRight = document.getElementById('compareCanvasRight');
let isDragging = false;

function disegnaConfronto() {
  if (!state.img || !state.stencilReady) return;
  const w = stencilCanvas.width, h = stencilCanvas.height;
  compareCanvasRight.width=w; compareCanvasRight.height=h;
  compareCanvasRight.getContext('2d').putImageData(stencilCanvas.getContext('2d').getImageData(0,0,w,h),0,0);
  compareCanvasLeft.width=w; compareCanvasLeft.height=h;
  compareCanvasLeft.getContext('2d').drawImage(state.img,0,0,w,h);
  impostaDivisore(50);
}
function impostaDivisore(pct) {
  compareDivider.style.left = pct+'%';
  compareCanvasLeft.style.clipPath = `inset(0 ${100-pct}% 0 0)`;
}
compareDivider.addEventListener('mousedown', e=>{isDragging=true;e.preventDefault();});
document.addEventListener('mousemove', e=>{
  if(!isDragging) return;
  const rect=compareView.getBoundingClientRect();
  impostaDivisore(Math.max(0,Math.min(100,((e.clientX-rect.left)/rect.width)*100)));
});
document.addEventListener('mouseup', ()=>{isDragging=false;});
compareDivider.addEventListener('touchstart',e=>{isDragging=true;e.preventDefault();},{passive:false});
document.addEventListener('touchmove',e=>{
  if(!isDragging) return;
  const rect=compareView.getBoundingClientRect();
  impostaDivisore(Math.max(0,Math.min(100,((e.touches[0].clientX-rect.left)/rect.width)*100)));
},{passive:true});
document.addEventListener('touchend',()=>{isDragging=false;});
