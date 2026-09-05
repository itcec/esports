/**
 * Shared client for the Google Apps Script registration backend & Tournament Operations.
 */
const REGISTRATION_API_URL = 'https://script.google.com/macros/s/AKfycbxhXkVdmyMYdMvcBTSvVIrVH5LZ6T5v77Z7aKXAt_k67q2cwN3ldII2UtTVBWS63oky/exec';
const ADMIN_KEY = ''; // Legacy stopgap only; use Firebase ID-token auth.
const STAFF_ACTIONS = [
  'listRegistrations', 'getRegistration', 'updateTeamStatus', 'updatePlayerVerification',
  'getPrivateVerificationFile', 'getPrivateVerificationBatch', 'recordMatchResult', 'publishMatch', 'deleteMatch',
  'fileDispute', 'listDisputes', 'resolveDispute', 'saveBracketData', 'deleteBracketData', 'getAuditLogs'
];

function waitForStaffUser() {
  return new Promise(function (resolve, reject) {
    const auth = window.CECAuth;
    if (!auth) return reject(new Error('Staff authentication is not loaded.'));
    if (auth.isResolved) return auth.currentUser ? resolve(auth.currentUser) : reject(new Error('Approved staff sign-in is required.'));
    let done = false;
    const timer = setTimeout(function () { if (!done) { done = true; reject(new Error('Authentication timed out.')); } }, 15000);
    auth.onAuthChange(function (user) {
      if (done) return;
      if (!auth.isResolved) return;
      done = true; clearTimeout(timer);
      user ? resolve(user) : reject(new Error('Approved staff sign-in is required.'));
    });
  });
}

const RegistrationDraft = {
  KEY: 'cecRegistrationDraft',
  get() {
    try {
      const d = JSON.parse(sessionStorage.getItem(this.KEY)) || {};
      if (!d.draftKey) {
        d.draftKey = 'draft_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem(this.KEY, JSON.stringify(d));
      }
      return d;
    } catch (e) {
      return {};
    }
  },
  save(partial) {
    const draft = Object.assign(this.get(), partial);
    sessionStorage.setItem(this.KEY, JSON.stringify(draft));
    return draft;
  },
  clear() { sessionStorage.removeItem(this.KEY); }
};

/** GET is used for reads; POST uses form encoding to avoid a CORS preflight. */
async function callRegistrationApi(action, params, method) {
  method = method || 'POST';
  if (!REGISTRATION_API_URL || REGISTRATION_API_URL.indexOf('PASTE_YOUR') === 0) {
    throw new Error('Registration API is not configured.');
  }
  const url = new URL(REGISTRATION_API_URL);
  url.searchParams.set('action', action);
  const withKey = ADMIN_KEY ? Object.assign({}, params || {}, { adminKey: ADMIN_KEY }) : (params || {});
  if (STAFF_ACTIONS.indexOf(action) !== -1) {
    const user = await waitForStaffUser();
    withKey.idToken = await user.getIdToken();
    // Keep Firebase tokens out of URLs, browser history, and proxy logs.
    if (method === 'GET') method = 'POST';
  }
  let response;
  if (method === 'GET') {
    Object.keys(withKey).forEach((key) => url.searchParams.set(key, withKey[key]));
    response = await fetch(url.toString());
  } else {
    response = await fetch(url.toString(), { method: 'POST', body: new URLSearchParams(withKey) });
  }
  if (!response.ok) throw new Error('Registration API returned HTTP ' + response.status + '.');
  const json = await response.json();
  if (!json.success) throw new Error((json.error && json.error.message) || 'Request failed.');
  return json.data;
}

/**
 * Converts a File object to base64 and uploads it to private Google Drive storage via Apps Script.
 */
async function uploadVerificationDocument(file, docType, metadata) {
  if (!file) throw new Error('No file selected.');
  if (file.size > 5 * 1024 * 1024) throw new Error('File exceeds maximum size limit of 5MB.');
  
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      const comma = res.indexOf(',');
      resolve(comma >= 0 ? res.substring(comma + 1) : res);
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });

  const draft = RegistrationDraft.get();
  const payload = Object.assign({
    fileBase64: base64,
    fileName: file.name,
    mimeType: file.type || 'image/jpeg',
    docType: docType || 'student_id_card',
    draftKey: (metadata && metadata.draftKey) || draft.draftKey || ''
  }, metadata || {});

  return await callRegistrationApi('uploadVerificationFile', payload, 'POST');
}

