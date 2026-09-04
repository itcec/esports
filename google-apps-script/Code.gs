/**
 * CEC Esports 2026 registration, officiating, bracket, and tournament operations API.
 * Bind this script to the tournament spreadsheet and deploy it as a Web App.
 * Public: listMatches, listStandings, listPublicTeams, getBracketData, createRegistration,
 * uploadVerificationFile, uploadProfileImage.
 * Staff (requires Firebase ID token): listRegistrations, getRegistration, getPrivateVerificationFile,
 * getPrivateVerificationBatch, updateTeamStatus, updatePlayerVerification, recordMatchResult,
 * publishMatch, deleteMatch, fileDispute, listDisputes, resolveDispute, saveBracketData, getAuditLogs.
 */
const TEAMS_SHEET_NAME = 'TEAMS';
const PLAYERS_SHEET_NAME = 'PLAYERS';
const DOCS_SHEET_NAME = 'VERIFICATION_DOCS';
const MATCHES_SHEET_NAME = 'MATCHES';
const DISPUTES_SHEET_NAME = 'DISPUTES';
const AUDIT_SHEET_NAME = 'AUDIT_LOGS';
const BRACKETS_SHEET_NAME = 'BRACKETS';

const SUPER_ADMIN_EMAIL = 'jlcabucos.cec@gmail.com';

const TEAMS_HEADERS = ['TeamID', 'TeamName', 'Course', 'CaptainName', 'ContactNumber', 'Description', 'LogoUrl', 'TeamPhotoUrl', 'Status', 'SubmittedAt', 'UpdatedAt'];
const PLAYERS_HEADERS = ['PlayerID', 'TeamID', 'RealName', 'IGN', 'MlbbId', 'ServerId', 'StudentId', 'Role', 'RosterType', 'VerificationStatus', 'SubmittedAt', 'ProfileImageFileId', 'ProfileImageUrl', 'ProfileImageVisible'];
const DOCS_HEADERS = ['DocID', 'PlayerID', 'TeamID', 'DocType', 'DriveFileId', 'MimeType', 'FileName', 'UploadedAt', 'Status'];
const MATCHES_HEADERS = ['MatchID', 'Court', 'Division', 'Stage', 'Team1ID', 'Team1Name', 'Team1Score', 'Team2ID', 'Team2Name', 'Team2Score', 'WinnerID', 'WinnerName', 'Status', 'StreamUrl', 'OfficiatedBy', 'SubmittedAt', 'ScheduledAt', 'StreamPublished'];
const DISPUTES_HEADERS = ['DisputeID', 'MatchID', 'TeamID', 'FiledBy', 'Category', 'Reason', 'EvidenceUrl', 'Status', 'Resolution', 'ResolvedBy', 'CreatedAt', 'ResolvedAt'];
const AUDIT_HEADERS = ['LogID', 'Actor', 'Action', 'TargetID', 'Details', 'Timestamp'];
// Department: '' for a division-wide bracket (Faculty, SHS, Grand Finals), or the
// department code (IT/HTM/...) for a department's own bracket.
// Format: per-match series length, e.g. 'BO1' | 'BO3' | 'BO5'.
// getSheet() appends any header missing from an existing sheet, so adding these
// columns migrates the live BRACKETS sheet on the next call.
const BRACKET_HEADERS = ['Division', 'Department', 'Stage', 'Round', 'MatchKey', 'Title', 'Format',
  'Team1ID', 'Team1Name', 'Team2ID', 'Team2Name', 'Score1', 'Score2', 'WinnerID',
  'Status', 'NextMatchKey', 'NextSlot', 'UpdatedAt'];

