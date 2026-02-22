// ===== お気に入りサイト表示（New Tab側） =====
// データ形式：フラット配列 [{id, name, url, category}, ...]

var DEFAULT_FAVORITES = [
  { id: '1', name: 'Notion', url: 'https://notion.so', category: '仕事' },
  { id: '2', name: 'Slack', url: 'https://slack.com', category: '仕事' },
  { id: '3', name: 'Gmail', url: 'https://mail.google.com', category: '仕事' },
  { id: '4', name: 'YouTube', url: 'https://youtube.com', category: 'よく使う' },
  { id: '5', name: 'GitHub', url: 'https://github.com', category: 'よく使う' },
  { id: '6', name: 'ChatGPT', url: 'https://chat.openai.com', category: 'よく使う' },
  { id: '7', name: 'Zenn', url: 'https://zenn.dev', category: 'ニュース・情報' },
  { id: '8', name: 'Qiita', url: 'https://qiita.com', category: 'ニュース・情報' }
];

async function loadFavorites() {
  var container = document.getElementById('favorites-container');

  var items = await new Promise(function(resolve) {
    chrome.storage.sync.get('favorites', function(result) {
      resolve(result.favorites || DEFAULT_FAVORITES);
    });
  });

  if (!Array.isArray(items) || items.length === 0) {
    container.innerHTML = '<p style="color:#888;">お気に入りがありません。設定から追加してください。</p>';
    return;
  }

  // カテゴリ別にグルーピング
  var groups = {};
  items.forEach(function(fav) {
    var cat = fav.category || '未分類';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(fav);
  });

  var html = '';
  Object.keys(groups).forEach(function(category) {
    html += '<div class="fav-section">';
    if (category !== '未分類') {
      html += '<h3>' + escapeHtml(category) + '</h3>';
    }
    html += '<div class="fav-grid">';

    groups[category].forEach(function(site) {
      var iconUrl = getFaviconUrl(site.url);
      html += '<a href="' + escapeHtml(site.url) + '" class="fav-item">' +
        '<img src="' + escapeHtml(iconUrl) + '" alt="' + escapeHtml(site.name) + '" ' +
        'onerror="this.style.display=\'none\'">' +
        '<span>' + escapeHtml(site.name || getDomainName(site.url)) + '</span>' +
        '</a>';
    });

    html += '</div></div>';
  });

  container.innerHTML = html;
}

// ===== ユーティリティ =====
function getFaviconUrl(url) {
  try {
    var domain = new URL(url).hostname;
    return 'https://www.google.com/s2/favicons?sz=64&domain=' + domain;
  } catch(e) {
    return '';
  }
}

function getDomainName(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch(e) {
    return url;
  }
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}