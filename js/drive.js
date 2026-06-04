var driveCurrentTab = 'recent';

function launchDriveOAuth(loginHint, interactive) {
  return new Promise(function(resolve, reject) {
    var authUrl = 'https://accounts.google.com/o/oauth2/auth?' +
      'client_id=' + encodeURIComponent(DRIVE_CLIENT_ID) +
      '&redirect_uri=' + encodeURIComponent(DRIVE_REDIRECT) +
      '&response_type=token' +
      '&scope=' + encodeURIComponent(DRIVE_SCOPES) +
      (loginHint ? '&login_hint=' + encodeURIComponent(loginHint) : '');
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: !!interactive },
      function(redirectUrl) {
        if (chrome.runtime.lastError || !redirectUrl) {
          reject(new Error(chrome.runtime.lastError?.message || 'OAuth failed'));
          return;
        }
        var params = new URLSearchParams(new URL(redirectUrl).hash.slice(1));
        var token = params.get('access_token');
        var expiresIn = parseInt(params.get('expires_in') || '3600');
        if (!token) { reject(new Error('No token')); return; }
        resolve({ token: token, expiresAt: Date.now() + expiresIn * 1000 });
      }
    );
  });
}

async function getValidDriveToken(account) {
  const now = Date.now();
  if (account.token && account.expiresAt && now < account.expiresAt - 120000) {
    return account.token;
  }
  try {
    const result = await launchDriveOAuth(account.email, false);
    const accounts = await new Promise(function(res) {
      chrome.storage.sync.get('driveAccounts', function(d) { res(d.driveAccounts || []); });
    });
    const idx = accounts.findIndex(function(a) { return a.email === account.email; });
    if (idx !== -1) {
      accounts[idx].token = result.token;
      accounts[idx].expiresAt = result.expiresAt;
      chrome.storage.sync.set({ driveAccounts: accounts });
    }
    return result.token;
  } catch(e) {
    console.warn('Drive silent refresh failed for', account.email);
    return account.token;
  }
}

