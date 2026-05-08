// ============================================
// TRICHY MAP - LEAFLET INTEGRATION
// ============================================

let map;
let busMarkers = {};
let busLayer;
let trafficLayer;
let heatmapLayer;
let activeBusDetails = {};
let selectedRoute = null;

// Initialize Map
function initMap() {
    map = L.map('trichyMap').setView(trichyData.center, 13);
    
    // OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap | Trichy Smart Bus Tracker',
        maxZoom: 18
    }).addTo(map);
    
    // Add bus stops to map
    addBusStops();
    
    // Add route paths
    addRoutePaths();
    
    // Initialize live buses
    updateLiveBuses();
    
    // Refresh buses every 10 seconds
    setInterval(updateLiveBuses, 10000);
    
    // Center map controls
    map.addControl(L.control.zoom({ position: 'topright' }));
}

// Add bus stops as markers
function addBusStops() {
    trichyData.stops.forEach(stop => {
        const marker = L.marker([stop.lat, stop.lng], {
            icon: L.divIcon({
                html: `<div style="
                    background: white;
                    border: 2px solid #0066CC;
                    border-radius: 50%;
                    width: 16px;
                    height: 16px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                "></div>`,
                iconSize: [16, 16],
                className: ''
            })
        }).addTo(map);
        
        marker.bindPopup(`
            <div style="font-family: Poppins, sans-serif; min-width: 200px;">
                <strong style="font-size: 14px;">🚏 ${stop.name}</strong><br>
                <small style="color: #666;">${stop.tamil}</small><br>
                <small>📍 ${stop.landmark}</small><br>
                <div style="margin-top: 8px;">
                    ${stop.facilities.map(f => `<span style="background: #e0e0e0; padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-right: 4px;">${f}</span>`).join('')}
                </div>
            </div>
        `);
        
        // Store stop reference
        marker.stopData = stop;
    });
}

// Add route paths
function addRoutePaths() {
    trichyData.routes.forEach(route => {
        const coordinates = route.stops.map(stopId => {
            const stop = trichyData.stops.find(s => s.id === stopId);
            return [stop.lat, stop.lng];
        });
        
        const polyline = L.polyline(coordinates, {
            color: route.color,
            weight: 4,
            opacity: 0.6,
            dashArray: route.type.includes('Express') ? '10, 10' : null
        }).addTo(map);
        
        // Add route number label
        const midPoint = coordinates[Math.floor(coordinates.length / 2)];
        L.marker(midPoint, {
            icon: L.divIcon({
                html: `<div style="
                    background: ${route.color};
                    color: white;
                    padding: 4px 10px;
                    border-radius: 12px;
                    font-size: 11px;
                    font-weight: 700;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                    white-space: nowrap;
                ">${route.number}</div>`,
                className: ''
            })
        }).addTo(map);
        
        polyline.on('click', () => {
            showRouteDetails(route);
        });
    });
}

