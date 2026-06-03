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
  chrome.storage.sync.get(['widgetSettings', 'columnWidths', 'columnCount', 'driveAccounts'], function(data) {
    var mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    var colCount = parseInt(data.columnCount) || 3;
    var defaults = [
      { id: 'calendar', visible: true,  column: 'left',   height: 1 },
      { id: 'favorites', visible: true, column: 'center', height: 1 },
      { id: 'news',      visible: true, column: 'right',  height: 1 },
      { id: 'drive',     visible: false, column: 'right', height: 1 }
    ];
    var settings = data.widgetSettings || defaults;

    // driveアカウントがあれば自動で visible:true に（既存設定・初回ともに対応）
    if ((data.driveAccounts || []).length > 0) {
      var colNames0 = ['left', 'center', 'right'];
      var driveWidget = settings.find(function(w) { return w.id === 'drive'; });
      if (!driveWidget) {
        driveWidget = { id: 'drive', visible: true, column: colNames0[colCount - 1], height: 1 };
        settings.push(driveWidget);
        chrome.storage.sync.set({ widgetSettings: settings });
      } else if (!driveWidget.visible) {
        driveWidget.visible = true;
        var colIdx0 = colNames0.indexOf(driveWidget.column);
        if (colIdx0 < 0 || colIdx0 >= colCount) driveWidget.column = colNames0[colCount - 1];
        chrome.storage.sync.set({ widgetSettings: settings });
      }
    }

    var colMap = {
      left: document.getElementById('col-left'),
      center: document.getElementById('col-center'),
      right: document.getElementById('col-right')
    };
    var colNames = ['left', 'center', 'right'];
    settings.forEach(function(widget) {
      var els = document.querySelectorAll('[data-widget="' + widget.id + '"]');
      var assignedIdx = colNames.indexOf(widget.column);
      var outOfRange = assignedIdx < 0 || assignedIdx >= colCount;
      var targetCol = colMap[widget.column] || colMap.left;
      els.forEach(function(el) {
        if (!widget.visible || outOfRange) {
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
	