function loadDriveWidget() {
  chrome.storage.sync.get(['driveAccounts', 'driveDefaultTab'], function(data) {
    driveCurrentTab = data.driveDefaultTab || 'recent';
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

async function fetchDriveFiles(account) {
  var listEl = document.getElementById('drive-list');
  if (!listEl) return;
  listEl.innerHTML = '<p class="loading">読み込み中...</p>';

  var token;
  try {
    token = await getValidDriveToken(account);
  } catch(e) {
    if (listEl) listEl.innerHTML = '<p class="drive-error">トークン取得に失敗しました</p>';
    return;
  }

  var isStarred = driveCurrentTab === 'starred';
  var params = new URLSearchParams({
    pageSize: '20',
    fields: 'files(id,name,mimeType,webViewLink,modifiedTime)',
    orderBy: isStarred ? 'modifiedTime desc' : 'viewedByMeTime desc'
  });
  if (isStarred) params.set('q', 'starred=true and trashed=false');
  else params.set('q', 'trashed=false');

  try {
    var res = await fetch('https://www.googleapis.com/drive/v3/files?' + params.toString(), {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    var data = await res.json();
    if (!res.ok) {
      var apiMsg = (data && data.error && data.error.message) ? data.error.message : ('HTTP ' + res.status);
      console.error('Drive API error:', res.status, data);
      if (res.status === 401) {
        listEl.innerHTML = '<p class="drive-error">認証が切れました。設定から再ログインしてください。</p>';
      } else if (res.status === 403) {
        listEl.innerHTML = '<p class="drive-error">アクセスが拒否されました。<br>Drive APIの有効化、またはOAuthスコープの承認を確認してください。<br><span style="font-size:10px;opacity:0.7">' + escapeHtml(apiMsg) + '</span></p>';
      } else {
        listEl.innerHTML = '<p class="drive-error">取得に失敗しました（' + escapeHtml(apiMsg) + '）</p>';
      }
      return;
    }
    var files = data.files || [];
    if (files.length === 0) {
      listEl.innerHTML = '<p class="drive-empty">ファイルがありません</p>';
      return;
    }
    listEl.innerHTML = files.map(function(f) {
      return '<a class="drive-file" href="' + escapeAttr(f.webViewLink) + '" target="_blank" rel="noopener">' +
        '<span class="drive-file-icon">' + driveIcon(f.mimeType, f.name) + '</span>' +
        '<span class="drive-file-info">' +
          '<span class="drive-file-name" title="' + escapeAttr(f.name) + '">' + escapeHtml(f.name) + '</span>' +
          (f.modifiedTime ? '<span class="drive-file-date">' + formatDriveDate(f.modifiedTime) + '</span>' : '') +
        '</span>' +
        '</a>';
    }).join('');
  } catch(e) {
    console.error('Drive fetch exception:', e);
    if (listEl) listEl.innerHTML = '<p class="drive-error">取得に失敗しました（' + escapeHtml(e.message || e) + '）</p>';
  }
}

function formatDriveDate(iso) {
  var d = new Date(iso);
  var now = new Date();
  var diff = Math.floor((now - d) / 1000);
  if (diff < 60)          return 'たった今';
  if (diff < 3600)        return Math.floor(diff / 60) + '分前';
  if (diff < 86400)       return Math.floor(diff / 3600) + '時間前';
  if (diff < 86400 * 2)   return '昨日';
  if (diff < 86400 * 7)   return Math.floor(diff / 86400) + '日前';
  if (diff < 86400 * 30)  return Math.floor(diff / (86400 * 7)) + '週間前';
  if (diff < 86400 * 365) return Math.floor(diff / (86400 * 30)) + 'ヶ月前';
  return Math.floor(diff / (86400 * 365)) + '年前';
}

function driveIcon(mime, name) {
  mime = mime || '';
  var b = driveIconBadge(mime, name);
  if (b.emoji) return b.emoji;
  var style = 'background:' + b.color + (b.textColor ? ';color:' + b.textColor : '');
  return '<span class="dv-icon" style="' + style + '">' + b.label + '</span>';
}

function driveIconBadge(mime, name) {
  // フォルダ
  if (mime === 'application/vnd.google-apps.folder') return { emoji: '📁' };

  // Google Workspace（拡張子なしのため略称を維持）
  var gMap = {
    'application/vnd.google-apps.document':     { color: '#4285f4', label: 'Doc'  },
    'application/vnd.google-apps.spreadsheet':  { color: '#0f9d58', label: 'Sheet' },
    'application/vnd.google-apps.presentation': { color: '#f9ab00', label: 'Slide' },
    'application/vnd.google-apps.form':         { color: '#7248b9', label: 'Form' },
    'application/vnd.google-apps.drawing':      { color: '#00acc1', label: 'Draw' },
    'application/vnd.google-apps.script':       { color: '#4285f4', label: 'GAS'  },
    'application/vnd.google-apps.site':         { color: '#1a73e8', label: 'Site' },
    'application/vnd.google-apps.shortcut':     { color: '#5f6368', label: '↗'   },
    'application/vnd.google-apps.jam':          { color: '#ff5722', label: 'Jam'  },
  };
  if (gMap[mime]) return gMap[mime];

  // 拡張子を取得してラベルに使用
  var ext = name ? (name.split('.').pop() || '').toLowerCase() : '';
  var label = ext.toUpperCase() || '—';

  // 拡張子→カラーのマップ
  var colorMap = {
    // ドキュメント
    doc: '#2b579a', docx: '#2b579a', odt: '#2b579a', rtf: '#2b579a', pages: '#2b579a',
    txt: '#78909c', md: '#78909c',
    // スプレッドシート
    xls: '#217346', xlsx: '#217346', ods: '#217346', numbers: '#217346',
    csv: '#43a047',
    // プレゼン
    ppt: '#b7472a', pptx: '#b7472a', odp: '#b7472a', key: '#b7472a',
    // PDF
    pdf: '#db4437',
    // 画像
    jpg: '#00897b', jpeg: '#00897b', png: '#00897b', gif: '#00897b',
    webp: '#00897b', heic: '#00897b', heif: '#00897b', bmp: '#00897b', tiff: '#00897b',
    svg: '#00acc1', psd: '#2196f3', ai: '#ff9800', fig: '#9c27b0',
    // 動画
    mp4: '#e53935', mov: '#e53935', avi: '#e53935', mkv: '#e53935', webm: '#e53935',
    // 音声
    mp3: '#8e24aa', wav: '#8e24aa', aac: '#8e24aa', flac: '#8e24aa', m4a: '#8e24aa',
    // アーカイブ
    zip: '#f57c00', rar: '#f57c00', tar: '#f57c00', gz: '#f57c00', '7z': '#f57c00', bz2: '#f57c00',
    // コード
    js:    '#f0db4f', jsx: '#61dafb',
    ts:    '#3178c6', tsx: '#3178c6',
    py:    '#3776ab', rb:  '#cc342d',
    java:  '#b07219', kt:  '#7f52ff',
    swift: '#f05138', go:  '#00acd7',
    rs:    '#b7410e', cpp: '#f34b7d',
    c:     '#555555', cs:  '#239120',
    php:   '#777bb4', sh:  '#546e7a',
    sql:   '#e38c00',
    html:  '#e65100', htm: '#e65100',
    css:   '#1976d2', scss: '#c6538c', sass: '#c6538c',
    json:  '#546e7a', yaml: '#cb171e', yml: '#cb171e',
    xml:   '#ff6600', env: '#4caf50',
  };

  var textColor;
  if (ext === 'js' || ext === 'jsx') textColor = '#333';

  if (colorMap[ext]) return { color: colorMap[ext], label: label, textColor: textColor };

  // MIMEタイプ系統フォールバック（拡張子不明時）
  if (mime === 'application/pdf') return { color: '#db4437', label: 'PDF' };
  if (mime.startsWith('image/')) return { color: '#00897b', label: label || 'IMG' };
  if (mime.startsWith('video/')) return { color: '#e53935', label: label || 'VID' };
  if (mime.startsWith('audio/')) return { color: '#8e24aa', label: label || 'AUD' };
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gzip'))
    return { color: '#f57c00', label: label || 'ZIP' };
  if (mime.includes('officedocument.wordprocessing') || mime.includes('msword'))
    return { color: '#2b579a', label: label || 'Doc' };
  if (mime.includes('officedocument.spreadsheet') || mime.includes('excel'))
    return { color: '#217346', label: label || 'Sht' };
  if (mime.includes('officedocument.presentation') || mime.includes('powerpoint'))
    return { color: '#b7472a', label: label || 'PPT' };
  if (mime.startsWith('text/') || mime.includes('javascript') || mime.includes('json'))
    return { color: '#546e7a', label: label || 'TXT' };

  return { color: '#9e9e9e', label: label || '—' };
}

