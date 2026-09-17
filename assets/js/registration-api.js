/**
 * Shared client for the Google Apps Script registration backend & Tournament Operations.
 */
const REGISTRATION_API_URL = 'https://script.google.com/macros/s/AKfycbxhXkVdmyMYdMvcBTSvVIrVH5LZ6T5v77Z7aKXAt_k67q2cwN3ldII2UtTVBWS63oky/exec';
const ADMIN_KEY = ''; // Legacy stopgap only; use Firebase ID-token auth.
const STAFF_ACTIONS = [
  'getRegistration', 'updateTeamStatus', 'updatePlayerVerification',
  'getPrivateVerificationFile', 'getPrivateVerificationBatch', 'recordMatchResult', 'publishMatch', 'deleteMatch', 'listDisputes',
  'resolveDispute', 'saveBracketData', 'getAuditLogs'
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
  get() { try { return JSON.parse(sessionStorage.getItem(this.KEY)) || {}; } catch (e) { return {}; } },
  save(partial) { const draft = Object.assign(this.get(), partial); sessionStorage.setItem(this.KEY, JSON.stringify(draft)); return draft; },
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

  const payload = Object.assign({
    fileBase64: base64,
    fileName: file.name,
    mimeType: file.type || 'image/jpeg',
    docType: docType || 'student_id_card'
  }, metadata || {});

  return await callRegistrationApi('uploadVerificationFile', payload, 'POST');
}

