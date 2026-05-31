var driveCurrentTab = 'recent';

function loadDriveWidget() {
  chrome.storage.sync.get('driveAccounts', function(data) {
    renderDriveWidget(data.driveAccounts || []);
  });
}

function renderDriveWidget(accounts) {
  var container = document.getElementById('drive-container');
  if (!container) return;
  if (accounts.length === 0) {
    container.innerHTML = '<p class="drive-hint">設定からGoogleアカウントでログインすると<br>Driveファイルを表示できます</p>';
    return;
  }
  var account = accounts[0];
  container.innerHTML =
    '<div class="drive-tabs">' +
      '<button class="drive-tab' + (driveCurrentTab === 'recent' ? ' active' : '') + '" data-tab="recent">最近</button>' +
      '<button class="drive-tab' + (driveCurrentTab === 'starred' ? ' active' : '') + '" data-tab="starred">★ スター付き</button>' +
    '</div>' +
    '<div class="drive-list" id="drive-list"><p class="loading">読み込み中...</p></div>';
  container.querySelectorAll('.drive-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      driveCurrentTab = this.getAttribute('data-tab');
      container.querySelectorAll('.drive-tab').forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      fetchDriveFiles(account);
    });
  });
  fetchDriveFiles(account);
}

function fetchDriveFiles(account) {
  var listEl = document.getElementById('drive-list');
  if (!listEl) return;
  listEl.innerHTML = '<p class="loading">読み込み中...</p>';
  var isStarred = driveCurrentTab === 'starred';
  var params = new URLSearchParams({
    pageSize: '15',
    fields: 'files(id,name,mimeType,webViewLink)',
    orderBy: isStarred ? 'modifiedTime desc' : 'viewedByMeTime desc'
  });
  if (isStarred) params.set('q', 'starred=true and trashed=false');
  else params.set('q', 'trashed=false');
  fetch('https://www.googleapis.com/drive/v3/files?' + params.toString(), {
    headers: { 'Authorization': 'Bearer ' + account.token }
  }).then(function(res) {
    if (res.status === 401) {
      if (listEl) listEl.innerHTML = '<p class="drive-error">認証が切れました。設定から再ログインしてください。</p>';
      return null;
    }
    return res.json();
  }).then(function(data) {
    if (!data) return;
    var files = data.files || [];
    if (files.length === 0) {
      listEl.innerHTML = '<p class="drive-empty">ファイルがありません</p>';
      return;
    }
    listEl.innerHTML = files.map(function(f) {
      return '<a class="drive-file" href="' + driveEscAttr(f.webViewLink) + '" target="_blank" rel="noopener">' +
        '<span class="drive-file-icon">' + driveIcon(f.mimeType) + '</span>' +
        '<span class="drive-file-name" title="' + driveEscAttr(f.name) + '">' + driveEscHtml(f.name) + '</span>' +
        '</a>';
    }).join('');
  }).catch(function() {
    if (listEl) listEl.innerHTML = '<p class="drive-error">取得に失敗しました</p>';
  });
}

function driveIcon(mime) {
  if (!mime) return '📄';
  var map = {
    'application/vnd.google-apps.document':     '📝',
    'application/vnd.google-apps.spreadsheet':  '📊',
    'application/vnd.google-apps.presentation': '📑',
    'application/vnd.google-apps.form':         '📋',
    'application/vnd.google-apps.folder':       '📁',
    'application/pdf':                          '📕'
  };
  if (map[mime]) return map[mime];
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.startsWith('video/')) return '🎬';
  if (mime.startsWith('audio/')) return '🎵';
  return '📄';
}

function driveEscHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function driveEscAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
}
