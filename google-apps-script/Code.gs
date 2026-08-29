/**
 * CEC Esports 2026 registration, officiating, bracket, and tournament operations API.
 * Bind this script to the tournament spreadsheet and deploy it as a Web App.
 * Public: createRegistration, listRegistrations, listPublicTeams, listMatches, listStandings, fileDispute,
 * uploadVerificationFile, uploadProfileImage.
 * Staff (requires Firebase ID token): getRegistration, getPrivateVerificationFile, updateTeamStatus,
 * updatePlayerVerification, recordMatchResult, listDisputes, resolveDispute, saveBracketData, getAuditLogs.
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
const BRACKET_HEADERS = ['Division', 'Stage', 'MatchKey', 'Team1ID', 'Team1Name', 'Team2ID', 'Team2Name', 'Score1', 'Score2', 'WinnerID', 'UpdatedAt'];

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
    if (action === 'listRegistrations') {
      return json({ success: true, data: listRegistrations(), message: 'OK' });
    }
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
      return json({ success: true, data: getBracketData(params.division), message: 'OK' });
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
    if (method === 'POST' && action === 'fileDispute') {
      return json({ success: true, data: fileDispute(params), message: 'Dispute filed successfully.' });
    }

    // Authenticated Staff Endpoints
    const staffActions = [
      'getRegistration', 'getPrivateVerificationFile', 'getPrivateVerificationBatch', 'updateTeamStatus',
      'updatePlayerVerification', 'recordMatchResult', 'publishMatch', 'deleteMatch', 'listDisputes',
      'resolveDispute', 'saveBracketData', 'getAuditLogs'
    ];

    if (staffActions.indexOf(action) !== -1) {
      const user = requireStaff(params);

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

/** Firebase ID tokens are verified server-side */
function requireStaff(params) {
  const props = PropertiesService.getScriptProperties();
  const legacyKey = props.getProperty('ADMIN_KEY');
  if (legacyKey && params.adminKey === legacyKey) return { email: 'legacy-admin', localId: 'legacy' };
  const token = params.idToken;
  if (!token) throw new Error('A Firebase staff token is required.');
  const apiKey = props.getProperty('FIREBASE_WEB_API_KEY');
  if (!apiKey) throw new Error('FIREBASE_WEB_API_KEY is not configured in Script Properties.');
  const lookup = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: token }), muteHttpExceptions: true
  });
  if (lookup.getResponseCode() !== 200) throw new Error('Invalid or expired Firebase token.');
  const body = JSON.parse(lookup.getContentText());
  const user = body.users && body.users[0];
  if (!user || user.emailVerified !== true) throw new Error('Verified staff account required.');
  const email = String(user.email || '').toLowerCase();
  if (email === SUPER_ADMIN_EMAIL) return user;

  const dbUrl = props.getProperty('FIREBASE_DATABASE_URL');
  if (!dbUrl) throw new Error('FIREBASE_DATABASE_URL is not configured in Script Properties.');
  const staffResponse = UrlFetchApp.fetch(dbUrl.replace(/\/$/, '') + '/staff/' + encodeURIComponent(user.localId) + '.json?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (staffResponse.getResponseCode() !== 200) throw new Error('Could not verify staff approval.');
  const staff = JSON.parse(staffResponse.getContentText());
  if (!staff || staff.status !== 'approved') throw new Error('Approved staff account required.');
  return user;
}

