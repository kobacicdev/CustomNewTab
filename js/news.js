// js/news.js — Google News RSS → ニュース表示
// v1.2: ソース切り替え + RSS XML直接パース（DOMParser）+ カード内スクロール

var NEWS_TOPICS = {
  'google-general':       'https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja',
  'google-tech':          'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtcGhHZ0pLVUNnQVAB?hl=ja&gl=JP&ceid=JP:ja',
  'google-business':      'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtcGhHZ0pLVUNnQVAB?hl=ja&gl=JP&ceid=JP:ja',
  'google-sports':        'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtcGhHZ0pLVUNnQVAB?hl=ja&gl=JP&ceid=JP:ja',
  'google-entertainment': 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtcGhHZ0pLVUNnQVAB?hl=ja&gl=JP&ceid=JP:ja',
  'google-science':       'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtcGhHZ0pLVUNnQVAB?hl=ja&gl=JP&ceid=JP:ja',
  'google-health':        'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtcGhLQUFQAQ?hl=ja&gl=JP&ceid=JP:ja'
};

async function loadNews() {
  var container = document.getElementById('news-container');

  try {
    var settings = await new Promise(function(resolve) {
      chrome.storage.sync.get(['newsSource', 'customRssUrl'], resolve);
    });

    var source = settings.newsSource || 'google-general';
    var rssUrl;

    if (source === 'custom' && settings.customRssUrl) {
      rssUrl = settings.customRssUrl;
    } else {
      rssUrl = NEWS_TOPICS[source] || NEWS_TOPICS['google-general'];
    }

    // C案: RSS XMLを直接fetch → DOMParserでパース（rss2json API廃止）
    var res = await fetch(rssUrl);
    var text = await res.text();
    var xml = new DOMParser().parseFromString(text, 'application/xml');
    var items = xml.querySelectorAll('item');

    if (!items || items.length === 0) {
      throw new Error('No items found in RSS');
    }

    var html = '';
    items.forEach(function(item) {
      var title = getTagText(item, 'title');
      var link = getTagText(item, 'link');
      var pubDate = getTagText(item, 'pubDate');

      // <source url="https://real-domain.com">ソース名</source>
      var sourceEl = item.getElementsByTagName('source')[0];
      var sourceUrl = sourceEl ? sourceEl.getAttribute('url') || '' : '';
      var sourceName = sourceEl ? sourceEl.textContent.trim() : '';

      // 記事元ドメイン: sourceUrl → link のフォールバック
      var sourceDomain = '';
      try { sourceDomain = new URL(sourceUrl || link).hostname; } catch(e) {}

      // サムネイル: media:content → enclosure
      var thumbUrl = '';
      var mediaContent = item.getElementsByTagName('media:content');
      if (mediaContent && mediaContent.length > 0) {
        thumbUrl = mediaContent[0].getAttribute('url') || '';
      }
      if (!thumbUrl) {
        var enclosure = item.getElementsByTagName('enclosure');
        if (enclosure && enclosure.length > 0) {
          thumbUrl = enclosure[0].getAttribute('url') || '';
        }
      }

      // favicon: 記事元ドメインから取得（Googleニュースではなく実際の配信元）
      var faviconUrl = sourceDomain
        ? 'https://www.google.com/s2/favicons?sz=128&domain=' + encodeURIComponent(sourceDomain)
        : '';
      var imgSrc = thumbUrl || faviconUrl;
      var thumbHtml = imgSrc
        ? '<img class="news-thumb" src="' + escapeNewsAttr(imgSrc) + '" alt=""' +
          (thumbUrl && faviconUrl ? ' data-fallback="' + escapeNewsAttr(faviconUrl) + '"' : '') +
          ' onerror="handleThumbError(this)">'
        : '';

      var dateStr = '';
      try { dateStr = new Date(pubDate).toLocaleDateString('ja-JP'); } catch(e) {}

      html += '<div class="news-item">' +
        thumbHtml +
        '<div class="news-item-content">' +
        '<a href="' + escapeNewsAttr(link) + '" target="_blank" rel="noopener">' + escapeNewsHtml(title) + '</a>' +
        '<div class="news-source">' + escapeNewsHtml(sourceName) + (dateStr ? ' · ' + dateStr : '') + '</div>' +
        '</div></div>';
    });

    container.innerHTML = html;

  } catch (err) {
    container.innerHTML = '<p class="loading">ニュースを取得できませんでした</p>';
    console.error('News Error:', err);
  }
}

function getTagText(item, tagName) {
  var el = item.getElementsByTagName(tagName);
  if (!el || el.length === 0) return '';
  return el[0].textContent.trim();
}

function escapeNewsAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function escapeNewsHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function handleThumbError(img) {
  var fallback = img.getAttribute('data-fallback');
  if (fallback && img.src !== fallback) {
    img.src = fallback;
  } else {
    img.style.display = 'none';
  }
}