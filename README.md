# SF Good Neighbor Map

An interactive map of San Francisco's neighborhood organizations, designed to foster hyper-local connection and community engagement for **Good Neighbor Lab**.

This web application visualizes San Francisco neighborhood boundaries (from SF OpenData's SF Find Neighborhoods) mapped directly to verified, real-world neighborhood associations, merchant alliances, and community groups.

This site is front-end only and provides a responsive, intuitive interface for exploring community organizations across the city.

---

## Technical Stack

- **Map Engine:** [Mapbox GL JS v3](https://docs.mapbox.com/mapbox-gl-js/)
- **Basemap & Neighborhood Vector Layer:** Custom Mapbox Studio Style with embedded "SF Find Neighborhood" boundaries via SF City Government data.
- **Data Ingestion:** Direct JSON ingestion of `data/groups_data.json` via native browser `fetch`.
- **Data Pipeline:** Python script (`update_map_data.py`) syncing structured data directly from the Google Sheets project database.
- **Typography:** Google Fonts (Outfit & Inter)
- **Iconography:** [Lucide Icons](https://lucide.dev/)
- **Styling:** Vanilla CSS with custom glassmorphism, responsive sidebar layout, and micro-animations.

---

## Data Architecture

All application data is driven by verified records in `data/groups_data.json`:

- `data/groups_data.json`: Structured records exported from the Good Neighbor Lab project database. Each record contains:
  - **Name of Neighborhood Group**: Official organization title.
  - **Resident / Business Label**: Categorization (`Resident`, `Merchant`, or `Merchant & Resident`).
  - **Neighborhood**: One or more comma-separated SF Find neighborhood boundaries served by the group.
  - **Neighborhood (Unofficial)**: Local colloquial neighborhood identification.
  - **Description**: Summary of mission, history, and community focus.
  - **Meeting Information**: Regular meeting cadences and next upcoming meeting schedules.
  - **Contact & Web**: Direct official website URLs, email addresses, and contact forms.

---

## Updating Map Data

To refresh the dataset from Google Sheets:
First establish Google Application Default Credentials with access to the sheet.

```bash
python3 update_map_data.py
```

This writes updated records into `data/groups_data.json`.

---

## Running Locally

To run the application locally:

```bash
npm run dev
```

Then open `http://localhost:3000` in your web browser.