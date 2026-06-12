// ====== Safety helpers (required by index.html) ======
// GST label helper
function getGSTTypeLabel(gstType) {
    switch (gstType) {
        case 'intrastate':
            return 'Intrastate (CGST+SGST)';
        case 'interstate':
            return 'Interstate (IGST)';
        case 'nilrated':
            return 'NIL Rated';
        case 'notax':
            return 'Without Tax';
        default:
            return '—';
    }
}

// Basic number to words for rupees (supports up to crores)
function numberToWords(amount) {
    const n = Math.floor(Number(amount) || 0);
    if (n === 0) return 'Zero';

    const ones = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
        'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function under100(num) {
        if (num < 20) return ones[num];
        const t = Math.floor(num / 10);
        const r = num % 10;
        return r === 0 ? tens[t] : `${tens[t]} ${ones[r]}`;
    }

    function under1000(num) {
        if (num < 100) return under100(num);
        const h = Math.floor(num / 100);
        const rem = num % 100;
        const hWord = `${ones[h]} Hundred`;
        return rem === 0 ? hWord : `${hWord} ${under100(rem)}`;
    }

    function chunkWords(num, divisor, label) {
        const q = Math.floor(num / divisor);
        if (q <= 0) return '';
        const w = under1000(q);
        return `${w} ${label}`;
    }

    // Split into crores, lakhs, thousands, hundreds
    const crores = Math.floor(n / 10000000);
    const lakhs = Math.floor((n % 10000000) / 100000);
    const thousands = Math.floor((n % 100000) / 1000);
    const rest = n % 1000;

    const parts = [];
    if (crores) parts.push(chunkWords(n, 10000000, 'Crore'));
    if (lakhs) parts.push(chunkWords(n % 10000000, 100000, 'Lakh'));
    if (thousands) parts.push(chunkWords(n % 100000, 1000, 'Thousand'));
    if (rest) parts.push(under1000(rest));

    return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// Professional GST Tax Invoice PDF generator (Tally Prime / Busy Accounting style)
