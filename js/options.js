// ===== お気に入り設定ページ（2ペイン構成） =====

var favorites = [];

// 初期化
document.addEventListener('DOMContentLoaded', function() {
  loadFavoritesData();
  loadCalendarSettings();
  document.getElementById('add-fav-form').addEventListener('submit', handleAddFavorite);

  // お気に入りリストのイベント委譲（編集・削除ボタン）
  document.getElementById('favorites-list').addEventListener('click', function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    // カテゴリ（セクション）操作
    var cat = btn.getAttribute('data-category');
    if (cat) {
      if (btn.classList.contains('btn-cat-edit')) {
        renameCategory(cat);
      } else if (btn.classList.contains('btn-cat-delete')) {
        deleteCategory(cat);
      }
      return;
    }
    // 個別アイテム操作
    var id = btn.getAttribute('data-id');
    if (!id) return;

    if (btn.classList.contains('btn-edit')) {
      editFavorite(id);
    } else if (btn.classList.contains('btn-delete')) {
      deleteFavorite(id);
    }
  });

  // サイドバーナビゲーション
  var sidebarItems = document.querySelectorAll('.sidebar-item');
  sidebarItems.forEach(function(item) {
    item.addEventListener('click', function() {
      var sectionId = this.getAttribute('data-section');

      sidebarItems.forEach(function(si) { si.classList.remove('active'); });
      this.classList.add('active');

      document.querySelectorAll('.settings-section').forEach(function(sec) {
        sec.classList.remove('active');
      });
      var target = document.getElementById('section-' + sectionId);
      if (target) target.classList.add('active');
    });
  });
});

// ===== データ読み込み =====
function loadFavoritesData() {
  chrome.storage.sync.get('favorites', function(data) {
    favorites = data.favorites || [];
    renderFavoritesList();
    updateCategoryDatalist();
  });
}

// ===== データ保存 =====
function saveFavoritesData(callback) {
  chrome.storage.sync.set({ favorites: favorites }, function() {
    if (callback) callback();
  });
}

// ===== お気に入り追加 =====
function handleAddFavorite(e) {
  e.preventDefault();

  var name = document.getElementById('fav-name').value.trim();
  var url = document.getElementById('fav-url').value.trim();
  var category = document.getElementById('fav-category').value.trim() || '未分類';

  if (!name || !url) return;

  if (!/^https?:\/\//.test(url)) {
    url = 'https://' + url;
  }

  favorites.push({
    id: Date.now().toString(),
    name: name,
    url: url,
    category: category
  });

  saveFavoritesData(function() {
    renderFavoritesList();
    updateCategoryDatalist();
    showStatus('「' + name + '」を追加しました');

    document.getElementById('fav-name').value = '';
    document.getElementById('fav-url').value = '';
    document.getElementById('fav-category').value = '';
    document.getElementById('fav-name').focus();
  });
}

// ===== お気に入り削除（確認ダイアログ付き） =====
function deleteFavorite(id) {
  var item = favorites.find(function(f) { return f.id === id; });
  if (!item) return;

  if (!confirm('「' + item.name + '」を削除しますか？')) return;

  favorites = favorites.filter(function(f) { return f.id !== id; });

  saveFavoritesData(function() {
    renderFavoritesList();
    updateCategoryDatalist();
    showStatus('「' + item.name + '」を削除しました');
  });
}

// ===== お気に入り編集 =====
function editFavorite(id) {
  var item = favorites.find(function(f) { return f.id === id; });
  if (!item) return;

  var newName = prompt('サイト名:', item.name);
  if (newName === null) return;
  var newUrl = prompt('URL:', item.url);
  if (newUrl === null) return;
  var newCategory = prompt('カテゴリ:', item.category);
  if (newCategory === null) return;

  item.name = newName.trim() || item.name;
  item.url = newUrl.trim() || item.url;
  item.category = newCategory.trim() || item.category;

  saveFavoritesData(function() {
    renderFavoritesList();
    updateCategoryDatalist();
    showStatus('「' + item.name + '」を更新しました');
  });
}

