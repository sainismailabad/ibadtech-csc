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

    async login(email, password) {
        this.initFirebase();
        try {
            const result = await this.auth.signInWithEmailAndPassword(email, password);
            await result.user.reload();
            const snap = await db.ref('users/' + result.user.uid).once('value');
            this.userRole = snap.val()?.role || null;
            this.currentUser = result.user;
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

    async register(email, password, role, sellerData = null) {
        this.initFirebase();
        try {
            const result = await this.auth.createUserWithEmailAndPassword(email, password);
            const uid = result.user.uid;
            const userData = { email, role, createdAt: firebase.database.ServerValue.TIMESTAMP, emailVerified: false };
            await db.ref('users/' + uid).set(userData);

            if (role === 'seller' && sellerData && sellerData.shopName) {
                const slug = sellerData.shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                await db.ref('restaurants/' + uid).set({
                    name: sellerData.shopName,
                    logo: sellerData.logo || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150',
                    banner: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600',
                    cuisine: 'Multi-Cuisine', deliveryTime: 30,
                    deliveryFee: sellerData.deliveryFee || 0, rating: 4.0,
                    sellerId: uid, category: sellerData.cuisine || 'Multi-Cuisine',
                    slug, address: sellerData.address || '',
                    phone: sellerData.phone || '', description: sellerData.description || '',
                    offer: sellerData.offer || '', active: true
                });
                await db.ref('sellers/' + uid).set({ sellerId: uid, shopName: sellerData.shopName, shopSlug: slug, logo: sellerData.logo || 'https://via.placeholder.com/150' });
            }

            this.userRole = role;
            this.currentUser = result.user;
            return { success: true, role, user: result.user, message: role === 'seller' ? '🎉 Restaurant registered!' : '🎉 Account created!' };
        } catch (error) {
            let msg = error.message;
            if (error.code === 'auth/email-already-in-use') msg = '❌ This email is already registered';
            else if (error.code === 'auth/weak-password') msg = '❌ Password must be at least 6 characters';
            else if (error.code === 'auth/invalid-email') msg = '❌ Invalid email format';
            return { success: false, error: msg };
        }
    }

    async sendVerification() {
        this.initFirebase();
        if (this.currentUser && !this.currentUser.emailVerified) {
            try { await this.currentUser.sendEmailVerification(); return { success: true, message: '✅ Verification email sent!' }; }
            catch (e) { return { success: false, error: e.message }; }
        }
        return { success: false, error: 'Email already verified' };
    }

    // ====== NOTIFICATION SOUND & VIBRATION ======
    playNotificationSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.3);
            setTimeout(() => {
                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                osc2.frequency.value = 1000;
                osc2.type = 'sine';
                gain2.gain.setValueAtTime(0.2, audioCtx.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
                osc2.start(audioCtx.currentTime);
                osc2.stop(audioCtx.currentTime + 0.2);
            }, 150);
        } catch (e) {
            try { const audioEl = document.getElementById('notification-sound'); if (audioEl) audioEl.play().catch(() => {}); } catch (e2) {}
        }
    }

    vibrateDevice() {
        try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
    }

    notify(message) {
        this.playNotificationSound();
        this.vibrateDevice();
        if (Notification && Notification.permission === 'granted') {
            new Notification('Ibad Foodie', { body: message, icon: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=64' });
        }
        // Also show as alert/toast for immediate visibility
        try {
            const toast = document.getElementById('notification-toast') || (() => {
                const el = document.createElement('div');
                el.id = 'notification-toast';
                el.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999;background:#28a745;color:white;padding:12px 20px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.2);font-weight:600;display:none;max-width:350px;';
                document.body.appendChild(el);
                return el;
            })();
            toast.textContent = '🔔 ' + message;
            toast.style.display = 'block';
            setTimeout(() => { toast.style.display = 'none'; }, 4000);
        } catch(e) {}
    }

    requestNotificationPermission() {
        if (Notification && Notification.permission === 'default') Notification.requestPermission();
    }

    addNotification(userId, message, type = 'order') {
        const ref = db.ref('notifications').push();
        ref.set({ userId, message, type, read: false, timestamp: firebase.database.ServerValue.TIMESTAMP });
    }

    async getNotifications(userId) {
        try {
            const snap = await db.ref('notifications').orderByChild('userId').equalTo(userId).limitToLast(20).once('value');
            const notifs = [];
            if (snap.exists()) snap.forEach(c => notifs.push({ id: c.key, ...c.val() }));
            return notifs.reverse();
        } catch (e) { return []; }
    }

    async markNotificationRead(notifId) {
        try { await db.ref('notifications/' + notifId).update({ read: true }); } catch (e) { console.error(e); }
    }

    static notifyUser(message) {
        if (window.auth) auth.notify(message);
    }

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
        try { return !!(this.currentUser && this.currentUser.emailVerified); } catch (e) { return false; }
    }
}

// Global auth instance
const auth = new Auth();