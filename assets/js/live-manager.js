/**
 * CEC Esports Intramurals 2026 — Multi-Game Live Stream & Match Manager
 * Synchronizes multiple concurrent matches (1 to 12+ live games) in Realtime Database with instant switcher.
 */

window.CECLiveManager = {
  activeMatchId: 'MATCH-001',
  matches: {},
  publicTeams: {},
  listeners: [],

  // 12 Standard Intramurals Department Match Presets
  DEFAULT_MATCHES: {
    'MATCH-001': {
      id: 'MATCH-001',
      title: 'Court 1 · Men\'s Semifinal 1',
      court: 'Court 1 (Annex Lab 1)',
      division: 'Student Men\'s',
      stageTitle: 'MEN\'S DIVISION · SEMIFINALS (BO3)',
      formatBadge: 'BO3 · GAME 3',
      statusNote: 'MATCH POINT · MAP: SANCTUM',
      status: 'LIVE',
      streamUrl: '',
      startedAt: '2:00 PM',
      team1: {
        name: 'IT TITAN DRAGONS',
        dept: 'IT',
        score: '2',
        icon: 'assets/icons/lorc/dragon-head.svg',
        color: '#1264ff',
        seed: '3-0 · SEED #1',
        sub: 'College of Computer Studies',
        captain: 'SlayerX (Juan Dela Cruz)',
        roster: [
          { num: 1, ign: 'SlayerX', real: 'Juan Dela Cruz', role: 'JUNGLER / LING', isCap: true },
          { num: 2, ign: 'Viper_CEC', real: 'Mark Rivera', role: 'MID LANE / VALENTINA' },
          { num: 3, ign: 'KuroBlade', real: 'John Santos', role: 'GOLD LANE / BEATRIX' },
          { num: 4, ign: 'ShieldMaster', real: 'Carl Reyes', role: 'ROAMER / TIGREAL' },
          { num: 5, ign: 'DragonLord', real: 'Dave Garcia', role: 'EXP LANE / YU ZHONG' }
        ],
        subs: 'Shadow (Christian Lim), Ace (Kenneth Tan)'
      },
      team2: {
        name: 'CRIM IRON WEREWOLVES',
        dept: 'CRIM',
        score: '1',
        icon: 'assets/icons/lorc/werewolf.svg',
        color: '#ff4b4b',
        seed: '3-0 · SEED #2',
        sub: 'College of Criminology',
        captain: 'WolfAlpha (Ricardo Gomez)',
        roster: [
          { num: 1, ign: 'WolfAlpha', real: 'Ricardo Gomez', role: 'JUNGLER / LANCELOT', isCap: true },
          { num: 2, ign: 'CrimsonFury', real: 'Marco Silva', role: 'MID LANE / PHARSA' },
          { num: 3, ign: 'GhostMarksman', real: 'Eduardo Ramos', role: 'GOLD LANE / CLAUDE' },
          { num: 4, ign: 'IronTitan', real: 'Gabriel Perez', role: 'ROAMER / KHUFRA' },
          { num: 5, ign: 'BrawlerJax', real: 'Jerome Alvarez', role: 'EXP LANE / CHOU' }
        ],
        subs: 'NightHawk (Joshua Mendoza), Reaper (Alvin Castro)'
      }
    },
    'MATCH-002': {
      id: 'MATCH-002',
      title: 'Court 2 · Men\'s Semifinal 2',
      court: 'Court 2 (Annex Lab 2)',
      division: 'Student Men\'s',
      stageTitle: 'MEN\'S DIVISION · SEMIFINALS (BO3)',
      formatBadge: 'BO3 · GAME 2',
      statusNote: 'TIED 1-1 · MAP: SANCTUM',
      status: 'LIVE',
      streamUrl: '',
      startedAt: '2:15 PM',
      team1: {
        name: 'HTM GOLDEN WYVERNS',
        dept: 'HTM',
        score: '1',
        icon: 'assets/icons/lorc/wyvern.svg',
        color: '#ffb020',
        seed: '2-1 · SEED #3',
        sub: 'College of Hospitality & Tourism',
        captain: 'SolarFlare (Paul Lim)',
        roster: [
          { num: 1, ign: 'SolarFlare', real: 'Paul Lim', role: 'JUNGLER / HAYABUSA', isCap: true },
          { num: 2, ign: 'SunGoddess', real: 'Ana Cruz', role: 'MID LANE / KAGURA' },
          { num: 3, ign: 'GoldenShot', real: 'Leo Tan', role: 'GOLD LANE / BRODY' },
          { num: 4, ign: 'AegisShield', real: 'Sam Sy', role: 'ROAMER / ATLAS' },
          { num: 5, ign: 'WildBlade', real: 'Ron Uy', role: 'EXP LANE / LAPU-LAPU' }
        ],
        subs: 'Ray (Kevin Ong), Nova (Kyle Go)'
      },
      team2: {
        name: 'CTE EMERALD HYDRAS',
        dept: 'CTE',
        score: '1',
        icon: 'assets/icons/lorc/hydra.svg',
        color: '#00e676',
        seed: '2-1 · SEED #4',
        sub: 'College of Teacher Education',
        captain: 'HydraVenom (Eric Yap)',
        roster: [
          { num: 1, ign: 'HydraVenom', real: 'Eric Yap', role: 'JUNGLER / FANNY', isCap: true },
          { num: 2, ign: 'MysticChant', real: 'Joy Santos', role: 'MID LANE / YVE' },
          { num: 3, ign: 'EagleEye', real: 'Neil Torres', role: 'GOLD LANE / WANWAN' },
          { num: 4, ign: 'GreenGolem', real: 'Mark Co', role: 'ROAMER / MINOTAUR' },
          { num: 5, ign: 'TimberLord', real: 'Ben Chua', role: 'EXP LANE / PAQUITO' }
        ],
        subs: 'Fern (Derrick Yu), Ivy (Jason Tan)'
      }
    },
    'MATCH-003': {
      id: 'MATCH-003',
      title: 'Court 3 · Women\'s Semifinal 1',
      court: 'Court 3 (Annex Lab 3)',
      division: 'Student Women\'s',
      stageTitle: 'WOMEN\'S DIVISION · SEMIFINALS (BO3)',
      formatBadge: 'BO3 · GAME 1',
      statusNote: 'FIRST GAME UNDERWAY',
      status: 'LIVE',
      streamUrl: '',
      startedAt: '2:30 PM',
      team1: {
        name: 'IT CYBER VALKYRIES',
        dept: 'IT',
        score: '1',
        icon: 'assets/icons/delapouite/horus.svg',
        color: '#00e5ff',
        seed: '3-0 · SEED #1',
        sub: 'College of Computer Studies',
        captain: 'ValkyriePrime (Sarah Tan)',
        roster: [
          { num: 1, ign: 'ValkyriePrime', real: 'Sarah Tan', role: 'JUNGLER / BENEDETTA', isCap: true },
          { num: 2, ign: 'NeonStar', real: 'Mia Gomez', role: 'MID LANE / LYLIA' },
          { num: 3, ign: 'CyberArrow', real: 'Chloe Rivera', role: 'GOLD LANE / IXYA' },
          { num: 4, ign: 'LotusGuard', real: 'Jenna Sy', role: 'ROAMER / MATHILDA' },
          { num: 5, ign: 'FrostQueen', real: 'Ashley Lim', role: 'EXP LANE / RUBY' }
        ],
        subs: 'Pixie (Bea Uy), Luna (Camille Go)'
      },
      team2: {
        name: 'HTM SOLAR SIRENS',
        dept: 'HTM',
        score: '0',
        icon: 'assets/icons/delapouite/griffin-symbol.svg',
        color: '#ffb020',
        seed: '2-1 · SEED #3',
        sub: 'College of Hospitality & Tourism',
        captain: 'SirenSong (Princess Co)',
        roster: [
          { num: 1, ign: 'SirenSong', real: 'Princess Co', role: 'JUNGLER / KARINA', isCap: true },
          { num: 2, ign: 'OceanBloom', real: 'Ella Reyes', role: 'MID LANE / ODETTE' },
          { num: 3, ign: 'GlimmerSniper', real: 'Danica Tan', role: 'GOLD LANE / LESLEY' },
          { num: 4, ign: 'CoralAnchor', real: 'Faye Yap', role: 'ROAMER / LOLITA' },
          { num: 5, ign: 'SunGlaive', real: 'Gia Santos', role: 'EXP LANE / BENEDETTA' }
        ],
        subs: 'Amber (Nicole Go), Ruby (Pat Lim)'
      }
    },
    'MATCH-004': {
      id: 'MATCH-004',
      title: 'Court 4 · Faculty Exhibition Quarterfinal 1',
      court: 'Court 4 (Main Auditorium Arena)',
      division: 'Faculty Exhibition',
      stageTitle: 'FACULTY EXHIBITION · VIP SHOWCASE',
      formatBadge: 'BO1 · EXHIBITION',
      statusNote: 'FRIENDLY SHOWCASE MATCH',
      status: 'LIVE',
      streamUrl: '',
      startedAt: '3:00 PM',
      team1: {
        name: 'IT BYTE MASTERS',
        dept: 'Faculty',
        score: '1',
        icon: 'assets/icons/lorc/dragon-head.svg',
        color: '#1264ff',
        seed: 'FACULTY SEED #1',
        sub: 'Faculty of Computer Studies',
        captain: 'Prof. R. Tan',
        roster: [
          { num: 1, ign: 'CodeMaster', real: 'Prof. R. Tan', role: 'JUNGLER / AAMON', isCap: true },
          { num: 2, ign: 'SysAdmin', real: 'Engr. J. Lim', role: 'MID LANE / EUDORA' },
          { num: 3, ign: 'BitHunter', real: 'Prof. M. Sy', role: 'GOLD LANE / MIYA' },
          { num: 4, ign: 'Firewall', real: 'Prof. D. Co', role: 'ROAMER / FRANCO' },
          { num: 5, ign: 'RootUser', real: 'Prof. K. Ong', role: 'EXP LANE / BALMOND' }
        ],
        subs: 'Kernel (Prof. A. Go), Cyber (Prof. T. Yap)'
      },
      team2: {
        name: 'CRIM GUARDIANS',
        dept: 'Faculty',
        score: '0',
        icon: 'assets/icons/lorc/werewolf.svg',
        color: '#ff4b4b',
        seed: 'FACULTY SEED #2',
        sub: 'Faculty of Criminology',
        captain: 'Prof. K. Dela Cruz',
        roster: [
          { num: 1, ign: 'ChiefMarshal', real: 'Prof. K. Dela Cruz', role: 'JUNGLER / ROGER', isCap: true },
          { num: 2, ign: 'TacticalEye', real: 'Prof. L. Santos', role: 'MID LANE / CECILION' },
          { num: 3, ign: 'Sharpshooter', real: 'Prof. J. Gomez', role: 'GOLD LANE / CLINT' },
          { num: 4, ign: 'RiotShield', real: 'Prof. V. Reyes', role: 'ROAMER / JOHNSON' },
          { num: 5, ign: 'Brawler', real: 'Prof. G. Ramos', role: 'EXP LANE / TIGREAL' }
        ],
        subs: 'Patrol (Prof. C. Tan), Agent (Prof. N. Lim)'
      }
    }
  },

  /**
   * Initialize live match syncing with Firebase Realtime Database
   */
  init: async function() {
    this.matches = this._getLocalMatches();
    await window.CECFirebase.init();
    this._loadPublicTeams();

    if (window.CECFirebase.db) {
      // Listen to Realtime Database /liveMatches
      window.CECFirebase.db.ref('liveMatches').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && Object.keys(data).length > 0) {
          this.matches = data;
          this._enrichMatchesWithPublicTeams();
        } else {
          // If empty, initialize RTDB with default matches
          this._seedDefaultMatchesToDB();
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

  _seedDefaultMatchesToDB: function() {
    if (window.CECFirebase.db) {
      window.CECFirebase.db.ref('liveMatches').set(this.DEFAULT_MATCHES);
      window.CECFirebase.db.ref('activeMatchId').set('MATCH-001');
    }
  },

  _getLocalMatches: function() {
    try {
      const saved = localStorage.getItem('CEC_LIVE_MATCHES');
      return saved ? JSON.parse(saved) : this.DEFAULT_MATCHES;
    } catch (e) {
      return this.DEFAULT_MATCHES;
    }
  },

  _saveLocalMatches: function() {
    try {
      localStorage.setItem('CEC_LIVE_MATCHES', JSON.stringify(this.matches));
    } catch (e) {}
  },

  getActiveMatch: function() {
    return this.matches[this.activeMatchId] || Object.values(this.matches)[0] || this.DEFAULT_MATCHES['MATCH-001'];
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
    this._notify();
    return matchData;
  },

  deleteMatch: async function(matchId) {
    delete this.matches[matchId];
    this._saveLocalMatches();

    if (window.CECFirebase.db) {
      await window.CECFirebase.db.ref('liveMatches/' + matchId).remove();
    }
    this.activeMatchId = Object.keys(this.matches)[0] || 'MATCH-001';
    this._notify();
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

    // Twitch Stream
    if (url.includes('twitch.tv/')) {
      const channel = url.split('twitch.tv/')[1].split(/[?&/]/)[0];
      return `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname || 'localhost'}&autoplay=true`;
    }

    // Facebook / Discord / Direct Web Frame
    return url;
  }
};

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  window.CECLiveManager.init();
});