const VALID_TEAM_STATUSES = ['Pending', 'UnderReview', 'Approved', 'Rejected'];
const VALID_VERIFICATION_STATUSES = ['Pending', 'Verified', 'Rejected'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB limit
const PROFILE_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PROFILE_IMAGE_MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB public image limit

function doGet(e) { return route(e, 'GET'); }
function doPost(e) { return route(e, 'POST'); }

function route(e, method) {
  const params = (e && e.parameter) || {};
  const action = params.action || '';
  try {
    // Public Endpoints
    if (action === 'listMatches') {
      return json({ success: true, data: listMatches(), message: 'OK' });
    }
    if (action === 'listStandings') {
      return json({ success: true, data: listStandings(), message: 'OK' });
    }
    if (action === 'listPublicTeams') {
      return json({ success: true, data: listPublicTeams(), message: 'OK' });
    }
    if (action === 'getBracketData') {
      return json({ success: true,
        data: getBracketData(params.division,
          Object.prototype.hasOwnProperty.call(params, 'department') ? params.department : undefined),
        message: 'OK' });
    }
    if (method === 'POST' && action === 'uploadVerificationFile') {
      return json({ success: true, data: uploadVerificationFile(params), message: 'File uploaded securely.' });
    }
    if (method === 'POST' && action === 'uploadProfileImage') {
      return json({ success: true, data: uploadProfileImage(params), message: 'Profile image uploaded.' });
    }
    if (method === 'POST' && action === 'createRegistration') {
      return json({ success: true, data: createRegistration(params), message: 'Registration submitted.' });
    }

    // Authenticated Staff Endpoints
    const staffActions = [
      'listRegistrations', 'getRegistration', 'getPrivateVerificationFile', 'getPrivateVerificationBatch',
      'updateTeamStatus', 'updatePlayerVerification', 'recordMatchResult', 'publishMatch', 'deleteMatch',
      'fileDispute', 'listDisputes', 'resolveDispute', 'saveBracketData', 'getAuditLogs'
    ];

    if (staffActions.indexOf(action) !== -1) {
      const user = requireStaff(params);

      if ((method === 'GET' || method === 'POST') && action === 'listRegistrations') {
        return json({ success: true, data: listRegistrations(), message: 'OK' });
      }
      if ((method === 'GET' || method === 'POST') && action === 'getRegistration') {
        return json({ success: true, data: getRegistration(params.teamId) });
      }
      if ((method === 'GET' || method === 'POST') && action === 'getPrivateVerificationFile') {
        return json({ success: true, data: getPrivateVerificationFile(params.fileId) });
      }
      if ((method === 'GET' || method === 'POST') && action === 'getPrivateVerificationBatch') {
        return json({ success: true, data: getPrivateVerificationBatch(params) });
      }
      if ((method === 'GET' || method === 'POST') && action === 'listDisputes') {
        return json({ success: true, data: listDisputes(params.status) });
      }
      if ((method === 'GET' || method === 'POST') && action === 'getAuditLogs') {
        return json({ success: true, data: getAuditLogs() });
      }
      if (method === 'POST' && action === 'updateTeamStatus') {
        return json({ success: true, data: updateTeamStatus(params, user), message: 'Team status updated.' });
      }
      if (method === 'POST' && action === 'updatePlayerVerification') {
        return json({ success: true, data: updatePlayerVerification(params, user), message: 'Player verification updated.' });
      }
      if (method === 'POST' && action === 'recordMatchResult') {
        return json({ success: true, data: recordMatchResult(params, user), message: 'Match result officially recorded.' });
      }
      if (method === 'POST' && action === 'publishMatch') {
        return json({ success: true, data: publishMatch(params, user), message: 'Match publication updated.' });
      }
      if (method === 'POST' && action === 'deleteMatch') {
        return json({ success: true, data: deleteMatch(params, user), message: 'Match deleted.' });
      }
      if (method === 'POST' && action === 'fileDispute') {
        return json({ success: true, data: fileDispute(params, user), message: 'Dispute filed successfully.' });
      }
      if (method === 'POST' && action === 'resolveDispute') {
        return json({ success: true, data: resolveDispute(params, user), message: 'Dispute resolved.' });
      }
      if (method === 'POST' && action === 'saveBracketData') {
        return json({ success: true, data: saveBracketData(params, user), message: 'Bracket updated.' });
      }
    }

    return json({ success: false, error: { code: 'UNKNOWN_ACTION', message: 'Unknown action.' } });
  } catch (err) {
    return json({ success: false, error: { code: 'REQUEST_FAILED', message: String(err.message || err) } });
  }
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

// CacheService silently clamps any TTL above 21600s (6 hours), so that is the
// real window length. The counters below reset every 6 hours, not every 24.
const QUOTA_CACHE_TTL_SECONDS = 21600;
const QUOTA_UPLOADS_PER_WINDOW = 600;
const QUOTA_UPLOADS_PER_DRAFT = 30;

/**
 * Rate limits the public upload endpoints, which have to stay unauthenticated
 * because registration happens before anyone has an account.
 *
 * A cache outage must not open the gate silently, but it also must not block a
 * legitimate registration, so cache errors are logged and allowed through while
 * a real quota breach is always rethrown. The breach is flagged with a property
 * on the error rather than by matching words in its message.
 */
function quotaError(message) {
  const err = new Error(message);
  err.isQuotaBreach = true;
  return err;
}

function enforceUploadQuota(draftKey) {
  try {
    const cache = CacheService.getScriptCache();
    const windowStamp = Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd-') +
      Math.floor(new Date().getUTCHours() / 6);

    // Global cap across all registrations in the current window.
    const windowKey = 'quota_uploads_' + windowStamp;
    const windowCount = Number(cache.get(windowKey) || '0');
    if (windowCount >= QUOTA_UPLOADS_PER_WINDOW) {
      throw quotaError('Upload limit reached for the tournament right now. Please try again later or contact tournament officials.');
    }
    cache.put(windowKey, String(windowCount + 1), QUOTA_CACHE_TTL_SECONDS);

    // Per-registration cap.
    if (draftKey) {
      const draftCountKey = 'quota_draft_' + draftKey;
      const draftCount = Number(cache.get(draftCountKey) || '0');
      if (draftCount >= QUOTA_UPLOADS_PER_DRAFT) {
        throw quotaError('Upload limit of ' + QUOTA_UPLOADS_PER_DRAFT + ' files exceeded for this registration.');
      }
      cache.put(draftCountKey, String(draftCount + 1), QUOTA_CACHE_TTL_SECONDS);
    }
  } catch (e) {
    if (e && e.isQuotaBreach) throw e;
    console.warn('Quota cache notice:', e);
  }
}

/** Shared slot-key helper preventing Starter 1 / Substitute 1 collisions */
function rosterSlotKey(rosterType, slotNum) {
  const type = rosterType || 'Starter';
  return type + '_' + (slotNum || '1');
}

/** Firebase ID tokens are verified server-side (Fail-Closed) */
function requireStaff(params) {
  const props = PropertiesService.getScriptProperties();
  const legacyKey = props.getProperty('ADMIN_KEY');
  if (legacyKey && params.adminKey === legacyKey) return { email: 'legacy-admin', localId: 'legacy' };
  const token = params.idToken;
  if (!token) throw new Error('A Firebase staff token is required.');
  const apiKey = props.getProperty('FIREBASE_WEB_API_KEY');
  if (!apiKey) throw new Error('FIREBASE_WEB_API_KEY is not configured in Script Properties.');

  // Step 1: Verify the ID token is valid and get the user's UID + email
  const lookup = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: token }), muteHttpExceptions: true
  });
  if (lookup.getResponseCode() !== 200) throw new Error('Invalid or expired Firebase token.');
  const body = JSON.parse(lookup.getContentText());
  const user = body.users && body.users[0];
  if (!user || user.emailVerified !== true) throw new Error('Verified staff account required.');
  const email = String(user.email || '').toLowerCase();
  
  // Super-admin email short-circuits before the DB read to prevent lockout
  if (email === SUPER_ADMIN_EMAIL) return user;

  // Step 2: Check that the user is approved staff in Firebase RTDB
  const dbUrl = props.getProperty('FIREBASE_DATABASE_URL');
  if (!dbUrl) throw new Error('FIREBASE_DATABASE_URL is not configured in Script Properties.');
  const staffResponse = UrlFetchApp.fetch(
    dbUrl.replace(/\/$/, '') + '/staff/' + encodeURIComponent(user.localId) + '.json?auth=' + encodeURIComponent(token),
    { muteHttpExceptions: true }
  );
  if (staffResponse.getResponseCode() !== 200) {
    throw new Error('Staff authorization lookup failed (HTTP ' + staffResponse.getResponseCode() + '). Access denied.');
  }
  const staffText = staffResponse.getContentText();
  if (!staffText || staffText.trim() === 'null') {
    throw new Error('Staff profile not found. Please contact the tournament coordinator to approve your account.');
  }
  const staff = JSON.parse(staffText);
  if (!staff || staff.status !== 'approved') throw new Error('Approved staff account required. Contact the coordinator to get your account approved.');
  return user;
}

function getSheet(name, headers) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name) || SpreadsheetApp.getActiveSpreadsheet().insertSheet(name);
  if (sheet.getLastRow() === 0) { sheet.appendRow(headers); sheet.setFrozenRows(1); }
  else {
    const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    headers.forEach(function (header) {
      if (existing.indexOf(header) === -1) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
        existing.push(header);
      }
    });
  }
  return sheet;
}

