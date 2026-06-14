// ============================================
// IBAD FOODIE - Admin Full Management Panel
// ============================================
const Admin = {
    currentUser: null,
    map: null,
    mapMarkers: [],
    allOrders: [],

    init: async function() {
        const authState = await auth.init();
        if (!authState.user || authState.role !== 'admin') {
            document.getElementById('auth-required').style.display = 'block';
            document.querySelector('main').style.display = 'none';
            return;
        }
        this.currentUser = authState.user;
        document.getElementById('admin-email').textContent = this.currentUser.email;
        this.loadDashboard();
        this.loadRestaurantFilter();
    },

    showPage: function(page) {
        document.querySelectorAll('[id$="-page"]').forEach(el => el.style.display = 'none');
        document.getElementById(`${page}-page`).style.display = 'block';
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
        document.querySelector(`[data-page="${page}"]`).classList.add('active');
        if (page === 'dashboard') this.loadDashboard();
        if (page === 'restaurants') this.loadRestaurants();
        if (page === 'customers') this.loadCustomers();
        if (page === 'orders') { this.loadRestaurantFilter(); this.loadOrders(); }
    },

    _snapArr: function(snap) {
        const r = [];
        if (snap.exists()) snap.forEach(c => r.push({ id: c.key, ...c.val() }));
        return r;
    },

    // ====== DASHBOARD ======
    loadDashboard: async function() {
        try {
            const [ords, rests, users, menus] = await Promise.all([
                db.ref('orders').once('value'),
                db.ref('restaurants').once('value'),
                db.ref('users').once('value'),
                db.ref('products').once('value')
            ]);
            const od = ords.val() || {};
            document.getElementById('admin-total-orders').textContent = Object.keys(od).length;
            document.getElementById('admin-total-restaurants').textContent = rests.exists() ? rests.numChildren() : 0;
            document.getElementById('admin-total-menu').textContent = menus.exists() ? menus.numChildren() : 0;
            
            let customers = 0, sellers = 0, revenue = 0;
            if (users.exists()) {
                users.forEach(c => {
                    if (c.val().role === 'customer') customers++;
                    if (c.val().role === 'seller') sellers++;
                });
            }
            document.getElementById('admin-total-customers').textContent = customers;
            document.getElementById('admin-total-sellers').textContent = sellers;
            
            for (const oid of Object.keys(od)) {
                revenue += od[oid].totalAmount || 0;
            }
            document.getElementById('admin-total-revenue').textContent = `₹${revenue.toFixed(2)}`;
            
            // Stats
            let pending = 0, preparing = 0, delivered = 0, cancelled = 0;
            for (const oid of Object.keys(od)) {
                const s = od[oid].status || '';
                if (s === 'Pending') pending++;
                else if (s === 'Preparing' || s === 'Shipped') preparing++;
                else if (s === 'Delivered') delivered++;
                else if (s === 'Cancelled') cancelled++;
            }
            document.getElementById('stat-pending').textContent = pending;
            document.getElementById('stat-preparing').textContent = preparing;
            document.getElementById('stat-delivered').textContent = delivered;
            document.getElementById('stat-cancelled').textContent = cancelled;
        } catch (e) { console.error(e); }
    },

    // ====== RESTAURANTS ======
    loadRestaurants: async function() {
        const tbody = document.getElementById('restaurants-table');
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
        try {
            const snap = await db.ref('restaurants').once('value');
            tbody.innerHTML = '';
            if (snap.exists()) {
                snap.forEach(c => {
                    const r = c.val();
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><img src="${r.logo || 'https://via.placeholder.com/48'}" class="rounded" width="48" height="48"> ${r.name}</td>
                        <td>${r.cuisine || 'N/A'}</td>
                        <td>⭐${r.rating || '4.0'}</td>
                        <td>${r.deliveryTime || '30'} min</td>
                        <td><span class="badge bg-success">Active</span></td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-outline-danger" onclick="Admin.removeRestaurant('${c.key}')"><i class="fas fa-trash"></i></button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
            if (!snap.exists()) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No restaurants</td></tr>';
        } catch (e) { tbody.innerHTML = `<tr><td colspan="6" class="text-danger">${e.message}</td></tr>`; }
    },

    removeRestaurant: async function(id) {
        if (confirm('Remove this restaurant and all its data?')) {
            try {
                await db.ref('restaurants/' + id).remove();
                await db.ref('sellers/' + id).remove();
                this.loadRestaurants();
            } catch (e) { alert('Error: ' + e.message); }
        }
    },

    // ====== CUSTOMERS ======
    loadCustomers: async function() {
        const tbody = document.getElementById('customers-table');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
        try {
            const snap = await db.ref('users').once('value');
            tbody.innerHTML = '';
            if (snap.exists()) {
                const promises = [];
                snap.forEach(c => {
                    if (c.val().role === 'customer') {
                        promises.push(
                            db.ref('orders').orderByChild('customerId').equalTo(c.key).once('value').then(oSnap => {
                                const orderCount = oSnap.exists() ? oSnap.numChildren() : 0;
                                const p = c.val().profile || {};
                                const tr = document.createElement('tr');
                                tr.innerHTML = `
                                    <td>${p.name || 'N/A'}</td>
                                    <td>${c.val().email || ''}</td>
                                    <td>${p.phone || 'N/A'}</td>
                                    <td>${orderCount} orders</td>
                                    <td>${p.city || 'N/A'}</td>
                                `;
                                tbody.appendChild(tr);
                            })
                        );
                    }
                });
                await Promise.all(promises);
            }
            if (tbody.children.length === 0) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No customers</td></tr>';
        } catch (e) { tbody.innerHTML = `<tr><td colspan="5" class="text-danger">${e.message}</td></tr>`; }
    },

    // ====== ORDERS ======
    loadRestaurantFilter: async function() {
        const select = document.getElementById('filter-seller');
        try {
            const snap = await db.ref('restaurants').once('value');
            select.innerHTML = '<option value="">All Restaurants</option>';
            if (snap.exists()) {
                snap.forEach(c => {
                    const r = c.val();
                    const opt = document.createElement('option');
                    opt.value = c.key; opt.textContent = r.name; select.appendChild(opt);
                });
            }
        } catch (e) { console.error(e); }
    },

    loadOrders: async function() {
        const tbody = document.getElementById('admin-orders-table');
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
        try {
            const snap = await db.ref('orders').once('value');
            const data = this._snapArr(snap);
            data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            this.allOrders = data;
            this.renderOrders(data);
        } catch (e) { tbody.innerHTML = `<tr><td colspan="8" class="text-danger">${e.message}</td></tr>`; }
    },

    renderOrders: async function(orders) {
        const tbody = document.getElementById('admin-orders-table');
        tbody.innerHTML = '';
        for (const o of orders) {
            const uSnap = await db.ref('users/' + o.customerId).once('value');
            const user = uSnap.exists() ? uSnap.val() : {};
            const profile = user.profile || {};
            const restName = o.restaurantName || 'Unknown';
            const items = o.items ? o.items.map(i => i.name + ' x' + i.qty).join(', ') : 'N/A';
            const d = o.timestamp ? new Date(o.timestamp).toLocaleDateString() : 'N/A';
            const isCancelled = o.status === 'Cancelled';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${profile.name || user.email || 'N/A'}</td>
                <td>${profile.phone || 'N/A'}</td>
                <td>${restName}</td>
                <td><small>${items}</small></td>
                <td>₹${(o.totalAmount || 0).toFixed(2)}</td>
                <td><span class="status-badge status-${o.status.toLowerCase()}">${o.status}</span></td>
                <td>${d}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-info me-1" onclick="Admin.viewLocation(${o.customerLat || 0}, ${o.customerLng || 0})"><i class="fas fa-map-marker-alt"></i></button>
                    ${!isCancelled ? `
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="Admin.updateStatus('${o.id}', '${o.status}')"><i class="fas fa-sync-alt"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="Admin.cancelOrder('${o.id}')"><i class="fas fa-ban"></i></button>
                    ` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        }
        if (orders.length === 0) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No orders</td></tr>';
    },

    filterOrders: async function() {
        if (this.allOrders.length === 0) { await this.loadOrders(); return; }
        const rid = document.getElementById('filter-seller').value;
        const status = document.getElementById('filter-status').value;
        const date = document.getElementById('filter-date').value;
        let f = this.allOrders;
        if (rid) f = f.filter(o => o.restaurantId === rid);
        if (status) f = f.filter(o => o.status === status);
        if (date) { const fd = new Date(date); f = f.filter(o => o.timestamp && new Date(o.timestamp).toDateString() === fd.toDateString()); }
        this.renderOrders(f);
    },

    updateStatus: async function(orderId, currentStatus) {
        const flow = ['Pending', 'Preparing', 'Shipped', 'Delivered'];
        const idx = flow.indexOf(currentStatus);
        const next = idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : flow[0];
        try { await db.ref('orders/' + orderId).update({ status: next }); this.loadOrders(); }
        catch (e) { alert('Error: ' + e.message); }
    },

    cancelOrder: async function(orderId) {
        if (confirm('Cancel this order? This cannot be undone.')) {
            try { await db.ref('orders/' + orderId).update({ status: 'Cancelled', cancelledAt: firebase.database.ServerValue.TIMESTAMP }); this.loadOrders(); }
            catch (e) { alert('Error: ' + e.message); }
        }
    },

    viewLocation: function(lat, lng) {
        if (!lat || !lng) { alert('No location data'); return; }
        const modal = new bootstrap.Modal(document.getElementById('adminMapModal'));
        setTimeout(() => {
            if (!this.orderMap) {
                this.orderMap = L.map('admin-order-map').setView([lat, lng], 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(this.orderMap);
            } else { this.orderMap.setView([lat, lng], 15); }
            if (this.orderMapMarker) this.orderMap.removeLayer(this.orderMapMarker);
            this.orderMapMarker = L.marker([lat, lng]).addTo(this.orderMap).bindPopup('Delivery').openPopup();
        }, 300);
        modal.show();
    }
};

document.addEventListener('DOMContentLoaded', () => Admin.init());