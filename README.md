# 2026 SF Good Neighbor Week Map

An interactive, multi-layered dashboard of San Francisco's community infrastructure, designed to foster hyper-local connection during the **2026 SF Good Neighbor Week**. 

Inspired by the work of Cartographer **Stephen Braitsch**, this web application visualizes 117 San Francisco neighborhood boundaries (from SF OpenData's SF Find Neighborhoods) along with rich layers of civic resources, public libraries, local newsrooms, award winners, and community events loaded dynamically from file-based CSV tables.

This site is front-end only and prioritizes a responsive, premium experience for community engagement.

---

## Technical Stack

- **Map Engine:** [Mapbox GL JS v3](https://docs.mapbox.com/mapbox-gl-js/)
- **Basemap & Neighborhood Vector Layer:** Custom Mapbox Studio Style (`mapbox://styles/max-gnw/cmspn14x2004101rggo7rfmns`) with embedded SF Find Neighborhood boundaries.
- **CSV Data Ingestion:** [PapaParse](https://www.papaparse.com/)
- **Typography:** Google Fonts (Outfit & Inter)
- **Iconography:** [Lucide Icons](https://lucide.dev/)
- **Styling:** Vanilla CSS with custom glassmorphism, responsive sidebar layout, and micro-animations.

---

## Data Structure

All data is stored locally in CSV format within the `/data` directory:

- `neighborhood_data.csv`: Demographic and civic engagement metrics across all 117 SF Find neighborhoods (population, area, civic score, car ownership rates).
- `neighborhood_groups.csv`: Hyper-local neighborhood associations, merchant alliances, and volunteer groups.
- `libraries.csv`: Branch locations and resources for the San Francisco Public Library (SFPL) system.
- `civic_orgs.csv`: Volunteer and civic community organizations.
- `newsrooms.csv`: Local neighborhood news outlets and independent community journalism.
- `award_winners.csv`: Outstanding SF residents recognized for community service and neighborhood impact.
- `events.csv`: Official Good Neighbor Week calendar activities.

---

## Running Locally

To run the application locally:

```bash
npm run dev
```

Then open `http://localhost:3000` in your web browser.