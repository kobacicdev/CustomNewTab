document.getElementById('google-search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const query = document.getElementById('google-search').value.trim();
  if (query) {
    window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }
});

document.getElementById('perplexity-search-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const query = document.getElementById('perplexity-search').value.trim();
  if (query) {
    window.location.href = `https://www.perplexity.ai/search?q=${encodeURIComponent(query)}`;
  }
});