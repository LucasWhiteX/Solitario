# Solitario
Para Morzao

Jogo de Paciência (Klondike) em HTML/CSS/JS puro, instalável como app no telemóvel (PWA).

## Como instalar no Android
1. Publica esta pasta num servidor HTTPS (o mais simples é ativar o **GitHub Pages** neste repositório: Settings → Pages → Deploy from branch `main`).
2. No telemóvel, abre o link no Chrome.
3. Toca no menu (⋮) → **"Instalar aplicação"** (ou aceita o banner que aparece automaticamente).
4. Fica com ícone próprio no ecrã principal e funciona offline.

## Correr localmente
Como usa `fetch`/service worker, não abras `index.html` diretamente com `file://` — serve a pasta, por exemplo:
```
npx serve .
```

