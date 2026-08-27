/**
 * CEC Esports Intramurals 2026 — Auth Guard & Staff Approval Gatekeeper
 * Manages Google Sign-In, Role Detection, and Super Admin (jlcabucos.cec@gmail.com) Approval Workflow.
 */

window.CECAuth = {
  currentUser: null,
  currentStaffProfile: null,
  listeners: [],

  /**
   * Initialize Auth listener
   */
  init: async function() {
    await window.CECFirebase.init();
    if (!window.CECFirebase.auth) {
      console.warn('Firebase Auth unavailable, checking offline session.');
      this._checkLocalSession();
      return;
    }

    window.CECFirebase.auth.onAuthStateChanged(async (user) => {
      this.currentUser = user;
      if (user) {
        await this._handleUserRole(user);
      } else {
        this.currentStaffProfile = null;
      }
      this._notifyListeners();
      this.renderAuthUI();
    });
  },

  /**
   * Google Sign-In Method
   */
  signInWithGoogle: async function() {
    await window.CECFirebase.init();
    if (!window.CECFirebase.auth) {
      alert('Authentication service is currently initializing or offline. Please try again.');
      return;
    }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await window.CECFirebase.auth.signInWithPopup(provider);
      return result.user;
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      // If popup was blocked or failed, try redirect
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        const provider = new firebase.auth.GoogleAuthProvider();
        await window.CECFirebase.auth.signInWithRedirect(provider);
      } else {
        alert('Sign-in failed: ' + (err.message || 'Please try again.'));
      }
    }
  },

  /**
   * Sign Out
   */
  signOut: async function() {
    if (window.CECFirebase.auth) {
      await window.CECFirebase.auth.signOut();
    }
    this.currentUser = null;
    this.currentStaffProfile = null;
    localStorage.removeItem('CEC_LOCAL_STAFF_SESSION');
    this._notifyListeners();
    this.renderAuthUI();
  },

  /**
   * Resolve and enforce user role from Super Admin or Realtime DB
   */
  _handleUserRole: async function(user) {
    const email = (user.email || '').toLowerCase().trim();
    const isSuperAdmin = email === window.CECFirebase.superAdminEmail.toLowerCase().trim();

    if (isSuperAdmin) {
      this.currentStaffProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Tournament Coordinator',
        photoURL: user.photoURL || '',
        role: 'super_admin',
        roleLabel: 'Super Admin / Coordinator',
        isApproved: true,
        status: 'approved'
      };
      // Keep admin record synced in DB
      if (window.CECFirebase.db) {
        try {
          window.CECFirebase.db.ref('staff/' + user.uid).set(this.currentStaffProfile);
        } catch (e) {}
      }
      return;
    }

    // Regular Staff Check
    if (window.CECFirebase.db) {
      try {
        const snap = await window.CECFirebase.db.ref('staff/' + user.uid).once('value');
        const data = snap.val();

        if (data) {
          this.currentStaffProfile = {
            ...data,
            isApproved: data.status === 'approved',
            roleLabel: data.role === 'admin' ? 'Administrator' : (data.role === 'official' ? 'Match Official' : 'Tournament Staff')
          };
        } else {
          // Create pending approval request in RTDB
          const newRequest = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || 'Staff Member',
            photoURL: user.photoURL || '',
            role: 'official',
            roleLabel: 'Pending Official',
            status: 'pending',
            isApproved: false,
            requestedAt: Date.now()
          };
          await window.CECFirebase.db.ref('staff/' + user.uid).set(newRequest);
          this.currentStaffProfile = newRequest;
        }
      } catch (e) {
        console.warn('Could not reach staff database:', e);
        this.currentStaffProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Staff Member',
          photoURL: user.photoURL || '',
          role: 'pending',
          roleLabel: 'Pending Approval',
          status: 'pending',
          isApproved: false
        };
      }
    } else {
      this.currentStaffProfile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: 'pending',
        isApproved: false,
        status: 'pending'
      };
    }
  },

  /**
   * Super Admin Approves a Staff Request
   */
  approveStaff: async function(uid, role) {
    if (!this.isSuperAdmin()) {
      alert('Only the Tournament Coordinator (jlcabucos.cec@gmail.com) can approve staff.');
      return false;
    }
    if (!window.CECFirebase.db) return false;

    role = role || 'official';
    await window.CECFirebase.db.ref('staff/' + uid).update({
      status: 'approved',
      role: role,
      approvedAt: Date.now(),
      approvedBy: this.currentUser.email
    });
    return true;
  },

  /**
   * Super Admin Rejects/Removes a Staff Request
   */
  rejectStaff: async function(uid) {
    if (!this.isSuperAdmin()) return false;
    if (!window.CECFirebase.db) return false;

    await window.CECFirebase.db.ref('staff/' + uid).update({
      status: 'rejected',
      rejectedAt: Date.now()
    });
    return true;
  },

  /**
   * Listen to all staff requests (Super Admin view)
   */
  onStaffListChange: function(callback) {
    if (!window.CECFirebase.db) return;
    window.CECFirebase.db.ref('staff').on('value', (snap) => {
      const data = snap.val() || {};
      const list = Object.keys(data).map(k => data[k]);
      callback(list);
    });
  },

  isSuperAdmin: function() {
    return this.currentStaffProfile && this.currentStaffProfile.role === 'super_admin';
  },

  isApprovedStaff: function() {
    return this.currentStaffProfile && this.currentStaffProfile.isApproved === true;
  },

  onAuthChange: function(fn) {
    this.listeners.push(fn);
  },

  _notifyListeners: function() {
    this.listeners.forEach(fn => {
      try { fn(this.currentUser, this.currentStaffProfile); } catch (e) {}
    });
  },

  /**
   * Render dynamic auth widgets across top headers
   */
  renderAuthUI: function() {
    const authWidgets = document.querySelectorAll('.cec-auth-widget');
    authWidgets.forEach(widget => {
      if (this.currentUser) {
        const isApproved = this.isApprovedStaff();
        const roleBadge = this.isSuperAdmin() 
          ? '<span class="px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/40 text-[10px] font-bold">SUPER ADMIN</span>'
          : (isApproved 
              ? '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">OFFICIAL</span>'
              : '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold animate-pulse">PENDING APPROVAL</span>');

        widget.innerHTML = `
          <div class="flex items-center gap-2 bg-surface-container-high/90 border border-white/10 px-2.5 py-1.5 rounded-xl shadow-md">
            <img src="${this.currentUser.photoURL || 'assets/school_logo.jpg'}" alt="Avatar" class="w-7 h-7 rounded-full object-cover border border-white/20" />
            <div class="flex flex-col text-left hidden sm:flex">
              <span class="text-xs font-bold text-on-surface truncate max-w-[120px]">${this.currentUser.displayName || 'Staff'}</span>
              ${roleBadge}
            </div>
            <button type="button" onclick="window.CECAuth.signOut()" class="p-1 text-on-surface-variant hover:text-error transition-colors rounded-lg hover:bg-white/5" title="Sign Out">
              <span class="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        `;
      } else {
        widget.innerHTML = `
          <button type="button" onclick="window.CECAuth.signInWithGoogle()" class="flex items-center gap-1.5 bg-surface-container-high hover:bg-surface-container-highest border border-primary/30 text-primary font-label-caps text-xs px-3 py-1.5 rounded-lg shadow-sm transition-colors font-bold">
            <svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" /></svg>
            <span>STAFF LOGIN</span>
          </button>
        `;
      }
    });
  },

  _checkLocalSession: function() {
    // fallback if offline
  }
};

// Initialize Auth on script load
document.addEventListener('DOMContentLoaded', () => {
  window.CECAuth.init();
});
