// Google News RSS → おすすめニュース表示
// 注意: Google Newsの「おすすめ」タブはログイン認証が必要なパーソナライズドフィード。
// RSSでは日本向けトップニュース（最も近い代替）を取得します。
async function loadNews() {
  var container = document.getElementById('news-container');

  try {
    var rssUrl = encodeURIComponent('https://news.google.com/rss?hl=ja&gl=JP&ceid=JP:ja');
    var apiUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + rssUrl;

    var res = await fetch(apiUrl);
    var data = await res.json();

    if (data.status !== 'ok' || !data.items) {
      throw new Error('RSS fetch failed');
    }

    var articles = data.items.slice(0, 10);

    container.innerHTML = articles.map(function(item) {
      return '<div class="news-item">' +
        '<a href="' + item.link + '" target="_blank" rel="noopener">' + item.title + '</a>' +
        '<div class="news-source">' + (item.author || '') + ' · ' +
        new Date(item.pubDate).toLocaleDateString('ja-JP') + '</div>' +
        '</div>';
    }).join('');

  } catch (err) {
    container.innerHTML = '<p class="loading">ニュースを取得できませんでした</p>';
    console.error('News Error:', err);
  }
}