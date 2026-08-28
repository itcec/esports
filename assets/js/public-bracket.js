(function () {
  function render(el, rows) {
    if (!rows || !rows.length) { el.innerHTML = '<div class="empty-state">The bracket will appear here when tournament officials publish it.</div>'; return; }
    el.innerHTML = rows.map(function (m) {
      return '<article class="public-card bracket-match"><div class="schedule-meta"><span class="status-pill">' + CECPublic.esc(m.Stage || 'Round') + '</span><span class="data-note">' + CECPublic.esc(m.Division || '') + '</span></div><div class="bracket-team"><span>' + CECPublic.esc(m.Team1Name || 'TBD') + '</span><b>' + CECPublic.esc(m.Score1 || 0) + '</b></div><div class="bracket-team"><span>' + CECPublic.esc(m.Team2Name || 'TBD') + '</span><b>' + CECPublic.esc(m.Score2 || 0) + '</b></div></article>';
    }).join('');
  }
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('bracket-list');
    if (!el) return;
    PublicTournamentApi.listBracket('').then(function (data) { render(el, data); }).catch(function () { render(el, []); });
  });
})();
