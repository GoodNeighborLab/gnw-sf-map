# Implementation Plan - 2026 SF Good Neighbor Week Map

This plan outlines the architecture, layout, design systems, and data flow for a premium, single-page interactive map dashboard for the **2026 SF Good Neighbor Week**, inspired by the visual design of [transpomaps.org](https://transpomaps.org/projects/san-francisco/neighborhoods) and Stephen Braitsch's interactive maps.

## Goal
To build a highly responsive, visually stunning, and interactive HTML website featuring a multi-layered map of San Francisco. The map overlays neighborhood boundaries and displays custom location marker layers (libraries, civic organizations, newsrooms, award winners, and events) with detailed information, website links, and logos dynamically parsed from local CSV files.

---

## Architecture & Tech Stack
1. **Core**: Clean HTML5 semantic layout.
2. **Styling**: Vanilla CSS with modern custom properties, CSS Grid, Flexbox, glassmorphic styles, and smooth micro-animations. Fully responsive layout.
3. **Map Engine**: [MapLibre GL JS](https://maplibre.org/) (loaded via CDN) - a high-performance, open-source vector map rendering library based on WebGL/WebGPU. It supports smooth vector zooming, panning, rotation, and high-fidelity polygon highlighting.
4. **Map Tiles & Styles**: Beautiful, hardware-accelerated vector styles from CARTO, which are publicly available and do **not** require any API keys:
   - **Light Mode (CartoDB Positron)**: `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json`
   - **Dark Mode (CartoDB Dark Matter)**: `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`
5. **CSV Parsing**: [PapaParse](https://www.papaparse.com/) (loaded via CDN) for reliable client-side CSV parsing.
6. **Icons**: [Lucide Icons](https://lucide.dev/) (loaded via CDN) for modern, clean iconography.
7. **No Build Step**: Built as a standard static site (`index.html`, `style.css`, `app.js`) to ensure it remains a "very simple html website" that loads instantly and can be deployed anywhere, yet maintains a state-of-the-art visual appearance.

---

## User Review Required

> [!IMPORTANT]
> **Adopted MapLibre GL JS**: Per your excellent suggestion, we have updated the plan to use **MapLibre GL JS** instead of Leaflet. MapLibre uses GPU-accelerated vector rendering, which allows for incredibly smooth, high-fidelity neighborhood highlighting, smooth vector zooming, and custom vector stylings. By using CARTO's public basemap style JSONs, we can run MapLibre GL JS with **zero API keys** and zero billing dependencies, keeping it lightweight and fully open-source.

> [!NOTE]
> **Dynamic Neighborhood Info**: To make the map feel alive (similar to the car ownership map), we will populate `neighborhood_data.csv` with simulated yet highly realistic metrics (e.g., Population, Third Space Count, Civic Engagement Score, Car Ownership %). Hovering over a neighborhood will display these statistics immediately in the right sidebar.

---

## Proposed Changes

### 1. Data Schema & CSV Files
We will establish a clean data structure inside the [data/](file:///Users/max/gitroot/mapthing/data) folder.

#### [NEW] [neighborhood_data.csv](file:///Users/max/gitroot/mapthing/data/neighborhood_data.csv)
Stores neighborhood-level statistics.
* **Columns**: `neighborhood`, `population`, `area_sq_mi`, `civic_score`, `car_ownership_pct`

#### [NEW] [neighborhood_groups.csv](file:///Users/max/gitroot/mapthing/data/neighborhood_groups.csv)
Stores community groups and associations categorized by neighborhood.
* **Columns**: `neighborhood`, `group_name`, `type` (e.g., "Association", "Group"), `website`, `contact_email`, `description`

#### [NEW] [libraries.csv](file:///Users/max/gitroot/mapthing/data/libraries.csv)
Stores library branch locations.
* **Columns**: `name`, `address`, `latitude`, `longitude`, `website`

#### [NEW] [civic_orgs.csv](file:///Users/max/gitroot/mapthing/data/civic_orgs.csv)
Volunteer and civic organization bases.
* **Columns**: `name`, `category`, `latitude`, `longitude`, `website`, `logo_filename`, `description`

#### [NEW] [newsrooms.csv](file:///Users/max/gitroot/mapthing/data/newsrooms.csv)
Local newsrooms and hyper-local media outlets.
* **Columns**: `name`, `neighborhood`, `latitude`, `longitude`, `website`, `logo_filename`, `description`

#### [NEW] [award_winners.csv](file:///Users/max/gitroot/mapthing/data/award_winners.csv)
SF Good Neighbor Award Winners list.
* **Columns**: `name`, `neighborhood`, `award_category`, `latitude`, `longitude`, `description`, `website`

#### [NEW] [events.csv](file:///Users/max/gitroot/mapthing/data/events.csv)
Scheduled events for 2026 SF Good Neighbor Week.
* **Columns**: `event_name`, `date`, `time`, `location_name`, `latitude`, `longitude`, `description`, `website`

---

### 2. Frontend Structure
We will build the website with three modular files:

#### [NEW] [index.html](file:///Users/max/gitroot/mapthing/index.html)
The semantic markup containing:
- Modern header with title, subtitle, theme toggle, and custom logo.
- A split layout:
  - **Left Column**: Map container `#map` with layer switcher buttons.
  - **Right Column**: Sidebar details panel `#details-panel` containing dynamic card templates.
- Popover/Modal overlays for about page or data submission guidelines.

#### [NEW] [style.css](file:///Users/max/gitroot/mapthing/style.css)
A premium stylesheet utilizing vanilla CSS variables for:
- Sleek typography (Inter/Outfit).
- Glassmorphic panel styling (`backdrop-filter`, semi-transparent borders).
- Theme styling (Automatic transition variables for light and dark modes).
- Responsive design (Swapping columns on mobile/tablet viewports).
- Sleek scrollbars and active state transitions.

#### [NEW] [app.js](file:///Users/max/gitroot/mapthing/app.js)
The logic orchestrator:
- Loads the SF neighborhoods GeoJSON file and injects dynamic numerical `id` properties into each feature.
- Fetches and parses all CSV files concurrently via `Papa.parse`.
- Initializes the MapLibre GL JS map using CARTO vector styles.
- Configures custom fill and border outline layers.
- Attaches mousemove/mouseleave listeners to handle feature hover states via `map.setFeatureState`.
- Triggers instant sidebar updates on hover, showing neighborhood statistics and associated groups.
- Configures custom HTML markers for each secondary layer (libraries, newsrooms, etc.) using modern styling and SVGs for logos.

---

## Verification Plan

### Automated/Code Validation
- Validate HTML structure against semantic standards.
- Run JavaScript linting and verify that GeoJSON coordinates parse correctly without errors.
- Confirm all CSV files load asynchronously without blocking the UI.

### Manual Verification
- **Interactive UI Testing**: Move mouse over neighborhood boundaries. Verify that the boundary highlights instantly and neighborhood details populate in the right panel.
- **Layer Switching**: Click each layer toggle. Verify that the correct markers render, custom logos display, and the sidebar updates to show the selected data.
- **Mobile Responsiveness**: Resize the viewport. Confirm the grid layout adapts elegantly to tablet and mobile screens.
- **Theme Testing**: Toggle light and dark modes. Confirm the CartoDB basemap swops seamlessly along with the CSS variables.
