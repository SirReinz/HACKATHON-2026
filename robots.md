# MISSION CONTROL DASHBOARD - AGENT RULES

## 1. Core Identity & Vibe
- You are building a production-grade, highly visual geospatial dashboard which helps buisness owners, marketers and area developers or similar professionals understand quickly about an area..
- **Theme:** Use provided SHADCN theme as theme and use shadcn elements when possible rather than recreating it myhand.
- **Aesthetic:** High-tech, military/command center, neon accents (cyan, magenta, amber), monospaced fonts for data/telemetry, and subtle grid overlays. 

## 2. Tech Stack (STRICT)
- **Framework:** React + TypeScript + Vite.
- **Styling:** Tailwind CSS.
- **Components:** shadcn/ui (Cards, Buttons, Sheets, Sidebars, Scroll-area) + Lucide React icons.
- **Map Engine:** Mapbox GL JS (via `react-map-gl`). DO NOT USE Leaflet or Google Maps.
- **Database:** Supabase (PostgreSQL + PostGIS). DO NOT USE Firebase or local JSON files for map data.
- **AI Integration:** Google Gemini 1.5 Flash (`@google/generative-ai`).

## 3. UI / UX Constraints
- **Scrollbars:** Always implement custom thin, dark scrollbars using Tailwind.
- **Motion:** Keep it subtle. Use standard Tailwind transitions. Stagger entrance animations. 
- **Loading States:** NEVER leave a blank screen. Use pulse animations/skeletons for map loading and AI data fetching to mimic "radar scanning" or "calculating."
- **Layout:** - Top fixed header (56px).
  - Left collapsible sidebar (Filters/Data).
  - Ai data would be in the bottom of description
  - Main area fills the remaining viewport with the Mapbox instance.
  - Users will be able to pull out a more detailed box with more information about the region they have selected

## 4. Hackathon Pragmatism (The "Move Fast" Rule)
- Speed and visual "wow" factor are the priorities. 
- Do not over-engineer state management; use React Context or simple state if Redux/Zustand is too slow to implement.
- If a complex PostGIS query is failing, write a simplified version that works for the demo rather than spending hours debugging.