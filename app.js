/* 
   SF Good Neighbor Map - Application Orchestrator
   Powered by Mapbox GL JS and Neighborhood Groups Data from data/groups_data.json
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
        allGroups: [],          // Raw array of all 132 groups from groups_data.json
        groupsByNeighborhood: {}, // Map of normalized neighborhood -> list of groups
        neighborhoodNames: [],  // Sorted list of unique neighborhood names

        // Map elements
        map: null,
        neighborhoodLayerId: '8103bc36377890461547', // Layer in Mapbox Style
        hoveredFeature: null,
        lockedNeighborhood: null, // Track clicked neighborhood to persist sidebar
        hoverPopup: null,
        lockedPopup: null,
        searchQuery: ''
    };

    // Mapbox Configuration
    const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoiaGlsZHlzZiIsImEiOiJjbXJtZGlyejAzMXBwMnduOXh2anh5b3gzIn0.wYUboFNB3ng9zkGxk_W7Xg';

    // Draft Styling Feature Flag
    let MAPBOX_STYLE_URL = 'mapbox://styles/hildysf/cmrxkca9b00bt01rjhzeccw6f';
    if (isFeatureEnabled('draft')) {
        MAPBOX_STYLE_URL += '/draft';
    }
    console.log('Mapbox URL Loaded', MAPBOX_STYLE_URL);

    // --- Normalization Helpers ---
    function normalizeNeighborhoodName(name) {
        if (!name) return '';
        return String(name)
            .trim()
            .toLowerCase()
            .replace(/^st\.\s+/i, 'saint ')
            .replace(/^st\s+/i, 'saint ')
            .replace(/['’]/g, '')
            .replace(/\s*\/\s*/g, '/')
            .replace(/\s+/g, ' ');
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function isInvalidInfo(str) {
        if (!str) return true;
        const s = str.trim().toLowerCase();
        return s === 'not found' || s === 'not listed' || s === 'none' || s === 'n/a' || s === 'null' || s === '';
    }

    function extractUrl(str) {
        if (!str) return null;
        const match = str.match(/https?:\/\/[^\s]+/i);
        return match ? match[0] : null;
    }

    function getTagClass(label) {
        if (!label) return 'tag-resident';
        const l = label.toLowerCase();
        if (l.includes('merchant') && l.includes('resident')) return 'tag-merchant-resident';
        if (l.includes('merchant') || l.includes('business')) return 'tag-merchant';
        return 'tag-resident';
    }

    // Dynamic Icon Refreshing for dynamically injected markup
    function refreshIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    function getGroupsForNeighborhood(name) {
        if (!name) return [];
        const norm = normalizeNeighborhoodName(name);
        return state.groupsByNeighborhood[norm] || [];
    }

    // --- Lock & Unlock State Handlers ---
    function lockNeighborhood(name, lngLat) {
        state.lockedNeighborhood = name;

        // Clear hover states and hover popup
        if (state.hoveredFeature && state.hoveredFeature.id !== undefined && state.map) {
            try {
                state.map.setFeatureState(
                    { source: state.hoveredFeature.source, sourceLayer: state.hoveredFeature.sourceLayer, id: state.hoveredFeature.id },
                    { state: false, hover: false }
                );
            } catch (err) {}
            state.hoveredFeature = null;
        }

        if (state.hoverPopup) {
            state.hoverPopup.remove();
        }

        // Display locked neighborhood in the sidebar
        showNeighborhoodSidebar(name);

        // Show locked popup at clicked position
        if (lngLat && state.map) {
            const groups = getGroupsForNeighborhood(name);
            const count = groups.length;
            const countStr = count > 0 ? `${count} Group${count === 1 ? '' : 's'}` : 'No groups registered';

            if (!state.lockedPopup) {
                state.lockedPopup = new mapboxgl.Popup({
                    closeButton: true,
                    closeOnClick: false,
                    offset: 15
                });

                state.lockedPopup.on('close', () => {
                    if (state.lockedNeighborhood) {
                        unlockNeighborhood();
                    }
                });
            }

            state.lockedPopup
                .setLngLat(lngLat)
                .setHTML(`
                    <div class="popup-title">${escapeHtml(name)}</div>
                    <div class="popup-subtitle">${countStr}</div>
                `)
                .addTo(state.map);
        }
    }

    function unlockNeighborhood() {
        state.lockedNeighborhood = null;

        if (state.hoveredFeature && state.hoveredFeature.id !== undefined && state.map) {
            try {
                state.map.setFeatureState(
                    { source: state.hoveredFeature.source, sourceLayer: state.hoveredFeature.sourceLayer, id: state.hoveredFeature.id },
                    { state: false, hover: false }
                );
            } catch (err) {}
            state.hoveredFeature = null;
        }

        if (state.hoverPopup) {
            state.hoverPopup.remove();
        }
        if (state.lockedPopup) {
            state.lockedPopup.remove();
        }

        refreshSidebar();
    }

    // --- Dynamic Templates for details-panel ---
    const templates = {
        // Welcoming card
        welcome: () => {
            const totalGroups = state.allGroups.length;
            const totalNeighborhoods = state.neighborhoodNames.length;

            return `
                <div class="welcome-card">
                    <div class="welcome-icon">
                        <i data-lucide="navigation"></i>
                    </div>
                    <h3>Explore San Francisco</h3>
                    <p>San Francisco has over ${totalGroups} active neighborhood associations, merchant alliances, and community organizations across ${totalNeighborhoods} neighborhoods.</p>
                    <p class="welcome-hint">Hover over or click any neighborhood boundary on the map to view its active groups, regular meeting times, next upcoming meetings, and direct contact details.</p>
                </div>

                <div class="sidebar-search-box">
                    <div class="search-input-wrapper">
                        <i data-lucide="search" class="search-icon"></i>
                        <input 
                            type="text" 
                            id="sidebar-search-input" 
                            class="sidebar-search-input" 
                            placeholder="Search groups or neighborhoods..." 
                            value="${escapeHtml(state.searchQuery)}"
                        />
                        ${state.searchQuery ? `<button id="search-clear-btn" class="search-clear-btn" aria-label="Clear search"><i data-lucide="x"></i></button>` : ''}
                    </div>
                </div>

                ${renderDirectoryList()}
            `;
        },

        // Neighborhood detail view
        neighborhood: (name, groups) => {
            const count = groups ? groups.length : 0;

            let colloquialSub = '';
            if (groups && groups.length > 0) {
                const colloquials = [...new Set(groups.map(g => g['Neighborhood (what residents would call it)']).filter(c => c && !isInvalidInfo(c) && !c.toLowerCase().startsWith('many') && c.toLowerCase() !== name.toLowerCase()))];
                if (colloquials.length > 0) {
                    colloquialSub = `<div class="colloquial-note"><i data-lucide="info" style="width:12px; height:12px; display:inline; vertical-align:middle; margin-right:4px;"></i>Also known locally as: <strong>${escapeHtml(colloquials.join(', '))}</strong></div>`;
                }
            }

            let groupsHtml = '<div class="no-data-msg">No neighborhood groups registered in this area yet.</div>';
            if (count > 0) {
                groupsHtml = groups.map(g => renderGroupCard(g)).join('');
            }

            return `
                <div class="neighborhood-title-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 8px;">
                        <h3>${escapeHtml(name)}</h3>
                        <button id="close-neighborhood-btn" class="close-card-btn" aria-label="Close" title="Return to overview">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                    <span class="stat-area"><i data-lucide="map-pin" style="width:13px; height:13px; display:inline; vertical-align:middle; margin-right:4px;"></i>San Francisco Neighborhood</span>
                    ${colloquialSub}
                </div>

                <div class="entity-list-section">
                    <h4>Neighborhood Groups (${count})</h4>
                    ${groupsHtml}
                </div>
            `;
        }
    };

    function renderGroupCard(g) {
        const name = g['Name of Neighborhood Group'] || 'Community Group';
        const label = g['Resident/ Business label'] || 'Resident';
        const tagClass = getTagClass(label);
        const desc = g['Description'] || '';
        const regMeeting = (g['Regular meeting time'] || '').trim();
        const nextMeeting = (g['Next meeting'] || '').trim();
        const website = (g['Website'] || '').trim();
        const email = (g['Email'] || '').trim();

        // Meeting details
        let meetingsHtml = '';

        if (!isInvalidInfo(nextMeeting)) {
            meetingsHtml += `
                <div class="entity-info-item">
                    <i data-lucide="calendar-check"></i>
                    <span><strong>Next Meeting:</strong> ${escapeHtml(nextMeeting)}</span>
                </div>
            `;
        }

        if (!isInvalidInfo(regMeeting)) {
            const meetingUrl = extractUrl(regMeeting);
            if (meetingUrl) {
                meetingsHtml += `
                    <div class="entity-info-item">
                        <i data-lucide="calendar"></i>
                        <span><strong>Schedule:</strong> <a href="${escapeHtml(meetingUrl)}" target="_blank" rel="noopener noreferrer" class="meeting-url-link">View Meeting Calendar <i data-lucide="external-link"></i></a></span>
                    </div>
                `;
            } else {
                meetingsHtml += `
                    <div class="entity-info-item">
                        <i data-lucide="clock"></i>
                        <span><strong>Regular Meetings:</strong> ${escapeHtml(regMeeting)}</span>
                    </div>
                `;
            }
        }

        // Actions
        let actionsHtml = '';
        const websiteUrl = extractUrl(website);
        if (websiteUrl) {
            actionsHtml += `
                <a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer" class="entity-link entity-link--primary">
                    <i data-lucide="globe"></i>
                    <span>Website</span>
                </a>
            `;
        }

        if (!isInvalidInfo(email)) {
            if (email.includes('@')) {
                actionsHtml += `
                    <a href="mailto:${escapeHtml(email)}" class="entity-link">
                        <i data-lucide="mail"></i>
                        <span>Email</span>
                    </a>
                `;
            } else {
                const contactUrl = extractUrl(email);
                if (contactUrl) {
                    actionsHtml += `
                        <a href="${escapeHtml(contactUrl)}" target="_blank" rel="noopener noreferrer" class="entity-link">
                            <i data-lucide="send"></i>
                            <span>Contact Form</span>
                        </a>
                    `;
                }
            }
        }

        return `
            <div class="entity-card">
                <div class="entity-card-header">
                    <h5 class="entity-name">${escapeHtml(name)}</h5>
                    <span class="entity-tag ${tagClass}">${escapeHtml(label)}</span>
                </div>
                ${desc ? `<p class="entity-desc">${escapeHtml(desc)}</p>` : ''}
                ${meetingsHtml ? `<div class="entity-meetings-container">${meetingsHtml}</div>` : ''}
                ${actionsHtml ? `<div class="entity-actions">${actionsHtml}</div>` : ''}
            </div>
        `;
    }

    function renderDirectoryList() {
        const query = state.searchQuery.trim().toLowerCase();

        if (query) {
            const matchedGroups = state.allGroups.filter(g => {
                const name = (g['Name of Neighborhood Group'] || '').toLowerCase();
                const desc = (g['Description'] || '').toLowerCase();
                const nh = (g['Neighborhood (FOR ENG)'] || '').toLowerCase();
                const colloquial = (g['Neighborhood (what residents would call it)'] || '').toLowerCase();
                return name.includes(query) || desc.includes(query) || nh.includes(query) || colloquial.includes(query);
            });

            if (matchedGroups.length === 0) {
                return `<div class="no-data-msg">No neighborhood groups match "<strong>${escapeHtml(state.searchQuery)}</strong>"</div>`;
            }

            return `
                <div class="entity-list-section" style="margin-top: 20px;">
                    <h4>Search Results (${matchedGroups.length})</h4>
                    ${matchedGroups.map(g => renderGroupCard(g)).join('')}
                </div>
            `;
        }

        // Neighborhood directory list
        return `
            <div class="neighborhood-directory-section">
                <h4>Neighborhood Directory</h4>
                <div class="neighborhood-directory-list">
                    ${state.neighborhoodNames.map(name => {
                        const groups = getGroupsForNeighborhood(name);
                        return `
                            <button class="neighborhood-dir-item" data-neighborhood="${escapeHtml(name)}">
                                <span class="nh-name">${escapeHtml(name)}</span>
                                <span class="nh-count">${groups.length}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // --- Data loading & initialization ---
    async function loadData() {
        console.log("Loading groups data from data/groups_data.json...");

        try {
            const response = await fetch('data/groups_data.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const rawSheetsData = data.sheets_data || [];

            state.allGroups = rawSheetsData;

            // Index groups by normalized neighborhood names
            const nhSet = new Set();

            rawSheetsData.forEach(item => {
                const engNh = item['Neighborhood (FOR ENG)'] || '';
                const parts = engNh.split(',');

                parts.forEach(part => {
                    const rawName = part.trim();
                    if (!rawName) return;

                    nhSet.add(rawName);

                    const norm = normalizeNeighborhoodName(rawName);
                    if (!state.groupsByNeighborhood[norm]) {
                        state.groupsByNeighborhood[norm] = [];
                    }
                    state.groupsByNeighborhood[norm].push(item);
                });
            });

            state.neighborhoodNames = Array.from(nhSet).sort((a, b) => a.localeCompare(b));

            console.log(`Successfully loaded ${state.allGroups.length} groups across ${state.neighborhoodNames.length} neighborhoods.`);

            // Update header badge
            const layerBadge = document.getElementById('layer-badge');
            if (layerBadge) {
                layerBadge.textContent = `${state.allGroups.length} Groups`;
            }

            initializeMap();

        } catch (error) {
            console.error("Error loading application data:", error);
            document.getElementById('details-content').innerHTML = `
                <div class="welcome-card" style="border-color: #ef4444;">
                    <div class="welcome-icon" style="background-color: #fee2e2; color: #ef4444;">
                        <i data-lucide="alert-triangle"></i>
                    </div>
                    <h3>Error Loading Data</h3>
                    <p>We encountered an issue reading data/groups_data.json.</p>
                    <p class="welcome-hint">Please verify that data/groups_data.json exists and is valid JSON.</p>
                </div>
            `;
            refreshIcons();
        }
    }

    // --- Map Initialization ---
    function initializeMap() {
        console.log("Initializing Mapbox GL Map...");

        mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

        // Custom hover popup instance (no close button)
        state.hoverPopup = new mapboxgl.Popup({
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

        // Mouse Move over neighborhood polygons
        map.on('mousemove', layerId, (e) => {
            // When a neighborhood is locked, completely disable hover preview and popups
            if (state.lockedNeighborhood) {
                map.getCanvas().style.cursor = 'pointer';
                return;
            }

            if (e.features && e.features.length > 0) {
                map.getCanvas().style.cursor = 'pointer';
                const feature = e.features[0];
                const nhName = feature.properties && (feature.properties.name || feature.properties.NAME || feature.properties.nhood);

                if (!nhName) return;

                const featureKey = feature.id !== undefined ? feature.id : nhName;

                // Update highlight state
                if (!state.hoveredFeature || state.hoveredFeature.key !== featureKey) {
                    if (state.hoveredFeature && state.hoveredFeature.id !== undefined) {
                        try {
                            map.setFeatureState(
                                { source: state.hoveredFeature.source, sourceLayer: state.hoveredFeature.sourceLayer, id: state.hoveredFeature.id },
                                { state: false, hover: false }
                            );
                        } catch (err) {}
                    }

                    state.hoveredFeature = {
                        key: featureKey,
                        id: feature.id,
                        source: feature.source,
                        sourceLayer: feature.sourceLayer
                    };

                    if (feature.id !== undefined) {
                        try {
                            map.setFeatureState(
                                { source: feature.source, sourceLayer: feature.sourceLayer, id: feature.id },
                                { state: true, hover: true }
                            );
                        } catch (err) {}
                    }

                    // Show neighborhood in the sidebar on hover
                    showNeighborhoodSidebar(nhName);
                }

                // Show floating hover popup at mouse position
                if (state.hoverPopup) {
                    const groups = getGroupsForNeighborhood(nhName);
                    const count = groups.length;
                    const countStr = count > 0 ? `${count} Group${count === 1 ? '' : 's'}` : 'No groups registered';

                    state.hoverPopup
                        .setLngLat(e.lngLat)
                        .setHTML(`
                            <div class="popup-title">${escapeHtml(nhName)}</div>
                            <div class="popup-subtitle">${countStr}</div>
                        `)
                        .addTo(map);
                }
            }
        });

        // Mouse leaves neighborhood layer
        map.on('mouseleave', layerId, () => {
            // When locked, do not reset view on mouseleave
            if (state.lockedNeighborhood) {
                return;
            }

            map.getCanvas().style.cursor = '';

            if (state.hoveredFeature && state.hoveredFeature.id !== undefined) {
                try {
                    map.setFeatureState(
                        { source: state.hoveredFeature.source, sourceLayer: state.hoveredFeature.sourceLayer, id: state.hoveredFeature.id },
                        { state: false, hover: false }
                    );
                } catch (err) {}
                state.hoveredFeature = null;
            }

            if (state.hoverPopup) {
                state.hoverPopup.remove();
            }
            refreshSidebar();
        });

        // Single unified click handler on map canvas
        map.on('click', (e) => {
            // If already locked, clicking anywhere on the map unlocks it!
            if (state.lockedNeighborhood) {
                unlockNeighborhood();
                return;
            }

            // If not locked, check if click hit a neighborhood polygon to lock it
            const features = map.queryRenderedFeatures(e.point, { layers: [layerId] });
            if (features && features.length > 0) {
                const nhName = features[0].properties && (features[0].properties.name || features[0].properties.NAME || features[0].properties.nhood);
                if (nhName) {
                    lockNeighborhood(nhName, e.lngLat);
                }
            }
        });
    }

    // --- Helper: Populate Neighborhood details into Sidebar ---
    function showNeighborhoodSidebar(name) {
        const groups = getGroupsForNeighborhood(name);
        const detailsContainer = document.getElementById('details-content');

        detailsContainer.innerHTML = templates.neighborhood(name, groups);
        refreshIcons();

        // Close button listener in sidebar card to unlock and return to hover / welcome
        const closeBtn = document.getElementById('close-neighborhood-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                unlockNeighborhood();
            });
        }
    }

    // --- Refresh/Load Sidebar View ---
    function refreshSidebar() {
        const container = document.getElementById('details-content');
        container.innerHTML = templates.welcome();
        refreshIcons();
        bindSidebarEvents();
    }

    function bindSidebarEvents() {
        // Search Input Handling
        const searchInput = document.getElementById('sidebar-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                state.searchQuery = e.target.value;
                refreshSidebar();
                const newInput = document.getElementById('sidebar-search-input');
                if (newInput) {
                    newInput.focus();
                    newInput.setSelectionRange(newInput.value.length, newInput.value.length);
                }
            });
        }

        const clearBtn = document.getElementById('search-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                state.searchQuery = '';
                refreshSidebar();
            });
        }

        // Neighborhood Directory Item Click -> Lock neighborhood
        const dirButtons = document.querySelectorAll('.neighborhood-dir-item');
        dirButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const nhName = btn.getAttribute('data-neighborhood');
                if (nhName) {
                    lockNeighborhood(nhName, null);
                }
            });
        });
    }

    // --- UI Listeners Binding ---
    function bindUIEvents() {
        // Mobile hamburger menu toggle
        const menuToggle = document.getElementById('mobile-menu-toggle');
        const mobileOverlay = document.getElementById('mobile-nav-overlay');
        const mobileNavTrack = document.getElementById('mobile-nav-track');
        const folderToggle = mobileOverlay.querySelector('.mobile-nav-folder-toggle');
        const backButton = mobileOverlay.querySelector('.mobile-nav-back');

        const closeMobileMenu = () => {
            menuToggle.classList.remove('open');
            mobileOverlay.classList.remove('open');
            menuToggle.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('mobile-nav-locked');
            mobileNavTrack.classList.remove('show-about');
            folderToggle.setAttribute('aria-expanded', 'false');
        };

        menuToggle.addEventListener('click', () => {
            const isOpen = menuToggle.classList.toggle('open');
            mobileOverlay.classList.toggle('open', isOpen);
            menuToggle.setAttribute('aria-expanded', String(isOpen));
            document.body.classList.toggle('mobile-nav-locked', isOpen);
            if (!isOpen) {
                mobileNavTrack.classList.remove('show-about');
                folderToggle.setAttribute('aria-expanded', 'false');
            }
        });

        mobileOverlay.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', closeMobileMenu);
        });

        folderToggle.addEventListener('click', () => {
            mobileNavTrack.classList.add('show-about');
            folderToggle.setAttribute('aria-expanded', 'true');
        });

        backButton.addEventListener('click', () => {
            mobileNavTrack.classList.remove('show-about');
            folderToggle.setAttribute('aria-expanded', 'false');
        });
    }

    // --- Start Application Ingestion ---
    bindUIEvents();
    loadData();
});
