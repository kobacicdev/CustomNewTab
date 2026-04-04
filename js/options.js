document.addEventListener('DOMContentLoaded', function() {
  var sidebarItems = document.querySelectorAll('.sidebar-item');
  var sections = document.querySelectorAll('.settings-section');
  sidebarItems.forEach(function(item) {
    item.addEventListener('click', function() {
      sidebarItems.forEach(function(i){i.classList.remove('active');});
      sections.forEach(function(s){s.classList.remove('active');});
      this.classList.add('active');
      document.getElementById('section-'+this.getAttribute('data-section')).classList.add('active');
    });
  });
  loadFavorites();
  initCalendarSection(); // v1.3: OAuth + iCalハイブリッド管理
  loadNewsSource();
  loadThemeSettings();
  loadWidgetSettings(); // v1.3: レイアウト設定読み込み
  initEventAddToggle();
  initExportImport();
  document.getElementById('add-fav-form').addEventListener('submit', handleAddFavorite);
  document.getElementById('save-news-source').addEventListener('click', saveNewsSource);
  document.getElementById('news-source').addEventListener('change', function() {
    document.getElementById('custom-rss-group').style.display = this.value==='custom'?'':'none';
  });
setupResizeHandles();
  document.addEventListener('keydown', function(e) {
    if(e.key==='Escape') { var o=document.getElementById('modal-overlay'); if(o.classList.contains('show'))o.classList.remove('show'); }
  });
});
// ===== ユーティリティ =====
function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function showStatus(msg){var el=document.getElementById('status-msg');el.textContent=msg;el.classList.add('show');setTimeout(function(){el.classList.remove('show');},2000);}
function showModal(message,onConfirm,confirmLabel){
  var overlay=document.getElementById('modal-overlay');
  document.getElementById('modal-message').textContent=message;
  var conf=document.getElementById('modal-confirm');
  conf.textContent=confirmLabel||'🗑️';
  overlay.classList.add('show');
  var canc=document.getElementById('modal-cancel');
  var cleanup=function(){overlay.classList.remove('show');conf.replaceWith(conf.cloneNode(true));canc.replaceWith(canc.cloneNode(true));};
  document.getElementById('modal-confirm').addEventListener('click',function(){cleanup();onConfirm();});
  document.getElementById('modal-cancel').addEventListener('click',cleanup);
}
// ===== お気に入り =====
var favorites=[];
var storedSections=[];
function loadFavorites(){chrome.storage.sync.get(['favorites','storedSections'],function(data){favorites=data.favorites||[];storedSections=data.storedSections||[];renderFavoritesList();updateCategorySelect();});}
function saveFavorites(cb){var allCats=storedSections.slice();favorites.forEach(function(f){var c=f.category||'メイン';if(allCats.indexOf(c)===-1)allCats.push(c);});storedSections=allCats;chrome.storage.sync.set({favorites:favorites,storedSections:storedSections},function(){renderFavoritesList();updateCategorySelect();if(cb)cb();});}
function updateCategorySelect(){
  var sel=document.getElementById('fav-category');
  var cats=storedSections.slice();
  favorites.forEach(function(f){if(f.category&&cats.indexOf(f.category)===-1)cats.push(f.category);});
  var html='';
  cats.forEach(function(c){html+='<option value="'+escapeHtml(c)+'">'+escapeHtml(c)+'</option>';});
  html+='<option value="__new__">＋ 新規セクション</option>';
  sel.innerHTML=html;
  sel.onchange=function(){
    var ni=document.getElementById('fav-category-new'),cb=document.getElementById('cancel-new-category');
    if(this.value==='__new__'){ni.style.display='';cb.style.display='';ni.focus();}else{ni.style.display='none';cb.style.display='none';ni.value='';}
  };
  document.getElementById('cancel-new-category').onclick=function(){sel.value=sel.options[0].value;document.getElementById('fav-category-new').style.display='none';this.style.display='none';};
  if(cats.length===0){document.getElementById('fav-category-new').style.display='';document.getElementById('cancel-new-category').style.display='none';}
}
function handleAddFavorite(e){
  e.preventDefault();
  var name=document.getElementById('fav-name').value.trim();
  var url=document.getElementById('fav-url').value.trim();
  var sel=document.getElementById('fav-category');
  var category;
  if(sel.value==='__new__'){
    category=document.getElementById('fav-category-new').value.trim();
    if(!category){showStatus('セクション名を入力してください');return;}
    var ex=[];favorites.forEach(function(f){if(f.category&&ex.indexOf(f.category)===-1)ex.push(f.category);});
    if(ex.indexOf(category)!==-1||storedSections.indexOf(category)!==-1){showStatus('同名のセクションが既に存在します');return;}
    if(!name&&!url){storedSections.push(category);saveFavorites(function(){showStatus('セクション「'+category+'」を追加しました');document.getElementById('fav-category-new').value='';document.getElementById('fav-category-new').style.display='none';document.getElementById('cancel-new-category').style.display='none';});return;}
  }else{category=sel.value;}
  if(!name||!url)return;
  if(!/^https?:\/\//i.test(url))url='https://'+url;
  favorites.push({id:Date.now().toString(),name:name,url:url,category:category||'メイン'});
  saveFavorites(function(){
    showStatus('「'+name+'」を追加しました');
    document.getElementById('fav-name').value='';document.getElementById('fav-url').value='';
    document.getElementById('fav-category-new').value='';document.getElementById('fav-category-new').style.display='none';
    document.getElementById('cancel-new-category').style.display='none';
  });
}
function renderFavoritesList(){
  var container=document.getElementById('favorites-list');
  document.getElementById('fav-count').textContent=favorites.length+'件';
  if(favorites.length===0&&storedSections.length===0){container.innerHTML='<p class="empty-msg">お気に入りがまだありません</p>';return;}
  var catOrder=storedSections.slice();favorites.forEach(function(f){var c=f.category||'メイン';if(catOrder.indexOf(c)===-1)catOrder.push(c);});
  var groups={};catOrder.forEach(function(c){groups[c]=[];});
  favorites.forEach(function(f){var c=f.category||'メイン';if(!groups[c])groups[c]=[];groups[c].push(f);});
  var html='';
  catOrder.forEach(function(cat){
    html+='<div class="fav-category-group" draggable="true" data-category="'+escapeHtml(cat)+'">';
    html+='<div class="fav-category-title"><span class="fav-category-drag">⠿</span>';
    html+='<span class="fav-category-name">'+escapeHtml(cat)+'</span>';
    html+='<div class="fav-category-actions">';
    html+='<button class="btn btn-edit" data-action="editSection" data-cat="'+escapeHtml(cat)+'">✎</button>';
    html+='<button class="btn btn-delete" data-action="deleteSection" data-cat="'+escapeHtml(cat)+'">×</button>';
    html+='</div></div>';
    groups[cat].forEach(function(fav){
      var domain='';try{domain=new URL(fav.url).hostname;}catch(e){}
      html+='<div class="fav-row" draggable="true" data-fav-id="'+fav.id+'" data-category="'+escapeHtml(cat)+'">';
      html+='<span class="fav-row-drag">⠿</span>';
      html+='<img class="fav-row-icon" src="https://www.google.com/s2/favicons?sz=64&domain='+encodeURIComponent(domain)+'" alt="" onerror="this.style.display=\'none\'">';
      html+='<div class="fav-row-info">';
      html+='<span class="fav-row-name" title="'+escapeHtml(fav.name)+'">'+escapeHtml(fav.name)+'</span>';
      html+='<span class="fav-row-url" title="'+escapeHtml(fav.url)+'">' +escapeHtml(domain)+'</span>';
      html+='</div>';
      html+='<div class="fav-row-actions">';
      html+='<button class="btn btn-edit" data-action="editSite" data-id="'+fav.id+'">✎</button>';
      html+='<button class="btn btn-delete" data-action="deleteFav" data-id="'+fav.id+'">×</button>';
      html+='</div></div>';
    });
    html+='</div>';
  });
  container.innerHTML=html;
  container.querySelectorAll('[data-action]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var action=this.getAttribute('data-action'),id=this.getAttribute('data-id'),cat=this.getAttribute('data-cat');
      if(action==='editSection')editSectionName(cat);
      else if(action==='deleteSection')deleteSection(cat);
      else if(action==='editSite')editSite(id);
      else if(action==='deleteFav')deleteFavorite(id);
    });
  });
  setupFavDnD(container);
}
// ===== インライン編集 =====
var isEditing=false;
function editSite(id){
  var fav=favorites.find(function(f){return f.id===id;});if(!fav||isEditing)return;
  var row=document.querySelector('.fav-row[data-fav-id="'+id+'"]');
  var nameSpan=row.querySelector('.fav-row-name'),urlSpan=row.querySelector('.fav-row-url');
  isEditing=true;row.setAttribute('draggable','false');row.classList.add('editing');
  var nameInput=document.createElement('input');nameInput.className='inline-edit-input';nameInput.value=fav.name;nameInput.placeholder='サイト名';
  var urlInput=document.createElement('input');urlInput.className='inline-edit-input';urlInput.value=fav.url;urlInput.placeholder='URL';
  nameSpan.replaceWith(nameInput);urlSpan.replaceWith(urlInput);
  nameInput.focus();nameInput.select();
  var save=function(){
    var n=nameInput.value.trim(),u=urlInput.value.trim(),changed=false;
    if(n&&n!==fav.name){fav.name=n;changed=true;}
    if(u&&u!==fav.url){if(!/^https?:\/\//i.test(u))u='https://'+u;fav.url=u;changed=true;}
    isEditing=false;
    if(changed){saveFavorites(function(){showStatus('変更を保存しました');});}
    else{row.setAttribute('draggable','true');row.classList.remove('editing');renderFavoritesList();}
  };
  var handleKey=function(e){if(e.key==='Enter'){e.preventDefault();save();}if(e.key==='Escape'){nameInput.value=fav.name;urlInput.value=fav.url;save();}};
  nameInput.addEventListener('keydown',handleKey);urlInput.addEventListener('keydown',handleKey);
  var blurTimer;var handleBlur=function(){clearTimeout(blurTimer);blurTimer=setTimeout(function(){if(document.activeElement!==nameInput&&document.activeElement!==urlInput)save();},150);};
  nameInput.addEventListener('blur',handleBlur);urlInput.addEventListener('blur',handleBlur);
}

function editSectionName(oldName){
  if(isEditing)return;
  var group=document.querySelector('.fav-category-group[data-category="'+oldName+'"]');if(!group)return;
  var nameSpan=group.querySelector('.fav-category-name');
  isEditing=true;group.setAttribute('draggable','false');
  var input=document.createElement('input');input.className='inline-edit-input';input.value=oldName;
  nameSpan.replaceWith(input);input.focus();input.select();
  var save=function(){
    var v=input.value.trim();
    if(v&&v!==oldName){
      var exists=false;favorites.forEach(function(f){if(f.category===v)exists=true;});
      if(exists&&v!==oldName){showStatus('同名のセクションが既に存在します');isEditing=false;renderFavoritesList();return;}
      var si=storedSections.indexOf(oldName);if(si!==-1)storedSections[si]=v;
      favorites.forEach(function(f){if(f.category===oldName)f.category=v;});
      saveFavorites(function(){showStatus('セクション名を変更しました');});
    }else{isEditing=false;group.setAttribute('draggable','true');renderFavoritesList();}
    isEditing=false;
  };
  input.addEventListener('blur',save);
  input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();this.blur();}if(e.key==='Escape'){this.value=oldName;this.blur();}});
}
function deleteFavorite(id){
  var fav=favorites.find(function(f){return f.id===id;});if(!fav)return;
  showModal('「'+fav.name+'」を削除しますか？',function(){favorites=favorites.filter(function(f){return f.id!==id;});saveFavorites(function(){showStatus('削除しました');});});
}
function deleteSection(cat){
  var count=favorites.filter(function(f){return f.category===cat;}).length;
  var msg=count>0?'セクション「'+cat+'」と含まれる'+count+'件のサイトを全て削除しますか？':'セクション「'+cat+'」を削除しますか？';
  showModal(msg,function(){favorites=favorites.filter(function(f){return f.category!==cat;});storedSections=storedSections.filter(function(s){return s!==cat;});saveFavorites(function(){showStatus('セクションを削除しました');});});
}
// ===== お気に入りD&D =====
function setupFavDnD(container){
  var draggedEl=null,dragType=null;
  container.querySelectorAll('.fav-category-group').forEach(function(group){
    group.addEventListener('dragstart',function(e){
      if(isEditing){e.preventDefault();return;}if(e.target.classList.contains('fav-row'))return;
      draggedEl=this;dragType='section';this.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.stopPropagation();
    });
  });
  container.querySelectorAll('.fav-row').forEach(function(row){
    row.addEventListener('dragstart',function(e){
      if(isEditing){e.preventDefault();return;}
      draggedEl=this;dragType='site';this.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.stopPropagation();
    });
  });
  container.addEventListener('dragover',function(e){
    e.preventDefault();
    container.querySelectorAll('.drag-over-above,.drag-over-below').forEach(function(el){el.classList.remove('drag-over-above','drag-over-below');});
    var target=e.target.closest(dragType==='section'?'.fav-category-group':'.fav-row,.fav-category-group');
    if(!target||target===draggedEl)return;
    var rect=target.getBoundingClientRect();target.classList.add(e.clientY<rect.top+rect.height/2?'drag-over-above':'drag-over-below');
  });
  container.addEventListener('drop',function(e){
    e.preventDefault();
    container.querySelectorAll('.drag-over-above,.drag-over-below').forEach(function(el){el.classList.remove('drag-over-above','drag-over-below');});
    if(!draggedEl)return;
    if(dragType==='section'){
      var target=e.target.closest('.fav-category-group');if(!target||target===draggedEl)return;
      reorderSections(draggedEl.getAttribute('data-category'),target.getAttribute('data-category'),e.clientY<target.getBoundingClientRect().top+target.getBoundingClientRect().height/2);
    }else{
      var targetRow=e.target.closest('.fav-row'),targetGroup=e.target.closest('.fav-category-group');if(!targetGroup)return;
      var favId=draggedEl.getAttribute('data-fav-id'),targetCat=targetGroup.getAttribute('data-category');
      if(targetRow&&targetRow!==draggedEl){moveSiteToPosition(favId,targetCat,targetRow.getAttribute('data-fav-id'),e.clientY<targetRow.getBoundingClientRect().top+targetRow.getBoundingClientRect().height/2);}
      else{moveSiteToSection(favId,targetCat);}
    }
  });
  container.addEventListener('dragend',function(){if(draggedEl)draggedEl.classList.remove('dragging');draggedEl=null;dragType=null;container.querySelectorAll('.drag-over-above,.drag-over-below').forEach(function(el){el.classList.remove('drag-over-above','drag-over-below');});});
}
function reorderSections(fromCat,toCat,above){
  var catOrder=storedSections.slice();favorites.forEach(function(f){var c=f.category||'メイン';if(catOrder.indexOf(c)===-1)catOrder.push(c);});
  var fromIdx=catOrder.indexOf(fromCat);if(fromIdx===-1)return;
  catOrder.splice(fromIdx,1);var toIdx=catOrder.indexOf(toCat);if(!above)toIdx++;catOrder.splice(toIdx,0,fromCat);
  var reordered=[];catOrder.forEach(function(cat){favorites.forEach(function(f){if((f.category||'メイン')===cat)reordered.push(f);});});
  storedSections=catOrder;favorites=reordered;saveFavorites(function(){showStatus('セクション順を変更しました');});
}
function moveSiteToPosition(favId,targetCat,targetFavId,above){
  var fav=favorites.find(function(f){return f.id===favId;});if(!fav)return;
  fav.category=targetCat;favorites=favorites.filter(function(f){return f.id!==favId;});
  var idx=favorites.findIndex(function(f){return f.id===targetFavId;});if(!above)idx++;favorites.splice(idx,0,fav);
  saveFavorites(function(){showStatus('サイトを移動しました');});
}
function moveSiteToSection(favId,targetCat){
  var fav=favorites.find(function(f){return f.id===favId;});if(!fav)return;
  fav.category=targetCat;saveFavorites(function(){showStatus('セクションを移動しました');});
}
// ===== ホスト権限リクエスト（optional_host_permissions） =====
function requestHostAccess(url,cb){
  try{var o=new URL(url).origin+'/*';}catch(e){cb(false);return;}
  chrome.permissions.request({origins:[o]},function(g){cb(!!g);});
}
// ===== v1.3: Google Calendar OAuth + iCal URL ハイブリッド管理 =====
const OPTIONS_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
const OPTIONS_SCOPES    = 'https://www.googleapis.com/auth/calendar.readonly';
const OPTIONS_REDIRECT  = 'https://' + chrome.runtime.id + '.chromiumapp.org/';
const CAL_COLOR_PRESETS = ['#6c63ff', '#3d8bff', '#4caf50', '#f9c74f', '#e8853d', '#ff6b6b'];
const ICAL_COLOR_PRESETS = ['#999999', '#6c63ff', '#3d8bff', '#4caf50', '#e8853d', '#ff6b6b'];

