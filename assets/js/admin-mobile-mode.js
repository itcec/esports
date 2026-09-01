/**
 * CEC Esports Control Center — Mobile App Mode & Shell Manager
 * Handles Mobile App View Switcher, Bottom Navigation Bar, and Mobile Responsive Behaviors.
 */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'cec_admin_view_mode';

  const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', href: 'admin.html', match: ['admin.html', '/control-center', 'dashboard.html'] },
    { id: 'registrations', label: 'Registrations', icon: 'app_registration', href: 'admin-registrations.html', match: ['admin-registrations.html'] },
    { id: 'verification', label: 'Verify', icon: 'verified_user', href: 'admin-verification.html', match: ['admin-verification.html'] },
    { id: 'bracket', label: 'Brackets', icon: 'account_tree', href: 'admin-bracket-builder.html', match: ['admin-bracket-builder.html'] },
    { id: 'officiating', label: 'Live Arena', icon: 'sports_esports', href: 'admin-officiating.html', match: ['admin-officiating.html'] }
  ];

  const AdminMobileMode = {
    isMobileMode: false,

    init: function() {
      // 1. Check stored preference or viewport
      const stored = localStorage.getItem(STORAGE_KEY);
      this.isMobileMode = stored === 'mobile';

      this._applyMode(this.isMobileMode);
      this._injectHeaderToggle();
      this._injectBottomNav();
      this._injectGlobalMobileStyles();

      // Listen to resize
      window.addEventListener('resize', () => {
        this._updateNavVisibility();
      });
    },

    toggle: function() {
      this.isMobileMode = !this.isMobileMode;
      localStorage.setItem(STORAGE_KEY, this.isMobileMode ? 'mobile' : 'desktop');
      this._applyMode(this.isMobileMode);
      this._updateToggleBtn();
    },

    _applyMode: function(active) {
      if (active) {
        document.documentElement.classList.add('cec-mobile-mode');
        document.body.classList.add('cec-mobile-mode');
      } else {
        document.documentElement.classList.remove('cec-mobile-mode');
        document.body.classList.remove('cec-mobile-mode');
      }
      this._updateToggleBtn();
    },

    _injectHeaderToggle: function() {
      const topbar = document.querySelector('.admin-topbar');
      if (!topbar) return;

      let authWidget = topbar.querySelector('.cec-auth-widget');
      let existingBtn = document.getElementById('cec-mobile-toggle-btn');
      if (existingBtn) return;

      const btn = document.createElement('button');
      btn.id = 'cec-mobile-toggle-btn';
      btn.type = 'button';
      btn.className = 'flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-all border border-white/10 text-xs font-bold font-label-caps shrink-0 shadow-sm';
      btn.title = 'Toggle Mobile App View';
      btn.innerHTML = `
        <span class="material-symbols-outlined text-[18px] text-primary" id="cec-mobile-toggle-icon">${this.isMobileMode ? 'desktop_windows' : 'smartphone'}</span>
        <span class="hidden sm:inline" id="cec-mobile-toggle-label">${this.isMobileMode ? 'Desktop View' : 'Mobile App View'}</span>
      `;

      btn.addEventListener('click', () => {
        this.toggle();
      });

      if (authWidget) {
        authWidget.parentNode.insertBefore(btn, authWidget);
      } else {
        topbar.appendChild(btn);
      }
    },

    _updateToggleBtn: function() {
      const icon = document.getElementById('cec-mobile-toggle-icon');
      const label = document.getElementById('cec-mobile-toggle-label');
      if (icon) icon.textContent = this.isMobileMode ? 'desktop_windows' : 'smartphone';
      if (label) label.textContent = this.isMobileMode ? 'Desktop View' : 'Mobile App View';
    },

    _injectBottomNav: function() {
      if (document.getElementById('cec-admin-bottom-nav')) return;

      const currentPath = window.location.pathname.toLowerCase();

      const nav = document.createElement('nav');
      nav.id = 'cec-admin-bottom-nav';
      nav.className = 'fixed bottom-0 left-0 right-0 h-16 bg-surface-container-lowest/95 backdrop-blur-lg border-t border-white/10 z-50 flex items-center justify-around px-2 shadow-2xl transition-all';

      nav.innerHTML = NAV_ITEMS.map(item => {
        const isActive = item.match.some(m => currentPath.endsWith(m) || (m === 'admin.html' && (currentPath === '/' || currentPath.endsWith('/control-center'))));
        return `
          <a href="${item.href}" class="flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl transition-all relative ${isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'}">
            ${isActive ? '<div class="absolute -top-1 w-8 h-1 bg-primary rounded-full shadow-[0_0_8px_#b4c5ff]"></div>' : ''}
            <span class="material-symbols-outlined text-[20px] ${isActive ? 'scale-110 text-primary' : ''}">${item.icon}</span>
            <span class="text-[10px] font-label-caps uppercase tracking-tight">${item.label}</span>
          </a>
        `;
      }).join('');

      document.body.appendChild(nav);
      this._updateNavVisibility();
    },

    _updateNavVisibility: function() {
      const nav = document.getElementById('cec-admin-bottom-nav');
      if (!nav) return;
      const isMobileScreen = window.innerWidth < 1024;
      if (isMobileScreen || this.isMobileMode) {
        nav.classList.remove('hidden');
        document.body.classList.add('has-bottom-nav');
      } else {
        nav.classList.add('hidden');
        document.body.classList.remove('has-bottom-nav');
      }
    },

    _injectGlobalMobileStyles: function() {
      if (document.getElementById('cec-mobile-styles')) return;

      const style = document.createElement('style');
      style.id = 'cec-mobile-styles';
      style.textContent = `
        /* Mobile Bottom Nav Spacing */
        body.has-bottom-nav main,
        html.cec-mobile-mode main {
          padding-bottom: 6rem !important;
        }

        /* Mobile App View Simulation on Desktop when cec-mobile-mode is active */
        html.cec-mobile-mode {
          background-color: #030710;
        }
        @media (min-width: 1024px) {
          html.cec-mobile-mode body {
            max-width: 480px;
            margin: 0 auto !important;
            box-shadow: 0 0 50px rgba(0, 0, 0, 0.9), 0 0 20px rgba(18, 100, 255, 0.15);
            border-left: 1px solid rgba(255, 255, 255, 0.1);
            border-right: 1px solid rgba(255, 255, 255, 0.1);
            position: relative;
          }
          html.cec-mobile-mode aside.admin-sidebar {
            display: none !important;
          }
          html.cec-mobile-mode .admin-shell {
            padding-left: 0 !important;
          }
          html.cec-mobile-mode .admin-topbar {
            left: 0 !important;
            right: 0 !important;
            max-width: 480px;
            margin: 0 auto;
          }
          html.cec-mobile-mode #cec-admin-bottom-nav {
            left: 0 !important;
            right: 0 !important;
            max-width: 480px;
            margin: 0 auto;
            display: flex !important;
          }

          /* Force Mobile Views in Simulated Mobile Mode */
          html.cec-mobile-mode .desktop-only-table {
            display: none !important;
          }
          html.cec-mobile-mode .mobile-only-feed {
            display: flex !important;
            flex-direction: column !important;
          }
          html.cec-mobile-mode #verify-mobile-tab-bar {
            display: flex !important;
          }
          html.cec-mobile-mode .grid.lg\\:grid-cols-12 {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
          }
          html.cec-mobile-mode .vtab-pane.hidden {
            display: none !important;
          }
          html.cec-mobile-mode .vtab-pane:not(.hidden) {
            display: flex !important;
            width: 100% !important;
            max-width: 100% !important;
            flex: 1 1 100% !important;
          }
        }

        /* Touch-friendly scrolling */
        .touch-scroll {
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .touch-scroll::-webkit-scrollbar {
          display: none;
        }

        /* Mobile Drawer Animations */
        .mobile-drawer-enter {
          transform: translateY(100%);
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mobile-drawer-enter-active {
          transform: translateY(0);
        }
      `;
      document.head.appendChild(style);
    }
  };

  window.AdminMobileMode = AdminMobileMode;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AdminMobileMode.init());
  } else {
    AdminMobileMode.init();
  }
})(window);
