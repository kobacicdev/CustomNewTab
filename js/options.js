// ===== お気に入り設定ページ（2ペイン構成） =====
// v1.2: インライン編集 + ドロップダウンセクション変更 + カスタム削除モーダル

var favorites = [];
var pendingDeleteAction = null;

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', function() {
  loadFavoritesData();
  loadCalendarSettings();
  document.getElementById('add-fav-form').addEventListener('submit', handleAddFavorite);

  // お気に入りリストのイベント委譲
  document.getElementById('favorites-list').addEventListener('click', function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;

    // カテゴリ（セクション）操作
    var cat = btn.getAttribute('data-category');
    if (cat) {
      if (btn.classList.contains('btn-cat-edit')) {
        startInlineCategoryEdit(cat);
      } else if (btn.classList.contains('btn-cat-delete')) {
        var count = favorites.filter(function(f) { return f.category === cat; }).length;
        showDeleteModal(
          '「' + cat + '」セクション（' + count + '件）を削除しますか？\nセクション内の全サイトも削除されます。',
          function() { deleteCategory(cat); }
        );
      }
      return;
    }

    // 個別サイト操作
    var id = btn.getAttribute('data-id');
    if (!id) return;

    if (btn.classList.contains('btn-edit')) {
      startInlineEdit(id);
    } else if (btn.classList.contains('btn-delete')) {
      var item = favorites.find(function(f) { return f.id === id; });
      if (item) {
        showDeleteModal(
          '「' + item.name + '」を削除しますか？',
          function() { deleteFavorite(id); }
        );
      }
    } else if (btn.classList.contains('btn-inline-save')) {
      saveInlineEdit(id);
    } else if (btn.classList.contains('btn-inline-cancel')) {
      renderFavoritesList();
    }
  });

  // モーダルイベント
  document.getElementById('modal-cancel').addEventListener('click', hideDeleteModal);
  document.getElementById('modal-confirm').addEventListener('click', function() {
    if (pendingDeleteAction) {
      pendingDeleteAction();
      pendingDeleteAction = null;
    }
    hideDeleteModal();
  });
  document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) hideDeleteModal();
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
  if (!/^https?:\/\//.test(url)) url = 'https://' + url;

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

// ===== お気に入り削除（モーダル経由で呼ばれる） =====
function deleteFavorite(id) {
  var item = favorites.find(function(f) { return f.id === id; });
  favorites = favorites.filter(function(f) { return f.id !== id; });
  saveFavoritesData(function() {
    renderFavoritesList();
    updateCategoryDatalist();
    if (item) showStatus('「' + item.name + '」を削除しました');
  });
}

// ===== インライン編集開始（サイト） =====
function startInlineEdit(id) {
  var item = favorites.find(function(f) { return f.id === id; });
  if (!item) return;
  var row = document.querySelector('.fav-row[data-row-id="' + id + '"]');
  if (!row) return;

  var categories = getCategories();
  var catOptions = categories.map(function(c) {
    var selected = c === item.category ? ' selected' : '';
    return '<option value="' + escapeHtml(c) + '"' + selected + '>' + escapeHtml(c) + '</option>';
  }).join('');

  row.innerHTML =
    '<div class="inline-edit-form">' +
    '  <div class="inline-edit-row">' +
    '    <label>サイト名</label>' +
    '    <input type="text" class="inline-input" id="inline-name-' + id + '" value="' + escapeHtml(item.name) + '">' +
    '  </div>' +
    '  <div class="inline-edit-row">' +
    '    <label>URL</label>' +
    '    <input type="url" class="inline-input" id="inline-url-' + id + '" value="' + escapeHtml(item.url) + '">' +
    '  </div>' +
    '  <div class="inline-edit-row">' +
    '    <label>セクション</label>' +
    '    <select class="inline-select" id="inline-cat-' + id + '">' + catOptions + '</select>' +
    '  </div>' +
    '  <div class="inline-edit-actions">' +
    '    <button class="btn btn-inline-save" data-id="' + id + '">保存</button>' +
    '    <button class="btn btn-inline-cancel" data-id="' + id + '">キャンセル</button>' +
    '  </div>' +
    '</div>';

  row.classList.add('editing');
  document.getElementById('inline-name-' + id).focus();
}

// ===== インライン編集保存 =====
function saveInlineEdit(id) {
  var item = favorites.find(function(f) { return f.id === id; });
  if (!item) return;

  var nameEl = document.getElementById('inline-name-' + id);
  var urlEl = document.getElementById('inline-url-' + id);
  var catEl = document.getElementById('inline-cat-' + id);
  if (!nameEl || !urlEl || !catEl) return;

  var newName = nameEl.value.trim();
  var newUrl = urlEl.value.trim();
  var newCat = catEl.value;

  if (newName) item.name = newName;
  if (newUrl) item.url = newUrl;
  if (newCat) item.category = newCat;

  saveFavoritesData(function() {
    renderFavoritesList();
    updateCategoryDatalist();
    showStatus('「' + item.name + '」を更新しました');
  });
}

// ===== セクション名インライン編集 =====
function startInlineCategoryEdit(oldName) {
  var titleEl = document.querySelector('.fav-category-title[data-cat="' + oldName + '"]');
  if (!titleEl) return;
  var spanEl = titleEl.querySelector('span');
  var actionsEl = titleEl.querySelector('.fav-cat-actions');

  spanEl.style.display = 'none';
  if (actionsEl) actionsEl.style.display = 'none';

  var input = document.createElement('input');
  input.type = 'text';
  input.value = oldName;
  input.className = 'inline-cat-input';

  var saveBtn = document.createElement('button');
  saveBtn.textContent = '✓';
  saveBtn.className = 'btn btn-inline-cat-save';

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = '✕';
  cancelBtn.className = 'btn btn-inline-cat-cancel';

  titleEl.insertBefore(input, spanEl);
  titleEl.appendChild(saveBtn);
  titleEl.appendChild(cancelBtn);
  input.focus();
  input.select();

  function save() {
    var newName = input.value.trim();
    if (newName && newName !== oldName) {
      favorites.forEach(function(f) {
        if (f.category === oldName) f.category = newName;
      });
      saveFavoritesData(function() {
        renderFavoritesList();
        updateCategoryDatalist();
        showStatus('「' + oldName + '」→「' + newName + '」に変更しました');
      });
    } else {
      renderFavoritesList();
    }
  }
  function cancel() { renderFavoritesList(); }

  saveBtn.addEventListener('click', save);
  cancelBtn.addEventListener('click', cancel);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') cancel();
  });
}

// ===== セクション削除（モーダル経由で呼ばれる） =====
function deleteCategory(catName) {
  favorites = favorites.filter(function(f) { return f.category !== catName; });
  saveFavoritesData(function() {
    renderFavoritesList();
    updateCategoryDatalist();
    showStatus('「' + catName + '」を削除しました');
  });
}

// ===== カスタム削除モーダル =====
function showDeleteModal(message, onConfirm) {
  pendingDeleteAction = onConfirm;
  document.getElementById('modal-message').textContent = message;
  document.getElementById('modal-overlay').classList.add('show');
}

function hideDeleteModal() {
  pendingDeleteAction = null;
  document.getElementById('modal-overlay').classList.remove('show');
}

// ===== カテゴリ一覧取得 =====
function getCategories() {
  var cats = [];
  favorites.forEach(function(f) {
    if (f.category && cats.indexOf(f.category) === -1) {
      cats.push(f.category);
    }
  });
  return cats;
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
    html += '<div class="fav-category-title" data-cat="' + escapeHtml(category) + '">';
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

      html += '<div class="fav-row" data-row-id="' + fav.id + '">';
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
  var categories = getCategories();
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
    if (input && data.icalUrl) input.value = data.icalUrl;
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