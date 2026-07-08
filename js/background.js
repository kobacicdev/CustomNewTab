// ===== ツールバーアイコンクリック → 設定ページを新規タブで開く =====
chrome.action.onClicked.addListener(function() {
  chrome.tabs.create({ url: 'options.html' });
});

// ===== マイグレーション: OAuthトークンを含むアカウント情報を sync → local へ移動 =====
// トークンは全デバイス同期される storage.sync に置かず、端末ローカルに保持する。
chrome.runtime.onInstalled.addListener(function() {
  var KEYS = ['gcalAccounts', 'driveAccounts'];
  chrome.storage.sync.get(KEYS, function(syncData) {
    if (chrome.runtime.lastError) return;
    chrome.storage.local.get(KEYS, function(localData) {
      var toLocal = {};
      var toRemove = [];
      KEYS.forEach(function(k) {
        if (syncData[k] === undefined) return;
        // local 未設定の場合のみ移行（既存の local を上書きしない）
        if (localData[k] === undefined) toLocal[k] = syncData[k];
        toRemove.push(k);
      });
      function clearSync() {
        if (toRemove.length) chrome.storage.sync.remove(toRemove);
      }
      if (Object.keys(toLocal).length) {
        chrome.storage.local.set(toLocal, clearSync);
      } else {
        clearSync();
      }
    });
  });
});