/* ============================================================
   InstaStencil – app.js v3.1 (Motore Tracciato Tattoo ad Alte Prestazioni)
   ============================================================ */
'use strict';

// ─── Stato Applicazione ─────────────────────────────────────
const state = {
  imageData: null,
  img: null,
  mode: 'tracciato',
  sensitivita: 35,
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
  tracciato: 'Tracciato tattoo professionale (Difference of Gaussians). Estrae tutti gli outline puliti e definiti.',
  canny:     'Rilevamento bordi Canny ad alto contrasto. Ottimo per sagome e forme geometriche marcate.',
  soglia:    'Conversione classica a soglia di luminosità e multi-livello per posterizzazione.',
  ai:        'Gemini AI analizza l\'immagine e calcola automaticamente i parametri ideali per il tatuaggio.',
};

// ─── Elementi DOM ───────────────────────────────────────────
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

// Controlli Slider & Input
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

// Gruppi di impostazione per modalità
const tracciatoGroup = document.getElementById('tracciatoGroup');
const cannyGroup     = document.getElementById('cannyGroup');
const sogliaGroup    = document.getElementById('sogliaGroup');
const aiGroup        = document.getElementById('aiGroup');

// ─── Caricamento Immagine ───────────────────────────────────
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) caricaImmagine(f);
});

fileInput.addEventListener('change', e => {
  if (e.target.files[0]) caricaImmagine(e.target.files[0]);
});

document.addEventListener('paste', e => {
  for (const item of (e.clipboardData || window.clipboardData).items) {
    if (item.type.startsWith('image/')) {
      caricaImmagine(item.getAsFile());
      break;
    }
  }
});

newImageBtn.addEventListener('click', () => {
  toolPanels.style.display = 'none';
  uploadZone.style.display = 'flex';
  fileInput.value = '';
  state.stencilReady = false;
  downloadBtn.disabled = true;
});

function caricaImmagine(file) {
  if (file.size > 25 * 1024 * 1024) {
    alert('File troppo grande. Dimensione massima 25MB.');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      state.img = img;
      uploadZone.style.display = 'none';
      toolPanels.style.display = 'grid';

      // 1. Disegna originale
      disegnaOriginale(img);
      canvasInfo.textContent = `${img.naturalWidth} × ${img.naturalHeight} px · ${(file.size / 1024).toFixed(0)} KB`;

      // 2. Genera SUBITO lo stencil ed entra nella visualizzazione Stencil
      mostraTab('stencil');
      richiediElaborazione(true);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function disegnaOriginale(img) {
  const maxW = Math.min(img.naturalWidth, 1000);
  const scale = maxW / img.naturalWidth;
  originalCanvas.width  = Math.round(img.naturalWidth  * scale);
  originalCanvas.height = Math.round(img.naturalHeight * scale);
  const ctx = originalCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0, originalCanvas.width, originalCanvas.height);
  state.imageData = ctx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
}

// ─── Gestione Tab ───────────────────────────────────────────
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

  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  if (tab === 'confronto' && state.stencilReady) {
    disegnaConfronto();
  }
}

// ─── Cambio Modalità ────────────────────────────────────────
document.querySelectorAll('.seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;

    tracciatoGroup.style.display = state.mode === 'tracciato' ? '' : 'none';
    cannyGroup.style.display     = state.mode === 'canny'     ? '' : 'none';
    sogliaGroup.style.display    = state.mode === 'soglia'    ? '' : 'none';
    aiGroup.style.display        = state.mode === 'ai'        ? '' : 'none';

    if (modeDescText) {
      modeDescText.textContent = modeDescriptions[state.mode] || '';
    }

    if (state.imageData) {
      richiediElaborazione();
    }
  });
});

// ─── Slider in Tempo Reale con Debounce ─────────────────────
let timerDebounce = null;
function richiediElaborazione(immediata = false) {
  if (timerDebounce) clearTimeout(timerDebounce);
  if (immediata) {
    eseguiElaborazione();
  } else {
    timerDebounce = setTimeout(eseguiElaborazione, 35);
  }
}

