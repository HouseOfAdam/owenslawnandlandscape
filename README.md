# Owen's Lawn + Landscape — Web Platform

Full-stack business platform for Owen's Lawn + Landscape, built as a single-page React app.

## Features

- **Public landing page** — Services, testimonials, estimate request, annual plans
- **Customer portal** — Magic-link login, schedule, invoices, payments
- **Admin portal** — CRM, scheduling, financials, AI estimator, gallery management

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and add your Anthropic API key (powers the AI Estimator in admin portal):

```
VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get a key at [console.anthropic.com](https://console.anthropic.com/).

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Demo Access

- **Admin portal:** Click "Admin" in the nav → password: `owen2025`
- **Customer portal:** Click "Customer Login" → use any magic link token below

| Customer | Token |
|---|---|
| Ron Cooper (demo) | `rc7f2a9b` |
| Kyle Lemon | `kl4e8d3c` |
| Deborah Whittemore | `dw9b1f6a` |
| Jason Hage | `jh6a3f1e` |
| Cory Rehs | `cr8d4b9f` |

---

## Deploy to Vercel

### Option A — Vercel CLI (fastest)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (follow prompts)
vercel

# Set environment variable
vercel env add VITE_ANTHROPIC_API_KEY
```

### Option B — GitHub + Vercel Dashboard

1. **Push to GitHub:**

```bash
git init
git add .
git commit -m "Initial commit — Owen's Lawn platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/owens-lawn.git
git push -u origin main
```

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com) → "Add New Project"
   - Import your GitHub repo
   - Framework preset: **Vite**
   - Click **Deploy**

3. **Add environment variable in Vercel:**
   - Project Settings → Environment Variables
   - Name: `VITE_ANTHROPIC_API_KEY`
   - Value: your key from [console.anthropic.com](https://console.anthropic.com/)
   - Environment: Production (+ Preview if desired)
   - Redeploy after adding

---

## Project Structure

```
owens-lawn/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx          ← Entire platform (single component)
│   ├── main.jsx         ← React entry point
│   └── index.css        ← Tailwind base styles
├── .env.example         ← Copy to .env.local
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
└── vercel.json          ← SPA routing config
```

---

## Build for Production

```bash
npm run build
```

Output goes to `dist/`. Preview locally with:

```bash
npm run preview
```

---

## Notes

- The AI Estimator (admin portal) makes direct calls to the Anthropic API from the browser. For a production app with real customers, consider proxying through a serverless function to keep the key server-side.
- Magic link tokens are hardcoded for demo/MVP. A production version would generate and email real links.
- All financial data is in-memory — no database. Real deployments should connect to Supabase, PlanetScale, or similar.
