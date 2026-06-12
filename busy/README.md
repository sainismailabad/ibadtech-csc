# Ibad Accounts ERP - Professional Accounting Software

A complete cloud-based accounting and business management software built with HTML, CSS, JavaScript, and Firebase. Designed as a professional alternative to BUSY and Tally for small and medium enterprises.

## Features

### Core Modules
- **Dashboard** - Real-time business overview with charts and stats
- **Company Management** - Multi-company support, GST configuration, invoice templates
- **Party Management** - Customer and vendor database with balances
- **Item/Stock Management** - Inventory tracking with HSN codes, stock alerts
- **Sales Module** - Sales invoices, quotations, delivery challans with GST
- **Purchase Module** - Purchase entries with double-entry accounting
- **Payment & Receipt** - Double-entry payment vouchers (Payment Out / Receipt In)
- **Journal Vouchers** - Manual journal entries with debit/credit preview
- **Reports Center** - GST reports, party ledger, outstanding reports, P&L, sales analysis
- **Banking Module** - Contra entries, cash/bank transfers, transaction history
- **PDF Export** - Professional invoice PDFs with GST breakdown

### Accounting Features
- Double-entry bookkeeping
- GST calculation (CGST/SGST/IGST)
- Party ledger with running balance
- Outstanding receivables/payables tracking
- Aging analysis
- Payment history tracking
- Journal entries

### Technical Stack
- **Frontend**: HTML5, CSS3, JavaScript ES6
- **Styling**: Bootstrap 5, custom CSS, responsive design
- **Backend**: Firebase Realtime Database
- **Authentication**: Firebase Auth (Email/Password)
- **PDF**: jsPDF with autoTable plugin
- **QR Codes**: QRCode.js
- **Barcodes**: JsBarcode

## Installation & Setup

### Step 1: Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable the following services:
   - **Realtime Database**: Build > Realtime Database > Create Database > Start in Test Mode
   - **Authentication**: Build > Authentication > Sign-in method > Enable Email/Password

### Step 2: Configure Firebase

Update `firebase-config.js` with your project credentials:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### Step 3: Security Rules (Optional but Recommended)

In Firebase Console > Realtime Database > Rules:

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

### Step 4: Run the Application

1. Open `index.html` in a web browser
2. Create your first user account (Sign Up)
3. Log in and start using the ERP

## File Structure

```
erm/
├── index.html          # Main HTML file with all modals and UI
├── styles.css          # Complete styling (1876 lines)
├── script.js           # All JavaScript logic (4800+ lines)
├── firebase-config.js  # Firebase configuration
└── README.md           # This file
```

## Usage Guide

### Getting Started

1. **First Login**: Create a new account using the sign-up form
2. **Company Setup**: Go to sidebar > Company Setup to configure your company details
3. **Create Parties**: Go to Accounts/Ledgers to add customers and vendors
4. **Add Items**: Go to Item Master to add your products/services
5. **Create Bills**: Use Sales/Quotation to create invoices

### Creating a Sale Invoice

1. Click "Sales / Quotation" in sidebar
2. Select party from dropdown (or add new party)
3. Search and add items from the list
4. Set quantities, rates, and GST
5. Click "Save Bill" to create the invoice
6. Click "Download PDF" for printable invoice

### Recording a Payment (Payment Out)

1. Click "Payment Out" in sidebar (opens Payment Entry modal)
2. Select the supplier/party from dropdown
3. Enter payment amount, date, and mode
4. Click "Save Payment Entry"
5. Double-entry accounting is applied automatically

### Recording a Receipt (Receipt In)

1. Click "Receipt In" in sidebar
2. Select the customer/party from dropdown
3. Enter receipt amount, date, and mode
4. Click "Save Receipt Entry"
5. Party balance is updated automatically

### Viewing Reports

1. Click "Reports Center" in sidebar
2. Use tabs to switch between:
   - Dashboard (charts and summary)
   - GST Report (sales/purchase GST summary)
   - Sales Analysis (daily/monthly reports)
   - Party Ledger (detailed party transactions)
   - Stock Report (inventory summary)
   - Outstanding (receivables/payables)
   - Profit Analysis (P&L statement)

## Database Structure

```
users/{uid}/
├── company/          # Company details
├── parties/          # Customers and vendors
├── stockItems/       # Inventory items
├── bills/            # Sales and purchase invoices
├── payments/         # Payment records
├── receipts/         # Receipt records
├── journalEntries/   # Double-entry journal
├── contraEntries/    # Cash/bank transfers
├── partyPaymentHistory/
└── auditLogs/
```

## GST Support

- CGST/SGST for intrastate transactions
- IGST for interstate transactions
- GST calculation on invoices
- GSTR-1 and GSTR-3B reports (simplified)
- GST JSON export for portal filing

## User Roles

The application supports role-based access control:
- Super Admin
- Company Owner
- Accountant
- Salesman
- Store Manager
- Staff Users

## Browser Support

- Chrome (recommended)
- Firefox
- Edge
- Safari

## Notes

- This is a frontend-only application using Firebase Realtime Database
- No server-side code required
- Data is stored per-user in Firebase
- Test mode allows open access - secure with proper Firebase rules before production

## License

Proprietary - Ibad Tech

## Support

For support and customization, contact: +91 7056836166