function bindSlider(el, valEl, key) {
  if (!el) return;
  el.addEventListener('input', () => {
    state[key] = parseFloat(el.value);
    if (valEl) valEl.textContent = el.value;
    richiediElaborazione();
  });
}

bindSlider(sensSlider,      sensVal,       'sensitivita');
bindSlider(dettaglioSlider, dettaglioVal,  'dettaglio');
bindSlider(cannyLowSlider,  cannyLowVal,   'cannyLow');
bindSlider(cannyHighSlider, cannyHighVal,  'cannyHigh');
bindSlider(blurSlider,      blurVal,       'blur');
bindSlider(threshSlider,    threshVal,     'threshold');
bindSlider(thickSlider,     thickVal,      'lineThickness');
bindSlider(layersSlider,    layersVal,     'layers');

invertToggle.addEventListener('change', () => {
  state.invert = invertToggle.checked;
  richiediElaborazione();
});

bilateralToggle.addEventListener('change', () => {
  state.bilateral = bilateralToggle.checked;
  richiediElaborazione();
});

customColorInput.addEventListener('input', () => {
  state.customColor = customColorInput.value;
  if (state.outputColor === 'custom') richiediElaborazione();
});

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
    if (r.value === 'custom') {
      customColorInput.click();
    }
    richiediElaborazione();
  });
});

resetBtn.addEventListener('click', () => {
  sensSlider.value      = 35;  sensVal.textContent      = '35';
  dettaglioSlider.value = 60;  dettaglioVal.textContent = '60';
  cannyLowSlider.value  = 20;  cannyLowVal.textContent  = '20';
  cannyHighSlider.value = 60;  cannyHighVal.textContent = '60';
  blurSlider.value      = 1.5; blurVal.textContent      = '1.5';
  threshSlider.value    = 128; threshVal.textContent    = '128';
  thickSlider.value     = 2;   thickVal.textContent     = '2';
  layersSlider.value    = 1;   layersVal.textContent    = '1';
  invertToggle.checked  = false;
  bilateralToggle.checked = true;

  Object.assign(state, {
    sensitivita: 35,
    dettaglio: 60,
    cannyLow: 20,
    cannyHigh: 60,
    blur: 1.5,
    threshold: 128,
    lineThickness: 2,
    layers: 1,
    invert: false,
    bilateral: true,
    outputColor: 'red',
    mode: 'tracciato',
  });

  document.querySelector('[data-mode="tracciato"]').click();
  document.querySelector('input[name="outputColor"][value="red"]').checked = true;
  richiediElaborazione(true);
});

// ─── Bottone Genera Stencil ─────────────────────────────────
processBtn.addEventListener('click', () => {
  if (!state.imageData) {
    alert('Carica prima un\'immagine.');
    return;
  }
  mostraTab('stencil');
  eseguiElaborazione();
});

// ─── Scarica PNG ────────────────────────────────────────────
downloadBtn.addEventListener('click', () => {
  if (!state.stencilReady) return;
  const link = document.createElement('a');
  link.download = 'stencil-tatuaggio.png';
  link.href = stencilCanvas.toDataURL('image/png');
  link.click();
});

// ═════════════════════════════════════════════════════════════
//  ESECUZIONE ELABORAZIONE STENCIL
// ═════════════════════════════════════════════════════════════
async function eseguiElaborazione() {
  if (!state.imageData) return;

  if (state.mode === 'ai') {
    processingOverlay.style.display = 'flex';
    if (processingStatus) processingStatus.textContent = 'Analisi Gemini AI in corso…';
    try {
      await generaStencilAI();
    } catch (err) {
      alert('Errore AI: ' + err.message);
    } finally {
      processingOverlay.style.display = 'none';
    }
    return;
  }

  // Elaborazione client-side immediata
  try {
    stencilPlaceholder.style.display = 'none';
    calcolaDisegnaStencil();
    state.stencilReady = true;
    downloadBtn.disabled = false;
  } catch (err) {
    console.error('Errore elaborazione canvas:', err);
  }
}