function initCalendarSection() {
  loadGcalAccounts();
  document.getElementById('add-gcal-btn').addEventListener('click', handleAddGcalAccount);
  document.getElementById('new-cal-color-presets').addEventListener('click', function(e) {
    var dot = e.target.closest('.cal-preset-dot');
    if (!dot) return;
    this.querySelectorAll('.cal-preset-dot').forEach(function(d) { d.classList.remove('active'); });
    dot.classList.add('active');
  });
  loadIcalUrls();
  document.getElementById('add-ical-btn').addEventListener('click', handleAddIcalUrl);
  document.getElementById('ical-color-presets').addEventListener('click', function(e) {
    var dot = e.target.closest('.cal-preset-dot');
    if (!dot) return;
    this.querySelectorAll('.cal-preset-dot').forEach(function(d) { d.classList.remove('active'); });
    dot.classList.add('active');
  });
}

// =============================================
// OAuth アカウント管理
// =============================================
function loadGcalAccounts() {
  chrome.storage.sync.get('gcalAccounts', function(data) {
    renderGcalAccountList(data.gcalAccounts || []);
  });
}

function saveGcalAccounts(accounts, cb) {
  chrome.storage.sync.set({ gcalAccounts: accounts }, function() {
    renderGcalAccountList(accounts);
    if (cb) cb();
  });
}

