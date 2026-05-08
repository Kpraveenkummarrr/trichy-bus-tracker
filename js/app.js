// ============================================
// TRICHY BUS TRACKER - MAIN APP
// ============================================

let currentTab = 'search';
let selectedBusId = null;
let isListening = false;

// Switch sidebar tabs
function switchTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.sidebar-tab').forEach(btn => btn.classList.remove('active'));
    event.target.closest('.sidebar-tab').classList.add('active');
    
    // Show tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tab + 'Tab').classList.add('active');
    
    // Load tab-specific content
    if (tab === 'routes') loadRoutes();
    if (tab === 'tracking') loadTrackingBusList();
}

// Search buses
function searchBuses(event) {
    event.preventDefault();
    
    const source = document.getElementById('sourceInput').value.trim();
    const destination = document.getElementById('destinationInput').value.trim();
    
    if (!source || !destination) {
        alert('Please enter both source and destination');
        return;
    }
    
    const sourceStop = trichyData.stops.find(s => 
        s.name.toLowerCase().includes(source.toLowerCase()) ||
        s.tamil.includes(source)
    );
    
    const destStop = trichyData.stops.find(s => 
        s.name.toLowerCase().includes(destination.toLowerCase()) ||
        s.tamil.includes(destination)
    );
    
    if (!sourceStop || !destStop) {
        alert('Stop not found. Please select from suggestions.');
        return;
    }
    
    // Find routes that cover both stops
    const matchingRoutes = trichyData.routes.filter(route => {
        const stops = route.stops;
        const sourceIndex = stops.indexOf(sourceStop.id);
        const destIndex = stops.indexOf(destStop.id);
        return sourceIndex !== -1 && destIndex !== -1 && destIndex > sourceIndex;
    });
    
    // Display results
    const resultsDiv = document.getElementById('searchResults');
    
    if (matchingRoutes.length === 0) {
        resultsDiv.innerHTML = `
            <div class="text-center py-4">
                <i class="bi bi-emoji-frown display-4 text-muted"></i>
                <p class="mt-2 text-muted">No direct buses found. Try different stops.</p>
            </div>
        `;
        return;
    }
    
    resultsDiv.innerHTML = `
        <h6 class="fw-bold mb-3">
            🚌 ${matchingRoutes.length} bus(es) found
            <small class="text-muted">${sourceStop.name} → ${destStop.name}</small>
        </h6>
        ${matchingRoutes.map(route => {
            const sourceIndex = route.stops.indexOf(sourceStop.id);
            const destIndex = route.stops.indexOf(destStop.id);
            const stopsBetween = destIndex - sourceIndex;
            const fare = Math.round(10 + stopsBetween * 5);
            
            return `
                <div class="bus-item" onclick="showBusDetails('${route.number}')">
                    <div class="bus-header">
                        <span class="bus-route-number">Route ${route.number}</span>
                        <span class="crowd-indicator crowd-${route.crowdLevel}">
                            👥 ${route.crowdLevel.toUpperCase()}
                        </span>
                    </div>
                    <div class="mb-2" style="font-size: 0.9rem;">
                        <strong>${route.name}</strong>
                    </div>
                    <div class="bus-details">
                        <span><i class="bi bi-clock"></i> ${route.frequency}</span>
                        <span><i class="bi bi-tag"></i> ₹${fare}</span>
                        <span><i class="bi bi-bus"></i> ${route.type}</span>
                    </div>
                    <div class="route-path mt-2">
                        <div>🚏</div>
                        <div class="route-stops">
                            ${route.stops.slice(sourceIndex, destIndex + 1).map((stopId, idx) => {
                                const stop = trichyData.stops.find(s => s.id === stopId);
                                return `
                                    <div class="route-stop">
                                        <span class="stop-dot ${idx === 0 ? 'current' : idx === route.stops.length - 1 ? 'upcoming' : ''}"></span>
                                        <span>${stop.name}</span>
                                        ${idx < (destIndex - sourceIndex) ? '<div style="border-left: 1px dashed #ccc; height: 12px; margin-left: 3px;"></div>' : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    <div class="mt-2 text-end">
                        <button class="btn btn-sm btn-outline-primary rounded-pill" onclick="event.stopPropagation(); trackRoute('${route.number}')">
                            <i class="bi bi-geo-alt"></i> Track Live
                        </button>
                        <button class="btn btn-sm btn-success rounded-pill" onclick="event.stopPropagation(); quickBook('${route.number}', ${sourceStop.id}, ${destStop.id})">
                            <i class="bi bi-ticket"></i> Book ₹${fare}
                        </button>
                    </div>
                </div>
            `;
        }).join('')}
    `;
    
    // Center map on source stop
    map.setView([sourceStop.lat, sourceStop.lng], 14);
}

// Show bus details in modal
function showBusDetails(routeNumber) {
    const route = trichyData.routes.find(r => r.number === routeNumber);
    if (!route) return;
    
    const modalTitle = document.getElementById('busModalTitle');
    const modalBody = document.getElementById('busModalBody');
    
    modalTitle.innerHTML = `🚌 Route ${route.number} - ${route.name}`;
    
    modalBody.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6 class="fw-bold">Route Details</h6>
                <p><strong>Type:</strong> ${route.type}</p>
                <p><strong>Frequency:</strong> Every ${route.frequency}</p>
                <p><strong>Hours:</strong> ${route.operatingHours}</p>
                <p><strong>Fare Range:</strong> ${route.fare}</p>
                <p>
                    <strong>Status:</strong>
                    <span class="crowd-indicator crowd-${route.crowdLevel}">
                        ${route.crowdLevel.toUpperCase()} CROWD
                    </span>
                </p>
            </div>
            <div class="col-md-6">
                <h6 class="fw-bold">Stops</h6>
                <div class="route-stops">
                    ${route.stops.map((stopId, idx) => {
                        const stop = trichyData.stops.find(s => s.id === stopId);
                        return `
                            <div class="route-stop">
                                <span class="stop-dot ${idx === 0 ? 'current' : ''}"></span>
                                <span>${stop.name}</span>
                                ${idx < route.stops.length - 1 ? '<div style="border-left: 1px dashed #ccc; height: 15px; margin-left: 3px;"></div>' : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
        <div class="mt-3">
            <button class="btn btn-primary rounded-pill" onclick="trackRoute('${route.number}')">
                <i class="bi bi-geo-alt"></i> Show on Map
            </button>
        </div>
    `;
    
    new bootstrap.Modal(document.getElementById('busDetailModal')).show();
}

// Quick book ticket
function quickBook(routeNumber, sourceId, destId) {
    const route = trichyData.routes.find(r => r.number === routeNumber);
    const source = trichyData.stops.find(s => s.id === sourceId);
    const dest = trichyData.stops.find(s => s.id === destId);
    const fare = Math.round(10 + Math.abs(route.stops.indexOf(destId) - route.stops.indexOf(sourceId)) * 5);
    
    const bookingBody = document.getElementById('bookingModalBody');
    bookingBody.innerHTML = `
        <div class="ticket-visual mb-3">
            <h5 class="mb-3">🎫 TN Bus E-Ticket</h5>
            <div class="row">
                <div class="col-8">
                    <p class="mb-1"><strong>Route:</strong> ${route.number} - ${route.name}</p>
                    <p class="mb-1"><strong>From:</strong> ${source.name}</p>
                    <p class="mb-1"><strong>To:</strong> ${dest.name}</p>
                    <p class="mb-1"><strong>Type:</strong> ${route.type}</p>
                    <h4 class="mt-2">₹${fare}</h4>
                </div>
                <div class="col-4 text-center">
                    <div class="qr-code">
                        <div style="width: 80px; height: 80px; background: #000; margin: 0 auto;"></div>
                    </div>
                </div>
            </div>
        </div>
        <div class="mb-3">
            <label class="form-label">Passenger Name</label>
            <input type="text" class="form-control" placeholder="Enter name">
        </div>
        <div class="mb-3">
            <label class="form-label">Phone Number</label>
            <input type="tel" class="form-control" placeholder="+91" value="+91 ">
        </div>
        <div class="mb-3">
            <label class="form-label">Payment Method</label>
            <select class="form-select">
                <option>UPI (Google Pay / PhonePe)</option>
                <option>Credit/Debit Card</option>
                <option>Net Banking</option>
                <option>Cash (Pay at Bus)</option>
            </select>
        </div>
        <button class="btn btn-success w-100 rounded-pill btn-lg" onclick="confirmBooking()">
            <i class="bi bi-shield-check"></i> Pay ₹${fare} & Confirm
        </button>
    `;
    
    new bootstrap.Modal(document.getElementById('bookingModal')).show();
}

// Confirm booking
function confirmBooking() {
    alert('✅ Booking Confirmed!\n\nYour e-ticket has been sent to your phone.\nHappy Journey! 🚌');
    bootstrap.Modal.getInstance(document.getElementById('bookingModal')).hide();
}

// Track specific bus
function trackBus(busId) {
    const bus = activeBusDetails[busId];
    if (!bus) return;
    
    map.setView([bus.lat, bus.lng], 16);
    busMarkers[busId].openPopup();
    
    // Switch to tracking tab
    const trackingTab = document.querySelector('[onclick="switchTab(\'tracking\')"]');
    trackingTab.click();
}

// Track route on map
function trackRoute(routeNumber) {
    const route = trichyData.routes.find(r => r.number === routeNumber);
    if (!route) return;
    
    const firstStop = trichyData.stops.find(s => s.id === route.stops[0]);
    map.setView([firstStop.lat, firstStop.lng], 14);
    
    // Highlight route
    document.querySelectorAll('.leaflet-interactive').forEach(el => {
        el.style.opacity = '0.3';
    });
    
    setTimeout(() => {
        document.querySelectorAll('.leaflet-interactive').forEach(el => {
            el.style.opacity = '1';
        });
    }, 2000);
}

// Load routes list
function loadRoutes() {
    const routesList = document.getElementById('routesList');
    routesList.innerHTML = trichyData.routes.map(route => `
        <div class="bus-item" onclick="showBusDetails('${route.number}')">
            <div class="bus-header">
                <span class="bus-route-number" style="background: ${route.color}">${route.number}</span>
                <span class="bus-eta">Every ${route.frequency}</span>
            </div>
            <strong>${route.name}</strong>
            <div class="bus-details mt-2">
                <span><i class="bi bi-bus"></i> ${route.type}</span>
                <span><i class="bi bi-clock"></i> ${route.operatingHours}</span>
            </div>
            <div class="mt-1">
                <span class="crowd-indicator crowd-${route.crowdLevel}">👥 ${route.crowdLevel}</span>
                <span class="ms-2">${route.fare}</span>
            </div>
        </div>
    `).join('');
}

// Load tracking bus list
function loadTrackingBusList() {
    const trackingList = document.getElementById('trackingBusList');
    const buses = Object.values(activeBusDetails);
    
    trackingList.innerHTML = buses.map(bus => `
        <div class="bus-item" onclick="trackBus('${bus.id}')">
            <div class="bus-header">
                <span class="bus-route-number" style="background: ${bus.color}">${bus.routeNumber}</span>
                <span class="crowd-indicator crowd-${bus.crowdLevel}">👥 ${bus.crowdLevel}</span>
            </div>
            <div class="mb-1"><strong>${bus.routeName}</strong></div>
            <div class="bus-details">
                <span>📍 ${bus.currentStop.name}</span>
                <span>⏱️ ${bus.eta} min</span>
            </div>
            ${bus.isDelayed ? `<div class="text-danger small mt-1">⚠️ Delayed ${bus.delayMinutes} min</div>` : ''}
        </div>
    `).join('');
}

// Quick select stop
function quickSelect(stopName) {
    const sourceInput = document.getElementById('sourceInput');
    const destInput = document.getElementById('destinationInput');
    
    if (!sourceInput.value) {
        sourceInput.value = stopName;
    } else if (!destInput.value) {
        destInput.value = stopName;
        document.getElementById('searchForm')?.dispatchEvent(new Event('submit'));
    }
}

// Swap source and destination
function swapStops() {
    const sourceInput = document.getElementById('sourceInput');
    const destInput = document.getElementById('destinationInput');
    const temp = sourceInput.value;
    sourceInput.value = destInput.value;
    destInput.value = temp;
}

// Voice search simulation
function startVoiceSearch(type) {
    const btn = event.target.closest('.voice-search-btn');
    
    if (isListening) {
        btn.classList.remove('listening');
        isListening = false;
        return;
    }
    
    btn.classList.add('listening');
    isListening = true;
    
    // Simulate voice recognition
    setTimeout(() => {
        const input = document.getElementById(type + 'Input');
        const randomStop = trichyData.stops[Math.floor(Math.random() * trichyData.stops.length)];
        input.value = randomStop.name;
        btn.classList.remove('listening');
        isListening = false;
        
        // Show brief notification
        showToast(`🎤 Voice detected: ${randomStop.name}`);
    }, 1500);
}

// Toast notification
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #1A1A2E;
        color: white;
        padding: 12px 24px;
        border-radius: 25px;
        font-size: 0.9rem;
        z-index: 10000;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        animation: slideUp 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Language switch
function switchLanguage(lang) {
    document.querySelectorAll('.language-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    if (lang === 'ta') {
        showToast('தமிழ் மொழி தேர்ந்தெடுக்கப்பட்டது');
    } else {
        showToast('English language selected');
    }
}

// Initialize autocomplete
document.addEventListener('DOMContentLoaded', function() {
    setupAutocomplete('sourceInput', 'sourceSuggestions');
    setupAutocomplete('destinationInput', 'destinationSuggestions');
    
    // Load initial routes
    loadRoutes();
    loadTrackingBusList();
});

// Setup autocomplete
function setupAutocomplete(inputId, suggestionsId) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);
    
    if (!input || !suggestions) return;
    
    input.addEventListener('input', function() {
        const value = this.value.toLowerCase();
        suggestions.innerHTML = '';
        
        if (value.length > 0) {
            const filtered = trichyData.stops.filter(stop => 
                stop.name.toLowerCase().includes(value) ||
                stop.tamil.includes(value)
            );
            
            if (filtered.length > 0) {
                filtered.forEach(stop => {
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.innerHTML = `
                        <i class="bi bi-geo-alt"></i>
                        <span>${stop.name}</span>
                        <small>${stop.landmark}</small>
                    `;
                    div.addEventListener('click', function() {
                        input.value = stop.name;
                        suggestions.classList.remove('show');
                    });
                    suggestions.appendChild(div);
                });
                suggestions.classList.add('show');
            } else {
                suggestions.classList.remove('show');
            }
        } else {
            suggestions.classList.remove('show');
        }
    });
    
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.classList.remove('show');
        }
    });
}