function appendRowObject(sheet, expectedHeaders, dataObj) {
  const values = sheet.getDataRange().getValues();
  let headers = values.length > 0 ? values[0].map(String) : [];
  if (!headers.length) {
    headers = expectedHeaders;
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else {
    expectedHeaders.forEach(function (h) {
      if (headers.indexOf(h) === -1) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
        headers.push(h);
      }
    });
  }
  const row = headers.map(function (h) {
    return dataObj[h] !== undefined && dataObj[h] !== null ? dataObj[h] : '';
  });
  sheet.appendRow(row);
}

function isEmblemOrImageUrl(val) {
  if (!val || typeof val !== 'string') return false;
  const s = val.trim().toLowerCase();
  if (s.indexOf('assets/') === 0 || s.indexOf('http://') === 0 || s.indexOf('https://') === 0 || s.indexOf('data:image/') === 0) {
    return true;
  }
  if (s.indexOf('.svg') !== -1 || s.indexOf('.png') !== -1 || s.indexOf('.jpg') !== -1 || s.indexOf('.jpeg') !== -1 || s.indexOf('.webp') !== -1) {
    return true;
  }
  return false;
}

function normalizeLogoUrl(url) {
  if (!url) return '';
  let s = String(url).trim();
  if (s.toLowerCase().indexOf('assets/') === 0) {
    return s.toLowerCase();
  }
  return s;
}

function normalizeTeamRow(team) {
  if (!team) return team;
  const t = {};
  Object.keys(team).forEach(function (k) { t[k] = team[k]; });

  const statusVal = String(t.Status || '').trim();
  const logoVal = String(t.LogoUrl || '').trim();
  const submittedVal = String(t.SubmittedAt || '').trim();
  const photoVal = String(t.TeamPhotoUrl || '').trim();

  let realLogo = '';
  if (isEmblemOrImageUrl(logoVal)) {
    realLogo = logoVal;
  } else if (isEmblemOrImageUrl(statusVal)) {
    realLogo = statusVal;
  }

  let realStatus = 'Pending';
  if (VALID_TEAM_STATUSES.indexOf(statusVal) !== -1) {
    realStatus = statusVal;
  } else if (VALID_TEAM_STATUSES.indexOf(String(t.UpdatedAt).trim()) !== -1) {
    realStatus = String(t.UpdatedAt).trim();
  } else if (VALID_TEAM_STATUSES.indexOf(photoVal) !== -1) {
    realStatus = photoVal;
  }

  let realPhoto = '';
  if (isEmblemOrImageUrl(photoVal) && photoVal.toLowerCase().indexOf('assets/icons/') === -1) {
    realPhoto = photoVal;
  } else if (isEmblemOrImageUrl(submittedVal) && submittedVal.toLowerCase().indexOf('assets/icons/') === -1) {
    realPhoto = submittedVal;
  }

  let realSubmitted = t.SubmittedAt;
  if (isEmblemOrImageUrl(String(realSubmitted))) {
    realSubmitted = isEmblemOrImageUrl(logoVal) ? t.UpdatedAt : (t.LogoUrl || t.UpdatedAt || '');
  }

  t.LogoUrl = realLogo ? normalizeLogoUrl(realLogo) : '';
  t.Status = realStatus;
  t.TeamPhotoUrl = realPhoto ? normalizeLogoUrl(realPhoto) : '';
  t.SubmittedAt = realSubmitted;

  return t;
}

function setupSheets() {
  getSheet(TEAMS_SHEET_NAME, TEAMS_HEADERS);
  getSheet(PLAYERS_SHEET_NAME, PLAYERS_HEADERS);
  getSheet(DOCS_SHEET_NAME, DOCS_HEADERS);
  getSheet(MATCHES_SHEET_NAME, MATCHES_HEADERS);
  getSheet(DISPUTES_SHEET_NAME, DISPUTES_HEADERS);
  getSheet(AUDIT_SHEET_NAME, AUDIT_HEADERS);
  getSheet(BRACKETS_SHEET_NAME, BRACKET_HEADERS);
  getVerificationFolder();
  getPublicProfileFolder();
}

function sheetObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1).map(function (row) {
    const result = {}; values[0].forEach(function (header, i) { result[header] = row[i]; }); return result;
  });
}

/** Computes max numeric ID suffix to guarantee non-destructive, non-colliding ID generation */
function getMaxIdNumber(sheet, prefix) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return 0;
  let maxNum = 0;
  const regex = new RegExp('^' + prefix + '-(\\d+)$', 'i');
  for (let i = 1; i < values.length; i++) {
    const val = String(values[i][0] || '').trim();
    const m = val.match(regex);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return maxNum;
}

function nextId(sheet, prefix) {
  const nextNum = getMaxIdNumber(sheet, prefix) + 1;
  return prefix + '-' + String(nextNum).padStart(4, '0');
}

function findRow(sheet, column, id) {
  const values = sheet.getDataRange().getValues();
  if (!values.length) return null;
  const index = values[0].indexOf(column);
  if (index === -1) return null;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][index]) === String(id)) return { rowIndex: i + 1, headers: values[0], row: values[i] };
  }
  return null;
}

function logAudit(actor, action, targetId, details) {
  try {
    const sheet = getSheet(AUDIT_SHEET_NAME, AUDIT_HEADERS);
    const logId = nextId(sheet, 'LOG');
    sheet.appendRow([logId, actor, action, targetId, details, new Date()]);
  } catch (e) {
    console.warn('Could not record audit log:', e);
  }
}

function getVerificationFolder() {
  const props = PropertiesService.getScriptProperties();
  const customFolderId = props.getProperty('DRIVE_VERIFICATION_FOLDER_ID');
  if (customFolderId) {
    try { return DriveApp.getFolderById(customFolderId); } catch (e) {}
  }
  const paths = ['CEC ESPORTS', 'TOURNAMENTS', '2026', 'MLBB', 'PLAYER_VERIFICATION'];
  let currentFolder = DriveApp.getRootFolder();
  for (let i = 0; i < paths.length; i++) {
    const name = paths[i];
    const folders = currentFolder.getFoldersByName(name);
    if (folders.hasNext()) {
      currentFolder = folders.next();
    } else {
      currentFolder = currentFolder.createFolder(name);
    }
  }
  return currentFolder;
}

function getPublicProfileFolder() {
  const props = PropertiesService.getScriptProperties();
  const customFolderId = props.getProperty('DRIVE_PROFILE_IMAGES_FOLDER_ID');
  if (customFolderId) {
    try { return DriveApp.getFolderById(customFolderId); } catch (e) {}
  }
  const paths = ['CEC ESPORTS', 'TOURNAMENTS', '2026', 'MLBB', 'PUBLIC_PROFILE_IMAGES'];
  let currentFolder = DriveApp.getRootFolder();
  for (let i = 0; i < paths.length; i++) {
    const name = paths[i];
    const folders = currentFolder.getFoldersByName(name);
    if (folders.hasNext()) {
      currentFolder = folders.next();
    } else {
      currentFolder = currentFolder.createFolder(name);
    }
  }
  return currentFolder;
}

