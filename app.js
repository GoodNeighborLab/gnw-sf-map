/* 
   2026 SF Good Neighbor Week Map - Application Orchestrator
   Powered by Mapbox GL JS and CSV Datasets.
*/

// Basic Feature Flagging via URL
const urlParams = new URLSearchParams(window.location.search);

function isFeatureEnabled(flagName) {
    if (!urlParams.has(flagName)) return false;

    const value = urlParams.get(flagName).toLowerCase();
    return value === 'true' || value === '1' || value === '';
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Application State ---
    const state = {
        activeLayer: 'neighborhoods', // 'neighborhoods', 'libraries', 'civic_orgs', 'newsrooms', 'award_winners', 'events'
        statsData: {},          // Map of neighborhood -> stats
        groupsData: {},         // Map of neighborhood -> list of groups
        librariesData: [],
        civicOrgsData: [],
        newsroomsData: [],
        awardWinnersData: [],
        eventsData: [],

        // Map elements
        map: null,
        neighborhoodLayerId: '8103bc36377890461547', // Layer in Mapbox Style
        markers: [],
        hoveredFeature: null,
        lockedNeighborhood: null, // Track clicked neighborhood to persist sidebar
        activeMarkerEl: null,     // Track clicked marker for styling
        popup: null
    };


    // Mapbox Configuration
    const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoiaGlsZHlzZiIsImEiOiJjbXJtZGlyejAzMXBwMnduOXh2anh5b3gzIn0.wYUboFNB3ng9zkGxk_W7Xg';

    // Draft Styling Feature Flag
    let MAPBOX_STYLE_URL = 'mapbox://styles/hildysf/cmrxkca9b00bt01rjhzeccw6f';
    if (isFeatureEnabled('draft')) {
        MAPBOX_STYLE_URL += '/draft';
    }
    console.log('Mapbox URL Loaded', MAPBOX_STYLE_URL);

    // --- Dynamic Templates for details-panel ---
    const templates = {
        // Welcoming card
        welcome: () => `
            <div class="welcome-card">
                <div class="welcome-icon">
                    <i data-lucide="navigation"></i>
                </div>
                <h3>Explore San Francisco</h3>
                <p>Hover over or click a neighborhood polygon on the map to view instant demographics, civic engagement score, car ownership rates, and community groups.</p>
                <p class="welcome-hint">Switch layers at the bottom of the map to see public libraries, local newsrooms, civic organizations, Good Neighbor Week events, and award winners.</p>
            </div>
        `,

        // Neighborhood detail view
        neighborhood: (name, stats, groups) => {
            let statsHtml = '';
            if (stats) {
                statsHtml = `
                    <div class="stats-grid">
                        <div class="stat-card">
                            <span class="stat-label"><i data-lucide="users" style="width:12px; height:12px;"></i> Population</span>
                            <span class="stat-value">${Number(stats.population).toLocaleString()}</span>
                            <span class="stat-desc">Estimated residents</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label"><i data-lucide="map" style="width:12px; height:12px;"></i> Area</span>
                            <span class="stat-value">${stats.area_sq_mi} <small style="font-size:11px; font-weight:500;">sq mi</small></span>
                            <span class="stat-desc">District size</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label"><i data-lucide="heart-handshake" style="width:12px; height:12px;"></i> Civic Score</span>
                            <span class="stat-value">${stats.civic_score} <small style="font-size:11px; font-weight:500;">/ 100</small></span>
                            <span class="stat-desc">Engagement index</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-label"><i data-lucide="car" style="width:12px; height:12px;"></i> Car Access</span>
                            <span class="stat-value">${stats.car_ownership_pct}%</span>
                            <span class="stat-desc">Households with cars</span>
                        </div>
                    </div>
                `;
            }

            let groupsHtml = '<div class="no-data-msg">No community groups registered in this area yet.</div>';
            if (groups && groups.length > 0) {
                groupsHtml = groups.map(g => `
                    <div class="entity-card">
                        <div class="entity-card-header">
                            <h5 class="entity-name">${escapeHtml(g.group_name)}</h5>
                            <span class="entity-tag">${escapeHtml(g.type)}</span>
                        </div>
                        <p class="entity-desc">${escapeHtml(g.description)}</p>
                        <div class="entity-actions">
                            ${g.website ? `<a href="${escapeHtml(g.website)}" target="_blank" rel="noopener noreferrer" class="entity-link"><i data-lucide="external-link"></i><span>Website</span></a>` : ''}
                            ${g.contact_email ? `<a href="mailto:${escapeHtml(g.contact_email)}" class="entity-link"><i data-lucide="mail"></i><span>Email</span></a>` : ''}
                        </div>
                    </div>
                `).join('');
            }

            const isLocked = state.lockedNeighborhood === name;

            return `
                <div class="neighborhood-title-card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                        <h3>${escapeHtml(name)}</h3>
                        ${isLocked ? '<span class="sidebar-badge" style="background-color: var(--accent-neon); color: white;">Locked</span>' : '<span class="sidebar-badge" style="background-color: var(--border-color); color: var(--text-secondary);">Hovering</span>'}
                    </div>
                    <span class="stat-area"><i data-lucide="map-pin" style="width:14px; height:14px; display:inline; vertical-align:middle; margin-right:4px;"></i>San Francisco District</span>
                    ${isLocked ? `<p style="font-size:11px; margin-top:8px; color: var(--accent); cursor: pointer; font-weight: 600;" id="unlock-btn"><i data-lucide="lock" style="width:12px; height:12px; display:inline; vertical-align:middle; margin-right:4px;"></i>Locked view. Click here to unlock</p>` : ''}
                </div>

                ${statsHtml}

                <div class="entity-list-section">
                    <h4>Community Groups (${groups ? groups.length : 0})</h4>
                    ${groupsHtml}
                </div>
            `;
        },

        // Marker item detail view (Libraries, newsrooms, etc.)
        entityDetail: (title, category, addressInfo, description, website, logoFilename, additionalItems = []) => {
            const hasLogo = !!logoFilename;
            const logoUrl = hasLogo ? `assets/logos/${logoFilename}` : '';

            let fallbackIcon = 'heart-handshake';
            let fallbackStyle = '';
            if (category.toLowerCase().includes('library')) {
                fallbackIcon = 'book-open';
                fallbackStyle = 'background-color: var(--accent-light); color: var(--accent);';
            } else if (category.toLowerCase().includes('news')) {
                fallbackIcon = 'newspaper';
                fallbackStyle = 'background-color: #fef3c7; color: #d97706;';
            } else if (category.toLowerCase().includes('award')) {
                fallbackIcon = 'award';
                fallbackStyle = 'background-color: #d1fae5; color: #059669;';
            } else if (category.toLowerCase().includes('event')) {
                fallbackIcon = 'calendar';
                fallbackStyle = 'background-color: #ecdfec; color: #a21caf;';
            }

            let logoMarkup = `
                <div class="marker-logo-container" style="${fallbackStyle}">
                    ${hasLogo ? `<img src="${logoUrl}" alt="${escapeHtml(title)} logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" style="width:100%; height:100%; object-fit:contain; border-radius:var(--radius-sm);" />` : ''}
                    <div class="marker-logo-fallback" style="${hasLogo ? 'display:none;' : 'display:flex;'} width:100%; height:100%; align-items:center; justify-content:center;">
                        <i data-lucide="${fallbackIcon}" style="width:32px; height:32px;"></i>
                    </div>
                </div>
            `;

            const itemsHtml = additionalItems.map(item => `
                <div class="marker-info-item">
                    <i data-lucide="${item.icon}"></i>
                    <span><strong>${item.label}:</strong> ${escapeHtml(item.value)}</span>
                </div>
            `).join('');

            return `
                <div class="marker-detail-card">
                    ${logoMarkup}
                    <h3>${escapeHtml(title)}</h3>
                    <span class="marker-category">${escapeHtml(category)}</span>
                    
                    <div class="marker-info-item">
                        <i data-lucide="map-pin"></i>
                        <span>${escapeHtml(addressInfo)}</span>
                    </div>
                    
                    ${itemsHtml}
                    
                    <p class="marker-desc">${escapeHtml(description)}</p>
                    
                    ${website ? `
                        <a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer" class="marker-btn">
                            <i data-lucide="external-link"></i>
                            <span>Visit Website</span>
                        </a>
                    ` : ''}
                </div>
            `;
        }
    };

    // --- Helper Functions ---
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Dynamic Icon Refreshing for dynamically injected markup
    function refreshIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    // --- Data loading & initialization ---
    async function loadData() {
        console.log("Loading datasets...");

        try {
            // Helper to parse local CSV sheets via PapaParse
            const parseCSV = (filepath) => {
                return new Promise((resolve, reject) => {
                    Papa.parse(filepath, {
                        download: true,
                        header: true,
                        skipEmptyLines: true,
                        complete: (results) => resolve(results.data),
                        error: (error) => reject(error)
                    });
                });
            };

            // Concurrently load CSV sheets
            const [
                statsRaw,
                groupsRaw,
                librariesRaw,
                civicRaw,
                newsroomsRaw,
                winnersRaw,
                eventsRaw
            ] = await Promise.all([
                parseCSV('data/neighborhood_data.csv'),
                parseCSV('data/neighborhood_groups.csv'),
                parseCSV('data/libraries.csv'),
                parseCSV('data/civic_orgs.csv'),
                parseCSV('data/newsrooms.csv'),
                parseCSV('data/award_winners.csv'),
                parseCSV('data/events.csv')
            ]);

            // Index stats: { "Mission": stats_record, ... }
            statsRaw.forEach(row => {
                if (row.neighborhood) {
                    state.statsData[row.neighborhood.trim()] = row;
                }
            });

            // Group community groups by neighborhood
            groupsRaw.forEach(row => {
                if (row.neighborhood) {
                    const nh = row.neighborhood.trim();
                    if (!state.groupsData[nh]) {
                        state.groupsData[nh] = [];
                    }
                    state.groupsData[nh].push(row);
                }
            });

            state.librariesData = librariesRaw;
            state.civicOrgsData = civicRaw;
            state.newsroomsData = newsroomsRaw;
            state.awardWinnersData = winnersRaw;
            state.eventsData = eventsRaw;

            console.log("All local CSV data parsed successfully!");
            initializeMap();

        } catch (error) {
            console.error("Error loading application data:", error);
            document.getElementById('details-content').innerHTML = `
                <div class="welcome-card" style="border-color: #ef4444;">
                    <div class="welcome-icon" style="background-color: #fee2e2; color: #ef4444;">
                        <i data-lucide="alert-triangle"></i>
                    </div>
                    <h3>Error Loading Data</h3>
                    <p>We encountered an issue downloading the local database tables.</p>
                    <p class="welcome-hint">Please check that the local server is running and the data folder contains the correct CSV assets.</p>
                </div>
            `;
            refreshIcons();
        }
    }

    // --- Map Initialization ---
    function initializeMap() {
        console.log("Initializing Mapbox GL Map...");

        mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

        // Custom popup instance
        state.popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 15
        });

        // Initialize Mapbox Map
        state.map = new mapboxgl.Map({
            container: 'map',
            style: MAPBOX_STYLE_URL,
            center: [-122.44, 37.76], // Centered on SF
            zoom: 11.6,
            minZoom: 10,
            maxZoom: 18
        });

        // Add standard navigation zoom controls in top-left
        state.map.addControl(new mapboxgl.NavigationControl({
            showCompass: false
        }), 'top-left');

        // Setup Map event listeners
        state.map.on('load', () => {
            console.log("Mapbox style loaded.");
            identifyNeighborhoodLayer();
            setupInteractiveEvents();
            refreshSidebar();
        });
    }

    // Detect the neighborhood fill layer ID from the Mapbox style
    function identifyNeighborhoodLayer() {
        const layers = state.map.getStyle().layers || [];
        const found = layers.find(l =>
            l.id === state.neighborhoodLayerId ||
            l['source-layer'] === '8103bc36377890461547' ||
            (l.type === 'fill' && l.source && l.source.includes('fcjm9r9etz94'))
        );
        if (found) {
            state.neighborhoodLayerId = found.id;
            console.log("Neighborhood layer confirmed:", state.neighborhoodLayerId);
        }
    }

    // --- Setup Interactive Polygon Events for Vector Neighborhood Layer ---
    function setupInteractiveEvents() {
        const map = state.map;
        const layerId = state.neighborhoodLayerId;

        // Hover highlighting & instant sidebar loading
        map.on('mousemove', layerId, (e) => {
            if (state.activeLayer !== 'neighborhoods') return;
            console.log("Active layer n confirmed");

            if (e.features && e.features.length > 0) {
                map.getCanvas().style.cursor = 'pointer';
                const feature = e.features[0];
                const nhName = feature.properties && (feature.properties.name || feature.properties.NAME || feature.properties.nhood);

                if (!nhName) return;

                const featureKey = feature.id !== undefined ? feature.id : nhName;

                // Only trigger update if we change features to avoid redundant DOM updates
                if (!state.hoveredFeature || state.hoveredFeature.key !== featureKey) {
                    // Reset previous hover state
                    if (state.hoveredFeature && state.hoveredFeature.id !== undefined) {
                        try {
                            map.setFeatureState(
                                { source: state.hoveredFeature.source, sourceLayer: state.hoveredFeature.sourceLayer, id: state.hoveredFeature.id },
                                { state: false, hover: false }
                            );
                        } catch (err) {
                            // ignore if featureState not supported on source
                        }
                    }

                    state.hoveredFeature = {
                        key: featureKey,
                        id: feature.id,
                        source: feature.source,
                        sourceLayer: feature.sourceLayer
                    };

                    // Set new hover state
                    if (feature.id !== undefined) {
                        try {
                            map.setFeatureState(
                                { source: feature.source, sourceLayer: feature.sourceLayer, id: feature.id },
                                { state: true, hover: true }
                            );
                        } catch (err) {
                            // ignore
                        }
                    }

                    // If we haven't locked a selection, show statistics on hover
                    if (!state.lockedNeighborhood) {
                        showNeighborhoodSidebar(nhName);
                    }
                }

                // Show floating popup at mouse position
                const stats = state.statsData[nhName];
                const statsStr = stats && stats.population ? `Pop: ${Number(stats.population).toLocaleString()}` : '';

                state.popup
                    .setLngLat(e.lngLat)
                    .setHTML(`
                        <div class="popup-title">${escapeHtml(nhName)}</div>
                        ${statsStr ? `<div class="popup-subtitle">${statsStr}</div>` : ''}
                    `)
                    .addTo(map);
            }
        });

        // Mouse leaves neighborhood
        map.on('mouseleave', layerId, () => {
            if (state.activeLayer !== 'neighborhoods') return;

            map.getCanvas().style.cursor = '';
            state.popup.remove();

            if (state.hoveredFeature && state.hoveredFeature.id !== undefined) {
                try {
                    map.setFeatureState(
                        { source: state.hoveredFeature.source, sourceLayer: state.hoveredFeature.sourceLayer, id: state.hoveredFeature.id },
                        { state: false, hover: false }
                    );
                } catch (err) {
                    // ignore
                }
                state.hoveredFeature = null;
            }

            // Restore the locked neighborhood details, or show welcome card
            if (!state.lockedNeighborhood) {
                const detailsContainer = document.getElementById('details-content');
                detailsContainer.innerHTML = templates.welcome();
                refreshIcons();
            } else {
                showNeighborhoodSidebar(state.lockedNeighborhood);
            }
        });

        // Click to Lock/Unlock sidebar view
        map.on('click', layerId, (e) => {
            if (state.activeLayer !== 'neighborhoods') return;

            if (e.features && e.features.length > 0) {
                const nhName = e.features[0].properties && (e.features[0].properties.name || e.features[0].properties.NAME || e.features[0].properties.nhood);
                if (!nhName) return;

                // If it's already locked, clicking it again unlocks it
                if (state.lockedNeighborhood === nhName) {
                    state.lockedNeighborhood = null;
                    showNeighborhoodSidebar(nhName); // updates sidebar state to Hovering badge
                } else {
                    state.lockedNeighborhood = nhName;
                    showNeighborhoodSidebar(nhName); // updates sidebar state to Locked badge
                }
            }
        });
    }

    // --- Helper: Populate Neighborhood details into Sidebar ---
    function showNeighborhoodSidebar(name) {
        const stats = state.statsData[name];
        const groups = state.groupsData[name];
        const detailsContainer = document.getElementById('details-content');

        detailsContainer.innerHTML = templates.neighborhood(name, stats, groups);
        refreshIcons();

        // Add unlock button click listener if locked
        const unlockBtn = document.getElementById('unlock-btn');
        if (unlockBtn) {
            unlockBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                state.lockedNeighborhood = null;
                showNeighborhoodSidebar(name);
            });
        }
    }

    // --- Switch Active Map Layer ---
    function switchLayer(layerId) {
        if (state.activeLayer === layerId) return;
        state.activeLayer = layerId;

        console.log(`Switching map view to: ${layerId}`);

        // Remove locked elements
        state.lockedNeighborhood = null;
        state.hoveredFeature = null;

        // Update sidebar titles
        const layerBadge = document.getElementById('layer-badge');
        const sidebarTitle = document.getElementById('sidebar-title');

        // Format names nicely
        const titlesMapping = {
            neighborhoods: 'Neighborhoods Layer',
            libraries: 'Public Libraries',
            civic_orgs: 'Civic & Volunteer Orgs',
            newsrooms: 'Local Newsrooms',
            award_winners: 'Good Neighbor Award Winners',
            events: 'Events Layer'
        };

        sidebarTitle.textContent = titlesMapping[layerId] || 'Map Layer';
        layerBadge.textContent = 'Active';

        // Clear existing markers & popups
        clearMarkers();
        state.popup.remove();

        const map = state.map;
        const nhLayerId = state.neighborhoodLayerId;

        if (layerId === 'neighborhoods') {
            // Re-apply standard polygon opacity
            if (map.getLayer(nhLayerId)) {
                map.setPaintProperty(nhLayerId, 'fill-opacity', 0.8);
            }

            // Restore welcome sidebar
            document.getElementById('details-content').innerHTML = templates.welcome();
            refreshIcons();
        } else {
            // Turn down neighborhood fill opacity so it works as subtle skeleton context
            if (map.getLayer(nhLayerId)) {
                map.setPaintProperty(nhLayerId, 'fill-opacity', 0.15);
            }

            // Build markers corresponding to active layer
            renderLayerMarkers(layerId);
        }
    }

    // --- Clear All Dynamic Markers from Map ---
    function clearMarkers() {
        state.markers.forEach(m => m.remove());
        state.markers = [];
        state.activeMarkerEl = null;
    }

    // --- Render Custom Dynamic Markers for Point Layers ---
    function renderLayerMarkers(layerId) {
        let dataset = [];
        let renderFn = null;

        if (layerId === 'libraries') {
            dataset = state.librariesData;
            renderFn = createLibraryMarker;
        } else if (layerId === 'civic_orgs') {
            dataset = state.civicOrgsData;
            renderFn = createCivicMarker;
        } else if (layerId === 'newsrooms') {
            dataset = state.newsroomsData;
            renderFn = createNewsroomMarker;
        } else if (layerId === 'award_winners') {
            dataset = state.awardWinnersData;
            renderFn = createAwardMarker;
        } else if (layerId === 'events') {
            dataset = state.eventsData;
            renderFn = createEventMarker;
        }

        // Show welcome layer description in sidebar
        const detailsContainer = document.getElementById('details-content');

        const welcomeLayerText = {
            libraries: 'Select a library branch pin on the map to view address details and location resources.',
            civic_orgs: 'Select a civic/volunteer organization pin on the map to explore volunteer channels and organization info.',
            newsrooms: 'Select a local newsroom pin on the map to explore hyper-local journalism resources by neighborhood.',
            award_winners: 'Select an award winner star pin on the map to read the inspiring stories of outstanding SF residents.',
            events: 'Select a calendar event pin on the map to view local 2026 SF Good Neighbor Week activities and signup forms.'
        };

        const welcomeLayerIcon = {
            libraries: 'book-open',
            civic_orgs: 'users',
            newsrooms: 'newspaper',
            award_winners: 'award',
            events: 'calendar'
        };

        detailsContainer.innerHTML = `
            <div class="welcome-card">
                <div class="welcome-icon" style="background-color: var(--accent-light); color: var(--accent);">
                    <i data-lucide="${welcomeLayerIcon[layerId]}"></i>
                </div>
                <h3>${escapeHtml(document.getElementById('sidebar-title').textContent)}</h3>
                <p>${welcomeLayerText[layerId]}</p>
            </div>
        `;
        refreshIcons();

        // Render markers onto the map
        dataset.forEach(row => {
            const lat = parseFloat(row.latitude);
            const lng = parseFloat(row.longitude);

            if (isNaN(lat) || isNaN(lng)) return;

            renderFn(row, [lng, lat]);
        });
    }

    // 1. Library Markers Setup
    function createLibraryMarker(row, coordinates) {
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.innerHTML = `
            <div class="marker-pin-wrapper">
                <i data-lucide="book-open" style="width: 14px; height: 14px;"></i>
            </div>
        `;

        const marker = new mapboxgl.Marker({ element: el })
            .setLngLat(coordinates)
            .addTo(state.map);

        state.markers.push(marker);

        // Sidebar detail triggers on marker click
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            highlightMarker(el);

            const additional = [
                { icon: 'info', label: 'Library System', value: 'San Francisco Public Library (SFPL)' }
            ];

            const sidebarHtml = templates.entityDetail(
                row.name,
                "San Francisco Public Library",
                row.address,
                "Free and open to the public. Offers books, community learning rooms, free Wi-Fi, computer labs, and weekly neighborhood story readings for families.",
                row.website,
                "",
                additional
            );

            document.getElementById('details-content').innerHTML = sidebarHtml;
            refreshIcons();

            // Fly to marker center smoothly
            state.map.easeTo({ center: coordinates, zoom: 13.5 });
        });
    }

    // 2. Civic Organizations Markers Setup
    function createCivicMarker(row, coordinates) {
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.innerHTML = `
            <div class="marker-pin-wrapper" style="border-color: #10b981; color: #10b981;">
                <i data-lucide="users" style="width: 14px; height: 14px;"></i>
            </div>
        `;

        const marker = new mapboxgl.Marker({ element: el })
            .setLngLat(coordinates)
            .addTo(state.map);

        state.markers.push(marker);

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            highlightMarker(el);

            const additional = [
                { icon: 'tag', label: 'Activity Focus', value: row.category }
            ];

            const sidebarHtml = templates.entityDetail(
                row.name,
                "Civic & Volunteer Organization",
                "San Francisco HQ Base",
                row.description,
                row.website,
                row.logo_filename,
                additional
            );

            document.getElementById('details-content').innerHTML = sidebarHtml;
            refreshIcons();
            state.map.easeTo({ center: coordinates, zoom: 13.5 });
        });
    }

    // 3. Newsroom Markers Setup
    function createNewsroomMarker(row, coordinates) {
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.innerHTML = `
            <div class="marker-pin-wrapper" style="border-color: #d97706; color: #d97706;">
                <i data-lucide="newspaper" style="width: 14px; height: 14px;"></i>
            </div>
        `;

        const marker = new mapboxgl.Marker({ element: el })
            .setLngLat(coordinates)
            .addTo(state.map);

        state.markers.push(marker);

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            highlightMarker(el);

            const additional = [
                { icon: 'map', label: 'Coverage Area', value: row.neighborhood }
            ];

            const sidebarHtml = templates.entityDetail(
                row.name,
                "Local Newsroom / Independent Media",
                `${row.neighborhood} District Base`,
                row.description,
                row.website,
                row.logo_filename,
                additional
            );

            document.getElementById('details-content').innerHTML = sidebarHtml;
            refreshIcons();
            state.map.easeTo({ center: coordinates, zoom: 13.5 });
        });
    }

    // 4. Award Winners Markers Setup
    function createAwardMarker(row, coordinates) {
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.innerHTML = `
            <div class="marker-pin-wrapper" style="border-color: #ef4444; color: #ef4444;">
                <i data-lucide="star" style="width: 14px; height: 14px; fill: #fee2e2;"></i>
            </div>
        `;

        const marker = new mapboxgl.Marker({ element: el })
            .setLngLat(coordinates)
            .addTo(state.map);

        state.markers.push(marker);

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            highlightMarker(el);

            const additional = [
                { icon: 'shield-alert', label: 'Award Focus', value: row.award_category },
                { icon: 'heart', label: 'Home District', value: row.neighborhood }
            ];

            const sidebarHtml = templates.entityDetail(
                row.name,
                "SF Good Neighbor Award Winner",
                `Representative of ${row.neighborhood}`,
                row.description,
                row.website,
                "",
                additional
            );

            document.getElementById('details-content').innerHTML = sidebarHtml;
            refreshIcons();
            state.map.easeTo({ center: coordinates, zoom: 13.5 });
        });
    }

    // 5. Event Markers Setup
    function createEventMarker(row, coordinates) {
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.innerHTML = `
            <div class="marker-pin-wrapper" style="border-color: #a21caf; color: #a21caf;">
                <i data-lucide="calendar" style="width: 14px; height: 14px;"></i>
            </div>
        `;

        const marker = new mapboxgl.Marker({ element: el })
            .setLngLat(coordinates)
            .addTo(state.map);

        state.markers.push(marker);

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            highlightMarker(el);

            // Build custom markup for sidebar with Date Badge
            const detailContainer = document.getElementById('details-content');
            detailContainer.innerHTML = `
                <div class="marker-detail-card">
                    <span class="event-date-badge">${escapeHtml(row.date)}</span>
                    <div class="marker-logo-container" style="background-color: #fae8ff; color: #a21caf;">
                        <div class="marker-logo-fallback"><i data-lucide="calendar" style="width:32px; height:32px;"></i></div>
                    </div>
                    <h3>${escapeHtml(row.event_name)}</h3>
                    <span class="marker-category">Good Neighbor Week Activity</span>
                    
                    <div class="marker-info-item">
                        <i data-lucide="map-pin"></i>
                        <span>${escapeHtml(row.location_name)}</span>
                    </div>
                    
                    <div class="marker-info-item">
                        <i data-lucide="clock"></i>
                        <span><strong>Time:</strong> ${escapeHtml(row.time)}</span>
                    </div>
                    
                    <p class="marker-desc">${escapeHtml(row.description)}</p>
                    
                    ${row.website ? `
                        <a href="${escapeHtml(row.website)}" target="_blank" rel="noopener noreferrer" class="marker-btn" style="background-color:#a21caf; box-shadow: 0 4px 12px rgba(162,28,175,0.25);">
                            <i data-lucide="ticket"></i>
                            <span>Sign Up / Details</span>
                        </a>
                    ` : ''}
                </div>
            `;

            refreshIcons();
            state.map.easeTo({ center: coordinates, zoom: 13.5 });
        });
    }

    // Toggle active marker UI highlighting
    function highlightMarker(markerEl) {
        if (state.activeMarkerEl) {
            state.activeMarkerEl.classList.remove('active');
        }
        state.activeMarkerEl = markerEl;
        markerEl.classList.add('active');
    }

    // --- Refresh/Load Sidebar View ---
    function refreshSidebar() {
        const container = document.getElementById('details-content');
        container.innerHTML = templates.welcome();
        refreshIcons();
    }

    // --- UI Listeners Binding ---
    function bindUIEvents() {
        // Mobile hamburger menu toggle
        const menuToggle = document.getElementById('mobile-menu-toggle');
        const mobileOverlay = document.getElementById('mobile-nav-overlay');

        const closeMobileMenu = () => {
            menuToggle.classList.remove('open');
            mobileOverlay.classList.remove('open');
            menuToggle.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('mobile-nav-locked');
        };

        menuToggle.addEventListener('click', () => {
            const isOpen = menuToggle.classList.toggle('open');
            mobileOverlay.classList.toggle('open', isOpen);
            menuToggle.setAttribute('aria-expanded', String(isOpen));
            document.body.classList.toggle('mobile-nav-locked', isOpen);
        });

        mobileOverlay.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', closeMobileMenu);
        });

        // About accordion within the mobile menu
        const mobileDropdown = mobileOverlay.querySelector('.mobile-nav-dropdown');
        const mobileDropdownToggle = mobileOverlay.querySelector('.mobile-nav-dropdown-toggle');
        mobileDropdownToggle.addEventListener('click', () => {
            const isOpen = mobileDropdown.classList.toggle('open');
            mobileDropdownToggle.setAttribute('aria-expanded', String(isOpen));
        });

        // Dynamic layer switches binding
        const layerButtons = document.querySelectorAll('.layer-btn');
        layerButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetLayer = btn.getAttribute('data-layer');

                // Update active buttons styles
                layerButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Orchestrate layer change
                switchLayer(targetLayer);
            });
        });
    }

    // --- Start Application Ingestion ---
    bindUIEvents();
    loadData();
});
