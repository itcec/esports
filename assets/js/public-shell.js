(function () {
  function link(href, label) { return '<a href="' + href + '">' + label + '</a>'; }

  function init() {
    if (!document.querySelector('link[href*="assets/css/public.css"]')) {
      var stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'assets/css/public.css';
      document.head.appendChild(stylesheet);
    }
    document.body.classList.add('public-site');
    var header = document.querySelector('body > header');
    if (header) {
      header.classList.add('public-header');
      var nav = header.querySelector('nav:not(#mobile-nav)');
      var mobile = header.querySelector('#mobile-nav');
      var path = window.location.pathname;
      var links = [
        ['/','HOME', path === '/' || path.endsWith('/index.html')],
        ['/schedule','SCHEDULE', path.indexOf('tournament') >= 0 || path === '/schedule'],
        ['/bracket','BRACKET', path.indexOf('bracket') >= 0],
        ['/teams','TEAMS', path.indexOf('teams') >= 0],
        ['/rules','RULES', path.indexOf('rules') >= 0]
      ];
      var markup = links.map(function (item) {
        return '<a href="' + item[0] + '"' + (item[2] ? ' aria-current="page"' : '') + '>' + item[1] + '</a>';
      }).join('');
      if (nav) nav.innerHTML = markup;
      if (mobile) mobile.innerHTML = markup;
      header.querySelectorAll('.cec-auth-widget, a[href*="register-team"], #open-live-settings-btn').forEach(function (el) {
        el.remove();
      });
    }
    var footer = document.querySelector('body > footer');
    if (!footer) {
      footer = document.createElement('footer');
      document.body.appendChild(footer);
    }
    if (footer) {
      footer.className = 'public-footer';
      footer.innerHTML = '<div class="public-wrap public-footer-inner">' +
        '<div><div class="public-footer-brand">CEC ESPORTS INTRAMURALS 2026</div><small>Cebu Eastern College · Official tournament information</small></div>' +
        '<nav class="public-footer-links" aria-label="Footer">' +
        link('/','HOME') + link('/schedule','SCHEDULE') + link('/bracket','BRACKET') + link('/teams','TEAMS') + link('/rules','RULES') +
        '<a class="staff-link" href="/staff">STAFF LOGIN</a>' +
        '</nav></div>';
    }
    var routeMap = {
      'index.html': '/', 'tournament.html': '/schedule', 'bracket.html': '/bracket',
      'teams.html': '/teams', 'rules.html': '/rules', 'staff-login.html': '/staff',
      'admin.html': '/control-center'
    };
    document.querySelectorAll('a[href]').forEach(function (anchor) {
      var href = anchor.getAttribute('href');
      if (routeMap[href]) anchor.setAttribute('href', routeMap[href]);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