async function handleAddGcalAccount() {
  var statusEl = document.getElementById('gcal-add-status');
  var activeDot = document.querySelector('#new-cal-color-presets .cal-preset-dot.active');
  var color = activeDot ? activeDot.getAttribute('data-color') : '#6c63ff';
  var stored = await new Promise(function(res) { chrome.storage.sync.get('gcalAccounts', function(d) { res(d.gcalAccounts || []); }); });
  if (stored.length >= 2) {
    statusEl.textContent = '最大2アカウントまでです。既存アカウントを削除してから追加してください。';
    return;
  }
  statusEl.textContent = '認証中...';
  var authUrl = 'https://accounts.google.com/o/oauth2/auth?' +
    'client_id=' + encodeURIComponent(OPTIONS_CLIENT_ID) +
    '&redirect_uri=' + encodeURIComponent(OPTIONS_REDIRECT) +
    '&response_type=token' +
    '&scope=' + encodeURIComponent(OPTIONS_SCOPES);
  chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async function(redirectUrl) {
    if (chrome.runtime.lastError || !redirectUrl) {
      statusEl.textContent = '認証がキャンセルされました。';
      return;
    }
    var params = new URLSearchParams(new URL(redirectUrl).hash.slice(1));
    var token = params.get('access_token');
    var expiresIn = parseInt(params.get('expires_in') || '3600');
    if (!token) { statusEl.textContent = 'トークン取得に失敗しました。'; return; }
    var profileRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    var profile = await profileRes.json();
    var email = profile.email || 'unknown@gmail.com';
    var existing = stored.find(function(a) { return a.email === email; });
    if (existing) { statusEl.textContent = '「' + email + '」は既に登録されています。'; return; }
    var accounts = stored.concat([{
      email: email,
      token: token,
      expiresAt: Date.now() + expiresIn * 1000,
      color: color
    }]);
    saveGcalAccounts(accounts, function() {
      showStatus('「' + email + '」を追加しました');
      statusEl.textContent = '';
      document.querySelector('#new-cal-color-presets .cal-preset-dot.active').classList.remove('active');
      document.querySelector('#new-cal-color-presets .cal-preset-dot[data-color="#6c63ff"]').classList.add('active');
    });
  });
}

