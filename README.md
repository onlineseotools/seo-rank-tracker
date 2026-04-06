# SEO Tool New

Modern Vercel-ready rebuild of the original Streamlit-based `seo-rank-tracker`.

## What it includes

- Next.js 16 App Router application
- redesigned product shell with a persistent side workspace
- dedicated workspaces for:
  - Dashboard
  - Projects
  - Keywords
  - Search Console
  - Rank Checker
  - Cannibalization
  - Settings
  - Users
- typed sample data shaped around the existing tool's structure and workflows

## Run locally

```bash
npm install
npm run dev
```

Then open:

```bash
http://localhost:3000
```

## Build for production

```bash
npm run build
npm run start
```

## Deploy to Vercel

Set the Vercel project root to:

```bash
SEO Tool New
```

This rebuild currently focuses on the product shell, page architecture, and upgraded UI. The next step would be wiring these pages to a real database and Google / SERP provider integrations.
