// ============================================
// Ibad Foodz - Authentication Module
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
                
                // Automatically ask for notification permissions gracefully
                setTimeout(() => {
                    if (this.requestNotificationPermission) {
                        this.requestNotificationPermission();
                    }
                }, 1500);

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

    showToast(message, type = 'info') {
        try {
            let toastContainer = document.getElementById('toast-container');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'toast-container';
                toastContainer.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
                document.body.appendChild(toastContainer);
            }
            const toast = document.createElement('div');
            let color = '#3498db';
            let icon = 'fa-info-circle';
            if (type === 'success') { color = '#2ecc71'; icon = 'fa-check-circle'; }
            if (type === 'error') { color = '#e74c3c'; icon = 'fa-times-circle'; }
            if (type === 'warning') { color = '#f1c40f'; icon = 'fa-exclamation-triangle'; }
            
            toast.style.cssText = `background:white;color:#2c3e50;padding:16px 20px;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.15);font-weight:600;display:flex;align-items:center;gap:12px;max-width:350px;transform:translateX(120%);transition:transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);border-left:4px solid ${color};pointer-events:auto;`;
            toast.innerHTML = `<div style="color:${color};font-size:24px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas ${icon}"></i></div><div>${message}</div>`;
            toastContainer.appendChild(toast);
            
            requestAnimationFrame(() => {
                toast.style.transform = 'translateX(0)';
            });

            setTimeout(() => { 
                toast.style.transform = 'translateX(120%)';
                setTimeout(() => toast.remove(), 400);
            }, 4000);
        } catch(e) {}
    }

    notify(message) {
        this.playNotificationSound();
        this.vibrateDevice();
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('Ibad Foodz', { body: message, icon: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=64' });
        }
        // Also show as alert/toast for immediate visibility (Professional Toast)
        try {
            let toastContainer = document.getElementById('toast-container');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'toast-container';
                toastContainer.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
                document.body.appendChild(toastContainer);
            }
            const toast = document.createElement('div');
            toast.style.cssText = 'background:white;color:#2c3e50;padding:16px 20px;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.15);font-weight:600;display:flex;align-items:center;gap:12px;max-width:350px;transform:translateX(120%);transition:transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);border-left:4px solid #ff6b35;pointer-events:auto;';
            toast.innerHTML = `<div style="background:#fff0eb;color:#ff6b35;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fas fa-bell"></i></div><div>${message}</div>`;
            toastContainer.appendChild(toast);
            
            // Animate in
            requestAnimationFrame(() => {
                toast.style.transform = 'translateX(0)';
            });

            setTimeout(() => { 
                toast.style.transform = 'translateX(120%)';
                setTimeout(() => toast.remove(), 400);
            }, 4000);
        } catch(e) {}
    }

    requestNotificationPermission() {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            const hasAsked = localStorage.getItem('ibad_notif_asked');
            if (hasAsked) return;

            // Create professional dialog
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:10000;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.3s;';
            
            const dialog = document.createElement('div');
            dialog.style.cssText = 'background:white;padding:32px;border-radius:24px;width:90%;max-width:400px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.2);transform:scale(0.9);transition:transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);';
            
            dialog.innerHTML = `
                <div style="background:linear-gradient(135deg, #fff0eb, #ffe4d6);width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;color:#ff6b35;font-size:32px;">
                    <i class="fas fa-bell-ringing"></i>
                </div>
                <h3 style="font-weight:800;color:#2c3e50;margin-bottom:12px;font-size:1.4rem;">Stay Updated!</h3>
                <p style="color:#7f8c8d;margin-bottom:24px;line-height:1.5;">Allow notifications to get real-time updates about your food orders, hot deals, and delivery status.</p>
                <div style="display:flex;gap:12px;">
                    <button id="notif-deny" style="flex:1;padding:12px;border:none;background:#f5f6fa;color:#7f8c8d;font-weight:600;border-radius:12px;cursor:pointer;transition:background 0.2s;">Not Now</button>
                    <button id="notif-allow" style="flex:1;padding:12px;border:none;background:linear-gradient(135deg, #ff6b35, #ff8c42);color:white;font-weight:600;border-radius:12px;cursor:pointer;box-shadow:0 4px 15px rgba(255,107,53,0.3);transition:transform 0.2s;">Allow</button>
                </div>
            `;
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Animate in
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                dialog.style.transform = 'scale(1)';
            });

            const closeDialog = () => {
                overlay.style.opacity = '0';
                dialog.style.transform = 'scale(0.9)';
                setTimeout(() => overlay.remove(), 300);
                localStorage.setItem('ibad_notif_asked', 'true');
            };

            document.getElementById('notif-deny').addEventListener('click', closeDialog);
            document.getElementById('notif-allow').addEventListener('click', () => {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        this.notify('Notifications enabled successfully! 🎉');
                    }
                });
                closeDialog();
            });
        }
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