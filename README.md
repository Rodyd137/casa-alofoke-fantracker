# Casa Alofoke • Fan Tracker (no oficial) — Cloudflare Pages

Stack: **Vite + React + Tailwind**

## Despliegue en Cloudflare Pages (con GitHub)

1. Crea un repo y sube este código:
   ```bash
   git init
   git add .
   git commit -m "feat: alofoke fan tracker mvp"
   git branch -M main
   git remote add origin <URL-de-tu-repo>
   git push -u origin main
   ```
2. En **Cloudflare Dashboard** → **Pages** → **Create a project** → **Connect to Git** → selecciona el repo.
3. Configuración de build:
   - Framework: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
   - (Opcional) Environment variable: `NODE_VERSION=20`
4. Deploy.

## Conectar dominio propio
- Ve a **Pages → tu proyecto → Custom domains → Set up a domain**.
- Si tu dominio ya usa Cloudflare para DNS: 1 click y listo.
- Si NO: transfiere los nameservers a Cloudflare (plan gratuito), luego repite el paso.

## Ajustes rápidos
- Edita `src/App.jsx` → bloque `CONFIG`.
- Cambia `public/logo.png` si quieres otro logo.

## Local dev
```bash
npm install
npm run dev
```

## Build local y subir sin Git (Upload assets)
```bash
npm run build
# sube la carpeta dist/ desde Pages → Create project → Upload assets
```

> Este sitio es **NO OFICIAL** y no representa a Alofoke.
