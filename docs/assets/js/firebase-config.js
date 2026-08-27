/**
 * CEC Esports Intramurals 2026 — Firebase Configuration & Initialization Bridge
 * Provides Auth (Google Sign-In) and Realtime Database client for live tournament operations.
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB73WKKAEc-YmVgWxsMvNWZyJBgHSGqYP8",
  authDomain: "esports-7ec77.firebaseapp.com",
  projectId: "esports-7ec77",
  storageBucket: "esports-7ec77.firebasestorage.app",
  messagingSenderId: "479655202585",
  appId: "1:479655202585:web:f3b7e2052a9d659ec6bf88",
  databaseURL: "https://esports-7ec77-default-rtdb.firebaseio.com"
};

// Designated Super Admin Email
const SUPER_ADMIN_EMAIL = "jlcabucos.cec@gmail.com";

// Global Firebase Wrapper
window.CECFirebase = {
  config: FIREBASE_CONFIG,
  superAdminEmail: SUPER_ADMIN_EMAIL,
  app: null,
  auth: null,
  db: null,
  isInitialized: false,

  /**
   * Initializes Firebase App, Auth, and Realtime Database
   */
  init: function() {
    if (this.isInitialized) return Promise.resolve(this);

    return new Promise((resolve) => {
      // Check if Firebase SDK is already loaded on the page
      if (window.firebase) {
        this._setupFirebase();
        resolve(this);
      } else {
        // Dynamically load Firebase SDK compat scripts
        this._loadScript('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js')
          .then(() => Promise.all([
            this._loadScript('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js'),
            this._loadScript('https://www.gstatic.com/firebasejs/10.8.0/firebase-database-compat.js')
          ]))
          .then(() => {
            this._setupFirebase();
            resolve(this);
          })
          .catch((err) => {
            console.warn('Firebase SDK load failed or offline, falling back to local state:', err);
            resolve(this);
          });
      }
    });
  },

  _setupFirebase: function() {
    try {
      if (!firebase.apps.length) {
        this.app = firebase.initializeApp(FIREBASE_CONFIG);
      } else {
        this.app = firebase.app();
      }
      this.auth = firebase.auth();
      this.db = firebase.database();
      this.isInitialized = true;
      console.log('CEC Firebase initialized successfully.');
    } catch (e) {
      console.warn('Error setting up Firebase:', e);
    }
  },

  _loadScript: function(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
};

// Initialize immediately when script is loaded
window.CECFirebase.init();
