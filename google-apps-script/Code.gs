/**
 * CEC Esports 2026 registration API.
 * Bind this script to the tournament spreadsheet and deploy it as a Web App.
 * Public: createRegistration and listRegistrations (public fields only).
 * Staff: getRegistration and all status/verification writes.
 */
const TEAMS_SHEET_NAME = 'TEAMS';
const PLAYERS_SHEET_NAME = 'PLAYERS';
const SUPER_ADMIN_EMAIL = 'jlcabucos.cec@gmail.com';
const TEAMS_HEADERS = ['TeamID', 'TeamName', 'Course', 'CaptainName', 'ContactNumber', 'Description', 'Status', 'SubmittedAt', 'UpdatedAt'];
const PLAYERS_HEADERS = ['PlayerID', 'TeamID', 'RealName', 'IGN', 'MlbbId', 'ServerId', 'StudentId', 'Role', 'RosterType', 'VerificationStatus', 'SubmittedAt'];
const VALID_TEAM_STATUSES = ['Pending', 'UnderReview', 'Approved', 'Rejected'];
const VALID_VERIFICATION_STATUSES = ['Pending', 'Verified', 'Rejected'];

function doGet(e) { return route(e, 'GET'); }
function doPost(e) { return route(e, 'POST'); }

function route(e, method) {
  const params = (e && e.parameter) || {};
  const action = params.action || '';
  try {
    if (action === 'listRegistrations') {
      return json({ success: true, data: listRegistrations(), message: 'OK' });
    }
    if (action === 'getRegistration' || action === 'updateTeamStatus' || action === 'updatePlayerVerification') {
      requireStaff(params);
    }
    if ((method === 'GET' || method === 'POST') && action === 'getRegistration') return json({ success: true, data: getRegistration(params.teamId) });
    if (method === 'POST' && action === 'createRegistration') return json({ success: true, data: createRegistration(params), message: 'Registration submitted.' });
    if (method === 'POST' && action === 'updateTeamStatus') return json({ success: true, data: updateTeamStatus(params), message: 'Team status updated.' });
    if (method === 'POST' && action === 'updatePlayerVerification') return json({ success: true, data: updatePlayerVerification(params), message: 'Player verification updated.' });
    return json({ success: false, error: { code: 'UNKNOWN_ACTION', message: 'Unknown action.' } });
  } catch (err) {
    return json({ success: false, error: { code: 'REQUEST_FAILED', message: String(err.message || err) } });
  }
}

function json(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }

/** Firebase ID tokens are verified server-side; the browser UI is not trusted. */
function requireStaff(params) {
  const props = PropertiesService.getScriptProperties();
  const legacyKey = props.getProperty('ADMIN_KEY');
  if (legacyKey && params.adminKey === legacyKey) return; // temporary migration escape hatch
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
  return sheet;
}

function setupSheets() { getSheet(TEAMS_SHEET_NAME, TEAMS_HEADERS); getSheet(PLAYERS_SHEET_NAME, PLAYERS_HEADERS); }

function sheetObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1).map(function (row) {
    const result = {}; values[0].forEach(function (header, i) { result[header] = row[i]; }); return result;
  });
}

function nextId(sheet, prefix) { return prefix + '-' + String(sheet.getLastRow()).padStart(4, '0'); }
function findRow(sheet, column, id) {
  const values = sheet.getDataRange().getValues();
  if (!values.length) return null;
  const index = values[0].indexOf(column);
  for (let i = 1; i < values.length; i++) if (String(values[i][index]) === String(id)) return { rowIndex: i + 1, headers: values[0], row: values[i] };
  return null;
}

function createRegistration(params) {
  if (!params.teamName || !params.captainName || !params.contactNumber) throw new Error('teamName, captainName, and contactNumber are required.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const teams = getSheet(TEAMS_SHEET_NAME, TEAMS_HEADERS);
    const playersSheet = getSheet(PLAYERS_SHEET_NAME, PLAYERS_HEADERS);
    const teamId = nextId(teams, 'TEAM'); const now = new Date();
    teams.appendRow([teamId, params.teamName, params.course || '', params.captainName, params.contactNumber, params.description || '', 'Pending', now, now]);
    let players = []; try { players = JSON.parse(params.players || '[]'); } catch (e) { throw new Error('players must be valid JSON.'); }
    players.forEach(function (p) {
      playersSheet.appendRow([nextId(playersSheet, 'PLAYER'), teamId, p.realName || '', p.ign || '', p.mlbbId || '', p.serverId || '', p.studentId || '', p.role || '', p.rosterType || 'Starter', 'Pending', now]);
    });
    return { teamId: teamId, playerCount: players.length };
  } finally { lock.releaseLock(); }
}

function listRegistrations() {
  const teams = sheetObjects(getSheet(TEAMS_SHEET_NAME, TEAMS_HEADERS));
  const players = sheetObjects(getSheet(PLAYERS_SHEET_NAME, PLAYERS_HEADERS));
  return teams.map(function (team) {
    const roster = players.filter(function (p) { return String(p.TeamID) === String(team.TeamID); });
    return { TeamID: team.TeamID, TeamName: team.TeamName, Course: team.Course, Status: team.Status, SubmittedAt: team.SubmittedAt, PlayerCount: roster.length, VerifiedCount: roster.filter(function (p) { return p.VerificationStatus === 'Verified'; }).length };
  });
}

function getRegistration(teamId) {
  if (!teamId) throw new Error('teamId is required.');
  const teams = getSheet(TEAMS_SHEET_NAME, TEAMS_HEADERS); const players = getSheet(PLAYERS_SHEET_NAME, PLAYERS_HEADERS);
  const found = findRow(teams, 'TeamID', teamId); if (!found) throw new Error('No team found with ID ' + teamId + '.');
  const team = {}; found.headers.forEach(function (h, i) { team[h] = found.row[i]; });
  return { team: team, players: sheetObjects(players).filter(function (p) { return String(p.TeamID) === String(teamId); }) };
}

function updateTeamStatus(params) {
  if (!params.teamId || VALID_TEAM_STATUSES.indexOf(params.status) < 0) throw new Error('Valid teamId and status are required.');
  const sheet = getSheet(TEAMS_SHEET_NAME, TEAMS_HEADERS); const found = findRow(sheet, 'TeamID', params.teamId); if (!found) throw new Error('Team not found.');
  sheet.getRange(found.rowIndex, found.headers.indexOf('Status') + 1).setValue(params.status); sheet.getRange(found.rowIndex, found.headers.indexOf('UpdatedAt') + 1).setValue(new Date());
  return { teamId: params.teamId, status: params.status };
}

function updatePlayerVerification(params) {
  if (!params.playerId || VALID_VERIFICATION_STATUSES.indexOf(params.verificationStatus) < 0) throw new Error('Valid playerId and verificationStatus are required.');
  const sheet = getSheet(PLAYERS_SHEET_NAME, PLAYERS_HEADERS); const found = findRow(sheet, 'PlayerID', params.playerId); if (!found) throw new Error('Player not found.');
  sheet.getRange(found.rowIndex, found.headers.indexOf('VerificationStatus') + 1).setValue(params.verificationStatus);
  return { playerId: params.playerId, verificationStatus: params.verificationStatus };
}
