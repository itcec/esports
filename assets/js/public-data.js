(function () {
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function dateText(value) {
    if (!value) return 'Date to be announced';
    var date = new Date(value);
    return isNaN(date.getTime()) ? esc(value) : date.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function safeImage(url, fallback) {
    return url ? '<img src="' + esc(url) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + (fallback || 'assets/e-sportslogo.png') + '\';">' : '';
  }
  window.CECPublic = {
    esc: esc,
    dateText: dateText,
    safeImage: safeImage,
    load: function (promise, target, render) {
      var el = typeof target === 'string' ? document.getElementById(target) : target;
      if (!el) return;
      promise.then(function (data) { render(el, data || []); }).catch(function (error) {
        el.innerHTML = '<div class="empty-state">Official data is temporarily unavailable. Please try again shortly.</div>';
        console.warn(error);
      });
    },
    teamLogo: function (team) {
      return team && (team.logoUrl || team.teamPhotoUrl) ? (team.logoUrl || team.teamPhotoUrl) : 'assets/e-sportslogo.png';
    }
  };
})();
