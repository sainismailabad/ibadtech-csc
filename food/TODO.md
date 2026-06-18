# TODO - Ibad Foodie updates

## Step 1: Seller side - Category + Product rating UX
- [x] Update `seller.html` product Category dropdown values to restaurant-related options.


## Step 2: Customer side - Restaurant rating + Product rating
- [ ] Add rating/review UI to `restaurant-detail.html`.
- [ ] Add rating/review UI to `product.html`.
- [ ] Implement rating submission + aggregation logic in `customer.js`.
- [ ] Ensure ratings nodes are written to Firebase (`restaurantRatings`, `productRatings`) and aggregates updated (`restaurants.rating`, `products.rating`).


## Step 3: Cart checkout - Split orders per restaurant
- [x] Refactor `Foodie.placeOrder()` in `customer.js` to group cart items by sellerId/restaurantId and create separate order(s). (Zomato/Swiggy style: separate orders per restaurant)
- [x] Apply delivery fee & coupon per restaurant group.
- [ ] Verify orders appear correctly in `customer-orders.html` and seller dashboards.


## Step 4: Manual verification
- [ ] Add items from 2 restaurants to cart and ensure 2 orders created.
- [ ] Rate a restaurant and product; verify avg updates and displays.