/** Confirms a file exists within the private verification folder hierarchy */
function assertVerificationFile(fileId) {
  if (!fileId) throw new Error('fileId is required.');
  const file = DriveApp.getFileById(fileId);
  const parents = file.getParents();
  const verificationFolderId = getVerificationFolder().getId();
  let belongs = false;
  while (parents.hasNext()) {
    if (parents.next().getId() === verificationFolderId) {
      belongs = true;
      break;
    }
  }
  if (!belongs) throw new Error('Access denied: file is not located in the private verification storage.');
  return file;
}

function uploadVerificationFile(params) {
  if (!params.fileBase64 || !params.docType) throw new Error('fileBase64 and docType are required.');
  const mimeType = params.mimeType || 'image/jpeg';
  if (ALLOWED_MIME_TYPES.indexOf(mimeType) === -1) throw new Error('Invalid file type.');
  const bytes = Utilities.base64Decode(params.fileBase64);
  if (bytes.length > MAX_FILE_SIZE_BYTES) throw new Error('File exceeds the 5MB limit.');

  enforceUploadQuota(params.draftKey);

  const folder = getVerificationFolder();
  const ext = mimeType === 'application/pdf' ? '.pdf' : (mimeType === 'image/png' ? '.png' : (mimeType === 'image/webp' ? '.webp' : '.jpg'));
  const safeName = 'DOC_' + Date.now() + '_' + (params.docType || 'id') + ext;
  const blob = Utilities.newBlob(bytes, mimeType, safeName);
  const file = folder.createFile(blob);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const docsSheet = getSheet(DOCS_SHEET_NAME, DOCS_HEADERS);
    const docId = nextId(docsSheet, 'DOC');
    const now = new Date();

    docsSheet.appendRow([docId, params.playerId || '', params.teamId || '', params.docType || 'id_card', file.getId(), mimeType, params.fileName || safeName, now, 'Pending']);
    return { docId: docId, driveFileId: file.getId(), fileName: params.fileName || safeName, docType: params.docType, mimeType: mimeType, status: 'Pending' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Profile images are intentionally public because participants opt in to
 * displaying them in live match coverage. They are kept in a separate folder
 * from identity verification documents and are limited to small image files.
 */
function uploadProfileImage(params) {
  if (!params.fileBase64) throw new Error('fileBase64 is required.');
  const mimeType = params.mimeType || 'image/jpeg';
  if (PROFILE_IMAGE_MIME_TYPES.indexOf(mimeType) === -1) throw new Error('Profile images must be JPG, PNG, or WEBP.');
  const bytes = Utilities.base64Decode(params.fileBase64);
  if (bytes.length > PROFILE_IMAGE_MAX_SIZE_BYTES) throw new Error('Profile image exceeds the 1MB limit.');

  enforceUploadQuota(params.draftKey);

  const ext = mimeType === 'image/png' ? '.png' : (mimeType === 'image/webp' ? '.webp' : '.jpg');
  const safeName = 'PROFILE_' + Date.now() + '_' + Math.floor(Math.random() * 100000) + ext;
  const file = getPublicProfileFolder().createFile(Utilities.newBlob(bytes, mimeType, safeName));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    profileImageFileId: file.getId(),
    profileImageUrl: 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(file.getId()),
    fileName: params.fileName || safeName,
    mimeType: mimeType
  };
}

function resolvePublicProfileImage(fileId) {
  if (!fileId) return { fileId: '', url: '' };
  try {
    const file = DriveApp.getFileById(fileId);
    const parents = file.getParents();
    const publicFolderId = getPublicProfileFolder().getId();
    let belongsToPublicFolder = false;
    while (parents.hasNext()) {
      if (parents.next().getId() === publicFolderId) {
        belongsToPublicFolder = true;
        break;
      }
    }
    if (!belongsToPublicFolder) return { fileId: '', url: '' };
    return {
      fileId: file.getId(),
      url: 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(file.getId())
    };
  } catch (e) {
    return { fileId: '', url: '' };
  }
}

function getPrivateVerificationFile(fileId) {
  const file = assertVerificationFile(fileId);
  const blob = file.getBlob();
  return {
    fileId: file.getId(),
    fileName: file.getName(),
    mimeType: file.getMimeType(),
    size: blob.getBytes().length,
    base64: Utilities.base64Encode(blob.getBytes())
  };
}

function getPrivateVerificationBatch(params) {
  let fileIds = [];
  if (params.fileIds) {
    try {
      fileIds = typeof params.fileIds === 'string' ? JSON.parse(params.fileIds) : params.fileIds;
    } catch (e) {
      fileIds = String(params.fileIds).split(',').map(function (s) { return s.trim(); });
    }
  }
  if (!Array.isArray(fileIds) || !fileIds.length) return {};

  const results = {};
  fileIds.forEach(function (fileId) {
    if (!fileId) return;
    try {
      const file = assertVerificationFile(fileId);
      const blob = file.getBlob();
      results[fileId] = {
        fileId: file.getId(),
        fileName: file.getName(),
        mimeType: file.getMimeType(),
        size: blob.getBytes().length,
        base64: Utilities.base64Encode(blob.getBytes())
      };
    } catch (err) {
      results[fileId] = { error: err.message };
    }
  });
  return results;
}

function createRegistration(params) {
  if (!params.teamName || !params.captainName || !params.contactNumber) throw new Error('teamName, captainName, and contactNumber are required.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const teams = getSheet(TEAMS_SHEET_NAME, TEAMS_HEADERS);
    const playersSheet = getSheet(PLAYERS_SHEET_NAME, PLAYERS_HEADERS);
    const docsSheet = getSheet(DOCS_SHEET_NAME, DOCS_HEADERS);
    
    const teamId = nextId(teams, 'TEAM');
    const now = new Date();
    appendRowObject(teams, TEAMS_HEADERS, {
      TeamID: teamId,
      TeamName: params.teamName,
      Course: params.course || '',
      CaptainName: params.captainName,
      ContactNumber: params.contactNumber,
      Description: params.description || '',
      LogoUrl: params.logoUrl || '',
      TeamPhotoUrl: params.teamPhotoUrl || '',
      Status: 'Pending',
      SubmittedAt: now,
      UpdatedAt: now
    });

    let players = [];
    try { players = JSON.parse(params.players || '[]'); } catch (e) { throw new Error('players must be valid JSON.'); }
    let attachedDocIds = [];
    try { attachedDocIds = JSON.parse(params.docIds || '[]'); } catch (e) { attachedDocIds = []; }

    const playerMap = {};
    let maxPlayerNum = getMaxIdNumber(playersSheet, 'PLAYER');

    players.forEach(function (p) {
      maxPlayerNum++;
      const pid = 'PLAYER-' + String(maxPlayerNum).padStart(4, '0');
      const rosterType = p.rosterType || 'Starter';
      const slot = p.slot || 1;
      
      // Index by roster-type + slot, and by IGN. A raw-slot index is deliberately
      // NOT kept: substitute slots restart at 1, so it would let Substitute 1
      // overwrite Starter 1 and reattach that starter's ID document to the sub.
      playerMap[rosterSlotKey(rosterType, slot)] = pid;
      if (p.ign) playerMap[String(p.ign).trim()] = pid;

      const profile = resolvePublicProfileImage(p.profileImageFileId || '');
      appendRowObject(playersSheet, PLAYERS_HEADERS, {
        PlayerID: pid,
        TeamID: teamId,
        RealName: p.realName || '',
        IGN: p.ign || '',
        MlbbId: p.mlbbId || '',
        ServerId: p.serverId || '',
        StudentId: p.studentId || '',
        Role: p.role || '',
        RosterType: rosterType,
        VerificationStatus: 'Pending',
        SubmittedAt: now,
        ProfileImageFileId: profile.fileId || '',
        ProfileImageUrl: profile.url || '',
        ProfileImageVisible: profile.url ? 'Yes' : 'No'
      });
    });

    if (attachedDocIds.length > 0) {
      const docValues = docsSheet.getDataRange().getValues();
      const docIdIndex = docValues[0].indexOf('DocID');
      const teamIdIndex = docValues[0].indexOf('TeamID');
      const playerIdIndex = docValues[0].indexOf('PlayerID');

      for (let i = 1; i < docValues.length; i++) {
        const rowDocId = String(docValues[i][docIdIndex]);
        const match = attachedDocIds.find(function(item) {
          return (typeof item === 'string' && item === rowDocId) || (item && item.docId === rowDocId);
        });
        if (match) {
          docsSheet.getRange(i + 1, teamIdIndex + 1).setValue(teamId);
          // Only attach when the roster position is unambiguous. Documents saved
          // before rosterType was recorded carry no type, and guessing "Starter"
          // for those would silently file a substitute's ID under a starter.
          const slotKey = match.rosterType || match.type
            ? rosterSlotKey(match.rosterType || match.type, match.slot)
            : '';
          if (slotKey && playerMap[slotKey]) {
            docsSheet.getRange(i + 1, playerIdIndex + 1).setValue(playerMap[slotKey]);
          } else if (match.playerId) {
            docsSheet.getRange(i + 1, playerIdIndex + 1).setValue(match.playerId);
          } else if (match.ign && playerMap[String(match.ign).trim()]) {
            docsSheet.getRange(i + 1, playerIdIndex + 1).setValue(playerMap[String(match.ign).trim()]);
          }
        }
      }
    }
    logAudit('PUBLIC_REGISTRATION', 'CREATE_TEAM', teamId, 'Registered: ' + params.teamName);
    return { teamId: teamId, playerCount: players.length };
  } finally {
    lock.releaseLock();
  }
}

function listRegistrations() {
  const teams = sheetObjects(getSheet(TEAMS_SHEET_NAME, TEAMS_HEADERS));
  const players = sheetObjects(getSheet(PLAYERS_SHEET_NAME, PLAYERS_HEADERS));
  return teams.map(function (rawTeam) {
    const team = normalizeTeamRow(rawTeam);
    const roster = players.filter(function (p) { return String(p.TeamID) === String(team.TeamID); });
    return {
      TeamID: team.TeamID,
      TeamName: team.TeamName,
      Course: team.Course,
      CaptainName: team.CaptainName,
      ContactNumber: team.ContactNumber,
      Description: team.Description || '',
      LogoUrl: team.LogoUrl || '',
      TeamPhotoUrl: team.TeamPhotoUrl || '',
      RejectionReason: team.RejectionReason || '',
      Status: team.Status || 'Pending',
      SubmittedAt: team.SubmittedAt,
      PlayerCount: roster.length,
      VerifiedCount: roster.filter(function (p) { return p.VerificationStatus === 'Verified'; }).length
    };
  });
}

function listPublicTeams() {
  const teams = sheetObjects(getSheet(TEAMS_SHEET_NAME, TEAMS_HEADERS));
  const players = sheetObjects(getSheet(PLAYERS_SHEET_NAME, PLAYERS_HEADERS));
  const publishable = teams.map(normalizeTeamRow).filter(function (team) {
    const s = String(team.Status || '').toLowerCase();
    return s === 'approved' || s === 'rejected';
  });
  return publishable.map(function (team) {
    const course = String(team.Course || '');
    const courseParts = course.split(String.fromCharCode(0x2014));
    const isApproved = String(team.Status || '').toLowerCase() === 'approved';
    const roster = players.filter(function (player) {
      return String(player.TeamID) === String(team.TeamID);
    }).map(function (player, index) {
      return {
        playerId: player.PlayerID,
        slot: index + 1,
        rosterType: player.RosterType || 'Starter',
        realName: player.RealName || '',
        ign: player.IGN || '',
        role: player.Role || '',
        verificationStatus: player.VerificationStatus || 'Pending',
        profileImageUrl: isApproved && String(player.ProfileImageVisible).toLowerCase() === 'yes' ? (player.ProfileImageUrl || '') : ''
      };
    });
    return {
      teamId: team.TeamID,
      teamName: team.TeamName,
      course: course,
      division: courseParts[0] ? courseParts[0].trim() : '',
      department: courseParts.length > 1 ? courseParts[courseParts.length - 1].trim() : '',
      captainName: team.CaptainName || '',
      description: team.Description || '',
      logoUrl: team.LogoUrl || '',
      teamPhotoUrl: isApproved ? (team.TeamPhotoUrl || '') : '',
      approvalStatus: team.Status || 'Approved',
      rejectionReason: isApproved ? '' : (team.RejectionReason || ''),
      roster: roster
    };
  });
}

function getRegistration(teamId) {
  if (!teamId) throw new Error('teamId is required.');
  const teams = getSheet(TEAMS_SHEET_NAME, TEAMS_HEADERS);
  const players = getSheet(PLAYERS_SHEET_NAME, PLAYERS_HEADERS);
  const docs = getSheet(DOCS_SHEET_NAME, DOCS_HEADERS);

  const found = findRow(teams, 'TeamID', teamId);
  if (!found) throw new Error('No team found with ID ' + teamId + '.');
  const team = {};
  found.headers.forEach(function (h, i) { team[h] = found.row[i]; });
  const normalizedTeam = normalizeTeamRow(team);

  const roster = sheetObjects(players).filter(function (p) { return String(p.TeamID) === String(teamId); });
  const teamDocs = sheetObjects(docs).filter(function (d) { return String(d.TeamID) === String(teamId); });

  return { team: normalizedTeam, players: roster, documents: teamDocs };
}

function updateTeamStatus(params, user) {
  if (!params.teamId || VALID_TEAM_STATUSES.indexOf(params.status) < 0) throw new Error('Valid teamId and status are required.');
  const sheet = getSheet(TEAMS_SHEET_NAME, TEAMS_HEADERS);
  const found = findRow(sheet, 'TeamID', params.teamId);
  if (!found) throw new Error('Team not found.');
  sheet.getRange(found.rowIndex, found.headers.indexOf('Status') + 1).setValue(params.status);
  sheet.getRange(found.rowIndex, found.headers.indexOf('UpdatedAt') + 1).setValue(new Date());

  const rejectionReason = String(params.rejectionReason || params.auditNote || '').trim();
  if (rejectionReason) {
    const rrIdx = found.headers.indexOf('RejectionReason');
    if (rrIdx >= 0) {
      sheet.getRange(found.rowIndex, rrIdx + 1).setValue(rejectionReason);
    } else {
      const lastCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, lastCol).setValue('RejectionReason');
      sheet.getRange(found.rowIndex, lastCol).setValue(rejectionReason);
    }
  }
  const auditDetails = 'Status set to ' + params.status + (rejectionReason ? ' | Reason: ' + rejectionReason : '');
  logAudit(user.email, 'UPDATE_TEAM_STATUS', params.teamId, auditDetails);
  return { teamId: params.teamId, status: params.status };
}

