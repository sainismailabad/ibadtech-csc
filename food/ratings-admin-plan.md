# Admin Ratings/Reviews Moderation - Implementation Plan

## Goal
Admin panel (admin.html/admin.js) me aisa section add karna jahan admin **restaurantRatings** aur **productRatings** dekh sake, pending/reported items ko filter karke hide/approve kar sake.

## Assumptions
- Ratings nodes Firebase me exist honge:
  - `restaurantRatings/{restaurantId}/{ratingId}`
  - `productRatings/{productId}/{ratingId}`
- Each rating has at least:
  - `userId`, `userName`, `stars`, `comment`, `createdAt`
  - moderation flags: `status` in ['pending','approved','hidden'] (or boolean `hidden`)
  - optional `reported` boolean and `reportReason`.

## Steps
1) `admin.html`
   - Sidebar me new nav-link: **Ratings & Reviews** -> page id `ratings-page`
   - Main content me `div id="ratings-page"` with 2 tables:
     - Restaurant ratings
     - Product ratings

2) `admin.js`
   - Add `loadRatingsModeration()` to fetch both nodes.
   - Render tables with columns:
     - User, Target (restaurant/product), Stars, Comment, CreatedAt, Status, Actions
   - Add action handlers:
     - `Admin.approveRestaurantRating(ratingId)` / `Admin.hideRestaurantRating(ratingId)`
     - `Admin.approveProductRating(ratingId)` / `Admin.hideProductRating(ratingId)`
   - Add filter dropdowns (optional but simple): pending/approved/hidden.

3) Update UI click handlers.

4) Manual test
   - Firebase me sample entries add kar ke verify moderation buttons update status.

## Notes
- Agar rating nodes ke schema me `status` nahi hai, we will add fallback: treat missing as `approved`.