function generatePDF() {
    try {
        const decodeHtml = (html) => {
            const txt = document.createElement('textarea');
            txt.innerHTML = String(html || '');
            return txt.value.replace(/&#8377;/g, 'Rs.').replace(/₹/g, 'Rs.');
        };
        const formatMoney = (amount) => Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const billNo = decodeHtml(document.getElementById('billNumber')?.value || '');
        const billDate = decodeHtml(document.getElementById('billDate')?.value || '');
        const subtotal = parseFloat(document.getElementById('subtotal')?.innerText?.replace(/[^0-9.]/g, '') || '0') || 0;
        const grandTotal = parseFloat(document.getElementById('grandTotal')?.innerText?.replace(/[^0-9.]/g, '') || '0') || 0;
        const words = decodeHtml((window.currentBillGrandTotal != null ? numberToWords(window.currentBillGrandTotal) : numberToWords(grandTotal)) + ' Only');

        const partySelect = document.getElementById('partySelect');
        const partyName = partySelect?.selectedIndex != null && partySelect.selectedIndex >= 0
            ? decodeHtml(partySelect.options[partySelect.selectedIndex]?.text || '')
            : decodeHtml(window.currentBillPartyName || '');

        const company = currentCompany || {};
        const coName = decodeHtml(company.name || 'Company Name').trim();
        const coGSTIN = decodeHtml(company.gstin || '27AXXXX54521X1Z').trim();
        const coAddress1 = decodeHtml(company.address1 || '');
        const coAddress2 = decodeHtml(company.address2 || '');
        const coAddress = [coAddress1, coAddress2].filter(Boolean).join(', ') || 'Address';
        const coContact = decodeHtml(company.contact || '').trim();
        const coEmail = decodeHtml(company.email || '').trim();
        const coState = decodeHtml(company.state || 'Haryana');
        const coStateCode = decodeHtml(company.stateCode || '06');

        const transport = decodeHtml(document.getElementById('billTransport')?.value || '-');
        const vehicleNo = decodeHtml(document.getElementById('billVehicle')?.value || '-');
        const destination = decodeHtml(document.getElementById('billDestination')?.value || '-');
        const ewayBill = decodeHtml(document.getElementById('billEway')?.value || '-');
        const gstType = currentGSTType || 'intrastate';
        const isReverseCharge = 'No';

        const partyGSTIN = decodeHtml(partySelect?.options[partySelect.selectedIndex]?.dataset?.gst || '').trim() || '-';
        const partyAddress = decodeHtml(partySelect?.options[partySelect.selectedIndex]?.dataset?.address || '').trim() || '-';
        const partyState = decodeHtml(partySelect?.options[partySelect.selectedIndex]?.dataset?.state || '').trim() || '-';
        const partyStateCode = decodeHtml(partySelect?.options[partySelect.selectedIndex]?.dataset?.stateCode || '').trim() || '-';

        const cgst = window.currentBillCGST || 0;
        const sgst = window.currentBillSGST || 0;
        const igst = window.currentBillIGST || 0;
        const roundOff = Math.round(grandTotal - (subtotal + cgst + sgst + igst));

        const items = (cartItems && cartItems.length) ? cartItems : (window.currentBillItems || []);
        if (items.length === 0) {
            alert('No items to generate invoice. Please add items first.');
            return;
        }

        let itemsHtml = '';
        items.forEach((it, idx) => {
            const qty = it.quantity ?? 1;
            const rate = it.rate ?? 0;
            const discPct = it.discountPct ?? (it.discount || 0);
            const taxable = qty * rate * (1 - discPct / 100);
            const cgstRate = gstType === 'intrastate' ? (it.gst / 2) : 0;
            const sgstRate = gstType === 'intrastate' ? (it.gst / 2) : 0;
            const igstRate = gstType === 'interstate' ? it.gst : 0;
            
            itemsHtml += `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${decodeHtml(it.name || 'Item')}<br><small>HSN: ${decodeHtml(it.hsn || '-')}</small></td>
                    <td>${qty} ${decodeHtml(it.unit || 'PCS')}</td>
                    <td>${formatMoney(rate)}</td>
                    <td>${formatMoney(taxable)}</td>
                    ${gstType === 'intrastate' ? `
                    <td>${cgstRate}%</td>
                    <td>${sgstRate}%</td>
                    ` : `
                    <td colspan="2">IGST: ${igstRate}%</td>
                    `}
                    <td>${formatMoney(taxable + (taxable * (it.gst || 0) / 100))}</td>
                </tr>
            `;
        });

        // Fill empty row to make it standard
        itemsHtml += `<tr style="height: 100%;"><td></td><td></td><td></td><td></td><td></td>${gstType === 'intrastate' ? '<td></td><td></td>' : '<td colspan="2"></td>'}<td></td></tr>`;

        const invoiceWindow = window.open('', '_blank');
        if (!invoiceWindow) {
            alert('Please allow popups to generate the invoice.');
            return;
        }

        // Get bank details from SAVED COMPANY PROFILE (Firebase) - only show what's actually saved
        const coBankName = decodeHtml(company.bankName || '').trim() || '—';
        const coAccountNo = decodeHtml(company.accountNo || '').trim() || '—';
        const coIFSC = decodeHtml(company.ifscCode || '').trim() || '—';
        const coBranch = decodeHtml(company.branchName || '').trim() || '—';

        invoiceWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Tax Invoice - ${billNo}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
            --primary: #1a237e;
            --border: #000;
            --text: #222;
            --text-muted: #444;
            --font: 'Segoe UI', 'Roboto', Arial, sans-serif;
        }

        body {
            background: #f0f2f5;
            font-family: var(--font);
            font-size: 11.5px;
            color: var(--text);
            padding: 40px 20px;
            line-height: 1.4;
        }

        .page-wrapper {
            max-width: 800px;
            margin: 0 auto;
            background: #fff;
            border: 3px double #000;
            padding: 6px;
        }

        .inner-border {
            border: 1px solid #000;
            padding: 18px 22px;
        }

        .header-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
            flex-wrap: wrap;
            gap: 8px;
        }

        .company-details { flex: 1 1 58%; }

        .company-details h2 {
            font-size: 18px;
            font-weight: 700;
            color: #000;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 3px;
        }

        .company-details p {
            font-size: 11px;
            color: var(--text-muted);
            margin-bottom: 1px;
            line-height: 1.35;
        }

        .company-details .gstin-label { font-weight: 700; color: #000; }

        .invoice-title { text-align: right; flex-shrink: 0; }

        .invoice-title h1 {
            font-size: 22px;
            font-weight: 800;
            color: #000;
            letter-spacing: 1px;
            text-transform: uppercase;
            line-height: 1.15;
        }

        .invoice-title p { font-size: 10px; color: var(--text-muted); font-style: italic; }

        .flex-row {
            display: flex;
            flex-wrap: wrap;
            border: 1px solid #000;
            margin-bottom: 8px;
        }

        .flex-col {
            flex: 1 1 50%;
            padding: 7px 10px;
            min-width: 260px;
        }

        .flex-col:not(:last-child) { border-right: 1px solid #000; }

        .info-grid {
            display: grid;
            grid-template-columns: max-content 1fr;
            gap: 2px 10px;
            align-items: baseline;
        }

        .info-grid span:first-child { font-weight: 600; color: #000; white-space: nowrap; }
        .info-grid span:last-child { color: var(--text-muted); }

        .flex-col h3 {
            font-size: 12px;
            font-weight: 700;
            color: #000;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            margin-bottom: 4px;
            border-bottom: 1px dashed #999;
            padding-bottom: 3px;
        }

        .flex-col p { font-size: 11px; color: var(--text-muted); margin-bottom: 1px; }
        .flex-col p strong { color: #000; }

        .table-container { width: 100%; margin: 2px 0 8px; }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            border: 1px solid #000;
        }

        thead th {
            background: #1a237e;
            color: #fff;
            font-weight: 600;
            text-align: center;
            padding: 6px 4px;
            font-size: 10.5px;
            text-transform: uppercase;
            letter-spacing: 0.2px;
            border: 1px solid #000;
        }

        tbody td {
            padding: 5px 4px;
            text-align: right;
            border: 1px solid #000;
            vertical-align: top;
        }

        tbody td:nth-child(2) { text-align: left; }
        tbody tr:last-child td { border-bottom: 2px solid #000; }

        .summary-section {
            display: flex;
            flex-wrap: wrap;
            border: 1px solid #000;
            margin-bottom: 8px;
        }

        .tax-summary, .totals {
            flex: 1 1 50%;
            padding: 8px 12px;
            min-width: 240px;
        }

        .totals { border-left: 1px solid #000; background: #f5f5f5; }

        .summary-section h3 {
            font-size: 12px;
            font-weight: 700;
            color: #000;
            text-transform: uppercase;
            border-bottom: 2px solid #000;
            padding-bottom: 4px;
            margin-bottom: 6px;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: 1fr max-content;
            gap: 3px 10px;
            align-items: baseline;
        }

        .summary-grid span:nth-child(odd) { font-weight: 600; color: #000; }
        .summary-grid span:nth-child(even) { text-align: right; font-weight: 500; }

        .summary-grid .grand-total-label { font-size: 14px; font-weight: 800; color: #000; }
        .summary-grid .grand-total-value { font-size: 15px; font-weight: 800; color: #000; }

        .amount-words {
            padding: 7px 10px;
            border: 1px solid #000;
            margin-bottom: 8px;
            font-weight: 700;
            font-size: 12px;
            color: #000;
            background: #f5f5f5;
        }
        .amount-words span { color: #000; }

        .bottom-section {
            display: flex;
            flex-wrap: wrap;
            border: 1px solid #000;
            margin-bottom: 6px;
        }

        .bottom-left {
            flex: 1 1 50%;
            padding: 8px 10px;
            min-width: 240px;
            border-right: 1px solid #000;
        }

        .bottom-right {
            flex: 1 1 50%;
            padding: 8px 10px;
            min-width: 240px;
        }

        .bottom-left h4, .bottom-right h4 {
            font-size: 12px;
            font-weight: 700;
            color: #000;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
            padding-bottom: 3px;
            margin-bottom: 5px;
        }

        .bank-details-grid {
            display: grid;
            grid-template-columns: max-content 1fr;
            gap: 1px 8px;
            font-size: 10.5px;
            align-items: baseline;
        }

        .bank-details-grid span:first-child { font-weight: 600; color: #000; white-space: nowrap; }
        .bank-details-grid span:last-child { color: var(--text-muted); }

        .terms-section ol {
            padding-left: 16px;
            margin-bottom: 4px;
            font-size: 10.5px;
        }
        .terms-section ol li { margin-bottom: 1px; line-height: 1.35; }

        .signature-line-right {
            margin-top: 20px;
            text-align: right;
            padding-top: 5px;
            border-top: 1px solid #999;
        }

        .signature-line-right p { font-size: 11px; color: var(--text-muted); }
        .signature-line-right .company-name { font-weight: 700; color: #000; }
        .signature-line-right .signature-text { margin-top: 30px; font-weight: 600; color: #000; }

        @media print {
            body {
                background: #fff !important;
                padding: 0;
                margin: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .page-wrapper {
                max-width: 100%;
                border: 3px double #000 !important;
                padding: 2px;
                margin: 0;
                box-sizing: border-box;
            }
            .inner-border { padding: 10px 12px; }
            thead th { background: #1a237e !important; color: #fff !important; }
            .totals { background: #f5f5f5 !important; }
            .amount-words { background: #f5f5f5 !important; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            @page { size: A4; margin: 4mm 5mm; }
        }
    </style>
</head>
<body>
    <div class="page-wrapper">
        <div class="inner-border">

            <div class="header-section">
                <div class="company-details">
                    <h2>${coName}</h2>
                    <p>${coAddress}</p>
                    <p>📞 ${coContact} &nbsp;|&nbsp; ✉ ${coEmail}</p>
                    <p><span class="gstin-label">GSTIN:</span> ${coGSTIN}</p>
                </div>
                <div class="invoice-title">
                    <h1>Tax Invoice</h1>
                    <p>(Original for Recipient)</p>
                </div>
            </div>

            <div class="flex-row">
                <div class="flex-col">
                    <div class="info-grid">
                        <span>Invoice No:</span> <span>${billNo || '-'}</span>
                        <span>Invoice Date:</span> <span>${billDate || '-'}</span>
                        <span>Place of Supply:</span> <span>${coState} (${coStateCode})</span>
                        <span>Reverse Charge:</span> <span>${isReverseCharge}</span>
                    </div>
                </div>
                <div class="flex-col">
                    <div class="info-grid">
                        <span>Transport Mode:</span> <span>${transport}</span>
                        <span>Vehicle No:</span> <span>${vehicleNo}</span>
                        <span>Station:</span> <span>${destination}</span>
                        <span>E-Way Bill No:</span> <span>${ewayBill}</span>
                    </div>
                </div>
            </div>

            <div class="flex-row">
                <div class="flex-col">
                    <h3>Billed To</h3>
                    <p><strong>${partyName || 'Cash Customer'}</strong></p>
                    <p>${partyAddress}</p>
                    <p>State: ${partyState} (${partyStateCode})</p>
                    <p><strong>GSTIN:</strong> ${partyGSTIN}</p>
                </div>
                <div class="flex-col">
                    <h3>Shipped To</h3>
                    <p><strong>${partyName || 'Cash Customer'}</strong></p>
                    <p>${partyAddress}</p>
                    <p>State: ${partyState} (${partyStateCode})</p>
                    <p><strong>GSTIN:</strong> ${partyGSTIN}</p>
                </div>
            </div>

            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style="width:30px;">#</th>
                            <th>Description of Goods / Services</th>
                            <th style="width:40px;">Qty</th>
                            <th style="width:55px;">Rate (₹)</th>
                            <th style="width:70px;">Taxable Value (₹)</th>
                            ${gstType === 'intrastate' ? `
                            <th style="width:48px;">CGST (%)</th>
                            <th style="width:48px;">SGST (%)</th>
                            ` : `
                            <th colspan="2" style="width:96px;">IGST (%)</th>
                            `}
                            <th style="width:65px;">Total (₹)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
            </div>

            <div class="summary-section">
                <div class="tax-summary">
                    <h3>Tax Summary</h3>
                    <div class="summary-grid">
                        <span>Total Taxable Amount:</span> <span>₹ ${formatMoney(subtotal)}</span>
                        ${gstType === 'intrastate' ? `
                        <span>CGST Amount:</span> <span>₹ ${formatMoney(cgst)}</span>
                        <span>SGST Amount:</span> <span>₹ ${formatMoney(sgst)}</span>
                        ` : `
                        <span>IGST Amount:</span> <span>₹ ${formatMoney(igst)}</span>
                        `}
                        <span>Round Off:</span> <span>₹ ${formatMoney(roundOff)}</span>
                    </div>
                </div>
                <div class="totals">
                    <h3>Totals</h3>
                    <div class="summary-grid">
                        <span>Subtotal:</span> <span>₹ ${formatMoney(subtotal)}</span>
                        ${gstType === 'intrastate' ? `
                        <span>Total CGST:</span> <span>₹ ${formatMoney(cgst)}</span>
                        <span>Total SGST:</span> <span>₹ ${formatMoney(sgst)}</span>
                        ` : `
                        <span>Total IGST:</span> <span>₹ ${formatMoney(igst)}</span>
                        `}
                        <span class="grand-total-label">Grand Total:</span> <span class="grand-total-value">₹ ${formatMoney(grandTotal)}</span>
                    </div>
                </div>
            </div>

            <div class="amount-words">
                Amount in words: <span>Rupees ${words}</span>
            </div>

            <!-- BANK DETAILS + TERMS & SIGNATURE SIDE BY SIDE -->
            <div class="bottom-section">
                <div class="bottom-left">
                    <h4>Bank Details</h4>
                    <div class="bank-details-grid">
                        <span>Bank Name:</span> <span>${coBankName}</span>
                        <span>Account No:</span> <span>${coAccountNo}</span>
                        <span>IFSC Code:</span> <span>${coIFSC}</span>
                        <span>Branch:</span> <span>${coBranch}</span>
                        <span>Account Type:</span> <span>Current Account</span>
                    </div>
                </div>
                <div class="bottom-right terms-section">
                    <h4>Terms & Conditions</h4>
                    <ol>
                        <li>Subject to ${coState} jurisdiction.</li>
                        <li>Goods once sold will not be taken back.</li>
                        <li>Interest @ 18% p.a. on delayed payments.</li>
                    </ol>
                    <div class="signature-line-right">
                        <p>For <span class="company-name">${coName}</span></p>
                        <div class="signature-text">Authorized Signatory</div>
                    </div>
                </div>
            </div>

        </div>
    </div>
    <script>
        setTimeout(() => {
            window.print();
        }, 500);
    </script>
</body>
</html>`);
        invoiceWindow.document.close();
    } catch (e) {
        console.error('generatePDF error:', e);
        alert('Error generating PDF/Invoice: ' + (e?.message || e));
    }
}

// ====== Purchase module (minimal stubs so UI works) ======
let purchaseItems = [];
function showPurchaseModal() {
    document.getElementById('purchaseModal').style.display = 'flex';
    // Fill suppliers
    const sel = document.getElementById('purchaseSupplier');
    if (sel) {
        sel.innerHTML = '<option value="">Select Supplier</option>';
        allParties.forEach(p => {
            sel.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
    }

    const itemSel = document.getElementById('purchaseItemSelect');
    if (itemSel) {
        itemSel.innerHTML = '<option value="">Select Item</option>';
        allItems.forEach(it => {
            itemSel.innerHTML += `<option value="${it.id}">${it.name}</option>`;
        });
    }

    purchaseItems = [];
    const body = document.getElementById('purchaseItemsList');
    if (body) body.innerHTML = '';

    const totalEl = document.getElementById('purchaseTotalAmount');
    if (totalEl) totalEl.value = '0.00';
    updatePurchasePreview();
}
function closePurchaseModal() {
    document.getElementById('purchaseModal').style.display = 'none';
}

function updatePurchaseItemRate() {
    const itemId = document.getElementById('purchaseItemSelect')?.value;
    const qty = parseFloat(document.getElementById('purchaseItemQty')?.value || '1') || 1;
    const it = allItems.find(x => x.id === itemId);
    if (!it) return;
    document.getElementById('purchaseItemRate').value = it.costPrice != null ? it.costPrice : (it.rate || 0);
    document.getElementById('purchaseItemGST').value = it.gst != null ? it.gst : 0;
    updatePurchasePreview();
}

function addPurchaseItem() {
    const itemId = document.getElementById('purchaseItemSelect')?.value;
    const qty = parseFloat(document.getElementById('purchaseItemQty')?.value || '0') || 0;
    const rate = parseFloat(document.getElementById('purchaseItemRate')?.value || '0') || 0;
    const gst = parseFloat(document.getElementById('purchaseItemGST')?.value || '0') || 0;

    if (!itemId || qty <= 0) {
        alert('Select item and enter valid quantity');
        return;
    }
    const it = allItems.find(x => x.id === itemId);
    if (!it) return;

    purchaseItems.push({
        id: itemId,
        name: it.name,
        hsn: it.hsn || '',
        quantity: qty,
        unit: it.unit || 'PCS',
        rate: rate,
        gst: gst
    });

    document.getElementById('purchaseItemsList').innerHTML = purchaseItems.map((p, i) => `
        <tr>
            <td>${p.name}</td>
            <td>${p.quantity}</td>
            <td>₹${Number(p.rate).toFixed(2)}</td>
            <td>${p.gst}%</td>
            <td>₹${(p.quantity * p.rate).toFixed(2)}</td>
            <td><button class="action-btn delete-btn-small" onclick="deletePurchaseItem(${i})"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');

    updatePurchasePreview();
}

function deletePurchaseItem(i) {
    purchaseItems.splice(i, 1);
    const body = document.getElementById('purchaseItemsList');
    if (body) {
        body.innerHTML = purchaseItems.map((p, idx) => `
            <tr>
                <td>${p.name}</td>
                <td>${p.quantity}</td>
                <td>₹${Number(p.rate).toFixed(2)}</td>
                <td>${p.gst}%</td>
                <td>₹${(p.quantity * p.rate).toFixed(2)}</td>
                <td><button class="action-btn delete-btn-small" onclick="deletePurchaseItem(${idx})"><i class="fas fa-trash"></i></button></td>
            </tr>
        `).join('');
    }
    updatePurchasePreview();
}

function updatePurchasePreview() {
    const total = purchaseItems.reduce((sum, it) => sum + (it.quantity * it.rate), 0);
    const totalEl = document.getElementById('purchaseTotalAmount');
    if (totalEl) totalEl.value = total.toFixed(2);

    // Simplified journal preview (Debit Purchases / Credit Cash/Bank or Supplier)
    const mode = document.getElementById('purchasePaymentMode')?.value || 'credit';
    const supplierId = document.getElementById('purchaseSupplier')?.value || '';
    const supplier = allParties.find(p => p.id === supplierId);
    const supplierName = supplier?.name || 'Supplier A/c';

    const debitEl = document.getElementById('purchaseDebitPreview');
    const creditEl = document.getElementById('purchaseCreditPreview');
    const creditAccEl = document.getElementById('purchaseCreditAccount');

    if (debitEl) debitEl.textContent = `₹${total.toFixed(2)}`;
    if (creditEl) creditEl.textContent = `₹${total.toFixed(2)}`;
    if (creditAccEl) creditAccEl.textContent = mode === 'credit' ? supplierName : (mode === 'cash' ? 'Cash A/c' : 'Bank A/c');
}

function calculatePurchaseAmount() {
    updatePurchasePreview();
}

function savePurchaseEntry() {
    const purchaseDate = document.getElementById('purchaseDate')?.value;
    const billNo = document.getElementById('purchaseBillNo')?.value;
    const supplierId = document.getElementById('purchaseSupplier')?.value;
    const supplier = allParties.find(p => p.id === supplierId);
    const supplierName = supplier?.name || 'Supplier';
    const mode = document.getElementById('purchasePaymentMode')?.value || 'credit';

    if (!purchaseDate || !billNo) {
        alert('Please enter purchase date and bill number');
        return;
    }
    if (!supplierId) {
        alert('Please select supplier');
        return;
    }
    if (!purchaseItems.length) {
        alert('Please add at least 1 item');
        return;
    }

    const subtotal = purchaseItems.reduce((sum, it) => sum + (it.quantity * it.rate), 0);
    const purchase = {
        type: 'purchase',
        gstType: 'intrastate',
        billNumber: billNo,
        date: purchaseDate,
        partyId: supplierId,
        partyName: supplierName,
        items: purchaseItems,
        subtotal: subtotal,
        cgst: 0,
        sgst: 0,
        igst: 0,
        grandTotal: subtotal,
        poNo: '',
        ewayBill: '',
        vehicleNo: '',
        transport: '',
        destination: '',
        timestamp: Date.now(),
        narration: `Purchase of ${purchaseItems.length} item(s)`
    };

    db.ref('users/' + currentUser.uid + '/bills').push().set(purchase)
        .then(() => {
            // Update stock
            purchaseItems.forEach(pi => {
                const stockItem = allItems.find(x => x.id === pi.id);
                if (!stockItem) return;
                const newStock = (stockItem.openingStock || 0) + pi.quantity;
                db.ref('users/' + currentUser.uid + '/stockItems/' + pi.id).update({ openingStock: newStock });
            });

            // Journal entry simplified
            const debitAccount = 'Purchases A/c';
            const creditAccount = mode === 'credit' ? supplierName + ' A/c' : (mode === 'cash' ? 'Cash A/c' : 'Bank A/c');
            db.ref('users/' + currentUser.uid + '/journalEntries').push().set({
                type: 'purchase',
                date: purchaseDate,
                entryNo: 'JE/' + billNo,
                voucherNo: billNo,
                debitAccount,
                creditAccount,
                debitAmount: purchase.grandTotal,
                creditAmount: purchase.grandTotal,
                partyId: supplierId,
                partyName: supplierName,
                items: purchaseItems,
                explanation: `Purchase of ${purchaseItems.length} item(s) from ${supplierName}`,
                timestamp: Date.now(),
                paymentMode: mode
            });

            if (mode === 'credit') {
                recordPartyTransaction(supplierId, supplierName, purchase.grandTotal, 'purchase', purchaseDate, 'credit', billNo);
                updatePartyBalance(supplierId, purchase.grandTotal, 'purchase');
            }

            alert('Purchase saved successfully!');
            closePurchaseModal();
        })
        .catch(err => alert('Error saving purchase: ' + err.message));
}

// ====== Reports modal ======
function showReportsModal() {
    document.getElementById('reportsModal').style.display = 'flex';
    showReportTab('dashboard');
}

// ==================== Existing code ====================
// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyDhCKTTPq6xcp86pKdEUU5UnbEalIwbciU",
    authDomain: "sebdelviry.firebaseapp.com",
    databaseURL: "https://sebdelviry-default-rtdb.firebaseio.com",
    projectId: "sebdelviry",
    storageBucket: "sebdelviry.firebasestorage.app",
    messagingSenderId: "14297911674",
    appId: "1:14297911674:web:fcceb6f0371b6da22006c3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Set authentication persistence - user stays logged in
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        console.log('Auth persistence set to LOCAL');
    })
    .catch((error) => {
        console.error('Error setting auth persistence:', error);
    });

// Global Variables
let currentUser = null;
let currentCompany = null;
let cartItems = [];
let allItems = [];
let allParties = [];
let allBills = [];
let allPayments = [];
let allReceipts = [];
let allContraEntries = [];
let allJournalEntries = [];
let editingBillId = null;
let currentBillType = 'sale';
let currentGSTType = 'intrastate';
let companyState = 'Haryana';
let companyStateCode = '06';

// GST Rate Options
const gstRates = [0, 5, 12, 18, 28];

// Check Auth State
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('userEmailDisplay').innerText = user.email;
        
        // Load user data using UID
        loadUserData(user.uid);
    } else {
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});

function setMessage(elementId, message, type = 'error') {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.textContent = message || '';
    element.style.display = message ? 'flex' : 'none';

    if (type === 'success') {
        element.style.color = 'var(--success-700)';
        element.style.background = 'var(--success-50)';
    } else {
        element.style.color = 'var(--danger-600)';
        element.style.background = 'var(--danger-50)';
    }
}

function getFriendlyAuthError(error) {
    if (!error) return 'Login failed. Please try again.';

    const code = error.code || '';

    switch (code) {
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/user-disabled':
            return 'This account has been disabled. Please contact support.';
        case 'auth/user-not-found':
            return 'No account found with this email address.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please check and try again.';
        case 'auth/invalid-credential':
            return 'Email or password is incorrect.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please wait and try again.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your internet connection.';
        case 'auth/operation-not-allowed':
            return 'Email/Password login is not enabled in Firebase. Please enable it in Firebase Authentication.';
        default:
            return error.message || 'Login failed. Please try again.';
    }
}

// Login Function
function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const loginButton = document.querySelector('.login-btn[onclick="login()"]');
    
    setMessage('loginError', '');
    setMessage('loginSuccess', '');

    if (!window.firebase || !auth) {
        setMessage('loginError', 'Firebase SDK failed to load. Check your internet connection and Firebase scripts.');
        return;
    }
    
    if (!email || !password) {
        setMessage('loginError', 'Please enter email and password');
        return;
    }

    if (loginButton) {
        loginButton.disabled = true;
        loginButton.style.opacity = '0.7';
        loginButton.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Logging in...';
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            setMessage('loginSuccess', 'Login successful! Loading dashboard...', 'success');
        })
        .catch((error) => {
            console.error('Login error:', error);
            setMessage('loginError', getFriendlyAuthError(error));
        })
        .finally(() => {
            if (loginButton) {
                loginButton.disabled = false;
                loginButton.style.opacity = '';
                loginButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
            }
        });
}

// Logout
function logout() {
    auth.signOut();
}

// Forgot Password
function showForgotModal() {
    document.getElementById('forgotModal').style.display = 'flex';
}

function closeForgotModal() {
    document.getElementById('forgotModal').style.display = 'none';
    document.getElementById('forgotEmail').value = '';
    setMessage('forgotError', '');
    setMessage('forgotSuccess', '');
}

function resetPassword() {
    const email = document.getElementById('forgotEmail').value.trim();
    
    if (!email) {
        setMessage('forgotError', 'Please enter your email');
        return;
    }
    
    auth.sendPasswordResetEmail(email)
        .then(() => {
            setMessage('forgotSuccess', 'Password reset email sent! Check your inbox.', 'success');
            setMessage('forgotError', '');
        })
        .catch((error) => {
            console.error('Password reset error:', error);
            setMessage('forgotError', getFriendlyAuthError(error));
            setMessage('forgotSuccess', '');
        });
}

// Layout Toggle - Fixed for new Enterprise Sidebar positioning
function toggleSidebar() {
    const sidebar = document.getElementById('erpSidebar');
    const mainContent = document.getElementById('mainContent');
    
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('active');
        // Add/remove overlay for mobile
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.onclick = function() {
                sidebar.classList.remove('active');
                overlay.style.display = 'none';
            };
            document.body.appendChild(overlay);
        }
        if (sidebar.classList.contains('active')) {
            overlay.style.display = 'block';
        } else {
            overlay.style.display = 'none';
        }
    } else {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    }
}

// Setup Active Menu Item
document.addEventListener('DOMContentLoaded', () => {
    const menuItems = document.querySelectorAll('.sidebar-menu li:not(.menu-label)');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            // Don't set active if it's just an alert link
            if (this.getAttribute('onclick') && this.getAttribute('onclick').includes('alert')) return;
            
            menuItems.forEach(m => m.classList.remove('active'));
            this.classList.add('active');
        });
    });
});


// Initialize default data for first time users
function initializeDefaultData() {
    if (!currentUser) return;
    
    // Check and create default company if not exists
    db.ref('users/' + currentUser.uid + '/company').once('value', (snapshot) => {
        if (!snapshot.exists()) {
            const defaultCompany = {
                gstin: '27AXXXX54521X1Z',
                name: 'Your Company Name',
                address1: 'Your Address Line 1',
                address2: 'Your Address Line 2',
                contact: '7056836166',
                whatsapp: '+917056836166',
                email: 'company@email.com',
                state: 'Haryana',
                stateCode: '06',
                pan: '',
                bankName: '',
                accountNo: '',
                ifscCode: '',
                branchName: '',
                upi: '',
                terms: '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if payment is delayed.\n3. Subject to local jurisdiction.',
                createdAt: Date.now()
            };
            db.ref('users/' + currentUser.uid + '/company').set(defaultCompany);
        }
    });
    
    // ERP Architecture Initialization - Establish PRD Database Structure
    const essentialPaths = [
        'ledgers',
        'customers',
        'vendors',
        'banking',
        'payroll',
        'crm',
        'auditLogs',
        'documents'
    ];
    
    essentialPaths.forEach(path => {
        db.ref('users/' + currentUser.uid + '/' + path).once('value', (snapshot) => {
            if (!snapshot.exists()) {
                // Create an empty dummy record to initialize the path properly
                db.ref('users/' + currentUser.uid + '/' + path + '/_init').set(Date.now());
            }
        });
    });
    
    // Check and create sample parties if not exists
    db.ref('users/' + currentUser.uid + '/parties').once('value', (snapshot) => {
        if (!snapshot.exists()) {
            const sampleParties = {
                party1: {
                    name: 'Riya Gandi',
                    phone: '9876543210',
                    address: 'Ismailabad, Kurukshetra, Haryana',
                    gst: '06XXXXXXXXXXX1',
                    state: 'Haryana',
                    stateCode: '06',
                    createdAt: Date.now()
                },
                party2: {
                    name: 'Amit Sharma',
                    phone: '9876543211',
                    address: 'Delhi, New Delhi',
                    gst: '07XXXXXXXXXXX2',
                    state: 'Delhi',
                    stateCode: '07',
                    createdAt: Date.now()
                }
            };
            db.ref('users/' + currentUser.uid + '/parties').set(sampleParties);
        }
    });
    
    // Check and create sample stock items if not exists
    db.ref('users/' + currentUser.uid + '/stockItems').once('value', (snapshot) => {
        if (!snapshot.exists()) {
            const sampleItems = {
                item1: {
                    name: 'Mobile Phone',
                    hsn: '6303',
                    unit: 'PCS',
                    category: 'Electronics',
                    mrp: 12000,
                    openingStock: 50,
                    rate: 10000,
                    gst: 18,
                    createdAt: Date.now()
                },
                item2: {
                    name: 'Laptop',
                    hsn: '6303',
                    unit: 'PCS',
                    category: 'Electronics',
                    mrp: 50000,
                    openingStock: 20,
                    rate: 45000,
                    gst: 18,
                    createdAt: Date.now()
                },
                item3: {
                    name: 'Headphones',
                    hsn: '6303',
                    unit: 'PCS',
                    category: 'Accessories',
                    mrp: 2000,
                    openingStock: 100,
                    rate: 1500,
                    gst: 18,
                    createdAt: Date.now()
                }
            };
            db.ref('users/' + currentUser.uid + '/stockItems').set(sampleItems);
        }
    });
}

// Load User Data
function loadUserData(uid) {
    // Check if user has company data
    db.ref('users/' + uid + '/company').once('value', (snapshot) => {
        if (!snapshot.exists()) {
            const defaultCompany = {
                gstin: '27AXXXX54521X1Z',
                name: 'Lakshay Trading Company',
                address1: 'Kathgarh Road, Ismailabad',
                address2: 'Kurukshetra Haryana',
                contact: '7056836166',
                whatsapp: '+917056836166',
                email: 'Lakshay@123',
                state: 'Haryana',
                stateCode: '06',
                pan: 'ABCDE1234F',
                bankName: 'State Bank of India',
                accountNo: '31XXXXXXXXX5',
                ifscCode: 'SBIN000XXXX',
                branchName: 'Ismailabad',
                upi: '',
                terms: '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if payment is delayed.\n3. Subject to local jurisdiction.',
                createdAt: Date.now()
            };
            db.ref('users/' + uid + '/company').set(defaultCompany);
            
            // Create sample parties
            const sampleParties = {
                party1: {
                    name: 'Riya Gandi',
                    phone: '9876543210',
                    address: 'Ismailabad, Kurukshetra, Haryana',
                    gst: '06XXXXXXXXXXX1',
                    state: 'Haryana',
                    stateCode: '06',
                    pan: '',
                    openingBalance: 0,
                    createdAt: Date.now()
                },
                party2: {
                    name: 'Amit Sharma',
                    phone: '9876543211',
                    address: 'Delhi, New Delhi',
                    gst: '07XXXXXXXXXXX2',
                    state: 'Delhi',
                    stateCode: '07',
                    pan: '',
                    openingBalance: 0,
                    createdAt: Date.now()
                }
            };
            db.ref('users/' + uid + '/parties').set(sampleParties);
            
            // Create sample stock items with correct HSN codes
            const sampleItems = {
                item1: {
                    name: 'Mobile Phone',
                    hsn: '8517',
                    unit: 'PCS',
                    openingStock: 50,
                    rate: 10000,
                    gst: 18,
                    createdAt: Date.now()
                },
                item2: {
                    name: 'Laptop',
                    hsn: '8471',
                    unit: 'PCS',
                    openingStock: 20,
                    rate: 45000,
                    gst: 18,
                    createdAt: Date.now()
                },
                item3: {
                    name: 'Headphones',
                    hsn: '8518',
                    unit: 'PCS',
                    openingStock: 100,
                    rate: 1500,
                    gst: 18,
                    createdAt: Date.now()
                }
            };
            db.ref('users/' + uid + '/stockItems').set(sampleItems);
        }
    });

    // Company Data
    db.ref('users/' + uid + '/company').on('value', (snapshot) => {
        const company = snapshot.val();
        if (company) {
            currentCompany = company;
            companyState = company.state || 'Haryana';
            companyStateCode = company.stateCode || '06';
            displayCompany(company);
            document.getElementById('companyNameDisplay').innerText = company.name || 'Company';
            document.getElementById('companyBadge').innerHTML = `
                <i class="fas fa-building"></i>
                <span>${company.name || 'Company'}</span>
            `;
        }
    });

    // Parties Data
    db.ref('users/' + uid + '/parties').on('value', (snapshot) => {
        const parties = [];
        snapshot.forEach(child => {
            const party = child.val();
            party.id = child.key;
            parties.push(party);
        });
        allParties = parties;
        displayParties(parties);
        updatePartySelect();
        updateRecentParties();
        document.getElementById('totalParties').innerText = parties.length;
        
        // Calculate Advanced Balances for Dashboard
        setTimeout(() => {
            calculateDashboardBalances();
        }, 1000);
    });

    // Stock Items Data
    db.ref('users/' + uid + '/stockItems').on('value', (snapshot) => {
        const items = [];
        snapshot.forEach(child => {
            const item = child.val();
            item.id = child.key;
            items.push(item);
        });
        allItems = items;
        displayStockItems(items);
        updateStockAlerts(items);
        updateItemsContainer(items);
    });

    // Bills Data
    db.ref('users/' + uid + '/bills').orderByChild('timestamp').on('value', (snapshot) => {
        const bills = [];
        let totalSales = 0;
        
        snapshot.forEach(child => {
            const bill = child.val();
            bill.id = child.key;
            bills.push(bill);
            
            if (bill.type === 'sale') {
                totalSales += bill.grandTotal || 0;
            }
        });
        
        bills.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        allBills = bills;
        
        displayRecentBills(bills.slice(0, 5));
        calculateDashboardBalances();
    });

    // Payments Data - Load from both /payments and journalEntries
    // Fixed: Proper loading with deduplication and correct field mapping
    function loadPayments() {
        const paymentsRef = db.ref('users/' + uid + '/payments');
        const journalRef = db.ref('users/' + uid + '/journalEntries');
        
        // Use Promise.all to load both sources simultaneously
        Promise.all([
            paymentsRef.once('value'),
            journalRef.orderByChild('type').equalTo('payment').once('value')
        ]).then(([paymentsSnapshot, journalSnapshot]) => {
            const paymentsMap = new Map(); // Use Map for deduplication
            
            // Load payments from /payments path
            paymentsSnapshot.forEach(child => {
                const payment = child.val();
                payment.id = child.key;
                payment.source = 'payments';
                // Use date + partyId + amount as unique key for deduplication
                const key = `${payment.date}_${payment.partyId}_${payment.amount}`;
                if (!paymentsMap.has(key)) {
                    paymentsMap.set(key, payment);
                }
            });
            
            // Load payments from journalEntries - map debitAmount to amount
            journalSnapshot.forEach(child => {
                const journalPayment = child.val();
                journalPayment.id = child.key;
                journalPayment.source = 'journal';
                // Map debitAmount/creditAmount to amount for consistency
                journalPayment.amount = journalPayment.debitAmount || journalPayment.creditAmount || 0;
                journalPayment.mode = journalPayment.paymentMode || 'bank';
                journalPayment.reference = journalPayment.referenceNo || '';
                // Use date + partyId + amount as unique key for deduplication
                const key = `${journalPayment.date}_${journalPayment.partyId}_${journalPayment.amount}`;
                if (!paymentsMap.has(key)) {
                    paymentsMap.set(key, journalPayment);
                }
            });
            
            // Convert Map to array and filter valid payments
            const allPaymentsArray = Array.from(paymentsMap.values());
            allPayments = allPaymentsArray.filter(p => p.amount && p.amount > 0);
            
            console.log('Loaded payments:', allPayments.length, 'from sources');
            
            // Trigger party display update after payments loaded
            displayParties(allParties);
            calculateDashboardBalances();
        }).catch(err => {
            console.error('Error loading payments:', err);
        });
    }
    
    // Initial load and set up listeners
    loadPayments();
    
    // Listen for new payments in /payments
    db.ref('users/' + uid + '/payments').on('child_added', (snapshot) => {
        const payment = snapshot.val();
        payment.id = snapshot.key;
        payment.source = 'payments';
        if (payment.amount && payment.amount > 0) {
            // Check if already exists using date + partyId + amount
            const key = `${payment.date}_${payment.partyId}_${payment.amount}`;
            const exists = allPayments.some(p => `${p.date}_${p.partyId}_${p.amount}` === key);
            if (!exists) {
                allPayments.push(payment);
                displayParties(allParties);
                calculateDashboardBalances();
            }
        }
    });
    
    // Listen for new payments in journalEntries
    db.ref('users/' + uid + '/journalEntries').orderByChild('type').equalTo('payment').on('child_added', (snapshot) => {
        const journalPayment = snapshot.val();
        journalPayment.id = snapshot.key;
        journalPayment.source = 'journal';
        // Map debitAmount/creditAmount to amount
        journalPayment.amount = journalPayment.debitAmount || journalPayment.creditAmount || 0;
        journalPayment.mode = journalPayment.paymentMode || 'bank';
        journalPayment.reference = journalPayment.referenceNo || '';
        if (journalPayment.amount && journalPayment.amount > 0) {
            // Check if already exists using date + partyId + amount
            const key = `${journalPayment.date}_${journalPayment.partyId}_${journalPayment.amount}`;
            const exists = allPayments.some(p => `${p.date}_${p.partyId}_${p.amount}` === key);
            if (!exists) {
                allPayments.push(journalPayment);
                displayParties(allParties);
                calculateDashboardBalances();
            }
        }
    });
    
    // Receipts Data - Load from journalEntries with type 'receipt'
    // Fixed: Proper loading with deduplication
    function loadReceipts() {
        db.ref('users/' + uid + '/journalEntries').orderByChild('type').equalTo('receipt').once('value')
            .then(snapshot => {
                const receiptsMap = new Map();
                
                snapshot.forEach(child => {
                    const receipt = child.val();
                    receipt.id = child.key;
                    // Use date + partyId + amount as unique key for deduplication
                    const key = `${receipt.date}_${receipt.partyId}_${receipt.amount}`;
                    if (!receiptsMap.has(key)) {
                        receiptsMap.set(key, receipt);
                    }
                });
                
                const receiptsArray = Array.from(receiptsMap.values());
                allReceipts = receiptsArray.filter(r => r.amount && r.amount > 0);
                console.log('Loaded receipts:', allReceipts.length);
                calculateDashboardBalances();
            })
            .catch(err => console.error('Error loading receipts:', err));
    }
    
    // Initial load
    loadReceipts();
    
    // Listen for new receipts
    db.ref('users/' + uid + '/journalEntries').orderByChild('type').equalTo('receipt').on('child_added', (snapshot) => {
        const receipt = snapshot.val();
        receipt.id = snapshot.key;
        if (receipt.amount && receipt.amount > 0) {
            const key = `${receipt.date}_${receipt.partyId}_${receipt.amount}`;
            const exists = allReceipts.some(r => `${r.date}_${r.partyId}_${r.amount}` === key);
            if (!exists) {
                allReceipts.push(receipt);
                calculateDashboardBalances();
            }
        }
    });
    
    // Contra Entries
    db.ref('users/' + uid + '/contraEntries').on('value', (snapshot) => {
        const entries = [];
        snapshot.forEach(child => {
            const entry = child.val();
            entry.id = child.key;
            entries.push(entry);
        });
        allContraEntries = entries;
        calculateDashboardBalances();
    });
}

// Display Company
function displayCompany(company) {
    // Update company name in collapsible header
    const companyCardName = document.getElementById('companyCardName');
    if (companyCardName) {
        companyCardName.textContent = company.name || 'Company Profile';
    }
    
    const html = `
        <div class="info-box">
            <div class="info-icon"><i class="fas fa-id-card"></i></div>
            <div class="info-content">
                <div class="info-label">GSTIN/UIN</div>
                <div class="info-value">${company.gstin || '-'}</div>
            </div>
        </div>
        <div class="info-box">
            <div class="info-icon"><i class="fas fa-building"></i></div>
            <div class="info-content">
                <div class="info-label">Company Name</div>
                <div class="info-value">${company.name || '-'}</div>
            </div>
        </div>
        <div class="info-box">
            <div class="info-icon"><i class="fas fa-map-marker-alt"></i></div>
            <div class="info-content">
                <div class="info-label">Address</div>
                <div class="info-value">${company.address1 || ''} ${company.address2 || ''}</div>
            </div>
        </div>
        <div class="info-box">
            <div class="info-icon"><i class="fas fa-phone"></i></div>
            <div class="info-content">
                <div class="info-label">Contact</div>
                <div class="info-value">${company.contact || '-'}</div>
            </div>
        </div>
        <div class="info-box">
            <div class="info-icon"><i class="fab fa-whatsapp"></i></div>
            <div class="info-content">
                <div class="info-label">WhatsApp</div>
                <div class="info-value">${company.whatsapp || '-'}</div>
            </div>
        </div>
        <div class="info-box">
            <div class="info-icon"><i class="fas fa-envelope"></i></div>
            <div class="info-content">
                <div class="info-label">Email</div>
                <div class="info-value">${company.email || '-'}</div>
            </div>
        </div>
        <div class="info-box">
            <div class="info-icon"><i class="fas fa-university"></i></div>
            <div class="info-content">
                <div class="info-label">Bank Details</div>
                <div class="info-value" style="font-size: 13px;">${company.bankName || 'N/A'} <br>A/c: ${company.accountNo || 'N/A'}</div>
            </div>
        </div>
    `;
    document.getElementById('companyDetails').innerHTML = html;
}

// Calculate Real-time Dashboard Balances
function calculateDashboardBalances() {
    let totalReceivable = 0;
    let totalPayable = 0;
    let cashBalance = 0; 
    let bankBalance = 0; 
    
    allParties.forEach(party => {
        let receivable = 0;
        let payable = 0;
        let totalPayments = 0;
        let totalReceipts = 0;
        
        allBills.forEach(bill => {
            if (bill.partyId === party.id) {
                if (bill.type === 'sale') receivable += bill.grandTotal || 0;
                if (bill.type === 'purchase') payable += bill.grandTotal || 0;
            }
        });
        
        allPayments.forEach(payment => { if (payment.partyId === party.id) totalPayments += payment.amount || 0; });
        allReceipts.forEach(receipt => { if (receipt.partyId === party.id) totalReceipts += receipt.amount || 0; });
        
        receivable = Math.max(0, receivable - totalReceipts);
        payable = Math.max(0, payable - totalPayments);
        
        totalReceivable += receivable;
        totalPayable += payable;
    });
    
    // 1. Calculate Cash and Bank Balances
    allBills.filter(b => b.type === 'sale' && b.partyId === 'cash').forEach(b => cashBalance += b.grandTotal);
    allBills.filter(b => b.type === 'purchase' && b.partyId === 'cash').forEach(b => cashBalance -= b.grandTotal);
    
    allReceipts.forEach(r => {
        if (r.receiptMode === 'cash') cashBalance += r.amount;
        else bankBalance += r.amount;
    });
    
    allPayments.forEach(p => {
        if (p.paymentMode === 'cash' || p.mode === 'cash') cashBalance -= p.amount;
        else bankBalance -= p.amount;
    });
    
    allContraEntries.forEach(c => {
        if (c.type === 'deposit') { // Cash -> Bank
            cashBalance -= c.amount;
            bankBalance += c.amount;
        } else if (c.type === 'withdrawal') { // Bank -> Cash
            cashBalance += c.amount;
            bankBalance -= c.amount;
        }
    });
    
    const totalCashBank = cashBalance + bankBalance;
    
    if(document.getElementById('totalReceivable')) document.getElementById('totalReceivable').innerText = '₹' + totalReceivable.toLocaleString('en-IN', {minimumFractionDigits: 2});
    if(document.getElementById('totalPayable')) document.getElementById('totalPayable').innerText = '₹' + totalPayable.toLocaleString('en-IN', {minimumFractionDigits: 2});
    if(document.getElementById('totalCash')) document.getElementById('totalCash').innerText = '₹' + totalCashBank.toLocaleString('en-IN', {minimumFractionDigits: 2});
    
    // Banking Dashboard Updates
    if(document.getElementById('cashInHandDisplay')) document.getElementById('cashInHandDisplay').innerText = '₹' + cashBalance.toLocaleString('en-IN', {minimumFractionDigits: 2});
    if(document.getElementById('bankBalanceDisplay')) document.getElementById('bankBalanceDisplay').innerText = '₹' + bankBalance.toLocaleString('en-IN', {minimumFractionDigits: 2});
}

// Display Parties
function displayParties(parties) {
    let html = '';
    parties.forEach(party => {
        // Always calculate balance dynamically from bills, payments, and receipts
        let receivable = 0;
        let payable = 0;
        let totalPayments = 0;
        let totalReceipts = 0;
        
        // Calculate sales - customer owes us (receivable)
        allBills.forEach(bill => {
            if (bill.partyId === party.id && bill.type === 'sale') {
                receivable += bill.grandTotal || 0;
            }
        });
        
        // Calculate purchases - we owe supplier (payable)
        allBills.forEach(bill => {
            if (bill.partyId === party.id && bill.type === 'purchase') {
                payable += bill.grandTotal || 0;
            }
        });
        
        // Payments made to suppliers (reduces payable)
        allPayments.forEach(payment => {
            if (payment.partyId === party.id) {
                totalPayments += payment.amount || 0;
            }
        });
        
        // Receipts received from customers (reduces receivable)
        allReceipts.forEach(receipt => {
            if (receipt.partyId === party.id) {
                totalReceipts += receipt.amount || 0;
            }
        });
        
        // Calculate net balance: (Sales - Receipts) - (Purchases - Payments)
        // Or simpler: Sales + Purchases - Payments - Receipts
        // But for proper accounting:
        // - Customer owes us: receivable = Sales - Receipts
        // - We owe supplier: payable = Purchases - Payments
        // - Net balance = receivable - payable
        
        receivable = Math.max(0, receivable - totalReceipts);
        payable = Math.max(0, payable - totalPayments);
        const balance = receivable - payable;
        
        // Determine if receivable or payable
        const isReceivable = balance >= 0;
        const balanceClass = isReceivable ? 'badge-warning' : 'badge-success';
        const balanceText = isReceivable ? 'Receivable' : 'Payable';
        
        html += `
            <tr>
                <td>${party.name}</td>
                <td>${party.address || '-'}</td>
                <td>${party.phone || '-'}</td>
                <td>${party.gst || '-'}</td>
                <td>${party.state || '-'}</td>
                <td><span class="badge ${balanceClass}">₹${Math.abs(balance).toFixed(2)} ${balanceText}</span></td>
                <td>
                    <button class="action-btn view-btn-small" onclick="showPartyPaymentHistory('${party.id}', '${party.name}')" title="View Payment History">
                        <i class="fas fa-history"></i>
                    </button>
                    <button class="action-btn edit-btn-small" onclick="editParty('${party.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn-small" onclick="deleteParty('${party.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    document.getElementById('partiesTableBody').innerHTML = html || '<tr><td colspan="7" style="text-align:center">No parties found</td></tr>';
}

// Display Stock Items
function displayStockItems(items) {
    let html = '';
    items.forEach(item => {
        html += `
            <tr>
                <td>${item.name}</td>
                <td>${item.hsn || '-'}</td>
                <td>${item.unit || 'PCS'}</td>
                <td>${item.openingStock || 0}</td>
                <td>₹${item.costPrice || 0}</td>
                <td>₹${item.rate || 0}</td>
                <td>${item.gst || 0}%</td>
                <td>
                    <button class="action-btn edit-btn-small" onclick="editStockItem('${item.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn-small" onclick="deleteStockItem('${item.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    document.getElementById('stockTableBody').innerHTML = html || '<tr><td colspan="8" style="text-align:center">No items found</td></tr>';
}

// Update Items Container
function updateItemsContainer(items) {
    let html = '';
    items.forEach(item => {
        const rate = item.rate || 0;
        const gst = item.gst || 0;
        const hsn = item.hsn || '';
        
        html += `
            <div class="item-row" onclick="addToCart('${item.id}')">
                <div>
                    <strong>${item.name}</strong><br>
                    <small>HSN: ${hsn} | Stock: ${item.openingStock || 0} ${item.unit || 'PCS'} | Cost: ₹${item.costPrice || 0} | Sale: ₹${rate} | ${gst}% GST</small>
                </div>
                <div>
                    <strong>₹${rate}</strong>
                </div>
            </div>
        `;
    });
    document.getElementById('itemsContainer').innerHTML = html || '<div style="padding:20px;text-align:center">No items found</div>';
}

// Update Party Select
function updatePartySelect() {
    const select = document.getElementById('partySelect');
    if (select) {
        select.innerHTML = '<option value="">Select Party</option>';
        allParties.forEach(party => {
            select.innerHTML += `<option value="${party.id}" data-state="${party.state || ''}" data-state-code="${party.stateCode || ''}" data-address="${party.address || ''}" data-gst="${party.gst || ''}">${party.name}</option>`;
        });
    }
    
    // Also update party report dropdown for ledger
    const reportSelect = document.getElementById('partyReportSelect');
    if (reportSelect) {
        reportSelect.innerHTML = '<option value="">Select Party</option>';
        allParties.forEach(party => {
            reportSelect.innerHTML += `<option value="${party.id}">${party.name}</option>`;
        });
    }
}

// Display Recent Bills
function displayRecentBills(bills) {
    let html = '';
    bills.forEach(bill => {
        html += `
            <div class="list-item" onclick="viewBillDetails('${bill.id}')">
                <div class="item-info">
                    <h5>${bill.billNumber}</h5>
                    <p>${bill.partyName} • ₹${bill.grandTotal.toFixed(2)}</p>
                    <small>${getGSTTypeLabel(bill.gstType)}</small>
                </div>
                <span class="badge ${bill.type === 'sale' ? 'badge-success' : 'badge-info'}">${new Date(bill.date).toLocaleDateString()}</span>
            </div>
        `;
    });
    document.getElementById('recentBillsList').innerHTML = html || '<div style="padding:15px;text-align:center">No bills yet</div>';
}

// Update Recent Parties
function updateRecentParties() {
    let html = '';
    allParties.slice(0, 5).forEach(party => {
        html += `
            <div class="list-item" onclick="editParty('${party.id}')">
                <div class="item-info">
                    <h5>${party.name}</h5>
                    <p>${party.phone || ''}</p>
                </div>
                <span class="badge">${party.gst ? 'GST' : 'No GST'}</span>
            </div>
        `;
    });
    document.getElementById('recentPartiesList').innerHTML = html || '<div style="padding:15px;text-align:center">No parties yet</div>';
}

// Update Stock Alerts
function updateStockAlerts(items) {
    let html = '';
    items.filter(i => (i.openingStock || 0) < 10).forEach(item => {
        html += `
            <div class="list-item" onclick="editStockItem('${item.id}')">
                <div class="item-info">
                    <h5>${item.name}</h5>
                    <p>Stock: ${item.openingStock || 0} ${item.unit || 'PCS'}</p>
                </div>
                <span class="badge badge-warning">Low Stock</span>
            </div>
        `;
    });
    document.getElementById('stockAlertList').innerHTML = html || '<div style="padding:15px;text-align:center">All items in stock</div>';
}

// Company Modal
function showCompanyModal() {
    if (currentCompany) {
        if(document.getElementById('companyGSTIN')) document.getElementById('companyGSTIN').value = currentCompany.gstin || '';
        if(document.getElementById('companyName')) document.getElementById('companyName').value = currentCompany.name || '';
        if(document.getElementById('companyPAN')) document.getElementById('companyPAN').value = currentCompany.pan || '';
        if(document.getElementById('companyBusinessType')) document.getElementById('companyBusinessType').value = currentCompany.businessType || 'private';
        if(document.getElementById('companyAddress1')) document.getElementById('companyAddress1').value = currentCompany.address1 || '';
        if(document.getElementById('companyAddress2')) document.getElementById('companyAddress2').value = currentCompany.address2 || '';
        if(document.getElementById('companyCity')) document.getElementById('companyCity').value = currentCompany.city || '';
        if(document.getElementById('companyState')) document.getElementById('companyState').value = currentCompany.state || '';
        if(document.getElementById('companyStateCode')) document.getElementById('companyStateCode').value = currentCompany.stateCode || '';
        if(document.getElementById('companyPincode')) document.getElementById('companyPincode').value = currentCompany.pincode || '';
        if(document.getElementById('companyContact')) document.getElementById('companyContact').value = currentCompany.contact || '';
        if(document.getElementById('companyWhatsapp')) document.getElementById('companyWhatsapp').value = currentCompany.whatsapp || '';
        if(document.getElementById('companyEmail')) document.getElementById('companyEmail').value = currentCompany.email || '';
        if(document.getElementById('companyWebsite')) document.getElementById('companyWebsite').value = currentCompany.website || '';
        if(document.getElementById('companyBankName')) document.getElementById('companyBankName').value = currentCompany.bankName || '';
        if(document.getElementById('companyAccountNo')) document.getElementById('companyAccountNo').value = currentCompany.accountNo || '';
        if(document.getElementById('companyIFSC')) document.getElementById('companyIFSC').value = currentCompany.ifscCode || '';
        if(document.getElementById('companyBranch')) document.getElementById('companyBranch').value = currentCompany.branchName || '';
        if(document.getElementById('companyUPI')) document.getElementById('companyUPI').value = currentCompany.upi || '';
        if(document.getElementById('companyAccountType')) document.getElementById('companyAccountType').value = currentCompany.accountType || 'current';
        if(document.getElementById('companyTerms')) document.getElementById('companyTerms').value = currentCompany.terms || '';
        if(document.getElementById('companyInvoicePrefix')) document.getElementById('companyInvoicePrefix').value = currentCompany.invoicePrefix || 'INV-';
        if(document.getElementById('companyInvoiceNote')) document.getElementById('companyInvoiceNote').value = currentCompany.invoiceNote || '';
    }
    document.getElementById('companyModal').style.display = 'flex';
}

// Show Company Edit Mode (Inline)
function showCompanyEditMode() {
    const companyCard = document.getElementById('companyCard');
    const viewMode = document.getElementById('companyViewMode');
    const editForm = document.getElementById('companyEditForm');
    const companyContent = document.getElementById('companyContent');
    
    // Populate form fields with current company data
    if (currentCompany) {
        document.getElementById('editCompanyGSTIN').value = currentCompany.gstin || '';
        document.getElementById('editCompanyName').value = currentCompany.name || '';
        document.getElementById('editCompanyAddress1').value = currentCompany.address1 || '';
        document.getElementById('editCompanyAddress2').value = currentCompany.address2 || '';
        document.getElementById('editCompanyContact').value = currentCompany.contact || '';
        document.getElementById('editCompanyWhatsapp').value = currentCompany.whatsapp || '';
        document.getElementById('editCompanyEmail').value = currentCompany.email || '';
        document.getElementById('editCompanyState').value = currentCompany.state || '';
        document.getElementById('editCompanyStateCode').value = currentCompany.stateCode || '';
        document.getElementById('editCompanyPAN').value = currentCompany.pan || '';
        document.getElementById('editCompanyBankName').value = currentCompany.bankName || '';
        document.getElementById('editCompanyAccountNo').value = currentCompany.accountNo || '';
        document.getElementById('editCompanyIFSC').value = currentCompany.ifscCode || '';
        document.getElementById('editCompanyBranch').value = currentCompany.branchName || '';
        document.getElementById('editCompanyUPI').value = currentCompany.upi || '';
        document.getElementById('editCompanyTerms').value = currentCompany.terms || '';
    }
    
    // Show edit form - expand card, hide view mode, show edit form
    companyCard.classList.remove('collapsed');
    companyContent.style.display = 'none';
    editForm.style.display = 'block';
    
    // Update toggle icon
    const toggleIcon = companyCard.querySelector('.toggle-icon');
    if (toggleIcon) {
        toggleIcon.classList.remove('collapsed');
    }
}

// Cancel Company Edit
function cancelCompanyEdit() {
    const companyCard = document.getElementById('companyCard');
    const viewMode = document.getElementById('companyViewMode');
    const editForm = document.getElementById('companyEditForm');
    const companyContent = document.getElementById('companyContent');
    
    // Hide edit form, show view mode
    editForm.style.display = 'none';
    companyContent.style.display = 'block';
}

// Toggle Company Card (Expand/Collapse)
function toggleCompanyCard() {
    const companyCard = document.getElementById('companyCard');
    const toggleIcon = companyCard.querySelector('.toggle-icon');
    
    if (companyCard.classList.contains('collapsed')) {
        companyCard.classList.remove('collapsed');
        if (toggleIcon) {
            toggleIcon.classList.remove('collapsed');
        }
    } else {
        companyCard.classList.add('collapsed');
        if (toggleIcon) {
            toggleIcon.classList.add('collapsed');
        }
    }
}

// Save Company (Inline)
function saveCompanyInline() {
    const company = {
        gstin: document.getElementById('editCompanyGSTIN').value,
        name: document.getElementById('editCompanyName').value,
        address1: document.getElementById('editCompanyAddress1').value,
        address2: document.getElementById('editCompanyAddress2').value,
        contact: document.getElementById('editCompanyContact').value,
        whatsapp: document.getElementById('editCompanyWhatsapp').value,
        email: document.getElementById('editCompanyEmail').value,
        state: document.getElementById('editCompanyState').value,
        stateCode: document.getElementById('editCompanyStateCode').value,
        pan: document.getElementById('editCompanyPAN').value,
        bankName: document.getElementById('editCompanyBankName').value,
        accountNo: document.getElementById('editCompanyAccountNo').value,
        ifscCode: document.getElementById('editCompanyIFSC').value,
        branchName: document.getElementById('editCompanyBranch').value,
        upi: document.getElementById('editCompanyUPI').value,
        terms: document.getElementById('editCompanyTerms').value,
        updatedAt: Date.now()
    };
    
    db.ref('users/' + currentUser.uid + '/company').set(company)
        .then(() => {
            alert('Company saved successfully!');
            currentCompany = company;
            displayCompany(company);
            cancelCompanyEdit();
        })
        .catch(error => alert('Error: ' + error.message));
}

function closeCompanyModal() {
    document.getElementById('companyModal').style.display = 'none';
}

function saveCompany() {
    const btn = document.getElementById('companySaveBtn');
    const spinner = document.getElementById('companySpinner');
    const btnText = document.getElementById('companySaveText');
    
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Saving...';
    if (spinner) spinner.style.display = 'inline-block';

    const company = {
        gstin: document.getElementById('companyGSTIN')?.value || '',
        name: document.getElementById('companyName')?.value || '',
        pan: document.getElementById('companyPAN')?.value || '',
        businessType: document.getElementById('companyBusinessType')?.value || 'private',
        address1: document.getElementById('companyAddress1')?.value || '',
        address2: document.getElementById('companyAddress2')?.value || '',
        city: document.getElementById('companyCity')?.value || '',
        state: document.getElementById('companyState')?.value || '',
        stateCode: document.getElementById('companyStateCode')?.value || '',
        pincode: document.getElementById('companyPincode')?.value || '',
        contact: document.getElementById('companyContact')?.value || '',
        whatsapp: document.getElementById('companyWhatsapp')?.value || '',
        email: document.getElementById('companyEmail')?.value || '',
        website: document.getElementById('companyWebsite')?.value || '',
        bankName: document.getElementById('companyBankName')?.value || '',
        accountNo: document.getElementById('companyAccountNo')?.value || '',
        ifscCode: document.getElementById('companyIFSC')?.value || '',
        branchName: document.getElementById('companyBranch')?.value || '',
        upi: document.getElementById('companyUPI')?.value || '',
        accountType: document.getElementById('companyAccountType')?.value || 'current',
        terms: document.getElementById('companyTerms')?.value || '',
        invoicePrefix: document.getElementById('companyInvoicePrefix')?.value || 'INV-',
        invoiceNote: document.getElementById('companyInvoiceNote')?.value || '',
        updatedAt: Date.now()
    };
    
    if (!company.name || !company.state || !company.contact || !company.email) {
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = 'Save Changes';
        if (spinner) spinner.style.display = 'none';
        alert('Please fill all required fields (Name, State, Contact, Email)');
        return;
    }

    db.ref('users/' + currentUser.uid + '/company').set(company)
        .then(() => {
            currentCompany = company;
            displayCompany(company);
            alert('Company saved successfully!');
            if (btn) btn.disabled = false;
            if (btnText) btnText.textContent = 'Save Changes';
            if (spinner) spinner.style.display = 'none';
            closeCompanyModal();
        })
        .catch(error => {
            if (btn) btn.disabled = false;
            if (btnText) btnText.textContent = 'Save Changes';
            if (spinner) spinner.style.display = 'none';
            alert('Error: ' + error.message);
        });
}

// Party Modal
function showPartyModal() {
    document.getElementById('partyModal').style.display = 'flex';
    showPartyTab('list');
}

function closePartyModal() {
    document.getElementById('partyModal').style.display = 'none';
    cancelPartyEdit();
}

function showPartyTab(tab) {
    document.getElementById('partyListTab').style.display = tab === 'list' ? 'block' : 'none';
    document.getElementById('partyAddTab').style.display = tab === 'add' ? 'block' : 'none';
    
    document.querySelectorAll('#partyModal .tab').forEach(t => t.classList.remove('active'));
    if (tab === 'list') {
        document.querySelectorAll('#partyModal .tab')[0].classList.add('active');
    } else {
        document.querySelectorAll('#partyModal .tab')[1].classList.add('active');
    }
}

function searchParties() {
    const search = document.getElementById('partySearch').value.toLowerCase();
    const filtered = allParties.filter(p => p.name.toLowerCase().includes(search));
    displayParties(filtered);
}

function editParty(id) {
    const party = allParties.find(p => p.id === id);
    if (party) {
        document.getElementById('partyId').value = party.id;
        document.getElementById('partyName').value = party.name;
        document.getElementById('partyPhone').value = party.phone || '';
        document.getElementById('partyAddress').value = party.address || '';
        document.getElementById('partyGST').value = party.gst || '';
        document.getElementById('partyState').value = party.state || '';
        document.getElementById('partyStateCode').value = party.stateCode || '';
        document.getElementById('partyPan').value = party.pan || '';
        document.getElementById('partyOpeningBalance').value = party.openingBalance || 0;
        showPartyTab('add');
    }
}

function deleteParty(id) {
    if (confirm('Are you sure you want to delete this party?')) {
        db.ref('users/' + currentUser.uid + '/parties/' + id).remove()
            .catch(error => alert('Error: ' + error.message));
    }
}

function saveParty() {
    const partyId = document.getElementById('partyId').value;
    const party = {
        name: document.getElementById('partyName').value,
        phone: document.getElementById('partyPhone').value,
        address: document.getElementById('partyAddress').value,
        gst: document.getElementById('partyGST').value,
        state: document.getElementById('partyState').value,
        stateCode: document.getElementById('partyStateCode').value,
        pan: document.getElementById('partyPan').value,
        openingBalance: parseFloat(document.getElementById('partyOpeningBalance').value) || 0,
        updatedAt: Date.now()
    };
    
    if (!party.name) {
        alert('Please enter party name');
        return;
    }
    
    const ref = partyId ? 
        db.ref('users/' + currentUser.uid + '/parties/' + partyId) : 
        db.ref('users/' + currentUser.uid + '/parties').push();
    
    ref.set(party)
        .then(() => {
            alert('Party saved successfully!');
            cancelPartyEdit();
            showPartyTab('list');
        })
        .catch(error => alert('Error: ' + error.message));
}

function cancelPartyEdit() {
    document.getElementById('partyId').value = '';
    document.getElementById('partyName').value = '';
    document.getElementById('partyPhone').value = '';
    document.getElementById('partyAddress').value = '';
    document.getElementById('partyGST').value = '';
    document.getElementById('partyState').value = '';
    document.getElementById('partyStateCode').value = '';
    document.getElementById('partyPan').value = '';
    document.getElementById('partyOpeningBalance').value = '';
}

// Stock Modal
function showStockModal() {
    document.getElementById('stockModal').style.display = 'flex';
    showStockTab('list');
}

function closeStockModal() {
    document.getElementById('stockModal').style.display = 'none';
    cancelStockEdit();
}

function showStockTab(tab) {
    document.getElementById('stockListTab').style.display = tab === 'list' ? 'block' : 'none';
    document.getElementById('stockAddTab').style.display = tab === 'add' ? 'block' : 'none';
    
    document.querySelectorAll('#stockModal .tab').forEach(t => t.classList.remove('active'));
    if (tab === 'list') {
        document.querySelectorAll('#stockModal .tab')[0].classList.add('active');
    } else {
        document.querySelectorAll('#stockModal .tab')[1].classList.add('active');
    }
}

function searchStock() {
    const search = document.getElementById('stockSearch').value.toLowerCase();
    const filtered = allItems.filter(i => i.name.toLowerCase().includes(search));
    displayStockItems(filtered);
}

function editStockItem(id) {
    const item = allItems.find(i => i.id === id);
    if (item) {
        document.getElementById('stockId').value = item.id;
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemHSN').value = item.hsn || '';
        document.getElementById('itemCategory').value = item.category || '';
        document.getElementById('itemUnit').value = item.unit || 'PCS';
        document.getElementById('itemOpeningStock').value = item.openingStock || 0;
        document.getElementById('itemCostPrice').value = item.costPrice || 0;
        document.getElementById('itemMRP').value = item.mrp || 0;
        document.getElementById('itemRate').value = item.rate || 0;
        document.getElementById('itemGST').value = item.gst || 5;
        showStockTab('add');
    }
}

function deleteStockItem(id) {
    if (confirm('Are you sure you want to delete this item?')) {
        db.ref('users/' + currentUser.uid + '/stockItems/' + id).remove()
            .catch(error => alert('Error: ' + error.message));
    }
}

function saveStockItem() {
    const itemId = document.getElementById('stockId').value;
    const item = {
        name: document.getElementById('itemName').value,
        hsn: document.getElementById('itemHSN').value,
        category: document.getElementById('itemCategory').value,
        unit: document.getElementById('itemUnit').value,
        openingStock: parseFloat(document.getElementById('itemOpeningStock').value) || 0,
        costPrice: parseFloat(document.getElementById('itemCostPrice').value) || 0,
        mrp: parseFloat(document.getElementById('itemMRP').value) || 0,
        rate: parseFloat(document.getElementById('itemRate').value) || 0,
        gst: parseFloat(document.getElementById('itemGST').value) || 0,
        updatedAt: Date.now()
    };
    
    if (!item.name) {
        alert('Please enter item name');
        return;
    }
    
    const ref = itemId ? 
        db.ref('users/' + currentUser.uid + '/stockItems/' + itemId) : 
        db.ref('users/' + currentUser.uid + '/stockItems').push();
    
    ref.set(item)
        .then(() => {
            alert('Item saved successfully!');
            cancelStockEdit();
            showStockTab('list');
        })
        .catch(error => alert('Error: ' + error.message));
}

function cancelStockEdit() {
    document.getElementById('stockId').value = '';
    document.getElementById('itemName').value = '';
    document.getElementById('itemHSN').value = '';
    document.getElementById('itemCategory').value = '';
    document.getElementById('itemOpeningStock').value = '';
    document.getElementById('itemCostPrice').value = '';
    document.getElementById('itemMRP').value = '';
    document.getElementById('itemRate').value = '';
    document.getElementById('itemGST').value = '5';
}

// GST Type Functions
function setGSTType(type) {
    currentGSTType = type;
    
    // Update dropdown
    const gstDropdown = document.getElementById('billGSTType');
    if (gstDropdown) {
        gstDropdown.value = type;
    }
    
    // Update old selector if exists
    const intrastateEl = document.getElementById('gstIntrastate');
    const interstateEl = document.getElementById('gstInterstate');
    if (intrastateEl) intrastateEl.classList.toggle('active', type === 'intrastate');
    if (interstateEl) interstateEl.classList.toggle('active', type === 'interstate');
    
    updateCart();
}

function updateGSTType() {
    const partySelect = document.getElementById('partySelect');
    const selectedOption = partySelect.options[partySelect.selectedIndex];
    
    if (selectedOption && selectedOption.value) {
        const partyState = selectedOption.dataset.state;
        
        if (partyState && partyState === companyState) {
            setGSTType('intrastate');
        } else {
            setGSTType('interstate');
        }
    } else {
        setGSTType('notax');
    }
}

// Quick Add Party Functions
function showQuickAddParty() {
    document.getElementById('quickPartyForm').style.display = 'block';
    document.getElementById('quickPartyName').focus();
}

function hideQuickParty() {
    document.getElementById('quickPartyForm').style.display = 'none';
    document.getElementById('quickPartyName').value = '';
    document.getElementById('quickPartyPhone').value = '';
    document.getElementById('quickPartyGST').value = '';
}

function saveQuickParty() {
    const name = document.getElementById('quickPartyName').value.trim();
    if (!name) {
        alert('Please enter party name');
        return;
    }
    
    const party = {
        name: name,
        phone: document.getElementById('quickPartyPhone').value,
        gst: document.getElementById('quickPartyGST').value,
        state: '',
        stateCode: '',
        createdAt: Date.now()
    };
    
    const newRef = db.ref('users/' + currentUser.uid + '/parties').push();
    newRef.set(party).then(() => {
        hideQuickParty();
        updatePartySelect();
        // Select the newly created party
        setTimeout(() => {
            document.getElementById('partySelect').value = newRef.key;
        }, 500);
    }).catch(err => alert('Error saving party: ' + err.message));
}

// Bill Modal
function showBillModal(type, billId = null) {
    currentBillType = type;
    editingBillId = billId;
    document.getElementById('editingBillId').value = billId || '';
    
    if (billId) {
        const bill = allBills.find(b => b.id === billId);
        if (bill) {
            document.getElementById('billModalTitle').innerHTML = `<i class="fas fa-edit"></i> Edit ${bill.type === 'sale' ? 'Sale Invoice' : 'Purchase Entry'}`;
            document.getElementById('billNumber').value = bill.billNumber;
            document.getElementById('billDate').value = bill.date;
            
            document.getElementById('billPoNo').value = bill.poNo || '';
            document.getElementById('billEway').value = bill.ewayBill || '';
            document.getElementById('billVehicle').value = bill.vehicleNo || '';
            document.getElementById('billTransport').value = bill.transport || '';
            document.getElementById('billDestination').value = bill.destination || '';
            
            const partySelect = document.getElementById('partySelect');
            setTimeout(() => {
                partySelect.value = bill.partyId;
                setGSTType(bill.gstType || 'intrastate');
            }, 100);
            
            cartItems = JSON.parse(JSON.stringify(bill.items));
            updateCart();
        }
    } else {
        document.getElementById('billModalTitle').innerHTML = `<i class="fas fa-file-invoice"></i> ${type === 'sale' ? 'Sale Invoice' : 'Purchase Entry'}`;
        
        const date = new Date();
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        
        const prefix = type === 'sale' ? 'SALE' : 'PUR';
        document.getElementById('billNumber').value = prefix + '/' + year + '/' + Math.floor(Math.random() * 1000);
        document.getElementById('billDate').value = `${year}-${month}-${day}`;
        
        document.getElementById('billPoNo').value = '';
        document.getElementById('billEway').value = '';
        document.getElementById('billVehicle').value = '';
        document.getElementById('billTransport').value = '';
        document.getElementById('billDestination').value = '';
        
        cartItems = [];
        updateCart();
        setGSTType('intrastate');
    }
    
    updateItemsContainer(allItems);
    document.getElementById('billModal').style.display = 'flex';
}

function closeBillModal() {
    document.getElementById('billModal').style.display = 'none';
    editingBillId = null;
    document.getElementById('editingBillId').value = '';
}

function searchBillItems() {
    const search = document.getElementById('itemSearch').value.toLowerCase();
    const filtered = allItems.filter(i => i.name.toLowerCase().includes(search));
    updateItemsContainer(filtered);
}

function addToCart(itemId) {
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;
    
    cartItems.push({
        id: itemId,
        name: item.name,
        hsn: item.hsn || '',
        quantity: 1,
        unit: item.unit || 'PCS',
        rate: item.rate || 0,
        discount: 0,
        gst: item.gst || 5
    });
    
    updateCart();
}

// Update cart calculations - Fixed CGST/SGST with NIL RATED support
function updateCart() {
    const tbody = document.getElementById('cartItems');
    let subtotal = 0;
    let totalGST = 0;
    let totalNilRated = 0;
    
    let html = '';
    cartItems.forEach((item, index) => {
        const amount = item.quantity * item.rate;
        const discountAmt = amount * (item.discount || 0) / 100;
        const netAmount = amount - discountAmt;
        const gstAmount = netAmount * (item.gst || 0) / 100;
        
        subtotal += netAmount;
        totalGST += gstAmount;
        
        html += `
            <tr>
                <td style="width: 40px;">${index + 1}</td>
                <td style="width: 200px;">${item.name}</td>
                <td style="width: 60px;">${item.hsn}</td>
                <td style="width: 60px;">
                    <select onchange="updateGST(${index}, this.value)" style="width: 60px;">
                        ${gstRates.map(rate => 
                            `<option value="${rate}" ${item.gst === rate ? 'selected' : ''}>${rate}%</option>`
                        ).join('')}
                    </select>
                </td>
                <td style="width: 80px;"><input type="number" value="${item.quantity}" min="1" onchange="updateQty(${index}, this.value)" style="width: 70px;"></td>
                <td style="width: 60px;">${item.unit}</td>
                <td style="width: 80px;"><input type="number" value="${item.rate}" min="0" step="0.01" onchange="updateRate(${index}, this.value)" style="width: 70px;"></td>
                <td style="width: 60px;"><input type="number" value="${item.discount || 0}" min="0" step="0.01" onchange="updateDiscount(${index}, this.value)" style="width: 60px;"></td>
                <td style="width: 100px;">${netAmount.toFixed(2)}</td>
                <td style="width: 40px;"><button class="remove-btn" onclick="removeItem(${index})"><i class="fas fa-trash"></i></button></td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    let cgst = 0, sgst = 0, igst = 0;
    let taxLabel = '';
    
    // Handle different GST types
    if (currentGSTType === 'notax' || currentGSTType === 'nilrated') {
        // No tax applied
        cgst = 0;
        sgst = 0;
        igst = 0;
        totalGST = 0;
        taxLabel = currentGSTType === 'nilrated' ? 'NIL RATED' : 'Without Tax';
    } else if (currentGSTType === 'intrastate') {
        cgst = totalGST / 2;
        sgst = totalGST / 2;
        taxLabel = 'CGST + SGST';
    } else {
        igst = totalGST;
        taxLabel = 'IGST';
    }
    
    const grandTotal = subtotal + totalGST;
    
    document.getElementById('subtotal').innerText = subtotal.toFixed(2);
    
    let taxHtml = '';
    if (currentGSTType === 'notax' || currentGSTType === 'nilrated') {
        taxHtml = `
            <div class="total-row">
                <span>${taxLabel}</span>
                <span>₹ 0.00</span>
            </div>
        `;
    } else if (currentGSTType === 'intrastate') {
        const cgstRate = subtotal > 0 ? ((cgst * 100 / subtotal)).toFixed(1) : '0';
        const sgstRate = subtotal > 0 ? ((sgst * 100 / subtotal)).toFixed(1) : '0';
        taxHtml = `
            <div class="total-row">
                <span>CGST @ ${cgstRate}%</span>
                <span>₹ ${cgst.toFixed(2)}</span>
            </div>
            <div class="total-row">
                <span>SGST @ ${sgstRate}%</span>
                <span>₹ ${sgst.toFixed(2)}</span>
            </div>
        `;
    } else {
        const igstRate = subtotal > 0 ? ((igst * 100 / subtotal)).toFixed(1) : '0';
        taxHtml = `
            <div class="total-row">
                <span>IGST @ ${igstRate}%</span>
                <span>₹ ${igst.toFixed(2)}</span>
            </div>
        `;
    }
    
    document.getElementById('taxDetails').innerHTML = taxHtml;
    document.getElementById('grandTotal').innerText = grandTotal.toFixed(2);
    
    // Update amount in words
    document.getElementById('amountInWords').innerText = numberToWords(grandTotal) + ' Only';
}

function updateQty(index, qty) {
    cartItems[index].quantity = parseInt(qty);
    updateCart();
}

function updateRate(index, rate) {
    cartItems[index].rate = parseFloat(rate);
    updateCart();
}

function updateDiscount(index, discount) {
    cartItems[index].discount = parseFloat(discount);
    updateCart();
}

function updateGST(index, gst) {
    cartItems[index].gst = parseInt(gst);
    updateCart();
}

function removeItem(index) {
    cartItems.splice(index, 1);
    updateCart();
}

function updateSaleType() {
    const saleType = document.getElementById('salePaymentMode').value;
    const partySelect = document.getElementById('partySelect');
    
    if (saleType === 'cash') {
        // For cash sale, no party needed
        partySelect.value = '';
        partySelect.disabled = true;
    } else {
        partySelect.disabled = false;
    }
}

function saveBill() {
    const partySelect = document.getElementById('partySelect');
    const partyId = partySelect.value;
    const partyName = partySelect.options[partySelect.selectedIndex]?.text || 'Cash Customer';
    const billNumber = document.getElementById('billNumber').value;
    
    // Allow billing without party selection (Cash Customer)
    let finalPartyId = partyId;
    let finalPartyName = partyName;
    
    if (!billNumber) {
        alert('Please enter invoice number');
        return;
    }
    
    if (cartItems.length === 0) {
        alert('Please add items to the bill');
        return;
    }
    
    // Calculate subtotal and taxes properly - Fixed for NIL RATED
    let subtotal = 0;
    let totalCGST = 0, totalSGST = 0, totalIGST = 0;
    
    cartItems.forEach(item => {
        const amount = item.quantity * item.rate;
        const discountAmt = amount * (item.discount || 0) / 100;
        const netAmount = amount - discountAmt;
        const gstAmount = netAmount * (item.gst || 0) / 100;
        
        subtotal += netAmount;
        
        // Only calculate GST if notax or nilrated is NOT selected
        if (currentGSTType !== 'notax' && currentGSTType !== 'nilrated') {
            if (currentGSTType === 'intrastate') {
                totalCGST += gstAmount / 2;
                totalSGST += gstAmount / 2;
            } else {
                totalIGST += gstAmount;
            }
        }
    });
    
    const grandTotal = subtotal + totalCGST + totalSGST + totalIGST;
    
    const poNo = document.getElementById('billPoNo').value;
    const ewayBill = document.getElementById('billEway').value;
    const vehicleNo = document.getElementById('billVehicle').value;
    const transport = document.getElementById('billTransport').value;
    const destination = document.getElementById('billDestination').value;
    
    const bill = {
        type: currentBillType,
        gstType: currentGSTType,
        billNumber: billNumber,
        date: document.getElementById('billDate').value,
        partyId: finalPartyId || 'cash',
        partyName: finalPartyName,
        items: cartItems,
        subtotal: subtotal,
        cgst: totalCGST,
        sgst: totalSGST,
        igst: totalIGST,
        poNo: poNo,
        ewayBill: ewayBill,
        vehicleNo: vehicleNo,
        transport: transport,
        destination: destination,
        grandTotal: grandTotal,
        timestamp: Date.now()
    };
    
    if (editingBillId) {
        db.ref('users/' + currentUser.uid + '/bills/' + editingBillId).set(bill)
            .then(() => {
                alert('Bill updated successfully!');
                closeBillModal();
            })
            .catch(error => alert('Error: ' + error.message));
    } else {
        db.ref('users/' + currentUser.uid + '/bills').push().set(bill)
            .then(() => {
                // Update stock for sale
                if (currentBillType === 'sale') {
                    cartItems.forEach(item => {
                        const stockItem = allItems.find(s => s.id === item.id);
                        if (stockItem) {
                            const newStock = (stockItem.openingStock || 0) - item.quantity;
                            db.ref('users/' + currentUser.uid + '/stockItems/' + item.id).update({
                                openingStock: newStock
                            });
                        }
                    });
                    
                    // Create journal entry for sale
                    const salePaymentMode = document.getElementById('salePaymentMode')?.value || 'credit';
                    let debitAccount, creditAccount;
                    
                    if (salePaymentMode === 'cash') {
                        // Cash Sale: Dr. Cash A/c, Cr. Sales A/c
                        debitAccount = 'Cash A/c';
                        creditAccount = 'Sales A/c';
                    } else {
                        // Credit Sale: Dr. Customer A/c, Cr. Sales A/c
                        debitAccount = finalPartyName + ' A/c';
                        creditAccount = 'Sales A/c';
                    }
                    
                    const journalEntry = {
                        type: 'sale',
                        date: bill.date,
                        entryNo: 'JE/' + billNumber,
                        voucherNo: billNumber,
                        debitAccount: debitAccount,
                        creditAccount: creditAccount,
                        debitAmount: grandTotal,
                        creditAmount: grandTotal,
                        partyId: finalPartyId || 'cash',
                        partyName: finalPartyName,
                        items: cartItems,
                        explanation: `Sale of ${cartItems.length} item(s) to ${finalPartyName}`,
                        timestamp: Date.now()
                    };
                    
                    db.ref('users/' + currentUser.uid + '/journalEntries').push().set(journalEntry);
                    
                    // Update party balance for credit sales (customer owes us)
                    if (salePaymentMode === 'credit' && finalPartyId) {
                        recordPartyTransaction(finalPartyId, finalPartyName, grandTotal, 'sale', bill.date, 'Credit', billNumber);
                        updatePartyBalance(finalPartyId, grandTotal, 'sale');
                    }
                } else if (currentBillType === 'purchase') {
                    cartItems.forEach(item => {
                        const stockItem = allItems.find(s => s.id === item.id);
                        if (stockItem) {
                            const newStock = (stockItem.openingStock || 0) + item.quantity;
                            db.ref('users/' + currentUser.uid + '/stockItems/' + item.id).update({
                                openingStock: newStock
                            });
                        }
                    });
                    
                    // Create journal entry for purchase
                    const purchasePaymentMode = document.getElementById('purchasePaymentMode')?.value || 'credit';
                    let debitAccount, creditAccount;
                    
                    if (purchasePaymentMode === 'cash') {
                        // Cash Purchase: Dr. Purchases A/c, Cr. Cash A/c
                        debitAccount = 'Purchases A/c';
                        creditAccount = 'Cash A/c';
                    } else {
                        // Credit Purchase: Dr. Purchases A/c, Cr. Supplier A/c
                        debitAccount = 'Purchases A/c';
                        creditAccount = finalPartyName + ' A/c';
                    }
                    
                    const purchaseJournalEntry = {
                        type: 'purchase',
                        date: bill.date,
                        entryNo: 'JE/' + billNumber,
                        voucherNo: billNumber,
                        debitAccount: debitAccount,
                        creditAccount: creditAccount,
                        debitAmount: grandTotal,
                        creditAmount: grandTotal,
                        partyId: finalPartyId || 'cash',
                        partyName: finalPartyName,
                        items: cartItems,
                        explanation: `Purchase of ${cartItems.length} item(s) from ${finalPartyName}`,
                        timestamp: Date.now()
                    };
                    
                    db.ref('users/' + currentUser.uid + '/journalEntries').push().set(purchaseJournalEntry);
                    
                    // Update party balance for credit purchases (we owe supplier)
                    if (purchasePaymentMode === 'credit' && finalPartyId) {
                        recordPartyTransaction(finalPartyId, finalPartyName, grandTotal, 'purchase', bill.date, 'Credit', billNumber);
                        updatePartyBalance(finalPartyId, grandTotal, 'purchase');
                    }
                }
                
                alert('Bill saved successfully!');
                closeBillModal();
            })
            .catch(error => alert('Error: ' + error.message));
    }
}

// Delete Bill
function deleteBill(billId) {
    if (confirm('Are you sure you want to delete this bill?')) {
        db.ref('users/' + currentUser.uid + '/bills/' + billId).remove()
            .then(() => {
                alert('Bill deleted successfully!');
            })
            .catch(error => alert('Error: ' + error.message));
    }
}

// Payment Functions
// Payment Functions - Simple Payment Out Modal
function showPaymentModal(partyId, partyName, outstanding) {
    if (!partyId) {
        alert('Please select a party from the Parties section first, or use All Transactions to record payments.');
        return;
    }
    
    document.getElementById('paymentPartyId').value = partyId;
    document.getElementById('paymentPartyName').innerText = partyName || 'Unknown Party';
    document.getElementById('paymentOutstandingAmount').innerText = '₹' + (outstanding || 0).toFixed(2);
    document.getElementById('paymentOutstanding').value = outstanding || 0;
    
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    document.getElementById('paymentDate').value = `${year}-${month}-${day}`;
    document.getElementById('paymentAmount').value = (outstanding || 0).toFixed(2);
    document.getElementById('paymentReference').value = '';
    
    document.getElementById('paymentModal').style.display = 'flex';
}

function closePaymentModal() {
    document.getElementById('paymentModal').style.display = 'none';
}

function savePayment() {
    const partyId = document.getElementById('paymentPartyId').value;
    if (!partyId) {
        alert('No party selected');
        return;
    }
    
    const party = allParties.find(p => p.id === partyId);
    
    const payment = {
        partyId: partyId,
        partyName: party ? party.name : 'Unknown',
        date: document.getElementById('paymentDate').value,
        amount: (() => {
            const val = parseFloat(document.getElementById('paymentAmount').value);
            return isNaN(val) || val <= 0 ? 0 : val;
        })(),
        mode: document.getElementById('paymentMode').value,
        reference: document.getElementById('paymentReference').value,
        timestamp: Date.now()
    };
    
    if (!payment.amount || payment.amount <= 0 || isNaN(payment.amount)) {
        alert('Please enter a valid payment amount (greater than 0)');
        return;
    }
    
    db.ref('users/' + currentUser.uid + '/payments').push().set(payment)
        .then(() => {
            const paymentKey = `${payment.date}_${payment.partyId}_${payment.amount}`;
            const alreadyExists = allPayments.some(p => `${p.date}_${p.partyId}_${p.amount}` === paymentKey);
            
            if (!alreadyExists) {
                allPayments.push({
                    id: Date.now().toString(),
                    partyId: partyId,
                    partyName: party ? party.name : 'Unknown',
                    amount: payment.amount,
                    date: payment.date,
                    mode: payment.mode,
                    reference: payment.reference,
                    timestamp: Date.now()
                });
            }
            
            updatePartyBalanceSimple(partyId, payment.amount, 'payment');
            displayParties(allParties);
            
            alert('Payment recorded successfully!');
            closePaymentModal();
        })
        .catch(error => alert('Error: ' + error.message));
}

function showPaymentHistory(partyId) {
    const partyPayments = allPayments.filter(p => p.partyId === partyId && p.amount > 0);
    
    let html = '';
    if (partyPayments.length === 0) {
        html = '<div style="padding:20px;text-align:center">No payment history found</div>';
    } else {
        partyPayments.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(payment => {
            html += `
                <div class="item-row">
                    <div>
                        <strong>${payment.date}</strong><br>
                        <small>Mode: ${payment.mode || 'N/A'} | Ref: ${payment.reference || 'N/A'}</small>
                    </div>
                    <div>
                        <strong style="color: #059669;">₹${payment.amount.toFixed(2)}</strong>
                    </div>
                </div>
            `;
        });
    }
    
    document.getElementById('paymentHistoryList').innerHTML = html;
    document.getElementById('paymentHistoryModal').style.display = 'flex';
}

function closePaymentHistoryModal() {
    document.getElementById('paymentHistoryModal').style.display = 'none';
}

// ==================== PAYMENT ENTRY MODULE (DOUBLE ENTRY) ====================
function showPaymentEntryModal() {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    document.getElementById('paymentEntryDate').value = `${year}-${month}-${day}`;
    
    const partySelect = document.getElementById('paymentToParty');
    partySelect.innerHTML = '<option value="">Select Party</option>';
    allParties.forEach(party => {
        partySelect.innerHTML += `<option value="${party.id}">${party.name}</option>`;
    });
    
    document.getElementById('paymentEntryModal').style.display = 'flex';
}

function closePaymentEntryModal() {
    document.getElementById('paymentEntryModal').style.display = 'none';
}

document.getElementById('paymentToParty')?.addEventListener('change', function() {
    const partyId = this.value;
    const party = allParties.find(p => p.id === partyId);
    if (party) {
        document.getElementById('paymentDebitAccount').innerText = party.name + ' A/c';
    }
    updatePaymentPartyInfo();
});

function updatePaymentPartyInfo() {
    const partyId = document.getElementById('paymentToParty').value;
    const partyInfoDiv = document.getElementById('paymentPartyInfo');
    const balanceInfoDiv = document.getElementById('paymentBalanceInfo');
    const party = allParties.find(p => p.id === partyId);
    
    if (party && partyId) {
        let totalPurchase = 0;
        let totalPaid = 0;
        
        allBills.forEach(bill => {
            if (bill.partyId === partyId && bill.type === 'purchase') {
                totalPurchase += bill.grandTotal || 0;
            }
        });
        
        allPayments.forEach(payment => {
            if (payment.partyId === partyId) {
                totalPaid += payment.amount || 0;
            }
        });
        
        const outstanding = totalPurchase - totalPaid;
        
        document.getElementById('paymentOutstandingAmt').innerText = '₹' + Math.abs(outstanding).toFixed(2);
        document.getElementById('paymentDebitAccount').innerText = party.name + ' A/c';
        
        if (totalPurchase > 0 && balanceInfoDiv) {
            balanceInfoDiv.style.display = 'block';
            document.getElementById('paymentBillAmt').innerText = '₹' + totalPurchase.toFixed(2);
            document.getElementById('paymentPaidAmt').innerText = '₹' + totalPaid.toFixed(2);
            
            const balancePayable = Math.max(0, totalPurchase - totalPaid);
            document.getElementById('paymentBalancePayable').innerText = '₹' + balancePayable.toFixed(2);
        } else if (balanceInfoDiv) {
            balanceInfoDiv.style.display = 'none';
        }
        
        if (outstanding < 0) {
            document.getElementById('paymentOutstandingAmt').style.color = '#4caf50';
            if (partyInfoDiv) partyInfoDiv.style.background = '#e8f5e9';
        } else {
            document.getElementById('paymentOutstandingAmt').style.color = '#f44336';
            if (partyInfoDiv) partyInfoDiv.style.background = '#fff3e0';
        }
        
        if (partyInfoDiv) partyInfoDiv.style.display = 'block';
        
        if (Math.abs(outstanding) > 0) {
            document.getElementById('paymentEntryAmount').value = Math.abs(outstanding).toFixed(2);
            document.getElementById('paymentDebitPreview').innerText = Math.abs(outstanding).toFixed(2);
            document.getElementById('paymentCreditPreview').innerText = Math.abs(outstanding).toFixed(2);
        }
    } else {
        if (partyInfoDiv) partyInfoDiv.style.display = 'none';
        if (balanceInfoDiv) balanceInfoDiv.style.display = 'none';
    }
}

document.getElementById('paymentEntryAmount')?.addEventListener('input', function() {
    const amount = parseFloat(this.value) || 0;
    document.getElementById('paymentDebitPreview').innerText = amount.toFixed(2);
    document.getElementById('paymentCreditPreview').innerText = amount.toFixed(2);
});

document.getElementById('paymentEntryMode')?.addEventListener('change', function() {
    const amount = parseFloat(document.getElementById('paymentEntryAmount').value) || 0;
    document.getElementById('paymentDebitPreview').innerText = amount.toFixed(2);
    document.getElementById('paymentCreditPreview').innerText = amount.toFixed(2);
});

// ==================== PARTY BALANCE & HISTORY TRACKING ====================

// Update party balance after any transaction
// Uses proper accounting: Balance = Receivables - Payables
function updatePartyBalance(partyId, amount, transactionType) {
    // Get party type (customer or supplier)
    return new Promise((resolve) => {
        db.ref('users/' + currentUser.uid + '/parties/' + partyId).once('value', (snapshot) => {
            const party = snapshot.val();
            const partyType = party?.partyType || 'both'; // customer, supplier, or both
            
            // Get current balance fields
            db.ref('users/' + currentUser.uid + '/parties/' + partyId).once('value', (balSnapshot) => {
                const balData = balSnapshot.val() || {};
                let receivable = balData.totalReceivable || 0;
                let payable = balData.totalPayable || 0;
                
                // Apply transaction based on type
                if (transactionType === 'sale') {
                    // Credit sale - increases receivable
                    receivable += amount;
                } else if (transactionType === 'purchase') {
                    // Credit purchase - increases payable
                    payable += amount;
                } else if (transactionType === 'receipt') {
                    // Receipt from customer - reduces receivable
                    receivable = Math.max(0, receivable - amount);
                } else if (transactionType === 'payment') {
                    // Payment to supplier - reduces payable
                    payable = Math.max(0, payable - amount);
                }
                
                // Calculate net balance (receivable - payable)
                const netBalance = receivable - payable;
                
                // Update Firebase with all balance fields
                const updates = {
                    totalReceivable: receivable,
                    totalPayable: payable,
                    balance: netBalance
                };
                
                db.ref('users/' + currentUser.uid + '/parties/' + partyId).update(updates)
                    .then(() => resolve(netBalance))
                    .catch(err => { 
                        console.error('Balance update error:', err); 
                        resolve(0); 
                    });
            });
        });
    });
}

// Simple balance update - calculates from bills + payments + receipts
function updatePartyBalanceSimple(partyId, amount, transactionType) {
    // Calculate total sales, purchases, payments, receipts for this party
    let totalSales = 0;
    let totalPurchase = 0;
    let totalPayments = 0;
    let totalReceipts = 0;
    
    allBills.forEach(bill => {
        if (bill.partyId === partyId) {
            if (bill.type === 'sale') {
                totalSales += bill.grandTotal || 0;
            } else {
                totalPurchase += bill.grandTotal || 0;
            }
        }
    });
    
    allPayments.forEach(payment => {
        if (payment.partyId === partyId) {
            totalPayments += payment.amount || 0;
        }
    });
    
    allReceipts.forEach(receipt => {
        if (receipt.partyId === partyId) {
            totalReceipts += receipt.amount || 0;
        }
    });
    
    // Calculate balance: Sales - Purchases - Payments - Receipts
    // Positive = Receivable (customer owes us)
    // Negative = Payable (we owe supplier)
    const balance = (totalSales - totalPurchase) - (totalPayments + totalReceipts);
    
    // Update in Firebase
    db.ref('users/' + currentUser.uid + '/parties/' + partyId).update({
        balance: balance,
        totalSales: totalSales,
        totalPurchase: totalPurchase,
        totalPayments: totalPayments,
        totalReceipts: totalReceipts
    }).catch(err => console.error('Error updating balance:', err));
}

// Record transaction in party history with timestamp
function recordPartyTransaction(partyId, partyName, amount, transactionType, date, mode, refNo) {
    const timestamp = Date.now();
    const transaction = {
        partyId: partyId,
        partyName: partyName,
        type: transactionType, // 'payment' or 'receipt'
        amount: amount,
        date: date,
        time: new Date().toLocaleTimeString(),
        timestamp: timestamp,
        mode: mode,
        reference: refNo,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    };
    
    // Save to party payment history
    return db.ref('users/' + currentUser.uid + '/partyPaymentHistory').push().set(transaction);
}

// Get party payment history
function getPartyPaymentHistory(partyId, callback) {
    db.ref('users/' + currentUser.uid + '/partyPaymentHistory')
        .orderByChild('partyId')
        .equalTo(partyId)
        .once('value', (snapshot) => {
            const history = [];
            snapshot.forEach(child => {
                history.push(child.val());
            });
            // Sort by timestamp descending (newest first)
            history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            callback(history);
        });
}

// Display party payment history in modal
function showPartyPaymentHistory(partyId, partyName) {
    getPartyPaymentHistory(partyId, (history) => {
        let html = '';
        if (history.length === 0) {
            html = '<div style="padding:20px;text-align:center">No payment history found</div>';
        } else {
            history.forEach(trans => {
                const transType = trans.type === 'payment' ? 'Payment Out' : 'Receipt In';
                const color = trans.type === 'payment' ? '#dc2626' : '#059669';
                const timestamp = trans.timestamp || trans.id;
                html += `
                    <div class="item-row" style="border-bottom:1px solid #e5e7eb;padding:15px;display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <strong style="color:${color}">${transType}</strong><br>
                            <small style="color:#6b7280">Date: ${trans.date} | Time: ${trans.time || 'N/A'}</small><br>
                            <small style="color:#6b7280">Mode: ${trans.mode || 'N/A'} | Ref: ${trans.reference || 'N/A'}</small>
                        </div>
                        <div style="text-align:right;">
                            <strong style="color:${color};font-size:18px;">₹${trans.amount.toFixed(2)}</strong>
                            <br>
                            <button onclick="deletePaymentEntry('${timestamp}', '${partyId}', ${trans.amount}, '${trans.type}', '${trans.date}')" style="background:#f44336;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;margin-top:5px;font-size:12px;">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
            });
        }
        
        // Create history modal if not exists
        let modal = document.getElementById('partyHistoryModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'partyHistoryModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width:600px;">
                    <div class="modal-header">
                        <h2><i class="fas fa-history"></i> Payment History</h2>
                        <div class="close-btn" onclick="closePartyHistoryModal()"><i class="fas fa-times"></i></div>
                    </div>
                    <div id="partyHistoryContent" style="max-height:400px;overflow-y:auto;"></div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        document.getElementById('partyHistoryContent').innerHTML = html;
        document.getElementById('partyHistoryModal').style.display = 'flex';
    });
}

// Delete Payment Entry from all sources
function deletePaymentEntry(timestamp, partyId, amount, type, date) {
    if (!confirm('Are you sure you want to delete this ' + type + ' entry of ₹' + amount + '?')) {
        return;
    }
    
    const uid = currentUser.uid;
    
    db.ref('users/' + uid + '/partyPaymentHistory')
        .orderByChild('timestamp')
        .equalTo(parseInt(timestamp))
        .once('value', (snapshot) => {
            snapshot.forEach(child => {
                db.ref('users/' + uid + '/partyPaymentHistory/' + child.key).remove();
            });
        });
    
    db.ref('users/' + uid + '/journalEntries')
        .orderByChild('timestamp')
        .equalTo(parseInt(timestamp))
        .once('value', (snapshot) => {
            snapshot.forEach(child => {
                db.ref('users/' + uid + '/journalEntries/' + child.key).remove();
            });
        });
    
    db.ref('users/' + uid + '/payments')
        .orderByChild('timestamp')
        .equalTo(parseInt(timestamp))
        .once('value', (snapshot) => {
            snapshot.forEach(child => {
                db.ref('users/' + uid + '/payments/' + child.key).remove();
            });
        });
    
    allPayments = allPayments.filter(p => 
        !(p.partyId === partyId && p.amount === amount && p.date === date)
    );
    allReceipts = allReceipts.filter(r => 
        !(r.partyId === partyId && r.amount === amount && r.date === date)
    );
    
    updatePartyBalanceSimple(partyId, amount, type === 'payment' ? 'payment' : 'receipt');
    displayParties(allParties);
    
    alert('Entry deleted successfully!');
    const modal = document.getElementById('partyHistoryModal');
    if (modal) modal.style.display = 'none';
}

function closePartyHistoryModal() {
    document.getElementById('partyHistoryModal').style.display = 'none';
}

function savePaymentEntry() {
    const date = document.getElementById('paymentEntryDate').value;
    const partyId = document.getElementById('paymentToParty').value;
    const party = allParties.find(p => p.id === partyId);
    const partyName = party ? party.name : 'Unknown';
    const amount = parseFloat(document.getElementById('paymentEntryAmount').value) || 0;
    const mode = document.getElementById('paymentEntryMode').value;
    const refNo = document.getElementById('paymentRefNo').value;
    const time = new Date().toLocaleTimeString();
    
    if (!date || !partyId || amount <= 0) {
        alert('Please fill all required fields');
        return;
    }
    
    const debitAccount = partyName + ' A/c';
    const creditAccount = mode === 'cash' ? 'Cash A/c' : 'Bank A/c';
    
    const journalEntry = {
        type: 'payment',
        date: date,
        time: time,
        entryNo: 'PAY/' + new Date().getFullYear() + '/' + String(allJournalEntries.filter(e => e.type === 'payment').length + 1).padStart(4, '0'),
        debitAccount: debitAccount,
        creditAccount: creditAccount,
        debitAmount: amount,
        creditAmount: amount,
        amount: amount,
        partyId: partyId,
        partyName: partyName,
        paymentMode: mode,
        referenceNo: refNo,
        explanation: `Payment made to ${partyName} via ${mode}`,
        timestamp: Date.now()
    };
    
    db.ref('users/' + currentUser.uid + '/journalEntries').push().set(journalEntry)
        .then(() => {
            recordPartyTransaction(partyId, partyName, amount, 'payment', date, mode, refNo);
            updatePartyBalanceSimple(partyId, amount, 'payment');
            
            const paymentKey = `${date}_${partyId}_${amount}`;
            const alreadyExists = allPayments.some(p => `${p.date}_${p.partyId}_${p.amount}` === paymentKey);
            
            if (!alreadyExists) {
                allPayments.push({
                    id: Date.now().toString(),
                    partyId: partyId,
                    partyName: partyName,
                    amount: amount,
                    date: date,
                    paymentMode: mode,
                    referenceNo: refNo,
                    timestamp: Date.now()
                });
            }
            
            displayParties(allParties);
            
            alert('Payment Entry saved!\n\nJournal Entry:\nDr. ' + debitAccount + ' - ₹' + amount.toFixed(2) + '\nCr. ' + creditAccount + ' - ₹' + amount.toFixed(2));
            closePaymentEntryModal();
        })
        .catch(err => alert('Error: ' + err.message));
}

// ==================== RECEIPT ENTRY FUNCTIONS ====================
function showReceiptModal() {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    document.getElementById('receiptDate').value = `${year}-${month}-${day}`;
    
    // Populate party dropdown
    const partySelect = document.getElementById('receiptFromParty');
    partySelect.innerHTML = '<option value="">Select Party</option>';
    allParties.forEach(party => {
        partySelect.innerHTML += `<option value="${party.id}">${party.name}</option>`;
    });
    
    document.getElementById('receiptEntryModal').style.display = 'flex';
}

function closeReceiptModal() {
    document.getElementById('receiptEntryModal').style.display = 'none';
}

document.getElementById('receiptFromParty')?.addEventListener('change', function() {
    const partyId = this.value;
    const party = allParties.find(p => p.id === partyId);
    if (party) {
        document.getElementById('receiptCreditAccount').innerText = party.name + ' A/c';
    }
});

document.getElementById('receiptAmount')?.addEventListener('input', function() {
    const amount = parseFloat(this.value) || 0;
    document.getElementById('receiptDebitPreview').innerText = amount.toFixed(2);
    document.getElementById('receiptCreditPreview').innerText = amount.toFixed(2);
});

document.getElementById('receiptMode')?.addEventListener('change', function() {
    const amount = parseFloat(document.getElementById('receiptAmount').value) || 0;
    const mode = this.value;
    document.getElementById('receiptDebitPreview').innerText = amount.toFixed(2);
    document.getElementById('receiptCreditPreview').innerText = amount.toFixed(2);
});

function saveReceiptEntry() {
    const date = document.getElementById('receiptDate').value;
    const partyId = document.getElementById('receiptFromParty').value;
    const party = allParties.find(p => p.id === partyId);
    const partyName = party ? party.name : 'Unknown';
    // Strict validation for amount
    const amountInput = document.getElementById('receiptAmount').value;
    const amount = parseFloat(amountInput);
    const mode = document.getElementById('receiptMode').value;
    const refNo = document.getElementById('receiptRefNo').value;
    const time = new Date().toLocaleTimeString();
    
    // Validate amount - must be positive number
    if (!amount || isNaN(amount) || amount <= 0) {
        alert('Please enter a valid receipt amount (greater than 0)');
        return;
    }
    
    if (!date || !partyId) {
        alert('Please fill all required fields');
        return;
    }
    
    const debitAccount = mode === 'cash' ? 'Cash A/c' : 'Bank A/c';
    const creditAccount = partyName + ' A/c';
    
    const journalEntry = {
        type: 'receipt',
        date: date,
        time: time,
        entryNo: 'RCP/' + new Date().getFullYear() + '/' + String(allJournalEntries.filter(e => e.type === 'receipt').length + 1).padStart(4, '0'),
        debitAccount: debitAccount,
        creditAccount: creditAccount,
        debitAmount: amount,
        creditAmount: amount,
        amount: amount,  // Add amount field for easier filtering
        partyId: partyId,
        partyName: partyName,
        receiptMode: mode,
        referenceNo: refNo,
        explanation: `Receipt received from ${partyName} via ${mode}`,
        timestamp: Date.now()
    };
    
    db.ref('users/' + currentUser.uid + '/journalEntries').push().set(journalEntry)
        .then(() => {
            // Record in party history with timestamp
            recordPartyTransaction(partyId, partyName, amount, 'receipt', date, mode, refNo);
            
            // Update party balance directly (simple method)
            updatePartyBalanceSimple(partyId, amount, 'receipt');
            
            // Check if this receipt already exists to avoid duplicates
            const receiptKey = `${date}_${partyId}_${amount}`;
            const alreadyExists = allReceipts.some(r => `${r.date}_${r.partyId}_${r.amount}` === receiptKey);
            
            if (!alreadyExists) {
                // Also add to local arrays for immediate display
                allReceipts.push({
                    id: Date.now().toString(),
                    partyId: partyId,
                    partyName: partyName,
                    amount: amount,
                    date: date,
                    receiptMode: mode,
                    referenceNo: refNo,
                    timestamp: Date.now()
                });
            }
            
            // Refresh parties display
            displayParties(allParties);
            
            alert('Receipt Entry saved!\n\nJournal Entry:\nDr. ' + debitAccount + ' - ₹' + amount.toFixed(2) + '\nCr. ' + creditAccount + ' - ₹' + amount.toFixed(2));
            closeReceiptModal();
        })
        .catch(err => alert('Error: ' + err.message));
}

// ==================== JOURNAL ENTRIES LIST ====================
function showJournalModal() {
    loadJournalEntries();
    document.getElementById('journalModal').style.display = 'flex';
}

function closeJournalModal() {
    document.getElementById('journalModal').style.display = 'none';
}

function loadJournalEntries() {
    db.ref('users/' + currentUser.uid + '/journalEntries').orderByChild('timestamp').on('value', (snapshot) => {
        const entries = [];
        snapshot.forEach(child => {
            const entry = child.val();
            entry.id = child.key;
            entries.push(entry);
        });
        entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        allJournalEntries = entries;
        displayJournalEntries(entries);
    });
}

function displayJournalEntries(entries) {
    let html = '';
    entries.forEach(entry => {
        const typeColors = {
            'purchase': 'badge-info',
            'payment': 'badge-warning',
            'receipt': 'badge-success',
            'sale': 'badge-success'
        };
        html += `
            <tr>
                <td>${entry.date || ''}</td>
                <td>${entry.entryNo || ''}</td>
                <td><span class="badge ${typeColors[entry.type] || 'badge-info'}">${(entry.type || '').toUpperCase()}</span></td>
                <td>${entry.debitAccount || ''}</td>
                <td>₹${(entry.debitAmount || 0).toFixed(2)}</td>
                <td>${entry.creditAccount || ''}</td>
                <td>₹${(entry.creditAmount || 0).toFixed(2)}</td>
                <td>
                    <button class="action-btn delete-btn-small" onclick="deleteJournalEntry('${entry.id}', '${entry.entryNo}', '${entry.type}')" title="Delete Entry">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    document.getElementById('journalEntriesList').innerHTML = html || '<tr><td colspan="8" style="text-align:center">No journal entries found</td></tr>';
}

function deleteJournalEntry(entryId, entryNo, entryType) {
    const confirmMsg = `Are you sure you want to delete this ${entryType || 'journal'} entry?\n\nEntry No: ${entryNo}\n\nThis action cannot be undone.`;
    
    if (confirm(confirmMsg)) {
        db.ref('users/' + currentUser.uid + '/journalEntries/' + entryId).remove()
            .then(() => {
                alert('Journal entry deleted successfully!');
                loadJournalEntries();
            })
            .catch(err => {
                alert('Error deleting entry: ' + err.message);
            });
    }
}

function searchJournalEntries() {
    const search = document.getElementById('journalSearch').value.toLowerCase();
    const filtered = allJournalEntries.filter(entry => 
        (entry.entryNo && entry.entryNo.toLowerCase().includes(search)) ||
        (entry.partyName && entry.partyName.toLowerCase().includes(search)) ||
        (entry.explanation && entry.explanation.toLowerCase().includes(search))
    );
    displayJournalEntries(filtered);
}

document.getElementById('purchasePaymentMode')?.addEventListener('change', function() {
    calculatePurchaseAmount();
});

function closeReportsModal() {
    document.getElementById('reportsModal').style.display = 'none';
}

function showReportTab(tab) {
    // Hide all tabs first
    document.getElementById('dashboardTab').style.display = 'none';
    document.getElementById('gstReportTab').style.display = 'none';
    document.getElementById('salesReportTab').style.display = 'none';
    document.getElementById('outstandingTab').style.display = 'none';
    document.getElementById('stockReportTab').style.display = 'none';
    document.getElementById('partyLedgerTab').style.display = 'none';
    document.getElementById('profitReportTab').style.display = 'none';
    
    // Show selected tab
    if (tab === 'dashboard') {
        document.getElementById('dashboardTab').style.display = 'block';
        document.getElementById('tabDashboard')?.classList.add('active');
        generateDashboardCharts();
    } else if (tab === 'gst') {
        document.getElementById('gstReportTab').style.display = 'block';
        document.getElementById('tabGst')?.classList.add('active');
        generateGSTReport();
    } else if (tab === 'sales') {
        document.getElementById('salesReportTab').style.display = 'block';
        document.getElementById('tabSales')?.classList.add('active');
        // Set default date to today if element exists
        const salesDailyDateEl = document.getElementById('salesDailyDate');
        if (salesDailyDateEl && !salesDailyDateEl.value) {
            salesDailyDateEl.value = new Date().toISOString().split('T')[0];
        }
        generateSalesReport();
    } else if (tab === 'outstanding') {
        document.getElementById('outstandingTab').style.display = 'block';
        document.getElementById('tabOutstanding')?.classList.add('active');
        generateOutstandingReport();
    } else if (tab === 'stock') {
        document.getElementById('stockReportTab').style.display = 'block';
        document.getElementById('tabStock')?.classList.add('active');
        generateStockReport();
    } else if (tab === 'party') {
        document.getElementById('partyLedgerTab').style.display = 'block';
        document.getElementById('tabParty')?.classList.add('active');
        updatePartySelect();
        
        // Set default dates if not already set
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const partyFromDate = document.getElementById('partyFromDate');
        const partyToDate = document.getElementById('partyToDate');
        if (partyFromDate && !partyFromDate.value) {
            partyFromDate.value = firstDay.toISOString().split('T')[0];
        }
        if (partyToDate && !partyToDate.value) {
            partyToDate.value = today.toISOString().split('T')[0];
        }
    } else if (tab === 'profit') {
        document.getElementById('profitReportTab').style.display = 'block';
        document.getElementById('tabProfit')?.classList.add('active');
        generateProfitLossReport();
    }
    
    // Update active tab styling
    const tabs = document.querySelectorAll('#reportsModal .tab');
    tabs.forEach(t => t.classList.remove('active'));
    
    if (tab === 'dashboard') document.getElementById('tabDashboard')?.classList.add('active');
    else if (tab === 'gst') document.getElementById('tabGst')?.classList.add('active');
    else if (tab === 'sales') document.getElementById('tabSales')?.classList.add('active');
    else if (tab === 'outstanding') document.getElementById('tabOutstanding')?.classList.add('active');
    else if (tab === 'stock') document.getElementById('tabStock')?.classList.add('active');
    else if (tab === 'party') document.getElementById('tabParty')?.classList.add('active');
    else if (tab === 'profit') document.getElementById('tabProfit')?.classList.add('active');
}

// Generate Comprehensive GST Report
function generateGSTReport() {
    const fromDate = document.getElementById('gstFromDate').value;
    const toDate = document.getElementById('gstToDate').value;
    
    // ==================== CALCULATE SALES GST ====================
    let salesData = [];
    let salesTaxable = 0, salesCGST = 0, salesSGST = 0, salesIGST = 0, salesTotal = 0;
    
    allBills.forEach(bill => {
        if (bill.date >= fromDate && bill.date <= toDate && bill.type === 'sale') {
            const party = allParties.find(p => p.id === bill.partyId);
            const billCGST = bill.cgst || 0;
            const billSGST = bill.sgst || 0;
            const billIGST = bill.igst || 0;
            
            salesTaxable += bill.subtotal || 0;
            salesCGST += billCGST;
            salesSGST += billSGST;
            salesIGST += billIGST;
            salesTotal += bill.grandTotal || 0;
            
            salesData.push({
                date: bill.date,
                billNo: bill.billNumber,
                partyName: bill.partyName,
                gstin: party?.gst || '-',
                hsn: bill.items?.[0]?.hsn || '-',
                taxable: bill.subtotal || 0,
                cgst: billCGST,
                sgst: billSGST,
                igst: billIGST,
                total: bill.grandTotal || 0,
                gstType: bill.gstType
            });
        }
    });
    
    // ==================== CALCULATE PURCHASES GST ====================
    let purchasesData = [];
    let purchasesTaxable = 0, purchasesCGST = 0, purchasesSGST = 0, purchasesIGST = 0, purchasesTotal = 0;
    
    allBills.forEach(bill => {
        if (bill.date >= fromDate && bill.date <= toDate && bill.type === 'purchase') {
            const party = allParties.find(p => p.id === bill.partyId);
            const billCGST = bill.cgst || 0;
            const billSGST = bill.sgst || 0;
            const billIGST = bill.igst || 0;
            
            purchasesTaxable += bill.subtotal || 0;
            purchasesCGST += billCGST;
            purchasesSGST += billSGST;
            purchasesIGST += billIGST;
            purchasesTotal += bill.grandTotal || 0;
            
            purchasesData.push({
                date: bill.date,
                billNo: bill.billNumber,
                partyName: bill.partyName,
                gstin: party?.gst || '-',
                hsn: bill.items?.[0]?.hsn || '-',
                taxable: bill.subtotal || 0,
                cgst: billCGST,
                sgst: billSGST,
                igst: billIGST,
                total: bill.grandTotal || 0,
                gstType: bill.gstType
            });
        }
    });
    
    // ==================== CALCULATE GST SUMMARY ====================
    // Output Tax (GST on Sales)
    const outputCGST = salesCGST;
    const outputSGST = salesSGST;
    const outputIGST = salesIGST;
    const totalOutputTax = outputCGST + outputSGST + outputIGST;
    
    // Input Tax Credit (GST on Purchases)
    const inputCGST = purchasesCGST;
    const inputSGST = purchasesSGST;
    const inputIGST = purchasesIGST;
    const totalInputCredit = inputCGST + inputSGST + inputIGST;
    
    // Net GST Liability
    const netGSTLiability = totalOutputTax - totalInputCredit;
    const isReceivable = netGSTLiability < 0;  // ITC > Output = receivable
    
    // ==================== BUILD HTML REPORT ====================
    let html = '';
    
    // GST Summary Header
    html += `
        <div style="background: linear-gradient(135deg, #1e3c72, #2a5298); color: white; padding: 25px; border-radius: 15px; margin-bottom: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
            <h2 style="margin: 0 0 20px 0;"><i class="fas fa-file-invoice"></i> GST Summary Report</h2>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
                <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 10px; border-left: 4px solid #4caf50;">
                    <div style="font-size: 12px; opacity: 0.9;">Total Sales</div>
                    <div style="font-size: 20px; font-weight: bold; color: #4caf50;">₹${salesTotal.toFixed(2)}</div>
                </div>
                <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 10px; border-left: 4px solid #ff9800;">
                    <div style="font-size: 12px; opacity: 0.9;">Total Purchases</div>
                    <div style="font-size: 20px; font-weight: bold; color: #ff9800;">₹${purchasesTotal.toFixed(2)}</div>
                </div>
                <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 10px; border-left: 4px solid #f44336;">
                    <div style="font-size: 12px; opacity: 0.9;">Output Tax (Sales GST)</div>
                    <div style="font-size: 20px; font-weight: bold; color: #f44336;">₹${totalOutputTax.toFixed(2)}</div>
                </div>
                <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 10px; border-left: 4px solid #2196f3;">
                    <div style="font-size: 12px; opacity: 0.9;">Input Tax Credit</div>
                    <div style="font-size: 20px; font-weight: bold; color: #2196f3;">₹${totalInputCredit.toFixed(2)}</div>
                </div>
            </div>
            <div style="margin-top: 15px; background: ${isReceivable ? '#4caf50' : '#f44336'}; padding: 15px; border-radius: 10px; text-align: center;">
                <div style="font-size: 14px; opacity: 0.9;">${isReceivable ? 'GST Receivable (ITC Available)' : 'GST Payable (Liability)'}</div>
                <div style="font-size: 28px; font-weight: bold;">₹${Math.abs(netGSTLiability).toFixed(2)}</div>
            </div>
        </div>
    `;
    
    // Detailed Breakdown
    html += `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
            <!-- Sales Details -->
            <div style="background: white; padding: 20px; border-radius: 15px; box-shadow: 0 2px 15px rgba(0,0,0,0.1);">
                <h3 style="margin: 0 0 15px 0; color: #4caf50;"><i class="fas fa-arrow-up"></i> Sales (Output Tax)</h3>
                <table class="data-table" style="font-size: 13px;">
                    <thead>
                        <tr style="background: #4caf50; color: white;">
                            <th>Taxable</th>
                            <th>CGST</th>
                            <th>SGST</th>
                            <th>IGST</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="font-weight: bold; background: #f5f5f5;">
                            <td>₹${salesTaxable.toFixed(2)}</td>
                            <td>₹${salesCGST.toFixed(2)}</td>
                            <td>₹${salesSGST.toFixed(2)}</td>
                            <td>₹${salesIGST.toFixed(2)}</td>
                            <td>₹${salesTotal.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <!-- Purchases Details -->
            <div style="background: white; padding: 20px; border-radius: 15px; box-shadow: 0 2px 15px rgba(0,0,0,0.1);">
                <h3 style="margin: 0 0 15px 0; color: #ff9800;"><i class="fas fa-arrow-down"></i> Purchases (Input Tax Credit)</h3>
                <table class="data-table" style="font-size: 13px;">
                    <thead>
                        <tr style="background: #ff9800; color: white;">
                            <th>Taxable</th>
                            <th>CGST</th>
                            <th>SGST</th>
                            <th>IGST</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style="font-weight: bold; background: #f5f5f5;">
                            <td>₹${purchasesTaxable.toFixed(2)}</td>
                            <td>₹${purchasesCGST.toFixed(2)}</td>
                            <td>₹${purchasesSGST.toFixed(2)}</td>
                            <td>₹${purchasesIGST.toFixed(2)}</td>
                            <td>₹${purchasesTotal.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Sales Invoices Table
    html += `
        <div style="background: white; padding: 20px; border-radius: 15px; box-shadow: 0 2px 15px rgba(0,0,0,0.1); margin-bottom: 20px;">
            <h3 style="margin: 0 0 15px 0; color: #1e3c72;"><i class="fas fa-file-invoice-dollar"></i> Sales Invoices (${salesData.length})</h3>
            <div style="overflow-x: auto;">
            <table class="data-table">
                <thead>
                    <tr style="background: #1e3c72; color: white;">
                        <th>Date</th>
                        <th>Invoice No.</th>
                        <th>Party Name</th>
                        <th>GSTIN</th>
                        <th>Taxable (₹)</th>
                        <th>CGST (₹)</th>
                        <th>SGST (₹)</th>
                        <th>IGST (₹)</th>
                        <th>Total (₹)</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    if (salesData.length === 0) {
        html += '<tr><td colspan="9" style="text-align:center">No sales found</td></tr>';
    } else {
        salesData.forEach(sale => {
            html += `
                <tr>
                    <td>${sale.date}</td>
                    <td>${sale.billNo}</td>
                    <td>${sale.partyName}</td>
                    <td>${sale.gstin}</td>
                    <td style="font-weight:600;">₹${sale.taxable.toFixed(2)}</td>
                    <td>₹${sale.cgst.toFixed(2)}</td>
                    <td>₹${sale.sgst.toFixed(2)}</td>
                    <td>₹${sale.igst.toFixed(2)}</td>
                    <td style="font-weight:bold;color:#4caf50;">₹${sale.total.toFixed(2)}</td>
                </tr>
            `;
        });
    }
    
    html += `
                </tbody>
                <tfoot>
                    <tr style="background: #f5f5f5; font-weight: bold;">
                        <td colspan="4">TOTAL</td>
                        <td>₹${salesTaxable.toFixed(2)}</td>
                        <td>₹${salesCGST.toFixed(2)}</td>
                        <td>₹${salesSGST.toFixed(2)}</td>
                        <td>₹${salesIGST.toFixed(2)}</td>
                        <td>₹${salesTotal.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
            </div>
        </div>
    `;
    
    // Purchase Invoices Table
    html += `
        <div style="background: white; padding: 20px; border-radius: 15px; box-shadow: 0 2px 15px rgba(0,0,0,0.1);">
            <h3 style="margin: 0 0 15px 0; color: #1e3c72;"><i class="fas fa-shopping-cart"></i> Purchase Invoices (${purchasesData.length})</h3>
            <div style="overflow-x: auto;">
            <table class="data-table">
                <thead>
                    <tr style="background: #1e3c72; color: white;">
                        <th>Date</th>
                        <th>Bill No.</th>
                        <th>Party Name</th>
                        <th>GSTIN</th>
                        <th>Taxable (₹)</th>
                        <th>CGST (₹)</th>
                        <th>SGST (₹)</th>
                        <th>IGST (₹)</th>
                        <th>Total (₹)</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    if (purchasesData.length === 0) {
        html += '<tr><td colspan="9" style="text-align:center">No purchases found</td></tr>';
    } else {
        purchasesData.forEach(purchase => {
            html += `
                <tr>
                    <td>${purchase.date}</td>
                    <td>${purchase.billNo}</td>
                    <td>${purchase.partyName}</td>
                    <td>${purchase.gstin}</td>
                    <td style="font-weight:600;">₹${purchase.taxable.toFixed(2)}</td>
                    <td>₹${purchase.cgst.toFixed(2)}</td>
                    <td>₹${purchase.sgst.toFixed(2)}</td>
                    <td>₹${purchase.igst.toFixed(2)}</td>
                    <td style="font-weight:bold;color:#ff9800;">₹${purchase.total.toFixed(2)}</td>
                </tr>
            `;
        });
    }
    
    html += `
                </tbody>
                <tfoot>
                    <tr style="background: #f5f5f5; font-weight: bold;">
                        <td colspan="4">TOTAL</td>
                        <td>₹${purchasesTaxable.toFixed(2)}</td>
                        <td>₹${purchasesCGST.toFixed(2)}</td>
                        <td>₹${purchasesSGST.toFixed(2)}</td>
                        <td>₹${purchasesIGST.toFixed(2)}</td>
                        <td>₹${purchasesTotal.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
            </div>
        </div>
    `;
    
    // Update the HTML container
    document.getElementById('gstReportBody').innerHTML = html;
    
    // Clear old footer as we have full report now
    if (document.getElementById('gstReportFooter')) {
        document.getElementById('gstReportFooter').innerHTML = '';
    }
}

// Export GST JSON for GST Portal
function exportGSTJSON() {
    const fromDate = document.getElementById('gstFromDate').value;
    const toDate = document.getElementById('gstToDate').value;
    
    if (!fromDate || !toDate) {
        alert('Please select date range and generate report first');
        return;
    }
    
    // Prepare JSON data for GST portal
    const gstData = {
        "version": "1.0",
        "hash": "",
        "bill_lists": []
    };
    
    allBills.forEach(bill => {
        if (bill.date >= fromDate && bill.date <= toDate && bill.type === 'sale') {
            const party = allParties.find(p => p.id === bill.partyId);
            
            const billData = {
                "bill_date": bill.date,
                "bill_number": bill.billNumber,
                "party_name": bill.partyName,
                "party_gstin": party?.gst || '',
                "party_state": party?.state || '',
                "party_state_code": party?.stateCode || '',
                "bill_type": "tax",
                "invoice_type": "regular",
                "place_of_supply": party?.state || '',
                "reverse_charge": "N",
                "ecommerce_gstin": "",
                "supply_type": bill.gstType === 'interstate' ? 'inter_state' : 'intra_state',
                "items": []
            };
            
            // Add items
            if (bill.items) {
                bill.items.forEach(item => {
                    const itemData = {
                        "item_name": item.name,
                        "hsn_code": item.hsn || '',
                        "quantity": item.quantity,
                        "unit": item.unit,
                        "rate": item.rate,
                        "discount": item.discount || 0,
                        "taxable_amount": (item.quantity * item.rate * (1 - (item.discount || 0) / 100)),
                        "gst_rate": item.gst,
                        "cgst_amount": (bill.gstType === 'intrastate' ? (item.quantity * item.rate * item.gst / 200) : 0),
                        "sgst_amount": (bill.gstType === 'intrastate' ? (item.quantity * item.rate * item.gst / 200) : 0),
                        "igst_amount": (bill.gstType === 'interstate' ? (item.quantity * item.rate * item.gst / 100) : 0),
                        "cess_amount": 0
                    };
                    billData.items.push(itemData);
                });
            }
            
            billData.total_taxable = bill.subtotal || 0;
            billData.total_cgst = bill.cgst || 0;
            billData.total_sgst = bill.sgst || 0;
            billData.total_igst = bill.igst || 0;
            billData.total_cess = 0;
            billData.total_bill_amount = bill.grandTotal || 0;
            
            gstData.bill_lists.push(billData);
        }
    });
    
    if (gstData.bill_lists.length === 0) {
        alert('No bills found for the selected date range');
        return;
    }
    
    // Download JSON file
    const dataStr = JSON.stringify(gstData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'gst_export_' + fromDate + '_to_' + toDate + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert('GST JSON exported successfully! ' + gstData.bill_lists.length + ' bills exported.');
}

// Export GST Report as PDF
function exportGSTPDF() {
    const fromDate = document.getElementById('gstFromDate').value;
    const toDate = document.getElementById('gstToDate').value;
    
    if (!fromDate || !toDate) {
        alert('Please select date range and generate report first');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('GST Report', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Period: ${fromDate} to ${toDate}`, 105, 28, { align: 'center' });
    doc.text(`Company: ${currentCompany?.name || 'N/A'}`, 105, 34, { align: 'center' });
    
    let yPos = 45;
    
    // Table Header
    doc.setFillColor(30, 60, 114);
    doc.rect(10, yPos, 190, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    
    doc.text('S.No', 12, yPos + 5);
    doc.text('Date', 30, yPos + 5);
    doc.text('Invoice No', 55, yPos + 5);
    doc.text('Party Name', 85, yPos + 5);
    doc.text('Taxable', 140, yPos + 5);
    doc.text('GST', 165, yPos + 5);
    doc.text('Total', 185, yPos + 5);
    
    yPos += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    
    let totalTaxable = 0;
    let totalGST = 0;
    let totalAmount = 0;
    let serialNo = 0;
    
    allBills.forEach(bill => {
        if (bill.date >= fromDate && bill.date <= toDate && bill.type === 'sale') {
            serialNo++;
            totalTaxable += bill.subtotal || 0;
            const gstAmt = (bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0);
            totalGST += gstAmt;
            totalAmount += bill.grandTotal || 0;
            
            doc.text(serialNo.toString(), 12, yPos + 4);
            doc.text(bill.date || '', 30, yPos + 4);
            doc.text(bill.billNumber || '', 55, yPos + 4);
            
            // Truncate party name if too long
            const partyName = (bill.partyName || '').substring(0, 20);
            doc.text(partyName, 85, yPos + 4);
            doc.text((bill.subtotal || 0).toFixed(2), 140, yPos + 4);
            doc.text(gstAmt.toFixed(2), 165, yPos + 4);
            doc.text((bill.grandTotal || 0).toFixed(2), 185, yPos + 4);
            
            yPos += 6;
            
            // New page if needed
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
        }
    });
    
    // Totals
    yPos += 5;
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPos, 190, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Total', 12, yPos + 5);
    doc.text(totalTaxable.toFixed(2), 140, yPos + 5);
    doc.text(totalGST.toFixed(2), 165, yPos + 5);
    doc.text(totalAmount.toFixed(2), 185, yPos + 5);
    
    // Footer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Generated by IBAD TECH BUSY', 105, 290, { align: 'center' });
    
    doc.save('gst_report_' + fromDate + '_to_' + toDate + '.pdf');
    alert('GST PDF exported successfully!');
}

// ==================== SALES REPORT (DAILY & MONTHLY) ====================
function generateSalesReport() {
    // Get elements with null check
    const reportTypeEl = document.getElementById('salesReportType');
    const dailyDateEl = document.getElementById('salesDailyDate');
    const monthlyDateEl = document.getElementById('salesMonthlyDate');
    const dailyDateGroupEl = document.getElementById('dailyDateGroup');
    const monthlyDateGroupEl = document.getElementById('monthlyDateGroup');
    const salesCol1El = document.getElementById('salesCol1');
    const salesReportBodyEl = document.getElementById('salesReportBody');
    const salesReportFooterEl = document.getElementById('salesReportFooter');
    const salesReportSummaryEl = document.getElementById('salesReportSummary');
    
    // Return if elements don't exist
    if (!reportTypeEl || !dailyDateEl || !salesReportBodyEl) {
        console.log('Sales report elements not found');
        return;
    }
    
    const reportType = reportTypeEl.value;
    const dailyDate = dailyDateEl.value;
    const monthlyDate = monthlyDateEl ? monthlyDateEl.value : '';
    
    // Toggle date inputs based on report type
    if (dailyDateGroupEl && monthlyDateGroupEl) {
        if (reportType === 'daily') {
            dailyDateGroupEl.style.display = 'block';
            monthlyDateGroupEl.style.display = 'none';
        } else {
            dailyDateGroupEl.style.display = 'none';
            monthlyDateGroupEl.style.display = 'block';
        }
    }
    
    let fromDate = '';
    let toDate = '';
    let reportTitle = '';
    
    if (reportType === 'daily') {
        fromDate = dailyDate;
        toDate = dailyDate;
        reportTitle = 'Daily Sales Report - ' + dailyDate;
    } else {
        // Monthly report
        const [year, month] = (monthlyDate || '').split('-');
        if (!year || !month) {
            // Set default month to current month
            const now = new Date();
            const defaultMonth = now.toISOString().slice(0, 7);
            if (monthlyDateEl) monthlyDateEl.value = defaultMonth;
            const [defYear, defMonth] = defaultMonth.split('-');
            const firstDay = new Date(defYear, defMonth - 1, 1);
            const lastDay = new Date(defYear, defMonth, 0);
            fromDate = firstDay.toISOString().split('T')[0];
            toDate = lastDay.toISOString().split('T')[0];
            reportTitle = 'Monthly Sales Report - ' + defMonth + '/' + defYear;
        } else {
            const firstDay = new Date(year, month - 1, 1);
            const lastDay = new Date(year, month, 0);
            fromDate = firstDay.toISOString().split('T')[0];
            toDate = lastDay.toISOString().split('T')[0];
            reportTitle = 'Monthly Sales Report - ' + month + '/' + year;
        }
    }
    
    // Update column header
    if (salesCol1El) {
        salesCol1El.textContent = reportType === 'daily' ? 'Time' : 'Date';
    }
    
    // Filter sales bills
    const salesBills = allBills.filter(bill => 
        bill.type === 'sale' && bill.date >= fromDate && bill.date <= toDate
    ).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate totals
    let totalTaxable = 0;
    let totalGST = 0;
    let totalGrand = 0;
    let totalBills = salesBills.length;
    
    let html = '';
    
    if (salesBills.length === 0) {
        html = '<tr><td colspan="7" style="text-align:center;padding:20px;">No sales found for selected period</td></tr>';
    } else {
        salesBills.forEach(bill => {
            const gstAmount = (bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0);
            const taxable = bill.subtotal || 0;
            const grandTotal = bill.grandTotal || 0;
            
            totalTaxable += taxable;
            totalGST += gstAmount;
            totalGrand += grandTotal;
            
            // Count items
            const itemCount = bill.items ? bill.items.length : 0;
            const itemText = itemCount === 1 ? '1 item' : itemCount + ' items';
            
            html += `
                <tr>
                    <td>${bill.date}</td>
                    <td>${bill.billNumber || '-'}</td>
                    <td>${bill.partyName || '-'}</td>
                    <td>${itemText}</td>
                    <td style="text-align:right">₹${taxable.toFixed(2)}</td>
                    <td style="text-align:right">₹${gstAmount.toFixed(2)}</td>
                    <td style="text-align:right;font-weight:bold;">₹${grandTotal.toFixed(2)}</td>
                </tr>
            `;
        });
    }
    
    if (salesReportBodyEl) {
        salesReportBodyEl.innerHTML = html;
    }
    
    // Add footer with totals
    const footerHtml = `
        <tr style="background:#e3f2fd;font-weight:bold;">
            <td colspan="3">Total (${totalBills} bills)</td>
            <td></td>
            <td style="text-align:right">₹${totalTaxable.toFixed(2)}</td>
            <td style="text-align:right">₹${totalGST.toFixed(2)}</td>
            <td style="text-align:right">₹${totalGrand.toFixed(2)}</td>
        </tr>
    `;
    if (salesReportFooterEl) {
        salesReportFooterEl.innerHTML = footerHtml;
    }
    
    // Update summary
    if (salesReportSummaryEl) {
        salesReportSummaryEl.innerHTML = `
            <div style="display:flex;justify-content:space-around;text-align:center;">
                <div>
                    <div style="font-size:12px;color:#666;">Total Bills</div>
                    <div style="font-size:24px;font-weight:bold;color:#1976d2;">${totalBills}</div>
                </div>
                <div>
                    <div style="font-size:12px;color:#666;">Taxable Amount</div>
                    <div style="font-size:24px;font-weight:bold;color:#4caf50;">₹${totalTaxable.toFixed(2)}</div>
                </div>
                <div>
                    <div style="font-size:12px;color:#666;">GST</div>
                    <div style="font-size:24px;font-weight:bold;color:#ff9800;">₹${totalGST.toFixed(2)}</div>
                </div>
                <div>
                    <div style="font-size:12px;color:#666;">Grand Total</div>
                    <div style="font-size:24px;font-weight:bold;color:#9c27b0;">₹${totalGrand.toFixed(2)}</div>
                </div>
            </div>
        `;
    }
}

// Generate Outstanding Report
function generateOutstandingReport() {
    let html = '';
    
    allParties.forEach(party => {
        let totalBills = 0;
        let totalPaid = 0;
        let totalReceipts = 0;
        
        allBills.forEach(bill => {
            if (bill.partyId === party.id && bill.type === 'sale') {
                totalBills += bill.grandTotal || 0;
            }
        });
        
        allPayments.forEach(payment => {
            if (payment.partyId === party.id) {
                totalPaid += payment.amount || 0;
            }
        });
        
        allReceipts.forEach(receipt => {
            if (receipt.partyId === party.id) {
                totalReceipts += receipt.amount || 0;
            }
        });
        
        // Outstanding = Sales - Payments - Receipts
        const outstanding = totalBills - totalPaid - totalReceipts;
        const status = outstanding > 0 ? 'Pending' : 'Settled';
        
        html += `
            <tr>
                <td>${party.name}</td>
                <td>${party.gst ? 'Registered' : 'Unregistered'}</td>
                <td>₹${totalBills.toFixed(2)}</td>
                <td>₹${totalPaid.toFixed(2)}</td>
                <td>₹${outstanding.toFixed(2)}</td>
                <td><span class="badge ${outstanding > 0 ? 'badge-warning' : 'badge-success'}">${status}</span></td>
                <td>
                    ${outstanding > 0 ? `<button class="action-btn payment-btn-small" onclick="showPaymentModal('${party.id}', '${party.name}', ${outstanding})">
                        <i class="fas fa-hand-holding-usd"></i> Pay
                    </button>` : ''}
                    <button class="action-btn view-btn-small" onclick="showPaymentHistory('${party.id}')">
                        <i class="fas fa-history"></i> History
                    </button>
                </td>
            </tr>
        `;
    });
    
    document.getElementById('outstandingBody').innerHTML = html || '<tr><td colspan="7" style="text-align:center">No data found</td></tr>';
}

// Generate Stock Report
function generateStockReport() {
    let html = '';
    
    allItems.forEach(item => {
        const value = (item.openingStock || 0) * (item.rate || 0);
        
        html += `
            <tr>
                <td>${item.name}</td>
                <td>${item.hsn || '-'}</td>
                <td>${item.unit || 'PCS'}</td>
                <td>₹${item.mrp || 0}</td>
                <td>${item.openingStock || 0}</td>
                <td>₹${item.costPrice || 0}</td>
                <td>₹${item.rate || 0}</td>
                <td>₹${value.toFixed(2)}</td>
            </tr>
        `;
    });
    
    document.getElementById('stockReportBody').innerHTML = html || '<tr><td colspan="7" style="text-align:center">No items found</td></tr>';
}

// Generate Party Ledger - Comprehensive Detailed Report with Filters
// Fixed with proper accounting logic (Supplier/Creditor Ledger Type)
function generatePartyLedger() {
    const partyId = document.getElementById('partyReportSelect').value;
    const fromDate = document.getElementById('partyFromDate')?.value || '';
    const toDate = document.getElementById('partyToDate')?.value || '';
    const transType = document.getElementById('partyTransType')?.value || 'all';
    const statusFilter = document.getElementById('partyStatusFilter')?.value || 'all';
    
    if (!partyId) {
        alert('Please select a party');
        return;
    }
    
    const party = allParties.find(p => p.id === partyId);
    const partyName = party ? party.name : 'Unknown';
    
    // Filter helper function
    const filterByDate = (item) => {
        if (!fromDate && !toDate) return true;
        const itemDate = new Date(item.date);
        if (fromDate && itemDate < new Date(fromDate)) return false;
        if (toDate && itemDate > new Date(toDate)) return false;
        return true;
    };
    
    // Get all bills for this party
    let partyBills = allBills
        .filter(b => b.partyId === partyId && filterByDate(b))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Get all payments for this party
    let partyPayments = allPayments
        .filter(p => p.partyId === partyId && filterByDate(p))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Get all receipts for this party
    let partyReceipts = allReceipts
        .filter(r => r.partyId === partyId && filterByDate(r))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Apply transaction type filter
    if (transType === 'sale') {
        partyBills = partyBills.filter(b => b.type === 'sale');
        partyPayments = [];
        partyReceipts = [];
    } else if (transType === 'purchase') {
        partyBills = partyBills.filter(b => b.type === 'purchase');
        partyPayments = [];
        partyReceipts = [];
    } else if (transType === 'receipt') {
        partyBills = [];
        partyPayments = [];
    } else if (transType === 'payment') {
        partyBills = [];
        partyReceipts = [];
    }
    
    // ========================================================================
    // PROPER ACCOUNTING LOGIC - Supplier/Creditor Ledger Type
    // ========================================================================
    // Purchase Bill: Party A/c - Credit (We owe them), Purchase A/c - Debit
    // Payment to Supplier: Party A/c - Debit (We paid), Cash/Bank - Credit
    // Sale: Party A/c - Debit (They owe us), Sales A/c - Credit
    // Receipt from Customer: Party A/c - Credit, Cash/Bank - Debit
    // ========================================================================
    
    // Build transaction list with PROPER Debit/Credit for Party Account
    let transactions = [];
    
    // Add Sales Invoices - Party A/c gets DEBITED (customer owes us)
    partyBills.filter(b => b.type === 'sale').forEach(bill => {
        if (bill.grandTotal > 0) {
            transactions.push({
                date: bill.date,
                voucherNo: bill.billNumber,
                type: 'Sale',
                typeIcon: 'fa-file-invoice-dollar',
                debit: bill.grandTotal || 0,  // Debit to Party Account
                credit: 0,
                particulars: `Sale - Invoice ${bill.billNumber}`,
                narration: bill.narration || bill.notes || '-',
                billId: bill.id,
                billAmount: bill.grandTotal || 0
            });
        }
    });
    
    // Add Purchase Invoices - Party A/c gets CREDITED (we owe them)
    partyBills.filter(b => b.type === 'purchase').forEach(bill => {
        if (bill.grandTotal > 0) {
            transactions.push({
                date: bill.date,
                voucherNo: bill.billNumber,
                type: 'Purchase',
                typeIcon: 'fa-shopping-cart',
                debit: 0,
                credit: bill.grandTotal || 0,  // Credit to Party Account
                particulars: `Purchase - Bill ${bill.billNumber}`,
                narration: bill.narration || bill.notes || '-',
                billId: bill.id,
                billAmount: bill.grandTotal || 0
            });
        }
    });
    
    // Add Receipts - Party A/c gets CREDITED (customer paid us, reduces what they owe)
    partyReceipts.forEach(r => {
        if (r.amount > 0) {
            transactions.push({
                date: r.date,
                voucherNo: r.referenceNo || r.id.substring(0, 8),
                type: 'Receipt',
                typeIcon: 'fa-hand-holding-usd',
                debit: 0,
                credit: r.amount || 0,  // Credit to Party Account
                particulars: `Receipt from ${partyName}`,
                narration: r.narration || r.notes || '-',
                billId: null,
                billAmount: 0
            });
        }
    });
    
    // Add Payments - Party A/c gets DEBITED (we paid supplier, reduces what we owe)
    partyPayments.forEach(p => {
        if (p.amount > 0) {
            transactions.push({
                date: p.date,
                voucherNo: p.referenceNo || p.id.substring(0, 8),
                type: 'Payment',
                typeIcon: 'fa-money-bill-wave',
                debit: p.amount || 0,  // Debit to Party Account
                credit: 0,
                particulars: `Payment to ${partyName}`,
                narration: p.narration || p.notes || '-',
                billId: null,
                billAmount: 0
            });
        }
    });
    
    // Sort all transactions by date (and by type for same date)
    transactions.sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        // For same date: Purchases first, then Payments, then Sales, then Receipts
        const typeOrder = { 'Purchase': 1, 'Payment': 2, 'Sale': 3, 'Receipt': 4 };
        return (typeOrder[a.type] || 5) - (typeOrder[b.type] || 5);
    });
    
    // ========================================================================
    // CUSTOMER LEDGER RUNNING BALANCE CALCULATION
    // Formula: balance = previous_balance + debit - credit
    // - Positive balance = Dr (customer owes us)
    // - Negative balance = Cr (we owe customer)
    // - Zero = Settled
    // ========================================================================
    let runningBalance = 0;  // Starting balance
    const today = new Date();
    
    transactions = transactions.map(trans => {
        // Simple running balance calculation
        // Formula: balance = previous_balance + debit - credit
        runningBalance = runningBalance + trans.debit - trans.credit;
        trans.runningBalance = runningBalance;
        
        // Calculate pending amount and status for each transaction
        // For Sales: pending = bill amount - receipts received against it
        // For Purchases: pending = bill amount - payments made against it
        if (trans.type === 'Sale' && trans.billId) {
            // Calculate receipts received after this sale
            const receiptsAfter = partyReceipts
                .filter(r => new Date(r.date) >= new Date(trans.date))
                .reduce((sum, r) => sum + (r.amount || 0), 0);
            const totalReceiptsForParty = partyReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
            
            // Calculate all sales and receipts to determine pending
            const allSalesBefore = partyBills
                .filter(b => b.type === 'sale' && new Date(b.date) <= new Date(trans.date))
                .reduce((sum, b) => sum + (b.grandTotal || 0), 0);
            
            const allReceiptsBefore = partyReceipts
                .filter(r => new Date(r.date) <= new Date(trans.date))
                .reduce((sum, r) => sum + (r.amount || 0), 0);
            
            trans.pendingAmount = Math.max(0, allSalesBefore - allReceiptsBefore);
            trans.aging = Math.floor((today - new Date(trans.date)) / (1000 * 60 * 60 * 24));
            
            // Status: Settled if receipts >= sales, Pending otherwise
            if (trans.pendingAmount === 0) {
                trans.status = 'settled';
            } else if (allReceiptsBefore > 0 && trans.pendingAmount < trans.billAmount) {
                trans.status = 'partially';
            } else {
                trans.status = 'pending';
            }
        } else if (trans.type === 'Purchase' && trans.billId) {
            // For purchases, we need to track payments
            const allPurchasesBefore = partyBills
                .filter(b => b.type === 'purchase' && new Date(b.date) <= new Date(trans.date))
                .reduce((sum, b) => sum + (b.grandTotal || 0), 0);
            
            const allPaymentsBefore = partyPayments
                .filter(p => new Date(p.date) <= new Date(trans.date))
                .reduce((sum, p) => sum + (p.amount || 0), 0);
            
            trans.pendingAmount = Math.max(0, allPurchasesBefore - allPaymentsBefore);
            trans.aging = Math.floor((today - new Date(trans.date)) / (1000 * 60 * 60 * 24));
            
            if (trans.pendingAmount === 0) {
                trans.status = 'settled';
            } else if (allPaymentsBefore > 0 && trans.pendingAmount < trans.billAmount) {
                trans.status = 'partially';
            } else {
                trans.status = 'pending';
            }
        } else {
            // Payment and Receipt transactions
            trans.pendingAmount = 0;
            trans.status = 'settled';
        }
        
        return trans;
    });
    
    // ========================================================================
    // Calculate proper totals
    // Total Debit = Sum of all Debit column values
    // Total Credit = Sum of all Credit column values
    // Outstanding = Total Debit - Total Credit (as per user requirements)
    // If outstanding > 0 → Dr (customer owes us)
    // If outstanding < 0 → Cr (we owe customer)
    // ========================================================================
    let totalDebit = 0;
    let totalCredit = 0;
    
    transactions.forEach(trans => {
        totalDebit += trans.debit || 0;
        totalCredit += trans.credit || 0;
    });
    
    // Final outstanding = Total Debit - Total Credit
    // Positive = Customer owes us (Dr balance)
    // Negative = We owe customer (Cr balance)
    const finalBalance = totalDebit - totalCredit;
    
    // Apply status filter after calculation
    if (statusFilter === 'pending') {
        transactions = transactions.filter(t => t.status === 'pending' || t.status === 'partially');
    } else if (statusFilter === 'settled') {
        transactions = transactions.filter(t => t.status === 'settled');
    }
    
    // Build comprehensive HTML report
    let html = '';
    
    // Party Summary Header with CORRECT Summary Totals
    // finalBalance > 0 → Dr (customer owes us)
    // finalBalance < 0 → Cr (we owe customer)
    const isDr = finalBalance > 0;  // Customer owes us
    const isCr = finalBalance < 0;  // We owe customer
    
    // Calculate totals for display
    const totalSalesAmt = partyBills.filter(b => b.type === 'sale').reduce((sum, b) => sum + (b.grandTotal || 0), 0);
    const totalPurchasesAmt = partyBills.filter(b => b.type === 'purchase').reduce((sum, b) => sum + (b.grandTotal || 0), 0);
    const totalReceiptsAmt = partyReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalPaymentsAmt = partyPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    html += `
        <div style="background: linear-gradient(135deg, #1e3c72, #2a5298); color: white; padding: 25px; border-radius: 15px; margin-bottom: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0;"><i class="fas fa-user-circle"></i> ${partyName}</h2>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button onclick="createPaymentFromLedger('${partyId}', '${partyName}')" style="background: #9c27b0; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 13px;">
                        <i class="fas fa-money-bill-wave"></i> Payment
                    </button>
                    <button onclick="createReceiptFromLedger('${partyId}', '${partyName}')" style="background: #2196f3; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 13px;">
                        <i class="fas fa-hand-holding-usd"></i> Receipt
                    </button>
                    <span style="background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 20px; font-size: 14px;">
                        <i class="fas fa-calendar"></i> ${fromDate || 'Start'} to ${toDate || 'Today'}
                    </span>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px;">
                <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 10px; border-left: 4px solid #4caf50;">
                    <div style="font-size: 12px; opacity: 0.9;"><i class="fas fa-arrow-up"></i> Total Debit</div>
                    <div style="font-size: 22px; font-weight: bold; color: #4caf50;">₹${totalDebit.toFixed(2)}</div>
                </div>
                <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 10px; border-left: 4px solid #ff9800;">
                    <div style="font-size: 12px; opacity: 0.9;"><i class="fas fa-arrow-down"></i> Total Credit</div>
                    <div style="font-size: 22px; font-weight: bold; color: #ff9800;">₹${totalCredit.toFixed(2)}</div>
                </div>
                <div style="background: rgba(255,255,255,0.15); padding: 15px; border-radius: 10px; border-left: 4px solid ${isDr ? '#f44336' : '#4caf50'};">
                    <div style="font-size: 12px; opacity: 0.9;"><i class="fas fa-balance-scale"></i> Outstanding</div>
                    <div style="font-size: 22px; font-weight: bold; color: ${isDr ? '#f44336' : '#4caf50'};">₹${Math.abs(finalBalance).toFixed(2)} ${isDr ? 'Dr' : 'Cr'}</div>
                </div>
            </div>
        </div>
    `;
    
    // Aging Analysis Section - Only for pending/partially settled transactions
    const pendingTransactions = transactions.filter(t => (t.status === 'pending' || t.status === 'partially') && t.billId);
    let aging0_30 = 0, aging31_60 = 0, aging61_90 = 0, aging90plus = 0;
    
    pendingTransactions.forEach(trans => {
        const days = trans.aging || 0;
        const pendingAmt = trans.pendingAmount || 0;
        if (days <= 30) aging0_30 += pendingAmt;
        else if (days <= 60) aging31_60 += pendingAmt;
        else if (days <= 90) aging61_90 += pendingAmt;
        else aging90plus += pendingAmt;
    });
    
    const totalOutstanding = aging0_30 + aging31_60 + aging61_90 + aging90plus;
    
    if (totalOutstanding > 0) {
        html += `
            <div style="background: white; padding: 20px; border-radius: 15px; margin-bottom: 25px; box-shadow: 0 2px 15px rgba(0,0,0,0.1);">
                <h3 style="margin: 0 0 20px 0; color: #1e3c72;"><i class="fas fa-clock"></i> Aging Analysis - Outstanding Amounts</h3>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
                    <div style="background: linear-gradient(135deg, #4caf50, #81c784); padding: 20px; border-radius: 10px; color: white; text-align: center;">
                        <div style="font-size: 12px; opacity: 0.9;">0-30 Days</div>
                        <div style="font-size: 24px; font-weight: bold;">₹${aging0_30.toFixed(2)}</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #ff9800, #ffb74d); padding: 20px; border-radius: 10px; color: white; text-align: center;">
                        <div style="font-size: 12px; opacity: 0.9;">31-60 Days</div>
                        <div style="font-size: 24px; font-weight: bold;">₹${aging31_60.toFixed(2)}</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #ff5722, #ff8a65); padding: 20px; border-radius: 10px; color: white; text-align: center;">
                        <div style="font-size: 12px; opacity: 0.9;">61-90 Days</div>
                        <div style="font-size: 24px; font-weight: bold;">₹${aging61_90.toFixed(2)}</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #f44336, #e57373); padding: 20px; border-radius: 10px; color: white; text-align: center;">
                        <div style="font-size: 12px; opacity: 0.9;">90+ Days</div>
                        <div style="font-size: 24px; font-weight: bold;">₹${aging90plus.toFixed(2)}</div>
                    </div>
                </div>
                <div style="margin-top: 15px; text-align: right; padding: 10px; background: #f5f5f5; border-radius: 8px;">
                    <span style="color: #666;">Total Outstanding: </span>
                    <span style="font-size: 20px; font-weight: bold; color: #f44336;">₹${totalOutstanding.toFixed(2)}</span>
                </div>
            </div>
        `;
    }
    
    // Detailed Transaction Table with Running Balance
    if (transactions.length > 0) {
        html += `
            <div style="background: white; padding: 20px; border-radius: 15px; box-shadow: 0 2px 15px rgba(0,0,0,0.1);">
                <h3 style="margin: 0 0 20px 0; color: #1e3c72;"><i class="fas fa-list"></i> Transaction Details (${transactions.length} entries)</h3>
                <div style="overflow-x: auto;">
                <table class="data-table" style="min-width: 1000px;">
                    <thead>
                        <tr style="background: linear-gradient(135deg, #1e3c72, #2a5298); color: white;">
                            <th style="padding: 15px;"><i class="fas fa-calendar"></i> Date</th>
                            <th style="padding: 15px;"><i class="fas fa-file-alt"></i> Voucher No.</th>
                            <th style="padding: 15px;"><i class="fas fa-tag"></i> Type</th>
                            <th style="padding: 15px;"><i class="fas fa-align-left"></i> Particulars</th>
                            <th style="padding: 15px; text-align: right;"><i class="fas fa-arrow-up"></i> Debit (₹)</th>
                            <th style="padding: 15px; text-align: right;"><i class="fas fa-arrow-down"></i> Credit (₹)</th>
                            <th style="padding: 15px; text-align: right;"><i class="fas fa-balance-scale"></i> Balance (₹)</th>
                            <th style="padding: 15px; text-align: center;"><i class="fas fa-info-circle"></i> Status</th>
                            <th style="padding: 15px;"><i class="fas fa-sticky-note"></i> Narration</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Group transactions by date
        const groupedByDate = {};
        transactions.forEach(trans => {
            if (!groupedByDate[trans.date]) {
                groupedByDate[trans.date] = [];
            }
            groupedByDate[trans.date].push(trans);
        });
        
        let rowIndex = 0;
        Object.keys(groupedByDate).forEach(date => {
            // Date header row
            html += `
                <tr style="background: #e3f2fd; font-weight: bold;">
                    <td colspan="9" style="padding: 10px 15px; color: #1565c0;">
                        <i class="fas fa-calendar-day"></i> ${date}
                    </td>
                </tr>
            `;
            
            groupedByDate[date].forEach(trans => {
                rowIndex++;
                const isAlternate = rowIndex % 2 === 0;
                // Running balance: positive = Credit (Cr), negative = Debit (Dr)
                // Running balance: positive = Dr (customer owes us), negative = Cr (we owe customer)
                const balanceColor = trans.runningBalance >= 0 ? '#f44336' : '#4caf50';
                const typeColors = {
                    'Sale': '#4caf50',
                    'Purchase': '#ff9800',
                    'Receipt': '#2196f3',
                    'Payment': '#9c27b0'
                };
                const typeColor = typeColors[trans.type] || '#666';
                const isPending = trans.status === 'pending' || trans.status === 'partially';
                
                html += `
                    <tr style="${isAlternate ? 'background: #f8f9fa;' : 'background: white;'} transition: background 0.2s;">
                        <td style="padding: 12px 15px;">${trans.date}</td>
                        <td style="font-weight: 600; color: #1e3c72;">${trans.voucherNo}</td>
                        <td>
                            <span style="background: ${typeColor}20; color: ${typeColor}; padding: 4px 10px; border-radius: 15px; font-weight: 600; font-size: 12px;">
                                <i class="fas ${trans.typeIcon}"></i> ${trans.type}
                            </span>
                        </td>
                        <td style="color: #555;">${trans.particulars}</td>
                        <td style="text-align: right; font-weight: 600; color: ${trans.debit > 0 ? '#4caf50' : '#ccc'};">
                            ${trans.debit > 0 ? '₹' + trans.debit.toFixed(2) : '-'}
                        </td>
                        <td style="text-align: right; font-weight: 600; color: ${trans.credit > 0 ? '#ff9800' : '#ccc'};">
                            ${trans.credit > 0 ? '₹' + trans.credit.toFixed(2) : '-'}
                        </td>
                        <td style="text-align: right; font-weight: bold; color: ${balanceColor};">
                            ₹${Math.abs(trans.runningBalance).toFixed(2)} ${trans.runningBalance >= 0 ? 'Dr' : 'Cr'}
                            ${trans.status === 'partially' ? '<span style="font-size:10px; color:#666;">*</span>' : ''}
                        </td>
                        <td style="text-align: center;">
                            <span class="badge ${trans.status === 'pending' ? 'badge-warning' : trans.status === 'partially' ? 'badge-info' : 'badge-success'}" style="font-size: 11px; padding: 5px 10px;">
                                <i class="fas ${trans.status === 'pending' ? 'fa-clock' : trans.status === 'partially' ? 'fa-adjust' : 'fa-check-circle'}"></i> ${trans.status === 'pending' ? 'Pending' : trans.status === 'partially' ? 'Partial' : 'Settled'}
                            </span>
                            ${isPending && trans.aging ? `<span style="margin-left: 5px; font-size: 10px; color: ${trans.aging > 60 ? '#f44336' : '#666'};">(${trans.aging} days)</span>` : ''}
                        </td>
                        <td style="color: #777; font-size: 12px;">${trans.narration || '-'}</td>
                    </tr>
                `;
            });
        });
        
        // Summary Footer Row - Shows correct totals
        // Get final running balance from last transaction
        const finalRunningBalance = transactions.length > 0 ? transactions[transactions.length - 1].runningBalance : 0;
        const finalIsDr = finalRunningBalance > 0;
        
        html += `
                <tr style="background: linear-gradient(135deg, #1e3c72, #2a5298); color: white; font-weight: bold;">
                    <td colspan="4" style="padding: 15px; text-align: right;">TOTAL</td>
                    <td style="padding: 15px; text-align: right; color: #4caf50;">₹${totalDebit.toFixed(2)}</td>
                    <td style="padding: 15px; text-align: right; color: #ff9800;">₹${totalCredit.toFixed(2)}</td>
                    <td style="padding: 15px; text-align: right; color: ${finalIsDr ? '#f44336' : '#4caf50'};">₹${Math.abs(finalRunningBalance).toFixed(2)} ${finalIsDr ? 'Dr' : 'Cr'}</td>
                    <td colspan="2"></td>
                </tr>
            </tbody>
                </table>
                </div>
            </div>
        `;
    } else {
        html += `
            <div style="background: white; padding: 40px; border-radius: 15px; text-align: center; box-shadow: 0 2px 15px rgba(0,0,0,0.1);">
                <i class="fas fa-inbox" style="font-size: 48px; color: #ccc; margin-bottom: 15px;"></i>
                <p style="color: #666; font-size: 16px;">No transactions found for the selected criteria</p>
            </div>
        `;
    }
    
    // Receipts/Payments Section
    if (partyReceipts.length > 0 || partyPayments.length > 0) {
        html += `<h4 style="color: #1e3c72; margin: 20px 0 10px 0;"><i class="fas fa-money-bill-wave"></i> Payment History</h4>`;
        html += `
            <table class="data-table" style="margin-bottom: 20px;">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Reference</th>
                        <th>Mode</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Combine and sort payments and receipts
        const allPaymentTransactions = [
            ...partyReceipts.map(r => ({ ...r, transType: 'Receipt' })),
            ...partyPayments.map(p => ({ ...p, transType: 'Payment' }))
        ].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        allPaymentTransactions.forEach(trans => {
            const isReceipt = trans.transType === 'Receipt';
            html += `
                <tr>
                    <td>${trans.date}</td>
                    <td><span class="badge ${isReceipt ? 'badge-success' : 'badge-info'}">${trans.transType}</span></td>
                    <td>${trans.referenceNo || trans.reference || '-'}</td>
                    <td>${trans.receiptMode || trans.paymentMode || '-'}</td>
                    <td style="font-weight: bold; color: ${isReceipt ? '#4caf50' : '#2196f3'};">₹${(trans.amount || 0).toFixed(2)}</td>
                </tr>
            `;
        });
        html += '</tbody></table>';
    }
    
    // Purchase Invoices Section
    if (partyBills.filter(b => b.type === 'purchase').length > 0) {
        html += `<h4 style="color: #1e3c72; margin: 20px 0 10px 0;"><i class="fas fa-truck"></i> Purchase Invoices (${partyBills.filter(b => b.type === 'purchase').length})</h4>`;
        html += `
            <table class="data-table" style="margin-bottom: 20px;">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Invoice No.</th>
                        <th>Amount</th>
                        <th>Paid</th>
                        <th>Pending</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        partyBills.filter(b => b.type === 'purchase').forEach(bill => {
            const billAmount = bill.grandTotal || 0;
            html += `
                <tr>
                    <td>${bill.date}</td>
                    <td>${bill.billNumber}</td>
                    <td style="font-weight: bold;">₹${billAmount.toFixed(2)}</td>
                    <td style="color: #4caf50;">₹0.00</td>
                    <td style="font-weight: bold;">₹${billAmount.toFixed(2)}</td>
                    <td><span class="badge badge-warning">Pending</span></td>
                </tr>
            `;
        });
        html += '</tbody></table>';
    }
    
    // Update the content container - use innerHTML for HTML content
    document.getElementById('partyLedgerContent').innerHTML = html;
}

// Export Party Ledger to PDF
function exportPartyLedgerPDF() {
    const partyId = document.getElementById('partyReportSelect').value;
    if (!partyId) {
        alert('Please select a party first');
        return;
    }
    
    const party = allParties.find(p => p.id === partyId);
    const partyName = party ? party.name : 'Unknown';
    
    // Calculate all data
    let totalSales = 0, totalPurchases = 0, totalPayments = 0, totalReceipts = 0;
    
    const partyBills = allBills.filter(b => b.partyId === partyId);
    // Filter only valid positive amounts
    const partyPayments = allPayments.filter(p => p.partyId === partyId && p.amount > 0);
    const partyReceipts = allReceipts.filter(r => r.partyId === partyId && r.amount > 0);
    
    partyBills.forEach(bill => {
        if (bill.type === 'sale') totalSales += bill.grandTotal || 0;
        else totalPurchases += bill.grandTotal || 0;
    });
    partyPayments.forEach(p => totalPayments += p.amount || 0);
    partyReceipts.forEach(r => totalReceipts += r.amount || 0);
    
    const balance = (totalSales - totalPurchases) - (totalPayments + totalReceipts);
    
    // Create PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    let y = 20;
    
    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Party Ledger Report', 105, y, { align: 'center' });
    y += 10;
    
    doc.setFontSize(12);
    doc.text(`Party: ${partyName}`, 20, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (party) {
        // Address - split into multiple lines with proper spacing
        const addrLines = party.address ? party.address.split(',') : [];
        let addrY = y;
        addrLines.forEach((line, i) => {
            if (i < 3) { // Allow up to 3 lines
                doc.text(line.trim(), 20, addrY);
                addrY += 5;
            }
        });
        y = addrY + 2; // More space after address
        doc.text(`GSTIN: ${party.gst || '-'}`, 20, y); y += 6;
        doc.text(`State: ${party.state || '-'}`, 20, y); y += 10;
    }
    
    // Summary Box
    doc.setFillColor(240, 240, 240);
    doc.rect(20, y, 170, 35, 'F');
    y += 8;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Account Summary', 25, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total Sales: ₹${totalSales.toFixed(2)}`, 25, y);
    doc.text(`Total Received: ₹${totalReceipts.toFixed(2)}`, 110, y);
    y += 7;
    doc.text(`Total Purchases: ₹${totalPurchases.toFixed(2)}`, 25, y);
    doc.text(`Total Paid: ₹${totalPayments.toFixed(2)}`, 110, y);
    y += 10;
    
    const isReceivable = balance >= 0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Outstanding: ₹${Math.abs(balance).toFixed(2)} ${isReceivable ? '(Receivable)' : '(Payable)'}`, 25, y);
    y += 15;
    
    // Sales Invoices
    if (partyBills.filter(b => b.type === 'sale').length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Sales Invoices', 20, y);
        y += 8;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(200, 200, 200);
        doc.rect(20, y - 4, 170, 7, 'F');
        doc.text('Date', 22, y);
        doc.text('Invoice No.', 50, y);
        doc.text('Amount', 120, y);
        doc.text('Status', 160, y);
        y += 6;
        
        doc.setFont('helvetica', 'normal');
        partyBills.filter(b => b.type === 'sale').forEach(bill => {
            doc.text(bill.date || '-', 22, y);
            doc.text(bill.billNumber || '-', 50, y);
            doc.text(`₹${(bill.grandTotal || 0).toFixed(2)}`, 120, y);
            doc.text('Pending', 160, y);
            y += 6;
        });
        y += 5;
    }
    
    // Receipts
    if (partyReceipts.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Receipts Received', 20, y);
        y += 8;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(200, 200, 200);
        doc.rect(20, y - 4, 170, 7, 'F');
        doc.text('Date', 22, y);
        doc.text('Reference', 50, y);
        doc.text('Mode', 100, y);
        doc.text('Amount', 150, y);
        y += 6;
        
        doc.setFont('helvetica', 'normal');
        partyReceipts.forEach(r => {
            doc.text(r.date || '-', 22, y);
            doc.text(r.referenceNo || r.reference || '-', 50, y);
            doc.text(r.receiptMode || '-', 100, y);
            doc.text(`₹${(r.amount || 0).toFixed(2)}`, 150, y);
            y += 6;
        });
    }
    
    // Footer
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 285);
    
    doc.save(`Party_Ledger_${partyName}_${new Date().toISOString().split('T')[0]}.pdf`);
}

// Generate Profit & Loss Report
function generateProfitLossReport() {
    const fromDate = document.getElementById('profitFromDate').value;
    const toDate = document.getElementById('profitToDate').value;
    
    if (!fromDate || !toDate) {
        alert('Please select date range');
        return;
    }
    
    let totalSales = 0;
    let totalSalesWithoutGST = 0;
    let totalSalesCost = 0;
    let totalPurchase = 0;
    let salesCount = 0;
    let purchaseCount = 0;
    
    // Calculate sales with proper cost tracking
    allBills.forEach(bill => {
        if (bill.date >= fromDate && bill.date <= toDate && bill.type === 'sale') {
            salesCount++;
            totalSales += bill.grandTotal || 0;
            totalSalesWithoutGST += bill.subtotal || 0;
            
            // Calculate cost price from items - use item.rate if costPrice not available
            if (bill.items) {
                bill.items.forEach(item => {
                    const stockItem = allItems.find(s => s.id === item.id);
                    // Use costPrice if available, otherwise use a fallback
                    const costPrice = stockItem?.costPrice || (item.rate * 0.7); // Default 70% of sale price if no costPrice
                    totalSalesCost += (item.quantity * costPrice);
                });
            }
        }
    });
    
    // Calculate purchases
    allBills.forEach(bill => {
        if (bill.date >= fromDate && bill.date <= toDate && bill.type === 'purchase') {
            purchaseCount++;
            totalPurchase += bill.grandTotal || 0;
        }
    });
    
    const grossProfit = totalSalesWithoutGST - totalSalesCost;
    const profitMargin = totalSalesWithoutGST > 0 ? ((grossProfit / totalSalesWithoutGST) * 100).toFixed(2) : 0;
    const netProfit = grossProfit; // Can add expenses later
    
    let html = `
        <div style="background: white; border-radius: 16px; padding: 25px; margin-top: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h3 style="color: #1e3c72; margin-bottom: 20px; border-bottom: 2px solid #1e3c72; padding-bottom: 10px;">
                <i class="fas fa-chart-pie"></i> Profit & Loss Statement
            </h3>
            <p style="color: #6b7280; margin-bottom: 20px;">Period: ${fromDate} to ${toDate}</p>
            
            <!-- Summary Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="background: #e3f2fd; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 12px; color: #1565c0;">Total Sales</div>
                    <div style="font-size: 20px; font-weight: bold; color: #1565c0;">₹${totalSalesWithoutGST.toFixed(2)}</div>
                    <div style="font-size: 11px; color: #666;">${salesCount} invoices</div>
                </div>
                <div style="background: #fff3e0; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 12px; color: #e65100;">Cost of Goods</div>
                    <div style="font-size: 20px; font-weight: bold; color: #e65100;">₹${totalSalesCost.toFixed(2)}</div>
                    <div style="font-size: 11px; color: #666;">Purchase cost</div>
                </div>
                <div style="background: ${grossProfit >= 0 ? '#e8f5e9' : '#ffebee'}; padding: 15px; border-radius: 10px; text-align: center;">
                    <div style="font-size: 12px; color: ${grossProfit >= 0 ? '#2e7d32' : '#c62828'};">Gross Profit</div>
                    <div style="font-size: 20px; font-weight: bold; color: ${grossProfit >= 0 ? '#2e7d32' : '#c62828'};">₹${grossProfit.toFixed(2)}</div>
                    <div style="font-size: 11px; color: #666;">${profitMargin}% margin</div>
                </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse;">
                <tr style="background: #f3f4f6;">
                    <td style="padding: 12px; font-weight: bold; color: #1e3c72;">Particulars</td>
                    <td style="padding: 12px; text-align: right; font-weight: bold; color: #1e3c72;">Amount (₹)</td>
                </tr>
                <tr>
                    <td colspan="2" style="padding: 10px; font-weight: bold; background: #e3f2fd; color: #1565c0;">INCOME</td>
                </tr>
                <tr>
                    <td style="padding: 12px;">Sales (Taxable Value)</td>
                    <td style="padding: 12px; text-align: right;">₹${totalSalesWithoutGST.toFixed(2)}</td>
                </tr>
                <tr>
                    <td style="padding: 12px;">Add: Output GST (CGST+SGST/IGST)</td>
                    <td style="padding: 12px; text-align: right;">₹${(totalSales - totalSalesWithoutGST).toFixed(2)}</td>
                </tr>
                <tr style="background: #f3f4f6; font-weight: bold;">
                    <td style="padding: 12px;">Total Sales (with GST)</td>
                    <td style="padding: 12px; text-align: right;">₹${totalSales.toFixed(2)}</td>
                </tr>
                <tr>
                    <td colspan="2" style="padding: 10px; font-weight: bold; background: #ffebee; color: #c62828;">DIRECT COSTS</td>
                </tr>
                <tr>
                    <td style="padding: 12px;">Cost of Goods Sold</td>
                    <td style="padding: 12px; text-align: right;">₹${totalSalesCost.toFixed(2)}</td>
                </tr>
                <tr style="background: #f3f4f6; font-weight: bold;">
                    <td style="padding: 12px;">Total Direct Costs</td>
                    <td style="padding: 12px; text-align: right;">₹${totalSalesCost.toFixed(2)}</td>
                </tr>
                <tr style="background: #e8f5e9; font-weight: bold; font-size: 16px;">
                    <td style="padding: 15px; color: #2e7d32;">Gross Profit</td>
                    <td style="padding: 15px; text-align: right; color: ${grossProfit >= 0 ? '#2e7d32' : '#c62828'};">₹${grossProfit.toFixed(2)} (${profitMargin}%)</td>
                </tr>
                <tr>
                    <td colspan="2" style="padding: 10px; font-weight: bold; background: #fff3e0; color: #e65100;">Indirect Expenses</td>
                </tr>
                <tr>
                    <td style="padding: 12px;">Other Expenses</td>
                    <td style="padding: 12px; text-align: right;">₹0.00</td>
                </tr>
                <tr style="background: #f3f4f6; font-weight: bold;">
                    <td style="padding: 12px;">Total Indirect Expenses</td>
                    <td style="padding: 12px; text-align: right;">₹0.00</td>
                </tr>
                <tr style="background: #e3f2fd; font-weight: bold; font-size: 18px;">
                    <td style="padding: 15px; color: #1565c0;">Net Profit</td>
                    <td style="padding: 15px; text-align: right; color: ${netProfit >= 0 ? '#1565c0' : '#c62828'};">₹${netProfit.toFixed(2)}</td>
                </tr>
            </table>
            
            <div style="margin-top: 20px; padding: 15px; background: ${netProfit >= 0 ? '#e8f5e9' : '#ffebee'}; border-radius: 8px; text-align: center;">
                <strong style="font-size: 18px; color: ${netProfit >= 0 ? '#2e7d32' : '#c62828'};">
                    ${netProfit >= 0 ? 'PROFIT' : 'LOSS'}: ₹${Math.abs(netProfit).toFixed(2)}
                </strong>
            </div>
        </div>
    `;
    
    document.getElementById('profitReportContent').innerHTML = html;
}

// All Bills
function showAllBills() {
    let html = '';
    
    // Filter options
    html += `
        <div style="margin-bottom: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn-secondary" onclick="filterBills('all')" id="filterAll" style="padding: 8px 16px;">All</button>
            <button class="btn-secondary" onclick="filterBills('sale')" id="filterSale" style="padding: 8px 16px;">Sales</button>
            <button class="btn-secondary" onclick="filterBills('purchase')" id="filterPurchase" style="padding: 8px 16px;">Purchases</button>
        </div>
    `;
    
    html += '<div id="billsTableContent">';
    allBills.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).forEach(bill => {
        html += `
            <tr class="bill-row bill-${bill.type}">
                <td>${bill.billNumber}</td>
                <td>${bill.date}</td>
                <td>${bill.partyName}</td>
                <td><span class="badge ${bill.type === 'sale' ? 'badge-success' : 'badge-info'}">${bill.type.toUpperCase()}</span></td>
                <td>${getGSTTypeLabel(bill.gstType)}</td>
                <td>₹${bill.grandTotal.toFixed(2)}</td>
                <td>
                    <button class="action-btn edit-btn-small" onclick="showBillModal('${bill.type}', '${bill.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn-small" onclick="deleteBill('${bill.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="action-btn view-btn-small" onclick="generatePDFFromBill('${bill.id}')">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    html += '</div>';
    
    document.getElementById('allBillsList').innerHTML = html || '<tr><td colspan="7" style="text-align:center">No bills found</td></tr>';
    
    // Set initial filter
    filterBills('all');
    
    document.getElementById('billsListModal').style.display = 'flex';
}

function filterBills(type) {
    // Update button styles
    document.getElementById('filterAll').classList.remove('btn-primary');
    document.getElementById('filterSale').classList.remove('btn-primary');
    document.getElementById('filterPurchase').classList.remove('btn-primary');
    document.getElementById('filterAll').classList.add('btn-secondary');
    document.getElementById('filterSale').classList.add('btn-secondary');
    document.getElementById('filterPurchase').classList.add('btn-secondary');
    
    if (type === 'sale') {
        document.getElementById('filterSale').classList.remove('btn-secondary');
        document.getElementById('filterSale').classList.add('btn-primary');
    } else if (type === 'purchase') {
        document.getElementById('filterPurchase').classList.remove('btn-secondary');
        document.getElementById('filterPurchase').classList.add('btn-primary');
    } else {
        document.getElementById('filterAll').classList.remove('btn-secondary');
        document.getElementById('filterAll').classList.add('btn-primary');
    }
    
    // Show/hide rows
    const rows = document.querySelectorAll('.bill-row');
    rows.forEach(row => {
        if (type === 'all') {
            row.style.display = '';
        } else {
            row.style.display = row.classList.contains('bill-' + type) ? '' : 'none';
        }
    });
}

function closeBillsListModal() {
    document.getElementById('billsListModal').style.display = 'none';
}

// Email Modal Functions
function openEmailModal() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById('emailFromDate').value = firstDay.toISOString().split('T')[0];
    document.getElementById('emailToDate').value = today.toISOString().split('T')[0];
    document.getElementById('emailStatus').innerText = '';
    document.getElementById('emailModal').style.display = 'flex';
}

function closeEmailModal() {
    document.getElementById('emailModal').style.display = 'none';
}

function downloadReportPDF() {
    const reportType = document.getElementById('reportType').value;
    if (reportType === 'gst') {
        generateGSTReportPDF();
    } else if (reportType === 'stock') {
        generateStockReportPDF();
    } else if (reportType === 'outstanding') {
        generateOutstandingReportPDF();
    } else if (reportType === 'party') {
        alert('Please select a party from Party Ledger tab first');
    }
}

function sendReportEmail() {
    const caEmail = document.getElementById('caEmail').value;
    if (!caEmail) {
        alert('Please enter CA email address');
        return;
    }
    
    document.getElementById('emailStatus').innerText = 'Generating PDF... Please wait';
    
    // For demo purposes, we'll just show an alert
    // In production, you would use a backend service to send emails
    setTimeout(() => {
        document.getElementById('emailStatus').innerText = 'Email feature requires backend setup. Please download PDF and send manually.';
        setTimeout(() => {
            downloadReportPDF();
        }, 2000);
    }, 1500);
}

// Generate GST Report PDF
function generateGSTReportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text('GST Report', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    const fromDate = document.getElementById('gstFromDate')?.value || '';
    const toDate = document.getElementById('gstToDate')?.value || '';
    doc.text(`Period: ${fromDate} to ${toDate}`, 105, 30, { align: 'center' });
    
    let yPos = 45;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    
    // Table header
    const headers = ['Date', 'Bill No', 'Party', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total'];
    const colWidths = [22, 30, 40, 25, 20, 20, 20, 25];
    let xPos = 10;
    
    headers.forEach((header, i) => {
        doc.text(header, xPos, yPos);
        xPos += colWidths[i];
    });
    
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    
    let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0, totalAmount = 0;
    
    const filteredBills = allBills.filter(bill => {
        if (bill.type !== 'sale') return false;
        const billDate = bill.date || '';
        return billDate >= fromDate && billDate <= toDate;
    });
    
    filteredBills.forEach(bill => {
        totalTaxable += bill.subtotal || 0;
        totalCGST += bill.cgst || 0;
        totalSGST += bill.sgst || 0;
        totalIGST += bill.igst || 0;
        totalAmount += bill.grandTotal || 0;
        
        xPos = 10;
        doc.text(bill.date || '', xPos, yPos);
        xPos += colWidths[0];
        doc.text(bill.billNumber || '', xPos, yPos);
        xPos += colWidths[1];
        doc.text((bill.partyName || '').substring(0, 15), xPos, yPos);
        xPos += colWidths[2];
        doc.text((bill.subtotal || 0).toFixed(2), xPos, yPos);
        xPos += colWidths[3];
        doc.text((bill.cgst || 0).toFixed(2), xPos, yPos);
        xPos += colWidths[4];
        doc.text((bill.sgst || 0).toFixed(2), xPos, yPos);
        xPos += colWidths[5];
        doc.text((bill.igst || 0).toFixed(2), xPos, yPos);
        xPos += colWidths[6];
        doc.text((bill.grandTotal || 0).toFixed(2), xPos, yPos);
        
        yPos += 7;
    });
    
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    xPos = 10;
    doc.text('Total:', xPos, yPos);
    xPos += colWidths[0] + colWidths[1] + colWidths[2];
    doc.text(totalTaxable.toFixed(2), xPos, yPos);
    xPos += colWidths[3];
    doc.text(totalCGST.toFixed(2), xPos, yPos);
    xPos += colWidths[4];
    doc.text(totalSGST.toFixed(2), xPos, yPos);
    xPos += colWidths[5];
    doc.text(totalIGST.toFixed(2), xPos, yPos);
    xPos += colWidths[6];
    doc.text(totalAmount.toFixed(2), xPos, yPos);
    
    doc.save('GST-Report.pdf');
    closeEmailModal();
}

// Generate Stock Report PDF
function generateStockReportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text('Stock Report', 105, 20, { align: 'center' });
    
    let yPos = 35;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    
    const headers = ['Item Name', 'HSN', 'Unit', 'Stock', 'Rate', 'Value'];
    const colWidths = [60, 25, 20, 25, 30, 35];
    let xPos = 10;
    
    headers.forEach((header, i) => {
        doc.text(header, xPos, yPos);
        xPos += colWidths[i];
    });
    
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    
    allItems.forEach(item => {
        const value = (item.openingStock || 0) * (item.rate || 0);
        
        xPos = 10;
        doc.text(item.name || '', xPos, yPos);
        xPos += colWidths[0];
        doc.text(item.hsn || '', xPos, yPos);
        xPos += colWidths[1];
        doc.text(item.unit || 'PCS', xPos, yPos);
        xPos += colWidths[2];
        doc.text(String(item.openingStock || 0), xPos, yPos);
        xPos += colWidths[3];
        doc.text((item.rate || 0).toFixed(2), xPos, yPos);
        xPos += colWidths[4];
        doc.text(value.toFixed(2), xPos, yPos);
        
        yPos += 7;
    });
    
    doc.save('Stock-Report.pdf');
    closeEmailModal();
}

// Generate Outstanding Report PDF
function generateOutstandingReportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text('Outstanding Report', 105, 20, { align: 'center' });
    
    let yPos = 35;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    
    const headers = ['Party Name', 'Total Bills', 'Paid', 'Outstanding'];
    const colWidths = [70, 35, 35, 40];
    let xPos = 10;
    
    headers.forEach((header, i) => {
        doc.text(header, xPos, yPos);
        xPos += colWidths[i];
    });
    
    yPos += 8;
    doc.setFont('helvetica', 'normal');
    
    allParties.forEach(party => {
        let totalBills = 0;
        let totalPaid = 0;
        
        allBills.forEach(bill => {
            if (bill.partyId === party.id && bill.type === 'sale') {
                totalBills += bill.grandTotal || 0;
            }
        });
        
        allPayments.forEach(payment => {
            if (payment.partyId === party.id) {
                totalPaid += payment.amount || 0;
            }
        });
        
        const outstanding = totalBills - totalPaid;
        
        xPos = 10;
        doc.text(party.name || '', xPos, yPos);
        xPos += colWidths[0];
        doc.text(totalBills.toFixed(2), xPos, yPos);
        xPos += colWidths[1];
        doc.text(totalPaid.toFixed(2), xPos, yPos);
        xPos += colWidths[2];
        doc.text(outstanding.toFixed(2), xPos, yPos);
        
        yPos += 7;
    });
    
    doc.save('Outstanding-Report.pdf');
    closeEmailModal();
}

function searchBills() {
    const search = document.getElementById('billSearch').value.toLowerCase();
    const filtered = allBills.filter(bill => 
        bill.billNumber.toLowerCase().includes(search) || 
        (bill.partyName && bill.partyName.toLowerCase().includes(search))
    );
    
    let html = '';
    filtered.forEach(bill => {
        html += `
            <tr>
                <td>${bill.billNumber}</td>
                <td>${bill.date}</td>
                <td>${bill.partyName}</td>
                <td><span class="badge ${bill.type === 'sale' ? 'badge-success' : 'badge-info'}">${bill.type.toUpperCase()}</span></td>
                <td>${getGSTTypeLabel(bill.gstType)}</td>
                <td>₹${bill.grandTotal.toFixed(2)}</td>
                <td>
                    <button class="action-btn edit-btn-small" onclick="showBillModal('${bill.type}', '${bill.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn-small" onclick="deleteBill('${bill.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="action-btn view-btn-small" onclick="generatePDFFromBill('${bill.id}')">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    document.getElementById('allBillsList').innerHTML = html || '<tr><td colspan="7" style="text-align:center">No bills found</td></tr>';
}

function viewBillDetails(billId) {
    const bill = allBills.find(b => b.id === billId);
    if (bill) {
        let itemsList = '\n';
        bill.items.forEach(item => {
            itemsList += `${item.name} - ${item.quantity} x ₹${item.rate.toFixed(2)} = ₹${(item.quantity * item.rate).toFixed(2)}\n`;
        });
        
        alert(`Bill Details:
------------------------
Bill No: ${bill.billNumber}
Date: ${bill.date}
Party: ${bill.partyName}
Type: ${bill.type.toUpperCase()}
GST Type: ${getGSTTypeLabel(bill.gstType)}
------------------------
${itemsList}
------------------------
Subtotal: ₹${bill.subtotal.toFixed(2)}
${bill.gstType === 'interstate' ? 
  `IGST: ₹${(bill.igst || 0).toFixed(2)}` : 
  `CGST: ₹${(bill.cgst || 0).toFixed(2)}\nSGST: ₹${(bill.sgst || 0).toFixed(2)}`}
Grand Total: ₹${bill.grandTotal.toFixed(2)}
------------------------`);
    }
}

function generatePDFFromBill(billId) {
    const bill = allBills.find(b => b.id === billId);
    if (!bill) {
        alert('Bill not found! Please refresh the page.');
        return;
    }
    
    console.log('Generating PDF for bill:', bill.billNumber, 'Type:', bill.type);
    
    cartItems = bill.items;
    currentGSTType = bill.gstType || 'intrastate';
    currentBillType = bill.type || 'sale'; // Store bill type for PDF
    
    // Get party details from allParties
    const party = allParties.find(p => p.id === bill.partyId);
    
    // Update display
    document.getElementById('billNumber').value = bill.billNumber;
    document.getElementById('billDate').value = bill.date;
    
    document.getElementById('billPoNo').value = bill.poNo || '';
    document.getElementById('billEway').value = bill.ewayBill || '';
    document.getElementById('billVehicle').value = bill.vehicleNo || '';
    document.getElementById('billTransport').value = bill.transport || '';
    document.getElementById('billDestination').value = bill.destination || '';
    
    // Set party in dropdown if available
    const partySelect = document.getElementById('partySelect');
    if (partySelect) {
        partySelect.value = bill.partyId;
    }
    
    // Store bill tax info for PDF
    window.currentBillSubtotal = bill.subtotal || 0;
    window.currentBillCGST = bill.cgst || 0;
    window.currentBillSGST = bill.sgst || 0;
    window.currentBillIGST = bill.igst || 0;
    window.currentBillGrandTotal = bill.grandTotal || 0;
    window.currentBillType = bill.type || 'sale';
    
    document.getElementById('subtotal').innerText = (bill.subtotal || 0).toFixed(2);
    document.getElementById('grandTotal').innerText = (bill.grandTotal || 0).toFixed(2);
    document.getElementById('amountInWords').innerText = numberToWords(bill.grandTotal) + ' Only';
    
    // Store party info for PDF generation
    window.currentBillPartyName = bill.partyName || (party ? party.name : '');
    window.currentBillParty = party;
    
    // Generate PDF
    try {
        generatePDF();
    } catch (e) {
        console.error('PDF Generation Error:', e);
        alert('Error generating PDF: ' + e.message);
    }
    
    cartItems = [];
    window.currentBillPartyName = '';
    window.currentBillParty = null;
    window.currentBillSubtotal = undefined;
    window.currentBillCGST = undefined;
    window.currentBillSGST = undefined;
    window.currentBillIGST = undefined;
    window.currentBillGrandTotal = undefined;
    window.currentBillType = null;
}


// ==================== ENHANCED REPORTS FUNCTIONS ====================

// QR Code Generation for Invoice
function generateQRCode(invoiceData) {
    const qrData = JSON.stringify({
        invoiceNo: invoiceData.billNumber,
        date: invoiceData.date,
        party: invoiceData.partyName,
        amount: invoiceData.grandTotal,
        gstType: invoiceData.gstType
    });
    
    const canvas = document.createElement('canvas');
    QRCode.toCanvas(canvas, qrData, { width: 200 }, function(error) {
        if (error) {
            console.error(error);
            return;
        }
        const link = document.createElement('a');
        link.download = 'QR-' + invoiceData.billNumber + '.png';
        link.href = canvas.toDataURL();
        link.click();
    });
}

// Print current report
function printCurrentReport() {
    window.print();
}

// Apply quick date filter
function applyQuickFilter() {
    const filter = document.getElementById('reportQuickFilter').value;
    const today = new Date();
    let fromDate = new Date();
    let toDate = new Date();
    
    switch(filter) {
        case 'today':
            fromDate = today;
            toDate = today;
            break;
        case 'week':
            fromDate.setDate(today.getDate() - 7);
            break;
        case 'month':
            fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
            break;
        case 'quarter':
            const quarter = Math.floor(today.getMonth() / 3);
            fromDate = new Date(today.getFullYear(), quarter * 3, 1);
            break;
        case 'year':
            fromDate = new Date(today.getFullYear(), 0, 1);
            break;
    }
    
    document.getElementById('reportFromDate').value = fromDate.toISOString().split('T')[0];
    document.getElementById('reportToDate').value = toDate.toISOString().split('T')[0];
    updateReportData();
}

// ==================== BANKING & CONTRA VOUCHER MODULE ====================
function showBankingModal() {
    document.getElementById('bankingModal').style.display = 'flex';
    showBankingTab('dashboard');
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('contraDate').value = today;
    calculateDashboardBalances(); // Refresh balances immediately
}

function closeBankingModal() {
    document.getElementById('bankingModal').style.display = 'none';
}

function showBankingTab(tab) {
    document.getElementById('bankingDashboardTab').style.display = tab === 'dashboard' ? 'block' : 'none';
    document.getElementById('bankingContraTab').style.display = tab === 'contra' ? 'block' : 'none';
    document.getElementById('bankingHistoryTab').style.display = tab === 'history' ? 'block' : 'none';
    
    const tabs = document.querySelectorAll('#bankingModal .tab');
    tabs.forEach(t => t.classList.remove('active'));
    
    if (tab === 'dashboard') tabs[0].classList.add('active');
    else if (tab === 'contra') tabs[1].classList.add('active');
    else if (tab === 'history') {
        tabs[2].classList.add('active');
        displayContraHistory();
    }
}

function saveContraEntry() {
    const date = document.getElementById('contraDate').value;
    const type = document.getElementById('contraType').value;
    const amount = parseFloat(document.getElementById('contraAmount').value) || 0;
    const ref = document.getElementById('contraRef').value;
    const remarks = document.getElementById('contraRemarks').value;
    
    if (!date || amount <= 0) {
        alert('Please enter a valid date and amount greater than 0.');
        return;
    }
    
    const entry = {
        date: date,
        type: type,
        amount: amount,
        reference: ref,
        remarks: remarks,
        timestamp: Date.now()
    };
    
    let debitAccount = type === 'deposit' ? 'Bank A/c' : 'Cash A/c';
    let creditAccount = type === 'deposit' ? 'Cash A/c' : 'Bank A/c';
    
    const journalEntry = {
        type: 'contra',
        date: date,
        entryNo: 'CON/' + new Date().getFullYear() + '/' + Math.floor(Math.random() * 10000),
        debitAccount: debitAccount,
        creditAccount: creditAccount,
        debitAmount: amount,
        creditAmount: amount,
        explanation: remarks || `Contra ${type}`,
        timestamp: Date.now()
    };
    
    db.ref('users/' + currentUser.uid + '/contraEntries').push().set(entry)
        .then(() => db.ref('users/' + currentUser.uid + '/journalEntries').push().set(journalEntry))
        .then(() => {
            alert('Contra entry saved successfully!');
            document.getElementById('contraAmount').value = '';
            document.getElementById('contraRef').value = '';
            document.getElementById('contraRemarks').value = '';
            showBankingTab('dashboard');
        }).catch(err => alert('Error: ' + err.message));
}

function displayContraHistory() {
    let html = '';
    const sortedEntries = [...allContraEntries].sort((a, b) => b.timestamp - a.timestamp);
    
    sortedEntries.forEach(entry => {
        const typeBadge = entry.type === 'deposit' ? '<span class="badge badge-success">Deposit (To Bank)</span>' : '<span class="badge badge-warning">Withdrawal (To Cash)</span>';
        html += `<tr><td>${entry.date}</td><td>CON-${entry.timestamp.toString().slice(-6)}</td><td>${typeBadge}</td><td style="font-weight: bold;">₹${entry.amount.toFixed(2)}</td><td>${entry.reference || '-'}</td><td><button class="action-btn delete-btn-small" onclick="deleteContraEntry('${entry.id}')"><i class="fas fa-trash"></i></button></td></tr>`;
    });
    document.getElementById('contraHistoryBody').innerHTML = html || '<tr><td colspan="6" style="text-align:center">No contra entries found</td></tr>';
}

function deleteContraEntry(id) {
    if (confirm('Are you sure you want to delete this contra entry?')) {
        db.ref('users/' + currentUser.uid + '/contraEntries/' + id).remove()
            .then(() => { alert('Entry deleted successfully'); displayContraHistory(); })
            .catch(err => alert('Error: ' + err.message));
    }
}

// Update all report data based on date filter
function updateReportData() {
    const fromDate = document.getElementById('reportFromDate').value;
    const toDate = document.getElementById('reportToDate').value;
    
    document.getElementById('gstFromDate').value = fromDate;
    document.getElementById('gstToDate').value = toDate;
    generateGSTReport();
}

// Dashboard Charts
let salesChartInstance = null;
let partyChartInstance = null;

function generateDashboardCharts() {
    const fromDate = document.getElementById('reportFromDate')?.value || '';
    const toDate = document.getElementById('reportToDate')?.value || '';
    
    let totalSales = 0;
    let totalPurchases = 0;
    let partySales = {};
    let itemSales = {};
    
    allBills.forEach(bill => {
        if (bill.date >= fromDate && bill.date <= toDate) {
            if (bill.type === 'sale') {
                totalSales += bill.grandTotal || 0;
                if (!partySales[bill.partyName]) partySales[bill.partyName] = 0;
                partySales[bill.partyName] += bill.grandTotal || 0;
                
                if (bill.items) {
                    bill.items.forEach(item => {
                        if (!itemSales[item.name]) itemSales[item.name] = 0;
                        itemSales[item.name] += (item.quantity * item.rate);
                    });
                }
            } else if (bill.type === 'purchase') {
                totalPurchases += bill.grandTotal || 0;
            }
        }
    });
    
    const netProfit = totalSales - totalPurchases;
    
    // Update stat cards if they exist
    const dashSales = document.getElementById('dashTotalSales');
    if (dashSales) dashSales.innerText = '₹' + totalSales.toLocaleString();
    
    const dashPurchases = document.getElementById('dashTotalPurchases');
    if (dashPurchases) dashPurchases.innerText = '₹' + totalPurchases.toLocaleString();
    
    const dashProfit = document.getElementById('dashNetProfit');
    if (dashProfit) dashProfit.innerText = '₹' + netProfit.toLocaleString();
}

// Download QR Code for Bill
function downloadQRCode() {
    const billNumber = document.getElementById('billNumber').value;
    if (!billNumber) {
        alert('Please enter invoice number first');
        return;
    }
    
    const grandTotal = document.getElementById('grandTotal')?.innerText || '0';
    const date = document.getElementById('billDate').value || '';
    const qrData = `Invoice: ${billNumber}\nDate: ${date}\nAmount: ₹${grandTotal}`;
    
    const canvas = document.createElement('canvas');
    QRCode.toCanvas(canvas, qrData, { width: 200 }, function(error) {
        if (error) {
            console.error(error);
            alert('Error generating QR code');
            return;
        }
        const link = document.createElement('a');
        link.download = 'QR-' + billNumber + '.png';
        link.href = canvas.toDataURL();
        link.click();
    });
}

// Toggle Dark/Light Mode
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
    
    const btn = document.querySelector('.dark-mode-btn');
    if (btn) {
        btn.innerHTML = isDark 
            ? '<i class="fas fa-sun"></i> Light Mode' 
            : '<i class="fas fa-moon"></i> Dark Mode';
    }
}

// Load dark mode preference on startup
function loadDarkMode() {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'enabled') {
        document.body.classList.add('dark-mode');
        const btn = document.querySelector('.dark-mode-btn');
        if (btn) btn.innerHTML = '<i class="fas fa-sun"></i> Light Mode';
    }
}

// Create Payment from Party Ledger
function createPaymentFromLedger(partyId, partyName) {
    closeReportsModal();
    
    setTimeout(() => {
        showPaymentModal(partyId, partyName);
        alert(`Payment Entry for: ${partyName}\n\nPlease enter the payment amount and details.`);
    }, 300);
}

// Create Receipt from Party Ledger
function createReceiptFromLedger(partyId, partyName) {
    closeReportsModal();
    
    setTimeout(() => {
        showReceiptModal();
        
        const partySelect = document.getElementById('receiptFromParty');
        if (partySelect) {
            partySelect.value = partyId;
            updateReceiptPartyInfo();
        }
        
        alert(`Receipt Entry for: ${partyName}\n\nPlease enter the receipt amount and details.`);
    }, 300);
}

// Update Receipt Party Info
function updateReceiptPartyInfo() {
    const partyId = document.getElementById('receiptFromParty').value;
    const partyInfoDiv = document.getElementById('receiptPartyInfo');
    const balanceInfoDiv = document.getElementById('receiptBalanceInfo');
    const party = allParties.find(p => p.id === partyId);
    
    if (party && partyId) {
        let totalBills = 0;
        let totalPaid = 0;
        
        allBills.forEach(bill => {
            if (bill.partyId === partyId && bill.type === 'sale') {
                totalBills += bill.grandTotal || 0;
            }
        });
        
        allPayments.forEach(payment => {
            if (payment.partyId === partyId) {
                totalPaid += payment.amount || 0;
            }
        });
        
        allReceipts.forEach(receipt => {
            if (receipt.partyId === partyId) {
                totalPaid += receipt.amount || 0;
            }
        });
        
        const outstanding = totalBills - totalPaid;
        
        document.getElementById('receiptReceivableAmt').innerText = '₹' + Math.abs(outstanding).toFixed(2);
        document.getElementById('receiptCreditAccount').innerText = party.name + ' A/c';
        
        if (totalBills > 0 && balanceInfoDiv) {
            balanceInfoDiv.style.display = 'block';
            document.getElementById('receiptBillAmt').innerText = '₹' + totalBills.toFixed(2);
            document.getElementById('receiptPaidAmt').innerText = '₹' + totalPaid.toFixed(2);
            
            const balanceDue = Math.max(0, totalBills - totalPaid);
            document.getElementById('receiptBalanceDue').innerText = '₹' + balanceDue.toFixed(2);
        } else if (balanceInfoDiv) {
            balanceInfoDiv.style.display = 'none';
        }
        
        if (outstanding > 0) {
            document.getElementById('receiptReceivableAmt').style.color = '#4caf50';
            if (partyInfoDiv) partyInfoDiv.style.background = '#e8f5e9';
        } else {
            document.getElementById('receiptReceivableAmt').style.color = '#f44336';
            if (partyInfoDiv) partyInfoDiv.style.background = '#fff3e0';
        }
        
        if (partyInfoDiv) partyInfoDiv.style.display = 'block';
        
        if (Math.abs(outstanding) > 0) {
            document.getElementById('receiptAmount').value = Math.abs(outstanding).toFixed(2);
            document.getElementById('receiptDebitPreview').innerText = Math.abs(outstanding).toFixed(2);
            document.getElementById('receiptCreditPreview').innerText = Math.abs(outstanding).toFixed(2);
        }
    } else {
        if (partyInfoDiv) partyInfoDiv.style.display = 'none';
        if (balanceInfoDiv) balanceInfoDiv.style.display = 'none';
    }
}

// ====== Company Settings Modal - Premium ERP Functions ======

// Map Firebase keys to HTML IDs
const companyFieldMapping = {
    gstin: 'companyGSTIN', name: 'companyName', pan: 'companyPAN', businessType: 'companyBusinessType',
    address1: 'companyAddress1', address2: 'companyAddress2', city: 'companyCity', state: 'companyState',
    stateCode: 'companyStateCode', pincode: 'companyPincode', contact: 'companyContact', whatsapp: 'companyWhatsapp',
    email: 'companyEmail', website: 'companyWebsite', bankName: 'companyBankName', accountNo: 'companyAccountNo',
    ifscCode: 'companyIFSC', branchName: 'companyBranch', upi: 'companyUPI', accountType: 'companyAccountType',
    terms: 'companyTerms', invoicePrefix: 'companyInvoicePrefix', invoiceNote: 'companyInvoiceNote'
};

// Populate form fields from currentCompany
function populateCompanyForm() {
    if (!currentCompany) return;
    for (const [key, id] of Object.entries(companyFieldMapping)) {
        const el = document.getElementById(id);
        if (el) el.value = currentCompany[key] || '';
    }
}

// Show Company Modal
function showCompanyModal() {
    populateCompanyForm();
    
    const overlay = document.getElementById('companyModal');
    if (overlay) {
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    // Reset button state
    const btn = document.getElementById('companySaveBtn');
    if (btn) btn.disabled = false;
    const btnText = document.getElementById('companySaveText');
    if (btnText) btnText.textContent = 'Save Changes';
    const spinner = document.getElementById('companySpinner');
    if (spinner) spinner.style.display = 'none';
}

// Close Company Modal
function closeCompanyModal() {
    const overlay = document.getElementById('companyModal');
    if (overlay) {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Reset company form to default values
function resetCompanyForm() {
    const defaults = {
        gstin: '27AXXXX54521X1Z', name: 'Lakshay Trading Company', pan: '', businessType: 'private',
        address1: 'Kathgarh Road, Ismailabad', address2: 'Kurukshetra Haryana', city: 'Kurukshetra',
        state: 'Haryana', stateCode: '06', pincode: '', contact: '7056836166', whatsapp: '+917056836166',
        email: 'Lakshay@123', website: '', bankName: '', accountNo: '', ifscCode: '', branchName: '',
        upi: '', accountType: 'current', terms: '', invoicePrefix: 'INV-', invoiceNote: ''
    };
    
    for (const [key, id] of Object.entries(companyFieldMapping)) {
        const el = document.getElementById(id);
        if (el) el.value = defaults[key] || '';
    }
}

// Save Company Settings
function saveCompany() {
    const btn = document.getElementById('companySaveBtn');
    const spinner = document.getElementById('companySpinner');
    const btnText = document.getElementById('companySaveText');
    
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Saving...';
    if (spinner) spinner.style.display = 'inline-block';

    const company = { updatedAt: Date.now() };
    for (const [key, id] of Object.entries(companyFieldMapping)) {
        const el = document.getElementById(id);
        company[key] = el ? el.value : '';
    }
    
    if (!company.name || !company.state || !company.contact || !company.email) {
        setTimeout(() => {
            if (btn) btn.disabled = false;
            if (btnText) btnText.textContent = 'Save Changes';
            if (spinner) spinner.style.display = 'none';
            alert('Please fill all required fields (Name, State, Contact, Email)');
        }, 500);
        return;
    }

    if (!currentUser) return;

    db.ref('users/' + currentUser.uid + '/company').set(company)
        .then(() => {
            currentCompany = company;
            displayCompany(company);
            
            const nameDisplay = document.getElementById('companyNameDisplay');
            if (nameDisplay) nameDisplay.textContent = company.name;
            const cardName = document.getElementById('companyCardName');
            if (cardName) cardName.textContent = company.name || 'Company Profile';
            
            updateCompanyDetails();
            
            if (btn) btn.disabled = false;
            if (btnText) btnText.textContent = '✓ Saved';
            if (spinner) spinner.style.display = 'none';
            
            setTimeout(() => {
                closeCompanyModal();
                if (btnText) btnText.textContent = 'Save Changes';
            }, 800);
        })
        .catch(error => {
            if (btn) btn.disabled = false;
            if (btnText) btnText.textContent = 'Save Changes';
            if (spinner) spinner.style.display = 'none';
            alert('Error: ' + error.message);
        });
}

// Update company details grid on dashboard
function updateCompanyDetails() {
    const container = document.getElementById('companyDetails');
    if (!container || !currentCompany) return;
    
    const info = [
        { icon: 'fa-id-card', label: 'GSTIN', value: currentCompany.gstin || 'Not Set' },
        { icon: 'fa-building', label: 'Company', value: currentCompany.name || 'Not Set' },
        { icon: 'fa-credit-card', label: 'PAN', value: currentCompany.pan || 'Not Set' },
        { icon: 'fa-map-marker-alt', label: 'Address', value: `${currentCompany.address1 || ''}, ${currentCompany.city || ''}` },
        { icon: 'fa-map', label: 'State', value: currentCompany.state || 'Not Set' },
        { icon: 'fa-phone', label: 'Contact', value: currentCompany.contact || 'Not Set' },
        { icon: 'fa-envelope', label: 'Email', value: currentCompany.email || 'Not Set' },
        { icon: 'fa-university', label: 'Bank', value: currentCompany.bankName || 'Not Set' }
    ];
    
    container.innerHTML = info.map(item => `
        <div class="info-box">
            <div class="info-icon"><i class="fas ${item.icon}"></i></div>
            <div class="info-content">
                <div class="info-label">${item.label}</div>
                <div class="info-value">${item.value}</div>
            </div>
        </div>
    `).join('');
}

// Toggle company card collapsed state
function toggleCompanyCard() {
    const card = document.getElementById('companyCard');
    const icon = card.querySelector('.toggle-icon');
    if(card) card.classList.toggle('collapsed');
    if(icon) icon.classList.toggle('collapsed');
}

// Show company edit mode (toggling inline edit form)
function showCompanyEditMode() {
    const viewMode = document.getElementById('companyViewMode');
    const editForm = document.getElementById('companyEditForm');
    if (viewMode) viewMode.classList.add('hidden');
    if (editForm) {
        editForm.classList.add('active');
        editForm.style.display = 'block';
    }
    
    if (!currentCompany) return;
    const inlineMapping = {
        gstin: 'editCompanyGSTIN', name: 'editCompanyName', address1: 'editCompanyAddress1',
        address2: 'editCompanyAddress2', contact: 'editCompanyContact', whatsapp: 'editCompanyWhatsapp',
        email: 'editCompanyEmail', state: 'editCompanyState', stateCode: 'editCompanyStateCode',
        pan: 'editCompanyPAN', bankName: 'editCompanyBankName', accountNo: 'editCompanyAccountNo',
        ifscCode: 'editCompanyIFSC', branchName: 'editCompanyBranch', upi: 'editCompanyUPI',
        terms: 'editCompanyTerms'
    };
    
    for (const [key, id] of Object.entries(inlineMapping)) {
        const el = document.getElementById(id);
        if (el) el.value = currentCompany[key] || '';
    }
}

// Save Company Inline (from dashboard card edit)
function saveCompanyInline() {
    if (!currentCompany) return;
    
    const inlineMapping = {
        gstin: 'editCompanyGSTIN', name: 'editCompanyName', address1: 'editCompanyAddress1',
        address2: 'editCompanyAddress2', contact: 'editCompanyContact', whatsapp: 'editCompanyWhatsapp',
        email: 'editCompanyEmail', state: 'editCompanyState', stateCode: 'editCompanyStateCode',
        pan: 'editCompanyPAN', bankName: 'editCompanyBankName', accountNo: 'editCompanyAccountNo',
        ifscCode: 'editCompanyIFSC', branchName: 'editCompanyBranch', upi: 'editCompanyUPI',
        terms: 'editCompanyTerms'
    };
    
    const updatedCompany = { ...currentCompany, updatedAt: Date.now() };
    for (const [key, id] of Object.entries(inlineMapping)) {
        const el = document.getElementById(id);
        if (el) updatedCompany[key] = el.value;
    }
    
    if (!currentUser) return;
    
    db.ref('users/' + currentUser.uid + '/company').set(updatedCompany).then(() => {
        currentCompany = updatedCompany;
        
        const nameDisplay = document.getElementById('companyNameDisplay');
        if (nameDisplay) nameDisplay.textContent = currentCompany.name;
        
        const cardName = document.getElementById('companyCardName');
        if (cardName) cardName.textContent = currentCompany.name || 'Company Profile';
        
        updateCompanyDetails();
        cancelCompanyEdit();
        displayCompany(currentCompany);
    }).catch(err => {
        alert('Error saving company: ' + err.message);
    });
}

// Cancel Company Edit
function cancelCompanyEdit() {
    const viewMode = document.getElementById('companyViewMode');
    const editForm = document.getElementById('companyEditForm');
    if (viewMode) viewMode.classList.remove('hidden');
    if (editForm) {
        editForm.classList.remove('active');
        editForm.style.display = 'none';
    }
}

// Close modal on overlay click (for company modal)
document.addEventListener('click', function(event) {
    const overlay = document.getElementById('companyModal');
    if (overlay && event.target === overlay) {
        closeCompanyModal();
    }
    // Close other modals on overlay click
    if (event.target.classList.contains('modal') || event.target.classList.contains('modal-overlay')) {
        event.target.style.display = 'none';
    }
    if(event.target.classList.contains('forgot-modal')) {
        event.target.style.display = 'none';
    }
});

// Initialize company data on load - ensures previously saved data shows up
document.addEventListener('DOMContentLoaded', function() {
    if (typeof currentUser !== 'undefined' && currentUser) {
        loadUserData(currentUser.uid);
    }
});
