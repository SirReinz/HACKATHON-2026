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

# MASTER PROMPT
Act as a Senior React/TypeScript Architect. We are building the frontend for our "AXEL" Geospatial Dashboard. I have a Vite + React + TS project, Tailwind, and my `.env.local` configured with Mapbox, Supabase, and Clerk. 

Please reference the `robots.md` file for strict tech stack rules. We are NOT forcing strict dark mode. We want a clean, modern SaaS aesthetic using the native shadcn/ui theme system (Light/Dark mode support).

Based on our Figma designs, this uses a modern "Floating Overlay" architecture over a full-screen map. Please build the application with React Router using the following 4 primary views:

### 1. App Shell & Theme Setup
- Implement a `ThemeProvider` (e.g., using `next-themes` or standard shadcn setup) to support toggling between Light and Dark modes. Include a theme toggle button in the UI.

### 2. Landing Page View (`/`)
- **Background:** Full-screen disabled Mapbox map.
- **Foreground:** A centered floating glass-morphism `<Card>`.
- **Content:** Large welcome text ("Welcome [User First Name]"). Below it, a search/command input asking "Where are you headed?". 
- **Interaction:** Use a shadcn `<Command>` or `<Popover>` dropdown that lets users select regions (e.g., Australia). Selecting a region routes the user to `/map`.

### 3. Main Map Interface (`/map`)
- **Background:** Interactive Mapbox GL JS map. **CRITICAL:** Make the Mapbox `mapStyle` dynamic based on the active shadcn theme (use `mapbox://styles/mapbox/light-v11` for light mode, and `dark-v11` for dark mode).
- **Foreground (Floating UI):** Place floating shadcn `<Card>` components over the map:
  - *Top-Left Card:* "Filter of Area" containing category checkboxes (Dining, Health, Retail).
  - *Top-Right Card:* "AI Overview & Description". This is where the Gemini Edge Function briefing will stream in.
  - *Bottom-Right Card:* "Current Selection" showing raw telemetry (venue counts).
  - *Bottom-Left:* A simple "Back" button to return to `/`.

### 4. Deep Dive Analytics View (`/details`)
- A clean, scrollable page layout (no map) using standard shadcn background colors.
- **Layout:** Two main columns.
- **Left Column:** "Numbers" metrics (shadcn stat cards) and an "Export CSV" `<Button>` at the bottom.
- **Right Column:** A vertical stack of text sections: "Overview", "Key Insights:", "Considerations:", and "Tips and Tricks".

### Core Data Hook (`useSupabasePlaces`)
- Create a hook using `@supabase/supabase-js`.
- **CRITICAL:** Use `supabase.rpc('get_places_in_bbox', { min_lng, min_lat, max_lng, max_lat, category_filter })` to fetch data based on the map's current bounding box. Do NOT use standard `.eq()` filters for PostGIS.
- Map the returned data to a GeoJSON FeatureCollection.

### Mapbox Layer Styling
- Feed the GeoJSON into a Mapbox `<Source>`.
- **Clustered Layer:** Large circles with `point_count`. Use a primary brand color that works on both light and dark maps.
- **Unclustered Layer:** Dots colored by `level1_category_name`. Use highly legible solid colors (e.g., robust Blue, Emerald, Amber) rather than hard-to-read neons.
- **Interaction:** Clicking a cluster updates the "Current Selection" card and triggers `supabase.functions.invoke('smart-responder')`, displaying the result in the "AI Overview" card.

Please provide the routing setup in `App.tsx`, the `ThemeProvider`, and the code for these specific views using shadcn/ui components heavily.

# PIVOT MASTER PROMPT
Act as a Senior Full Stack Architect. We are pivoting our "AXEL" application into a B2B SaaS platform for business owners looking for optimal real estate locations. 

The new user flow is: 
1. Dashboard -> 2. Intake Form -> 3. Interactive 3D Results Carousel -> 4. "Save Inquiry" to database.

Please implement this pivot step-by-step:

### 1. Database Schema (Supabase)
Provide the SQL to create an `inquiries` table with the following columns:
- `id` (UUID, Primary Key)
- `user_id` (Text/UUID linking to the profiles table)
- `business_type` (Text)
- `target_audience` (Text)
- `spending_bracket` (Text - e.g., "$", "$$", "$$$")
- `results_data` (JSONB - to store the selected suburbs and telemetry)
- `created_at` (Timestamp)
Enable RLS so users can only view/insert their own inquiries.

### 2. Restructure Routing & Views
Update `App.tsx` (or your router) with these new routes, keeping the floating glass-morphism aesthetic:
- `/dashboard`: A "Saved Inquiries" grid displaying past searches, plus a primary "New Location Inquiry" button.
- `/inquiry/new`: A shadcn `<Form>` requesting `businessType`, `targetAudience`, and `spendingBracket` (Select: $, $$, $$$). Submitting this pushes the data to React state and routes to the carousel.
- `/inquiry/results`: The 3D Map Carousel View.
- `/explore`: Move our existing 2D search map here as a "Free Explore" mode.

### 3. The 3D Map Carousel View (`/inquiry/results`)
This is the cinematic core of the app. 
- **State:** Hardcode the demo results array to three suburbs: `['Redfern', 'Darlington', 'Barangaroo']`. Track the `activeIndex` (0, 1, or 2).
- **The Mapbox Engine:** - When the `activeIndex` changes, use `map.flyTo()` to pan smoothly to the new suburb.
  - **CRITICAL 3D SETUP:** Add `pitch: 60` and `bearing: -20` to the map configuration to tilt the camera.
  - Add the Mapbox `3d-buildings` layer (extrude buildings based on height) so the city looks 3-dimensional.
  - Execute the Nominatim boundary fetch and draw the glowing polygon for the active suburb, just like we did in Explore mode.

### 4. Floating UI & AI Summaries
- **Left/Right Navigation:** Add floating glass-morphism `<Button>` components on the left and right edges of the screen to cycle the `activeIndex`.
- **Right Panel (The Intelligence Briefing):** A tall floating `<Card>` on the right side.
  - Top section: Display the active suburb name and raw venue counts (querying `get_places_in_polygon`).
  - Middle section: The AI Summary. Trigger the `smart-responder` Edge Function. **CRITICAL:** Pass the user's `businessType`, `targetAudience`, `spendingBracket`, AND the active `suburb_name` to the function so the AI tailors the advice specifically to their business plan in that location.
- **Top Bar:** A floating header with a prominent "Save Inquiry" button. Clicking this executes a Supabase `INSERT` into the `inquiries` table with the form state and the 3 results, then redirects to `/dashboard`.

Please provide the SQL migration and the code for the new components (`InquiryForm.tsx`, `ResultsCarousel.tsx`).