/** Optional public-facing player image. This is separate from identity proof uploads. */
async function uploadProfileImage(file) {
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

  return await callRegistrationApi('uploadProfileImage', {
    fileBase64: base64,
    fileName: file.name,
    mimeType: file.type
  }, 'POST');
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

const PublicTournamentApi = {
  listTeams: async function () {
    try {
      const teams = await callRegistrationApi('listPublicTeams', {}, 'GET');
      if (Array.isArray(teams) && teams.length > 0) return teams;
    } catch (err) {
      console.warn('PublicTournamentApi.listTeams API notice:', err);
    }

    // Fallback: load approved teams from Firebase Realtime Database registrations node
    if (window.CECFirebase) {
      try {
        await window.CECFirebase.init();
        if (window.CECFirebase.db) {
          const snap = await window.CECFirebase.db.ref('registrations').once('value');
          const regData = snap.val() || {};
          const fallbackTeams = [];
          Object.keys(regData).forEach(function (k) {
            const t = regData[k];
            if (t && String(t.status || t.Status).toLowerCase() === 'approved') {
              fallbackTeams.push({
                teamId: t.teamId || t.TeamID || k,
                teamName: t.teamName || t.TeamName || 'Team',
                course: t.course || t.Course || '',
                division: t.division || '',
                department: t.department || t.Course || '',
                captainName: t.captainName || t.CaptainName || '',
                description: t.description || t.Description || '',
                roster: t.roster || []
              });
            }
          });
          if (fallbackTeams.length > 0) return fallbackTeams;
        }
      } catch (fbErr) {
        console.warn('Firebase listTeams fallback notice:', fbErr);
      }
    }
    return [];
  },

  listMatches: async function () {
    try {
      const rows = await callRegistrationApi('listMatches', {}, 'GET');
      if (Array.isArray(rows) && rows.length > 0) {
        return rows.map(function (row) {
          return {
            matchId: row.matchId || row.MatchID || '', court: row.court || row.Court || '',
            division: row.division || row.Division || '', stage: row.stage || row.Stage || '',
            team1Id: row.team1Id || row.Team1ID || '', team1Name: row.team1Name || row.Team1Name || 'TBD', team1Score: row.team1Score != null ? row.team1Score : (row.Team1Score || 0),
            team2Id: row.team2Id || row.Team2ID || '', team2Name: row.team2Name || row.Team2Name || 'TBD', team2Score: row.team2Score != null ? row.team2Score : (row.Team2Score || 0),
            status: row.status || row.Status || 'Scheduled', streamUrl: row.streamUrl || row.StreamUrl || '',
            streamPublished: row.streamPublished || row.StreamPublished || '', scheduledAt: row.scheduledAt || row.ScheduledAt || '', submittedAt: row.submittedAt || row.SubmittedAt || ''
          };
        });
      }
    } catch (e) {
      console.warn('PublicTournamentApi.listMatches API notice:', e);
    }

    // Fallback: load live matches from Firebase Realtime Database
    if (window.CECFirebase) {
      try {
        await window.CECFirebase.init();
        if (window.CECFirebase.db) {
          const snap = await window.CECFirebase.db.ref('liveMatches').once('value');
          const data = snap.val() || {};
          return Object.values(data).map(function (row) {
            return {
              matchId: row.id || row.matchId || '', court: row.court || '',
              division: row.division || '', stage: row.stageTitle || row.stage || '',
              team1Id: (row.team1 && (row.team1.registrationTeamId || row.team1.id)) || '',
              team1Name: (row.team1 && row.team1.name) || 'TBD',
              team1Score: (row.team1 && row.team1.score != null) ? Number(row.team1.score) : 0,
              team2Id: (row.team2 && (row.team2.registrationTeamId || row.team2.id)) || '',
              team2Name: (row.team2 && row.team2.name) || 'TBD',
              team2Score: (row.team2 && row.team2.score != null) ? Number(row.team2.score) : 0,
              status: row.status || 'Scheduled', streamUrl: row.streamUrl || '',
              streamPublished: row.streamUrl ? 'Yes' : 'No', scheduledAt: '', submittedAt: ''
            };
          });
        }
      } catch (fbErr) {}
    }
    return [];
  },

  listStandings: async function () {
    try {
      return await callRegistrationApi('listStandings', {}, 'GET');
    } catch (e) {
      console.warn('listStandings API notice:', e);
      return [];
    }
  },

  listBracket: async function (division) {
    // 1. Try Firebase Realtime Database first for instant, live updates
    if (window.CECFirebase) {
      try {
        await window.CECFirebase.init();
        if (window.CECFirebase.db) {
          const snap = await window.CECFirebase.db.ref('brackets/' + (division || 'default')).once('value');
          const data = snap.val();
          if (data && data.matches && Array.isArray(data.matches) && data.matches.length > 0) {
            return data.matches;
          }
        }
      } catch (fbErr) {
        console.warn('Firebase listBracket notice:', fbErr);
      }
    }

    // 2. Try Google Apps Script API
    try {
      const rows = await callRegistrationApi('getBracketData', { division: division || '' }, 'GET');
      if (Array.isArray(rows) && rows.length > 0) return rows;
    } catch (apiErr) {
      console.warn('Apps Script listBracket notice:', apiErr);
    }

    // 3. Fallback to localStorage cache
    try {
      const cached = localStorage.getItem('CEC_BRACKET_' + division);
      if (cached) return JSON.parse(cached);
    } catch (e) {}

    return [];
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
    return await callRegistrationApi('recordMatchResult', resultData, 'POST');
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
  saveBracketData: async function (division, matches) {
    let savedToFirebase = false;

    // 1. Save to Local Storage immediately
    try {
      localStorage.setItem('CEC_BRACKET_' + division, JSON.stringify(matches));
    } catch (e) {}

    // 2. Save directly to Firebase Realtime Database
    if (window.CECFirebase) {
      try {
        await window.CECFirebase.init();
        if (window.CECFirebase.db) {
          const payload = {
            division: division,
            matches: matches,
            updatedAt: new Date().toISOString(),
            updatedBy: (window.CECAuth && window.CECAuth.currentUser) ? window.CECAuth.currentUser.email : 'coordinator'
          };
          await window.CECFirebase.db.ref('brackets/' + division).set(payload);
          savedToFirebase = true;
        }
      } catch (fbErr) {
        console.warn('Firebase saveBracketData notice:', fbErr);
      }
    }

    // 3. Best-effort mirror to Google Sheets via Apps Script
    try {
      await callRegistrationApi('saveBracketData', { division: division, matches: JSON.stringify(matches) }, 'POST');
    } catch (apiErr) {
      console.warn('saveBracketData Sheets mirror notice (non-fatal, Firebase is saved):', apiErr);
      // If saved to Firebase or localStorage, do not throw so the user UI sees success
      if (!savedToFirebase && !localStorage.getItem('CEC_BRACKET_' + division)) {
        throw apiErr;
      }
    }

    return { success: true, division: division, matches: matches, savedToFirebase: savedToFirebase };
  },
  getAuditLogs: async function () {
    return await callRegistrationApi('getAuditLogs', {}, 'POST');
  }
};

// Expose the shared clients for pages that load this file as a classic script.
window.PublicTournamentApi = PublicTournamentApi;
window.TournamentOps = TournamentOps;
