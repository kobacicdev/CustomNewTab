document.addEventListener('DOMContentLoaded', function() {
  loadCalendarEmbed();
  loadFavorites();
  loadSearchArea();
  loadNews();
  loadDriveWidget();
applyLayoutSettings();
  document.getElementById('settings-btn').addEventListener('click', function() {
    document.getElementById('settings-panel-overlay').classList.add('show');
    initOptionsPanel();
  });
  document.getElementById('settings-close-btn').addEventListener('click', function() {
    var modal = document.getElementById('modal-overlay');
    if (modal) modal.classList.remove('show');
    document.getElementById('settings-panel-overlay').classList.remove('show');
    refreshAfterSettings();
  });
  document.getElementById('settings-panel-overlay').addEventListener('click', function(e) {
    if (e.target === this) {
      var modal = document.getElementById('modal-overlay');
      if (modal) modal.classList.remove('show');
      this.classList.remove('show');
      refreshAfterSettings();
    }
  });
  setInterval(updateMeetingButtons, 30000);
});

// 設定パネルを閉じた後にメインページを更新
function refreshAfterSettings() {
  if (typeof fetchAllSources === 'function') fetchAllSources(true);
  if (typeof loadFavorites === 'function') loadFavorites();
  if (typeof loadDriveWidget === 'function') loadDriveWidget();
applyLayoutSettings();
}

// v1.3: レイアウト設定適用
function applyLayoutSettings() {
  chrome.storage.sync.get(['widgetSettings', 'columnWidths', 'columnCount'], function(data) {
    var mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    var colCount = parseInt(data.columnCount) || 3;
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
          el.style.flex = '';
        } else {
          el.style.display = '';
          el.style.flex = widget.height || 1;
          targetCol.appendChild(el);
        }
      });
    });
    // 列数設定に応じてカラムを表示/非表示にしてgridTemplateColumnsを再計算
    var colIds = ['col-left', 'col-center', 'col-right'];
    var widthParts = data.columnWidths ? data.columnWidths.split('-') : ['1', '1', '1'];
    var visibleWidths = [];
    colIds.forEach(function(colId, i) {
      var col = document.getElementById(colId);
      if (!col) return;
      var hasContent = col.childElementCount > 0;
      var withinCount = i < colCount;
      col.style.display = (hasContent && withinCount) ? '' : 'none';
      if (hasContent && withinCount) visibleWidths.push(parseFloat(widthParts[i] || 1) + 'fr');
    });
    if (visibleWidths.length > 0) {
      mainContent.style.gridTemplateColumns = visibleWidths.join(' ');
    }
  });
}
	