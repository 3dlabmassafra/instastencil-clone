# InstaStencil Clone 🇮🇹

> Convertitore gratuito nel browser da foto a stencil per tatuaggi ed outline — senza server, senza registrazione, 100% privato.

🌐 **Demo Live**: [instastencil-clone.netlify.app](https://instastencil-clone.netlify.app)

---

## ✨ Funzionalità

- **Modalità Tracciato (Outline)**: Estrazione e tracciamento continuo dei contorni con curve Bezier levigate per stencil da tatuaggio e thermal printer.
- **Rilevamento Bordi Canny**: Algoritmo completo (Filtro Gaussiano → Calcolo del Gradiente Sobel → Non-Maximum Suppression → Isteresi a doppia soglia).
- **Filtro Bilaterale**: Riduzione del rumore che preserva i contorni nitidi eliminando la grana fotografica.
- **Ispessimento Linee**: Dilatazione morfologica per linee piene e definite, pronte per la stampa termica o stencil cut.
- **Ottimizzazione AI**: Integrazione opzionale con Google Gemini API per la stima automatica dei migliori parametri in base all'immagine.
- **Colori per Tatuatori**: Modalità Rosso Tatuaggio, Nero, Bianco su Nero (per carte termiche e transfer), Blu e Colore personalizzato.
- **Slider di Confronto Interattivo**: Scorri per confrontare l'immagine originale e lo stencil elaborato fianco a fianco.
- **Esportazione PNG ad Alta Risoluzione**: Download immediato senza filigrane.
- **Completamente Locale e Privato**: Le immagini non lasciano il tuo computer (tranne se scegli la modalità AI opzionale).
- **Supporto Copia e Incolla**: Puoi incollare direttamente uno screenshot o un'immagine dalla clipboard con `Ctrl+V`.

---

## 🎨 Consigli per Stencil da Tatuaggio

1. **Usa la modalità Tracciato** (impostata come predefinita).
2. Regola la **Sensibilità contorni** (15–30 per catturare dettagli fini).
3. Mantieni attivo il **Filtro bilaterale** per ripulire sfondi complessi o sfumature.
4. Imposta lo **Spessore linea** a 2 o 3 per stencil ben leggibili sulla pelle e sulle stampanti termiche.
5. Seleziona **Rosso Tatuaggio** per ottenere lo stile visivo classico di InstaStencil.

---

## 🛠 Stack Tecnologico

- **Frontend**: HTML5, CSS3 moderno con variabili e layout responsivo, Vanilla JavaScript
- **Canvas API**: Elaborazione matriciale dei pixel, chain code contour tracing e interpolazione Catmull-Rom/Bezier
- **Hosting**: Netlify
- **Repository**: GitHub
