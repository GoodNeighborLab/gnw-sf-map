# Walkthrough - 2026 SF Good Neighbor Week Map

This document outlines the completed implementation of the **2026 SF Good Neighbor Week Map** dashboard, which provides a hardware-accelerated, multi-layered interactive map of San Francisco utilizing **MapLibre GL JS** and local CSV datasets.

---

## 🚀 Key Accomplishments

### 1. Database & CSV Datasets (`data/`)
We have successfully established a structured file-based database containing 8 distinct layers of San Francisco's community resources.
*   **[sf_neighborhoods.geojson](file:///Users/max/gitroot/mapthing/data/sf_neighborhoods.geojson)**: Loaded 37 neighborhood vector polygons mapped with precise geographical coordinates.
*   **[neighborhood_data.csv](file:///Users/max/gitroot/mapthing/data/neighborhood_data.csv)**: Created statistics (Population, Area, Civic Engagement Score, Car Ownership %) for all 37 neighborhoods.
*   **[neighborhood_groups.csv](file:///Users/max/gitroot/mapthing/data/neighborhood_groups.csv)**: Documented dozens of community organizations, merchant associations, and neighborhood groups mapped by neighborhood name.
*   **[libraries.csv](file:///Users/max/gitroot/mapthing/data/libraries.csv)**: Cataloged all 28 SF Public Library branches with coordinate pins and website routes.
*   **[civic_orgs.csv](file:///Users/max/gitroot/mapthing/data/civic_orgs.csv)**: Registered core volunteer organizations (like Refuse Refuse, Friends of the Urban Forest, SF Parks Alliance, etc.).
*   **[newsrooms.csv](file:///Users/max/gitroot/mapthing/data/newsrooms.csv)**: Categorized local media outlets (Mission Local, El Tecolote, Potrero View, etc.) by coverage area.
*   **[award_winners.csv](file:///Users/max/gitroot/mapthing/data/award_winners.csv)**: Recorded SF Good Neighbor Award Winners.
*   **[events.csv](file:///Users/max/gitroot/mapthing/data/events.csv)**: Formatted events for 2026 SF Good Neighbor Week (cleanups, block parties, tea tastings, etc.).

---

### 2. Modern split-panel Layout (`index.html`)
Created a semantic HTML5 template with:
*   A premium header including a heart-handshake logo, descriptive subtitles, and a **Light/Dark theme toggle**.
*   A hardware-accelerated **MapLibre GL container** featuring a sleek, floating glassmorphic layer controller.
*   A **glassmorphic Sidebar panel** dedicated to rendering dynamic statistical cards and group lists.
*   An **About Modal overlay** describing the project stack and team details.

---

### 3. Glassmorphic CSS Styling (`style.css`)
Designed a high-fidelity styling system with:
*   **HSL-based Curated Palettes**: Light (Slate/Indigo/Teal) and Dark (Deep Space Black/Indigo/Neon Teal) modes that transition smoothly on theme switch.
*   **Glassmorphic panels**: High backdrop-blur filters (`backdrop-filter: blur(12px) saturate(180%)`), semi-transparent borders, and soft shadows mimicking a high-end web dashboard.
*   **Custom Map Elements**: Modern circular pins and logo marker blocks with subtle scaling hover effects.
*   **Mobile Responsiveness**: Elegant CSS media queries that stack the map on top of the sidebar on screens `< 900px` and hide text labels (using icon-only tabs) on mobile devices `< 600px`.

---

### 4. Interactive JS Logic (`app.js`)
Programmed the logic system to coordinate data parsing, vector map events, and dynamic templates:
*   **Async Ingestion**: Concurrently loads the GeoJSON and all 7 CSV files using `fetch` and **PapaParse**, pre-indexing them for instant lookups.
*   **Vector Hover Highlighting**: Dynamically injects numeric feature IDs into the GeoJSON and listens to mouse events to highlight polygons instantly via MapLibre's hardware-accelerated `setFeatureState`.
*   **Lock/Unlock Views**: Click on a polygon to "lock" its statistics in the sidebar, allowing you to move the cursor away to explore other sections without losing your details. A visual "Unlock" toggle in the sidebar releases the lock.
*   **Dynamic Card Renderers**: Renders custom statistics, grids, event badges, and organization listings with responsive actions (mailto and external links).
*   **Robust Image Fallbacks**: Structured image loaders with custom inline `onerror` logic. If a local logo image is missing (e.g. from the CSV), the browser instantly hides the broken image link and falls back to rendering a beautiful Lucide vector icon.

---

## 🛠️ How to run & Verify

1.  **Launch the Dev Server**:
    In your terminal, simply execute:
    ```bash
    npm run dev
    ```
    This will spin up a local web server at `http://127.0.0.1:3000` serving the static directory.
2.  **Verify Features**:
    *   **Neighborhoods Layer**: Move your mouse over neighborhoods. Polygons will highlight, a tooltip will float near the cursor, and the sidebar will update instantly with local demographics.
    *   **Lock Details**: Click on a neighborhood. The sidebar will display a green "Locked" badge. Scroll through its groups, click website links, and then click "Unlock" to resume standard hovering.
    *   **Layer Switching**: Click on "Libraries", "Civic Orgs", or other layers. Vector boundaries will fade into a clean layout and dynamic map pins will render. Clicking a pin centers the map and displays the branch information in the sidebar.
    *   **Theme Switch**: Toggle the sun/moon icon in the header. The vector basemap will switch seamlessly from CartoDB Positron to CartoDB Dark Matter, and the dashboard elements will adapt to dark mode.
