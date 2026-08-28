(function () {
  function twitchEmbed(url) {
    var raw = String(url || '').trim();
    var match = raw.match(/twitch\.tv\/(?:videos\/)?([A-Za-z0-9_]+)/i);
    if (!match || /videos\//i.test(raw)) return '';
    return 'https://player.twitch.tv/?channel=' + encodeURIComponent(match[1]) + '&parent=' + encodeURIComponent(window.location.hostname) + '&autoplay=false';
  }
  function render(el, matches) {
    matches = (matches || []).slice().sort(function (a, b) { return String(a.submittedAt || '').localeCompare(String(b.submittedAt || '')); });
    if (!matches.length) { el.innerHTML = '<div class="empty-state">No official matches have been published yet.</div>'; return; }
    el.innerHTML = matches.map(function (m) {
      var live = String(m.status || '').toLowerCase() === 'live';
      var embed = live ? twitchEmbed(m.streamUrl) : '';
      var watch = embed ? '<a class="public-button" target="_blank" rel="noopener" href="' + CECPublic.esc(m.streamUrl) + '">WATCH LIVE</a>' : '';
      return '<article class="public-card schedule-row">' +
        '<div class="schedule-meta"><span class="status-pill">' + CECPublic.esc(m.status || 'Scheduled') + '</span><span class="data-note">' + CECPublic.esc(m.division || '') + (m.stage ? ' · ' + CECPublic.esc(m.stage) : '') + '</span></div>' +
        '<div class="schedule-match"><strong>' + CECPublic.esc(m.team1Name || 'TBD') + '</strong><span class="schedule-score">' + CECPublic.esc(m.team1Score || 0) + ' — ' + CECPublic.esc(m.team2Score || 0) + '</span><strong>' + CECPublic.esc(m.team2Name || 'TBD') + '</strong></div>' +
        '<div class="schedule-bottom"><span class="data-note">' + CECPublic.esc(m.scheduledAt ? CECPublic.dateText(m.scheduledAt) : (m.court || 'Venue to be announced')) + '</span>' + watch + '</div>' +
        (embed ? '<iframe class="twitch-frame" src="' + embed + '" title="Official Twitch stream" allowfullscreen></iframe>' : '') +
        '</article>';
    }).join('');
  }
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('schedule-list');
    if (el) PublicTournamentApi.listMatches().then(function (data) { render(el, data); }).catch(function () { el.innerHTML = '<div class="empty-state">The official schedule could not be loaded.</div>'; });
  });
})();
