(function () {
  function render(el, teams) {
    if (!teams || !teams.length) { el.innerHTML = '<div class="empty-state">Approved teams will appear here after registration review.</div>'; return; }
    el.innerHTML = teams.map(function (team) {
      var photo = team.teamPhotoUrl || team.logoUrl;
      var roster = (team.roster || []).filter(function (p) { return p.profileImageUrl; }).slice(0, 5).map(function (p) { return '<img class="roster-avatar" src="' + CECPublic.esc(p.profileImageUrl) + '" alt="' + CECPublic.esc(p.ign || 'Player') + '" title="' + CECPublic.esc(p.ign || p.realName || 'Player') + '">'; }).join('');
      return '<article class="public-card team-card">' + (photo ? '<img class="team-photo" src="' + CECPublic.esc(photo) + '" alt="' + CECPublic.esc(team.teamName) + ' team photo" loading="lazy">' : '') + '<div class="team-heading"><div class="logo-surface">' + (team.logoUrl ? '<img src="' + CECPublic.esc(team.logoUrl) + '" alt="">' : '<span style="font-weight:900;color:#1264ff">' + CECPublic.esc((team.teamName || 'T').slice(0, 2).toUpperCase()) + '</span>') + '</div><div><h2>' + CECPublic.esc(team.teamName) + '</h2><div class="data-note">' + CECPublic.esc(team.department || team.division || '') + '</div></div></div><p>' + CECPublic.esc(team.description || 'Officially approved tournament team.') + '</p><div class="data-note">Captain: ' + CECPublic.esc(team.captainName || 'TBA') + '</div>' + (roster ? '<div class="roster-avatars" aria-label="Players with public profile images">' + roster + '</div>' : '') + '</article>';
    }).join('');
  }
  document.addEventListener('DOMContentLoaded', function () {
    var el = document.getElementById('teams-list');
    if (el) PublicTournamentApi.listTeams().then(function (data) { render(el, data); }).catch(function () { render(el, []); });
  });
})();
