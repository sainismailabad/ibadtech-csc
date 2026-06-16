// Seller Module - Restaurant Panel (Products + Orders + Status)
const Seller = {
  currentUser: null,
  map: null,
  mapMarker: null,
  orderRef: null,
  previousOrderCount: 0,
  isOnline: true,

  // ===== INIT =====
  init: async function () {
    const authState = await auth.init();
    const role = authState.role || (auth.getRole ? auth.getRole() : null);

    if (!authState.user || role !== 'seller') {
      const el = document.getElementById('auth-required');
      if (el) el.style.display = 'block';
      return;
    }

    this.currentUser = authState.user;

    // Load online/offline status
    const restSnap = await db.ref('restaurants/' + this.currentUser.uid + '/isOnline').once('value');
    this.isOnline = restSnap.val() !== false; // default online
    document.getElementById('seller-availability-toggle').checked = this.isOnline;
    document.getElementById('seller-status-text').innerHTML = this.isOnline ? '🟢 Online' : '🔴 Offline';

    // Load immediately
    await this.loadDashboard();
    await this.loadOrders();
    this.listenForOrders();

    // Settings page may need values
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
      this.loadSettings();
    }
  },

  toggleAvailability: function (available) {
    this.isOnline = available;
    document.getElementById('seller-status-text').innerHTML = available ? '🟢 Online' : '🔴 Offline';
    db.ref('restaurants/' + this.currentUser.uid + '/isOnline').set(available);
  },

  showPage: function (page) {
    document.querySelectorAll('[id$="-page"]').forEach(el => (el.style.display = 'none'));
    const pageEl = document.getElementById(`${page}-page`);
    if (pageEl) pageEl.style.display = 'block';

    document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
    const nav = document.querySelector(`[data-page="${page}"]`);
    if (nav) nav.classList.add('active');

    if (page === 'dashboard') this.loadDashboard();
    if (page === 'products') this.loadProducts();
    if (page === 'orders') this.loadOrders();
    if (page === 'coupons') this.loadCoupons();
    if (page === 'settings') this.loadSettings();
  },

  // ===== IMAGE MANAGEMENT =====
  imageCount: 1,

  addImageInput: function () {
    if (this.imageCount >= 6) {
      alert('Maximum 6 images allowed');
      return;
    }
    this.imageCount++;
    const container = document.getElementById('image-inputs-container');
    if (!container) return;
    const addBtn = container.querySelector('.btn-outline-secondary');
    const div = document.createElement('div');
    div.className = 'input-group mb-2';
    div.id = 'image-input-' + (this.imageCount - 1);
    div.innerHTML = `
      <span class="input-group-text">${this.imageCount}</span>
      <input type="url" class="form-control product-image-input" placeholder="Image URL ${this.imageCount}" oninput="Seller.previewImage(${this.imageCount - 1}, this.value)">
      <button class="btn btn-outline-danger" type="button" onclick="Seller.removeImageInput(${this.imageCount - 1})"><i class="fas fa-times"></i></button>
    `;
    container.insertBefore(div, addBtn ? addBtn.closest('.input-group') : null);
    const previewRow = document.getElementById('image-previews-container');
    if (previewRow) {
      const col = document.createElement('div');
      col.className = 'col-3';
      col.id = 'image-preview-' + (this.imageCount - 1);
      col.innerHTML = `<div class="image-preview-placeholder"><i class="fas fa-image fa-2x mb-1"></i><br><small>Image ${this.imageCount}</small></div>`;
      previewRow.appendChild(col);
    }
  },

  removeImageInput: function (index) {
    const input = document.getElementById('image-input-' + index);
    if (input) input.remove();
    const preview = document.getElementById('image-preview-' + index);
    if (preview) {
      preview.innerHTML = '<div class="image-preview-placeholder" style="opacity:0.3;"><i class="fas fa-times fa-2x mb-1"></i><br><small>Removed</small></div>';
    }
  },

  previewImage: function (index, url) {
    const container = document.getElementById('image-preview-' + index);
    if (!container) return;
    if (url && url.trim()) {
      container.innerHTML = `<img src="${url}" class="image-preview" onerror="this.parentElement.innerHTML='<div class=\\'image-preview-placeholder\\'><i class=\\'fas fa-exclamation-triangle fa-2x mb-1\\'></i><br><small class=\\'text-danger\\'>Invalid URL</small></div>'" alt="Preview">`;
    } else {
      container.innerHTML = `<div class="image-preview-placeholder"><i class="fas fa-image fa-2x mb-1"></i><br><small>Image ${index + 1}</small></div>`;
    }
  },

  getImages: function () {
    const inputs = document.querySelectorAll('.product-image-input');
    const images = [];
    inputs.forEach(input => {
      if (input.value && input.value.trim()) images.push(input.value.trim());
    });
    return images.length > 0 ? images : ['https://via.placeholder.com/600x400?text=No+Image'];
  },

  // ===== RESTAURANT SETTINGS =====
  loadSettings: async function () {
    const snap = await db.ref('restaurants/' + this.currentUser.uid).once('value');
    if (!snap.exists()) return;
    const r = snap.val();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    set('rest-name', r.name || '');
    set('rest-cuisine', r.cuisine || '');
    set('rest-banner', r.banner || '');
    set('rest-logo', r.logo || '');
    set('rest-delivery', r.deliveryTime ?? '30');
    set('rest-delivery-fee', r.deliveryFee ?? '30');
    set('rest-rating', r.rating ?? '4.0');
    set('rest-offer', r.offer || '');
    set('rest-address', r.address || '');
    set('rest-description', r.description || '');
  },

  saveSettings: async function () {
    const data = {
      name: document.getElementById('rest-name').value,
      cuisine: document.getElementById('rest-cuisine').value,
      banner: document.getElementById('rest-banner').value || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600',
      logo: document.getElementById('rest-logo').value || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150',
      deliveryTime: parseInt(document.getElementById('rest-delivery').value, 10) || 30,
      deliveryFee: parseFloat(document.getElementById('rest-delivery-fee').value) || 0,
      rating: parseFloat(document.getElementById('rest-rating').value) || 4.0,
      offer: document.getElementById('rest-offer').value || '',
      address: document.getElementById('rest-address').value || '',
      description: document.getElementById('rest-description').value || '',
      sellerId: this.currentUser.uid,
      category: document.getElementById('rest-cuisine').value || 'Multi-Cuisine',
      isOnline: this.isOnline
    };
    try {
      await db.ref('restaurants/' + this.currentUser.uid).set(data);
      await db.ref('sellers/' + this.currentUser.uid).set({
        sellerId: this.currentUser.uid,
        shopName: data.name,
        shopSlug: data.name.toLowerCase().replace(/\s+/g, '-'),
        logo: data.logo
      });
      alert('✅ Restaurant settings saved!');
      await this.loadDashboard();
    } catch (e) {
      alert('Error: ' + (e && e.message ? e.message : e));
    }
  },

  // ===== SHOP SHARING =====
  getShopShareUrl: function () {
    const base = window.location.origin + window.location.pathname.replace('seller.html', '');
    const url = base.includes('index.html') ? base : (base + 'index.html');
    return url + '?seller=' + encodeURIComponent(this.currentUser.uid);
  },

  shareShop: function () {
    const url = this.getShopShareUrl();
    const title = document.getElementById('seller-shop-name')?.textContent || 'My Restaurant';
    if (navigator.share) { navigator.share({ title, url }); }
    else { navigator.clipboard.writeText(url).then(() => alert('Shop link copied to clipboard!')); }
  },

  // ===== DASHBOARD =====
  loadDashboard: async function () {
    try {
      const uid = this.currentUser.uid;
      const restSnap = await db.ref('restaurants/' + uid).once('value');
      const restData = restSnap.val() || {};
      document.getElementById('seller-shop-name').textContent = restData?.name || 'My Restaurant';

      let menuCount = 0;
      const productsSnap = await db.ref('products').once('value');
      if (productsSnap.exists()) {
        productsSnap.forEach(child => {
          const p = child.val();
          if (p?.sellerId === uid) menuCount++;
        });
      }
      document.getElementById('total-products').textContent = menuCount;

      let orderCount = 0;
      let revenue = 0;
      const ordersSnap = await db.ref('orders').once('value');
      if (ordersSnap.exists()) {
        ordersSnap.forEach(child => {
          const order = child.val();
          if (order?.restaurantId === uid) {
            orderCount++;
            revenue += order.totalAmount || 0;
          }
        });
      }
      document.getElementById('total-orders').textContent = orderCount;
      document.getElementById('total-revenue').textContent = `₹${(revenue || 0).toFixed(2)}`;

      await this.loadRecentOrders();
    } catch (e) { console.error(e); }
  },

  loadRecentOrders: async function () {
    const container = document.getElementById('recent-orders-table');
    if (!container) return;
    try {
      const snapshot = await db.ref('orders').once('value');
      const orders = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          const o = child.val();
          if (o?.restaurantId === this.currentUser.uid) orders.push({ id: child.key, ...o });
        });
      }
      orders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const recent = orders.slice(0, 5);
      if (recent.length === 0) { container.innerHTML = '<p class="text-muted">No recent orders</p>'; return; }
      let html = '<table class="table table-sm"><thead><tr><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>';
      for (const order of recent) {
        const d = order.timestamp ? new Date(order.timestamp).toLocaleDateString() : 'N/A';
        const status = order.status || 'Pending';
        html += `<tr><td>${order.customerName || 'Unknown'}</td><td>₹${(order.totalAmount || 0).toFixed(2)}</td><td><span class="status-badge status-${String(status).toLowerCase().replace(/\s+/g, '-')}">${status}</span></td><td>${d}</td></tr>`;
      }
      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (e) { container.innerHTML = `<div class="alert alert-danger">Error: ${e?.message || e}</div>`; }
  },

  // ===== PRODUCTS =====
  loadProducts: async function () {
    const tbody = document.getElementById('products-table');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
    try {
      const snapshot = await db.ref('products').once('value');
      tbody.innerHTML = '';
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          const p = child.val();
          if (p?.sellerId === this.currentUser.uid) {
            const img = p.images && p.images.length > 0 ? p.images[0] : 'https://via.placeholder.com/50';
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><img src="${img}" width="50" height="50" class="rounded me-2"> ${p.name || ''}</td>
              <td>${p.category || 'Other'}</td>
              <td>₹${Number(p.price || 0).toFixed(2)}</td>
              <td>${p.stock ?? 0}</td>
              <td>${p.offer ? `<span class="badge bg-warning text-dark">${p.offer}</span>` : '-'}</td>
              <td class="text-center">
                <button class="btn btn-sm btn-outline-primary me-1" onclick="Seller.openProductModal('${child.key}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="Seller.deleteProduct('${child.key}')"><i class="fas fa-trash"></i></button>
                <button class="btn btn-sm btn-outline-info ms-1" onclick="Seller.shareProduct('${child.key}')"><i class="fas fa-share-alt"></i></button>
              </td>`;
            tbody.appendChild(tr);
          }
        });
      }
      if (tbody.children.length === 0) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No products found</td></tr>';
    } catch (e) { tbody.innerHTML = `<tr><td colspan="6" class="text-danger">Error: ${e?.message || e}</td></tr>`; }
  },

  shareProduct: function (productId) {
    const url = window.location.origin + window.location.pathname.replace('seller.html', '') + 'product.html?id=' + productId;
    if (navigator.share) { navigator.share({ title: 'Check this product', url }); }
    else { navigator.clipboard.writeText(url).then(() => alert('Product link copied to clipboard!')); }
  },

  openProductModal: async function (productId = null) {
    this.imageCount = 1;
    const container = document.getElementById('image-inputs-container');
    if (!container) return;
    container.innerHTML = `<div class="input-group mb-2"><span class="input-group-text">1</span><input type="url" class="form-control product-image-input" placeholder="Main image URL" oninput="Seller.previewImage(0, this.value)"><button class="btn btn-outline-secondary" type="button" onclick="Seller.addImageInput()"><i class="fas fa-plus"></i></button></div>`;
    const previewRow = document.getElementById('image-previews-container');
    if (previewRow) {
      previewRow.innerHTML = `<div class="col-3" id="image-preview-0"><div class="image-preview-placeholder"><i class="fas fa-image fa-2x mb-1"></i><br><small>Main Image</small></div></div><div class="col-3" id="image-preview-1"><div class="image-preview-placeholder"><i class="fas fa-image fa-2x mb-1"></i><br><small>Image 2</small></div></div><div class="col-3" id="image-preview-2"><div class="image-preview-placeholder"><i class="fas fa-image fa-2x mb-1"></i><br><small>Image 3</small></div></div><div class="col-3" id="image-preview-3"><div class="image-preview-placeholder"><i class="fas fa-image fa-2x mb-1"></i><br><small>Image 4</small></div></div>`;
    }
    if (productId) {
      const snap = await db.ref('products/' + productId).once('value');
      const p = snap.val() || {};
      document.getElementById('product-modal-title').textContent = 'Edit Product';
      document.getElementById('product-id').value = productId;
      document.getElementById('product-name').value = p.name || '';
      document.getElementById('product-price').value = p.price || 0;
      document.getElementById('product-stock').value = p.stock || 0;
      document.getElementById('product-category').value = p.category || 'Other';
      document.getElementById('product-portion').value = p.portionSize || '';
      document.getElementById('product-prep').value = p.preparationTime || '';
      document.getElementById('product-offer').value = p.offer || '';
      document.getElementById('product-ingredients').value = p.ingredients || '';
      document.getElementById('product-veg').value = p.isVeg === false ? 'false' : 'true';
      document.getElementById('product-description').value = p.description || '';
      const images = p.images && p.images.length ? p.images : (p.image ? [p.image] : ['']);
      images.forEach((url, i) => {
        if (!url) return;
        if (i === 0) { const input = container.querySelector('.product-image-input'); if (input) { input.value = url; this.previewImage(0, url); } }
        else { this.addImageInput(); setTimeout(() => { const inputs = container.querySelectorAll('.product-image-input'); if (inputs[i]) { inputs[i].value = url; this.previewImage(i, url); } }, 50); }
      });
    } else {
      document.getElementById('product-modal-title').textContent = 'Add Product';
      document.getElementById('product-form').reset();
      document.getElementById('product-id').value = '';
      document.getElementById('product-description').value = '';
    }
    new bootstrap.Modal(document.getElementById('productModal')).show();
  },

  saveProduct: async function () {
    const productId = document.getElementById('product-id').value;
    const sellerSnap = await db.ref('sellers/' + this.currentUser.uid).once('value');
    const sellerData = sellerSnap.val() || {};
    const productData = {
      name: document.getElementById('product-name').value,
      price: parseFloat(document.getElementById('product-price').value) || 0,
      stock: parseInt(document.getElementById('product-stock').value, 10) || 0,
      category: document.getElementById('product-category').value,
      portionSize: document.getElementById('product-portion').value,
      preparationTime: parseInt(document.getElementById('product-prep').value, 10) || 0,
      offer: document.getElementById('product-offer').value,
      ingredients: document.getElementById('product-ingredients').value,
      isVeg: document.getElementById('product-veg').value === 'true',
      images: this.getImages(),
      description: document.getElementById('product-description').value || 'No description available',
      sellerId: this.currentUser.uid,
      shopName: sellerData.shopName || 'Unknown',
      shopSlug: sellerData.shopSlug || '',
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
    try {
      if (productId) { await db.ref('products/' + productId).update(productData); }
      else { productData.createdAt = firebase.database.ServerValue.TIMESTAMP; await db.ref('products').push(productData); }
      alert('Product saved!');
      bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
      await this.loadProducts();
    } catch (e) { alert('Error: ' + (e?.message || e)); }
  },

  deleteProduct: async function (productId) {
    if (!confirm('Delete this product permanently?')) return;
    try { await db.ref('products/' + productId).remove(); await this.loadProducts(); }
    catch (e) { alert('Error: ' + (e?.message || e)); }
  },

  saveCoupon: async function (e) {
    e.preventDefault();
    const couponId = document.getElementById('coupon-id').value;
    const code = document.getElementById('coupon-code').value.trim().toUpperCase();
    const data = {
      restaurantId: this.currentUser.uid,
      name: document.getElementById('coupon-name').value.trim(),
      code,
      discountType: document.getElementById('coupon-type').value,
      discountValue: parseFloat(document.getElementById('coupon-value').value) || 0,
      minOrder: parseFloat(document.getElementById('coupon-min').value) || 0,
      expiry: document.getElementById('coupon-expiry').value,
      active: document.getElementById('coupon-active').checked,
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
    try {
      if (couponId) await db.ref('coupons/' + couponId).update(data);
      else await db.ref('coupons').push({ ...data, createdAt: firebase.database.ServerValue.TIMESTAMP });
      alert('Coupon saved!');
      e.target.reset();
      document.getElementById('coupon-active').checked = true;
      this.loadCoupons();
    } catch (err) { alert('Error: ' + (err?.message || err)); }
  },

  loadCoupons: async function () {
    const tbody = document.getElementById('coupons-table');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
    try {
      const snap = await db.ref('coupons').orderByChild('restaurantId').equalTo(this.currentUser.uid).once('value');
      tbody.innerHTML = '';
      if (snap.exists()) {
        snap.forEach(c => {
          const coupon = c.val();
          const tr = document.createElement('tr');
          tr.innerHTML = `<td><strong>${coupon.code || ''}</strong></td><td>${coupon.name || ''}</td><td>${coupon.discountType === 'percent' ? coupon.discountValue + '%' : '₹' + coupon.discountValue}</td><td>₹${coupon.minOrder || 0}</td><td>${coupon.expiry || 'No expiry'}</td><td><span class="badge ${coupon.active === false ? 'bg-danger' : 'bg-success'}">${coupon.active === false ? 'Inactive' : 'Active'}</span></td><td class="text-center"><button class="btn btn-sm btn-outline-primary me-1" onclick="Seller.editCoupon('${c.key}')"><i class="fas fa-edit"></i></button><button class="btn btn-sm btn-outline-danger" onclick="Seller.deleteCoupon('${c.key}')"><i class="fas fa-trash"></i></button></td>`;
          tbody.appendChild(tr);
        });
      }
      if (tbody.children.length === 0) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No coupons yet</td></tr>';
    } catch (e) { tbody.innerHTML = `<tr><td colspan="7" class="text-danger">Error: ${e?.message || e}</td></tr>`; }
  },

  editCoupon: async function (couponId) {
    const snap = await db.ref('coupons/' + couponId).once('value');
    const c = snap.val() || {};
    document.getElementById('coupon-id').value = couponId;
    document.getElementById('coupon-name').value = c.name || '';
    document.getElementById('coupon-code').value = c.code || '';
    document.getElementById('coupon-type').value = c.discountType || 'fixed';
    document.getElementById('coupon-value').value = c.discountValue || 0;
    document.getElementById('coupon-min').value = c.minOrder || 0;
    document.getElementById('coupon-expiry').value = c.expiry || '';
    document.getElementById('coupon-active').checked = c.active !== false;
  },

  deleteCoupon: async function (couponId) {
    if (!confirm('Delete this coupon?')) return;
    try { await db.ref('coupons/' + couponId).remove(); this.loadCoupons(); }
    catch (e) { alert('Error: ' + (e?.message || e)); }
  },

  // ===== ORDERS - ZOMATO STYLE NOTIFICATION =====
  playNotificationSound: function() {
    try {
      const audio = document.getElementById('order-notification-sound');
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } catch(e) {}
  },

  listenForOrders: function () {
    if (!this.currentUser || this.orderRef) return;
    const uid = this.currentUser.uid;

    // First get current count to know baseline
    db.ref('orders').orderByChild('restaurantId').equalTo(uid).once('value', (snap) => {
      let count = 0;
      if (snap.exists()) { snap.forEach(() => count++); }
      this.previousOrderCount = count;
    });

    // Now listen for new orders
    this.orderRef = db.ref('orders').orderByChild('restaurantId').equalTo(uid);
    this.orderRef.on('child_added', (snapshot) => {
      const order = snapshot.val();
      if (order && order.restaurantId === uid) {
        // Only ring if it's a NEW pending order (not existing ones)
        if (order.status === 'Pending') {
          this.playNotificationSound();
          
          // Show browser notification
          if (Notification.permission === 'granted') {
            new Notification('🛵 New Order!', {
              body: `Order from ${order.customerName || 'Customer'} - ₹${(order.totalAmount || 0).toFixed(2)}`,
              icon: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150'
            });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
          }
          
          // Show alert for new order
          // Vibrate on mobile
          try { if (navigator.vibrate) navigator.vibrate([250, 120, 250]); } catch (e) {}

          if (document.visibilityState !== 'visible') {
            // If page is not visible, use a toast
            const status = document.getElementById('seller-status-text');
            if (status) status.innerHTML = '🔴 New Order! 🔔';
            setTimeout(() => {
              document.getElementById('seller-status-text').innerHTML = this.isOnline ? '🟢 Online' : '🔴 Offline';
            }, 5000);
          }
        }
        
        this.loadDashboard();
        const ordersPage = document.getElementById('orders-page');
        if (ordersPage && ordersPage.style.display === 'block') {
          this.loadOrders();
        }
      }
    });
  },

  loadOrders: async function () {
    const tbody = document.getElementById('seller-orders-table');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
    try {
      const snapshot = await db.ref('orders').once('value');
      tbody.innerHTML = '';
      const orders = [];
      if (snapshot.exists()) {
        snapshot.forEach(child => {
          const o = child.val();
          if (o?.restaurantId === this.currentUser.uid) orders.push({ id: child.key, ...o });
        });
      }
      orders.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      for (const order of orders) {
        const itemsHtml = order.items ? order.items.map(i => `<small>${i.name} x${i.qty}</small>`).join('<br>') : 'N/A';
        const d = order.timestamp ? new Date(order.timestamp).toLocaleDateString() + ' ' + new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
        const status = order.status || 'Pending';
        const safeStatus = String(status).toLowerCase().replace(/\s+/g, '-');
        
        // Show if new (Pending status and within last 5 min)
        const isNew = status === 'Pending' && order.timestamp && (Date.now() - order.timestamp < 300000);

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            ${isNew ? '<span class="badge bg-danger me-1 pulse">NEW</span>' : ''}
            <strong>${order.customerName || 'Unknown'}</strong><br>
            <small class="text-muted"><i class="fas fa-phone"></i> ${order.customerPhone || 'N/A'}</small>
          </td>
          <td>${itemsHtml}</td>
          <td><small>${order.deliveryAddress || order.address || 'N/A'}</small></td>
          <td><span class="status-badge status-${safeStatus}">${status}</span></td>
          <td><small>${d}</small></td>
          <td class="text-center">
            ${isNew ? `<button class="btn btn-sm btn-success me-1" onclick="Seller.acceptOrder('${order.id}')"><i class="fas fa-check"></i> Accept</button>` : ''}
            ${status === 'Pending' ? `<button class="btn btn-sm btn-outline-danger me-1" onclick="Seller.rejectOrder('${order.id}')"><i class="fas fa-times"></i> Reject</button>` : ''}
            ${typeof order.customerLat === 'number' && typeof order.customerLng === 'number' ?
              `<button class="btn btn-sm btn-outline-info me-1" onclick="Seller.viewLocation(${order.customerLat}, ${order.customerLng})" title="View Location"><i class="fas fa-map-marker-alt"></i></button>` : ''}
            <button class="btn btn-sm btn-outline-primary" onclick="Seller.updateStatus('${order.id}', '${order.status}')" title="Change Status"><i class="fas fa-sync-alt"></i></button>
          </td>`;
        tbody.appendChild(tr);
      }
      if (tbody.children.length === 0) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No orders found</td></tr>';
    } catch (e) { tbody.innerHTML = `<tr><td colspan="6" class="text-danger">Error: ${e?.message || e}</td></tr>`; }
  },

  // ===== ACCEPT / REJECT ORDER (Zomato Style) =====
  acceptOrder: async function(orderId) {
    try {
      await db.ref('orders/' + orderId).update({ status: 'Accepted' });
      await this.loadOrders();
      await this.loadDashboard();
      
      // Notify customer
      const orderSnap = await db.ref('orders/' + orderId).once('value');
      const order = orderSnap.val() || {};
      if (order.customerId) {
        await db.ref('notifications').push({
          orderId: orderId, userId: order.customerId,
          message: '✅ Your order has been accepted by the restaurant!',
          timestamp: firebase.database.ServerValue.TIMESTAMP, read: false
        });
      }
    } catch (e) { alert('Error: ' + (e?.message || e)); }
  },

  rejectOrder: async function(orderId) {
    if (!confirm('Reject this order? Customer will be notified.')) return;
    try {
      await db.ref('orders/' + orderId).update({ status: 'Cancelled', cancelledAt: firebase.database.ServerValue.TIMESTAMP });
      await this.loadOrders();
      await this.loadDashboard();
      
      const orderSnap = await db.ref('orders/' + orderId).once('value');
      const order = orderSnap.val() || {};
      if (order.customerId) {
        await db.ref('notifications').push({
          orderId: orderId, userId: order.customerId,
          message: '❌ Your order has been cancelled by the restaurant.',
          timestamp: firebase.database.ServerValue.TIMESTAMP, read: false
        });
      }
    } catch (e) { alert('Error: ' + (e?.message || e)); }
  },

  updateStatus: async function (orderId, currentStatus) {
    const status = currentStatus || 'Pending';
    const nextMap = {
      'Pending': 'Accepted',
      'Accepted': 'Preparing',
      'Preparing': 'Out for Delivery',
      'Out for Delivery': 'Delivered',
      'Delivered': 'Delivered',
      'Cancelled': 'Cancelled'
    };
    const next = nextMap[status] || 'Accepted';
    if (status === 'Cancelled' || status === 'Delivered') { alert('Order already finalized: ' + status); return; }
    if (!confirm(`Change order status from ${status} to ${next}?`)) return;
    try {
      await db.ref('orders/' + orderId).update({ status: next });
      await this.loadOrders();
      await this.loadDashboard();
      const orderSnap = await db.ref('orders/' + orderId).once('value');
      const order = orderSnap.val() || {};
      const customerId = order.customerId || null;
      if (customerId) {
        await db.ref('notifications').push({
          orderId: orderId, userId: customerId,
          message: '🔄 Your order status has been updated to: ' + next,
          timestamp: firebase.database.ServerValue.TIMESTAMP, read: false
        });
      }
      if (next === 'Out for Delivery') {
        await db.ref('orders/' + orderId).update({ deliveryReady: true });
      }
    } catch (e) { alert('Error: ' + (e?.message || e)); }
  },

  viewLocation: function (lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') return;
    const modal = new bootstrap.Modal(document.getElementById('mapModal'));
    setTimeout(() => {
      if (!this.map) { this.map = L.map('order-map').setView([lat, lng], 15); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(this.map); }
      else { this.map.setView([lat, lng], 15); }
      if (this.mapMarker) this.mapMarker.remove();
      this.mapMarker = L.marker([lat, lng]).addTo(this.map).bindPopup('Delivery Location').openPopup();
    }, 150);
    modal.show();
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', function () {
  const productForm = document.getElementById('product-form');
  if (productForm) { productForm.addEventListener('submit', e => { e.preventDefault(); Seller.saveProduct(); }); }
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) { settingsForm.addEventListener('submit', e => { e.preventDefault(); Seller.saveSettings(); }); }
  const couponForm = document.getElementById('coupon-form');
  if (couponForm) { couponForm.addEventListener('submit', e => { e.preventDefault(); Seller.saveCoupon(e); }); }
  
  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  
  Seller.init();
});