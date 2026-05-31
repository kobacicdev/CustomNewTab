var SEARCH_DEFAULTS = [
  {id:'google',name:'Google',url:'https://www.google.com/search?q=%s',icon:'https://www.google.com/favicon.ico',enabled:true},
  {id:'perplexity',name:'Perplexity',url:'https://www.perplexity.ai/search?q=%s',icon:'https://www.google.com/s2/favicons?sz=64&domain=perplexity.ai',enabled:true}
];
function loadSearchArea() {
  chrome.storage.sync.get('searchEngines', function(data) {
    renderSearchArea(data.searchEngines || SEARCH_DEFAULTS);
  });
}
function renderSearchArea(engines) {
  var area = document.getElementById('search-area');
  if (!area) return;
  var enabled = engines.filter(function(e) { return e.enabled; });
  if (enabled.length === 0) { area.style.display = 'none'; return; }
  area.style.display = '';
  area.setAttribute('data-count', enabled.length);
  var html = '';
  enabled.forEach(function(engine) {
    html += '<div class="search-box">' +
      '<form data-url="' + escapeSearchAttr(engine.url) + '">' +
      '<img src="' + escapeSearchAttr(engine.icon) + '" alt="' + escapeSearchAttr(engine.name) + '" class="search-icon" onerror="this.style.display=\'none\'">' +
      '<input type="text" placeholder="' + escapeSearchAttr(engine.name) + ' で検索...">' +
      '</form></div>';
  });
  area.innerHTML = html;
  area.querySelectorAll('form').forEach(function(form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      var q = this.querySelector('input').value.trim();
      if (!q) return;
      window.location.href = this.getAttribute('data-url').replace('%s', encodeURIComponent(q));
    });
  });
}
function escapeSearchAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
