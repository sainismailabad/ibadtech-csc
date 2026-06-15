// ============================================
// IBAD FOODIE - Authentication Module
// With Email Verification & Notifications
// ============================================
class Auth {
    constructor() {
        this.currentUser = null;
        this.userRole = null;
        this.auth = null;
        this.notifications = [];
    }

    initFirebase() {
        if (!this.auth) this.auth = firebase.auth();
    }

    // Initialize auth state listener (idempotent)
    init() {
        this.initFirebase();
        if (this._initPromise) return this._initPromise;

        this._initPromise = new Promise((resolve) => {
            this.auth.onAuthStateChanged(async (user) => {
                if (user) {
                    this.currentUser = user;
                    try {
                        const snap = await db.ref('users/' + user.uid).once('value');
                        if (snap.exists()) {
                            this.userRole = snap.val().role || null;
                        } else {
                            this.userRole = null;
                        }
                    } catch (e) {
                        console.error('Auth error:', e);
                        this.userRole = null;
                    }
                } else {
                    this.currentUser = null;
                    this.userRole = null;
                }

                resolve({ user: this.currentUser, role: this.userRole });
            });
        });

        return this._initPromise;
    }

    // Login
    async login(email, password) {
        this.initFirebase();
        try {
            const result = await this.auth.signInWithEmailAndPassword(email, password);
            // Refresh user state (important after email verification)
            await result.user.reload();

            const snap = await db.ref('users/' + result.user.uid).once('value');
            this.userRole = snap.val()?.role || null;
            this.currentUser = result.user;
            
            // Removed email verification check completely
            return { success: true, role: this.userRole, user: result.user };
        } catch (error) {
            let msg = error.message;
            if (error.code === 'auth/user-not-found') msg = '❌ No account found with this email';
            else if (error.code === 'auth/wrong-password') msg = '❌ Incorrect password';
            else if (error.code === 'auth/invalid-email') msg = '❌ Invalid email format';
            else if (error.code === 'auth/too-many-requests') msg = '❌ Too many attempts. Try again later.';
            return { success: false, error: msg };
        }
    }

    // Register
    async register(email, password, role, sellerData = null) {
        this.initFirebase();
        try {
            const result = await this.auth.createUserWithEmailAndPassword(email, password);
            const uid = result.user.uid;
            
            // Save user
            const userData = {
                email: email,
                role: role,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                emailVerified: false
            };
            await db.ref('users/' + uid).set(userData);

            // If restaurateur, save restaurant
            if (role === 'seller' && sellerData && sellerData.shopName) {
                const slug = sellerData.shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                await db.ref('restaurants/' + uid).set({
                    name: sellerData.shopName,
                    logo: sellerData.logo || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150',
                    banner: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600',
                    cuisine: 'Multi-Cuisine',
                    deliveryTime: 30,
                    deliveryFee: sellerData.deliveryFee || 0,
                    rating: 4.0,
                    sellerId: uid,
                    category: sellerData.cuisine || 'Multi-Cuisine',
                    slug: slug,
                    address: sellerData.address || '',
                    phone: sellerData.phone || '',
                    description: sellerData.description || '',
                    offer: sellerData.offer || '',
                    active: true
                });
                await db.ref('sellers/' + uid).set({
                    sellerId: uid,
                    shopName: sellerData.shopName,
                    shopSlug: slug,
                    logo: sellerData.logo || 'https://via.placeholder.com/150'
                });
            }

            // Email verification disabled (requested)
            // try {
            //     await result.user.sendEmailVerification({
            //         url: window.location.origin + '/login.html',
            //         handleCodeInApp: false
            //     });
            //     this.addNotification(uid, 'Welcome to Ibad Foodie! Please verify your email to start ordering.', 'account');
            // } catch (e) {
            //     console.log('Email verification not sent:', e.message);
            // }


            this.userRole = role;
            this.currentUser = result.user;
            return { 
                success: true, 
                role: role, 
                user: result.user,
                message: role === 'seller' 
                    ? '🎉 Restaurant registered successfully!' 
                    : '🎉 Account created successfully!'
            };
        } catch (error) {
            let msg = error.message;
            if (error.code === 'auth/email-already-in-use') msg = '❌ This email is already registered';
            else if (error.code === 'auth/weak-password') msg = '❌ Password must be at least 6 characters';
            else if (error.code === 'auth/invalid-email') msg = '❌ Invalid email format';
            return { success: false, error: msg };
        }
    }

    // Send verification email
    async sendVerification() {
        this.initFirebase();
        if (this.currentUser && !this.currentUser.emailVerified) {
            try {
                await this.currentUser.sendEmailVerification();
                return { success: true, message: '✅ Verification email sent! Check your inbox.' };
            } catch (e) {
                return { success: false, error: e.message };
            }
        }
        return { success: false, error: 'Email already verified' };
    }

    // ====== NOTIFICATIONS SYSTEM ======
    addNotification(userId, message, type = 'order') {
        const ref = db.ref('notifications').push();
        ref.set({
            userId: userId,
            message: message,
            type: type,
            read: false,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    }

    async getNotifications(userId) {
        try {
            const snap = await db.ref('notifications')
                .orderByChild('userId')
                .equalTo(userId)
                .limitToLast(20)
                .once('value');
            const notifs = [];
            if (snap.exists()) {
                snap.forEach(c => notifs.push({ id: c.key, ...c.val() }));
            }
            return notifs.reverse();
        } catch (e) { return []; }
    }

    async markNotificationRead(notifId) {
        try { await db.ref('notifications/' + notifId).update({ read: true }); }
        catch (e) { console.error(e); }
    }

    // Logout
    async logout() {
        this.initFirebase();
        try {
            await this.auth.signOut();
            this.currentUser = null;
            this.userRole = null;
            window.location.href = 'login.html';
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

getRole() { return this.userRole; }
    isAuthenticated() { return !!this.currentUser; }

    isEmailVerified() {
        try {
            return !!(this.currentUser && this.currentUser.emailVerified);
        } catch (e) {
            return false;
        }
    }
}

// Global auth instance
const auth = new Auth();
