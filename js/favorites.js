// ===== お気に入りサイト表示（New Tab側） =====
// データ形式：フラット配列 [{id, name, url, category}, ...]

async function loadFavorites() {
  var container = document.getElementById('favorites-container');

  var items = await new Promise(function(resolve) {
    chrome.storage.sync.get('favorites', function(result) {
      resolve(result.favorites || []);
    });
  });

  if (!Array.isArray(items) || items.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">設定画面からお気に入りサイトを追加してください。</p>';
    return;
  }

  var collapsedSections = JSON.parse(localStorage.getItem('favCollapsed') || '{}');

  // カテゴリ別にグルーピング
  var groups = {};
  items.forEach(function(fav) {
    var cat = fav.category || '未分類';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(fav);
  });

  var html = '';
  Object.keys(groups).forEach(function(category) {
    var isCollapsed = collapsedSections[category] === true;
    html += '<div class="fav-section">';
    if (category !== '未分類') {
      html += '<div class="fav-section-header' + (isCollapsed ? ' collapsed' : '') + '" data-category="' + escapeAttr(category) + '">' +
        '<span class="fav-section-toggle">▾</span>' +
        '<span class="fav-section-label">' + escapeHtml(category) + '</span>' +
        '</div>';
    }
    html += '<div class="fav-grid' + (isCollapsed ? ' fav-grid--hidden' : '') + '">';

    groups[category].forEach(function(site) {
      var iconUrl = getFaviconUrl(site.url);
      html += '<a href="' + escapeAttr(site.url) + '" class="fav-item">' +
        '<img src="' + escapeAttr(iconUrl) + '" alt="' + escapeAttr(site.name) + '" ' +
        'onerror="this.style.display=\'none\'">' +
        '<span>' + escapeHtml(site.name || getDomainName(site.url)) + '</span>' +
        '</a>';
    });

    html += '</div></div>';
  });

  container.innerHTML = html;

  container.querySelectorAll('.fav-section-header').forEach(function(header) {
    header.addEventListener('click', function() {
      var cat = this.getAttribute('data-category');
      var isNowCollapsed = this.classList.toggle('collapsed');
      this.nextElementSibling.classList.toggle('fav-grid--hidden', isNowCollapsed);
      var state = JSON.parse(localStorage.getItem('favCollapsed') || '{}');
      if (isNowCollapsed) state[cat] = true;
      else delete state[cat];
      localStorage.setItem('favCollapsed', JSON.stringify(state));
    });
  });
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
