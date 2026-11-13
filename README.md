# InstaStencil Clone

> A free, browser-based image-to-stencil converter — no server, no signup, 100% private.

🌐 **Live Demo**: [instastencil-clone.netlify.app](https://instastencil-clone.netlify.app)

## ✨ Features

- **3 conversion modes**: Threshold, Edge Detect, Sketch
- **Fine-tune controls**: threshold, contrast, blur, edge strength, multi-tone layers
- **Color options**: Black, White-on-Black, Red, Blue, or any custom color
- **Before/After compare slider** — drag to compare original vs stencil
- **High-res PNG export** at original image resolution
- **100% client-side** — your images never leave your device
- **Clipboard paste support** — paste directly from clipboard
- Responsive design — works on mobile, tablet, desktop
- Supports JPG, PNG, WEBP, GIF (up to 20MB)

## 🚀 How It Works

1. **Upload** — Drop, paste, or browse any image
2. **Adjust** — Tune threshold, contrast, blur and mode in the sidebar
3. **Generate** — Click "Generate Stencil" for instant processing
4. **Download** — Save your stencil as a PNG

## 🛠 Tech Stack

| Technology | Use |
|------------|-----|
| Vanilla HTML/CSS/JS | UI + logic |
| Canvas API | Image processing (Sobel edge detection, Gaussian blur, threshold) |
| Google Fonts (Inter) | Typography |
| Netlify | Hosting |

## 📦 Project Structure

```
instastencil-clone/
├── index.html      # App shell + landing page
├── style.css       # Complete UI styles
├── app.js          # Image processing engine + UI logic
├── netlify.toml    # Netlify deploy config
└── README.md
```

## 🧠 Algorithm Details

### Threshold Mode
Pure black-and-white conversion: pixels below the threshold value become the foreground color, pixels above become background. Multi-tone layers divide the grayscale range into N bands.

### Edge Detect Mode
Uses the **Sobel operator** to compute image gradients (Gx, Gy) and derives edge magnitude. Stronger edges produce darker lines on a white background.

### Sketch Mode
Combines threshold + edge detection: pixels must pass both tests to remain in the foreground, producing a pencil-sketch look with clean outlines.

### Gaussian Blur
Implemented as a 3-pass box blur approximation over a user-controllable radius, applied before the stencil conversion for noise reduction.

## 🖨 Use Cases

- **Tattoo stencils** — transfer photos to skin-safe stencil paper
- **Woodworking** — templates for burning, carving, routing
- **Spray paint / murals** — multi-layer stencil art
- **Screen printing** — textile and fabric designs
- **Home decor** — wall stencils, furniture painting
- **Education** — outlines and tracing aids

## 📄 License

MIT © 2026 InstaStencil Clone
