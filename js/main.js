document.addEventListener('DOMContentLoaded', function() {
  // カレンダー + 予定リストは loadCalendarEmbed() 内で
  // 1回のAPI呼び出しから同時描画（calendar.js に統合済み）
  try { loadCalendarEmbed(); } catch(e) { console.error('Calendar init error:', e); }
  try { loadFavorites(); } catch(e) { console.error('Favorites init error:', e); }
  try { loadSearchArea(); } catch(e) { console.error('Search init error:', e); }
  try { loadNews(); } catch(e) { console.error('News init error:', e); }

  // 会議参加ボタン状態を即時 + 1分ごとに自動更新
  try { updateMeetingButtons(); } catch(e) {}
  setInterval(function() {
    try { updateMeetingButtons(); } catch(e) { console.error('Meeting button update error:', e); }
  }, 60000);

  // 設定ボタン → options ページを新規タブで開く
  document.getElementById('settings-btn').addEventListener('click', function() {
    window.open(chrome.runtime.getURL('options.html'), '_blank');
  });
});