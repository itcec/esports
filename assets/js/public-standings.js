(function () {
  function render(el, rows) {
    if (!rows || !rows.length) { el.innerHTML = '<div class="empty-state">Standings will appear after the first official match results are recorded.</div>'; return; }
    el.innerHTML = '<div class="public-card" style="overflow:auto"><table class="public-table"><thead><tr><th>#</th><th>Team</th><th>Department</th><th>Played</th><th>Wins</th><th>Losses</th><th>Points</th></tr></thead><tbody>' + rows.map(function (t, i) { return '<tr><td>' + (i + 1) + '</td><td>' + CECPublic.esc(t.teamName) + '</td><td>' + CECPublic.esc(t.department || '') + '</td><td>' + t.played + '</td><td>' + t.wins + '</td><td>' + t.losses + '</td><td>' + t.points + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('standings-list');
    if (el) PublicTournamentApi.listStandings().then(function (data) { render(el, data); }).catch(function () { render(el, []); });
  });
})();
