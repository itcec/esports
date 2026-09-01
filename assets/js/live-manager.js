/**
 * CEC Esports Intramurals 2026 — Multi-Game Live Stream & Match Manager
 * Synchronizes multiple concurrent matches (1 to 12+ live games) in Realtime Database with instant switcher.
 */

window.CECLiveManager = {
  activeMatchId: null,

  // Hosts allowed to embed the Twitch player, alongside the current hostname.
  STREAM_PARENT_HOSTS: ['cec-esports.vercel.app'],

  /**
   * Officials may only publish Twitch links; this mirrors the Apps Script
   * `publishMatch` rule so the UI fails early instead of at save time.
   */
  validateStreamUrl: function (url) {
    const raw = String(url || '').trim();
    if (!raw) return { ok: true, url: '' };
    if (!/^https?:\/\/(www\.)?twitch\.tv\/[A-Za-z0-9_]/i.test(raw)) {
      return { ok: false, url: raw, message: 'Only Twitch links can be published — e.g. https://twitch.tv/yourchannel or a twitch.tv/videos/... VOD.' };
    }
    return { ok: true, url: raw };
  },

  matches: {},
  publicTeams: {},
  listeners: [],


  /**
   * Initialize live match syncing with Firebase Realtime Database
   */
  init: async function() {
    this.matches = this._getLocalMatches();
    await window.CECFirebase.init();
    this._loadPublicTeams();
    this._loadPublicMatches();

    if (window.CECFirebase.db) {
      // Listen to Realtime Database /liveMatches
      window.CECFirebase.db.ref('liveMatches').on('value', (snapshot) => {
        const data = snapshot.val();
        this.matches = data || {};
        this._enrichMatchesWithPublicTeams();
        this._saveLocalMatches();
        if (!this.matches[this.activeMatchId]) {
          this.activeMatchId = Object.keys(this.matches)[0] || null;
        }
        this._notify();
      });

      // Listen to /activeMatchId
      window.CECFirebase.db.ref('activeMatchId').on('value', (snapshot) => {
        const id = snapshot.val();
        if (id && this.matches[id]) {
          this.activeMatchId = id;
          this._notify();
        }
      });
    } else {
      this._notify();
    }
  },

  _loadPublicTeams: async function() {
    if (!window.PublicTournamentApi || typeof window.PublicTournamentApi.listTeams !== 'function') return;
    try {
      const teams = await window.PublicTournamentApi.listTeams();
      this.publicTeams = {};
      (teams || []).forEach((team) => {
        if (String(team.approvalStatus || team.Status || 'Approved').toLowerCase() !== 'approved') return;
        const id = String(team.teamId || '').trim();
        const name = String(team.teamName || '').trim().toLowerCase();
        if (id) this.publicTeams[id] = team;
        if (name) this.publicTeams['name:' + name] = team;
      });
      this._enrichMatchesWithPublicTeams();
      this._notify();
    } catch (error) {
      console.warn('Public registered team profiles are unavailable:', error);
    }
  },

  _loadPublicMatches: async function() {
    if (!window.PublicTournamentApi || typeof window.PublicTournamentApi.listMatches !== 'function') return;
    try {
      const rows = await window.PublicTournamentApi.listMatches();
      if (!window.CECFirebase || !window.CECFirebase.db) {
        if (!Object.keys(this.matches || {}).length && (rows || []).length > 0) {
          this.matches = {};
          (rows || []).forEach((row) => {
            const id = row.matchId || ('MATCH-' + Math.random().toString(36).slice(2, 8));
            this.matches[id] = {
              id: id, title: row.stage || 'Official match', court: row.court || '',
              division: row.division || '', stageTitle: row.stage || '',
              status: row.status || 'Scheduled', streamUrl: row.streamUrl || '',
              team1: { id: row.team1Id || '', name: row.team1Name || 'TBD', score: row.team1Score || 0 },
              team2: { id: row.team2Id || '', name: row.team2Name || 'TBD', score: row.team2Score || 0 }
            };
          });
          this.activeMatchId = Object.keys(this.matches)[0] || null;
          this._enrichMatchesWithPublicTeams();
          this._notify();
        }
      }
    } catch (error) {
      console.warn('Published matches are unavailable:', error);
    }
  },

  _enrichMatchesWithPublicTeams: function() {
    const self = this;
    Object.keys(this.matches || {}).forEach(function(matchId) {
      const match = self.matches[matchId];
      ['team1', 'team2'].forEach(function(sideKey) {
        const side = match && match[sideKey];
        if (!side) return;
        const id = String(side.registrationTeamId || side.teamId || side.id || '').trim();
        const name = String(side.name || '').trim().toLowerCase();
        const team = (id && self.publicTeams[id]) || (name && self.publicTeams['name:' + name]);
        if (!team) return;
        const roster = (team.roster || []).map(function(player, index) {
          return {
            num: index + 1,
            playerId: player.playerId || '',
            ign: player.ign || '',
            real: player.realName || '',
            role: player.role || '',
            rosterType: player.rosterType || 'Starter',
            profileImageUrl: player.profileImageUrl || '',
            isCap: index === 0
          };
        });
        match[sideKey] = Object.assign({}, side, {
          id: team.teamId || side.id,
          registrationTeamId: team.teamId || side.registrationTeamId,
          name: team.teamName || side.name,
          dept: team.department || side.dept,
          sub: team.course || side.sub,
          captain: team.captainName || side.captain,
          roster: roster.length ? roster : side.roster
        });
      });
    });
  },

  _getLocalMatches: function() {
    try {
      const saved = localStorage.getItem('CEC_LIVE_MATCHES');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  },

  _saveLocalMatches: function() {
    try {
      localStorage.setItem('CEC_LIVE_MATCHES', JSON.stringify(this.matches));
    } catch (e) {}
  },

  getActiveMatch: function() {
    return this.matches[this.activeMatchId] || Object.values(this.matches)[0] || null;
  },

  selectMatch: function(matchId) {
    if (this.matches[matchId]) {
      this.activeMatchId = matchId;
      this._notify();
      // If admin, also update global active match in RTDB
      if (window.CECAuth && window.CECAuth.isApprovedStaff() && window.CECFirebase.db) {
        window.CECFirebase.db.ref('activeMatchId').set(matchId);
      }
    }
  },

  /**
   * Save or Update Match (Staff & Admin Only)
   */
  saveMatch: async function(matchData) {
    if (!matchData.id) {
      matchData.id = 'MATCH-' + String(Date.now()).slice(-4);
    }
    this.matches[matchData.id] = matchData;
    this._enrichMatchesWithPublicTeams();
    this._saveLocalMatches();

    if (window.CECFirebase.db) {
      await window.CECFirebase.db.ref('liveMatches/' + matchData.id).set(matchData);
    }
    if (window.TournamentOps && window.CECAuth && window.CECAuth.isApprovedStaff()) {
      await window.TournamentOps.publishMatch({
        matchId: matchData.id,
        court: matchData.court || '', division: matchData.division || '', stage: matchData.stageTitle || matchData.stage || '',
        team1Id: matchData.team1 && (matchData.team1.registrationTeamId || matchData.team1.id) || '',
        team1Name: matchData.team1 && matchData.team1.name || '', score1: matchData.team1 && matchData.team1.score || 0,
        team2Id: matchData.team2 && (matchData.team2.registrationTeamId || matchData.team2.id) || '',
        team2Name: matchData.team2 && matchData.team2.name || '', score2: matchData.team2 && matchData.team2.score || 0,
        status: matchData.status || 'Scheduled', streamUrl: matchData.streamUrl || '', winnerId: matchData.winnerId || '', winnerName: matchData.winnerName || ''
      });
    }
    this._notify();
    return matchData;
  },

  deleteMatch: async function(matchId) {
    if (!matchId) return { ok: false, error: 'Match ID is required' };
    delete this.matches[matchId];
    this._saveLocalMatches();

    const errors = [];
    if (window.CECFirebase && window.CECFirebase.db) {
      try {
        await window.CECFirebase.db.ref('liveMatches/' + matchId).remove();
        if (this.activeMatchId === matchId) {
          const nextActive = Object.keys(this.matches)[0] || '';
          await window.CECFirebase.db.ref('activeMatchId').set(nextActive);
        }
      } catch (e) {
        console.warn('Firebase liveMatches removal notice:', e);
        errors.push('Firebase: ' + (e.message || e));
      }
    }

    if (window.TournamentOps && window.CECAuth && window.CECAuth.isApprovedStaff()) {
      try {
        await window.TournamentOps.deleteMatch(matchId);
      } catch (e) {
        console.warn('Google Sheets match deletion notice:', e);
        errors.push('Sheets: ' + (e.message || e));
      }
    }

    if (!this.matches[this.activeMatchId]) {
      this.activeMatchId = Object.keys(this.matches)[0] || null;
    }
    this._notify();
    return { ok: true, matchId: matchId, warnings: errors };
  },

  onMatchesChange: function(fn) {
    this.listeners.push(fn);
  },

  _notify: function() {
    const active = this.getActiveMatch();
    const list = Object.values(this.matches);
    this.listeners.forEach(fn => {
      try { fn(active, list); } catch (e) {}
    });
  },

  /**
   * Converts user stream URLs into responsive embeddable frames
   */
  formatStreamEmbedUrl: function(url) {
    if (!url || !url.trim()) return '';
    url = url.trim();

    // YouTube Live / Watch / Short URLs
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId = '';
      if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split(/[?&]/)[0];
      } else if (url.includes('youtube.com/live/')) {
        videoId = url.split('youtube.com/live/')[1].split(/[?&]/)[0];
      } else if (url.includes('youtube.com/watch')) {
        const match = url.match(/[?&]v=([^&]+)/);
        if (match) videoId = match[1];
      } else if (url.includes('youtube.com/embed/')) {
        videoId = url.split('youtube.com/embed/')[1].split(/[?&]/)[0];
      }
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&rel=0`;
      }
    }

    // Twitch stream. Twitch requires every embedding host to be listed as a
    // `parent`, so the current host and the production Vercel domain are both sent.
    if (url.includes('twitch.tv/')) {
      const parents = [];
      if (window.location.hostname) parents.push(window.location.hostname);
      this.STREAM_PARENT_HOSTS.forEach(function (host) {
        if (parents.indexOf(host) < 0) parents.push(host);
      });
      const parentQuery = parents.map(function (host) { return 'parent=' + encodeURIComponent(host); }).join('&');

      const vod = url.match(/twitch\.tv\/videos\/(\d+)/i);
      if (vod) return `https://player.twitch.tv/?video=${vod[1]}&${parentQuery}&autoplay=true`;

      const channel = url.split('twitch.tv/')[1].split(/[?&/]/)[0];
      if (channel) return `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&${parentQuery}&autoplay=true`;
      return '';
    }

    // Facebook / Discord / Direct Web Frame
    return url;
  }
};

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  window.CECLiveManager.init();
});