function calcolaDisegnaStencil() {
  const src = state.imageData;
  const w = src.width;
  const h = src.height;

  stencilCanvas.width  = w;
  stencilCanvas.height = h;

  // 1. Scala di grigi
  let gray = toGrayscale(src.data, w, h);

  let edgeBinary; // 0 = linea bordo, 255 = foglio

  if (state.mode === 'tracciato') {
    // Motore Tracciato DoG (Difference of Gaussians) per tattoo outlines
    edgeBinary = generaTracciatoDoG(gray, w, h);
  } else if (state.mode === 'canny') {
    // Motore Canny
    edgeBinary = generaBordiCanny(gray, w, h);
  } else {
    // Motore Soglia & Multi-tono
    edgeBinary = generaSoglia(gray, w, h);
  }

  // 2. Ispessimento linee (dilatazione morfologica)
  if (state.lineThickness > 1) {
    edgeBinary = dilataLinee(edgeBinary, w, h, state.lineThickness);
  }

  // 3. Colorazione su canvas
  const finalRgba = colorizzaStencil(edgeBinary, w, h);
  const imgData = new ImageData(finalRgba, w, h);
  stencilCanvas.getContext('2d').putImageData(imgData, 0, 0);
}

// ═════════════════════════════════════════════════════════════
//  ALGORITMO 1: TRACCIATO OUTLINE TATTOO (DoG)
//  Estrae i contorni precisi di volti, tatuaggi, linee e ombre
// ═════════════════════════════════════════════════════════════
function generaTracciatoDoG(srcGray, w, h) {
  // Raggio blur iniziale
  const r1 = Math.max(1, Math.round(state.blur));
  // Raggio blur strutturale
  const r2 = Math.max(r1 + 1, Math.round(state.blur * 2.8 + 2));

  const blur1 = boxBlur(srcGray, w, h, r1);
  const blur2 = boxBlur(srcGray, w, h, r2);

  // Mappa la sensibilità dello slider (5..80):
  // Valori più alti = cattura più linee e dettagli fini
  const sogliaDoG = -0.3 - ((85 - state.sensitivita) * 0.05);

  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const diff = blur1[i] - blur2[i];
    out[i] = diff < sogliaDoG ? 0 : 255;
  }
  return out;
}

// ═════════════════════════════════════════════════════════════
//  ALGORITMO 2: BORDI CANNY AD ALTO CONTRASTO
// ═════════════════════════════════════════════════════════════
function generaBordiCanny(srcGray, w, h) {
  const smoothed = boxBlur(srcGray, w, h, Math.max(1, Math.round(state.blur)));
  const out = new Uint8Array(w * h).fill(255);

  const low  = state.cannyLow * 3.5;
  const high = state.cannyHigh * 4.5;

  for (let y = 1; y < h - 1; y++) {
    const yw = y * w;
    for (let x = 1; x < w - 1; x++) {
      const idx = yw + x;
      const gx = -smoothed[idx - w - 1] - 2 * smoothed[idx - 1] - smoothed[idx + w - 1]
                 +smoothed[idx - w + 1] + 2 * smoothed[idx + 1] + smoothed[idx + w + 1];
      const gy = -smoothed[idx - w - 1] - 2 * smoothed[idx - w] - smoothed[idx - w + 1]
                 +smoothed[idx + w - 1] + 2 * smoothed[idx + w] + smoothed[idx + w + 1];
      const mag = Math.abs(gx) + Math.abs(gy);

      if (mag > high || (mag > low && (smoothed[idx] < 128))) {
        out[idx] = 0;
      }
    }
  }
  return out;
}

