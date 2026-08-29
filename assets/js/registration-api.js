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
  listBracket: async function (division) {
    return await callRegistrationApi('getBracketData', { division: division || '' }, 'GET');
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
    return await callRegistrationApi('getBracketData', { division: division || '' }, 'GET');
  },
  saveBracketData: async function (division, matches) {
    return await callRegistrationApi('saveBracketData', { division: division, matches: JSON.stringify(matches) }, 'POST');
  },
  getAuditLogs: async function () {
    return await callRegistrationApi('getAuditLogs', {}, 'POST');
  }
};

// Expose the shared clients for pages that load this file as a classic script.
window.PublicTournamentApi = PublicTournamentApi;
window.TournamentOps = TournamentOps;
