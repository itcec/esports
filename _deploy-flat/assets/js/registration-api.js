/**
 * CEC Esports registration wizard — shared client for the Apps Script backend.
 * Loaded by every step of the registration wizard (register-team through
 * register-success) and the admin pages (admin-registrations, admin-verification)
 * so the API URL only needs to be set in one place.
 *
 * Setup: deploy google-apps-script/Code.gs as a Web App (see SETUP.md there),
 * then paste the Web App URL below.
 */
const REGISTRATION_API_URL = 'https://script.google.com/macros/s/AKfycbxhXkVdmyMYdMvcBTSvVIrVH5LZ6T5v77Z7aKXAt_k67q2cwN3ldII2UtTVBWS63oky/exec';
const ADMIN_KEY = ''; // only needed if you set ADMIN_KEY in Script Properties — see SETUP.md

/** Carries the in-progress registration across wizard pages (plain multi-page HTML, no SPA state). */
const RegistrationDraft = {
  KEY: 'cecRegistrationDraft',
  get() {
    try { return JSON.parse(sessionStorage.getItem(this.KEY)) || {}; }
    catch (e) { return {}; }
  },
  save(partial) {
    const draft = Object.assign(this.get(), partial);
    sessionStorage.setItem(this.KEY, JSON.stringify(draft));
    return draft;
  },
  clear() {
    sessionStorage.removeItem(this.KEY);
  }
};

/**
 * Calls one action on the registration API.
 * GET actions (reads) take params as a query string; everything else POSTs the
 * params as application/x-www-form-urlencoded, which Apps Script Web Apps accept
 * without triggering a CORS preflight (a JSON body would trigger one and fail).
 */
async function callRegistrationApi(action, params, method) {
  method = method || 'POST';
  if (!REGISTRATION_API_URL || REGISTRATION_API_URL.indexOf('PASTE_YOUR') === 0) {
    throw new Error('Registration API is not configured yet — set REGISTRATION_API_URL in assets/js/registration-api.js.');
  }
  const url = new URL(REGISTRATION_API_URL);
  url.searchParams.set('action', action);
  const withKey = ADMIN_KEY ? Object.assign({}, params, { adminKey: ADMIN_KEY }) : (params || {});

  let response;
  if (method === 'GET') {
    Object.keys(withKey).forEach(function (k) { url.searchParams.set(k, withKey[k]); });
    response = await fetch(url.toString());
  } else {
    response = await fetch(url.toString(), {
      method: 'POST',
      body: new URLSearchParams(withKey)
    });
  }

  const json = await response.json();
  if (!json.success) throw new Error((json.error && json.error.message) || 'Request failed.');
  return json.data;
}
