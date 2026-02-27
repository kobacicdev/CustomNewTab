// js/news.js — Google News RSS → ニュース表示
// v1.2: ソース切り替え（Googleトピック7種 + カスタムRSS）+ カード内スクロール対応

// Googleニュース トピックURL定義
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
    // ソース設定を取得
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

    var apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(rssUrl);
    var res = await fetch(apiUrl);
    var data = await res.json();

    if (data.status !== 'ok' || !data.items) {
      throw new Error('RSS fetch failed');
    }

    // v1.2: 件数制限を撤廃（カード内スクロールで全件表示）
    var articles = data.items;

    container.innerHTML = articles.map(function(item) {
      return '<div class="news-item">' +
        '<a href="' + escapeNewsAttr(item.link) + '" target="_blank" rel="noopener">' + escapeNewsHtml(item.title) + '</a>' +
        '<div class="news-source">' + escapeNewsHtml(item.author || '') + ' · ' +
        new Date(item.pubDate).toLocaleDateString('ja-JP') + '</div>' +
        '</div>';
    }).join('');

  } catch (err) {
    container.innerHTML = '<p class="loading">ニュースを取得できませんでした</p>';
    console.error('News Error:', err);
  }
}

function escapeNewsAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function escapeNewsHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}