function getSheet(name, headers) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name) || SpreadsheetApp.getActiveSpreadsheet().insertSheet(name);
  if (sheet.getLastRow() === 0) { sheet.appendRow(headers); sheet.setFrozenRows(1); }
  else {
    // Add newly introduced columns without breaking an existing production sheet.
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

  // Find the real logo:
  let realLogo = '';
  if (isEmblemOrImageUrl(logoVal)) {
    realLogo = logoVal;
  } else if (isEmblemOrImageUrl(statusVal)) {
    realLogo = statusVal;
  }

  // Find the real status:
  let realStatus = 'Pending';
  if (VALID_TEAM_STATUSES.indexOf(statusVal) !== -1) {
    realStatus = statusVal;
  } else if (VALID_TEAM_STATUSES.indexOf(String(t.UpdatedAt).trim()) !== -1) {
    realStatus = String(t.UpdatedAt).trim();
  } else if (VALID_TEAM_STATUSES.indexOf(photoVal) !== -1) {
    realStatus = photoVal;
  }

  // Find the real photo:
  let realPhoto = '';
  if (isEmblemOrImageUrl(photoVal) && photoVal.toLowerCase().indexOf('assets/icons/') === -1) {
    realPhoto = photoVal;
  } else if (isEmblemOrImageUrl(submittedVal) && submittedVal.toLowerCase().indexOf('assets/icons/') === -1) {
    realPhoto = submittedVal;
  }

  // Find the real submitted date:
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

function nextId(sheet, prefix) {
  return prefix + '-' + String(sheet.getLastRow()).padStart(4, '0');
}

function findRow(sheet, column, id) {
  const values = sheet.getDataRange().getValues();
  if (!values.length) return null;
  const index = values[0].indexOf(column);
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

function uploadVerificationFile(params) {
  if (!params.fileBase64 || !params.docType) throw new Error('fileBase64 and docType are required.');
  const mimeType = params.mimeType || 'image/jpeg';
  if (ALLOWED_MIME_TYPES.indexOf(mimeType) === -1) throw new Error('Invalid file type.');
  const bytes = Utilities.base64Decode(params.fileBase64);
  if (bytes.length > MAX_FILE_SIZE_BYTES) throw new Error('File exceeds the 5MB limit.');

  const folder = getVerificationFolder();
  const ext = mimeType === 'application/pdf' ? '.pdf' : (mimeType === 'image/png' ? '.png' : (mimeType === 'image/webp' ? '.webp' : '.jpg'));
  const safeName = 'DOC_' + Date.now() + '_' + (params.docType || 'id') + ext;
  const blob = Utilities.newBlob(bytes, mimeType, safeName);
  const file = folder.createFile(blob);

  const docsSheet = getSheet(DOCS_SHEET_NAME, DOCS_HEADERS);
  const docId = nextId(docsSheet, 'DOC');
  const now = new Date();

  docsSheet.appendRow([docId, params.playerId || '', params.teamId || '', params.docType || 'id_card', file.getId(), mimeType, params.fileName || safeName, now, 'Pending']);
  return { docId: docId, driveFileId: file.getId(), fileName: params.fileName || safeName, docType: params.docType, mimeType: mimeType, status: 'Pending' };
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
  if (!belongsToPublicFolder) throw new Error('Invalid profile image reference.');
  return {
    fileId: file.getId(),
    url: 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(file.getId())
  };
}

function getPrivateVerificationFile(fileId) {
  if (!fileId) throw new Error('fileId is required.');
  const file = DriveApp.getFileById(fileId);
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
      const file = DriveApp.getFileById(fileId);
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
    players.forEach(function (p) {
      const pid = nextId(playersSheet, 'PLAYER');
      playerMap[p.slot || p.ign] = pid;
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
        RosterType: p.rosterType || 'Starter',
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
          if (match.slot && playerMap[match.slot]) {
            docsSheet.getRange(i + 1, playerIdIndex + 1).setValue(playerMap[match.slot]);
          } else if (match.playerId) {
            docsSheet.getRange(i + 1, playerIdIndex + 1).setValue(match.playerId);
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
  return teams.map(normalizeTeamRow).filter(function (team) { return String(team.Status).toLowerCase() === 'approved'; }).map(function (team) {
    const course = String(team.Course || '');
    const courseParts = course.split(String.fromCharCode(0x2014));
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
        profileImageUrl: String(player.ProfileImageVisible).toLowerCase() === 'yes' ? (player.ProfileImageUrl || '') : ''
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
      teamPhotoUrl: team.TeamPhotoUrl || '',
      approvalStatus: team.Status || 'Approved',
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
  logAudit(user.email, 'UPDATE_TEAM_STATUS', params.teamId, 'Status set to ' + params.status);
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
  if (streamUrl && !/twitch\.tv\//i.test(streamUrl)) throw new Error('Only Twitch stream links can be published.');
  const sheet = getSheet(MATCHES_SHEET_NAME, MATCHES_HEADERS);
  const existing = findRow(sheet, 'MatchID', params.matchId);
  const values = [params.matchId, params.court || 'Court 1', params.division || '', params.stage || '', params.team1Id || '', params.team1Name || '', Number(params.score1 || 0), params.team2Id || '', params.team2Name || '', Number(params.score2 || 0), params.winnerId || '', params.winnerName || '', status, streamUrl, user.email, new Date(), params.scheduledAt || '', params.streamPublished === 'true' || params.streamPublished === 'yes' ? 'Yes' : (streamUrl && status === 'LIVE' ? 'Yes' : 'No')];
  if (existing) sheet.getRange(existing.rowIndex, 1, 1, MATCHES_HEADERS.length).setValues([values]);
  else sheet.appendRow(values);
  logAudit(user.email, 'PUBLISH_MATCH', params.matchId, 'Status: ' + status + (streamUrl ? ' | Twitch stream published' : ''));
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
  const teams = listPublicTeams();
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
    sheet.getRange(existing.rowIndex, existing.headers.indexOf('Team1Score') + 1).setValue(params.score1 || 0);
    sheet.getRange(existing.rowIndex, existing.headers.indexOf('Team2Score') + 1).setValue(params.score2 || 0);
    sheet.getRange(existing.rowIndex, existing.headers.indexOf('WinnerID') + 1).setValue(params.winnerId);
    sheet.getRange(existing.rowIndex, existing.headers.indexOf('WinnerName') + 1).setValue(params.winnerName || '');
    sheet.getRange(existing.rowIndex, existing.headers.indexOf('Status') + 1).setValue(params.status || 'Completed');
    sheet.getRange(existing.rowIndex, existing.headers.indexOf('StreamUrl') + 1).setValue(params.streamUrl || '');
    sheet.getRange(existing.rowIndex, existing.headers.indexOf('OfficiatedBy') + 1).setValue(user.email);
    sheet.getRange(existing.rowIndex, existing.headers.indexOf('SubmittedAt') + 1).setValue(now);
  } else {
    sheet.appendRow([
      params.matchId,
      params.court || 'Court 1',
      params.division || "Men's",
      params.stage || 'Round 1',
      params.team1Id || '',
      params.team1Name || '',
      params.score1 || 0,
      params.team2Id || '',
      params.team2Name || '',
      params.score2 || 0,
      params.winnerId,
      params.winnerName || '',
      params.status || 'Completed',
      params.streamUrl || '',
      user.email,
      now
    ]);
  }

  logAudit(user.email, 'RECORD_MATCH_RESULT', params.matchId, 'Winner: ' + params.winnerName + ' (' + params.score1 + '-' + params.score2 + ')');
  return { matchId: params.matchId, winnerId: params.winnerId, status: params.status || 'Completed' };
}

function fileDispute(params) {
  if (!params.reason || !params.category) throw new Error('reason and category are required.');
  const sheet = getSheet(DISPUTES_SHEET_NAME, DISPUTES_HEADERS);
  const disputeId = nextId(sheet, 'DISPUTE');
  const now = new Date();

  sheet.appendRow([
    disputeId,
    params.matchId || '',
    params.teamId || '',
    params.filedBy || 'Anonymous',
    params.category,
    params.reason,
    params.evidenceUrl || '',
    'Open',
    '',
    '',
    now,
    ''
  ]);

  logAudit(params.filedBy || 'Public', 'FILE_DISPUTE', disputeId, 'Category: ' + params.category + ' | Reason: ' + params.reason);
  return { disputeId: disputeId, status: 'Open' };
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

function getBracketData(division) {
  const sheet = getSheet(BRACKETS_SHEET_NAME, BRACKET_HEADERS);
  const all = sheetObjects(sheet);
  if (division) {
    return all.filter(function (b) { return String(b.Division).toLowerCase() === String(division).toLowerCase(); });
  }
  return all;
}

function saveBracketData(params, user) {
  if (!params.division || !params.matches) throw new Error('division and matches are required.');
  const sheet = getSheet(BRACKETS_SHEET_NAME, BRACKET_HEADERS);
  let matches = [];
  try { matches = JSON.parse(params.matches || '[]'); } catch (e) { throw new Error('matches must be valid JSON.'); }

  const now = new Date();
  matches.forEach(function (m) {
    const found = findRow(sheet, 'MatchKey', m.matchKey);
    if (found) {
      sheet.getRange(found.rowIndex, found.headers.indexOf('Team1ID') + 1).setValue(m.team1Id || '');
      sheet.getRange(found.rowIndex, found.headers.indexOf('Team1Name') + 1).setValue(m.team1Name || '');
      sheet.getRange(found.rowIndex, found.headers.indexOf('Team2ID') + 1).setValue(m.team2Id || '');
      sheet.getRange(found.rowIndex, found.headers.indexOf('Team2Name') + 1).setValue(m.team2Name || '');
      sheet.getRange(found.rowIndex, found.headers.indexOf('Score1') + 1).setValue(m.score1 || 0);
      sheet.getRange(found.rowIndex, found.headers.indexOf('Score2') + 1).setValue(m.score2 || 0);
      sheet.getRange(found.rowIndex, found.headers.indexOf('WinnerID') + 1).setValue(m.winnerId || '');
      sheet.getRange(found.rowIndex, found.headers.indexOf('UpdatedAt') + 1).setValue(now);
    } else {
      sheet.appendRow([
        params.division,
        m.stage || 'Round 1',
        m.matchKey,
        m.team1Id || '',
        m.team1Name || '',
        m.team2Id || '',
        m.team2Name || '',
        m.score1 || 0,
        m.score2 || 0,
        m.winnerId || '',
        now
      ]);
    }
  });

  logAudit(user.email, 'SAVE_BRACKET', params.division, 'Updated ' + matches.length + ' bracket matches');
  return { division: params.division, matchCount: matches.length };
}

function getAuditLogs() {
  const logs = sheetObjects(getSheet(AUDIT_SHEET_NAME, AUDIT_HEADERS));
  return logs.slice(-100).reverse(); // latest 100 entries
}
