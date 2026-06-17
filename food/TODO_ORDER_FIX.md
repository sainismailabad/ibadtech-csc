# TODO_ORDER_FIX

## Goal
Make ordering work reliably (location-related failures), remove Wallet option for a more professional order portal, and ensure email authentication/verification is enforced.

## Plan (Step-by-step)
1. Identify where Wallet UI + wallet logic exists.
   - Remove wallet UI block from `index.html` checkout modal.
   - Remove wallet fields/discount calculation functions and any wallet DB writes from `customer.js`.

2. Fix location gating causing orders to fail.
   - Make order placement work even if user didn’t press “Get Current Location” as long as saved last location exists.
   - If still outside delivery radius, show clear message.
   - Prevent submit button from being permanently disabled due to geolocation errors; provide fallback.

3. Enforce email authentication/verification.
   - Update `auth.js` and `customer.js` so `placeOrder()` checks email is verified before ordering.
   - Re-enable email verification status usage (instead of `isEmailVerified() { return true; }`).

4. Run quick static checks.
   - Ensure there are no references to removed wallet DOM ids (like `use-wallet`, `wallet-balance`, etc.).
   - Validate scripts still load and checkout can be submitted.

5. Manual test checklist.
   - Login as customer.
   - Checkout → place order inside radius.
   - Checkout without re-enabling location → should still work using saved location.
   - Checkout with unverified email → should block with message.