function renderGcalAccountList(accounts) {
  var container = document.getElementById('calendar-list');
  if (accounts.length === 0) {
    container.innerHTML = '<p class="empty-msg">アカウントが登録されていません</p>';
    return;
  }
  var html = '';
  accounts.forEach(function(account) {
    var expiry = account.expiresAt ? new Date(account.expiresAt) : null;
    var isExpired = expiry && expiry < new Date();
    var statusLabel = isExpired
      ? '<span style="font-size:11px;color:var(--danger)">トークン期限切れ（自動リフレッシュ対象）</span>'
      : '<span style="font-size:11px;color:var(--text-secondary)">認証済み</span>';
    html += '<div class="cal-item" data-email="' + escapeHtml(account.email) + '">';
    html += '<span class="cal-color-dot" style="background:' + escapeHtml(account.color) + '"></span>';
    html += '<div style="flex:1;min-width:0">';
    html += '<div style="font-size:13px;color:var(--text-heading);font-weight:600">' + escapeHtml(account.email) + '</div>';
    html += statusLabel;
    html += '</div>';
    html += '<div class="cal-item-actions">';
    html += '<div class="cal-color-presets cal-item-presets" data-email="' + escapeHtml(account.email) + '">';
    CAL_COLOR_PRESETS.forEach(function(pc) {
      html += '<span class="cal-preset-dot' + (account.color===pc?' active':'') + '" data-color="' + pc + '" style="background:' + pc + '"></span>';
    });
    html += '</div>';
    html += '<button class="btn btn-delete" data-del-email="' + escapeHtml(account.email) + '">×</button>';
    html += '</div></div>';
  });
  container.innerHTML = html;
  container.querySelectorAll('.cal-item-presets').forEach(function(group) {
    group.addEventListener('click', function(e) {
      var dot = e.target.closest('.cal-preset-dot');
      if (!dot) return;
      var email = this.getAttribute('data-email');
      chrome.storage.sync.get('gcalAccounts', function(data) {
        var accs = data.gcalAccounts || [];
        var acc = accs.find(function(a) { return a.email === email; });
        if (acc) {
          acc.color = dot.getAttribute('data-color');
          saveGcalAccounts(accs, function() { showStatus('カラーを変更しました'); });
        }
      });
    });
  });
  container.querySelectorAll('[data-del-email]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var email = this.getAttribute('data-del-email');
      showModal('「' + email + '」を削除しますか？\nトークンも削除されます。', function() {
        chrome.storage.sync.get('gcalAccounts', function(data) {
          var accs = (data.gcalAccounts || []).filter(function(a) { return a.email !== email; });
          saveGcalAccounts(accs, function() { showStatus('アカウントを削除しました'); });
        });
      });
    });
  });
}