function updatePlayerVerification(params, user) {
  if (!params.playerId || VALID_VERIFICATION_STATUSES.indexOf(params.verificationStatus) < 0) {
    throw new Error('Valid playerId and verificationStatus are required.');
  }
  const sheet = getSheet(PLAYERS_SHEET_NAME, PLAYERS_HEADERS);
  const found = findRow(sheet, 'PlayerID', params.playerId);
  if (!found) throw new Error('Player not found.');
  sheet.getRange(found.rowIndex, found.headers.indexOf('VerificationStatus') + 1).setValue(params.verificationStatus);
  logAudit(user.email, 'UPDATE_PLAYER_VERIFICATION', params.playerId, 'Verification set to ' + params.verificationStatus);
  return { playerId: params.playerId, verificationStatus: params.verificationStatus };
}

// -------------------------------------------------------------
// PHASE 5: TOURNAMENT OPERATIONS, OFFICIATING & MATCH DISPUTES
// -------------------------------------------------------------

function listMatches() {
  const matches = sheetObjects(getSheet(MATCHES_SHEET_NAME, MATCHES_HEADERS));
  return matches.map(function (match) {
    return {
      matchId: match.MatchID || '',
      court: match.Court || '',
      division: match.Division || '',
      stage: match.Stage || '',
      team1Id: match.Team1ID || '',
      team1Name: match.Team1Name || 'TBD',
      team1Score: Number(match.Team1Score || 0),
      team2Id: match.Team2ID || '',
      team2Name: match.Team2Name || 'TBD',
      team2Score: Number(match.Team2Score || 0),
      winnerId: match.WinnerID || '',
      winnerName: match.WinnerName || '',
      status: match.Status || 'Scheduled',
      streamUrl: match.StreamUrl || '',
      streamPublished: String(match.StreamPublished || '').toLowerCase() === 'yes' || (String(match.Status || '').toLowerCase() === 'live' && !!match.StreamUrl),
      scheduledAt: match.ScheduledAt || '',
      submittedAt: match.SubmittedAt || ''
    };
  });
}