// Update live bus positions
function updateLiveBuses() {
    // Clear existing bus markers
    if (busLayer) {
        map.removeLayer(busLayer);
    }
    busLayer = L.layerGroup().addTo(map);
    busMarkers = {};
    
    // Generate new bus positions
    const liveBuses = trichyData.generateLiveBuses();
    activeBusDetails = {};
    
    liveBuses.forEach(bus => {
        activeBusDetails[bus.id] = bus;
        
        // Bus icon
        const icon = L.divIcon({
            html: `
                <div style="
                    background: ${bus.color};
                    color: white;
                    border-radius: 50%;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 14px;
                    border: 3px solid white;
                    box-shadow: 0 3px 12px rgba(0,0,0,0.3);
                    transform: rotate(${bus.heading}deg);
                    transition: all 0.5s;
                ">
                    🚌
                </div>
            `,
            iconSize: [36, 36],
            className: 'bus-marker'
        });
        
        const marker = L.marker([bus.lat, bus.lng], { icon }).addTo(busLayer);
        
        // Popup with bus details
        marker.bindPopup(`
            <div style="font-family: Poppins, sans-serif; min-width: 250px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="background: ${bus.color}; color: white; padding: 4px 12px; border-radius: 15px; font-weight: 700;">
                        Route ${bus.routeNumber}
                    </span>
                    <span class="live-indicator" style="font-size: 11px;">
                        <span class="live-dot"></span> LIVE
                    </span>
                </div>
                <strong>${bus.routeName}</strong><br>
                <div style="margin-top: 8px;">
                    <small>📍 Now at: <strong>${bus.currentStop.name}</strong></small><br>
                    <small>➡️ Next: ${bus.nextStop.name}</small><br>
                    <small>⏱️ ETA: <strong>${bus.eta} min</strong></small><br>
                    <small>🚦 Speed: ${bus.speed} km/h</small>
                </div>
                <div style="margin-top: 8px;">
                    <span class="crowd-indicator crowd-${bus.crowdLevel}">
                        👥 ${bus.crowdLevel.toUpperCase()}
                    </span>
                    <span style="margin-left: 8px;">${bus.passengers}/${bus.capacity}</span>
                </div>
                ${bus.isDelayed ? `<div style="color: #DC3545; margin-top: 6px; font-size: 12px;">⚠️ Delayed by ${bus.delayMinutes} min</div>` : ''}
                <div style="margin-top: 10px;">
                    <button onclick="trackBus('${bus.id}')" style="background: #0066CC; color: white; border: none; padding: 6px 16px; border-radius: 15px; font-size: 12px; cursor: pointer; margin-right: 5px;">
                        📍 Track
                    </button>
                    <button onclick="bookTicket('${bus.id}')" style="background: #28A745; color: white; border: none; padding: 6px 16px; border-radius: 15px; font-size: 12px; cursor: pointer;">
                        🎫 Book
                    </button>
                </div>
            </div>
        `);
        
        busMarkers[bus.id] = marker;
    });
    
    // Update stats
    updateStats(liveBuses);
}

// Update live statistics
function updateStats(buses) {
    document.getElementById('activeBuses').textContent = buses.length;
    document.getElementById('passengerCount').textContent = buses.reduce((sum, bus) => sum + bus.passengers, 0).toLocaleString();
    document.getElementById('delayCount').textContent = buses.filter(b => b.isDelayed).length;
    
    const onTimePercent = Math.round((1 - buses.filter(b => b.isDelayed).length / buses.length) * 100);
    document.getElementById('onTimePercent').textContent = onTimePercent + '%';
}

// Center map
function centerMap() {
    map.setView(trichyData.center, 13);
}

// Toggle traffic layer
function toggleTraffic() {
    if (trafficLayer) {
        map.removeLayer(trafficLayer);
        trafficLayer = null;
    } else {
        trafficLayer = L.layerGroup().addTo(map);
        trafficHotspots.forEach(hotspot => {
            L.circle([hotspot.lat, hotspot.lng], {
                radius: 300,
                color: hotspot.intensity === 'high' ? '#DC3545' : '#FFC107',
                fillOpacity: 0.2,
                weight: 2
            }).addTo(trafficLayer);
            
            L.marker([hotspot.lat, hotspot.lng], {
                icon: L.divIcon({
                    html: `<div style="
                        background: ${hotspot.intensity === 'high' ? '#DC3545' : '#FFC107'};
                        color: white;
                        padding: 4px 8px;
                        border-radius: 12px;
                        font-size: 10px;
                        font-weight: 700;
                    ">🚦 ${hotspot.name}</div>`,
                    className: ''
                })
            }).addTo(trafficLayer);
        });
    }
}

// Refresh buses
function refreshBuses() {
    updateLiveBuses();
    const btn = document.getElementById('refreshBtn');
    btn.style.transform = 'rotate(360deg)';
    setTimeout(() => { btn.style.transform = 'rotate(0deg)'; }, 500);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initMap);