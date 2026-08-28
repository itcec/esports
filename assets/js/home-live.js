(function () {
  function render(el, matches) {
    var now = matches.find(function (m) { return String(m.status).toLowerCase() === 'live'; });
    var next = now || matches.filter(function (m) { return String(m.status).toLowerCase() !== 'completed'; })[0];
    if (!next) {
      el.querySelector('.home-live-teams').textContent = 'No matches have been published yet.';
      return;
    }
    var label = now ? 'LIVE NOW' : (next.stage || 'NEXT MATCH');
    el.querySelector('.status-pill').textContent = label;
    el.querySelector('.home-live-teams').innerHTML = CECPublic.esc(next.team1Name || 'TBD') + ' <span class="home-live-score">' + CECPublic.esc(next.team1Score || 0) + ' — ' + CECPublic.esc(next.team2Score || 0) + '</span> ' + CECPublic.esc(next.team2Name || 'TBD');
    var note = el.querySelector('.data-note');
    note.textContent = [next.division, next.court].filter(Boolean).join(' · ') || 'Match status, scores, and streams are published by tournament officials.';
  }
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('home-live-summary');
    if (!el || !window.PublicTournamentApi) return;
    PublicTournamentApi.listMatches().then(function (matches) { render(el, matches || []); }).catch(function () {
      el.querySelector('.home-live-teams').textContent = 'Schedule will appear after officials publish matches.';
    });
  });
})();