function publishMatch(params, user) {
  if (!params.matchId) throw new Error('matchId is required.');
  const validStatuses = ['Scheduled', 'LIVE', 'Completed', 'Cancelled'];
  const status = validStatuses.indexOf(String(params.status || 'Scheduled')) >= 0 ? String(params.status || 'Scheduled') : 'Scheduled';
  const streamUrl = String(params.streamUrl || '').trim();
  if (streamUrl && !/(twitch\.tv\/|youtube\.com\/|youtu\.be\/|tiktok\.com\/)/i.test(streamUrl)) {
    throw new Error('Only Twitch, YouTube or TikTok LIVE stream links can be published.');
  }
  
  const sheet = getSheet(MATCHES_SHEET_NAME, MATCHES_HEADERS);
  const existing = findRow(sheet, 'MatchID', params.matchId);
  const isStreamPublished = params.streamPublished === 'true' || params.streamPublished === 'yes' ? 'Yes' : (streamUrl && status === 'LIVE' ? 'Yes' : 'No');

  if (existing) {
    const headers = existing.headers;
    const rIdx = existing.rowIndex;
    const setCol = function(name, val) {
      const idx = headers.indexOf(name);
      if (idx !== -1) sheet.getRange(rIdx, idx + 1).setValue(val);
    };
    if (params.court) setCol('Court', params.court);
    if (params.division) setCol('Division', params.division);
    if (params.stage) setCol('Stage', params.stage);
    if (params.team1Id !== undefined) setCol('Team1ID', params.team1Id);
    if (params.team1Name !== undefined) setCol('Team1Name', params.team1Name);
    if (params.score1 !== undefined) setCol('Team1Score', Number(params.score1 || 0));
    if (params.team2Id !== undefined) setCol('Team2ID', params.team2Id);
    if (params.team2Name !== undefined) setCol('Team2Name', params.team2Name);
    if (params.score2 !== undefined) setCol('Team2Score', Number(params.score2 || 0));
    if (params.winnerId !== undefined) setCol('WinnerID', params.winnerId);
    if (params.winnerName !== undefined) setCol('WinnerName', params.winnerName);
    setCol('Status', status);
    setCol('StreamUrl', streamUrl);
    setCol('OfficiatedBy', user.email);
    setCol('SubmittedAt', new Date());
    if (params.scheduledAt) setCol('ScheduledAt', params.scheduledAt);
    setCol('StreamPublished', isStreamPublished);
  } else {
    appendRowObject(sheet, MATCHES_HEADERS, {
      MatchID: params.matchId,
      Court: params.court || 'Court 1',
      Division: params.division || '',
      Stage: params.stage || '',
      Team1ID: params.team1Id || '',
      Team1Name: params.team1Name || '',
      Team1Score: Number(params.score1 || 0),
      Team2ID: params.team2Id || '',
      Team2Name: params.team2Name || '',
      Team2Score: Number(params.score2 || 0),
      WinnerID: params.winnerId || '',
      WinnerName: params.winnerName || '',
      Status: status,
      StreamUrl: streamUrl,
      OfficiatedBy: user.email,
      SubmittedAt: new Date(),
      ScheduledAt: params.scheduledAt || '',
      StreamPublished: isStreamPublished
    });
  }

  logAudit(user.email, 'PUBLISH_MATCH', params.matchId, 'Status: ' + status + (streamUrl ? ' | Stream published: ' + streamUrl : ''));
  return { matchId: params.matchId, status: status, streamUrl: streamUrl };
}

