# TODO

## Products-only index (Zomato like)
- [ ] 1) Update `index.html` to replace Restaurants section with Products section (container + titles).
- [ ] 2) Update `customer.js` to stop `loadRestaurantsPage()` on index and instead render products.
- [x] 3) Implement `Foodie.loadNearbyProductsIndex()`:

- [x] Fetch user location (already implemented) and store in hidden inputs / localStorage.

  - [ ] Fetch restaurant + product data.
  - [ ] Compute distance using existing `calculateDistance` and `MAX_DELIVERY_RADIUS_KM`.
  - [ ] Render product cards with full details and proper stock/add-to-cart UI.
  - [ ] Fallback behavior when location not available.
- [x] 4) Ensure search works on product cards (items-first) for index.


- [ ] 5) Quick manual test: open `index.html`, verify only products render, search by item works, add-to-cart works.

