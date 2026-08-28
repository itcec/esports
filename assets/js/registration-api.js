/** Shared client for the Google Apps Script registration backend. */
const REGISTRATION_API_URL = 'https://script.google.com/macros/s/AKfycbxhXkVdmyMYdMvcBTSvVIrVH5LZ6T5v77Z7aKXAt_k67q2cwN3ldII2UtTVBWS63oky/exec';
const ADMIN_KEY = ''; // Legacy stopgap only; use Firebase ID-token auth.
const STAFF_ACTIONS = ['getRegistration', 'updateTeamStatus', 'updatePlayerVerification'];

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