function deleteMatch(params, user) {
  if (!params.matchId) throw new Error('matchId is required.');
  const sheet = getSheet(MATCHES_SHEET_NAME, MATCHES_HEADERS);
  const found = findRow(sheet, 'MatchID', params.matchId);
  if (found) {
    sheet.deleteRow(found.rowIndex);
    logAudit(user.email, 'DELETE_MATCH', params.matchId, 'Deleted match from sheet');
  }
  return { matchId: params.matchId, deleted: true };
}

function listStandings() {
  const teams = listPublicTeams().filter(function (team) {
    return String(team.approvalStatus || team.Status || '').toLowerCase() === 'approved';
  });
  const matches = sheetObjects(getSheet(MATCHES_SHEET_NAME, MATCHES_HEADERS));
  const table = {};
  teams.forEach(function (team) {
    table[team.teamId] = {
      teamId: team.teamId, teamName: team.teamName, department: team.department,
      division: team.division, played: 0, wins: 0, losses: 0, points: 0
    };
  });
  matches.forEach(function (match) {
    if (String(match.Status || '').toLowerCase() !== 'completed') return;
    const one = table[match.Team1ID];
    const two = table[match.Team2ID];
    if (!one || !two) return;
    one.played += 1; two.played += 1;
    if (String(match.WinnerID) === String(one.teamId)) { one.wins += 1; one.points += 3; two.losses += 1; }
    else if (String(match.WinnerID) === String(two.teamId)) { two.wins += 1; two.points += 3; one.losses += 1; }
  });
  return Object.keys(table).map(function (key) { return table[key]; }).sort(function (a, b) {
    return b.points - a.points || b.wins - a.wins || a.teamName.localeCompare(b.teamName);
  });
}

function recordMatchResult(params, user) {
  if (!params.matchId || !params.winnerId) throw new Error('matchId and winnerId are required.');
  const sheet = getSheet(MATCHES_SHEET_NAME, MATCHES_HEADERS);
  const now = new Date();
  
  const existing = findRow(sheet, 'MatchID', params.matchId);
  if (existing) {
    const headers = existing.headers;
    const rIdx = existing.rowIndex;
    const setCol = function(name, val) {
      const idx = headers.indexOf(name);
      if (idx !== -1) sheet.getRange(rIdx, idx + 1).setValue(val);
    };
    if (params.score1 !== undefined) setCol('Team1Score', params.score1);
    if (params.score2 !== undefined) setCol('Team2Score', params.score2);
    if (params.winnerId) setCol('WinnerID', params.winnerId);
    if (params.winnerName) setCol('WinnerName', params.winnerName);
    if (params.team1Id) setCol('Team1ID', params.team1Id);
    if (params.team1Name) setCol('Team1Name', params.team1Name);
    if (params.team2Id) setCol('Team2ID', params.team2Id);
    if (params.team2Name) setCol('Team2Name', params.team2Name);
    if (params.court) setCol('Court', params.court);
    if (params.division) setCol('Division', params.division);
    if (params.stage) setCol('Stage', params.stage);
    setCol('Status', params.status || 'Completed');
    if (params.streamUrl !== undefined) setCol('StreamUrl', params.streamUrl);
    setCol('OfficiatedBy', user.email);
    setCol('SubmittedAt', now);
  } else {
    appendRowObject(sheet, MATCHES_HEADERS, {
      MatchID: params.matchId,
      Court: params.court || 'Court 1',
      Division: params.division || "Men's",
      Stage: params.stage || 'Round 1',
      Team1ID: params.team1Id || '',
      Team1Name: params.team1Name || '',
      Team1Score: params.score1 || 0,
      Team2ID: params.team2Id || '',
      Team2Name: params.team2Name || '',
      Team2Score: params.score2 || 0,
      WinnerID: params.winnerId,
      WinnerName: params.winnerName || '',
      Status: params.status || 'Completed',
      StreamUrl: params.streamUrl || '',
      OfficiatedBy: user.email,
      SubmittedAt: now
    });
  }

  logAudit(user.email, 'RECORD_MATCH_RESULT', params.matchId, 'Winner: ' + params.winnerName + ' (' + params.score1 + '-' + params.score2 + ')');
  return { matchId: params.matchId, winnerId: params.winnerId, status: params.status || 'Completed' };
}

function fileDispute(params, user) {
  if (!params.reason || !params.category) throw new Error('reason and category are required.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet(DISPUTES_SHEET_NAME, DISPUTES_HEADERS);
    const disputeId = nextId(sheet, 'DISPUTE');
    const now = new Date();
    const filedBy = (user && user.email) || params.filedBy || 'Staff';

    sheet.appendRow([
      disputeId,
      params.matchId || '',
      params.teamId || '',
      filedBy,
      params.category,
      params.reason,
      params.evidenceUrl || '',
      'Open',
      '',
      '',
      now,
      ''
    ]);

    logAudit(filedBy, 'FILE_DISPUTE', disputeId, 'Category: ' + params.category + ' | Reason: ' + params.reason);
    return { disputeId: disputeId, status: 'Open' };
  } finally {
    lock.releaseLock();
  }
}

function listDisputes(statusFilter) {
  const disputes = sheetObjects(getSheet(DISPUTES_SHEET_NAME, DISPUTES_HEADERS));
  if (statusFilter && statusFilter !== 'All') {
    return disputes.filter(function (d) { return String(d.Status).toLowerCase() === String(statusFilter).toLowerCase(); });
  }
  return disputes;
}