// ===== セクション名（カテゴリ）編集 =====
function renameCategory(oldName) {
  var newName = prompt('セクション名を変更:', oldName);
  if (newName === null || newName.trim() === '' || newName.trim() === oldName) return;
  favorites.forEach(function(f) {
    if (f.category === oldName) f.category = newName.trim();
  });
  saveFavoritesData(function() {
    renderFavoritesList();
    updateCategoryDatalist();
    showStatus('「' + oldName + '」→「' + newName.trim() + '」に変更しました');
  });
}
// ===== セクション（カテゴリ）削除 =====
function deleteCategory(catName) {
  var count = favorites.filter(function(f) { return f.category === catName; }).length;
  if (!confirm('「' + catName + '」（' + count + '件）を削除しますか？\nセクション内の全サイトが削除されます。')) return;
  favorites = favorites.filter(function(f) { return f.category !== catName; });
  saveFavoritesData(function() {
    renderFavoritesList();
    updateCategoryDatalist();
    showStatus('「' + catName + '」を削除しました');
  });
}
// ===== 一覧レンダリング =====
function renderFavoritesList() {
  var container = document.getElementById('favorites-list');
  var countEl = document.getElementById('fav-count');

  if (countEl) countEl.textContent = favorites.length + '件';

  if (favorites.length === 0) {
    container.innerHTML = '<p class="empty-msg">お気に入りがまだありません</p>';
    return;
  }

  var groups = {};
  favorites.forEach(function(fav) {
    var cat = fav.category || '未分類';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(fav);
  });

  var html = '';
  Object.keys(groups).forEach(function(category) {
    html += '<div class="fav-category-group">';
    html += '<div class="fav-category-title">';
    html += '  <span>' + escapeHtml(category) + '</span>';
    html += '  <div class="fav-cat-actions">';
    html += '    <button class="btn btn-cat-edit" data-category="' + escapeHtml(category) + '">✏️</button>';
    html += '    <button class="btn btn-cat-delete" data-category="' + escapeHtml(category) + '">🗑️</button>';
    html += '  </div>';
    html += '</div>';

    groups[category].forEach(function(fav) {
      var domain = '';
      try { domain = new URL(fav.url).hostname; } catch(e) { domain = fav.url; }
      var faviconUrl = 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=48';

      html += '<div class="fav-row">';
      html += '  <img class="fav-row-icon" src="' + faviconUrl + '" alt="">';
      html += '  <div class="fav-row-info">';
      html += '    <div class="fav-row-name">' + escapeHtml(fav.name) + '</div>';
      html += '    <div class="fav-row-url">' + escapeHtml(fav.url) + '</div>';
      html += '  </div>';
      html += '  <div class="fav-row-actions">';
      html += '    <button class="btn btn-edit" data-id="' + fav.id + '">編集</button>';
      html += '    <button class="btn btn-delete" data-id="' + fav.id + '">削除</button>';
      html += '  </div>';
      html += '</div>';
    });

    html += '</div>';
  });

  container.innerHTML = html;
}

// ===== カテゴリ候補の更新 =====
function updateCategoryDatalist() {
  var datalist = document.getElementById('category-list');
  var categories = [];
  favorites.forEach(function(fav) {
    if (fav.category && categories.indexOf(fav.category) === -1) {
      categories.push(fav.category);
    }
  });

  datalist.innerHTML = categories.map(function(cat) {
    return '<option value="' + escapeHtml(cat) + '">';
  }).join('');
}

// ===== ステータス表示 =====
function showStatus(msg) {
  var el = document.getElementById('status-msg');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function() {
    el.classList.remove('show');
  }, 2500);
}

// ===== カレンダー設定 =====
function loadCalendarSettings() {
  var saveBtn = document.getElementById('save-ical-url');
  if (saveBtn) saveBtn.addEventListener('click', saveCalendarUrl);
  var testBtn = document.getElementById('test-ical-url');
  if (testBtn) testBtn.addEventListener('click', testCalendarUrl);
  chrome.storage.sync.get('icalUrl', function(data) {
    var input = document.getElementById('ical-url');
    if (input && data.icalUrl) {
      input.value = data.icalUrl;
    }
  });
}
function saveCalendarUrl() {
  var url = document.getElementById('ical-url').value.trim();
  chrome.storage.sync.set({ icalUrl: url }, function() {
    showStatus(url ? 'iCal URLを保存しました' : 'iCal URLをクリアしました');
  });
}
function testCalendarUrl() {
  var url = document.getElementById('ical-url').value.trim();
  var statusEl = document.getElementById('ical-status');
  if (!url) {
    statusEl.textContent = '❌ URLを入力してください';
    statusEl.className = 'ical-status error';
    return;
  }
  statusEl.textContent = '⏳ 取得中...';
  statusEl.className = 'ical-status';
  fetch(url)
    .then(function(res) { return res.text(); })
    .then(function(text) {
      var count = (text.match(/BEGIN:VEVENT/g) || []).length;
      if (count > 0) {
        statusEl.textContent = '✅ 成功！ ' + count + '件のイベントを検出';
        statusEl.className = 'ical-status success';
      } else {
        statusEl.textContent = '⚠️ 取得できましたがイベントが見つかりません';
        statusEl.className = 'ical-status warning';
      }
    })
    .catch(function(err) {
      statusEl.textContent = '❌ 取得失敗: ' + err.message;
      statusEl.className = 'ical-status error';
    });
}
// ===== HTML エスケープ =====
function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}