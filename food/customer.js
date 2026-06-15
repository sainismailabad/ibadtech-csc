 // ============================================
// IBAD FOODIE - Customer Module
// Restaurant browsing, cart, menu, ordering
// ============================================
const Foodie = {
    currentUser: null,
    cart: [],
    currentRestaurant: null,
    coupon: null,
    couponDiscount: 0,
    deliveryFee: 0,
    walletDiscount: 0,
    otpVerified: false,
    categories: ['All', 'Pizza', 'Burger', 'Biryani', 'Chinese', 'South Indian', 'North Indian', 'Desserts', 'Beverages', 'Snacks', 'Other'],

    init: async function() {
        const authState = await auth.init();
        this.currentUser = authState.user;
        this.updateNav();
        this.loadCategories();
        this.loadRestaurants();
        this.listenForNotifications();
        this.initLocation();
        this.openRestaurantFromUrl();
    },

    listenForNotifications: function() {
        if (!this.currentUser) return;
        let initialLoad = true;
        db.ref('notifications').orderByChild('userId').equalTo(this.currentUser.uid).on('child_added', (snapshot) => {
            if (!initialLoad) {
                const notif = snapshot.val();
                if (!notif.read) {
                    alert(`Notification: ${notif.message}`);
                    auth.markNotificationRead(snapshot.key);
                }
            }
        });
        setTimeout(() => initialLoad = false, 3000);
    },

    initLocation: async function() {
        const status = document.getElementById('location-status');
        if (!status || !navigator.geolocation) return;
        try {
            const saved = localStorage.getItem('foodie-last-location');
            if (saved) {
                const loc = JSON.parse(saved);
                document.getElementById('checkout-lat').value = loc.lat;
                document.getElementById('checkout-lng').value = loc.lng;
                status.innerHTML = `<i class="fas fa-check-circle me-1"></i>${this._safe(loc.address || 'Location saved')}`;
                return;
            }
            if (this.currentUser) {
                this.getCurrentLocation(false);
                return;
            }
            if (navigator.permissions && navigator.permissions.query) {
                const permission = await navigator.permissions.query({ name: 'geolocation' });
                if (permission.state === 'granted') this.getCurrentLocation(false);
            }
        } catch (e) {}
    },

    getCurrentLocation: function(showMessage = true) {
        const status = document.getElementById('location-status');
        const geoStatus = document.getElementById('geo-status');
        const submitBtn = document.getElementById('checkout-submit-btn');
        if (!navigator.geolocation) {
            if (status) status.innerHTML = '<span class="text-danger">Geolocation is not supported by this browser.</span>';
            return;
        }
        if (showMessage && status) status.innerHTML = '<span class="text-primary"><i class="fas fa-spinner fa-spin me-1"></i>Requesting location permission...</span>';
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                const accuracy = pos.coords.accuracy;
                document.getElementById('checkout-lat').value = lat;
                document.getElementById('checkout-lng').value = lng;
                localStorage.setItem('foodie-last-location', JSON.stringify({ lat, lng, address: '' }));
                const address = await this.resolveAddressFromCoords(lat, lng);
                document.getElementById('checkout-address').value = address || '';
                localStorage.setItem('foodie-last-location', JSON.stringify({ lat, lng, address: address || '' }));
                if (status) {
                    status.innerHTML = `<i class="fas fa-check-circle me-1"></i>${this._safe(address || 'Current location captured')}`;
                    if (accuracy > 100) status.innerHTML += `<br><small class="text-warning">GPS accuracy is low (${Math.round(accuracy)}m). Please refresh location.</small>`;
                }
                if (submitBtn) submitBtn.disabled = false;
                this.updateCheckoutTotals();
            },
            (err) => {
                if (status) status.innerHTML = '<span class="text-danger">Please allow location access for accurate delivery.</span>';
                if (geoStatus) geoStatus.innerHTML = '';
                if (submitBtn) submitBtn.disabled = true;
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
        );
    },

    resolveAddressFromCoords: async function(lat, lng) {
        try {
            const url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lng) + '&zoom=18&addressdetails=1';
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!res.ok) throw new Error('Reverse geocode failed');
            const data = await res.json();
            const a = data.address || {};
            return [a.road, a.house_number, a.neighbourhood, a.suburb, a.city || a.town || a.village, a.state].filter(Boolean).join(', ');
        } catch (e) {
            return '';
        }
    },

    _safe: function(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
    },

    updateNav: function() {
        if (this.currentUser) {
            document.getElementById('nav-logout').style.display = 'block';
            document.getElementById('nav-login').style.display = 'none';
            document.getElementById('nav-register').style.display = 'none';
            document.getElementById('nav-orders').style.display = 'block';
            if (document.getElementById('nav-profile')) document.getElementById('nav-profile').style.display = 'block';
        } else {
            document.getElementById('nav-logout').style.display = 'none';
            document.getElementById('nav-login').style.display = 'block';
            document.getElementById('nav-register').style.display = 'block';
            if (document.getElementById('nav-orders')) document.getElementById('nav-orders').style.display = 'none';
            if (document.getElementById('nav-profile')) document.getElementById('nav-profile').style.display = 'none';
        }
    },

    // ====== SEARCH (Zomato-style: Items-first + Restaurant filter) ======
    searchEverything: async function(query) {
        const q = (query || '').toLowerCase().trim();
        const restaurantCards = document.querySelectorAll('.restaurant-card');
        const container = document.getElementById('restaurants-list');

        if (!restaurantCards || restaurantCards.length === 0) return;

        // cleanup old empty
        const existingEmpty = container ? container.querySelector('[data-empty-search="1"]') : null;
        if (existingEmpty) existingEmpty.remove();

        if (!q) {
            restaurantCards.forEach(card => card.style.display = '');
            return;
        }

        // Ensure cache
        const products = await this.ensureProductCache();

        // Match items
        const itemMatches = products.filter(p => {
            const name = (p.name || '').toLowerCase();
            const desc = (p.description || '').toLowerCase();
            const images = (p.images || []).join(' ').toLowerCase();
            const price = String(p.price || '');
            const stock = String(p.stock || '');
            const ingredients = (p.ingredients || '').toLowerCase();
            const offer = (p.offer || '').toLowerCase();
            return name.includes(q) || desc.includes(q) || ingredients.includes(q) || offer.includes(q) || images.includes(q) || price.includes(q) || stock.includes(q);
        });

        // Restaurants that have matching items
        const matchedRestaurantIds = new Set(itemMatches.map(p => p.sellerId).filter(Boolean));

        // Render restaurants based on item matches
        // Also allow category/cuisine match if there are no item matches
        const hasItem = itemMatches.length > 0;

        restaurantCards.forEach(card => {
            const rid = card.dataset.id;
            if (hasItem) {
                card.style.display = matchedRestaurantIds.has(rid) ? '' : 'none';
            } else {
                const name = (card.dataset.name || '').toLowerCase();
                const cat = (card.dataset.category || '').toLowerCase();
                const address = (card.dataset.address || '').toLowerCase();
                const matchRestaurant = name.includes(q) || cat.includes(q) || address.includes(q);
                card.style.display = matchRestaurant ? '' : 'none';
            }
        });

        // Items preview UI (top items) is shown in modal only; for index we keep restaurant grid.
        const visible = Array.from(restaurantCards).filter(c => c.style.display !== 'none');
        if (container && visible.length === 0) {
            container.insertAdjacentHTML('beforeend', `
                <div data-empty-search="1" class="col-12 text-center py-5">
                    <div class="empty-state">
                        <i class="fas fa-search"></i>
                        <h4>No Match Found</h4>
                        <p class="text-muted">Try with item name like “pizza” or cuisine like “biryani”.</p>
                    </div>
                </div>
            `);
        }
    },

    // ====== CATEGORIES ======
    loadCategories: function() {
        const container = document.getElementById('category-list');
        container.innerHTML = this.categories.map((cat, i) => `
            <div class="category-pill ${i===0?'active':''}" onclick="Foodie.filterByCategory('${cat}', this)">
                ${this.getCategoryIcon(cat)} ${cat}
            </div>
        `).join('');
    },

    getCategoryIcon: function(cat) {
        const icons = {
            'All': '🍽️', 'Pizza': '🍕', 'Burger': '🍔', 'Biryani': '🍛',
            'Chinese': '🥟', 'South Indian': '🥞', 'North Indian': '🍛',
            'Desserts': '🍰', 'Beverages': '🥤'
        };
        return icons[cat] || '🍽️';
    },

    filterByCategory: function(category, el) {
        document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
        el.classList.add('active');
        const cards = document.querySelectorAll('.restaurant-card');
        cards.forEach(card => {
            if (category === 'All' || card.dataset.category === category) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    },

    searchRestaurants: function(query) {
        const cards = document.querySelectorAll('.restaurant-card');
        const q = (query || '').toLowerCase().trim();
        cards.forEach(card => {
            const name = (card.dataset.name || '').toLowerCase();
            const cat = (card.dataset.category || '').toLowerCase();
            const address = (card.dataset.address || '').toLowerCase();
            // Only match on available fields
            const match = !q || name.includes(q) || cat.includes(q) || address.includes(q);
            card.style.display = match ? '' : 'none';
        });

        // If no cards are visible => show empty state
        const visible = Array.from(cards).filter(c => c.style.display !== 'none');
        const container = document.getElementById('restaurants-list');
        if (container) {
            const existingEmpty = container.querySelector('[data-empty-search="1"]');
            if (visible.length === 0) {
                if (!existingEmpty) {
                    container.insertAdjacentHTML('beforeend', `
                        <div data-empty-search="1" class="col-12 text-center py-5">
                            <div class="empty-state">
                                <i class="fas fa-search"></i>
                                <h4>No Results</h4>
                                <p class="text-muted">Try searching by restaurant name or cuisine.</p>
                            </div>
                        </div>
                    `);
                }
            } else {
                if (existingEmpty) existingEmpty.remove();
            }
        }
    },

    // ====== RESTAURANTS ======
    loadRestaurants: async function() {
        const container = document.getElementById('restaurants-list');
        container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-3">Finding best restaurants...</p></div>';
        try {
            const snap = await db.ref('restaurants').once('value');
            container.innerHTML = '';
            if (!snap.exists()) {
                container.innerHTML = '<div class="col-12 text-center py-5"><div class="empty-state"><i class="fas fa-store"></i><h4>No Restaurants Yet</h4><p>Be the first to register your restaurant!</p></div></div>';
                return;
            }
            snap.forEach(child => {
                const r = child.val();
                const banner = r.banner || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600';
                const logo = r.logo || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150';
                const offer = r.offer ? `<div class="offer-badge">${r.offer}</div>` : '';
                const div = document.createElement('div');
                div.className = 'col-lg-3 col-md-4 col-sm-6 mb-4';
                div.innerHTML = `
                    <div class="restaurant-card" data-id="${child.key}" data-name="${r.name}" data-category="${r.category||'All'}" data-address="${r.address||''}" onclick="Foodie.openRestaurant('${child.key}')">
                        <div class="banner-wrap">
                            <img src="${banner}" alt="${r.name}" onerror="this.src='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600'">
                            ${offer}
                            <div class="logo-wrap"><img src="${logo}" alt="${r.name}" onerror="this.src='https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150'"></div>
                        </div>
                        <div class="card-body">
                            <h5>${r.name}</h5>
                            <p class="text-muted small mb-2">${r.cuisine || 'Multi-Cuisine'}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="rating"><i class="fas fa-star me-1"></i>${r.rating || '4.0'}</span>
                                <span class="delivery-time"><i class="fas fa-clock me-1"></i>${r.deliveryTime || '30'} mins</span>
                            </div>
                            <p class="text-muted small mt-2 mb-0">${r.address || ''}</p>
                            <p class="text-muted small mt-1 mb-0">${r.deliveryFee ? 'Delivery fee: ₹' + r.deliveryFee : 'Delivery fee calculated by distance'}</p>
                        </div>
                    </div>
                `;
                container.appendChild(div);
            });
        } catch (e) { container.innerHTML = `<div class="col-12"><div class="alert alert-danger">Error: ${e.message}</div></div>`; }
    },

    // ====== SEARCH: Cache products for fast item search ======
    _productSearchCache: null,
    _restaurantsCache: null,

    ensureProductCache: async function() {
        if (this._productSearchCache) return this._productSearchCache;
        // Load restaurants minimal for highlighting
        if (!this._restaurantsCache) {
            const restsSnap = await db.ref('restaurants').once('value');
            const rests = {};
            if (restsSnap.exists()) {
                restsSnap.forEach(c => {
                    rests[c.key] = c.val();
                });
            }
            this._restaurantsCache = rests;
        }

        // Load all products once (performance ok for small-medium DB)
        const snap = await db.ref('products').once('value');
        const products = [];
        if (snap.exists()) {
            snap.forEach(c => {
                const p = c.val();
                products.push({ id: c.key, ...p });
            });
        }
        this._productSearchCache = products;
        return products;
    },

    renderRestaurantsFallback: function(visibleIds) {
        const restaurantCards = document.querySelectorAll('.restaurant-card');
        restaurantCards.forEach(card => {
            const rid = card.dataset.id;
            const show = !visibleIds || visibleIds.size === 0 ? true : visibleIds.has(rid);
            card.style.display = show ? '' : 'none';
        });
    },

    _toast: function(msg) {
        try {
            let el = document.getElementById('bb-toast');
            if (!el) {
                el = document.createElement('div');
                el.id = 'bb-toast';
                el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:24px;z-index:2000;padding:10px 16px;border-radius:999px;background:rgba(44,62,80,0.95);color:white;display:none;box-shadow:0 10px 30px rgba(0,0,0,0.25);font-weight:700;';
                document.body.appendChild(el);
            }
            el.textContent = msg;
            el.style.display = 'block';
            setTimeout(() => el.style.display = 'none', 2000);
        } catch (e) {}
    },

    openRestaurantFromUrl: async function() {
        const params = new URLSearchParams(window.location.search);
        const restId = params.get('seller') || params.get('restaurant') || params.get('id');
        if (!restId) return;
        await new Promise(resolve => setTimeout(resolve, 300));
        // On index.html we keep modal, but if restaurant.html exists we navigate
        // Use full page for shareable deep-link experience
        try {
            if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/index.html')) {
                window.location.href = window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'restaurant.html?seller=' + encodeURIComponent(restId);
                return;
            }
        } catch (e) {}
        this.openRestaurant(restId);
        const buyId = params.get('buy');
        if (buyId) setTimeout(() => this.updateCart(buyId, 1), 800);
    },

    shareRestaurant: async function(restId) {
        const snap = await db.ref('restaurants/' + restId).once('value');
        const r = snap.val() || {};
        const url = window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'index.html?seller=' + restId;
        const text = `Check out ${r.name || 'this restaurant'} on Ibad Foodie!`;
        if (navigator.share) {
            navigator.share({ title: r.name || 'Restaurant', text, url });
        } else {
            navigator.clipboard.writeText(url).then(() => alert('Restaurant link copied!'));
        }
    },

    // ====== RESTAURANT DETAIL ======
    openRestaurant: async function(restId) {
        const snap = await db.ref('restaurants/' + restId).once('value');
        if (!snap.exists()) return;
        const r = snap.val();
        this.currentRestaurant = { id: restId, ...r };

        // Create restaurant modal
        const modalHtml = `
            <div class="modal-header restaurant-profile-header">
                <div>
                    <h5 class="modal-title">${this._safe(r.name)}</h5>
                    <small>${this._safe(r.cuisine || 'Multi-Cuisine')} • ${this._safe(r.deliveryTime || '30')} mins • ⭐${this._safe(r.rating || '4.0')} • Delivery ₹${this._safe(r.deliveryFee || 'as per distance')}</small>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <img src="${this._safe(r.banner || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600')}" class="restaurant-profile-banner mb-3" onerror="this.src='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600'">
                ${r.offer ? `<div class="offer-banner p-3 mb-3"><h5 class="mb-0">${this._safe(r.offer)}</h5></div>` : ''}
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <p class="mb-1 text-muted"><i class="fas fa-map-marker-alt me-1"></i>${this._safe(r.address || 'Address not added')}</p>
                        <p class="mb-0 text-muted">${this._safe(r.description || 'Fresh food delivered fast!')}</p>
                    </div>
                    <button class="btn btn-sm btn-outline-primary" onclick="Foodie.shareRestaurant('${restId}')"><i class="fas fa-share-alt me-1"></i>Share</button>
                </div>
                <h6 class="fw-bold mb-3"><i class="fas fa-utensils me-2"></i>Menu</h6>
                <div id="menu-items">
                    <div class="text-center py-3"><div class="spinner-border text-primary"></div></div>
                </div>
            </div>
        `;

        // Create or reuse modal
        let menuModal = document.getElementById('restaurantModal');
        if (!menuModal) {
            menuModal = document.createElement('div');
            menuModal.className = 'modal fade';
            menuModal.id = 'restaurantModal';
            menuModal.innerHTML = '<div class="modal-dialog modal-lg"><div class="modal-content"></div></div>';
            document.body.appendChild(menuModal);
        }
        menuModal.querySelector('.modal-content').innerHTML = modalHtml;
        const bsModal = new bootstrap.Modal(menuModal);
        bsModal.show();

        // Load menu items
        this.loadMenuItems(restId);
    },

    loadMenuItems: async function(restId) {
        const container = document.getElementById('menu-items');
        try {
            const snap = await db.ref('products').orderByChild('sellerId').equalTo(restId).once('value');
            container.innerHTML = '';
            if (!snap.exists()) {
                container.innerHTML = '<p class="text-muted">No menu items yet</p>';
                return;
            }
            snap.forEach(child => {
                const item = child.val();
                const img = (item.images && item.images.length > 0) ? item.images[0] : (item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200');
                const cartItem = this.cart.find(c => c.id === child.key);
                const qty = cartItem ? cartItem.qty : 0;
                const stock = Number(item.stock || 0);
                const offer = item.offer ? `<span class="badge bg-warning text-dark me-1">${this._safe(item.offer)}</span>` : '';
                const meta = [
                    item.category,
                    item.portionSize ? `Portion: ${item.portionSize}` : '',
                    item.preparationTime ? `${item.preparationTime} min` : '',
                    stock > 0 ? `${stock} available` : 'Out of stock'
                ].filter(Boolean).map(v => `<span>${this._safe(v)}</span>`).join('');
                const div = document.createElement('div');
                div.className = 'menu-item';
                div.innerHTML = `
                    <img src="${this._safe(img)}" alt="${this._safe(item.name)}" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200'">
                    <div class="item-info">
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <h6 class="mb-0">${this._safe(item.name)}</h6>
                            ${item.isVeg === false ? '<span class="badge bg-danger">Non-Veg</span>' : '<span class="badge bg-success">Veg</span>'}
                            ${offer}
                        </div>
                        <p class="desc">${this._safe(item.description || '')}</p>
                        ${item.ingredients ? `<p class="desc"><i class="fas fa-seedling me-1"></i>${this._safe(item.ingredients)}</p>` : ''}
                        <span class="price">₹${Number(item.price || 0).toFixed(2)}</span>
                        <div class="menu-meta">${meta || '<span>Menu item</span>'}</div>
                    </div>
                    <div>
                        ${qty > 0 ? `
                            <div class="d-flex align-items-center gap-2">
                                <button class="btn btn-sm btn-outline-primary rounded-circle" onclick="Foodie.updateCart('${child.key}', -1)">-</button>
                                <span class="fw-bold">${qty}</span>
                                <button class="btn btn-sm btn-outline-primary rounded-circle" onclick="Foodie.updateCart('${child.key}', 1)">+</button>
                            </div>
                        ` : `
                            <button class="add-btn" onclick="Foodie.updateCart('${child.key}', 1)" ${stock <= 0 ? 'disabled' : ''}>${stock <= 0 ? 'Sold Out' : '+ Add'}</button>
                        `}
                    </div>
                `;
                container.appendChild(div);
            });
        } catch (e) { container.innerHTML = `<p class="text-danger">Error: ${e.message}</p>`; }
    },

    // ====== CART ======
    updateCart: function(itemId, change) {
        const idx = this.cart.findIndex(c => c.id === itemId);
        if (idx > -1) {
            this.cart[idx].qty += change;
            if (this.cart[idx].qty <= 0) this.cart.splice(idx, 1);
        } else if (change > 0) {
            // Get item data from menu
            const itemEl = document.querySelector(`#menu-items .menu-item:nth-child(${this.cart.length + 1})`);
            // We'll store temporarily
            db.ref('products/' + itemId).once('value').then(snap => {
                if (snap.exists()) {
                    const item = snap.val();
                    if (Number(item.stock || 0) <= 0) { alert('Item is sold out'); return; }
                    const img = (item.images && item.images.length > 0) ? item.images[0] : item.image;
                    this.cart.push({ id: itemId, name: item.name, price: item.price, image: img, qty: 1, restaurantId: this.currentRestaurant?.id, sellerId: item.sellerId });
                    this.updateCartUI();
                    this.loadMenuItems(this.currentRestaurant?.id);
                }
            });
            return;
        }
        this.updateCartUI();
        // Refresh menu modal to update buttons
        if (this.currentRestaurant) this.loadMenuItems(this.currentRestaurant.id);
    },

    updateCartUI: function() {
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const count = this.cart.reduce((sum, item) => sum + item.qty, 0);
        const floating = document.getElementById('cart-floating');
        if (count > 0) {
            floating.style.display = 'block';
            document.getElementById('cart-summary').textContent = `${count} item${count > 1 ? 's' : ''} • ₹${total.toFixed(2)}`;
        } else {
            floating.style.display = 'none';
        }
        if (document.getElementById('cart-subtotal')) document.getElementById('cart-subtotal').textContent = `Total: ₹${total.toFixed(2)}`;
        this.updateCheckoutTotals();
    },

    applyCoupon: async function() {
        const code = (document.getElementById('checkout-coupon').value || '').trim().toUpperCase();
        const msg = document.getElementById('coupon-message');
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        if (!code) {
            this.coupon = null; this.couponDiscount = 0; this.updateCheckoutTotals();
            if (msg) msg.textContent = 'Enter a coupon code first.';
            return;
        }
        try {
            const snap = await db.ref('coupons').orderByChild('code').equalTo(code).once('value');
            let found = null;
            if (snap.exists()) {
                snap.forEach(c => {
                    const coupon = c.val();
                    if (coupon.active !== false && (!coupon.restaurantId || coupon.restaurantId === this.currentRestaurant?.id) && (!coupon.expiry || new Date(coupon.expiry).getTime() >= Date.now())) found = coupon;
                });
            }
            if (!found) throw new Error('Invalid or inactive coupon.');
            const minOrder = Number(found.minOrder || 0);
            if (total < minOrder) throw new Error(`Minimum order for this coupon is ₹${minOrder}.`);
            const discount = found.discountType === 'percent' ? Math.min(Number(found.discountValue || 0), 200) / 100 * total : Number(found.discountValue || 0);
            this.coupon = found;
            this.couponDiscount = Math.min(discount, total);
            this.updateCheckoutTotals();
            if (msg) {
                msg.className = 'text-success fw-bold mt-2';
                msg.textContent = `Coupon applied: ${found.name || code}`;
            }
        } catch (e) {
            this.coupon = null; this.couponDiscount = 0; this.updateCheckoutTotals();
            if (msg) {
                msg.className = 'text-danger fw-bold mt-2';
                msg.textContent = e.message;
            }
        }
    },

    updateCouponSummary: function(total) {
        const discountRow = document.getElementById('coupon-discount-row');
        const discount = document.getElementById('coupon-discount');
        const payable = document.getElementById('payable-total');
        if (!discountRow || !discount || !payable) return;
        discountRow.style.display = this.couponDiscount > 0 ? 'flex' : 'none';
        discount.textContent = `- ₹${this.couponDiscount.toFixed(2)}`;
        payable.textContent = `₹${Math.max(0, total - this.couponDiscount).toFixed(2)}`;
    },

    calculateDeliveryFee: function() {
        if (!this.currentRestaurant) return 0;
        // Use restaurant's configured delivery fee (even if 0 = free delivery)
        const configured = Number(this.currentRestaurant.deliveryFee || 0);
        return configured;
    },

    updateCheckoutTotals: function() {
        const itemTotal = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        this.deliveryFee = this.calculateDeliveryFee();
        // Wallet removed: payable does not include wallet discounts
        const payable = Math.max(0, itemTotal + this.deliveryFee - this.couponDiscount);

        const deliveryEl = document.getElementById('delivery-fee-total');
        if (deliveryEl) deliveryEl.textContent = '₹' + this.deliveryFee.toFixed(2);

        // Hide wallet row if present
        const walletRow = document.getElementById('wallet-discount-row');
        if (walletRow) walletRow.style.display = 'none';

        this.updateCouponSummary(itemTotal);
        if (document.getElementById('payable-total')) document.getElementById('payable-total').textContent = '₹' + payable.toFixed(2);
    },




    showOrderSuccess: function() {
        const overlay = document.getElementById('order-success-overlay');
        overlay.style.display = 'grid';
        setTimeout(() => { overlay.style.display = 'none'; }, 1800);
    },

    showCart: function() {
        const container = document.getElementById('cart-items');
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        if (this.cart.length === 0) {
            container.innerHTML = '<div class="text-center py-4"><i class="fas fa-shopping-cart fa-3x text-muted mb-3"></i><p>Your cart is empty</p></div>';
            document.getElementById('cart-subtotal').textContent = 'Total: ₹0';
        } else {
            container.innerHTML = this.cart.map((item, i) => `
                <div class="checkout-item">
                    <img src="${item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'}" alt="${item.name}">
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${item.name}</h6>
                        <span class="fw-bold text-primary">₹${(item.price * item.qty).toFixed(2)}</span>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <button class="btn btn-sm btn-outline-danger rounded-circle" onclick="Foodie.updateCartFromModal(${i}, -1)">-</button>
                        <span class="fw-bold">${item.qty}</span>
                        <button class="btn btn-sm btn-outline-primary rounded-circle" onclick="Foodie.updateCartFromModal(${i}, 1)">+</button>
                        <button class="btn btn-sm btn-outline-danger ms-2" onclick="Foodie.removeCartItem(${i})"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            `).join('');
            document.getElementById('cart-subtotal').textContent = `Total: ₹${total.toFixed(2)}`;
        }
        new bootstrap.Modal(document.getElementById('cartModal')).show();
    },

    updateCartFromModal: function(index, change) {
        this.cart[index].qty += change;
        if (this.cart[index].qty <= 0) this.cart.splice(index, 1);
        this.updateCartUI();
        this.showCart();
    },

    removeCartItem: function(index) {
        this.cart.splice(index, 1);
        this.updateCartUI();
        this.showCart();
    },

    // ====== CHECKOUT ======
    proceedToCheckout: function() {
        if (!this.currentUser) { window.location.href = 'login.html'; return; }
        bootstrap.Modal.getInstance(document.getElementById('cartModal')).hide();
        // Pre-fill user info if available
        if (this.currentUser) {
            db.ref('users/' + this.currentUser.uid + '/profile').once('value').then(snap => {
                if (snap.exists()) {
                    const p = snap.val();
                    if (p.name) document.getElementById('checkout-name').value = p.name;
                    if (p.phone) document.getElementById('checkout-phone').value = p.phone;
                    if (p.address) document.getElementById('checkout-address').value = p.address;
                    if (p.city) document.getElementById('checkout-city').value = p.city;
                    if (p.pincode) document.getElementById('checkout-pincode').value = p.pincode;
                    document.getElementById('checkout-email').value = this.currentUser.email || '';
                }
            });
        }
        this.coupon = null;
        this.couponDiscount = 0;
        this.deliveryFee = this.calculateDeliveryFee();
        this.walletDiscount = 0;
        document.getElementById('checkout-coupon').value = '';
        // Wallet removed UI
        this.updateCheckoutTotals();

        new bootstrap.Modal(document.getElementById('checkoutModal')).show();
    },

    placeOrder: async function() {
        if (!this.currentUser) { alert('Please login first'); return; }

        const name = document.getElementById('checkout-name').value.trim();
        const phone = document.getElementById('checkout-phone').value.trim();
        const city = document.getElementById('checkout-city').value.trim();
        const pincode = document.getElementById('checkout-pincode').value.trim();
        const resolvedAddress = document.getElementById('checkout-address').value.trim();


        // Location: try hidden fields first, otherwise fallback to last saved location
        let lat = document.getElementById('checkout-lat').value;
        let lng = document.getElementById('checkout-lng').value;

        const distanceEl = document.getElementById('geo-status');
        if (distanceEl) distanceEl.innerHTML = '';


        if ((!lat || !lng) && localStorage.getItem('foodie-last-location')) {
            try {
                const saved = JSON.parse(localStorage.getItem('foodie-last-location'));
                lat = lat || saved.lat;
                lng = lng || saved.lng;
                if (lat && lng) {
                    document.getElementById('checkout-lat').value = lat;
                    document.getElementById('checkout-lng').value = lng;
                }
            } catch (e) {}
        }


        if (!name || !phone || !resolvedAddress || !city || !pincode) {
            alert('Please fill all required fields');
            return;
        }

        if (!lat || !lng) {
            alert('Please enable location access and get current location to place an order.');
            return;
        }




        try {
            const itemTotal = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
            const payable = Math.max(0, itemTotal + this.deliveryFee - this.couponDiscount);

            // Save order
            const orderRef = db.ref('orders').push();
            await orderRef.set({
                customerId: this.currentUser.uid,
                customerName: name,
                customerPhone: phone,
                customerEmail: document.getElementById('checkout-email').value.trim() || '',
                restaurantId: this.currentRestaurant?.id || '',
                restaurantName: this.currentRestaurant?.name || '',
                items: this.cart.map(item => ({ name: item.name, price: item.price, qty: item.qty })),
                totalAmount: itemTotal,
                deliveryFee: this.deliveryFee,
                couponCode: this.coupon ? (this.coupon.code || '') : '',
                couponDiscount: this.couponDiscount || 0,
                finalAmount: payable,

                deliveryAddress: resolvedAddress,
                city: city,
                pincode: pincode,
                customerLat: parseFloat(lat) || 0,
                customerLng: parseFloat(lng) || 0,
                orderNotes: document.getElementById('checkout-notes').value.trim() || '',
                status: 'Pending',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });

            // Save user profile
            await db.ref('users/' + this.currentUser.uid + '/profile').update({
                name: name,
                phone: phone,
                address: resolvedAddress,
                city: city,
                pincode: pincode
            });



            this.cart = [];
            this.updateCartUI();
            alert('🎉 Order placed successfully! Track it in My Orders.');
            this.showOrderSuccess();
            setTimeout(() => {
                bootstrap.Modal.getInstance(document.getElementById('checkoutModal')).hide();
                window.location.href = 'customer-orders.html';
            }, 1700);
        } catch (e) { alert('Error: ' + e.message); }
    }
};

// ====== GEOFENCING CONSTANTS ======
const ISMAILABAD_CENTER = { lat: 30.166, lng: 76.717 };

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
}

function getLocation() {
    Foodie.getCurrentLocation(true);
}

// ====== INIT ======
document.addEventListener('DOMContentLoaded', () => Foodie.init());