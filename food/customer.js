 // ============================================
// IBAD FOODIE - Customer Module
// Restaurant browsing, cart, menu, ordering
// ============================================
window.Foodie = {
    currentUser: null,
    cart: [],
    currentRestaurant: null,
    coupon: null,
    couponDiscount: 0,
    deliveryFee: 0,
    walletDiscount: 0,
    otpVerified: false,
    categories: ['All', 'Pizza', 'Burger', 'Biryani', 'Chinese', 'South Indian', 'North Indian', 'Desserts', 'Beverages', 'Snacks', 'Other'],

    saveCartToStorage: function() {
        try { localStorage.setItem('foodie-cart', JSON.stringify(this.cart)); } catch (e) {}
    },

    loadCartFromStorage: function() {
        try {
            const saved = localStorage.getItem('foodie-cart');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) this.cart = parsed;
            }
        } catch (e) { this.cart = []; }
    },

    getCartCount: function() {
        return this.cart.reduce((sum, item) => sum + item.qty, 0);
    },

    getCartTotal: function() {
        return this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    },

    // ====== DYNAMIC OFFERS & BANNERS (Loaded from Firebase) ======
    loadBanners: async function() {
        try {
            const snap = await db.ref('offers').once('value');
            if (!snap.exists()) return;

            const bannerEl = document.getElementById('offer-banner');
            if (!bannerEl) return;

            let bannerFound = false;
            snap.forEach(c => {
                const o = c.val() || {};
                if (o.type !== 'platform') return;
                const expired = o.expiry ? new Date(o.expiry).getTime() < Date.now() : false;
                if (o.active === false || expired) return;
                bannerFound = true;

                const titleEl = document.getElementById('banner-title');
                const descEl = document.getElementById('banner-description');
                const badgeEl = document.getElementById('banner-coupon-badge');

                if (titleEl) titleEl.textContent = o.title || 'Today\'s Special Offers!';
                if (descEl) descEl.textContent = o.description || 'Get great discounts on your orders!';
                if (badgeEl) badgeEl.textContent = (o.coupon ? '🏷️ ' + o.coupon : '🔥 Limited Offer');

                // Optional: set background image or color
                if (o.image) {
                    bannerEl.style.backgroundImage = 'url(' + o.image + ')';
                    bannerEl.style.backgroundSize = 'cover';
                    bannerEl.style.backgroundPosition = 'center';
                }
                if (o.bgColor) {
                    bannerEl.style.backgroundColor = o.bgColor;
                }
            });

            bannerEl.style.display = bannerFound ? '' : 'none';
        } catch (e) { console.error('Error loading banner:', e); }
    },

    loadRestaurantOffersStrip: async function() {
        try {
            const snap = await db.ref('offers').once('value');
            if (!snap.exists()) return;

            const stripEl = document.getElementById('restaurant-offers-strip');
            const cardsEl = document.getElementById('restaurant-offers-cards');
            if (!stripEl || !cardsEl) return;

            let offersHtml = '';
            let hasOffers = false;

            snap.forEach(c => {
                const o = c.val() || {};
                if (o.type !== 'restaurant') return;
                const expired = o.expiry ? new Date(o.expiry).getTime() < Date.now() : false;
                if (o.active === false || expired) return;
                hasOffers = true;

                const discountLabel = o.discountValue 
                    ? (o.discountType === 'percent' ? o.discountValue + '% OFF' : '₹' + o.discountValue + ' OFF')
                    : 'Special Offer';

                offersHtml += `
                    <div class="col-lg-4 col-md-6 mb-3">
                        <div class="card h-100" style="border-radius:16px;overflow:hidden;border:1px solid #ffeaa7;background:linear-gradient(135deg,#fff9e6,#fff3cd);">
                            <div class="card-body">
                                <div class="d-flex align-items-start gap-2 mb-2">
                                    <i class="fas fa-tag" style="color:#e17055;font-size:1.2rem;"></i>
                                    <div>
                                        <h6 class="fw-bold mb-1" style="color:#e17055;">${this._safe(o.title || 'Restaurant Offer')}</h6>
                                        ${o.restaurantName ? `<p class="mb-1 small"><i class="fas fa-store me-1"></i>${this._safe(o.restaurantName)}</p>` : ''}
                                        ${o.description ? `<p class="mb-1 small text-muted">${this._safe(o.description)}</p>` : ''}
                                        <span class="badge bg-warning text-dark">${discountLabel}</span>
                                        ${o.minOrder ? `<span class="badge bg-light text-dark ms-1">Min ₹${o.minOrder}</span>` : ''}
                                        ${o.coupon ? `<span class="badge bg-dark text-white ms-1">Code: ${this._safe(o.coupon)}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            if (hasOffers) {
                cardsEl.innerHTML = offersHtml;
                stripEl.style.display = 'block';
            } else {
                stripEl.style.display = 'none';
            }
        } catch (e) { console.error('Error loading restaurant offers:', e); }
    },

    init: async function() {
        const authState = await auth.init();
        this.currentUser = authState.user;
        this.updateNav();
        this.loadCartFromStorage();
        await this.syncCartRestaurantContext();
        this.loadCategories();
        this.loadBanners();
        this.loadRestaurantOffersStrip();
        this.loadProductsNearbyIndex();

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
                    // Sound + vibration (mobile)
                    try {
                        const nSound = document.getElementById('notification-sound');
                        if (nSound) {
                            nSound.currentTime = 0;
                            nSound.play().catch(() => {});
                        }
                    } catch (e) {}
                    try { if (navigator.vibrate) navigator.vibrate([300, 120, 300]); } catch (e) {}

                    // UI
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
        const status = document.getElementById('checkout-location-status') || document.getElementById('location-status');
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
        const hide = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
        const show = (id) => { const el = document.getElementById(id); if (el) el.style.display = 'block'; };

        if (this.currentUser) {
            show('nav-logout');
            hide('nav-login');
            hide('nav-register');
            show('nav-orders');
            show('nav-profile');

        } else {
            hide('nav-logout');
            show('nav-login');
            show('nav-register');
            hide('nav-orders');
            hide('nav-profile');
        }
    },

    // ====== SEARCH (Zomato-style: Items-first + Restaurant filter) ======
    searchEverything: async function(query) {
        const q = (query || '').toLowerCase().trim();
        const productCards = document.querySelectorAll('#products-list [data-product-card="1"]');
        const productsContainer = document.getElementById('products-list');
        const restaurantCards = document.querySelectorAll('.restaurant-card');
        const container = document.getElementById('restaurants-list');


        if (!restaurantCards || restaurantCards.length === 0) return;

        // cleanup old empty (restaurants + products)
        if (container) {
            const existingEmpty = container.querySelector('[data-empty-search="1"]');
            if (existingEmpty) existingEmpty.remove();
        }
        if (productsContainer) {
            const existingEmpty2 = productsContainer.querySelector('[data-empty-search="1"]');
            if (existingEmpty2) existingEmpty2.remove();
        }

        if (!q) {
            // index products view
            if (productsContainer) {
                productCards.forEach(el => (el.style.display = ''));
            }
            // restaurants view
            if (restaurantCards && restaurantCards.length) {
                restaurantCards.forEach(card => card.style.display = '');
            }
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

        // Index products view filtering
        if (productsContainer) {
            if (!q) return;
            const productIdsMatched = new Set(itemMatches.map(p => p.id).filter(Boolean));
            productCards.forEach(card => {
                const pid = card.dataset.productId;
                card.style.display = productIdsMatched.has(pid) ? '' : 'none';
            });
            const visibleProducts = Array.from(productCards).filter(c => c.style.display !== 'none');
            if (visibleProducts.length === 0) {
                productsContainer.insertAdjacentHTML('beforeend', `
                    <div data-empty-search="1" class="col-12 text-center py-5">
                        <div class="empty-state">
                            <i class="fas fa-search"></i>
                            <h4>No Match Found</h4>
                            <p class="text-muted">Try with item name like “pizza” or cuisine like “biryani”.</p>
                        </div>
                    </div>
                `);
            }
        }

        // Restaurants view filtering (original)
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

        if (!container) return;
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

    // ====== ZOMATO-STYLE INDEX WITH CATEGORY SECTIONS ======
    loadProductsNearbyIndex: async function() {
        const container = document.getElementById('products-list');
        const catContainer = document.getElementById('items-container');
        if (!container) return;

        const q = (document.getElementById('search-input')?.value || '').trim();
        container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-3">Finding items near you...</p></div>';

        let userLat = null, userLng = null;
        try {
            const saved = localStorage.getItem('foodie-last-location');
            if (saved) { const loc = JSON.parse(saved); userLat = loc.lat; userLng = loc.lng; }
        } catch(e) {}
        try {
            const latEl = document.getElementById('checkout-lat');
            const lngEl = document.getElementById('checkout-lng');
            if (latEl && lngEl) { userLat = userLat || latEl.value; userLng = userLng || lngEl.value; }
        } catch(e) {}
        if (!userLat || !userLng) { userLat = null; userLng = null; }

        try {
            const restsSnap = await db.ref('restaurants').once('value');
            const restaurantMap = {};
            if (restsSnap.exists()) {
                restsSnap.forEach(c => {
                    const r = c.val() || {};
                    restaurantMap[c.key] = { id: c.key, ...r, 
                        lat: r.lat ?? r.latitude ?? r.locationLat,
                        lng: r.lng ?? r.longitude ?? r.locationLng
                    };
                });
            }

            const prodSnap = await db.ref('products').once('value');
            const products = [];
            if (prodSnap.exists()) {
                prodSnap.forEach(c => {
                    const p = c.val();
                    if (p.active === false) return;
                    products.push({ id: c.key, ...p });
                });
            }

            if (!products.length) {
                container.innerHTML = '<div class="col-12 text-center py-5"><div class="empty-state"><i class="fas fa-utensils"></i><h4>No Menu Items Yet</h4><p>Be the first to add products.</p></div></div>';
                return;
            }

            // Filter by distance
            const filtered = userLat && userLng ? products.filter(p => {
                const r = restaurantMap[p.sellerId];
                if (!r || !r.lat || !r.lng) return false;
                return calculateDistance(Number(userLat), Number(userLng), Number(r.lat), Number(r.lng)) <= MAX_DELIVERY_RADIUS_KM;
            }) : products;
            const list = filtered.length ? filtered : products;

            // Group by category
            const grouped = {};
            list.forEach(p => {
                const cat = p.category || 'Other';
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push(p);
            });

            const cartQtyMap = {};
            this.cart.forEach(ci => cartQtyMap[ci.id] = ci.qty);

            const safeText = (v) => this._safe(v);

            // Build category-section HTML + flat list for legacy container
            let categoryHtml = '';
            let flatHtml = '';

            Object.keys(grouped).forEach(cat => {
                const items = grouped[cat];
                categoryHtml += `
                    <div class="category-section-title" data-cat="${safeText(cat)}">
                        <h3>${this.getCategoryIcon(cat)} ${safeText(cat)}</h3>
                        <span>${items.length}</span>
                    </div>
                    <div class="row">
                        ${items.map(p => {
                            const img = (p.images && p.images.length) ? p.images[0] : (p.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200');
                            const r = restaurantMap[p.sellerId] || {};
                            const stock = Number(p.stock || 0);
                            const qty = cartQtyMap[p.id] || 0;
                            const isVeg = p.isVeg !== false;
                            const isOnline = r.isOnline !== false;
                            return `
                                <div class="col-lg-3 col-md-4 col-sm-6 mb-4" data-product-card="1" data-product-id="${safeText(p.id)}" data-category="${safeText(p.category || 'Other')}">
                                    <div class="product-item-card">
                                        <div class="item-img-wrap" onclick="window.location.href='product.html?id=${safeText(p.id)}'">
                                            <img src="${safeText(img)}" alt="${safeText(p.name)}" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200'">
                                            <div class="veg-badge ${isVeg ? '' : 'non-veg'}">${isVeg ? '🟢' : '🔴'}</div>
                                            ${p.offer ? `<div class="offer-badge-top">${safeText(p.offer)}</div>` : ''}
                                        </div>
                                        <div class="item-body">
                                            <h6 onclick="window.location.href='product.html?id=${safeText(p.id)}'">${safeText(p.name)}</h6>
                                            <div class="item-desc">${safeText(p.description || '')}</div>
                                            <div class="item-meta">
                                                ${p.portionSize ? `<span>${safeText(p.portionSize)}</span>` : ''}
                                                ${p.preparationTime ? `<span>${safeText(p.preparationTime)} min</span>` : ''}
                                                <span>${stock > 0 ? stock + ' left' : 'Sold out'}</span>
                                                ${!isOnline ? '<span class="badge bg-danger text-white">Offline</span>' : ''}
                                            </div>
                                            <div class="price-row">
                                                <span class="price">₹${Number(p.price || 0).toFixed(2)}</span>
                                                ${r.name ? `<a href="restaurant-detail.html?id=${encodeURIComponent(r.id || p.sellerId)}" class="rest-name"><i class="fas fa-store me-1"></i>${safeText(r.name)}</a>` : ''}
                                            </div>
                                            <div class="mt-2">
                                                ${qty > 0 ? `
                                                    <div class="d-flex align-items-center gap-2">
                                                         <button class="btn btn-sm btn-outline-primary rounded-circle" onclick="event.stopPropagation(); Foodie.updateCart('${p.id}', -1); Foodie.loadProductsNearbyIndex()">-</button>
                                                         <span class="fw-bold">${qty}</span>
                                                         <button class="btn btn-sm btn-outline-primary rounded-circle" onclick="event.stopPropagation(); Foodie.updateCart('${p.id}', 1); Foodie.loadProductsNearbyIndex()" ${!isOnline ? 'disabled' : ''}>+</button>
                                                    </div>
                                                ` : `
                                                    <button class="add-btn" onclick="event.stopPropagation(); Foodie.updateCart('${p.id}', 1); Foodie.loadProductsNearbyIndex()" ${stock <= 0 || !isOnline ? 'disabled' : ''}>${!isOnline ? 'Offline' : (stock <= 0 ? 'Sold Out' : '+ Add')}</button>
                                                `}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;

                // Also build flat list
                flatHtml += items.map(p => {
                    const img = (p.images && p.images.length) ? p.images[0] : (p.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200');
                    const r = restaurantMap[p.sellerId] || {};
                    const stock = Number(p.stock || 0);
                    const qty = cartQtyMap[p.id] || 0;
                    const isOnline = r.isOnline !== false;
                    const distLabel = (userLat && userLng && r.lat && r.lng) ? `${calculateDistance(Number(userLat), Number(userLng), Number(r.lat), Number(r.lng)).toFixed(1)} km` : '';
                    const metaArr = [p.category, p.portionSize ? 'Portion: '+p.portionSize : '', p.preparationTime ? p.preparationTime+' min' : '', stock > 0 ? stock+' available' : 'Out of stock', !isOnline ? 'Offline' : ''].filter(Boolean);
                    return `
                        <div class="col-lg-6 mb-3" data-product-card="1" data-product-id="${safeText(p.id)}" data-category="${safeText(p.category || 'Other')}">
                            <div class="card" style="overflow:hidden;">
                                <div class="row g-0">
                                    <div class="col-4 col-sm-3">
                                        <img src="${safeText(img)}" style="width:100%;height:140px;object-fit:cover;cursor:pointer;" onclick="window.location.href='product.html?id=${safeText(p.id)}'" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200'">
                                    </div>
                                    <div class="col-8 col-sm-9">
                                        <div class="p-3">
                                            <div class="d-flex align-items-start justify-content-between gap-2">
                                                <div>
                                                    <h5 class="mb-1"><a href="product.html?id=${safeText(p.id)}" class="text-decoration-none" style="color:inherit;">${safeText(p.name)}</a></h5>
                                                    <div class="text-muted small mb-1">${safeText(p.description || '')}</div>
                                                    <div class="d-flex flex-wrap gap-2 align-items-center">
                                                        ${p.isVeg === false ? '<span class="badge bg-danger">Non-Veg</span>' : '<span class="badge bg-success">Veg</span>'}
                                                         ${p.offer ? `<span class="badge bg-warning text-dark me-1">${safeText(p.offer)}</span>` : ''}
                                                         ${!isOnline ? '<span class="badge bg-danger text-white me-1">Offline</span>' : ''}
                                                         ${r.name ? `<a href="restaurant-detail.html?id=${encodeURIComponent(r.id || p.sellerId)}" class="badge bg-light text-dark border text-decoration-none">${safeText(r.name)}</a>` : ''}
                                                        ${distLabel ? `<span class="badge bg-white text-dark border">🚚 ${safeText(distLabel)}</span>` : ''}
                                                    </div>
                                                </div>
                                                <div class="text-end">
                                                    <div class="fw-bold" style="color:var(--primary);font-size:1.15rem;">₹${Number(p.price || 0).toFixed(2)}</div>
                                                </div>
                                            </div>
                                            <div class="menu-meta" style="margin-top:8px;">${metaArr.map(m => `<span>${safeText(m)}</span>`).join('')}</div>
                                            ${p.ingredients ? `<div class="text-muted small mt-2"><i class="fas fa-seedling me-1"></i>${safeText(p.ingredients)}</div>` : ''}
                                            <div class="mt-3">
                                                ${qty > 0 ? `
                                                    <div class="d-flex align-items-center gap-2">
                                                         <button class="btn btn-sm btn-outline-primary rounded-circle" onclick="Foodie.updateCart('${p.id}', -1)">-</button>
                                                         <span class="fw-bold">${qty}</span>
                                                         <button class="btn btn-sm btn-outline-primary rounded-circle" onclick="Foodie.updateCart('${p.id}', 1)" ${!isOnline ? 'disabled' : ''}>+</button>
                                                    </div>
                                                ` : `
                                                    <button class="add-btn" onclick="Foodie.updateCart('${p.id}', 1)" ${stock <= 0 || !isOnline ? 'disabled' : ''}>${!isOnline ? 'Offline' : (stock <= 0 ? 'Sold Out' : '+ Add')}</button>
                                                `}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            });

            // Render category-organized section
            if (catContainer) {
                catContainer.innerHTML = categoryHtml || '<div class="col-12 text-center py-5"><div class="empty-state"><i class="fas fa-utensils"></i><h4>No Items Found</h4><p>Try searching something else!</p></div></div>';
            }

            // Render flat list for legacy search compatibility
            container.innerHTML = flatHtml || '<div class="col-12 text-center py-5"><div class="empty-state"><i class="fas fa-utensils"></i><h4>No Items Found</h4><p>Try searching something else!</p></div></div>';

            await this.ensureProductCache();

        } catch (e) {
            container.innerHTML = `<div class="col-12"><div class="alert alert-danger">Error: ${e.message}</div></div>`;
        }
    },

    // ====== RESTAURANTS (PAge: restaurant.html only)
    loadRestaurantsPage: async function() {


        const container = document.getElementById('restaurants-list');
        if (!container) return;
        container.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-3">Finding best restaurants...</p></div>';
        try {
            const snap = await db.ref('restaurants').once('value');
            container.innerHTML = '';
            if (!snap.exists()) {
                container.innerHTML = '<div class="col-12 text-center py-5"><div class="empty-state"><i class="fas fa-store"></i><h4>No Restaurants Yet</h4><p>Be the first to register your restaurant!</p></div></div>';
                return;
            }
            const restaurants = [];
            snap.forEach(child => {
                restaurants.push({ id: child.key, ...child.val() });
            });

            if (!restaurants.length) {
                container.innerHTML = '<div class="col-12 text-center py-5"><div class="empty-state"><i class="fas fa-store"></i><h4>No Restaurants Yet</h4><p>Be the first to register your restaurant!</p></div></div>';
                return;
            }

            const productCounts = {};
            const productsSnap = await db.ref('products').once('value');
            if (productsSnap.exists()) {
                productsSnap.forEach(child => {
                    const p = child.val();
                    const sid = p.sellerId;
                    if (sid) productCounts[sid] = (productCounts[sid] || 0) + 1;
                });
            }

            container.innerHTML = restaurants.map(r => {
                // IMPORTANT: Do NOT use _safe() on image URLs as it escapes & to & breaking CDN URLs
                const banner = r.banner || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600';
                const logo = r.logo || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150';
                const offer = r.offer ? `<div class="offer-badge">${this._safe(r.offer)}</div>` : '';
                const productCount = productCounts[r.id] || 0;
                const deliveryFeeText = r.deliveryFee ? '₹' + r.deliveryFee : 'Calculated';
                const isOnline = r.isOnline !== false;
                const offlineStyle = isOnline ? '' : 'opacity: 0.7; filter: grayscale(80%);';
                const offlineOverlay = isOnline ? '' : '<div class="position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center" style="background: rgba(0,0,0,0.5); z-index: 10;"><span class="bg-danger text-white px-3 py-1 rounded fw-bold">Currently Offline</span></div>';

                // Only escape characters that would break HTML attribute boundaries, but preserve & for URLs
                const safeUrl = (url) => url ? url.replace(/"/g, '"').replace(/'/g, '&#039;') : '';
                const safeName = this._safe(r.name || '');
                const safeCuisine = this._safe(r.cuisine || 'Multi-Cuisine');
                const safeAddress = this._safe(r.address || '');

                return `
                    <div class="col-lg-3 col-md-4 col-sm-6 mb-4">
                        <div class="restaurant-card" data-id="${r.id}" style="cursor:${isOnline ? 'pointer' : 'not-allowed'}; position: relative; ${offlineStyle}">
                            ${offlineOverlay}
                            <div class="banner-wrap">
                                <img src="${safeUrl(banner)}" alt="${safeName}" onerror="this.src='https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600'">
                                ${offer}
                                <div class="logo-wrap"><img src="${safeUrl(logo)}" alt="${safeName}" onerror="this.src='https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150'"></div>
                            </div>
                            <div class="card-body" ${isOnline ? `onclick="Foodie.openRestaurantDetailModal('${r.id}')"` : ''}>
                                <h5>${safeName}</h5>
                                <p class="text-muted small mb-2">${safeCuisine}</p>
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="rating"><i class="fas fa-star me-1"></i>${r.rating || '4.0'}</span>
                                    <span class="delivery-time"><i class="fas fa-clock me-1"></i>${r.deliveryTime || '30'} mins</span>
                                </div>
                                <p class="text-muted small mt-2 mb-0">${safeAddress}</p>
                                <p class="text-muted small mt-1 mb-0"><i class="fas fa-motorcycle me-1"></i>Delivery: ${deliveryFeeText}</p>
                                <p class="text-muted small mt-1 mb-0"><i class="fas fa-hamburger me-1"></i>${productCount} items</p>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (e) {
            container.innerHTML = `<div class="col-12"><div class="alert alert-danger">Error: ${e.message}</div></div>`;
        }
    },

    openRestaurantDetailModal: async function(restId) {
        // Redirect to the dedicated restaurant detail page
        window.location.href = 'restaurant-detail.html?id=' + encodeURIComponent(restId);
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
                if (p.active === false) return;
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
        const path = window.location.pathname;
        if (path.includes('restaurant.html') || path.includes('restaurant-detail.html')) return;
        // Redirect to dedicated restaurant detail page
        window.location.href = 'restaurant-detail.html?id=' + encodeURIComponent(restId);
    },

    shareRestaurant: async function(restId) {
        const snap = await db.ref('restaurants/' + restId).once('value');
        const r = snap.val() || {};
        const url = window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'restaurant-detail.html?id=' + restId;
        const text = `Check out ${r.name || 'this restaurant'} on Ibad Foodie!`;
        if (navigator.share) {
            navigator.share({ title: r.name || 'Restaurant', text, url });
        } else {
            navigator.clipboard.writeText(url).then(() => alert('Restaurant link copied!'));
        }
    },

    // ====== RESTAURANT DETAIL ======
    openRestaurant: async function(restId) {
        const path = window.location.pathname;
        // Redirect to dedicated restaurant detail page
        window.location.href = 'restaurant-detail.html?id=' + encodeURIComponent(restId);
    },

    loadMenuItems: async function(restId, containerId, isPage) {
        const container = document.getElementById(containerId || 'menu-items');
        if (!container) return;
        try {
            const snap = await db.ref('products').orderByChild('sellerId').equalTo(restId).once('value');
            container.innerHTML = '';
            if (!snap.exists()) {
                container.innerHTML = '<p class="text-muted">No menu items yet</p>';
                return;
            }
            snap.forEach(child => {
                const item = child.val();
                if (item.active === false) return;
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
                if (isPage) {
                    div.className = 'col-lg-6 mb-3';
                    div.innerHTML = `
                        <div class="card menu-item" style="padding:16px;">
                            <div class="d-flex gap-3 w-100">
                                <img src="${this._safe(img)}" alt="${this._safe(item.name)}" style="width:120px;height:120px;border-radius:12px;object-fit:cover;">
                                <div class="flex-grow-1">
                                    <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                        <h5 class="mb-0">${this._safe(item.name)}</h5>
                                        ${item.isVeg === false ? '<span class="badge bg-danger">Non-Veg</span>' : '<span class="badge bg-success">Veg</span>'}
                                        ${offer}
                                    </div>
                                    <div class="text-muted small mb-2">${this._safe(item.description || '')}</div>
                                    ${item.ingredients ? `<div class="text-muted small mb-2"><i class="fas fa-seedling me-1"></i>${this._safe(item.ingredients)}</div>` : ''}
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <div class="fw-bold" style="color:var(--primary);font-size:1.1rem;">₹${Number(item.price || 0).toFixed(2)}</div>
                                    </div>
                                    <div class="menu-meta">${meta}</div>
                                    <div class="mt-3">
                                        ${qty > 0 ? `
                                            <div class="d-flex align-items-center gap-2">
                                                <button class="btn btn-sm btn-outline-primary rounded-circle" onclick="Foodie.updateCart('${child.key}', -1)">-</button>
                                                <span class="fw-bold">${qty}</span>
                                                <button class="btn btn-sm btn-outline-primary rounded-circle" onclick="Foodie.updateCart('${child.key}', 1)">+</button>
                                            </div>
                                        ` : `
                                            <button class="add-btn" onclick="Foodie.updateCart('${child.key}', 1)" ${stock <= 0 ? 'disabled' : ''}>
                                                ${stock <= 0 ? 'Sold Out' : '+ Add'}
                                            </button>
                                        `}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
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
                }
                container.appendChild(div);
            });
        } catch (e) { container.innerHTML = `<p class="text-danger">Error: ${e.message}</p>`; }
    },

    renderRestaurantMenu: async function(restId) {
        const grid = document.getElementById('menu-grid');
        if (!grid) return;
        grid.innerHTML = '<div class="col-12 text-center py-3"><div class="spinner-border text-primary"></div></div>';
        try {
            const menuSnap = await db.ref('products').orderByChild('sellerId').equalTo(restId).once('value');
            const items = [];
            if (menuSnap.exists()) {
                menuSnap.forEach(c => {
                    const item = c.val();
                    if (item.active === false) return;
                    items.push({ id: c.key, ...item });
                });
            }
            grid.innerHTML = '';
            if (!items.length) {
                grid.innerHTML = '<div class="col-12 text-center py-5"><p class="text-muted">No menu items yet</p></div>';
                return;
            }
            for (const item of items) {
                const qty = this.cart.find(c => c.id === item.id)?.qty || 0;
                const stock = Number(item.stock || 0);
                const img = (item.images && item.images.length > 0) ? item.images[0] : (item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200');
                const offer = item.offer ? `<span class="badge bg-warning text-dark me-1">${this._safe(item.offer)}</span>` : '';
                const meta = [
                    item.category,
                    item.portionSize ? `Portion: ${item.portionSize}` : '',
                    item.preparationTime ? `${item.preparationTime} min` : '',
                    stock > 0 ? `${stock} available` : 'Out of stock'
                ].filter(Boolean).map(v => `<span>${this._safe(v)}</span>`).join('');

                const card = document.createElement('div');
                card.className = 'col-lg-6 mb-3';
                card.innerHTML = `
                    <div class="card menu-item" style="padding:16px;">
                        <div class="d-flex gap-3 w-100">
                            <img src="${this._safe(img)}" alt="${this._safe(item.name)}" style="width:120px;height:120px;border-radius:12px;object-fit:cover;">
                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                    <h5 class="mb-0">${this._safe(item.name)}</h5>
                                    ${item.isVeg === false ? '<span class="badge bg-danger">Non-Veg</span>' : '<span class="badge bg-success">Veg</span>'}
                                    ${offer}
                                </div>
                                <div class="text-muted small mb-2">${this._safe(item.description || '')}</div>
                                ${item.ingredients ? `<div class="text-muted small mb-2"><i class="fas fa-seedling me-1"></i>${this._safe(item.ingredients)}</div>` : ''}
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <div class="fw-bold" style="color:var(--primary);font-size:1.1rem;">₹${Number(item.price || 0).toFixed(2)}</div>
                                </div>
                                <div class="menu-meta">${meta}</div>
                                <div class="mt-3">
                                    ${qty > 0 ? `
                                        <div class="d-flex align-items-center gap-2">
                                            <button class="btn btn-sm btn-outline-primary rounded-circle" onclick="Foodie.updateCart('${item.id}', -1)">-</button>
                                            <span class="fw-bold">${qty}</span>
                                            <button class="btn btn-sm btn-outline-primary rounded-circle" onclick="Foodie.updateCart('${item.id}', 1)">+</button>
                                        </div>
                                    ` : `
                                        <button class="add-btn" onclick="Foodie.updateCart('${item.id}', 1)" ${stock <= 0 ? 'disabled' : ''}>
                                            ${stock <= 0 ? 'Sold Out' : '+ Add'}
                                        </button>
                                    `}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            }
        } catch (e) {
            grid.innerHTML = `<div class="col-12"><div class="alert alert-danger">Error: ${e.message}</div></div>`;
        }
    },

    // ====== CART ======
    getCartSellerIds: function() {
        return [...new Set(this.cart.map(item => item.sellerId || item.restaurantId).filter(Boolean))];
    },

    syncCartRestaurantContext: async function() {
        const sellerIds = this.getCartSellerIds();
        if (sellerIds.length !== 1) return;
        const snap = await db.ref('restaurants/' + sellerIds[0]).once('value');
        if (snap.exists()) this.currentRestaurant = { id: sellerIds[0], ...snap.val() };
    },

    validateCartRestaurantsAvailable: async function() {
        const sellerIds = this.getCartSellerIds();
        if (!sellerIds.length) return true;

        const snaps = await Promise.all(sellerIds.map(id => db.ref('restaurants/' + id).once('value')));
        const offlineNames = [];

        snaps.forEach((snap, index) => {
            const restaurant = snap.val() || {};
            if (restaurant.isOnline === false) {
                offlineNames.push(restaurant.name || sellerIds[index]);
            }
        });

        if (offlineNames.length) {
            alert('Sorry! ' + offlineNames.join(', ') + ' is currently Offline. Please order from an online restaurant.');
            return false;
        }

        if (sellerIds.length === 1 && snaps[0].exists()) {
            this.currentRestaurant = { id: sellerIds[0], ...snaps[0].val() };
        }

        return true;
    },

    ensureItemRestaurantAvailable: async function(itemId) {
        const existing = this.cart.find(c => c.id === itemId);
        let sellerId = existing?.sellerId || existing?.restaurantId;
        let product = existing || {};

        if (!sellerId) {
            const snap = await db.ref('products/' + itemId).once('value');
            if (!snap.exists()) return false;
            product = snap.val();
            sellerId = product.sellerId;
        }

        if (!sellerId) return true;

        const snap = await db.ref('restaurants/' + sellerId).once('value');
        if (!snap.exists()) return true;

        const restaurant = snap.val() || {};
        if (restaurant.isOnline === false) {
            alert('Sorry! ' + (restaurant.name || 'This restaurant') + ' is currently Offline. Please order from an online restaurant.');
            return false;
        }

        this.currentRestaurant = { id: sellerId, ...restaurant };
        return true;
    },

    updateCart: async function(itemId, change) {
        if (change > 0 && !(await this.ensureItemRestaurantAvailable(itemId))) return;
        const idx = this.cart.findIndex(c => c.id === itemId);
        if (idx > -1) {
            this.cart[idx].qty += change;
            if (this.cart[idx].qty <= 0) this.cart.splice(idx, 1);
        } else if (change > 0) {
            const snap = await db.ref('products/' + itemId).once('value');
            if (!snap.exists()) return;
            const item = snap.val();
            if (Number(item.stock || 0) <= 0) { alert('Item is sold out'); return; }
            const img = (item.images && item.images.length > 0) ? item.images[0] : item.image;
            this.cart.push({
                id: itemId,
                name: item.name,
                price: item.price,
                image: img,
                qty: 1,
                restaurantId: this.currentRestaurant?.id,
                sellerId: item.sellerId
            });
        }
        this.saveCartToStorage();
        this.updateCartUI();
        const path = window.location.pathname;
        if (path.includes('cart.html')) {
            this.renderCartPage();
        } else if (path.includes('restaurant.html')) {
            if (this.currentRestaurant) this.renderRestaurantMenu(this.currentRestaurant.id);
        } else if (this.currentRestaurant) {
            this.loadMenuItems(this.currentRestaurant.id);
        }
    },

    updateCartUI: function() {
        const total = this.getCartTotal();
        const count = this.getCartCount();
        const floating = document.getElementById('cart-floating');
        if (count > 0 && floating) {
            floating.style.display = 'block';
            document.getElementById('cart-summary').textContent = `${count} item${count > 1 ? 's' : ''} • ₹${total.toFixed(2)}`;
        } else if (floating) {
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
        const total = this.getCartTotal();
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

    showCartFromRestaurant: function() {
        this.showCart();
    },

    renderCartPage: function() {
        const list = document.getElementById('cart-items-list');
        const empty = document.getElementById('cart-empty');
        const content = document.getElementById('cart-content');
        if (!list) return;

        if (this.cart.length === 0) {
            empty.classList.remove('d-none');
            content.style.display = 'none';
            return;
        }
        empty.classList.add('d-none');
        content.style.display = 'block';

        list.innerHTML = this.cart.map((item, i) => `
            <div class="card shadow-sm mb-3" style="border-radius:16px;">
                <div class="card-body">
                    <div class="d-flex align-items-center gap-3">
                        <img src="${item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'}" alt="${item.name}" style="width:80px;height:80px;border-radius:12px;object-fit:cover;" />
                        <div class="flex-grow-1">
                            <h6 class="mb-1">${item.name}</h6>
                            <span class="fw-bold" style="color:var(--primary);">₹${(item.price * item.qty).toFixed(2)}</span>
                            <div class="text-muted small">₹${Number(item.price).toFixed(2)} each</div>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <button class="btn btn-sm btn-outline-danger rounded-circle" onclick="Foodie.updateCartFromCartPage(${i}, -1)">-</button>
                            <span class="fw-bold" style="min-width:24px;text-align:center;">${item.qty}</span>
                            <button class="btn btn-sm btn-outline-primary rounded-circle" onclick="Foodie.updateCartFromCartPage(${i}, 1)">+</button>
                            <button class="btn btn-sm btn-outline-danger ms-2" onclick="Foodie.removeCartItemFromCartPage(${i})"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        this.updateCartPageTotals();
    },

    updateCartFromCartPage: function(index, change) {
        this.cart[index].qty += change;
        if (this.cart[index].qty <= 0) this.cart.splice(index, 1);
        this.saveCartToStorage();
        this.updateCartUI();
        this.renderCartPage();
    },

    removeCartItemFromCartPage: function(index) {
        this.cart.splice(index, 1);
        this.saveCartToStorage();
        this.updateCartUI();
        this.renderCartPage();
    },

    updateCartFromModal: function(index, change) {
        this.cart[index].qty += change;
        if (this.cart[index].qty <= 0) this.cart.splice(index, 1);
        this.saveCartToStorage();
        this.updateCartUI();
        this.showCart();
    },

    removeCartItem: function(index) {
        this.cart.splice(index, 1);
        this.saveCartToStorage();
        this.updateCartUI();
        this.showCart();
    },

    updateCartPageTotals: function() {
        const itemTotal = this.getCartTotal();
        const deliveryFee = this.calculateDeliveryFee();
        const payable = Math.max(0, itemTotal + deliveryFee - this.couponDiscount);

        const subtotalEl = document.getElementById('cart-subtotal');
        const deliveryEl = document.getElementById('delivery-fee-display');
        const payableEl = document.getElementById('payable-total');
        const couponRow = document.getElementById('coupon-discount-row');
        const couponEl = document.getElementById('coupon-discount');

        if (subtotalEl) subtotalEl.textContent = '₹' + itemTotal.toFixed(2);
        if (deliveryEl) deliveryEl.textContent = '₹' + deliveryFee.toFixed(2);
        if (payableEl) payableEl.textContent = '₹' + payable.toFixed(2);
        if (couponRow) couponRow.style.display = this.couponDiscount > 0 ? 'flex' : 'none';
        if (couponEl) couponEl.textContent = '- ₹' + this.couponDiscount.toFixed(2);
    },

    proceedToCheckoutFromCart: async function() {
        if (!this.currentUser) { window.location.href = 'login.html'; return; }
        if (this.cart.length === 0) { alert('Your cart is empty'); return; }
        if (!(await this.validateCartRestaurantsAvailable())) return;
        await this.proceedToCheckout();
    },

    getCurrentLocationFromCart: function() {
        const status = document.getElementById('location-status');
        const geoStatus = document.getElementById('geo-status');
        const submitBtn = document.getElementById('checkout-submit-btn');
        if (!navigator.geolocation) {
            if (status) status.innerHTML = '<span class="text-danger">Geolocation is not supported by this browser.</span>';
            return;
        }
        if (status) status.innerHTML = '<span class="text-primary"><i class="fas fa-spinner fa-spin me-1"></i>Requesting location permission...</span>';
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                document.getElementById('checkout-lat').value = lat;
                document.getElementById('checkout-lng').value = lng;
                localStorage.setItem('foodie-last-location', JSON.stringify({ lat, lng, address: '' }));
                const address = await this.resolveAddressFromCoords(lat, lng);
                if (status) {
                    status.innerHTML = `<i class="fas fa-check-circle me-1"></i>${this._safe(address || 'Current location captured')}`;
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

    getCurrentLocationFromRestaurant: function() {
        this.getCurrentLocation(true);
    },

    // ====== CHECKOUT ======
    proceedToCheckout: async function() {
        if (!this.currentUser) { window.location.href = 'login.html'; return; }
        if (!(await this.validateCartRestaurantsAvailable())) return;
        const cartModal = document.getElementById('cartModal');
        if (cartModal) {
            const bsInstance = bootstrap.Modal.getInstance(cartModal);
            if (bsInstance) bsInstance.hide();
        }
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

            // ===== Restaurant Offline check =====
            if (!(await this.validateCartRestaurantsAvailable())) return;

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
    },

};

// ====== GEOFENCING CONSTANTS ======
const ISMAILABAD_CENTER = { lat: 30.166, lng: 76.717 };
const MAX_DELIVERY_RADIUS_KM = 4;

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