// ═════════════════════════════════════════════════════════════
//  ALGORITMO 3: SOGLIA CLASSICA E MULTI-LIVELLO
// ═════════════════════════════════════════════════════════════
function generaSoglia(srcGray, w, h) {
  const out = new Uint8Array(w * h);
  const thr = state.threshold;

  if (state.layers === 1) {
    for (let i = 0; i < w * h; i++) {
      out[i] = srcGray[i] < thr ? 0 : 255;
    }
  } else {
    const step = 255 / state.layers;
    for (let i = 0; i < w * h; i++) {
      const level = Math.floor(srcGray[i] / step);
      out[i] = level === 0 ? 0 : 255;
    }
  }
  return out;
}

// ═════════════════════════════════════════════════════════════
//  ISPESSIMENTO LINEE (Dilatazione Morfologica)
// ═════════════════════════════════════════════════════════════
function dilataLinee(edges, w, h, thickness) {
  if (thickness <= 1) return edges;
  const r = Math.min(5, Math.round(thickness - 1));
  const r2 = r * r;
  const out = new Uint8Array(edges);

  for (let y = r; y < h - r; y++) {
    const yw = y * w;
    for (let x = r; x < w - r; x++) {
      if (edges[yw + x] === 0) {
        for (let dy = -r; dy <= r; dy++) {
          const nyw = (y + dy) * w;
          for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy <= r2) {
              out[nyw + (x + dx)] = 0;
            }
          }
        }
      }
    }
  }
  return out;
}

// ═════════════════════════════════════════════════════════════
//  COLORAZIONE
// ═════════════════════════════════════════════════════════════
function colorizzaStencil(edgeBinary, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);

  let fg = [200, 30, 30];   // Rosso tatuaggio predefinito
  let bg = [255, 255, 255]; // Sfondo bianco

  switch (state.outputColor) {
    case 'black':
      fg = [0, 0, 0];
      bg = [255, 255, 255];
      break;
    case 'white':
      fg = [255, 255, 255];
      bg = [0, 0, 0];
      break;
    case 'red':
      fg = [200, 30, 30];
      bg = [255, 255, 255];
      break;
    case 'blue':
      fg = [30, 80, 200];
      bg = [255, 255, 255];
      break;
    case 'custom':
      fg = hexToRgb(state.customColor) || [108, 99, 255];
      bg = [255, 255, 255];
      break;
  }

  if (state.invert) {
    const tmp = fg;
    fg = bg;
    bg = tmp;
  }

  for (let i = 0; i < w * h; i++) {
    const isLine = edgeBinary[i] === 0;
    const col = isLine ? fg : bg;
    const idx = i * 4;
    out[idx]     = col[0];
    out[idx + 1] = col[1];
    out[idx + 2] = col[2];
    out[idx + 3] = 255;
  }
  return out;
}

// ═════════════════════════════════════════════════════════════
//  FUNZIONI UTILITY MATRICIALI VELOCI
// ═════════════════════════════════════════════════════════════
function toGrayscale(pixels, w, h) {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
  }
  return gray;
}

// Box blur a separazione orizzontale/verticale ad alte prestazioni O(N)
function boxBlur(src, w, h, radius) {
  const r = Math.round(radius);
  if (r <= 0) return src.slice();

  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const yw = y * w;
    let sum = 0;
    let count = 0;
    for (let x = -r; x <= r; x++) {
      sum += src[yw + Math.max(0, Math.min(w - 1, x))];
      count++;
    }
    for (let x = 0; x < w; x++) {
      tmp[yw + x] = sum / count;
      const addX = Math.min(w - 1, x + r + 1);
      const remX = Math.max(0, x - r);
      sum += src[yw + addX] - src[yw + remX];
    }
  }

  const out = new Float32Array(w * h);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    let count = 0;
    for (let y = -r; y <= r; y++) {
      sum += tmp[Math.max(0, Math.min(h - 1, y)) * w + x];
      count++;
    }
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / count;
      const addY = Math.min(h - 1, y + r + 1);
      const remY = Math.max(0, y - r);
      sum += tmp[addY * w + x] - tmp[remY * w + x];
    }
  }
  return out;
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

