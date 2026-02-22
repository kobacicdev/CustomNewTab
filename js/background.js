// ===== ツールバーアイコンクリック → 設定ページを新規タブで開く =====
chrome.action.onClicked.addListener(function() {
  chrome.tabs.create({ url: 'options.html' });
});