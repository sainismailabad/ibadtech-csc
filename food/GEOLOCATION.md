# Geolocation Implementation

## Browser Geolocation API Usage

The application uses the browser's Geolocation API to capture customer delivery coordinates during checkout.

### Implementation in customer.js

```javascript
function getLocation() {
    const status = document.getElementById('location-status');
    
    if (!navigator.geolocation) {
        status.textContent = 'Geolocation is not supported by this browser';
        return;
    }

    status.innerHTML = '<span class="text-primary">Getting location...</span>';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            document.getElementById('checkout-lat').value = position.coords.latitude;
            document.getElementById('checkout-lng').value = position.coords.longitude;
            status.innerHTML = '<span class="text-success">Location captured: ' + 
                position.coords.latitude.toFixed(4) + ', ' + position.coords.longitude.toFixed(4) + '</span>';
        },
        (error) => {
            status.innerHTML = '<span class="text-danger">Error: ' + error.message + '</span>';
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}
```

### Requirements

1. **HTTPS**: Geolocation API only works on secure contexts (HTTPS or localhost)
2. **User Permission**: Browser will prompt user to allow location access
3. **GPS/Location Services**: Device must have location services enabled

### Error Handling

- **PERMISSION_DENIED**: User blocked location access
- **POSITION_UNAVAILABLE**: Location services disabled
- **TIMEOUT**: Location request timed out

### Map Integration

Uses Leaflet.js for map rendering with OpenStreetMap tiles:

```javascript
// Initialize map
const map = L.map('map-id').setView([latitude, longitude], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

// Add marker
L.marker([latitude, longitude]).addTo(map)
    .bindPopup('Delivery Location')
    .openPopup();
```

### Testing Locally

Use Firebase emulators with HTTPS or a service like `serve -S` for local HTTPS testing.