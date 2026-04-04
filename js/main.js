document.addEventListener('DOMContentLoaded', function() {
  loadCalendarEmbed();
  loadFavorites();
loadNews();
  applyLayoutSettings();
  document.getElementById('settings-btn').addEventListener('click', function() {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });
  setInterval(updateMeetingButtons, 30000);
});

// v1.3: レイアウト設定適用
function applyLayoutSettings() {
  chrome.storage.sync.get(['widgetSettings', 'columnWidths'], function(data) {
    var mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    var defaults = [
      { id: 'calendar', visible: true, column: 'left' },
      { id: 'favorites', visible: true, column: 'center' },
      { id: 'news', visible: true, column: 'right' }
    ];
    var settings = data.widgetSettings || defaults;
    var colMap = {
      left: document.getElementById('col-left'),
      center: document.getElementById('col-center'),
      right: document.getElementById('col-right')
    };
    settings.forEach(function(widget) {
      var els = document.querySelectorAll('[data-widget="' + widget.id + '"]');
      var targetCol = colMap[widget.column] || colMap.left;
      els.forEach(function(el) {
        if (!widget.visible) {
          el.style.display = 'none';
        } else {
          el.style.display = '';
          targetCol.appendChild(el);
        }
      });
    });
    // 空カラムを非表示にしてgridTemplateColumnsを再計算
    var colIds = ['col-left', 'col-center', 'col-right'];
    var widthParts = data.columnWidths ? data.columnWidths.split('-') : ['1', '1', '1'];
    var visibleWidths = [];
    colIds.forEach(function(colId, i) {
      var col = document.getElementById(colId);
      if (!col) return;
      var hasContent = col.childElementCount > 0;
      col.style.display = hasContent ? '' : 'none';
      if (hasContent) visibleWidths.push(parseFloat(widthParts[i] || 1) + 'fr');
    });
    if (visibleWidths.length > 0) {
      mainContent.style.gridTemplateColumns = visibleWidths.join(' ');
    }
  });
}
	