// ═════════════════════════════════════════════════════════════
//  MODALITÀ AI: GOOGLE GEMINI
// ═════════════════════════════════════════════════════════════
async function generaStencilAI() {
  if (!state.apiKey) {
    throw new Error('Inserisci la tua Gemini API Key nella sezione "Impostazioni AI".');
  }

  const tmpCanvas = document.createElement('canvas');
  const maxW = Math.min(state.img.naturalWidth, 1024);
  const scale = maxW / state.img.naturalWidth;
  tmpCanvas.width  = Math.round(state.img.naturalWidth  * scale);
  tmpCanvas.height = Math.round(state.img.naturalHeight * scale);
  tmpCanvas.getContext('2d').drawImage(state.img, 0, 0, tmpCanvas.width, tmpCanvas.height);
  const base64 = tmpCanvas.toDataURL('image/jpeg', 0.85).split(',')[1];

  const prompt = `Analizza questa immagine per estrarre uno stencil per tatuaggio.
Rispondi ESCLUSIVAMENTE con JSON: {"sensitivita": N, "thickness": N, "blur": N}
- sensitivita: numero intero da 20 a 70
- thickness: numero intero da 1 a 4
- blur: numero decimale da 1.0 a 2.5`;

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
        generationConfig: { temperature: 0.1, maxOutputTokens: 128 }
      })
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `Errore API Gemini (${response.status})`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      const p = JSON.parse(m[0]);
      if (p.sensitivita) {
        state.sensitivita = Math.max(10, Math.min(75, p.sensitivita));
        sensSlider.value = state.sensitivita;
        sensVal.textContent = state.sensitivita;
      }
      if (p.thickness) {
        state.lineThickness = Math.max(1, Math.min(5, Math.round(p.thickness)));
        thickSlider.value = state.lineThickness;
        thickVal.textContent = state.lineThickness;
      }
      if (p.blur) {
        state.blur = Math.max(0.5, Math.min(3, p.blur));
        blurSlider.value = state.blur;
        blurVal.textContent = state.blur;
      }
    }
  } catch (e) {
    console.warn('Parsing risposta AI:', e);
  }

  state.mode = 'tracciato';
  document.querySelector('[data-mode="tracciato"]').click();
  eseguiElaborazione();
}

// ═════════════════════════════════════════════════════════════
//  CONFRONTO INTERATTIVO (SPLIT SLIDER)
// ═════════════════════════════════════════════════════════════
const compareDivider     = document.getElementById('compareDivider');
const compareCanvasLeft  = document.getElementById('compareCanvasLeft');
const compareCanvasRight = document.getElementById('compareCanvasRight');
let isDragging = false;

function disegnaConfronto() {
  if (!state.img || !state.stencilReady) return;
  const w = stencilCanvas.width;
  const h = stencilCanvas.height;

  compareCanvasRight.width  = w;
  compareCanvasRight.height = h;
  compareCanvasRight.getContext('2d').putImageData(
    stencilCanvas.getContext('2d').getImageData(0, 0, w, h), 0, 0
  );

  compareCanvasLeft.width  = w;
  compareCanvasLeft.height = h;
  compareCanvasLeft.getContext('2d').drawImage(state.img, 0, 0, w, h);
  impostaDivisore(50);
}

function impostaDivisore(pct) {
  compareDivider.style.left = pct + '%';
  compareCanvasLeft.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
}

compareDivider.addEventListener('mousedown', e => { isDragging = true; e.preventDefault(); });
document.addEventListener('mousemove', e => {
  if (!isDragging) return;
  const rect = compareView.getBoundingClientRect();
  const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  impostaDivisore(pct);
});
document.addEventListener('mouseup', () => { isDragging = false; });

compareDivider.addEventListener('touchstart', e => { isDragging = true; e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', e => {
  if (!isDragging) return;
  const rect = compareView.getBoundingClientRect();
  const pct = Math.max(0, Math.min(100, ((e.touches[0].clientX - rect.left) / rect.width) * 100));
  impostaDivisore(pct);
}, { passive: true });
document.addEventListener('touchend', () => { isDragging = false; });
