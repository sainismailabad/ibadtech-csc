# Multi-Vendor E-Commerce Setup & Deployment Guide

## Project Configuration

**Firebase Project**: `ibadecomerce`
- API Key: `AIzaSyBubqyuu6OrPvxcPAOoy6_V20tSar4Bnos`
- Project ID: `ibadecomerce`
- Web App ID: `1:784111761552:web:9a04705daee23928048015`

## Setup Instructions

### 1. Deploy Firestore Security Rules

```bash
# Install Firebase CLI if not already
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firestore (select existing project)
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

### 2. Create Admin User

After deploying rules, create your first admin user:

1. Open `register.html` in browser
2. Register with email/password as any role
3. In Firebase Console > Firestore Database > users collection
4. Find your user document and change `role` field to `admin`

### 3. Run Locally with HTTPS (Required for Geolocation)

```bash
# Install serve globally
npm install -g serve

# Start HTTPS server
serve -S .

# Or use Firebase emulators
firebase emulators:start
```

### 4. Deploy to Firebase Hosting

```bash
firebase init hosting
# Select existing project
# Public directory: . (current directory)
# Configure as single-page app: No

firebase deploy --only hosting
```

## File Structure

```
├── index.html           # Customer product listing
├── shops.html           # Shop directory page
├── customer-orders.html # Customer order history
├── login.html           # Authentication page
├── register.html        # User registration
├── seller.html          # Seller dashboard
├── seller.js            # Seller business logic
├── admin.html           # Admin dashboard
├── admin.js             # Admin business logic
├── firebase-config.js   # Firebase initialization
├── auth.js              # Authentication module
├── styles.css           # Professional styling
├── firestore.rules      # Security rules
├── README.md            # This guide
└── GEOLOCATION.md       # Geolocation docs
```

## User Roles & Features

### Customer
- Browse all products or shop-specific products
- Place orders with geolocation capture
- Track delivery status on interactive map

### Seller
- Manage product inventory (CRUD)
- View and update order status
- Track customer delivery locations

### Admin
- View platform metrics (orders, sellers, customers, revenue)
- Manage all orders with filtering
- Approve/reject sellers

## Firestore Collections Schema

**users**: `{uid, email, role}`
**sellers**: `{sellerId, shopName, shopSlug, logo}`
**products**: `{name, price, stock, sellerId, shopName, shopSlug, image}`
**orders**: `{customerId, sellerId, productId, status, address, customerLat, customerLng, timestamp}`

## Testing Checklist

- [ ] Register as customer and place order
- [ ] Register as seller and add products
- [ ] Login as admin to view dashboard
- [ ] Test geolocation on checkout
- [ ] Verify order status workflow
- [ ] Check map rendering on all dashboards