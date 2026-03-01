// js/theme.js — テーマ即時適用（ちらつき防止）
(function() {
  // localStorage で即時適用（FOUC防止）
  var cached = localStorage.getItem('ntTheme')||'slate'; document.documentElement.setAttribute('data-theme', cached);
  // chrome.storage で正式値を同期
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get('theme', function(data) {
      var theme = data.theme || 'dark-purple';
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('ntTheme', theme);
    });
  }
})();