// =============================================
// iCal URL 管理
// =============================================
function loadIcalUrls() {
  chrome.storage.sync.get('icalUrls', function(data) {
    renderIcalUrlList(data.icalUrls || []);
  });
}

function saveIcalUrls(urls, cb) {
  chrome.storage.sync.set({ icalUrls: urls }, function() {
    renderIcalUrlList(urls);
    if (cb) cb();
  });
}

function handleAddIcalUrl() {
  var statusEl = document.getElementById('ical-add-status');
  var nameInput = document.getElementById('ical-name-input');
  var urlInput = document.getElementById('ical-url-input');
  var activeDot = document.querySelector('#ical-color-presets .cal-preset-dot.active');
  var name = nameInput.value.trim();
  var url = urlInput.value.trim();
  var color = activeDot ? activeDot.getAttribute('data-color') : '#999999';
  if (!name) { statusEl.textContent = 'カレンダー名を入力してください。'; return; }
  if (!url) { statusEl.textContent = 'iCal URLを入力してください。'; return; }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    statusEl.textContent = 'URLはhttp://またはhttps://で始まる必要があります。'; return;
  }
  chrome.storage.sync.get('icalUrls', function(data) {
    var urls = data.icalUrls || [];
    var dup = urls.find(function(u) { return u.url === url; });
    if (dup) { statusEl.textContent = 'このURLは既に登録されています。'; return; }
    urls.push({
      id: Date.now().toString(36),
      name: name,
      url: url,
      color: color
    });
    saveIcalUrls(urls, function() {
      showStatus('「' + name + '」を追加しました');
      nameInput.value = '';
      urlInput.value = '';
      statusEl.textContent = '';
    });
  });
}