function resolveDispute(params, user) {
  if (!params.disputeId || !params.status || !params.resolution) throw new Error('disputeId, status, and resolution are required.');
  const sheet = getSheet(DISPUTES_SHEET_NAME, DISPUTES_HEADERS);
  const found = findRow(sheet, 'DisputeID', params.disputeId);
  if (!found) throw new Error('Dispute not found.');

  const now = new Date();
  sheet.getRange(found.rowIndex, found.headers.indexOf('Status') + 1).setValue(params.status);
  sheet.getRange(found.rowIndex, found.headers.indexOf('Resolution') + 1).setValue(params.resolution);
  sheet.getRange(found.rowIndex, found.headers.indexOf('ResolvedBy') + 1).setValue(user.email);
  sheet.getRange(found.rowIndex, found.headers.indexOf('ResolvedAt') + 1).setValue(now);

  logAudit(user.email, 'RESOLVE_DISPUTE', params.disputeId, 'Status: ' + params.status + ' | Rationale: ' + params.resolution);
  return { disputeId: params.disputeId, status: params.status, resolution: params.resolution };
}

function divisionMatches(target, value) {
  var d = String(value || '').toLowerCase();
  if (d === target) return true;
  if (target.indexOf('shs') !== -1 || target.indexOf('senior high') !== -1) {
    return d.indexOf('shs') !== -1 || d.indexOf('senior high') !== -1;
  }
  if (target.indexOf('women') !== -1) return d.indexOf('women') !== -1;
  if (target.indexOf('faculty') !== -1 || target.indexOf('exhibition') !== -1) {
    return d.indexOf('faculty') !== -1 || d.indexOf('exhibition') !== -1;
  }
  if (target.indexOf('men') !== -1) return d.indexOf('men') !== -1 && d.indexOf('women') === -1;
  return false;
}

/**
 * Rows for one bracket scope.
 *  department omitted  -> every bracket in the division (all departments + finals)
 *  department given    -> just that department's bracket ('' selects the
 *                         division-wide bracket used by Faculty / SHS / Grand Finals)
 */
function getBracketData(division, department) {
  const sheet = getSheet(BRACKETS_SHEET_NAME, BRACKET_HEADERS);
  const all = sheetObjects(sheet);
  const scoped = division
    ? all.filter(function (b) { return divisionMatches(String(division).toLowerCase(), b.Division); })
    : all;

  if (department === undefined || department === null) return scoped;
  const dept = String(department).trim().toUpperCase();
  return scoped.filter(function (b) {
    return String(b.Department || '').trim().toUpperCase() === dept;
  });
}

function saveBracketData(params, user) {
  if (!params.division || !params.matches) throw new Error('division and matches are required.');
  const sheet = getSheet(BRACKETS_SHEET_NAME, BRACKET_HEADERS);
  let matches = [];
  try { matches = JSON.parse(params.matches || '[]'); } catch (e) { throw new Error('matches must be valid JSON.'); }

  const division = String(params.division);
  const department = String(params.department || '').trim().toUpperCase();

  const values = sheet.getDataRange().getValues();
  const headers = values.length > 0 ? values[0].map(String) : BRACKET_HEADERS;
  const col = function (name) {
    const i = headers.indexOf(name);
    if (i === -1) throw new Error('BRACKETS sheet is missing the "' + name + '" column.');
    return i;
  };
  const matchKeyIdx = col('MatchKey');
  const divIdx = col('Division');
  const deptIdx = col('Department');
  const now = new Date();

  // Rows belonging to exactly this bracket scope (division + department).
  const scopeRows = {};        // matchKey -> sheet row number
  for (let i = 1; i < values.length; i++) {
    const rowDiv = String(values[i][divIdx] || '').toLowerCase();
    const rowDept = String(values[i][deptIdx] || '').trim().toUpperCase();
    if (rowDiv !== division.toLowerCase() || rowDept !== department) continue;
    scopeRows[String(values[i][matchKeyIdx] || '')] = i + 1;
  }

  const incoming = {};
  matches.forEach(function (m) { incoming[String(m.matchKey)] = true; });

  const setCell = function (rowIndex, name, value) {
    sheet.getRange(rowIndex, col(name) + 1).setValue(value);
  };

  matches.forEach(function (m) {
    const rowIndex = scopeRows[String(m.matchKey)];
    if (rowIndex) {
      setCell(rowIndex, 'Stage', m.stage || 'Round 1');
      setCell(rowIndex, 'Round', m.round || 1);
      setCell(rowIndex, 'Title', m.title || '');
      setCell(rowIndex, 'Format', m.format || '');
      setCell(rowIndex, 'Team1ID', m.team1Id || '');
      setCell(rowIndex, 'Team1Name', m.team1Name || '');
      setCell(rowIndex, 'Team2ID', m.team2Id || '');
      setCell(rowIndex, 'Team2Name', m.team2Name || '');
      setCell(rowIndex, 'Score1', m.score1 || 0);
      setCell(rowIndex, 'Score2', m.score2 || 0);
      setCell(rowIndex, 'WinnerID', m.winnerId || '');
      setCell(rowIndex, 'Status', m.status || 'Scheduled');
      setCell(rowIndex, 'NextMatchKey', m.nextMatchKey || '');
      setCell(rowIndex, 'NextSlot', m.nextSlot || '');
      setCell(rowIndex, 'UpdatedAt', now);
    } else {
      appendRowObject(sheet, BRACKET_HEADERS, {
        Division: division,
        Department: department,
        Stage: m.stage || 'Round 1',
        Round: m.round || 1,
        MatchKey: m.matchKey,
        Title: m.title || '',
        Format: m.format || '',
        Team1ID: m.team1Id || '',
        Team1Name: m.team1Name || '',
        Team2ID: m.team2Id || '',
        Team2Name: m.team2Name || '',
        Score1: m.score1 || 0,
        Score2: m.score2 || 0,
        WinnerID: m.winnerId || '',
        Status: m.status || 'Scheduled',
        NextMatchKey: m.nextMatchKey || '',
        NextSlot: m.nextSlot || '',
        UpdatedAt: now
      });
    }
  });

  // Republishing a smaller bracket (16 teams down to 8) must not leave the
  // rounds that no longer exist behind. Delete bottom-up so indices stay valid.
  const stale = [];
  Object.keys(scopeRows).forEach(function (key) {
    if (!incoming[key]) stale.push(scopeRows[key]);
  });
  stale.sort(function (a, b) { return b - a; });
  stale.forEach(function (rowIndex) { sheet.deleteRow(rowIndex); });

  const scopeLabel = department ? (division + ' / ' + department) : division;
  logAudit(user.email, 'SAVE_BRACKET', scopeLabel,
    'Published ' + matches.length + ' matches' + (stale.length ? ', removed ' + stale.length + ' stale' : ''));
  return { division: division, department: department, matchCount: matches.length, removed: stale.length };
}

function getAuditLogs() {
  const logs = sheetObjects(getSheet(AUDIT_SHEET_NAME, AUDIT_HEADERS));
  return logs.slice(-100).reverse(); // latest 100 entries
}
