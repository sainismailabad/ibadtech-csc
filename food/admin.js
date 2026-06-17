// ============================================
// IBAD FOODIE - Admin Full Management Panel
// ============================================
const Admin = {
    currentUser: null,
    map: null,
    mapMarkers: [],
    allOrders: [],

    _val: function(id) {
        return document.getElementById(id).value.trim();
    },

    _safe: function(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[ch]));
    },

    _statusClass: function(status) {
        return String(status || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    },

    _dateText: function(timestamp) {
        return timestamp ? new Date(timestamp).toLocaleDateString() + ' ' + new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
    },

    init: async function() {
        const authState = await auth.init();
        if (!authState.user || authState.role !== 'admin') {
            document.querySelector('nav').style.display = 'none';
            document.getElementById('admin-main-content').style.display = 'none';
            document.getElementById('admin-login-card').style.display = 'block';
            return;
        }
        document.querySelector('nav').style.display = '';
        document.getElementById('admin-main-content').style.display = 'block';
        document.getElementById('admin-login-card').style.display = 'none';
        this.currentUser = authState.user;
        document.getElementById('admin-email').textContent = this.currentUser.email;
        this.loadDashboard();
        this.loadRestaurantFilter();
        this.loadDeliveryFilter();
    },

    login: async function(e) {
        e.preventDefault();
        const msg = document.getElementById('admin-login-message');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        msg.classList.add('d-none');
        submitBtn.disabled = true;

        try {
            const result = await auth.login(this._val('admin-login-email'), this._val('admin-login-password'));
            if (!result.success) throw new Error(result.error);
            if (result.role !== 'admin') throw new Error('Only admin accounts can access this panel.');

            msg.className = 'alert alert-success mt-3';
            msg.textContent = 'Admin login successful. Redirecting...';
            msg.classList.remove('d-none');
            setTimeout(() => window.location.reload(), 1200);
        } catch (err) {
            msg.className = 'alert alert-danger mt-3';
            msg.textContent = err.message;
            msg.classList.remove('d-none');
            submitBtn.disabled = false;
        }
    },

    showPage: function(page) {
        document.querySelectorAll('[id$="-page"]').forEach(el => el.style.display = 'none');
        document.getElementById(`${page}-page`).style.display = 'block';
        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
        document.querySelector(`[data-page="${page}"]`).classList.add('active');
        if (page === 'dashboard') this.loadDashboard();
        if (page === 'restaurants') this.loadRestaurants();
        if (page === 'delivery') this.loadDeliveryBoys();
        if (page === 'activity') this.loadActivity();
        if (page === 'customers') this.loadCustomers();
        if (page === 'offers') { this.loadRestaurantOfferSelect(); this.loadOffers(); }
        if (page === 'orders') { this.loadRestaurantFilter(); this.loadDeliveryFilter(); this.loadOrders(); }
    },

    _snapArr: function(snap) {
        const r = [];
        if (snap.exists()) snap.forEach(c => r.push({ id: c.key, ...c.val() }));
        return r;
    },

    // ====== DASHBOARD ======
    loadDashboard: async function() {
        try {
            const [ords, rests, users, menus, partners, sellers] = await Promise.all([
                db.ref('orders').once('value'),
                db.ref('restaurants').once('value'),
                db.ref('users').once('value'),
                db.ref('products').once('value'),
                db.ref('deliveryPartners').once('value'),
                db.ref('sellers').once('value')
            ]);
            const od = ords.val() || {};
            document.getElementById('admin-total-orders').textContent = Object.keys(od).length;
            document.getElementById('admin-total-restaurants').textContent = rests.exists() ? rests.numChildren() : 0;
            document.getElementById('admin-total-sellers').textContent = sellers.exists() ? sellers.numChildren() : 0;
            document.getElementById('admin-total-menu').textContent = menus.exists() ? menus.numChildren() : 0;
            document.getElementById('admin-total-delivery').textContent = partners.exists() ? partners.numChildren() : 0;
            
            let customers = 0, revenue = 0, deliveryEarnings = 0;
            if (users.exists()) {
                users.forEach(c => {
                    if (c.val().role === 'customer') customers++;
                });
            }
            document.getElementById('admin-total-customers').textContent = customers;
            
            for (const oid of Object.keys(od)) {
                revenue += od[oid].totalAmount || 0;
            }
            if (partners.exists()) {
                partners.forEach(p => deliveryEarnings += Number(p.val().earnings || 0));
            }
            document.getElementById('admin-total-revenue').textContent = `₹${revenue.toFixed(2)}`;
            document.getElementById('admin-total-delivery-earnings').textContent = `₹${deliveryEarnings.toFixed(2)}`;
            
            let pending = 0, preparing = 0, delivered = 0, cancelled = 0;
            for (const oid of Object.keys(od)) {
                const s = od[oid].status || '';
                if (s === 'Pending' || s === 'Accepted') pending++;
                else if (s === 'Preparing' || s === 'Shipped' || s === 'Out for Delivery') preparing++;
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
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
        try {
            const [snap, orderSnap] = await Promise.all([
                db.ref('restaurants').once('value'),
                db.ref('orders').once('value')
            ]);
            tbody.innerHTML = '';
            const orders = orderSnap.exists() ? this._snapArr(orderSnap) : [];
            if (snap.exists()) {
                snap.forEach(c => {
                    const r = c.val();
                    const restOrders = orders.filter(o => o.restaurantId === c.key || o.sellerId === c.key);
                    const active = restOrders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length;
                    const revenue = restOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><img src="${this._safe(r.logo || 'https://via.placeholder.com/48')}" class="rounded" width="48" height="48"> ${this._safe(r.name)}</td>
                        <td>${this._safe(r.cuisine || 'N/A')}</td>
                        <td>${this._safe(r.deliveryTime || '30')} min</td>
                        <td>${restOrders.length} total / ${active} active</td>
                        <td>₹${revenue.toFixed(2)}</td>
                        <td><span class="badge bg-success">Active</span></td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="Admin.viewRestaurantOrders('${this._safe(c.key)}')"><i class="fas fa-eye"></i></button>
                            <button class="btn btn-sm btn-outline-danger" onclick="Admin.removeRestaurant('${this._safe(c.key)}')"><i class="fas fa-trash"></i></button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
            if (!snap.exists()) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No restaurants</td></tr>';
        } catch (e) { tbody.innerHTML = `<tr><td colspan="7" class="text-danger">${e.message}</td></tr>`; }
    },

    registerRestaurant: async function(e) {
        e.preventDefault();
        const msg = document.getElementById('restaurant-register-message');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        msg.classList.add('d-none');
        submitBtn.disabled = true;

        try {
            const result = await auth.register(
                this._val('rest-owner-email'),
                this._val('rest-owner-password'),
                'seller',
                {
                    shopName: this._val('rest-name'),
                    logo: this._val('rest-logo'),
                    banner: this._val('rest-banner'),
                    cuisine: this._val('rest-cuisine'),
                    deliveryTime: parseInt(this._val('rest-delivery-time'), 10) || 30,
                    deliveryFee: parseFloat(this._val('rest-delivery-fee')) || 0,
                    rating: parseFloat(this._val('rest-rating')) || 4.0
                }
            );

            if (!result.success) throw new Error(result.error);

            const uid = result.user.uid;
            const restaurantData = {
                name: this._val('rest-name'),
                logo: this._val('rest-logo') || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150',
                banner: this._val('rest-banner') || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600',
                cuisine: this._val('rest-cuisine'),
                deliveryTime: parseInt(this._val('rest-delivery-time'), 10) || 30,
                deliveryFee: parseFloat(this._val('rest-delivery-fee')) || 0,
                rating: parseFloat(this._val('rest-rating')) || 4.0,
                sellerId: uid,
                category: this._val('rest-cuisine'),
                address: this._val('rest-address'),
                phone: this._val('rest-phone'),
                active: true,
                slug: this._val('rest-name').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
            };

            await db.ref('restaurants/' + uid).set(restaurantData);
            await db.ref('sellers/' + uid).set({
                sellerId: uid,
                shopName: restaurantData.name,
                shopSlug: restaurantData.slug,
                logo: restaurantData.logo,
                phone: restaurantData.phone,
                active: true
            });
            auth.addNotification(uid, 'Restaurant account created by admin.', 'account');

            msg.className = 'alert alert-success mt-3';
            msg.textContent = 'Restaurant registered successfully.';
            msg.classList.remove('d-none');
            e.target.reset();
            document.getElementById('rest-delivery-time').value = '30';
            document.getElementById('rest-rating').value = '4.0';
            await this.loadDashboard();
            await this.loadRestaurants();
        } catch (err) {
            msg.className = 'alert alert-danger mt-3';
            msg.textContent = err.message;
            msg.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
        }
    },

    // ====== OFFERS & BANNERS ======
    loadRestaurantOfferSelect: async function() {
        const select = document.getElementById('roff-restaurant');
        try {
            const snap = await db.ref('restaurants').once('value');
            select.innerHTML = '<option value="">Choose restaurant...</option>';
            if (snap.exists()) {
                snap.forEach(c => {
                    const r = c.val();
                    const opt = document.createElement('option');
                    opt.value = c.key; opt.textContent = r.name || c.key; select.appendChild(opt);
                });
            }
        } catch (e) { console.error(e); }
    },

    savePlatformBanner: async function(e) {
        e.preventDefault();
        const msg = document.getElementById('banner-message');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        msg.classList.add('d-none');
        submitBtn.disabled = true;
        try {
            const bannerId = document.getElementById('banner-id').value || 'main_banner';
            const bannerData = {
                id: bannerId,
                title: this._val('banner-title'),
                description: this._val('banner-description'),
                coupon: this._val('banner-coupon'),
                image: this._val('banner-image'),
                bgColor: document.getElementById('banner-bg-color').value || '#ff6b6b',
                type: 'platform',
                active: document.getElementById('banner-active').checked,
                expiry: document.getElementById('banner-expiry').value || null
            };
            await db.ref('offers/' + bannerId).set(bannerData);
            msg.className = 'alert alert-success mt-3';
            msg.textContent = 'Banner saved successfully!';
            msg.classList.remove('d-none');
            this.loadOffers();
        } catch (err) {
            msg.className = 'alert alert-danger mt-3';
            msg.textContent = err.message;
            msg.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
        }
    },

    saveRestaurantOffer: async function(e) {
        e.preventDefault();
        const msg = document.getElementById('roff-message');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        msg.classList.add('d-none');
        submitBtn.disabled = true;
        try {
            const restaurantId = this._val('roff-restaurant');
            if (!restaurantId) throw new Error('Please select a restaurant');
            
            const offId = document.getElementById('roff-id').value || db.ref('offers').push().key;
            const offerData = {
                id: offId,
                restaurantId: restaurantId,
                title: this._val('roff-title'),
                description: this._val('roff-description'),
                discountType: this._val('roff-discount-type'),
                discountValue: parseFloat(this._val('roff-discount-value')) || 0,
                minOrder: parseFloat(this._val('roff-min-order')) || 0,
                coupon: this._val('roff-coupon'),
                type: 'restaurant',
                active: document.getElementById('roff-active').checked,
                expiry: document.getElementById('roff-expiry').value || null
            };

            // Also get restaurant name
            const restSnap = await db.ref('restaurants/' + restaurantId).once('value');
            if (restSnap.exists()) offerData.restaurantName = restSnap.val().name;

            await db.ref('offers/' + offId).set(offerData);
            msg.className = 'alert alert-success mt-3';
            msg.textContent = 'Restaurant offer saved successfully!';
            msg.classList.remove('d-none');
            e.target.reset();
            document.getElementById('roff-active').checked = true;
            this.loadRestaurantOfferSelect();
            this.loadOffers();
        } catch (err) {
            msg.className = 'alert alert-danger mt-3';
            msg.textContent = err.message;
            msg.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
        }
    },

    loadOffers: async function() {
        const tbody = document.getElementById('offers-table');
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
        try {
            const snap = await db.ref('offers').once('value');
            tbody.innerHTML = '';
            if (snap.exists()) {
                snap.forEach(c => {
                    const o = c.val() || {};
                    const isPlatform = o.type === 'platform';
                    const expired = o.expiry ? new Date(o.expiry).getTime() < Date.now() : false;
                    const status = o.active === false || expired ? '<span class="badge bg-danger">Inactive</span>' : '<span class="badge bg-success">Active</span>';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${isPlatform ? '<span class="badge bg-primary">Platform Banner</span>' : '<span class="badge bg-info text-dark">Restaurant Offer</span>'}</td>
                        <td>${this._safe(o.title || 'N/A')}</td>
                        <td>${this._safe(o.restaurantName || '- All -')}</td>
                        <td>${o.discountValue ? (o.discountType === 'percent' ? o.discountValue + '%' : '₹' + o.discountValue) : '-'}</td>
                        <td>${this._safe(o.coupon || '-')}</td>
                        <td>${o.expiry ? new Date(o.expiry).toLocaleDateString() : 'No expiry'}</td>
                        <td>${status}</td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-outline-danger" onclick="Admin.deleteOffer('${c.key}')"><i class="fas fa-trash"></i></button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">No offers or banners created yet</td></tr>';
            }
        } catch (e) { tbody.innerHTML = `<tr><td colspan="8" class="text-danger">${e.message}</td></tr>`; }
    },

    deleteOffer: async function(id) {
        if (confirm('Delete this offer/banner?')) {
            try {
                await db.ref('offers/' + id).remove();
                this.loadOffers();
            } catch (e) { auth.showToast('Error: ' + e.message); }
        }
    },

    removeRestaurant: async function(id) {
        if (confirm('Remove this restaurant and all its data?')) {
            try {
                await db.ref('restaurants/' + id).remove();
                await db.ref('sellers/' + id).remove();
                this.loadRestaurants();
            } catch (e) { auth.showToast('Error: ' + e.message); }
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

    registerDelivery: async function(e) {
        e.preventDefault();
        const msg = document.getElementById('delivery-register-message');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        msg.classList.add('d-none');
        submitBtn.disabled = true;

        try {
            const result = await auth.register(this._val('delivery-email'), this._val('delivery-password'), 'delivery', null);
            if (!result.success) throw new Error(result.error);

            const uid = result.user.uid;
            const data = {
                partnerId: uid,
                name: this._val('delivery-name'),
                phone: this._val('delivery-phone'),
                vehicleNo: this._val('delivery-vehicle'),
                area: this._val('delivery-area'),
                idProof: this._val('delivery-id-proof'),
                available: true,
                status: 'Available',
                earnings: 0,
                totalDeliveries: 0,
                rating: 5.0,
                joinedAt: firebase.database.ServerValue.TIMESTAMP
            };

            await db.ref('deliveryPartners/' + uid).set(data);
            await db.ref('users/' + uid + '/profile').set({
                name: data.name,
                phone: data.phone,
                vehicleNo: data.vehicleNo,
                area: data.area,
                idProof: data.idProof
            });
            auth.addNotification(uid, 'Delivery account created by admin.', 'account');

            msg.className = 'alert alert-success mt-3';
            msg.textContent = 'Delivery boy registered successfully.';
            msg.classList.remove('d-none');
            e.target.reset();
            await this.loadDashboard();
            await this.loadDeliveryBoys();
        } catch (err) {
            msg.className = 'alert alert-danger mt-3';
            msg.textContent = err.message;
            msg.classList.remove('d-none');
        } finally {
            submitBtn.disabled = false;
        }
    },

    loadDeliveryBoys: async function() {
        const tbody = document.getElementById('delivery-table');
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
        try {
            const [usersSnap, partnersSnap, ordersSnap] = await Promise.all([
                db.ref('users').once('value'),
                db.ref('deliveryPartners').once('value'),
                db.ref('orders').once('value')
            ]);
            tbody.innerHTML = '';
            const orders = ordersSnap.exists() ? this._snapArr(ordersSnap) : [];
            let hasRows = false;

            if (usersSnap.exists()) {
                usersSnap.forEach(userSnap => {
                    const user = userSnap.val() || {};
                    if (user.role !== 'delivery') return;
                    hasRows = true;
                    const p = (partnersSnap.exists() ? partnersSnap.child(userSnap.key).val() : null) || {};
                    const assigned = orders.filter(o => o.deliveryPartnerId === userSnap.key);
                    const delivered = assigned.filter(o => o.status === 'Delivered').length;
                    const active = assigned.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${this._safe(p.name || userSnap.key)}</td>
                        <td>${this._safe(user.email || '')}</td>
                        <td>${this._safe(p.phone || 'N/A')}</td>
                        <td>${this._safe(p.vehicleNo || 'N/A')}</td>
                        <td>${this._safe(p.area || 'N/A')}</td>
                        <td><span class="badge ${p.available === false ? 'bg-danger' : 'bg-success'}">${this._safe(p.status || (p.available === false ? 'Busy' : 'Available'))}</span></td>
                        <td>${assigned.length} assigned / ${active} active / ${delivered} delivered</td>
                        <td>₹${Number(p.earnings || 0).toFixed(2)}</td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="Admin.viewDeliveryOrders('${this._safe(userSnap.key)}')"><i class="fas fa-eye"></i></button>
                            <button class="btn btn-sm btn-outline-danger" onclick="Admin.removeDeliveryBoy('${this._safe(userSnap.key)}')"><i class="fas fa-trash"></i></button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
            if (!hasRows) tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">No delivery boys</td></tr>';
        } catch (e) { tbody.innerHTML = `<tr><td colspan="9" class="text-danger">${e.message}</td></tr>`; }
    },

    removeDeliveryBoy: async function(id) {
        if (confirm('Remove this delivery boy and all assigned data?')) {
            try {
                await db.ref('deliveryPartners/' + id).remove();
                await db.ref('users/' + id).remove();
                this.loadDeliveryBoys();
                this.loadDeliveryFilter();
            } catch (e) { auth.showToast('Error: ' + e.message); }
        }
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

    loadDeliveryFilter: async function() {
        const select = document.getElementById('filter-delivery');
        if (!select) return;
        try {
            const snap = await db.ref('deliveryPartners').once('value');
            select.innerHTML = '<option value="">All Delivery Boys</option>';
            if (snap.exists()) {
                snap.forEach(c => {
                    const p = c.val();
                    const opt = document.createElement('option');
                    opt.value = c.key; opt.textContent = p.name || c.key; select.appendChild(opt);
                });
            }
        } catch (e) { console.error(e); }
    },
    loadOrders: async function() {
        const tbody = document.getElementById('admin-orders-table');
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
        try {
            const snap = await db.ref('orders').once('value');
            const data = this._snapArr(snap);
            data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            this.allOrders = data;
            this.renderOrders(data);
        } catch (e) { tbody.innerHTML = `<tr><td colspan="9" class="text-danger">${e.message}</td></tr>`; }
    },

    renderOrders: async function(orders) {
        const tbody = document.getElementById('admin-orders-table');
        tbody.innerHTML = '';
        const deliveryCache = {};
        for (const o of orders) {
            const uSnap = await db.ref('users/' + o.customerId).once('value');
            const user = uSnap.exists() ? uSnap.val() : {};
            const profile = user.profile || {};
            const restName = o.restaurantName || 'Unknown';
            const items = o.items ? o.items.map(i => this._safe(i.name + ' x' + i.qty)).join(', ') : 'N/A';
            const d = this._dateText(o.timestamp);
            const isCancelled = o.status === 'Cancelled';
            let deliveryName = 'Unassigned';
            if (o.deliveryPartnerId) {
                if (!deliveryCache[o.deliveryPartnerId]) {
                    const dpSnap = await db.ref('deliveryPartners/' + o.deliveryPartnerId).once('value');
                    deliveryCache[o.deliveryPartnerId] = dpSnap.exists() ? dpSnap.val() : {};
                }
                deliveryName = deliveryCache[o.deliveryPartnerId].name || o.deliveryPartnerId;
            }
            const safeStatus = this._statusClass(o.status);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${this._safe(profile.name || user.email || 'N/A')}</td>
                <td>${this._safe(profile.phone || 'N/A')}</td>
                <td>${this._safe(restName)}</td>
                <td>${this._safe(deliveryName)}</td>
                <td><small>${items}</small></td>
                <td>₹${(o.totalAmount || 0).toFixed(2)}</td>
                <td><span class="status-badge status-${safeStatus}">${this._safe(o.status || 'Pending')}</span></td>
                <td>${this._safe(d)}</td>
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
        if (orders.length === 0) tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">No orders</td></tr>';
    },

    filterOrders: async function() {
        if (this.allOrders.length === 0) { await this.loadOrders(); return; }
        const rid = document.getElementById('filter-seller').value;
        const did = document.getElementById('filter-delivery').value;
        const status = document.getElementById('filter-status').value;
        const date = document.getElementById('filter-date').value;
        let f = this.allOrders;
        if (rid) f = f.filter(o => o.restaurantId === rid || o.sellerId === rid);
        if (did) f = f.filter(o => o.deliveryPartnerId === did);
        if (status) f = f.filter(o => o.status === status);
        if (date) { const fd = new Date(date); f = f.filter(o => o.timestamp && new Date(o.timestamp).toDateString() === fd.toDateString()); }
        this.renderOrders(f);
    },

    updateStatus: async function(orderId, currentStatus) {
        const nextMap = {
            'Pending': 'Preparing',
            'Accepted': 'Preparing',
            'Preparing': 'Shipped',
            'Shipped': 'Delivered',
            'Out for Delivery': 'Delivered',
            'Delivered': 'Delivered',
            'Cancelled': 'Cancelled'
        };
        const next = nextMap[currentStatus] || 'Preparing';
        try {
            await db.ref('orders/' + orderId).update({ status: next, updatedAt: firebase.database.ServerValue.TIMESTAMP });
            this.loadOrders();
        }
        catch (e) { auth.showToast('Error: ' + e.message); }
    },

    cancelOrder: async function(orderId) {
        if (confirm('Cancel this order? This cannot be undone.')) {
            try { await db.ref('orders/' + orderId).update({ status: 'Cancelled', cancelledAt: firebase.database.ServerValue.TIMESTAMP }); this.loadOrders(); }
            catch (e) { auth.showToast('Error: ' + e.message); }
        }
    },

    viewRestaurantOrders: async function(restaurantId) {
        this.showPage('orders');
        setTimeout(() => {
            document.getElementById('filter-seller').value = restaurantId;
            document.getElementById('filter-delivery').value = '';
            this.filterOrders();
        }, 100);
    },

    viewDeliveryOrders: async function(deliveryId) {
        this.showPage('orders');
        setTimeout(() => {
            document.getElementById('filter-seller').value = '';
            document.getElementById('filter-delivery').value = deliveryId;
            this.filterOrders();
        }, 100);
    },

    loadActivity: async function() {
        const restBody = document.getElementById('restaurant-activity-table');
        const deliveryBody = document.getElementById('delivery-activity-table');
        restBody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
        deliveryBody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
        try {
            const [restaurantsSnap, partnersSnap, ordersSnap] = await Promise.all([
                db.ref('restaurants').once('value'),
                db.ref('deliveryPartners').once('value'),
                db.ref('orders').once('value')
            ]);
            const orders = ordersSnap.exists() ? this._snapArr(ordersSnap) : [];
            restBody.innerHTML = '';
            deliveryBody.innerHTML = '';

            if (restaurantsSnap.exists()) {
                restaurantsSnap.forEach(c => {
                    const r = c.val();
                    const restOrders = orders.filter(o => o.restaurantId === c.key || o.sellerId === c.key);
                    const active = restOrders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length;
                    const pending = restOrders.filter(o => o.status === 'Pending' || o.status === 'Accepted' || o.status === 'Preparing').length;
                    const revenue = restOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${this._safe(r.name || c.key)}</td>
                        <td>${active}</td>
                        <td>${pending}</td>
                        <td>₹${revenue.toFixed(2)}</td>
                        <td><button class="btn btn-sm btn-outline-primary" onclick="Admin.viewRestaurantOrders('${this._safe(c.key)}')">View</button></td>
                    `;
                    restBody.appendChild(tr);
                });
            } else {
                restBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No restaurants</td></tr>';
            }

            if (partnersSnap.exists()) {
                partnersSnap.forEach(c => {
                    const p = c.val();
                    const assigned = orders.filter(o => o.deliveryPartnerId === c.key);
                    const delivered = assigned.filter(o => o.status === 'Delivered').length;
                    const active = assigned.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${this._safe(p.name || c.key)}</td>
                        <td><span class="badge ${p.available === false ? 'bg-danger' : 'bg-success'}">${this._safe(p.status || (p.available === false ? 'Busy' : 'Available'))}</span></td>
                        <td>${active}</td>
                        <td>${delivered}</td>
                        <td><button class="btn btn-sm btn-outline-primary" onclick="Admin.viewDeliveryOrders('${this._safe(c.key)}')">View</button></td>
                    `;
                    deliveryBody.appendChild(tr);
                });
            } else {
                deliveryBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No delivery boys</td></tr>';
            }
        } catch (e) {
            restBody.innerHTML = `<tr><td colspan="5" class="text-danger">${e.message}</td></tr>`;
            deliveryBody.innerHTML = `<tr><td colspan="5" class="text-danger">${e.message}</td></tr>`;
        }
    },

    viewLocation: function(lat, lng) {
        if (!lat || !lng) { auth.showToast('No location data'); return; }
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

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) loginForm.addEventListener('submit', e => Admin.login(e));

    const restaurantForm = document.getElementById('restaurant-register-form');
    if (restaurantForm) restaurantForm.addEventListener('submit', e => Admin.registerRestaurant(e));

    const deliveryForm = document.getElementById('delivery-register-form');
    if (deliveryForm) deliveryForm.addEventListener('submit', e => Admin.registerDelivery(e));

    const bannerForm = document.getElementById('platform-banner-form');
    if (bannerForm) bannerForm.addEventListener('submit', e => Admin.savePlatformBanner(e));

    const offerForm = document.getElementById('restaurant-offer-form');
    if (offerForm) offerForm.addEventListener('submit', e => Admin.saveRestaurantOffer(e));

    Admin.init();
});
