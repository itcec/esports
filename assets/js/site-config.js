/**
 * CEC Esports — Site Content Configuration (Single Source of Truth)
 *
 * Every page-visible fact that appears on more than one page lives here:
 * registration deadlines, event dates, venues, roster sizes, contact details
 * and the division/department lists used by registration.
 *
 * Pages must NOT hardcode these facts. Instead they mark up an element with
 * `data-cec="<dotted.path>"` and this script fills in the text on load, e.g.
 *
 *   <span data-cec="reg.deadline">September 1, 2026</span>
 *
 * The literal text inside the tag is only a no-JS fallback; the bound value wins.
 *
 * Admin edits made through the CMS (admin.html -> Firebase `cms` node) are merged
 * on top of these defaults, so changing the deadline once updates every page.
 */

(function (window) {
  'use strict';

  var CMS_CACHE_KEY = 'cec_esports_cms_cache';

  /* ------------------------------------------------------------------ *
   * Canonical event facts
   * Sources: "INTRAMURALS - Tournament Rules and Guidelines (Update).docx"
   *          "SHS Showdown - Event Form.docx"
   * ------------------------------------------------------------------ */
  var DEFAULTS = {
    org: {
      name: 'CEC Blue Dragon Esports',
      school: 'Cebu Eastern College, Incorporated',
      schoolShort: 'Cebu Eastern College',
      game: 'Mobile Legends: Bang Bang',
      gameShort: 'MLBB'
    },

    contact: {
      coordinator: 'Mr. Jade Louis S. Cabucos',
      coordinatorTitle: 'Esports Coordinator',
      email: 'jlcabucos.cec@gmail.com'
    },

    roster: {
      starters: '5',
      subs: '2',
      summary: '5 starters + up to 2 substitute players'
    },

    /* ---- Event 1: CEC Esports Intramurals 2026 (College + Faculty) ---- */
    event: {
      key: 'intramurals',
      name: 'CEC Esports Intramurals 2026',
      shortName: 'Intramurals 2026',
      tagline: 'Collegiate Mobile Legends Intramurals',
      venue: 'Computer Laboratory Annex Building',
      venueShort: 'Annex Lab',
      mode: 'Online'
    },

    reg: {
      deadline: 'September 1, 2026',
      desc: 'Confirm and register your team roster with CEC Blue Dragon Esports.'
    },

    kickoff: {
      date: 'September 5, 2026',
      badge: 'SATURDAYS',
      desc: 'Student divisions play Saturdays, 2:00–5:00 PM online.',
      time: '2:00 – 5:00 PM'
    },

    finals: {
      date: 'October 2, 2026',
      badge: 'FINALS DAY',
      desc: 'Department champions clash for the ultimate Intramurals crown.'
    },

    faculty: {
      dates: 'September 11 and 18, 2026',
      datesShort: 'Sep 11 & 18',
      qfDate: 'September 11, 2026',      // quarterfinals
      finalDate: 'September 18, 2026',   // semis, 3rd/4th and final
      time: '2:00 – 5:00 PM'
    },

    /* ---- Event 2: CEC Intramurals 2026 — Senior High School Showdown ---- */
    shs: {
      key: 'shs',
      name: 'CEC Intramurals 2026: Senior High School Showdown',
      shortName: 'SHS Showdown',
      tagline: 'One-day, in-person MLBB tournament for Senior High School departments',
      date: 'September 11, 2026',
      time: '8:00 AM – 2:00 PM',
      callTime: '8:00 AM',
      venue: 'Auditorium Hall, CEC, Inc. Jakosalem Campus',
      venueShort: 'Auditorium Hall',
      mode: 'In-person',
      reg: {
        deadline: 'September 10, 2026',
        desc: 'Register in advance and coordinate requirements with your Esports Head Manager.'
      },
      format: {
        elims: 'Single Elimination (Best-of-1)',
        semis: 'Best-of-3',
        finals: 'Best-of-3'
      },
      // Official program flow from the SHS Showdown event form. Rendered on both
      // the schedule and the rules page from this one list.
      program: [
        ['8:00 – 8:50 AM', 'Registration and Team Check-In', 'All registered teams must be at the venue by 8:00 AM.'],
        ['8:50 – 9:00 AM', 'Bracket Draw and Mechanics Briefing', 'Official tournament brackets posted live on-site.'],
        ['9:00 – 11:00 AM', 'Elimination Round', 'Single Elimination (Best-of-1) — all SHS department teams.'],
        ['11:00 – 11:15 AM', 'Short Break', ''],
        ['11:15 AM – 12:15 PM', 'Semifinals', 'Best-of-3 (BO3).'],
        ['12:15 – 12:30 PM', 'Break / Finals Stage Set-Up', ''],
        ['12:30 – 1:30 PM', 'Finals', 'Best-of-3 (BO3) — Championship Match.'],
        ['1:30 – 2:00 PM', 'Closing Remarks / End of Program', '']
      ],
      programNote: 'Round format and timing may be adjusted by the organizers based on the final number of registered teams.'
    }
  };

  /* ------------------------------------------------------------------ *
   * Division / department lists used by registration and admin screens
   * ------------------------------------------------------------------ */
  var EVENTS = [
    {
      value: 'intramurals',
      label: 'CEC Esports Intramurals 2026 (College & Faculty)',
      hint: 'Online · Saturdays, Sep 5 – Oct 2',
      divisions: [
        { value: "Men's", label: "Student — Men's (College)" },
        { value: "Women's", label: "Student — Women's (College)" },
        { value: 'Faculty', label: 'Faculty Exhibition (Friendly)' }
      ]
    },
    {
      value: 'shs',
      label: 'SHS Showdown (Senior High School)',
      hint: 'In-person · Sep 11, Auditorium Hall',
      divisions: [
        { value: 'SHS', label: 'Senior High School Showdown' }
      ]
    }
  ];

  var DEPARTMENTS = {
    "Men's": ['IT', 'HTM', 'CTE', 'CRIM'],
    "Women's": ['IT', 'HTM', 'CTE', 'CRIM'],
    'Faculty': ['IT', 'CTE-A', 'CTE-B', 'HM', 'TM', 'CRIM', 'SHS', 'JHS'],
    'SHS': ['STEM', 'ABM', 'HUMSS', 'GAS', 'TVL-ICT', 'TVL-HE']
  };

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  // "September 4, 2026" -> { month:'September', day:'4', year:'2026' }
  function parseDate(str) {
    var m = /^\s*([A-Za-z]+)\s+(\d{1,2})\s*,?\s*(\d{4})?/.exec(String(str || ''));
    if (!m) return null;
    var month = m[1];
    var canonical = null;
    for (var i = 0; i < MONTHS.length; i++) {
      if (MONTHS[i].toLowerCase().indexOf(month.toLowerCase().replace('.', '')) === 0) {
        canonical = MONTHS[i];
        break;
      }
    }
    if (!canonical) return null;
    return { month: canonical, day: m[2], year: m[3] || '' };
  }

  // Derived spellings so a single stored date drives every format on the site.
  function dateVariants(str) {
    var p = parseDate(str);
    var full = String(str || '');
    if (!p) {
      return { full: full, upper: full.toUpperCase(), short: full.toUpperCase(), compact: full, dayMonth: full };
    }
    return {
      full: p.month + ' ' + p.day + (p.year ? ', ' + p.year : ''),
      upper: (p.month + ' ' + p.day + (p.year ? ', ' + p.year : '')).toUpperCase(),
      short: p.month.slice(0, 3).toUpperCase() + ' ' + p.day,        // "SEP 4"
      compact: p.month.slice(0, 3) + (p.month.length > 3 ? '.' : '') + ' ' + p.day, // "Sep. 4"
      dayMonth: p.month + ' ' + p.day                                  // "September 4"
    };
  }

  function isPlainObject(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
  }

  function deepMerge(base, override) {
    var out = {};
    var k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    if (!isPlainObject(override)) return out;
    for (k in override) {
      if (!Object.prototype.hasOwnProperty.call(override, k)) continue;
      var ov = override[k];
      if (ov === undefined || ov === null || ov === '') continue;
      out[k] = (isPlainObject(ov) && isPlainObject(out[k])) ? deepMerge(out[k], ov) : ov;
    }
    return out;
  }

  function resolve(obj, path) {
    var parts = String(path || '').split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  // Built with DOM nodes rather than an HTML string so config values can never
  // be interpreted as markup.
  function buildProgramRow(row, compact) {
    var wrap = document.createElement('div');
    wrap.className = compact
      ? 'flex flex-col sm:flex-row sm:gap-md gap-xs py-sm'
      : 'p-md flex flex-col sm:flex-row sm:gap-md gap-xs';

    var timeCol = document.createElement('div');
    timeCol.className = 'sm:w-48 shrink-0';
    var time = document.createElement('div');
    time.className = 'font-body-lg text-body-lg text-on-surface font-bold';
    time.textContent = row[0];
    timeCol.appendChild(time);

    var body = document.createElement('div');
    body.className = 'flex-1';
    var title = document.createElement('div');
    title.className = 'font-body-md text-body-md text-on-surface font-bold';
    title.textContent = row[1];
    body.appendChild(title);
    if (row[2]) {
      var desc = document.createElement('div');
      desc.className = 'font-body-md text-body-md text-on-surface-variant';
      desc.textContent = row[2];
      body.appendChild(desc);
    }

    wrap.appendChild(timeCol);
    wrap.appendChild(body);
    return wrap;
  }

  /* ------------------------------------------------------------------ *
   * Public API
   * ------------------------------------------------------------------ */
  var CECSite = {
    data: null,
    events: EVENTS,
    departments: DEPARTMENTS,
    _listeners: [],
    _bound: false,

    /**
     * Reads the CMS overrides the admin panel writes and maps the CMS's flat
     * key names onto this config's shape, so one admin edit reaches every page.
     */
    _cmsOverrides: function (cms) {
      if (!isPlainObject(cms)) return {};
      var ev = cms.eventDetails || {};
      var out = { reg: {}, kickoff: {}, finals: {}, event: {}, shs: { reg: {} } };

      if (ev.regDeadlineDate) out.reg.deadline = ev.regDeadlineDate;
      if (ev.regDeadlineDesc) out.reg.desc = ev.regDeadlineDesc;
      if (ev.kickoffDate) out.kickoff.date = ev.kickoffDate;
      if (ev.kickoffBadge) out.kickoff.badge = ev.kickoffBadge;
      if (ev.kickoffDesc) out.kickoff.desc = ev.kickoffDesc;
      if (ev.finalsDate) out.finals.date = ev.finalsDate;
      if (ev.finalsBadge) out.finals.badge = ev.finalsBadge;
      if (ev.finalsDesc) out.finals.desc = ev.finalsDesc;
      if (ev.venue) out.event.venue = ev.venue;

      // SHS Showdown block (added alongside the original CMS schema)
      if (ev.shsDate) out.shs.date = ev.shsDate;
      if (ev.shsTime) out.shs.time = ev.shsTime;
      if (ev.shsVenue) out.shs.venue = ev.shsVenue;
      if (ev.shsRegDeadline) out.shs.reg.deadline = ev.shsRegDeadline;

      return out;
    },

    _readCmsCache: function () {
      try {
        var raw = window.localStorage.getItem(CMS_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    /** Rebuilds `data` from DEFAULTS + CMS overrides and recomputes derived values. */
    _rebuild: function (cms) {
      var merged = deepMerge(DEFAULTS, this._cmsOverrides(cms));

      // Derived date spellings — always computed, never stored, so they can
      // never drift from the date they describe.
      merged.reg.date = dateVariants(merged.reg.deadline);
      merged.reg.deadlineShort = merged.reg.date.short;
      merged.reg.deadlineUpper = merged.reg.date.upper;
      merged.reg.deadlineCompact = merged.reg.date.compact;
      merged.reg.deadlineDayMonth = merged.reg.date.dayMonth;
      merged.reg.badge = 'CLOSES ' + merged.reg.date.short;
      merged.reg.heroBadge = 'REGISTRATION OPEN · CLOSES ' + merged.reg.date.short;
      merged.reg.closesLine = 'REGISTRATION CLOSES ' + merged.reg.date.upper;

      merged.contact.mailto = 'mailto:' + merged.contact.email;

      merged.kickoff.dateShort = dateVariants(merged.kickoff.date).short;
      merged.finals.dateShort = dateVariants(merged.finals.date).short;
      merged.finals.dateDayMonth = dateVariants(merged.finals.date).dayMonth;
      merged.kickoff.dateDayMonth = dateVariants(merged.kickoff.date).dayMonth;
      merged.faculty.qfDateDayMonth = dateVariants(merged.faculty.qfDate).dayMonth;
      merged.faculty.finalDateDayMonth = dateVariants(merged.faculty.finalDate).dayMonth;
      merged.finals.dateUpper = dateVariants(merged.finals.date).upper;

      var s = dateVariants(merged.shs.reg.deadline);
      merged.shs.reg.deadlineShort = s.short;
      merged.shs.reg.deadlineUpper = s.upper;
      merged.shs.reg.deadlineCompact = s.compact;
      merged.shs.reg.badge = 'CLOSES ' + s.short;
      merged.shs.reg.closesLine = 'REGISTRATION CLOSES ' + s.upper;

      var sd = dateVariants(merged.shs.date);
      merged.shs.dateShort = sd.short;
      merged.shs.dateUpper = sd.upper;
      merged.shs.dateDayMonth = sd.dayMonth;

      this.data = merged;
      return merged;
    },

    get: function (path, fallback) {
      if (!this.data) this._rebuild(this._readCmsCache());
      var v = resolve(this.data, path);
      return (v === undefined || v === null) ? (fallback === undefined ? '' : fallback) : v;
    },

    /**
     * Expands `{dotted.path}` tokens inside a string against this config, so
     * free-text content (CMS announcement copy, page blurbs) can quote a fact
     * without ever holding its own stale copy of it.
     *
     *   format('Registration closes {reg.deadline}!')
     *     -> 'Registration closes September 4, 2026!'
     *
     * An unknown token is left untouched, so a typo is visible rather than silent.
     */
    format: function (str) {
      if (typeof str !== 'string' || str.indexOf('{') === -1) return str;
      if (!this.data) this._rebuild(this._readCmsCache());
      var self = this;
      return str.replace(/\{([a-zA-Z0-9_.]+)\}/g, function (whole, path) {
        var v = resolve(self.data, path);
        return (v === undefined || v === null || typeof v === 'object') ? whole : String(v);
      });
    },

    /** Divisions available for an event key ('intramurals' | 'shs'). */
    divisionsFor: function (eventKey) {
      for (var i = 0; i < EVENTS.length; i++) {
        if (EVENTS[i].value === eventKey) return EVENTS[i].divisions.slice();
      }
      return [];
    },

    /** Departments available for a division value. */
    departmentsFor: function (division) {
      return (DEPARTMENTS[division] || []).slice();
    },

    // Division and department are packed into one stored `Course` string as
    // "<Division> — <Department>". Only a dash *surrounded by whitespace* (or an
    // en/em dash, colon, pipe, middot) separates the two halves, so department
    // names that contain their own hyphen -- CTE-A, CTE-B, TVL-ICT, TVL-HE --
    // survive the split intact.
    COURSE_SEPARATOR: /\s*[–—:|·]\s*|\s+-\s+/,

    /**
     * Maps a stored `Course` value back to the division key the public pages use
     * for their tabs. Only the division half is probed, so a Faculty team whose
     * *department* is SHS ("Faculty — SHS") stays in the Faculty division.
     */
    divisionKeyFromCourse: function (course) {
      var c = String(course || '');
      var head = c.split(this.COURSE_SEPARATOR)[0].trim() || c;
      if (/women/i.test(head)) return 'womens';          // must precede /men/
      if (/faculty|exhibition/i.test(head)) return 'faculty';
      if (/^shs\b|senior high/i.test(head)) return 'shs';
      if (/men/i.test(head)) return 'mens';
      return '';
    },

    /** Department half of a stored `Course` value, upper-cased. */
    departmentFromCourse: function (course) {
      var parts = String(course || '').split(this.COURSE_SEPARATOR);
      return parts.length > 1 ? parts[parts.length - 1].trim().toUpperCase() : '';
    },

    /** Event key that owns a division value — used when reading stored records back. */
    eventForDivision: function (division) {
      for (var i = 0; i < EVENTS.length; i++) {
        for (var j = 0; j < EVENTS[i].divisions.length; j++) {
          if (EVENTS[i].divisions[j].value === division) return EVENTS[i].value;
        }
      }
      return '';
    },

    onChange: function (fn) {
      if (typeof fn !== 'function') return;
      this._listeners.push(fn);
      if (this.data) fn(this.data);
    },

    _notify: function () {
      var d = this.data;
      for (var i = 0; i < this._listeners.length; i++) {
        try { this._listeners[i](d); } catch (e) { /* a bad listener must not stop the rest */ }
      }
    },

    /**
     * Fills every bound element in `root`.
     *  data-cec       -> textContent from a dotted path
     *  data-cec-text  -> textContent from a template containing {dotted.path} tokens
     *  data-cec-attr  -> "href:contact.mailto, title:event.name"
     */
    bind: function (root) {
      if (!this.data) this._rebuild(this._readCmsCache());
      root = root || document;

      var nodes = root.querySelectorAll('[data-cec]');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var val = resolve(this.data, el.getAttribute('data-cec'));
        if (val !== undefined && val !== null && typeof val !== 'object') {
          el.textContent = String(val);
        }
      }

      var tplNodes = root.querySelectorAll('[data-cec-text]');
      for (var t = 0; t < tplNodes.length; t++) {
        tplNodes[t].textContent = this.format(tplNodes[t].getAttribute('data-cec-text'));
      }

      // Renders the SHS Showdown program flow from the one list in this config,
      // so the schedule page and the rules page can never show different timings.
      var progNodes = root.querySelectorAll('[data-cec-program]');
      for (var g = 0; g < progNodes.length; g++) {
        var host = progNodes[g];
        var rows = resolve(this.data, host.getAttribute('data-cec-program'));
        if (!Array.isArray(rows)) continue;
        var compact = host.getAttribute('data-cec-program-style') === 'compact';
        host.innerHTML = '';
        for (var r = 0; r < rows.length; r++) {
          host.appendChild(buildProgramRow(rows[r], compact));
        }
      }

      var attrNodes = root.querySelectorAll('[data-cec-attr]');
      for (var n = 0; n < attrNodes.length; n++) {
        var ael = attrNodes[n];
        var pairs = ael.getAttribute('data-cec-attr').split(',');
        for (var p = 0; p < pairs.length; p++) {
          var bits = pairs[p].split(':');
          if (bits.length < 2) continue;
          var attr = bits[0].trim();
          var av = resolve(this.data, bits.slice(1).join(':').trim());
          if (av !== undefined && av !== null && typeof av !== 'object') {
            ael.setAttribute(attr, String(av));
          }
        }
      }
    },

    /**
     * Binds now from cache, then re-binds if Firebase pushes a newer CMS record,
     * so an admin's edit reaches open pages without a reload.
     */
    init: function () {
      var self = this;
      self._rebuild(self._readCmsCache());
      self.bind(document);
      self._notify();

      if (self._bound) return;
      self._bound = true;

      if (window.CECCMSManager && typeof window.CECCMSManager.onConfigChange === 'function') {
        window.CECCMSManager.onConfigChange(function (cfg) {
          self._rebuild(cfg);
          self.bind(document);
          self._notify();
        });
      } else if (window.CECFirebase && typeof window.CECFirebase.init === 'function') {
        // Public pages read the `cms` node directly (it is world-readable) so an
        // admin's content edit reaches visitors who have no local CMS cache.
        window.CECFirebase.init().then(function (fb) {
          if (!fb || !fb.db) return;
          fb.db.ref('cms').on('value', function (snap) {
            var val = snap.val();
            if (!val) return;
            try { window.localStorage.setItem(CMS_CACHE_KEY, JSON.stringify(val)); } catch (e) {}
            self._rebuild(val);
            self.bind(document);
            self._notify();
          }, function () { /* offline or rules changed — defaults already applied */ });
        }).catch(function () { /* keep defaults */ });
      }

      // Another tab (or the admin panel) saved new content.
      window.addEventListener('storage', function (e) {
        if (e.key !== CMS_CACHE_KEY) return;
        self._rebuild(self._readCmsCache());
        self.bind(document);
        self._notify();
      });
    }
  };

  /* ------------------------------------------------------------------ *
   * Global Cyberpunk Scrollbar & OBS Studio Integration
   * Ensures scrolls are active & styled on all pages, while providing
   * seamless 1080p / transparent overlay support for OBS Studio.
   * ------------------------------------------------------------------ */
  function initScrollAndObs() {
    var params = new URLSearchParams(window.location.search);
    var isObs = params.has('obs') || params.has('overlay') || params.has('stream') ||
      typeof window.obsstudio !== 'undefined' ||
      (navigator.userAgent && /OBS\/|obs-browser/i.test(navigator.userAgent));

    var docEl = document.documentElement;

    if (isObs) {
      docEl.classList.add('obs-mode');
      var transparent = params.has('transparent') || params.has('alpha') || params.get('bg') === 'transparent';
      if (transparent) docEl.classList.add('obs-transparent');
      var view = params.get('view');
      if (view) docEl.classList.add('obs-view-' + view);
    }

    // Inject high-priority global scrollbar & OBS styles
    if (!document.getElementById('cec-global-scroll-obs')) {
      var style = document.createElement('style');
      style.id = 'cec-global-scroll-obs';
      style.textContent = [
        '/* CEC Esports Cyberpunk Scrollbars (Visible & Draggable for All Browsers) */',
        'html, body {',
        '  scrollbar-width: thin !important;',
        '  scrollbar-color: #1e3a5f #050B14 !important;',
        '  overscroll-behavior-y: auto !important;',
        '}',
        '::-webkit-scrollbar {',
        '  width: 10px !important;',
        '  height: 10px !important;',
        '  display: block !important;',
        '}',
        '::-webkit-scrollbar-track {',
        '  background: #050B14 !important;',
        '}',
        '::-webkit-scrollbar-thumb {',
        '  background: #1e3a5f !important;',
        '  border-radius: 5px !important;',
        '  border: 2px solid #050B14 !important;',
        '}',
        '::-webkit-scrollbar-thumb:hover {',
        '  background: #1264ff !important;',
        '  box-shadow: 0 0 8px rgba(18, 100, 255, 0.7) !important;',
        '}',
        '::-webkit-scrollbar-corner {',
        '  background: #050B14 !important;',
        '}',
        '/* Elements explicitly flagged to hide scrollbars (horizontal chip bars, etc.) */',
        '.no-scrollbar::-webkit-scrollbar {',
        '  display: none !important;',
        '  width: 0 !important;',
        '  height: 0 !important;',
        '}',
        '.no-scrollbar {',
        '  -ms-overflow-style: none !important;',
        '  scrollbar-width: none !important;',
        '}',
        '',
        '/* ========================================================================== */',
        '/* OBS Studio Browser Source Mode (Active when in OBS or ?obs=1)               */',
        '/* ========================================================================== */',
        '.obs-mode header,',
        '.obs-mode footer,',
        '.obs-mode #cms-announcement-banner,',
        '.obs-mode #nav-toggle,',
        '.obs-mode #mobile-nav,',
        '.obs-mode #obs-overlay-launcher-btn,',
        '.obs-mode #schedule-section,',
        '.obs-mode .obs-hide {',
        '  display: none !important;',
        '}',
        '.obs-mode main {',
        '  padding-top: 0 !important;',
        '  margin-top: 0 !important;',
        '}',
        '.obs-mode, .obs-mode body, .obs-mode * {',
        '  scrollbar-width: none !important;',
        '  -ms-overflow-style: none !important;',
        '}',
        '.obs-mode ::-webkit-scrollbar {',
        '  display: none !important;',
        '  width: 0 !important;',
        '  height: 0 !important;',
        '}',
        '.obs-mode.obs-transparent,',
        '.obs-mode.obs-transparent body {',
        '  background: transparent !important;',
        '  background-color: transparent !important;',
        '}',
        '.obs-mode.obs-transparent .site-bg,',
        '.obs-mode.obs-transparent .site-overlay {',
        '  display: none !important;',
        '  opacity: 0 !important;',
        '}',
        '',
        '/* OBS View: Scoreboard Only Overlay */',
        '.obs-mode.obs-view-scoreboard #live-switcher-bar,',
        '.obs-mode.obs-view-scoreboard #live-match-chips,',
        '.obs-mode.obs-view-scoreboard #live-standby,',
        '.obs-mode.obs-view-scoreboard #live-stream-player-wrapper,',
        '.obs-mode.obs-view-scoreboard #roster-section-wrap,',
        '.obs-mode.obs-view-scoreboard #schedule-section,',
        '.obs-mode.obs-view-scoreboard section:not(:first-child) {',
        '  display: none !important;',
        '}',
        '.obs-mode.obs-view-scoreboard section:first-child {',
        '  padding: 8px 12px !important;',
        '  background: transparent !important;',
        '  border: none !important;',
        '}',
        '.obs-mode.obs-view-scoreboard #match-versus-card {',
        '  max-width: 1400px;',
        '  margin: 0 auto;',
        '}',
        '',
        '/* OBS View: Roster Spotlight Only */',
        '.obs-mode.obs-view-spotlight #live-switcher-bar,',
        '.obs-mode.obs-view-spotlight #live-match-chips,',
        '.obs-mode.obs-view-spotlight #live-standby,',
        '.obs-mode.obs-view-spotlight #match-versus-card,',
        '.obs-mode.obs-view-spotlight #live-stream-player-wrapper,',
        '.obs-mode.obs-view-spotlight #schedule-section,',
        '.obs-mode.obs-view-spotlight section:not(:first-child) {',
        '  display: none !important;',
        '}',
        '.obs-mode.obs-view-spotlight section:first-child {',
        '  padding: 12px !important;',
        '  background: transparent !important;',
        '  border: none !important;',
        '}',
        '',
        '/* OBS View: Video Stream / Observer Feed Only */',
        '.obs-mode.obs-view-feed #live-switcher-bar,',
        '.obs-mode.obs-view-feed #live-match-chips,',
        '.obs-mode.obs-view-feed #live-standby,',
        '.obs-mode.obs-view-feed #match-versus-card,',
        '.obs-mode.obs-view-feed #roster-section-wrap,',
        '.obs-mode.obs-view-feed #schedule-section,',
        '.obs-mode.obs-view-feed section:not(:first-child) {',
        '  display: none !important;',
        '}'
      ].join('\n');
      (document.head || document.documentElement).appendChild(style);
    }
  }

  initScrollAndObs();

  window.CECSite = CECSite;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initScrollAndObs();
      CECSite.init();
    });
  } else {
    initScrollAndObs();
    CECSite.init();
  }
})(window);