/** Optional public-facing player image. This is separate from identity proof uploads. */
async function uploadProfileImage(file, metadata) {
  if (!file) throw new Error('No profile image selected.');
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.indexOf(file.type) === -1) throw new Error('Use a JPG, PNG, or WEBP profile image.');
  if (file.size > 1024 * 1024) throw new Error('Profile image exceeds the 1MB limit.');

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.substring(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const draft = RegistrationDraft.get();
  const payload = Object.assign({
    fileBase64: base64,
    fileName: file.name,
    mimeType: file.type,
    draftKey: (metadata && metadata.draftKey) || draft.draftKey || ''
  }, metadata || {});

  return await callRegistrationApi('uploadProfileImage', payload, 'POST');
}

/**
 * Updates a registration's status with a required rejection reason or audit note,
 * and synchronizes with Firebase Realtime Database for instant captain notifications.
 */
async function updateRegistrationStatusWithReason(teamId, status, rejectionReason) {
  if (status === 'Rejected' && (!rejectionReason || !rejectionReason.trim())) {
    throw new Error('A specific rejection reason is required to notify the team captain.');
  }

  const payload = {
    teamId: teamId,
    status: status,
    rejectionReason: (rejectionReason || '').trim(),
    auditNote: (rejectionReason || '').trim()
  };

  const result = await callRegistrationApi('updateTeamStatus', payload, 'POST');

  if (window.CECFirebase) {
    try {
      await window.CECFirebase.init();
      const db = window.CECFirebase.db;
      if (db) {
        await db.ref('registrations/' + teamId).update({
          status: status,
          rejectionReason: (rejectionReason || '').trim(),
          updatedAt: new Date().toISOString(),
          updatedBy: (window.CECAuth && window.CECAuth.currentUser) ? window.CECAuth.currentUser.email : 'coordinator'
        });
      }
    } catch (e) {
      console.warn('Firebase registration status sync notice:', e);
    }
  }

  return result;
}

function normalizeDivisionKey(value) {
  const c = String(value || '').toLowerCase();
  if (c.indexOf('women') !== -1) return 'womens';
  if (c.indexOf('faculty') !== -1 || c.indexOf('exhibition') !== -1) return 'faculty';
  if (c.indexOf('shs') !== -1 || c.indexOf('senior high') !== -1) return 'shs';
  return 'mens';
}

/**
 * A bracket lives under one scope. Men's and Women's run a separate bracket per
 * department plus a division-wide Grand Finals; Faculty and SHS run a single
 * division-wide bracket.
 *
 *   bracketScopeKey('mens', 'IT')  -> 'mens__IT'
 *   bracketScopeKey('mens', '')    -> 'mens'          (Grand Finals / division-wide)
 *   bracketScopeKey('shs')         -> 'shs'
 *
 * Firebase node: brackets/<scope>, with metadata at brackets/<scope>_meta.
 */
function bracketScopeKey(division, department) {
  const div = normalizeDivisionKey(division);
  const dept = String(department == null ? '' : department)
    .trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  return dept ? div + '__' + dept : div;
}

/** Every published scope belonging to a division (its departments + its finals). */
async function listBracketScopes(division) {
  const div = normalizeDivisionKey(division);
  if (!(window.CECFirebase && window.CECFirebase.db)) return [div];
  try {
    const snap = await window.CECFirebase.db.ref('brackets').once('value');
    const all = snap.val() || {};
    const scopes = Object.keys(all).filter(function (k) {
      if (k.slice(-5) === '_meta') return false;
      return k === div || k.indexOf(div + '__') === 0;
    });
    return scopes.length ? scopes : [div];
  } catch (e) {
    return [div];
  }
}

