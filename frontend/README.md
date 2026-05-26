# Syntra OS: Frontend Portal UI

This directory contains the single-page application (SPA) client interface for **Syntra OS**, built using React, TypeScript, Vite, and styled with Tailwind CSS v4.

---

## 🎨 Design System & Aesthetics

The client interface is designed around a premium, glassmorphic dark-mode configuration, leveraging outfit font-faces, vibrant neon colors, and micro-interaction animations.

*   **Tailwind Theme Config**: Standardized colors like `--color-darkBg` (#0d0e12), `--color-darkPanel` (#161821), `--color-neonTeal` (#0df), and `--color-neonIndigo` (#6366f1) are defined in [index.css](./src/index.css).
*   **Aesthetic Animation classes**: Includes custom `.animate-fadeIn` and `.animate-slideLeft` keyframes for seamless page transitions.

---

## 🏗️ Components Directory

*   **`App.tsx`**: Orchestrator containing sidebar indicators, system latency metric counters, and workspace navigation selectors.
*   **`components/FileUpload.tsx`**: Drag-and-drop file uploader enforcing type limits (strictly PDFs) and file size gates (< 20MB).
*   **`components/DocumentList.tsx`**: Renders database catalogs with statuses (Indexed, Extracted).
*   **`components/DocumentViewer.tsx`**: Drawer showing raw text previews and structured JSON payloads.
*   **`modules/invoice-automation/Dashboard.tsx`**: Fintech operations panel displaying transaction KPI averages, paginated tables, and live Operational Risk alerting grids.

---

## 🚀 Dev Run Commands

Ensure the FastAPI backend is running first, then start the client:
```bash
npm install
npm run dev
```
The React development server runs by default on [http://localhost:5173](http://localhost:5173).
