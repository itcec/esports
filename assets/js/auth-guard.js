/**
 * CEC Esports staff authentication and page access guard.
 * Firebase rules are the security boundary; this file controls UI access and
 * keeps the staff approval workflow consistent across the static pages.
 */
window.CECAuth = {
  currentUser: null,
  currentStaffProfile: null,
  listeners: [],
  isResolved: false,
  _staffListListener: null,

  esc: function (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  },

  init: async function () {
    if (sessionStorage.getItem('cec_staff_auth_mock') === 'true') {
      this.currentUser = {
        email: "jlcabucos.cec@gmail.com",
        displayName: "Tournament Coordinator",
        uid: "superadmin123",
        getIdToken: () => Promise.resolve("mock-id-token"),
        getIdTokenResult: () => Promise.resolve({ token: "mock-id-token" })
      };
      this.currentStaffProfile = {
        role: "super_admin",
        roleLabel: "Super Admin / Coordinator",
        isApproved: true,
        status: "approved"
      };
      this.isResolved = true;
      this._notifyListeners();
      this.renderAuthUI();
      return;
    }
    await window.CECFirebase.init();
    if (!window.CECFirebase.auth) {
      console.warn('Firebase Auth unavailable; rendering signed-out state.');
      this.isResolved = true;
      this._notifyListeners();
      this.renderAuthUI();
      return;
    }
    window.CECFirebase.auth.onAuthStateChanged(async (user) => {
      this.currentUser = user;
      this.currentStaffProfile = user ? await this._handleUserRole(user) : null;
      this.isResolved = true;
      this._notifyListeners();
      this.renderAuthUI();
    });
  },

  signInWithGoogle: async function () {
    await window.CECFirebase.init();
    if (!window.CECFirebase.auth) throw new Error('Authentication service is offline.');
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await window.CECFirebase.auth.signInWithPopup(provider);
      return result.user;
    } catch (err) {
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        await window.CECFirebase.auth.signInWithRedirect(provider);
        return null;
      }
      if (err.code === 'auth/popup-closed-by-user') return null;
      console.error('Google Sign-In Error:', err);
      throw err;
    }
  },

  signOut: async function () {
    if (window.CECFirebase.auth) await window.CECFirebase.auth.signOut();
    this.currentUser = null;
    this.currentStaffProfile = null;
    this._notifyListeners();
    this.renderAuthUI();
  },

  refreshProfile: async function () {
    if (!this.currentUser) return null;
    this.currentStaffProfile = await this._handleUserRole(this.currentUser);
    this._notifyListeners();
    this.renderAuthUI();
    return this.currentStaffProfile;
  },

  _handleUserRole: async function (user) {
    const email = (user.email || '').toLowerCase().trim();
    const coordinator = window.CECFirebase.superAdminEmail.toLowerCase().trim();
    if (email === coordinator) {
      const profile = {
        uid: user.uid, email: user.email,
        displayName: user.displayName || 'Tournament Coordinator',
        photoURL: user.photoURL || '', role: 'super_admin',
        roleLabel: 'Super Admin / Coordinator', isApproved: true, status: 'approved'
      };
      if (window.CECFirebase.db) {
        try { await window.CECFirebase.db.ref('staff/' + user.uid).set(profile); } catch (e) { console.warn(e); }
      }
      return profile;
    }
    const pending = {
      uid: user.uid, email: user.email, displayName: user.displayName || 'Staff Member',
      photoURL: user.photoURL || '', role: 'official', roleLabel: 'Pending Official',
      status: 'pending', isApproved: false, requestedAt: Date.now()
    };
    if (!window.CECFirebase.db) return pending;
    try {
      const snap = await window.CECFirebase.db.ref('staff/' + user.uid).once('value');
      const data = snap.val();
      if (!data) {
        await window.CECFirebase.db.ref('staff/' + user.uid).set(pending);
        return pending;
      }
      return Object.assign({}, data, {
        isApproved: data.status === 'approved',
        roleLabel: data.role === 'admin' ? 'Administrator' : (data.role === 'official' ? 'Match Official' : 'Tournament Staff')
      });
    } catch (e) {
      console.warn('Could not reach staff database:', e);
      return pending;
    }
  },

  approveStaff: async function (uid, role) {
    if (!this.isSuperAdmin() || !window.CECFirebase.db) return false;
    role = role === 'admin' ? 'admin' : 'official';
    await window.CECFirebase.db.ref('staff/' + uid).update({
      status: 'approved', isApproved: true, role: role,
      roleLabel: role === 'admin' ? 'Administrator' : 'Match Official',
      approvedAt: Date.now(), approvedBy: this.currentUser.email
    });
    return true;
  },

  rejectStaff: async function (uid) {
    if (!this.isSuperAdmin() || !window.CECFirebase.db) return false;
    await window.CECFirebase.db.ref('staff/' + uid).update({
      status: 'rejected', isApproved: false, rejectedAt: Date.now(), rejectedBy: this.currentUser.email
    });
    return true;
  },

  onStaffListChange: function (callback) {
    if (!window.CECFirebase.db) return;
    const ref = window.CECFirebase.db.ref('staff');
    if (this._staffListListener) ref.off('value', this._staffListListener);
    this._staffListListener = (snap) => {
      const data = snap.val() || {};
      callback(Object.keys(data).map((key) => data[key]));
    };
    ref.on('value', this._staffListListener);
  },

  isSuperAdmin: function () { return !!(this.currentStaffProfile && this.currentStaffProfile.role === 'super_admin'); },
  isAdmin: function () { return !!(this.currentStaffProfile && (this.currentStaffProfile.role === 'super_admin' || this.currentStaffProfile.role === 'admin')); },
  isOfficial: function () { return !!(this.currentStaffProfile && this.currentStaffProfile.role === 'official'); },
  isApprovedStaff: function () { return !!(this.currentStaffProfile && this.currentStaffProfile.isApproved === true); },

  // Granular Permission Checks
  canEditCMS: function () { return this.isAdmin(); },
  canManageStaff: function () { return this.isSuperAdmin(); },
  canPublishBracket: function () { return this.isApprovedStaff(); },
  canDeleteMatches: function () { return this.isApprovedStaff(); },
  canApproveTeams: function () { return this.isApprovedStaff(); },
  canResolveDisputes: function () { return this.isApprovedStaff(); },
  canOfficiateMatches: function () { return this.isApprovedStaff(); },
  canVerifyPlayers: function () { return this.isApprovedStaff(); },
  canFileDisputes: function () { return this.isApprovedStaff(); },

  onAuthChange: function (fn) {
    this.listeners.push(fn);
    if (this.isResolved) {
      try { fn(this.currentUser, this.currentStaffProfile); } catch (e) { console.warn(e); }
    }
  },
  _notifyListeners: function () {
    this.listeners.forEach((fn) => { try { fn(this.currentUser, this.currentStaffProfile); } catch (e) { console.warn(e); } });
  },

  /** Protects pages marked <body data-requires-staff="true">. */
  requireApprovedStaff: function () {
    const self = this;
    const deny = function (user, profile) {
      if (sessionStorage.getItem('cec_staff_auth_mock') === 'true') return;
      if (user && self.isApprovedStaff()) return;
      if (!user) {
        // Keep protected pages out of the public navigation and send signed-out
        // visitors through the dedicated staff entry point.
        if (window.location.pathname !== '/staff' && !window.location.pathname.endsWith('/staff-login.html')) {
          window.location.replace('/staff');
        }
        return;
      }
      const heading = user && profile && profile.status === 'rejected' ? 'Access revoked' : (user ? 'Approval required' : 'Staff sign-in required');
      document.body.innerHTML = '<main style="min-height:100vh;background:#081422;color:#d7e3f7;display:grid;place-items:center;padding:24px;font-family:Arial,sans-serif"><section style="max-width:560px;text-align:center;border:1px solid #424656;background:#15202f;border-radius:12px;padding:32px"><p style="color:#b4c5ff;font-weight:700;letter-spacing:.12em;font-size:12px">CEC ESPORTS STAFF PORTAL</p><h1 style="font-size:28px;margin:12px 0">' + heading + '</h1><p style="color:#c2c6d8;line-height:1.6">This account is signed in but is not approved for the Control Center yet.</p><a href="/staff" style="display:inline-block;margin-top:16px;background:#b4c5ff;color:#002a78;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">BACK TO STAFF PORTAL</a></section></main>';
    };
    this.onAuthChange(deny);
    if (this.isResolved) deny(this.currentUser, this.currentStaffProfile);
  },

  renderAuthUI: function () {
    const widgets = document.querySelectorAll('.cec-auth-widget');
    widgets.forEach((widget) => {
      if (this.currentUser) {
        let badge = '<span class="text-[10px] font-bold text-amber-400">⏳ PENDING</span>';
        if (this.isSuperAdmin()) {
          badge = '<span class="text-[10px] font-bold text-[#ffb020] flex items-center gap-0.5">👑 SUPER ADMIN</span>';
        } else if (this.isAdmin()) {
          badge = '<span class="text-[10px] font-bold text-[#6ea3ff] flex items-center gap-0.5">🛡️ ADMIN</span>';
        } else if (this.isApprovedStaff()) {
          badge = '<span class="text-[10px] font-bold text-[#00e676] flex items-center gap-0.5">⚡ OFFICIAL</span>';
        }

        widget.innerHTML = '<div class="flex items-center gap-2 bg-surface-container-high/90 border border-white/10 px-2.5 py-1.5 rounded-xl shadow-md"><img src="' + this.esc(this.currentUser.photoURL || 'assets/school_logo.jpg') + '" alt="" class="w-7 h-7 rounded-full object-cover border border-white/20" /><div class="hidden sm:flex flex-col text-left"><span class="text-xs font-bold text-on-surface truncate max-w-[120px]">' + this.esc(this.currentUser.displayName || 'Staff') + '</span>' + badge + '</div><button type="button" onclick="window.CECAuth.signOut()" class="p-1 text-on-surface-variant hover:text-error" title="Sign out" aria-label="Sign out"><span class="material-symbols-outlined text-[18px]">logout</span></button></div>';
      } else {
        widget.innerHTML = '<a href="staff-login.html" class="flex items-center gap-1.5 bg-surface-container-high hover:bg-surface-container-highest border border-primary/30 text-primary font-label-caps text-xs px-2 sm:px-3 py-1.5 rounded-lg shadow-sm font-bold" title="Staff and admin login"><span class="material-symbols-outlined text-[18px]">shield_person</span><span class="hidden md:inline">STAFF LOGIN</span></a>';
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', function () {
  window.CECAuth.renderAuthUI();
  if (document.body && document.body.dataset.requiresStaff === 'true') window.CECAuth.requireApprovedStaff();
  window.CECAuth.init();
});