const PublicTournamentApi = {
  listTeams: async function () {
    return await callRegistrationApi('listPublicTeams', {}, 'GET');
  },
  listMatches: async function () {
    const rows = await callRegistrationApi('listMatches', {}, 'GET');
    return (rows || []).map(function (row) {
      return {
        matchId: row.matchId || row.MatchID || '', court: row.court || row.Court || '',
        division: row.division || row.Division || '', stage: row.stage || row.Stage || '',
        team1Id: row.team1Id || row.Team1ID || '', team1Name: row.team1Name || row.Team1Name || 'TBD', team1Score: row.team1Score != null ? row.team1Score : (row.Team1Score || 0),
        team2Id: row.team2Id || row.Team2ID || '', team2Name: row.team2Name || row.Team2Name || 'TBD', team2Score: row.team2Score != null ? row.team2Score : (row.Team2Score || 0),
        status: row.status || row.Status || 'Scheduled', streamUrl: row.streamUrl || row.StreamUrl || '',
        streamPublished: row.streamPublished || row.StreamPublished || '', scheduledAt: row.scheduledAt || row.ScheduledAt || '', submittedAt: row.submittedAt || row.SubmittedAt || ''
      };
    });
  },
  listStandings: async function () {
    return await callRegistrationApi('listStandings', {}, 'GET');
  },
  /** listBracket(division[, department]) — department '' is the division-wide bracket. */
  listBracket: async function (division, department) {
    const div = normalizeDivisionKey(division);
    const scope = bracketScopeKey(division, department);
    if (window.CECFirebase && window.CECFirebase.db) {
      try {
        const snap = await window.CECFirebase.db.ref('brackets/' + scope).once('value');
        const data = snap.val();
        if (data) {
          return Array.isArray(data) ? data : Object.values(data);
        }
      } catch (e) {
        console.warn('Firebase bracket fetch notice, falling back to GAS:', e);
      }
    }
    const query = { division: div };
    if (department !== undefined && department !== null) query.department = String(department);
    return await callRegistrationApi('getBracketData', query, 'GET');
  },

  /**
   * listenBracket(division, department, callback) — the 2-argument form
   * listenBracket(division, callback) still works and watches the
   * division-wide bracket.
   */
  listenBracket: function (division, department, callback) {
    if (typeof department === 'function') {
      callback = department;
      department = '';
    }
    const scope = bracketScopeKey(division, department);
    if (window.CECFirebase && window.CECFirebase.db) {
      const ref = window.CECFirebase.db.ref('brackets/' + scope);
      ref.on('value', (snap) => {
        const data = snap.val();
        const list = data ? (Array.isArray(data) ? data : Object.values(data)) : [];
        try { callback(list); } catch (e) {}
      });
      return () => ref.off();
    }
    return () => {};
  },

  /**
   * Every match in a division, keyed by department ('' = the division-wide
   * bracket). Used by the public bracket page to show each department's champion
   * without opening every bracket in turn.
   */
  listDivisionBrackets: async function (division) {
    const out = {};
    if (!(window.CECFirebase && window.CECFirebase.db)) {
      const rows = await callRegistrationApi('getBracketData',
        { division: normalizeDivisionKey(division) }, 'GET');
      (rows || []).forEach(function (r) {
        const dept = String(r.department || r.Department || '').toUpperCase();
        (out[dept] = out[dept] || []).push(r);
      });
      return out;
    }
    const scopes = await listBracketScopes(division);
    for (const scope of scopes) {
      const dept = scope.indexOf('__') !== -1 ? scope.split('__')[1] : '';
      try {
        const snap = await window.CECFirebase.db.ref('brackets/' + scope).once('value');
        const data = snap.val();
        out[dept] = data ? (Array.isArray(data) ? data : Object.values(data)) : [];
      } catch (e) {
        out[dept] = [];
      }
    }
    return out;
  }
};

/**
 * Securely retrieves private document bytes using authenticated staff ID token.
 */
async function getPrivateVerificationDocument(fileId) {
  if (!fileId) throw new Error('File ID is required.');
  return await callRegistrationApi('getPrivateVerificationFile', { fileId: fileId }, 'POST');
}

