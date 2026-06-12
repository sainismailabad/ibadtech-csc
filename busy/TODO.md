# TODO

- [x] Patch `script.js` to add missing core functions referenced by `index.html`:
  - [x] `getGSTTypeLabel(gstType)`
  - [x] `numberToWords(amount)`
  - [x] `generatePDF()` (and ensure `generatePDFFromBill(billId)` works)
  - [x] Purchase module stubs: `showPurchaseModal`, `closePurchaseModal`, `calculatePurchaseAmount`, `updatePurchasePreview`, `addPurchaseItem`, `savePurchaseEntry`, plus minimal helpers needed by the Purchase modal.
  - [x] `showReportsModal` and purchase modal setup functions.
- [x] Re-run a JS parse check for `script.js`.
- [x] Smoke test in browser by clicking:
  - [x] Reports → Party Ledger → Payment / Receipt buttons
  - [x] Purchase / GRN menu
  - [x] Download PDF / Download QR from a bill

