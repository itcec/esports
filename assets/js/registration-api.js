/**
 * Shared client for the Google Apps Script registration backend & Tournament Operations.
 */
const REGISTRATION_API_URL = 'https://script.google.com/macros/s/AKfycbxhXkVdmyMYdMvcBTSvVIrVH5LZ6T5v77Z7aKXAt_k67q2cwN3ldII2UtTVBWS63oky/exec';
const ADMIN_KEY = ''; // Legacy stopgap only; use Firebase ID-token auth.
const STAFF_ACTIONS = [
  'getRegistration', 'updateTeamStatus', 'updatePlayerVerification',
  'getPrivateVerificationFile', 'recordMatchResult', 'listDisputes',
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

const PublicTournamentApi = {
  listTeams: async function () {
    return await callRegistrationApi('listPublicTeams', {}, 'GET');
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
 * Tournament Operations & Match Officiating API Wrappers
 */
const TournamentOps = {
  recordMatchResult: async function (resultData) {
    return await callRegistrationApi('recordMatchResult', resultData, 'POST');
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
