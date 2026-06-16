# TODO - Perfect Order Offline + Notifications + Delivery Lock

## Step 1: Inventory / locate order placement code
- [ ] Read `restaurant-detail.html`, `restaurant.html`, `cart.html`, `index.html`, `shops.html`, `customer.js` to find where cart/order is created
- [ ] Identify where `orders/` node is written
- [ ] Identify how restaurant is selected / sellerId attached

## Step 2: Seller offline => block new orders
- [ ] Update UI in restaurant pages (badge + disable CTA + modal)
- [ ] Update order creation: if `restaurants/{sellerId}/isOnline=false` then block write and show message

## Step 3: Customer notifications (sound + vibrate)
- [ ] Update customer notification listener (likely in `customer-orders.html` and/or other customer pages)
- [ ] Add vibrate + short beep when new notification arrives

## Step 4: Delivery accept locking (single boy per order)
- [ ] Modify `delivery.html` `acceptOrder()` to use `transaction` / conditional write so only one boy can set `deliveryPartnerId`
- [ ] Ensure UI buttons appear only for the accepting boy

## Step 5: Delivery delivered/history uniqueness
- [ ] Modify `markDelivered()` to avoid duplicate history entries if clicked twice

## Step 6: Delivery profile contact + restaurant name display
- [ ] Ensure `delivery-profile.html` shows restaurant name for each history item (order.restaurantName)
- [ ] Add Contact section/button to call/chat delivery boy (phone/UPI/email if present)

## Step 7: Seller side vibration
- [ ] Add `navigator.vibrate()` on new order notifications in `seller.js`

## Step 8: Manual test checklist
- [ ] Restaurant online: can place order, delivery assignment works
- [ ] Restaurant offline: user sees offline message and cannot place order
- [ ] Customer hears sound + vibrate on notifications
- [ ] Two delivery boys try to accept same order: only one succeeds
- [ ] Delivered twice: history only one entry; earnings update only once

