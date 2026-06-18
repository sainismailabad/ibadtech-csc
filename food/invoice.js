// Invoice generator (Client-side)
// Usage: Invoice.download(orderId, userRole)
// userRole: 'customer' | 'seller' | 'delivery'

const Invoice = {
  _escapeHtml: function (str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  },

  _getItemLines: function (items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return items.map((it) => {
      const name = this._escapeHtml(it?.name || 'Item');
      const qty = Number(it?.qty ?? 1);
      return `<tr><td>${name}</td><td style="text-align:right;">${qty}</td></tr>`;
    }).join('');
  },

  // Generates a standalone HTML receipt and opens it for print.
  // Then user can Save as PDF from print dialog.
  // (Real PDF generation needs a server or a library.)
  renderHtml: function (order, opts = {}) {
    const restaurantName = order?.restaurantName || 'Restaurant';
    const customerName = order?.customerName || 'Customer';
    const orderId = order?.id || order?.orderId || '';
    const status = order?.status || 'Delivered';
    const dateStr = order?.timestamp ? new Date(order.timestamp).toLocaleString() : (order?.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : '');

    const address = order?.deliveryAddress || order?.address || '';
    const city = order?.city || '';

    const items = this._getItemLines(order?.items);

    const amount = Number(order?.totalAmount || 0);
    const deliveryFee = Number(order?.deliveryFee || 0);
    const couponDiscount = Number(order?.couponDiscount || 0);
    const walletDiscount = Number(order?.walletDiscount || 0);
    const additionalCharges = Number(order?.additionalCharges || order?.extraCharges || order?.taxes || 0);
    const calculatedTotal = Math.max(0, amount + deliveryFee + additionalCharges - couponDiscount - walletDiscount);
    const total = Number(order?.finalAmount ?? calculatedTotal);

    const partnerName = order?.deliveryPartnerName || 'Delivery Partner';

    const money = (n) => `₹${Number(n || 0).toFixed(2)}`;

    const safeOrderId = this._escapeHtml(orderId);
    const safeRestaurant = this._escapeHtml(restaurantName);
    const safeCustomer = this._escapeHtml(customerName);
    const safeAddress = this._escapeHtml(address);
    const safeCity = this._escapeHtml(city);
    const safePartnerName = this._escapeHtml(partnerName);

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Invoice ${safeOrderId}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 24px; color: #111; }
    .wrap { max-width: 820px; margin: 0 auto; }
    .top { display:flex; justify-content:space-between; gap: 16px; align-items:flex-start; }
    .brand { font-weight: 800; color:#ff6b35; font-size: 22px; }
    .tag { background: #ff6b35; color: white; padding: 6px 12px; border-radius: 999px; font-weight: 700; font-size: 12px; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 18px; }
    .card { border: 1px solid #eee; border-radius: 14px; padding: 14px; }
    h2 { margin: 18px 0 6px; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 10px 8px; border-bottom: 1px solid #f2f2f2; font-size: 13px; }
    th { color:#444; text-align:left; font-weight: 700; }
    .right { text-align:right; }
    .totals { margin-top: 14px; }
    .tot-row { display:flex; justify-content:space-between; padding: 6px 0; font-size: 14px; }
    .grand { font-weight: 800; }
    .muted { color:#666; font-size: 12px; }
    .footer { margin-top: 22px; border-top: 1px dashed #ddd; padding-top: 14px; font-size: 12px; color:#666; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div>
        <div class="brand">Ibad Foodie</div>
        <div class="muted">Order Invoice</div>
      </div>
      <div class="tag">${this._escapeHtml(status)}</div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="muted">Order ID</div>
        <div style="font-weight:800;font-size:18px;">#${safeOrderId}</div>
        <div class="muted" style="margin-top:6px;">Date: ${this._escapeHtml(dateStr)}</div>
      </div>
      <div class="card">
        <div class="muted">Delivery Address</div>
        <div style="font-weight:700; margin-top:6px;">${safeAddress}</div>
        <div class="muted">${safeCity}</div>
      </div>
    </div>

    <h2>Bill To</h2>
    <div class="card" style="margin-top:8px;">
      <div style="font-weight:700;">${safeCustomer}</div>
      <div class="muted" style="margin-top:4px;">Restaurant: ${safeRestaurant}</div>
      <div class="muted" style="margin-top:4px;">Partner: ${safePartnerName}</div>
    </div>

    <h2>Items</h2>
    <table>
      <thead>
        <tr><th>Item</th><th class="right">Qty</th></tr>
      </thead>
      <tbody>
        ${items}
      </tbody>
    </table>

    <div class="totals card">
      <div class="tot-row"><div>Subtotal</div><div class="right">${money(amount)}</div></div>
      <div class="tot-row"><div>Delivery Fee</div><div class="right">${money(deliveryFee)}</div></div>
      ${additionalCharges > 0 ? `<div class="tot-row"><div>Additional Charges</div><div class="right">${money(additionalCharges)}</div></div>` : ''}
      ${couponDiscount > 0 ? `<div class="tot-row"><div>Coupon Discount</div><div class="right">- ${money(couponDiscount)}</div></div>` : ''}
      ${walletDiscount > 0 ? `<div class="tot-row"><div>Wallet Discount</div><div class="right">- ${money(walletDiscount)}</div></div>` : ''}
      <div class="tot-row grand"><div>Total</div><div class="right">${money(total)}</div></div>
      <div class="muted" style="margin-top:8px;">Tip if any not included (system invoice)</div>
    </div>

    <div class="footer">
      Download/Print: Use browser print -> Save as PDF.
    </div>
  </div>

  <script>
    setTimeout(()=>{ try { window.focus(); window.print(); } catch(e){} }, 300);
  </script>
</body>
</html>`;

    return html;
  },

  download: async function (orderId, userRole) {
    if (!orderId) return;
    try {
      // Load order data
      const orderSnap = await db.ref('orders/' + orderId).once('value');
      if (!orderSnap.exists()) {
        auth.showToast('Invoice not found for this order');
        return;
      }
      const order = orderSnap.val() || {};
      order.id = orderId;

      if (order.status !== 'Delivered') {
        auth.showToast('Invoice is available only after delivery');
        return;
      }

      const html = this.renderHtml(order, { userRole });
      const w = window.open('', '_blank');
      if (!w) {
        auth.showToast('Please allow popups to download invoice');
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (e) {
      auth.showToast('Invoice error: ' + (e?.message || e));
    }
  }
};

