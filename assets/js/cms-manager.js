/**
 * CEC Esports Intramurals 2026 — Home Page Content Management System (CMS) Manager
 * Synchronizes Announcements, Hero content, Event dates, and Logos in Realtime via Firebase.
 */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'cec_esports_cms_cache';

  const DEFAULT_CMS_CONFIG = {
    announcement: {
      enabled: true,
      badge: 'OFFICIAL ANNOUNCEMENT',
      text: 'Official Team Registration closes September 1, 2026! Ensure all 5 starters and substitutes are locked in before the deadline.',
      linkText: 'REGISTER NOW',
      linkUrl: 'register-team.html',
      type: 'info'
    },
    hero: {
      badge: 'REGISTRATION OPEN · CLOSES SEP 1',
      gameTitle: 'MOBILE LEGENDS: BANG BANG',
      headlinePrimary: 'CEC Esports',
      headlineSecondary: 'Intramurals 2026',
      description: "Cebu Eastern College's collegiate Mobile Legends intramurals, run by CEC Blue Dragon Esports. Student Men's, Student Women's, and Faculty Exhibition — every match played online and streamed from the Computer Laboratory Annex Building.",
      videoUrl: 'assets/VideoIntro.mp4',
      ctaPrimaryText: 'REGISTER YOUR TEAM',
      ctaPrimaryUrl: 'register-team.html',
      ctaSecondaryText: 'VIEW SCHEDULE',
      ctaSecondaryUrl: 'tournament.html'
    },
    eventDetails: {
      regDeadlineDate: 'September 1, 2026',
      regDeadlineBadge: 'CLOSES SEP 1',
      regDeadlineDesc: 'Confirm and register your team roster with CEC Blue Dragon Esports.',
      kickoffDate: 'September 5, 2026',
      kickoffBadge: 'SATURDAYS',
      kickoffDesc: 'Student divisions play Saturdays, 2:00–5:00 PM online.',
      finalsDate: 'October 2, 2026',
      finalsBadge: 'FINALS DAY',
      finalsDesc: 'Department champions clash for the ultimate Intramurals crown.',
      venue: 'Computer Laboratory Annex Building'
    },
    logos: {
      schoolLogo: 'assets/school_logo.jpg',
      esportsLogo: 'assets/e-sportslogo.png',
      intramsLogo: 'assets/intrams_logo.png'
    },
    format: {
      title: 'Tournament Format',
      badge: 'CUSTOM LOBBY',
      item1Title: 'Department Brackets:',
      item1Desc: 'Single-elimination, Best-of-1 matches.',
      item2Title: 'Playoff Stages:',
      item2Desc: 'Semifinals are Best-of-3; Grand Finals are Best-of-5.',
      item3Title: 'Match Setup:',
      item3Desc: 'Online Tournament Draft Pick, streamed live from Annex Lab.',
      item4Title: 'Roster Structure:',
      item4Desc: '5 starters + up to 2 substitute players.',
      linkText: 'READ THE FULL RULES',
      linkUrl: 'rules.html'
    },
    roadmap: {
      title: 'Path to the Title',
      badge: 'ROADMAP',
      step1Title: 'Register:',
      step1Desc: 'Confirm and register your team by September 1, 2026.',
      step2Title: 'Department Battles:',
      step2Desc: 'Play department brackets in one single Saturday session.',
      step3Title: 'Department Champion:',
      step3Desc: 'Win your bracket to advance to Grand Finals.',
      step4Title: 'Grand Finals Day:',
      step4Desc: 'Meet the other champions on October 2, 2026.',
      linkText: 'SEE THE FULL SCHEDULE',
      linkUrl: 'tournament.html'
    },
    updatedAt: new Date().toISOString()
  };

  const CECCMSManager = {
    config: null,
    listeners: [],
    isInitialized: false,

    getStoredConfig: function() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return Object.assign({}, DEFAULT_CMS_CONFIG, parsed);
        }
      } catch (e) {
        console.warn('CMS cache read error:', e);
      }
      return Object.assign({}, DEFAULT_CMS_CONFIG);
    },

    init: async function() {
      if (this.isInitialized) return this.config;
      this.config = this.getStoredConfig();

      if (window.CECFirebase) {
        try {
          await window.CECFirebase.init();
          const db = window.CECFirebase.db;
          if (db) {
            const cmsRef = db.ref('cms');
            cmsRef.on('value', (snapshot) => {
              const val = snapshot.val();
              if (val) {
                this.config = Object.assign({}, DEFAULT_CMS_CONFIG, val);
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
                } catch (e) {}
                this._notifyListeners();
              }
            });
          }
        } catch (err) {
          console.warn('Firebase CMS connection unavailable, using local cache:', err);
        }
      }

      this.isInitialized = true;
      this._notifyListeners();
      return this.config;
    },

    getConfig: function() {
      return this.config || this.getStoredConfig();
    },

    onConfigChange: function(callback) {
      if (typeof callback === 'function') {
        this.listeners.push(callback);
        if (this.config) callback(this.config);
      }
    },

    _notifyListeners: function() {
      const cfg = this.getConfig();
      this.listeners.forEach((fn) => {
        try { fn(cfg); } catch (e) { console.error('CMS listener error:', e); }
      });
    },

    saveConfig: async function(newConfig) {
      const merged = Object.assign({}, this.config || DEFAULT_CMS_CONFIG, newConfig, {
        updatedAt: new Date().toISOString(),
        updatedBy: (window.CECAuth && window.CECAuth.currentUser) ? window.CECAuth.currentUser.email : 'admin'
      });

      this.config = merged;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch (e) {}

      if (window.CECFirebase) {
        await window.CECFirebase.init();
        const db = window.CECFirebase.db;
        if (db) {
          await db.ref('cms').set(merged);
        }
      }

      this._notifyListeners();
      return merged;
    },

    resetToDefaults: async function() {
      return await this.saveConfig(DEFAULT_CMS_CONFIG);
    },

    /**
     * Applies the current CMS config to the DOM on index.html
     */
    applyToHomePage: function(cfg) {
      cfg = cfg || this.getConfig();
      if (!cfg) return;

      // 1. Dynamic Announcement Banner
      const bannerEl = document.getElementById('cms-announcement-banner');
      if (bannerEl) {
        const a = cfg.announcement || {};
        if (a.enabled && a.text) {
          bannerEl.classList.remove('hidden');
          const badgeEl = document.getElementById('cms-announcement-badge');
          const textEl = document.getElementById('cms-announcement-text');
          const linkEl = document.getElementById('cms-announcement-link');
          if (badgeEl) badgeEl.textContent = a.badge || 'ANNOUNCEMENT';
          if (textEl) textEl.textContent = a.text;
          if (linkEl) {
            if (a.linkText && a.linkUrl) {
              linkEl.textContent = a.linkText;
              linkEl.href = a.linkUrl;
              linkEl.classList.remove('hidden');
            } else {
              linkEl.classList.add('hidden');
            }
          }
        } else {
          bannerEl.classList.add('hidden');
        }
      }

      // 2. Hero Section
      const h = cfg.hero || {};
      const heroBadge = document.getElementById('cms-hero-badge');
      const heroGame = document.getElementById('cms-hero-game');
      const heroTitle1 = document.getElementById('cms-hero-title-1');
      const heroTitle2 = document.getElementById('cms-hero-title-2');
      const heroDesc = document.getElementById('cms-hero-desc');
      const heroCta1 = document.getElementById('cms-hero-cta-1');
      const heroCta2 = document.getElementById('cms-hero-cta-2');
      const heroVideo = document.getElementById('intro-video');

      if (heroBadge && h.badge) heroBadge.textContent = h.badge;
      if (heroGame && h.gameTitle) heroGame.textContent = h.gameTitle;
      if (heroTitle1 && h.headlinePrimary) heroTitle1.textContent = h.headlinePrimary;
      if (heroTitle2 && h.headlineSecondary) heroTitle2.textContent = h.headlineSecondary;
      if (heroDesc && h.description) heroDesc.textContent = h.description;
      if (heroCta1 && h.ctaPrimaryText) {
        heroCta1.innerHTML = `${h.ctaPrimaryText} <span class="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>`;
        if (h.ctaPrimaryUrl) heroCta1.href = h.ctaPrimaryUrl;
      }
      if (heroCta2 && h.ctaSecondaryText) {
        heroCta2.textContent = h.ctaSecondaryText;
        if (h.ctaSecondaryUrl) heroCta2.href = h.ctaSecondaryUrl;
      }
      if (heroVideo && h.videoUrl && !heroVideo.src.includes(h.videoUrl)) {
        const source = heroVideo.querySelector('source');
        if (source) source.src = h.videoUrl;
        heroVideo.src = h.videoUrl;
      }

      // 3. Event Key Dates
      const ev = cfg.eventDetails || {};
      const regDate = document.getElementById('cms-event-reg-date');
      const regBadge = document.getElementById('cms-event-reg-badge');
      const regDesc = document.getElementById('cms-event-reg-desc');

      const kickDate = document.getElementById('cms-event-kick-date');
      const kickBadge = document.getElementById('cms-event-kick-badge');
      const kickDesc = document.getElementById('cms-event-kick-desc');

      const finalsDate = document.getElementById('cms-event-finals-date');
      const finalsBadge = document.getElementById('cms-event-finals-badge');
      const finalsDesc = document.getElementById('cms-event-finals-desc');

      if (regDate && ev.regDeadlineDate) regDate.textContent = ev.regDeadlineDate;
      if (regBadge && ev.regDeadlineBadge) regBadge.textContent = ev.regDeadlineBadge;
      if (regDesc && ev.regDeadlineDesc) regDesc.textContent = ev.regDeadlineDesc;

      if (kickDate && ev.kickoffDate) kickDate.textContent = ev.kickoffDate;
      if (kickBadge && ev.kickoffBadge) kickBadge.textContent = ev.kickoffBadge;
      if (kickDesc && ev.kickoffDesc) kickDesc.textContent = ev.kickoffDesc;

      if (finalsDate && ev.finalsDate) finalsDate.textContent = ev.finalsDate;
      if (finalsBadge && ev.finalsBadge) finalsBadge.textContent = ev.finalsBadge;
      if (finalsDesc && ev.finalsDesc) finalsDesc.textContent = ev.finalsDesc;

      // 4. Tournament Format
      const fmt = cfg.format || {};
      const fmtTitle = document.getElementById('cms-format-title');
      const fmtBadge = document.getElementById('cms-format-badge');
      const fmtLink = document.getElementById('cms-format-link');

      if (fmtTitle && fmt.title) fmtTitle.textContent = fmt.title;
      if (fmtBadge && fmt.badge) fmtBadge.textContent = fmt.badge;
      if (fmtLink) {
        if (fmt.linkText) fmtLink.innerHTML = `${fmt.linkText} <span class="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>`;
        if (fmt.linkUrl) fmtLink.href = fmt.linkUrl;
      }

      for (let i = 1; i <= 4; i++) {
        const tEl = document.getElementById(`cms-format-item${i}-title`);
        const dEl = document.getElementById(`cms-format-item${i}-desc`);
        if (tEl && fmt[`item${i}Title`]) tEl.textContent = fmt[`item${i}Title`];
        if (dEl && fmt[`item${i}Desc`]) dEl.textContent = fmt[`item${i}Desc`];
      }

      // 5. Path to the Title Roadmap
      const rdm = cfg.roadmap || {};
      const rdmTitle = document.getElementById('cms-roadmap-title');
      const rdmBadge = document.getElementById('cms-roadmap-badge');
      const rdmLink = document.getElementById('cms-roadmap-link');

      if (rdmTitle && rdm.title) rdmTitle.textContent = rdm.title;
      if (rdmBadge && rdm.badge) rdmBadge.textContent = rdm.badge;
      if (rdmLink) {
        if (rdm.linkText) rdmLink.innerHTML = `${rdm.linkText} <span class="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>`;
        if (rdm.linkUrl) rdmLink.href = rdm.linkUrl;
      }

      for (let i = 1; i <= 4; i++) {
        const tEl = document.getElementById(`cms-roadmap-step${i}-title`);
        const dEl = document.getElementById(`cms-roadmap-step${i}-desc`);
        if (tEl && rdm[`step${i}Title`]) tEl.textContent = rdm[`step${i}Title`];
        if (dEl && rdm[`step${i}Desc`]) dEl.textContent = rdm[`step${i}Desc`];
      }
    }
  };

  window.CECCMSManager = CECCMSManager;
})(window);
