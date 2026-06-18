/* 
   2026 SF Good Neighbor Week Map - Application Orchestrator
   Handles GeoJSON/CSV fetching, MapLibre GL JS configuration, and Glassmorphic Sidebar Rendering.
*/

document.addEventListener('DOMContentLoaded', () => {
    // --- Application State ---
    const state = {
        activeLayer: 'neighborhoods', // 'neighborhoods', 'libraries', 'civic_orgs', 'newsrooms', 'award_winners', 'events'
        theme: 'light',
        geojsonData: null,
        statsData: {},          // Map of neighborhood -> stats
        groupsData: {},         // Map of neighborhood -> list of groups
        librariesData: [],
        civicOrgsData: [],
        newsroomsData: [],
        awardWinnersData: [],
        eventsData: [],
        
        // Map elements
        map: null,
        markers: [],
        hoveredFeatureId: null,
        lockedNeighborhood: null, // Track clicked neighborhood to persist sidebar
        activeMarkerEl: null,     // Track clicked marker for styling
        popup: null
    };

    // --- Styling Rules for Map Layers (Light/Dark themes) ---
    const colors = {
        light: {
            fillDefault: '#4f46e5',
            fillHover: '#10b981',
            fillOpacityDefault: 0.1,
            fillOpacityHover: 0.45,
            borderDefault: '#4f46e5',
            borderOpacity: 0.4,
            borderWidth: 1.5
        },
        dark: {
            fillDefault: '#6366f1',
            fillHover: '#34d399',
            fillOpacityDefault: 0.08,
            fillOpacityHover: 0.4,
            borderDefault: '#6366f1',
            borderOpacity: 0.35,
            borderWidth: 1.5
        }
    };

    // Basemap URLs
    const basemaps = {
        light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    };

    // --- Dynamic Templates for details-panel ---
    const templates = {
        // Welcoming card
        welcome: () => `
            <div class="welcome-card">
                <div class="welcome-icon">
                    <i data-lucide="navigation"></i>
                </div>
                <h3>Explore San Francisco</h3>
                <p>Hover over a neighborhood polygon on the map to view demographics, car ownership rates, and active community groups.</p>
                <p class="welcome-hint">Switch layers below the map to see public libraries, volunteer organizations, local newsrooms, award winners, and Good Neighbor Week events.</p>
            </div>
        `,
        
        // Neighborhood detail view
        neighborhood: (name, _, groups) => {
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
                            ${g.website ? `<a href="${escapeHtml(g.website)}" target="_blank" class="entity-link"><i data-lucide="external-link"></i><span>Website</span></a>` : ''}
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
                        <a href="${escapeHtml(website)}" target="_blank" class="marker-btn">
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
        return str
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
            // Load GeoJSON
            const geojsonRes = await fetch('data/sf_neighborhoods.geojson');
            state.geojsonData = await geojsonRes.json();
            
            // Assign custom numeric IDs to each feature dynamically for MapLibre setFeatureState
            state.geojsonData.features.forEach((feature, index) => {
                feature.id = index;
            });
            console.log("GeoJSON loaded successfully!");
            
            // Helper to parse local CSV sheets
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
                state.statsData[row.neighborhood] = row;
            });

            // Group community groups by neighborhood
            groupsRaw.forEach(row => {
                const nh = row.neighborhood;
                if (!state.groupsData[nh]) {
                    state.groupsData[nh] = [];
                }
                state.groupsData[nh].push(row);
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
                    <p>We encountered an issue downloading the local map configurations and database tables.</p>
                    <p class="welcome-hint">Please check that the local server is running and the data folder contains the correct CSV assets.</p>
                </div>
            `;
            refreshIcons();
        }
    }

    // --- Map Initialization ---
    function initializeMap() {
        console.log("Initializing MapLibre GL Map...");
        
        // Custom popup instance
        state.popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 15
        });

        // Initialize MapLibre Map
        state.map = new maplibregl.Map({
            container: 'map',
            style: basemaps[state.theme],
            center: [-122.44, 37.76], // Centered on SF
            zoom: 11.8,
            minZoom: 10,
            maxZoom: 16
        });

        // Add standard navigation zoom controls in top-left
        state.map.addControl(new maplibregl.NavigationControl({
            showCompass: false
        }), 'top-left');

        // Setup Map event listeners
        state.map.on('load', () => {
            console.log("Basemap loaded.");
            setupMapLayers();
            setupInteractiveEvents();
            refreshSidebar();
        });
    }

    // --- Configure Vector Sources & Layers ---
    function setupMapLayers() {
        const map = state.map;
        const themeColors = colors[state.theme];

        // Add GeoJSON neighborhood boundaries source
        map.addSource('sf-neighborhoods', {
            type: 'geojson',
            data: state.geojsonData
        });

        // 1. Fill Layer
        map.addLayer({
            id: 'neighborhood-fills',
            type: 'fill',
            source: 'sf-neighborhoods',
            layout: {},
            paint: {
                'fill-color': themeColors.fillDefault,
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'hover'], false],
                    themeColors.fillOpacityHover,
                    themeColors.fillOpacityDefault
                ]
            }
        });

        // 2. Borders Line Layer
        map.addLayer({
            id: 'neighborhood-borders',
            type: 'line',
            source: 'sf-neighborhoods',
            layout: {},
            paint: {
                'line-color': themeColors.borderDefault,
                'line-width': themeColors.borderWidth,
                'line-opacity': themeColors.borderOpacity
            }
        });
    }

    // --- Setup Interactive Polygon Events ---
    function setupInteractiveEvents() {
        const map = state.map;

        // Hover highlighting & instant sidebar loading
        map.on('mousemove', 'neighborhood-fills', (e) => {
            if (state.activeLayer !== 'neighborhoods') return;
            
            if (e.features.length > 0) {
                map.getCanvas().style.cursor = 'pointer';
                const feature = e.features[0];
                const featureId = feature.id;
                const nhName = feature.properties.name;

                // Only trigger update if we change features to avoid redundant DOM updates
                if (state.hoveredFeatureId !== featureId) {
                    // Reset previous hover state
                    if (state.hoveredFeatureId !== null) {
                        map.setFeatureState(
                            { source: 'sf-neighborhoods', id: state.hoveredFeatureId },
                            { hover: false }
                        );
                    }

                    state.hoveredFeatureId = featureId;
                    
                    // Set new hover state
                    map.setFeatureState(
                        { source: 'sf-neighborhoods', id: featureId },
                        { hover: true }
                    );

                    // If we haven't locked a selection, show statistics on hover
                    if (!state.lockedNeighborhood) {
                        showNeighborhoodSidebar(nhName);
                    }
                }

                // Show floating popup at mouse position
                const stats = state.statsData[nhName];
                const statsStr = stats ? `Pop: ${Number(stats.population).toLocaleString()}` : '';
                
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
        map.on('mouseleave', 'neighborhood-fills', () => {
            if (state.activeLayer !== 'neighborhoods') return;
            
            map.getCanvas().style.cursor = '';
            state.popup.remove();

            if (state.hoveredFeatureId !== null) {
                map.setFeatureState(
                    { source: 'sf-neighborhoods', id: state.hoveredFeatureId },
                    { hover: false }
                );
                state.hoveredFeatureId = null;
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
        map.on('click', 'neighborhood-fills', (e) => {
            if (state.activeLayer !== 'neighborhoods') return;
            
            if (e.features.length > 0) {
                const nhName = e.features[0].properties.name;
                
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
        state.hoveredFeatureId = null;
        
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

        if (layerId === 'neighborhoods') {
            // Re-apply standard polygon coloring
            const themeColors = colors[state.theme];
            map.setPaintProperty('neighborhood-fills', 'fill-opacity', [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                themeColors.fillOpacityHover,
                themeColors.fillOpacityDefault
            ]);
            map.setPaintProperty('neighborhood-borders', 'line-opacity', themeColors.borderOpacity);
            
            // Restore welcome sidebar
            document.getElementById('details-content').innerHTML = templates.welcome();
            refreshIcons();
        } else {
            // Turn down neighborhood opacity extremely low so it works as a baseline skeleton context
            map.setPaintProperty('neighborhood-fills', 'fill-opacity', 0.02);
            map.setPaintProperty('neighborhood-borders', 'line-opacity', 0.15);
            
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

    // --- Render Custom Dynamic Markers for Markers Layers ---
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

        const marker = new maplibregl.Marker({ element: el })
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

        const marker = new maplibregl.Marker({ element: el })
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

        const marker = new maplibregl.Marker({ element: el })
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

        const marker = new maplibregl.Marker({ element: el })
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

        const marker = new maplibregl.Marker({ element: el })
            .setLngLat(coordinates)
            .addTo(state.map);

        state.markers.push(marker);

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            highlightMarker(el);
            
            const additional = [
                { icon: 'calendar', label: 'Scheduled Date', value: row.date },
                { icon: 'clock', label: 'Event Hours', value: row.time }
            ];
            
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
                        <a href="${escapeHtml(row.website)}" target="_blank" class="marker-btn" style="background-color:#a21caf; box-shadow: 0 4px 12px rgba(162,28,175,0.25);">
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

    // --- Theme Switcher Logic ---
    function toggleTheme() {
        const newTheme = state.theme === 'light' ? 'dark' : 'light';
        state.theme = newTheme;
        
        // Update DOM attributes
        document.documentElement.setAttribute('data-theme', newTheme);
        
        console.log(`Setting application theme to: ${newTheme}`);

        // Update MapLibre style JSON seamlessly
        if (state.map) {
            state.map.setStyle(basemaps[newTheme]);
            
            // Re-configure sources & layers upon basemap style load
            state.map.once('style.load', () => {
                console.log("Vector basemap style applied.");
                setupMapLayers();
                
                // If we aren't on neighborhoods layer, make layer faintly visible & redraw active layer markers
                if (state.activeLayer !== 'neighborhoods') {
                    state.map.setPaintProperty('neighborhood-fills', 'fill-opacity', 0.02);
                    state.map.setPaintProperty('neighborhood-borders', 'line-opacity', 0.15);
                    
                    // Re-render markers (to ensure pins are redrawn with proper theme contexts)
                    clearMarkers();
                    renderLayerMarkers(state.activeLayer);
                }
            });
        }
    }

    // --- UI Listeners Binding ---
    function bindUIEvents() {
        // Theme switch click
        const themeBtn = document.getElementById('theme-toggle');
        themeBtn.addEventListener('click', toggleTheme);

        // About modal trigger
        const aboutBtn = document.getElementById('about-btn');
        const modal = document.getElementById('about-modal');
        const modalClose = document.getElementById('modal-close');

        aboutBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            refreshIcons();
        });

        modalClose.addEventListener('click', () => {
            modal.classList.add('hidden');
        });

        // Close modal on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });

        // Dynamic layer switches binding
        const layerButtons = document.querySelectorAll('.layer-btn');
        layerButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
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