/**
 * Securely retrieves multiple private document bytes in batch with parallel fallback.
 */
async function getPrivateVerificationBatch(fileIds) {
  if (!Array.isArray(fileIds) || !fileIds.length) return {};
  try {
    return await callRegistrationApi('getPrivateVerificationBatch', { fileIds: JSON.stringify(fileIds) }, 'POST');
  } catch (err) {
    console.warn('Batch document fetch failed, falling back to parallel requests:', err);
    const results = {};
    await Promise.all(fileIds.map(async (fid) => {
      try {
        results[fid] = await getPrivateVerificationDocument(fid);
      } catch (e) {
        results[fid] = { error: e.message };
      }
    }));
    return results;
  }
}

/**
 * Tournament Operations & Match Officiating API Wrappers
 */
const TournamentOps = {
  recordMatchResult: async function (resultData) {
    const div = normalizeDivisionKey(resultData.division);

    // 1. Sync to Firebase Realtime Database
    if (window.CECFirebase && window.CECFirebase.db) {
      try {
        let targetKey = resultData.matchKey || resultData.matchId;

        // A division now holds one bracket per department plus its Grand Finals,
        // so the match is looked for across every scope in the division. The
        // scope that owns it is also where the winner advances.
        const scopes = resultData.department
          ? [bracketScopeKey(div, resultData.department)]
          : await listBracketScopes(div);

        let targetScope = '';
        let allBracketMatches = {};
        const rt1 = String(resultData.team1Name || '').trim().toLowerCase();
        const rt2 = String(resultData.team2Name || '').trim().toLowerCase();

        for (const scope of scopes) {
          const snap = await window.CECFirebase.db.ref('brackets/' + scope).once('value');
          const rows = snap.val() || {};

          if (targetKey && rows[targetKey]) {
            targetScope = scope;
            allBracketMatches = rows;
            break;
          }
          // Fall back to matching on the pairing when a custom court id was used.
          const foundKey = Object.keys(rows).find(k => {
            const bm = rows[k];
            if (!bm) return false;
            const t1 = String(bm.team1Name || '').trim().toLowerCase();
            const t2 = String(bm.team2Name || '').trim().toLowerCase();
            return (t1 === rt1 && t2 === rt2) || (t1 === rt2 && t2 === rt1);
          });
          if (foundKey) {
            targetKey = foundKey;
            targetScope = scope;
            allBracketMatches = rows;
            break;
          }
        }

        // Update bracket match state, staying inside the scope that owns the match.
        if (targetScope && targetKey && allBracketMatches[targetKey]) {
          const matchRef = window.CECFirebase.db.ref('brackets/' + targetScope + '/' + targetKey);
          await matchRef.update({
            status: 'Completed',
            winnerName: resultData.winnerName || '',
            winnerId: resultData.winnerId || '',
            loserName: resultData.loserName || '',
            score1: resultData.score1 != null ? resultData.score1 : 0,
            score2: resultData.score2 != null ? resultData.score2 : 0,
            updatedAt: new Date().toISOString()
          });

          // Auto-progression: Advance winner to next round in bracket tree with winner ID
          const mData = allBracketMatches[targetKey] || {};
          if (mData.nextMatchKey && mData.nextSlot) {
            const nextRef = window.CECFirebase.db.ref('brackets/' + targetScope + '/' + mData.nextMatchKey);
            const updateField = mData.nextSlot === 'team2' ? 'team2Name' : 'team1Name';
            const idField = mData.nextSlot === 'team2' ? 'team2Id' : 'team1Id';

            let winnerId = resultData.winnerId;
            if (!winnerId) {
              if (String(mData.team1Name || '').trim().toLowerCase() === String(resultData.winnerName || '').trim().toLowerCase()) {
                winnerId = mData.team1Id;
              } else if (String(mData.team2Name || '').trim().toLowerCase() === String(resultData.winnerName || '').trim().toLowerCase()) {
                winnerId = mData.team2Id;
              }
            }

            await nextRef.update({
              [updateField]: resultData.winnerName,
              [idField]: winnerId || ''
            });
          }
        }

        // Remove from active liveMatches
        if (resultData.matchId && window.CECLiveManager) {
          await window.CECLiveManager.deleteMatch(resultData.matchId);
        }
      } catch (fbErr) {
        console.warn('Firebase match progression notice:', fbErr);
      }
    }

    // 2. Persist to Google Sheets
    return await callRegistrationApi('recordMatchResult', {
      ...resultData,
      division: div
    }, 'POST');
  },
  publishMatch: async function (matchData) {
    return await callRegistrationApi('publishMatch', matchData, 'POST');
  },
  deleteMatch: async function (matchId) {
    return await callRegistrationApi('deleteMatch', { matchId: matchId }, 'POST');
  },
  fileDispute: async function (disputeData) {
    return await callRegistrationApi('fileDispute', disputeData, 'POST');
  },
  listDisputes: async function (status) {
    return await callRegistrationApi('listDisputes', { status: status || 'All' }, 'POST');
  },
  resolveDispute: async function (disputeId, status, resolution) {
    return await callRegistrationApi('resolveDispute', { disputeId: disputeId, status: status, resolution: resolution }, 'POST');
  },
  getBracketData: async function (division) {
    return await PublicTournamentApi.listBracket(division);
  },
  /** saveBracketData(division, department, matches, flightTitle) */
  saveBracketData: async function (division, department, matches, flightTitle) {
    const div = normalizeDivisionKey(division);
    const dept = String(department == null ? '' : department).trim().toUpperCase();
    const scope = bracketScopeKey(division, dept);

    // 1. Sync to Firebase Realtime Database. `set` replaces the whole scope, so
    //    republishing a smaller bracket drops the rounds that no longer exist.
    if (window.CECFirebase && window.CECFirebase.db) {
      try {
        const bracketMap = {};
        (matches || []).forEach(m => {
          if (m.matchKey) bracketMap[m.matchKey] = m;
        });
        await window.CECFirebase.db.ref('brackets/' + scope).set(bracketMap);
        await window.CECFirebase.db.ref('brackets/' + scope + '_meta').set({
          title: flightTitle || '',
          division: div,
          department: dept,
          matchCount: (matches || []).length,
          updatedAt: new Date().toISOString()
        });
      } catch (fbErr) {
        console.warn('Firebase bracket sync notice:', fbErr);
      }
    }

    // 2. Persist to Google Sheets
    return await callRegistrationApi('saveBracketData', {
      division: div,
      department: dept,
      matches: JSON.stringify(matches),
      flightTitle: flightTitle || ''
    }, 'POST');
  },
  /** deleteBracketData(division, department) */
  deleteBracketData: async function (division, department) {
    const div = normalizeDivisionKey(division);
    const dept = String(department == null ? '' : department).trim().toUpperCase();
    const scope = bracketScopeKey(division, dept);

    // 1. Remove from Firebase Realtime Database
    if (window.CECFirebase && window.CECFirebase.db) {
      try {
        await window.CECFirebase.db.ref('brackets/' + scope).remove();
        await window.CECFirebase.db.ref('brackets/' + scope + '_meta').remove();
      } catch (fbErr) {
        console.warn('Firebase bracket delete notice:', fbErr);
      }
    }

    // 2. Remove from Google Sheets
    try {
      return await callRegistrationApi('deleteBracketData', {
        division: div,
        department: dept
      }, 'POST');
    } catch (apiErr) {
      console.warn('Backend sheet delete error:', apiErr);
      return { success: true, localOnly: true };
    }
  },
  getAuditLogs: async function () {
    return await callRegistrationApi('getAuditLogs', {}, 'POST');
  }
};

// Expose the shared clients for pages that load this file as a classic script.
window.PublicTournamentApi = PublicTournamentApi;
window.TournamentOps = TournamentOps;
window.RegistrationDraft = RegistrationDraft;
window.uploadVerificationDocument = uploadVerificationDocument;
window.uploadProfileImage = uploadProfileImage;
window.updateRegistrationStatusWithReason = updateRegistrationStatusWithReason;
