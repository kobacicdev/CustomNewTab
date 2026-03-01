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
  loadIcalUrl();
  loadNewsSource();
  loadThemeSettings();
  loadSearchSettings();
  document.getElementById('add-fav-form').addEventListener('submit', handleAddFavorite);
  document.getElementById('save-ical-url').addEventListener('click', saveIcalUrl);
  document.getElementById('test-ical-url').addEventListener('click', testIcalUrl);
  document.getElementById('save-news-source').addEventListener('click', saveNewsSource);
  document.getElementById('news-source').addEventListener('change', function() {
    document.getElementById('custom-rss-group').style.display = this.value==='custom'?'':'none';
  });
  document.getElementById('add-engine-btn').addEventListener('click', handleAddEngine);
  document.addEventListener('keydown', function(e) {
    if(e.key==='Escape') { var o=document.getElementById('modal-overlay'); if(o.classList.contains('show'))o.classList.remove('show'); }
  });
});
// ===== ユーティリティ =====
function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function showStatus(msg){var el=document.getElementById('status-msg');el.textContent=msg;el.classList.add('show');setTimeout(function(){el.classList.remove('show');},2000);}
function showModal(message,onConfirm){
  var overlay=document.getElementById('modal-overlay');
  document.getElementById('modal-message').textContent=message;
  overlay.classList.add('show');
  var conf=document.getElementById('modal-confirm'),canc=document.getElementById('modal-cancel');
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
// ===== iCal =====
function loadIcalUrl(){chrome.storage.sync.get('icalUrl',function(data){if(data.icalUrl)document.getElementById('ical-url').value=data.icalUrl;});}
function saveIcalUrl(){var url=document.getElementById('ical-url').value.trim();chrome.storage.sync.set({icalUrl:url},function(){showStatus('iCal URLを保存しました');});}
function testIcalUrl(){
  var url=document.getElementById('ical-url').value.trim(),status=document.getElementById('ical-status');
  if(!url){status.textContent='URLを入力してください';return;}
  status.textContent='テスト中...';
  fetch(url).then(function(r){return r.text();}).then(function(text){
    var count=(text.match(/BEGIN:VEVENT/g)||[]).length;
    status.textContent='✅ 取得成功！'+count+'件のイベントが見つかりました';
  }).catch(function(err){status.textContent='❌ 取得失敗：'+err.message;});
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
  if(source==='custom')data.customRssUrl=document.getElementById('custom-rss-url').value.trim();
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
// ===== 検索エンジン設定 =====
var MAX_ENABLED=4;
var SEARCH_PRESETS=[
  {id:'google',name:'Google',url:'https://www.google.com/search?q=%s',icon:'https://www.google.com/favicon.ico',enabled:true,preset:true},
  {id:'perplexity',name:'Perplexity',url:'https://www.perplexity.ai/search?q=%s',icon:'https://www.google.com/s2/favicons?sz=64&domain=perplexity.ai',enabled:true,preset:true},
  {id:'amazon',name:'Amazon',url:'https://www.amazon.co.jp/s?k=%s',icon:'https://www.google.com/s2/favicons?sz=64&domain=amazon.co.jp',enabled:false,preset:true},
  {id:'youtube',name:'YouTube',url:'https://www.youtube.com/results?search_query=%s',icon:'https://www.google.com/s2/favicons?sz=64&domain=youtube.com',enabled:false,preset:true},
  {id:'chatgpt',name:'ChatGPT',url:'https://chatgpt.com/?q=%s',icon:'https://www.google.com/s2/favicons?sz=64&domain=chatgpt.com',enabled:false,preset:true},
  {id:'gemini',name:'Gemini',url:'https://gemini.google.com/app?q=%s&hl=ja',icon:'https://www.google.com/s2/favicons?sz=64&domain=gemini.google.com',enabled:false,preset:true}
];
var searchEngines=[];
function loadSearchSettings(){
  chrome.storage.sync.get('searchEngines',function(data){
    searchEngines=data.searchEngines||SEARCH_PRESETS.map(function(p){return Object.assign({},p);});
    renderSearchEngineList();renderSearchPreview();
  });
}
function saveSearchEngines(cb){chrome.storage.sync.set({searchEngines:searchEngines},function(){renderSearchPreview();if(cb)cb();});}
function getEnabledCount(){return searchEngines.filter(function(e){return e.enabled;}).length;}
function renderSearchEngineList(){
  var container=document.getElementById('search-engine-list'),cnt=getEnabledCount();
  document.getElementById('engine-enabled-count').textContent=cnt+' / '+MAX_ENABLED+' 有効';
  var html='';
  searchEngines.forEach(function(engine){
    var tA=engine.enabled?' active':'',tD=(!engine.enabled&&cnt>=MAX_ENABLED)?' disabled':'';
    html+='<div class="engine-row" draggable="true" data-engine-id="'+engine.id+'">';
    html+='<span class="engine-drag">⠿</span>';
    html+='<img class="engine-icon" src="'+escapeHtml(engine.icon)+'" alt="" onerror="this.style.display=\'none\'">';
    html+='<span class="engine-name">'+escapeHtml(engine.name)+'</span>';
    html+='<div class="engine-actions"><div class="toggle-switch'+tA+tD+'" data-engine-id="'+engine.id+'"></div>';
    if(!engine.preset)html+='<button class="btn btn-delete" data-del-engine="'+engine.id+'">🗑️</button>';
    html+='</div></div>';
  });
  container.innerHTML=html;
  container.querySelectorAll('.toggle-switch').forEach(function(toggle){
    toggle.addEventListener('click',function(){
      if(this.classList.contains('disabled'))return;
      var id=this.getAttribute('data-engine-id');
      var engine=searchEngines.find(function(e){return e.id===id;});if(!engine)return;
      engine.enabled=!engine.enabled;
      saveSearchEngines(function(){renderSearchEngineList();});
    });
  });
  container.querySelectorAll('[data-del-engine]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var id=this.getAttribute('data-del-engine');
      searchEngines=searchEngines.filter(function(e){return e.id!==id;});
      saveSearchEngines(function(){renderSearchEngineList();showStatus('検索エンジンを削除しました');});
    });
  });
  setupEngineDnD(container);
}
function setupEngineDnD(container){
  var draggedRow=null;
  container.querySelectorAll('.engine-row').forEach(function(row){
    row.addEventListener('dragstart',function(e){draggedRow=this;this.classList.add('dragging');e.dataTransfer.effectAllowed='move';});
    row.addEventListener('dragover',function(e){
      e.preventDefault();if(this===draggedRow)return;
      container.querySelectorAll('.engine-row').forEach(function(r){r.classList.remove('drag-over-above','drag-over-below');});
      var rect=this.getBoundingClientRect();this.classList.add(e.clientY<rect.top+rect.height/2?'drag-over-above':'drag-over-below');
    });
    row.addEventListener('dragleave',function(){this.classList.remove('drag-over-above','drag-over-below');});
    row.addEventListener('drop',function(e){
      e.preventDefault();
      container.querySelectorAll('.engine-row').forEach(function(r){r.classList.remove('drag-over-above','drag-over-below');});
      if(!draggedRow||this===draggedRow)return;
      var fromId=draggedRow.getAttribute('data-engine-id'),toId=this.getAttribute('data-engine-id');
      var above=e.clientY<this.getBoundingClientRect().top+this.getBoundingClientRect().height/2;
      var fromIdx=searchEngines.findIndex(function(e){return e.id===fromId;});
      var item=searchEngines.splice(fromIdx,1)[0];
      var toIdx=searchEngines.findIndex(function(e){return e.id===toId;});if(!above)toIdx++;
      searchEngines.splice(toIdx,0,item);
      saveSearchEngines(function(){renderSearchEngineList();});
    });
    row.addEventListener('dragend',function(){this.classList.remove('dragging');container.querySelectorAll('.engine-row').forEach(function(r){r.classList.remove('drag-over-above','drag-over-below');});});
  });
}
function renderSearchPreview(){
  var area=document.getElementById('search-preview-area');
  var enabled=searchEngines.filter(function(e){return e.enabled;});
  if(enabled.length===0){area.innerHTML='<p class="empty-msg">検索バーは非表示です</p>';area.removeAttribute('data-count');return;}
  area.setAttribute('data-count',enabled.length);
  var html='';
  enabled.forEach(function(engine){
    html+='<div class="preview-search-box"><img src="'+escapeHtml(engine.icon)+'" alt="" class="preview-icon" onerror="this.style.display=\'none\'"><span class="preview-placeholder">'+escapeHtml(engine.name)+' で検索...</span></div>';
  });
  area.innerHTML=html;
}
function handleAddEngine(){
  var name=document.getElementById('engine-name').value.trim(),url=document.getElementById('engine-url').value.trim();
  if(!name||!url){showStatus('名前とURLを入力してください');return;}
  if(url.indexOf('%s')===-1){showStatus('URLに %s を含めてください');return;}
  var domain='';try{domain=new URL(url.replace('%s','test')).hostname;}catch(e){}
  searchEngines.push({id:'custom-'+Date.now(),name:name,url:url,icon:domain?'https://www.google.com/s2/favicons?sz=64&domain='+domain:'',enabled:false,preset:false});
  saveSearchEngines(function(){renderSearchEngineList();showStatus('「'+name+'」を追加しました');document.getElementById('engine-name').value='';document.getElementById('engine-url').value='';});
}