# 2026 SF Good Neighbor Week Map

An interactive, GPU-accelerated, multi-layered dashboard of San Francisco's community infrastructure, designed to foster hyper-local connection during the **2026 SF Good Neighbor Week**. 

Inspired by modern cartography dashboards like [transpomaps.org](https://transpomaps.org/projects/san-francisco/neighborhoods) and the work of Stephen Braitsch, this static web application uses **MapLibre GL JS** to render vector-based neighborhood boundaries and layers of civic resources loaded dynamically from file-based CSV tables.

---

## 🎯 Goal & Core Purpose

The **Good Neighbor Lab** built this platform to make community infrastructure highly visible and engaging for SF residents. By cataloging and overlaying local volunteer organizations, public libraries, independent newsrooms, award winners, and block activities, the map serves as a practical, block-by-block directory for neighborhood connection and civic participation.

---

## ✨ Features & Capabilities

### 1. Vector Neighborhood Layer
*   **Demographic Statistics**: Hover over any of the 37 San Francisco neighborhood polygons to immediately display population, land area, car ownership ratios, and community group lists in the side panel.
*   **Boundary Highlights**: Uses MapLibre's hardware-accelerated `setFeatureState` to dynamically highlight boundary borders and change opacity smoothly.
*   **Interactive View Locking**: Click any neighborhood to lock its stats in the sidebar. This allows you to explore the listing, click web resources, or mail contacts without losing your place when moving the mouse cursor.

### 2. Multi-Layer Civic Indicators
Toggle between five secondary marker layers to render custom interactive pin highlights across the city:
*   📚 **Public Libraries**: Mapped SF Public Library branches with location hours and branch details.
*   🌱 **Civic Orgs**: Essential grassroots volunteer networks (e.g., *Refuse Refuse*, *Friends of the Urban Forest*, *SF Parks Alliance*).
*   📰 **Local Newsrooms**: Hyper-local independent news publishers indexed by their home neighborhood boundaries.
*   ⭐ **Award Winners**: Profiles and stories of outstanding SF residents who won Good Neighbor Awards.
*   📅 **Events**: Catalog of Good Neighbor Week community activities (cleanups, block parties, garden sessions).

### 3. State-of-the-Art Aesthetic & Interface
*   **Glassmorphic Design**: Semi-transparent panels, micro-borders, and high-saturation background blurs (`backdrop-filter: blur(12px)`) that float over the basemap.
*   **Dual Basemap Light & Dark Modes**: A premium toggle seamlessly switches the GPU vector map between *CartoDB Positron* and *CartoDB Dark Matter* basemaps, shifting HSL style variables to adapt all dashboard cards dynamically.
*   **Robust Image Fallbacks**: In-browser image error triggers that seamlessly replace missing local logo files with beautiful vector Lucide icons, preventing broken layouts.
*   **Fully Responsive**: Grid-based layouts that adjust to tablet viewports and scale to elegant icon-only tabs for small mobile screens.

---

## 🛠️ Technology Stack

*   **Map Engine**: [MapLibre GL JS](https://maplibre.org/) — Hardware-accelerated GPU mapping loaded via CDN. Runs with **zero API keys** and zero external billing dependencies by pulling from open CartoDB tile styles.
*   **CSV Engine**: [PapaParse](https://www.papaparse.com/) — Fast, asynchronous client-side CSV parsing.
*   **Iconography**: [Lucide Icons](https://lucide.dev/) — Modern, clean SVG iconography.
*   **Frontend**: Vanilla HTML5, CSS3 Grid/Flexbox, and ES6 JavaScript. **No build step required**, ensuring instant page loads and straightforward deployments.

---

## 📂 File Structure & Database Schema

The application coordinates the following structured files in the workspace:

```
├── index.html          # Semantic layout grid and popover modal components
├── style.css           # Glassmorphic themes, HSL colors, scrollbars, and responsiveness
├── app.js              # Vector controllers, async ingestion orchestrator, and templates
├── package.json        # Node execution settings for local developer hosting
└── data/
    ├── sf_neighborhoods.geojson   # High-resolution boundary geometries
    ├── neighborhood_data.csv      # Demographics (population, area, civic scores)
    ├── neighborhood_groups.csv    # Registered neighborhood associations
    ├── libraries.csv              # Public libraries coordinate pins
    ├── civic_orgs.csv             # Volunteer databases
    ├── newsrooms.csv              # Hyper-local media coordinates
    ├── award_winners.csv          # Award winner biographies
    └── events.csv                 # Neighborhood schedule records
```

---

## 🚀 Running Locally

The application is built to run on any local HTTP server. To spin up the included development environment:

1.  Ensure you have **Node.js** installed on your system.
2.  Install and run the local development server by executing:
    ```bash
    npm run dev
    ```
3.  Open your browser and navigate to:
    👉 **[http://127.0.0.1:3000](http://127.0.0.1:3000)**