function renderIcalUrlList(urls) {
  var container = document.getElementById('ical-list');
  if (urls.length === 0) {
    container.innerHTML = '<p class="empty-msg">iCal URLが登録されていません</p>';
    return;
  }
  var html = '';
  urls.forEach(function(ical) {
    html += '<div class="cal-item" data-ical-id="' + escapeHtml(ical.id) + '">';
    html += '<span class="cal-color-dot" style="background:' + escapeHtml(ical.color) + '"></span>';
    html += '<div style="flex:1;min-width:0">';
    html += '<div style="font-size:13px;color:var(--text-heading);font-weight:600">' + escapeHtml(ical.name) + '</div>';
    html += '<div style="font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(ical.url) + '</div>';
    html += '</div>';
    html += '<div class="cal-item-actions">';
    html += '<div class="cal-color-presets ical-item-presets" data-ical-id="' + escapeHtml(ical.id) + '">';
    ICAL_COLOR_PRESETS.forEach(function(pc) {
      html += '<span class="cal-preset-dot' + (ical.color===pc?' active':'') + '" data-color="' + pc + '" style="background:' + pc + '"></span>';
    });
    html += '</div>';
    html += '<button class="btn btn-delete" data-del-ical="' + escapeHtml(ical.id) + '">×</button>';
    html += '</div></div>';
  });
  container.innerHTML = html;
  container.querySelectorAll('.ical-item-presets').forEach(function(group) {
    group.addEventListener('click', function(e) {
      var dot = e.target.closest('.cal-preset-dot');
      if (!dot) return;
      var id = this.getAttribute('data-ical-id');
      chrome.storage.sync.get('icalUrls', function(data) {
        var urls = data.icalUrls || [];
        var item = urls.find(function(u) { return u.id === id; });
        if (item) {
          item.color = dot.getAttribute('data-color');
          saveIcalUrls(urls, function() { showStatus('カラーを変更しました'); });
        }
      });
    });
  });
  container.querySelectorAll('[data-del-ical]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = this.getAttribute('data-del-ical');
      chrome.storage.sync.get('icalUrls', function(data) {
        var urls = data.icalUrls || [];
        var target = urls.find(function(u) { return u.id === id; });
        var name = target ? target.name : 'iCal';
        showModal('「' + name + '」を削除しますか？', function() {
          var filtered = urls.filter(function(u) { return u.id !== id; });
          saveIcalUrls(filtered, function() { showStatus('iCalを削除しました'); });
        });
      });
    });
  });
}
function loadCalendars() {
  chrome.storage.sync.get(['icalUrl', 'icalUrls'], function(data) {
    if (data.icalUrls && data.icalUrls.length > 0) {
      calendars = data.icalUrls;
    } else if (data.icalUrl) {
      // 後方互換: 単一URLからの移行
      calendars = [{id:'default', name:'メイン', url:data.icalUrl, color:'#6c63ff', enabled:true}];
      chrome.storage.sync.set({icalUrls: calendars});
    } else {
      calendars = [];
    }
    renderCalendarList();
  });
}
function saveCalendars(cb) {
  chrome.storage.sync.set({icalUrls: calendars}, function() {
    renderCalendarList();
    if (cb) cb();
  });
}
function renderCalendarList() {
  var container = document.getElementById('calendar-list');
  if (calendars.length === 0) {
    container.innerHTML = '<p class="empty-msg">カレンダーがまだ登録されていません</p>';
    return;
  }
  var html = '';
  calendars.forEach(function(cal) {
    var domain = ''; try { domain = new URL(cal.url).hostname; } catch(e) {}
    var toggleClass = 'toggle-switch' + (cal.enabled ? ' active' : '');
    html += '<div class="cal-item" data-cal-id="' + escapeHtml(cal.id) + '">';
    html += '<span class="cal-color-dot" style="background:' + escapeHtml(cal.color) + '"></span>';
    html += '<span class="cal-item-name">' + escapeHtml(cal.name) + '</span>';
    html += '<span class="cal-item-url" title="' + escapeHtml(cal.url) + '">' + escapeHtml(domain) + '</span>';
    html += '<div class="cal-item-actions">';
    html += '<div class="cal-color-presets cal-item-presets" data-cal-id="' + escapeHtml(cal.id) + '">';
    CAL_COLOR_PRESETS.forEach(function(pc) { html += '<span class="cal-preset-dot' + (cal.color === pc ? ' active' : '') + '" data-color="' + pc + '" style="background:' + pc + '"></span>'; });
    html += '</div>';
    html += '<div class="' + toggleClass + '" data-cal-id="' + escapeHtml(cal.id) + '"></div>';
    html += '<button class="btn btn-delete" data-del-cal="' + escapeHtml(cal.id) + '">×</button>';
    html += '</div></div>';
  });
  container.innerHTML = html;
  // トグル
  container.querySelectorAll('.toggle-switch').forEach(function(toggle) {
    toggle.addEventListener('click', function() {
      var id = this.getAttribute('data-cal-id');
      var cal = calendars.find(function(c) { return c.id === id; });
      if (cal) { cal.enabled = !cal.enabled; saveCalendars(function(){ showStatus('カレンダーを更新しました'); }); }
    });
  });
  // カラー変更（プリセット）
  container.querySelectorAll('.cal-item-presets').forEach(function(presetGroup) {
    presetGroup.addEventListener('click', function(e) {
      var dot = e.target.closest('.cal-preset-dot');
      if (!dot) return;
      var id = this.getAttribute('data-cal-id');
      var cal = calendars.find(function(c) { return c.id === id; });
      if (cal) {
        cal.color = dot.getAttribute('data-color');
        saveCalendars(function(){ showStatus('カラーを変更しました'); });
      }
    });
  });
  // 削除
  container.querySelectorAll('[data-del-cal]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var id = this.getAttribute('data-del-cal');
      var cal = calendars.find(function(c) { return c.id === id; });
      if (!cal) return;
      showModal('カレンダー「' + cal.name + '」を削除しますか？', function() {
        calendars = calendars.filter(function(c) { return c.id !== id; });
        saveCalendars(function(){ showStatus('カレンダーを削除しました'); });
      });
    });
  });
}
function handleAddCalendar() {
  var name = document.getElementById('new-cal-name').value.trim();
  var url = document.getElementById('new-cal-url').value.trim();
  var activeDot = document.querySelector('#new-cal-color-presets .cal-preset-dot.active');
  var color = activeDot ? activeDot.getAttribute('data-color') : '#6c63ff';
  if (!name || !url) { showStatus('カレンダー名とiCal URLを入力してください'); return; }
  requestHostAccess(url, function(ok) {
    if (!ok) { showStatus('URLへのアクセス権限が必要です'); return; }
    calendars.push({
      id: 'cal-' + Date.now(),
      name: name,
      url: url,
      color: color,
      enabled: true
    });
    saveCalendars(function() {
      showStatus('「' + name + '」を追加しました');
      document.getElementById('new-cal-name').value = '';
      document.getElementById('new-cal-url').value = '';
      document.getElementById('new-cal-color-presets').querySelectorAll('.cal-preset-dot').forEach(function(d, i) { d.classList.toggle('active', i === 0); });
    });
  });
}
// ===== v1.3: レイアウト設定 =====
var DEFAULT_WIDGETS = [
  { id: 'calendar', label: 'カレンダー', visible: true, column: 'left' },
  { id: 'favorites', label: 'お気に入り', visible: true, column: 'center' },
  { id: 'news', label: 'ニュース', visible: true, column: 'right' }
];
var widgetSettings = [];
function loadWidgetSettings() {
  chrome.storage.sync.get(['widgetSettings', 'columnWidths'], function(data) {
    widgetSettings = data.widgetSettings || DEFAULT_WIDGETS.map(function(w) { return Object.assign({}, w); });
    renderWidgetTable();
    applyZoneWidths(data.columnWidths || '1-1-1');
  });
}
function renderWidgetTable() {
  var zones = {
    left: document.getElementById('zone-left'),
    center: document.getElementById('zone-center'),
    right: document.getElementById('zone-right'),
    hidden: document.getElementById('zone-hidden')
  };
  if (!zones.left) return;
  Object.values(zones).forEach(function(z) { if (z) z.innerHTML = ''; });
  widgetSettings.forEach(function(widget) {
    var card = document.createElement('div');
    card.className = 'layout-widget-card';
    card.draggable = true;
    card.setAttribute('data-widget-id', widget.id);
    card.innerHTML =
      '<span class="layout-drag-handle">⠿</span>' +
      '<span class="layout-widget-name">' + escapeHtml(widget.label) + '</span>' +
      '<div class="toggle-switch' + (widget.visible ? ' active' : '') + '" data-widget-id="' + widget.id + '"></div>';
    var zone = widget.visible ? (zones[widget.column] || zones.left) : zones.hidden;
    if (zone) zone.appendChild(card);
  });
  setupLayoutDnD(zones);
  document.querySelectorAll('#section-layout .toggle-switch').forEach(function(toggle) {
    toggle.addEventListener('click', function(e) {
      e.stopPropagation();
      var id = this.getAttribute('data-widget-id');
      var w = widgetSettings.find(function(w) { return w.id === id; });
      if (w) {
        w.visible = !w.visible;
        chrome.storage.sync.set({ widgetSettings: widgetSettings }, function() {
          renderWidgetTable();
          showStatus('表示設定を更新しました');
        });
      }
    });
  });
}
function applyZoneWidths(value) {
  var parts = (value || '1-1-1').split('-');
  document.querySelectorAll('.layout-col-zone').forEach(function(zone, i) {
    zone.style.flex = parts[i] || '1';
  });
}
function setupResizeHandles() {
  var container = document.getElementById('layout-dnd-container');
  if (!container) return;
  document.querySelectorAll('.layout-resize-handle').forEach(function(handle) {
    handle.addEventListener('mousedown', function(e) {
      e.preventDefault();
      var handleIdx = parseInt(this.getAttribute('data-handle-idx'));
      var cols = Array.from(document.querySelectorAll('.layout-col-zone'));
      var startX = e.clientX;
      var containerWidth = container.getBoundingClientRect().width;
      var available = containerWidth - 12 * (cols.length + 1);
      var initialFlexes = cols.map(function(col) { return parseFloat(col.style.flex) || 1; });
      var totalFlex = initialFlexes.reduce(function(a, b) { return a + b; }, 0);
      var initialPx = initialFlexes.map(function(f) { return (f / totalFlex) * available; });
      document.body.style.cursor = 'col-resize';
      function onMouseMove(e) {
        var dx = e.clientX - startX;
        var newPx = initialPx.slice();
        newPx[handleIdx] = Math.max(60, initialPx[handleIdx] + dx);
        newPx[handleIdx + 1] = Math.max(60, initialPx[handleIdx + 1] - dx);
        var newTotal = newPx.reduce(function(a, b) { return a + b; }, 0);
        cols.forEach(function(col, i) { col.style.flex = (newPx[i] / newTotal * totalFlex).toFixed(2); });
      }
      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        var finalFlexes = cols.map(function(col) { return parseFloat(col.style.flex) || 1; });
        var minFlex = Math.min.apply(null, finalFlexes);
        var normalized = finalFlexes.map(function(f) { return (f / minFlex).toFixed(2); });
        chrome.storage.sync.set({ columnWidths: normalized.join('-') }, function() { showStatus('カラム幅を保存しました'); });
      }
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}
function setupLayoutDnD(zones) {
  var draggedCard = null;
  document.querySelectorAll('.layout-widget-card').forEach(function(card) {
    card.addEventListener('dragstart', function(e) {
      draggedCard = this;
      this.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', function() {
      this.classList.remove('dragging');
      Object.values(zones).forEach(function(z) { z.classList.remove('drag-over'); });
    });
  });
  Object.entries(zones).forEach(function(entry) {
    var zoneName = entry[0], zoneEl = entry[1];
    zoneEl.addEventListener('dragover', function(e) {
      e.preventDefault();
      this.classList.add('drag-over');
    });
    zoneEl.addEventListener('dragleave', function() {
      this.classList.remove('drag-over');
    });
    zoneEl.addEventListener('drop', function(e) {
      e.preventDefault();
      this.classList.remove('drag-over');
      if (!draggedCard) return;
      var id = draggedCard.getAttribute('data-widget-id');
      var w = widgetSettings.find(function(w) { return w.id === id; });
      if (w) {
        var changed = false;
        if (zoneName === 'hidden') {
          if (w.visible) { w.visible = false; changed = true; }
        } else {
          if (!w.visible || w.column !== zoneName) {
            w.visible = true;
            w.column = zoneName;
            changed = true;
          }
        }
        if (changed) {
          chrome.storage.sync.set({ widgetSettings: widgetSettings }, function() {
            renderWidgetTable();
            showStatus('配置を更新しました');
          });
        }
      }
      draggedCard = null;
    });
  });
}
// ===== ニュース =====
function loadNewsSource(){
  chrome.storage.sync.get(['newsSource','customRssUrl'],function(data){
    if(data.newsSource)document.getElementById('news-source').value=data.newsSource;
    if(data.newsSource==='custom'){document.getElementById('custom-rss-group').style.display='';if(data.customRssUrl)document.getElementById('custom-rss-url').value=data.customRssUrl;}
  });
}
function saveNewsSource(){
  var source=document.getElementById('news-source').value,data={newsSource:source};
  if(source==='custom'){
    var rssUrl=document.getElementById('custom-rss-url').value.trim();
    data.customRssUrl=rssUrl;
    if(rssUrl){
      requestHostAccess(rssUrl,function(ok){
        if(!ok){showStatus('URLへのアクセス権限が必要です');return;}
        chrome.storage.sync.set(data,function(){showStatus('ニュースソースを保存しました');});
      });
      return;
    }
  }
  chrome.storage.sync.set(data,function(){showStatus('ニュースソースを保存しました');});
}
// ===== テーマ設定 =====
var THEME_LIST=[
  {id:'dark-purple',name:'ダーク',colors:['#0f0c29','#302b63','#24243e']},
  {id:'midnight',name:'ミッドナイト',colors:['#020b1a','#0a1e3d','#071533']},
  {id:'forest',name:'フォレスト',colors:['#060f08','#142a18','#0e2012']},
  {id:'sunset',name:'サンセット',colors:['#1a0e05','#33201a','#281208']},
  {id:'light',name:'ライト',colors:['#eef0f5','#e0e2ea','#f0f2f8']},
  {id:'slate',name:'スレート',colors:['#18181c','#252530','#1e1e28']}
];
function loadThemeSettings(){chrome.storage.sync.get('theme',function(data){renderThemeGrid(data.theme||'slate');});}
function renderThemeGrid(current){
  var container=document.getElementById('theme-grid'),html='';
  THEME_LIST.forEach(function(t){
    var active=t.id===current?' active':'';
    html+='<div class="theme-card'+active+'" data-theme-id="'+t.id+'">';
    html+='<div class="theme-preview" style="background:linear-gradient(135deg,'+t.colors.join(',')+')"><div class="theme-preview-bar"></div><div class="theme-preview-cards"><div class="tp-card"></div><div class="tp-card"></div><div class="tp-card"></div></div></div>';
    html+='<span class="theme-card-name">'+t.name+'</span></div>';
  });
  container.innerHTML=html;
  container.querySelectorAll('.theme-card').forEach(function(card){
    card.addEventListener('click',function(){
      var id=this.getAttribute('data-theme-id');
      document.documentElement.setAttribute('data-theme',id);
      localStorage.setItem('ntTheme',id);
      chrome.storage.sync.set({theme:id},function(){showStatus('テーマを変更しました');});
      container.querySelectorAll('.theme-card').forEach(function(c){c.classList.remove('active');});
      this.classList.add('active');
    });
  });
}
// ===== v1.3: 設定エクスポート・インポート =====
function initExportImport() {
  document.getElementById('export-btn').addEventListener('click', handleExport);
  document.getElementById('import-file-input').addEventListener('change', handleImport);
}

function handleExport() {
  var exportKeys = [
    'favorites', 'storedSections',
    'theme',
    'newsSource', 'customRssUrl',
    'icalUrls',
    'widgetSettings', 'columnWidths',
    'eventFilterMode',
    'enableEventAdd'
  ];
  chrome.storage.sync.get(exportKeys, function(data) {
    if (data.gcalAccounts) {
      data.gcalAccounts = data.gcalAccounts.map(function(a) {
        return { email: a.email, color: a.color };
      });
    }
    var exportData = {
      version: '1.3',
      exportedAt: new Date().toISOString(),
      data: data
    };
    var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    a.download = 'custom-newtab-settings-' + dateStr + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showStatus('エクスポートしました');
  });
}

function handleImport(e) {
  var file = e.target.files[0];
  if (!file) return;
  var statusEl = document.getElementById('import-status');
  var reader = new FileReader();
  reader.onload = function(ev) {
    var parsed;
    try {
      parsed = JSON.parse(ev.target.result);
    } catch (err) {
      statusEl.textContent = '❌ ファイルの読み込みに失敗しました（不正なJSON）';
      return;
    }
    if (!parsed.version || !parsed.data) {
      statusEl.textContent = '❌ 対応していないファイル形式です';
      return;
    }
    showModal('現在の設定を全て上書きします。よろしいですか？', function() {
      chrome.storage.sync.set(parsed.data, function() {
        statusEl.textContent = '✅ インポート完了。設定を反映しました。';
        showStatus('インポートしました');
        setTimeout(function() { location.reload(); }, 1000);
      });
    }, '上書き');
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ===== v1.3: 予定追加機能ON/OFF =====
function initEventAddToggle() {
  var toggle = document.getElementById('toggle-event-add');
  if (!toggle) return;
  chrome.storage.sync.get('enableEventAdd', function(data) {
    if (data.enableEventAdd) toggle.classList.add('active');
  });
  toggle.addEventListener('click', function() {
    var isActive = this.classList.toggle('active');
    chrome.storage.sync.set({ enableEventAdd: isActive }, function() {
      showStatus(isActive ? '予定追加機能を有効にしました' : '予定追加機能を無効にしました');
    });
  });
}
	