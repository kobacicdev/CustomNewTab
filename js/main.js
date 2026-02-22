document.addEventListener('DOMContentLoaded', function() {
  // カレンダー + 予定リストは loadCalendarEmbed() 内で
  // 1回のAPI呼び出しから同時描画（calendar.js に統合済み）
  try { loadCalendarEmbed(); } catch(e) { console.error('Calendar init error:', e); }
  try { loadFavorites(); } catch(e) { console.error('Favorites init error:', e); }
  try { loadNews(); } catch(e) { console.error('News init error:', e); }

  // 設定ボタン → options ページを新規タブで開く
  document.getElementById('settings-btn').addEventListener('click', function() {
    window.open(chrome.runtime.getURL('options.html'), '_blank');
  });
});