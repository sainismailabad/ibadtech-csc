// Seller Module - Restaurant Panel (Products + Orders + Status)
const Seller = {
  currentUser: null,
  map: null,
  mapMarker: null,
  orderChildAddedUnsubscribe: null,

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

    // Load immediately
    await this.loadDashboard();
    await this.loadOrders();
    this.listenForOrders();

    // Settings page may need values
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
      // do not await to avoid blocking init
      this.loadSettings();
    }
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
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v ?? '';
    };

    set('rest-name', r.name || '');
    set('rest-cuisine', r.cuisine || '');
    set('rest-banner', r.banner || '');
    set('rest-logo', r.logo || '');
    set('rest-delivery', r.deliveryTime ?? '30');
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
      rating: parseFloat(document.getElementById('rest-rating').value) || 4.0,
      offer: document.getElementById('rest-offer').value || '',
      address: document.getElementById('rest-address').value || '',
      description: document.getElementById('rest-description').value || '',
      sellerId: this.currentUser.uid,
      category: document.getElementById('rest-cuisine').value || 'Multi-Cuisine'
    };

    try {
      await db.ref('restaurants/' + this.currentUser.uid).set(data);
      // backward compat
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
    // Share as index.html with sellerId query param
    const base = window.location.origin + window.location.pathname.replace('seller.html', '');
    // Ensure index.html included
    const url = base.includes('index.html') ? base : (base + 'index.html');
    return url + '?seller=' + encodeURIComponent(this.currentUser.uid);
  },

  shareShop: function () {
    const url = this.getShopShareUrl();
    const title = document.getElementById('seller-shop-name')?.textContent || 'My Restaurant';

    if (navigator.share) {
      navigator.share({ title, url });
    } else {
      navigator.clipboard.writeText(url).then(() => alert('Shop link copied to clipboard!'));
    }
  },

  // ===== DASHBOARD =====
  loadDashboard: async function () {
    try {
      const uid = this.currentUser.uid;

      const restSnap = await db.ref('restaurants/' + uid).once('value');
      const restData = restSnap.val() || {};
      document.getElementById('seller-shop-name').textContent = restData?.name || 'My Restaurant';

      // Products count (existing code uses menuItems; but app uses products elsewhere). Keep both.
      let menuCount = 0;
      const menuSnap = await db.ref('menuItems').once('value');
      if (menuSnap.exists()) {
        menuSnap.forEach(child => {
          if (child.val()?.sellerId === uid) menuCount++;
        });
      }

      if (menuCount === 0) {
        const productsSnap = await db.ref('products').once('value');
        if (productsSnap.exists()) {
          productsSnap.forEach(child => {
            const p = child.val();
            if (p?.sellerId === uid) menuCount++;
          });
        }
      }

      document.getElementById('total-products').textContent = menuCount;

      // Orders + revenue
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
    } catch (e) {
      console.error(e);
    }
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

      if (recent.length === 0) {
        container.innerHTML = '<p class="text-muted">No recent orders</p>';
        return;
      }

      let html = '<table class="table table-sm"><thead><tr><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>';
      for (const order of recent) {
        const d = order.timestamp ? new Date(order.timestamp).toLocaleDateString() : 'N/A';
        const status = order.status || 'Pending';
        html += `<tr><td>${order.customerName || 'Unknown'}</td><td>₹${(order.totalAmount || 0).toFixed(2)}</td><td><span class="status-badge status-${String(status).toLowerCase().replace(/\s+/g, '-')}">${status}</span></td><td>${d}</td></tr>`;
      }
      html += '</tbody></table>';
      container.innerHTML = html;
    } catch (e) {
      container.innerHTML = `<div class="alert alert-danger">Error: ${e?.message || e}</div>`;
    }
  },

  // ===== PRODUCTS =====
  loadProducts: async function () {
    const tbody = document.getElementById('products-table');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
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
              <td>₹${Number(p.price || 0).toFixed(2)}</td>
              <td>${p.stock ?? 0}</td>
              <td class="text-center">
                <button class="btn btn-sm btn-outline-primary me-1" onclick="Seller.openProductModal('${child.key}')"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="Seller.deleteProduct('${child.key}')"><i class="fas fa-trash"></i></button>
                <button class="btn btn-sm btn-outline-info ms-1" onclick="Seller.shareProduct('${child.key}')"><i class="fas fa-share-alt"></i></button>
              </td>
            `;
            tbody.appendChild(tr);
          }
        });
      }

      if (tbody.children.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No products found</td></tr>';
      }
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-danger">Error: ${e?.message || e}</td></tr>`;
    }
  },

  shareProduct: function (productId) {
    const url = window.location.origin + window.location.pathname.replace('seller.html', '') + 'product.html?id=' + productId;
    if (navigator.share) {
      navigator.share({ title: 'Check this product', url });
    } else {
      navigator.clipboard.writeText(url).then(() => alert('Product link copied to clipboard!'));
    }
  },

  openProductModal: async function (productId = null) {
    this.imageCount = 1;

    const container = document.getElementById('image-inputs-container');
    if (!container) return;

    container.innerHTML = `
      <div class="input-group mb-2">
        <span class="input-group-text">1</span>
        <input type="url" class="form-control product-image-input" placeholder="Main image URL" oninput="Seller.previewImage(0, this.value)">
        <button class="btn btn-outline-secondary" type="button" onclick="Seller.addImageInput()"><i class="fas fa-plus"></i></button>
      </div>
    `;

    const previewRow = document.getElementById('image-previews-container');
    if (previewRow) {
      previewRow.innerHTML = `
        <div class="col-3" id="image-preview-0"><div class="image-preview-placeholder"><i class="fas fa-image fa-2x mb-1"></i><br><small>Main Image</small></div></div>
        <div class="col-3" id="image-preview-1"><div class="image-preview-placeholder"><i class="fas fa-image fa-2x mb-1"></i><br><small>Image 2</small></div></div>
        <div class="col-3" id="image-preview-2"><div class="image-preview-placeholder"><i class="fas fa-image fa-2x mb-1"></i><br><small>Image 3</small></div></div>
        <div class="col-3" id="image-preview-3"><div class="image-preview-placeholder"><i class="fas fa-image fa-2x mb-1"></i><br><small>Image 4</small></div></div>
      `;
    }

    if (productId) {
      const snap = await db.ref('products/' + productId).once('value');
      const p = snap.val() || {};

      document.getElementById('product-modal-title').textContent = 'Edit Product';
      document.getElementById('product-id').value = productId;
      document.getElementById('product-name').value = p.name || '';
      document.getElementById('product-price').value = p.price || 0;
      document.getElementById('product-stock').value = p.stock || 0;
      document.getElementById('product-description').value = p.description || '';

      const images = p.images && p.images.length ? p.images : (p.image ? [p.image] : ['']);
      images.forEach((url, i) => {
        if (!url) return;
        if (i === 0) {
          const input = container.querySelector('.product-image-input');
          if (input) {
            input.value = url;
            this.previewImage(0, url);
          }
        } else {
          // Add extra inputs
          this.addImageInput();
          // after adding, set values
          setTimeout(() => {
            const inputs = container.querySelectorAll('.product-image-input');
            if (inputs[i]) {
              inputs[i].value = url;
              this.previewImage(i, url);
            }
          }, 50);
        }
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
      images: this.getImages(),
      description: document.getElementById('product-description').value || 'No description available',
      sellerId: this.currentUser.uid,
      shopName: sellerData.shopName || 'Unknown',
      shopSlug: sellerData.shopSlug || '',
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };

    try {
      if (productId) {
        await db.ref('products/' + productId).update(productData);
      } else {
        productData.createdAt = firebase.database.ServerValue.TIMESTAMP;
        await db.ref('products').push(productData);
      }

      alert('Product saved!');
      bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
      await this.loadProducts();
    } catch (e) {
      alert('Error: ' + (e?.message || e));
    }
  },

  deleteProduct: async function (productId) {
    if (!confirm('Delete this product permanently?')) return;
    try {
      await db.ref('products/' + productId).remove();
      await this.loadProducts();
    } catch (e) {
      alert('Error: ' + (e?.message || e));
    }
  },

  // ===== ORDERS =====
  listenForOrders: function () {
    if (!this.currentUser) return;

    // Avoid multiple listeners
    if (this.orderChildAddedUnsubscribe) return;

    const uid = this.currentUser.uid;

    // Reliable: use on('value') for simplicity (small app). If heavy, can optimize.
    db.ref('orders')
      .orderByChild('restaurantId')
      .equalTo(uid)
      .on('value', (snapshot) => {
        // Any change => refresh
        this.loadDashboard();
        const ordersPage = document.getElementById('orders-page');
        if (ordersPage && ordersPage.style.display === 'block') {
          this.loadOrders();
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
        const itemsHtml = order.items
          ? order.items.map(i => `<small>${i.name} x${i.qty}</small>`).join('<br>')
          : 'N/A';

        const d = order.timestamp
          ? new Date(order.timestamp).toLocaleDateString() + ' ' + new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'N/A';

        const status = order.status || 'Pending';
        const safeStatus = String(status).toLowerCase().replace(/\s+/g, '-');

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <strong>${order.customerName || 'Unknown'}</strong><br>
            <small class="text-muted"><i class="fas fa-phone"></i> ${order.customerPhone || 'N/A'}</small>
          </td>
          <td>${itemsHtml}</td>
          <td><small>${order.deliveryAddress || order.address || 'N/A'}</small></td>
          <td><span class="status-badge status-${safeStatus}">${status}</span></td>
          <td><small>${d}</small></td>
          <td class="text-center">
            ${typeof order.customerLat === 'number' && typeof order.customerLng === 'number' ?
              `<button class="btn btn-sm btn-outline-info me-1" onclick="Seller.viewLocation(${order.customerLat}, ${order.customerLng})" title="View Location"><i class="fas fa-map-marker-alt"></i></button>`
              : ''}
            <button class="btn btn-sm btn-outline-primary" onclick="Seller.updateStatus('${order.id}', '${order.status}')" title="Change Status"><i class="fas fa-sync-alt"></i></button>
          </td>
        `;

        tbody.appendChild(tr);
      }

      if (tbody.children.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No orders found</td></tr>';
      }
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-danger">Error: ${e?.message || e}</td></tr>`;
    }
  },

  // Status transitions matching your flow:
  // Pending (Seller can accept) -> Accepted (Seller accepts)
  // Accepted/Preparing -> Out for Delivery (Delivery boy sees)
  // Out for Delivery -> Delivered
  // Reject/Cancel -> Cancelled
  updateStatus: async function (orderId, currentStatus) {
    const status = currentStatus || 'Pending';

    // Define next map
    const nextMap = {
      'Pending': 'Accepted',
      'Accepted': 'Preparing',
      'Preparing': 'Out for Delivery',
      'Out for Delivery': 'Delivered',
      'Delivered': 'Delivered',
      'Cancelled': 'Cancelled'
    };

    const next = nextMap[status] || 'Accepted';

    if (status === 'Cancelled' || status === 'Delivered') {
      alert('Order already finalized: ' + status);
      return;
    }

    if (!confirm(`Change order status from ${status} to ${next}?`)) return;

    try {
      await db.ref('orders/' + orderId).update({ status: next });
      await this.loadOrders();
      await this.loadDashboard();

      // Notify customer when status changes
      const orderSnap = await db.ref('orders/' + orderId).once('value');
      const order = orderSnap.val() || {};
      const customerId = order.customerId || null;
      if (customerId) {
                await db.ref('notifications').push({
                    orderId: orderId,
                    userId: await this.getUserIdByOrderId(orderId),
                    message: 'Your order status has been updated to: ' + next,
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    read: false
                });
      }

      // When seller moves to Out for Delivery, we should pick delivery boy.
      // Current app may already have delivery logic; we only set a field that delivery page can use.
      if (next === 'Out for Delivery') {
        // deliveryReady:true can be used by delivery.js
        await db.ref('orders/' + orderId).update({ deliveryReady: true });
      }
    } catch (e) {
      alert('Error: ' + (e?.message || e));
    }
  },

  viewLocation: function (lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') return;

    const modal = new bootstrap.Modal(document.getElementById('mapModal'));

    setTimeout(() => {
      if (!this.map) {
        this.map = L.map('order-map').setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(this.map);
      } else {
        this.map.setView([lat, lng], 15);
      }

      if (this.mapMarker) this.mapMarker.remove();
      this.mapMarker = L.marker([lat, lng]).addTo(this.map).bindPopup('Delivery Location').openPopup();
    }, 150);

    modal.show();
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', function () {
  const productForm = document.getElementById('product-form');
  if (productForm) {
    productForm.addEventListener('submit', e => {
      e.preventDefault();
      Seller.saveProduct();
    });
  }

  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', e => {
      e.preventDefault();
      Seller.saveSettings();
    });
  }

  Seller.init();
});

