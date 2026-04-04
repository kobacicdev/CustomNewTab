// ===== カスタム月カレンダー + 予定リスト =====
// v1.3: Google Calendar API（OAuth）+ iCal URL ハイブリッド対応

const CLIENT_ID = '76530077604-2ocp8a9jtpchr5shnovoj0n6evpe3ppn.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';
const REDIRECT_URI = 'https://' + chrome.runtime.id + '.chromiumapp.org/';

var currentDate = new Date();
var eventDays = new Set();
var allEvents = [];
var filterMode = 'month';
var enableEventAdd = false;

function loadCalendarEmbed() {
  chrome.storage.sync.get('enableEventAdd', function(data) {
    enableEventAdd = data.enableEventAdd === true;
    loadFilterMode(function() {
      renderFilterTabs();
      renderCalendar();
      fetchAllSources(true);
      if (enableEventAdd) initEventModal();
    });
  });
}

// ===== フィルタモード読み込み =====
function loadFilterMode(cb) {
  chrome.storage.sync.get('eventFilterMode', function(data) {
    filterMode = data.eventFilterMode || 'month';
    if (cb) cb();
  });
}

// ===== フィルタタブ描画 =====
function renderFilterTabs() {
  var card = document.getElementById('events-container').parentElement;
  var existing = card.querySelector('.filter-tabs');
  if (existing) existing.remove();
  var tabs = document.createElement('div');
  tabs.className = 'filter-tabs';
  var modes = [
    { id: 'month', label: '月' },
    { id: 'week', label: '週' },
    { id: 'day', label: '日' }
  ];
  modes.forEach(function(m) {
    var btn = document.createElement('button');
    btn.className = 'filter-tab' + (filterMode === m.id ? ' active' : '');
    btn.textContent = m.label;
    btn.setAttribute('data-mode', m.id);
    btn.addEventListener('click', function() {
      filterMode = m.id;
      chrome.storage.sync.set({ eventFilterMode: filterMode });
      card.querySelectorAll('.filter-tab').forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      renderFilteredEvents();
    });
    tabs.appendChild(btn);
  });
  card.insertBefore(tabs, document.getElementById('events-container'));
}

// ===== ユーティリティ =====
function escapeAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// =============================================
// OAuth トークン管理
// =============================================
async function getValidToken(account) {
  const now = Date.now();
  if (account.token && account.expiresAt && now < account.expiresAt - 120000) {
    return account.token;
  }
  try {
    const result = await launchOAuth(account.email, false);
    const accounts = await getStoredAccounts();
    const idx = accounts.findIndex(function(a) { return a.email === account.email; });
    if (idx !== -1) {
      accounts[idx].token = result.token;
      accounts[idx].expiresAt = result.expiresAt;
      await saveAccounts(accounts);
    }
    return result.token;
  } catch(e) {
    console.warn('Silent refresh failed for', account.email);
    return account.token;
  }
}

function launchOAuth(loginHint, interactive) {
  return new Promise(function(resolve, reject) {
    var authUrl = 'https://accounts.google.com/o/oauth2/auth?' +
      'client_id=' + encodeURIComponent(CLIENT_ID) +
      '&redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
      '&response_type=token' +
      '&scope=' + encodeURIComponent(SCOPES) +
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

function getStoredAccounts() {
  return new Promise(function(resolve) {
    chrome.storage.sync.get('gcalAccounts', function(data) {
      resolve(data.gcalAccounts || []);
    });
  });
}

function saveAccounts(accounts) {
  return new Promise(function(resolve) {
    chrome.storage.sync.set({ gcalAccounts: accounts }, resolve);
  });
}

// =============================================
// Google Calendar API でイベント取得
// =============================================
async function fetchEventsForAccount(account) {
  var token;
  try {
    token = await getValidToken(account);
  } catch(e) {
    console.error('Token error for', account.email, e);
    return [];
  }
  if (!token) return [];

  var now = new Date();
  var timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  var timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString();

  var calListRes;
  try {
    calListRes = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      { headers: { 'Authorization': 'Bearer ' + token } }
    );
  } catch(e) { console.error('calendarList fetch error:', e); return []; }
  if (!calListRes.ok) { console.error('calendarList error:', calListRes.status); return []; }
  var calList = await calListRes.json();

  var events = [];
  var calendars = (calList.items || []).filter(function(c) { return c.selected !== false; });

  var fetches = calendars.map(function(cal) {
    var url = 'https://www.googleapis.com/calendar/v3/calendars/' +
      encodeURIComponent(cal.id) + '/events?' +
      'timeMin=' + encodeURIComponent(timeMin) +
      '&timeMax=' + encodeURIComponent(timeMax) +
      '&singleEvents=true&orderBy=startTime&maxResults=100';
    return fetch(url, { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        return (data.items || []).map(function(ev) {
          var startRaw = ev.start.dateTime || ev.start.date;
          var endRaw = ev.end ? (ev.end.dateTime || ev.end.date) : null;
          var meetingUrl = extractMeetingUrlFromGcal(ev);
          return {
            summary: ev.summary || '(無題)',
            start: new Date(startRaw),
            end: endRaw ? new Date(endRaw) : null,
            isAllDay: !ev.start.dateTime,
            meetingUrl: meetingUrl,
            calendarColor: cal.backgroundColor || account.color || '#6c63ff',
            calendarName: cal.summary,
            source: 'oauth'
          };
        });
      })
      .catch(function(e) { console.error('events fetch error:', e); return []; });
  });

  var results = await Promise.all(fetches);
  results.forEach(function(evs) { events = events.concat(evs); });
  return events;
}

// ===== Google Calendar イベントからの会議URL抽出 =====
function extractMeetingUrlFromGcal(ev) {
  if (ev.conferenceData && ev.conferenceData.entryPoints) {
    var videoEntry = ev.conferenceData.entryPoints.find(function(ep) { return ep.entryPointType === 'video'; });
    if (videoEntry) return videoEntry.uri;
  }
  var GCAL_MEETING_RE = /https?:\/\/(?:meet\.google\.com\/[a-z\-]+|zoom\.us\/j\/\d+|teams\.microsoft\.com\/l\/meetup-join\/[^\s"<]+)/i;
  if (ev.location) { var m = ev.location.match(GCAL_MEETING_RE); if (m) return m[0]; }
  if (ev.description) { var m2 = ev.description.match(GCAL_MEETING_RE); if (m2) return m2[0]; }
  return null;
}

// ===== iCal URL ストレージ =====
function getStoredIcalUrls() {
  return new Promise(function(resolve) {
    chrome.storage.sync.get('icalUrls', function(data) {
      resolve(data.icalUrls || []);
    });
  });
}

// =============================================
// 全ソース統合（OAuth + iCal）
// =============================================
async function fetchAllSources(renderList) {
  var oauthAccounts, icalUrls;
  try { oauthAccounts = await getStoredAccounts(); } catch(e) { oauthAccounts = []; }
  try { icalUrls = await getStoredIcalUrls(); } catch(e) { icalUrls = []; }

  var enabledIcals = icalUrls.filter(function(c) { return c.enabled !== false; });

  if (oauthAccounts.length === 0 && enabledIcals.length === 0) {
    if (renderList) {
      document.getElementById('events-container').innerHTML =
        '<p class="loading">設定画面でGoogleアカウントまたはiCal URLを追加してください。</p>';
    }
    return;
  }

  allEvents = [];

  var oauthFetches = oauthAccounts.map(function(account) {
    return fetchEventsForAccount(account);
  });

  var icalFetches = enabledIcals.map(function(cal) {
    return fetch(cal.url).then(function(res) { return res.text(); }).then(function(text) {
      var events = parseICalEvents(text);
      events.forEach(function(ev) { ev.calendarName = cal.name; ev.calendarColor = cal.color; ev.source = 'ical'; });
      return events;
    }).catch(function(err) { console.error('iCal fetch error (' + cal.name + '):', err); return []; });
  });

  var allFetches = oauthFetches.concat(icalFetches);
  var results = await Promise.all(allFetches);
  results.forEach(function(evs) { allEvents = allEvents.concat(evs); });

  allEvents = deduplicateEvents(allEvents);
  allEvents.sort(function(a, b) { return a.start - b.start; });

  updateCalendarDots(currentDate);
  renderCalendar();
  if (renderList) renderFilteredEvents();
}

// ===== 重複排除（OAuth優先） =====
function deduplicateEvents(events) {
  var seen = {};
  return events.filter(function(ev) {
    var key = ev.summary.trim().toLowerCase() + '|' + ev.start.getTime();
    if (seen[key]) {
      if (ev.source === 'oauth' && seen[key].source === 'ical') {
        seen[key].remove = true;
        seen[key] = ev;
        return true;
      }
      return false;
    }
    seen[key] = ev;
    return true;
  }).filter(function(ev) { return !ev.remove; });
}

// ===== カレンダーグリッド描画 =====
function renderCalendar() {
  var container = document.getElementById('calendar-container');
  var year = currentDate.getFullYear();
  var month = currentDate.getMonth();
  var monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  var dayLabels = ['日','月','火','水','木','金','土'];
  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var today = new Date();

  var html = '<div class="cal-header">' +
    '<button class="cal-nav" id="cal-prev">‹</button>' +
    '<span class="cal-title">' + year + '年 ' + monthNames[month] + '</span>' +
    '<button class="cal-nav" id="cal-next">›</button>' +
    '</div><div class="cal-grid">';

  for (var i = 0; i < 7; i++) {
    var labelClass = 'cal-day-label';
    if (i === 0) labelClass += ' sun';
    if (i === 6) labelClass += ' sat';
    html += '<div class="' + labelClass + '">' + dayLabels[i] + '</div>';
  }
  for (var j = 0; j < firstDay; j++) {
    html += '<div class="cal-cell empty"></div>';
  }
  for (var day = 1; day <= daysInMonth; day++) {
    var isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    var dayOfWeek = (firstDay + day - 1) % 7;
    var hasEvent = eventDays.has(day);
    var classes = 'cal-cell' + (enableEventAdd ? ' cal-clickable' : '');
    if (isToday) classes += ' today';
    if (dayOfWeek === 0) classes += ' sun';
    if (dayOfWeek === 6) classes += ' sat';
    html += '<div class="' + classes + '" data-day="' + day + '" data-year="' + year + '" data-month="' + month + '">' +
      '<span class="cal-date">' + day + '</span>' +
      (hasEvent ? '<span class="cal-dot"></span>' : '') +
      '</div>';
  }
  html += '</div>';
  container.innerHTML = html;

  document.getElementById('cal-prev').addEventListener('click', function() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    updateCalendarDots(currentDate);
    renderCalendar();
    if (filterMode === 'month') renderFilteredEvents();
  });
  document.getElementById('cal-next').addEventListener('click', function() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    updateCalendarDots(currentDate);
    renderCalendar();
    if (filterMode === 'month') renderFilteredEvents();
  });
  // v1.3: 日付セルクリックで予定追加モーダル
  container.querySelectorAll('.cal-clickable').forEach(function(cell) {
    cell.addEventListener('click', function() {
      var y = parseInt(this.getAttribute('data-year'));
      var m = parseInt(this.getAttribute('data-month'));
      var d = parseInt(this.getAttribute('data-day'));
      openEventModal(y, m, d);
    });
  });
}

// ===== v1.3: 予定追加モーダル =====
function openEventModal(year, month, day) {
  var overlay = document.getElementById('event-modal-overlay');
  var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  document.getElementById('event-date-input').value = dateStr;
  document.getElementById('event-title-input').value = '';
  document.getElementById('event-start-input').value = '09:00';
  document.getElementById('event-end-input').value = '10:00';
  document.getElementById('event-allday-input').checked = false;
  toggleTimeInputs(false);
  overlay.classList.add('show');
  document.getElementById('event-title-input').focus();
}

function toggleTimeInputs(allDay) {
  var s = document.getElementById('event-start-input');
  var e = document.getElementById('event-end-input');
  s.disabled = allDay; e.disabled = allDay;
  s.style.opacity = allDay ? '0.3' : '1';
  e.style.opacity = allDay ? '0.3' : '1';
}

function initEventModal() {
  var overlay = document.getElementById('event-modal-overlay');
  if (!overlay) return;
  document.getElementById('event-allday-input').addEventListener('change', function() {
    toggleTimeInputs(this.checked);
  });
  document.getElementById('event-modal-cancel').addEventListener('click', function() {
    overlay.classList.remove('show');
  });
  document.getElementById('event-modal-save').addEventListener('click', function() {
    var title = document.getElementById('event-title-input').value.trim();
    if (!title) return;
    var date = document.getElementById('event-date-input').value;
    var isAllDay = document.getElementById('event-allday-input').checked;
    var startTime = document.getElementById('event-start-input').value;
    var endTime = document.getElementById('event-end-input').value;
    // Googleカレンダー作成画面を開く
    var gcalUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
    gcalUrl += '&text=' + encodeURIComponent(title);
    if (isAllDay) {
      var d = date.replace(/-/g, '');
      var nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      var nd = nextDay.toISOString().slice(0, 10).replace(/-/g, '');
      gcalUrl += '&dates=' + d + '/' + nd;
    } else {
      var s = date.replace(/-/g, '') + 'T' + startTime.replace(':', '') + '00';
      var e = date.replace(/-/g, '') + 'T' + endTime.replace(':', '') + '00';
      gcalUrl += '&dates=' + s + '/' + e;
    }
    window.open(gcalUrl, '_blank');
    overlay.classList.remove('show');
  });
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.classList.remove('show');
  });
}

// ===== フィルタモードに応じた予定リスト描画 =====
function renderFilteredEvents() {
  var filtered;
  if (filterMode === 'week') { filtered = filterWeekEvents(allEvents); }
  else if (filterMode === 'day') { filtered = filterDayEvents(allEvents); }
  else { filtered = filterMonthEvents(allEvents, currentDate); }
  renderICalEventsList(filtered);
}
function filterWeekEvents(events) {
  var now = new Date();
  var weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
  var weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);
  return events.filter(function(ev) { return ev.start >= weekStart && ev.start < weekEnd; });
}
function filterDayEvents(events) {
  var now = new Date();
  var dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
  return events.filter(function(ev) { return ev.start >= dayStart && ev.start < dayEnd; });
}

// ===== iCal テキストパーサー =====
function parseICalEvents(text) {
  var events = [];
  var blocks = text.split('BEGIN:VEVENT');
  for (var i = 1; i < blocks.length; i++) {
    var block = blocks[i].split('END:VEVENT')[0];
    var summary = '', dtstart = null, dtend = null, isAllDay = false, rrule = null, exdates = [], meetingUrl = null;
    var lines = unfoldLines(block.split(/\r?\n/));
    for (var j = 0; j < lines.length; j++) {
      var line = lines[j];
      if (line.indexOf('SUMMARY:') === 0) summary = line.substring(8);
      else if (line.indexOf('DTSTART') === 0) { dtstart = parseICalDate(line); isAllDay = line.indexOf('VALUE=DATE:') !== -1; }
      else if (line.indexOf('DTEND') === 0) dtend = parseICalDate(line);
      else if (line.indexOf('RRULE:') === 0) rrule = line.substring(6);
      else if (line.indexOf('EXDATE') === 0) {
        var exVal = line.replace(/^EXDATE[^:]*:/, '');
        exVal.split(',').forEach(function(d) { var p = parseICalDateValue(d.trim()); if (p) exdates.push(p.toDateString()); });
      }
    }
    meetingUrl = extractMeetingUrl(block);
    if (dtstart) {
      if (rrule) { events = events.concat(expandRRule(rrule, dtstart, dtend, isAllDay, summary, meetingUrl, exdates)); }
      else { events.push({ summary: summary || '(無題)', start: dtstart, end: dtend, isAllDay: isAllDay, meetingUrl: meetingUrl }); }
    }
  }
  events.sort(function(a, b) { return a.start - b.start; });
  return events;
}
function unfoldLines(lines) {
  var result = [];
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].charAt(0) === ' ' || lines[i].charAt(0) === '\t') { if (result.length > 0) result[result.length - 1] += lines[i].substring(1); }
    else result.push(lines[i]);
  }
  return result;
}
function parseICalDate(line) { return parseICalDateValue(line.replace(/^[^:]*:/, '')); }
function parseICalDateValue(value) {
  var m = value.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?/);
  if (!m) return null;
  var yr = parseInt(m[1]), mo = parseInt(m[2]) - 1, dy = parseInt(m[3]);
  if (m[4]) { var h = parseInt(m[4]), mn = parseInt(m[5]), sc = parseInt(m[6]); if (m[7]) return new Date(Date.UTC(yr, mo, dy, h, mn, sc)); return new Date(yr, mo, dy, h, mn, sc); }
  return new Date(yr, mo, dy);
}

// ===== RRULE 展開 =====
function expandRRule(rrule, dtstart, dtend, isAllDay, summary, meetingUrl, exdates) {
  var events = [], params = {};
  rrule.split(';').forEach(function(part) { var kv = part.split('='); if (kv.length === 2) params[kv[0]] = kv[1]; });
  var freq = params.FREQ, count = params.COUNT ? parseInt(params.COUNT) : null;
  var until = params.UNTIL ? parseICalDateValue(params.UNTIL) : null;
  var interval = params.INTERVAL ? parseInt(params.INTERVAL) : 1;
  var byDay = params.BYDAY ? params.BYDAY.split(',') : null;
  var duration = (dtend && dtstart) ? dtend.getTime() - dtstart.getTime() : 0;
  var maxOcc = count || 365;
  var dayMap = { SU:0, MO:1, TU:2, WE:3, TH:4, FR:5, SA:6 };
  var current = new Date(dtstart), added = 0;
  for (var iter = 0; iter < maxOcc * 7 && added < maxOcc; iter++) {
    if (until && current > until) break;
    var shouldAdd = true;
    if (freq === 'WEEKLY' && byDay) {
      shouldAdd = byDay.indexOf(Object.keys(dayMap).find(function(k) { return dayMap[k] === current.getDay(); })) !== -1;
    }
    if (shouldAdd && exdates.indexOf(current.toDateString()) === -1) {
      var evEnd = duration ? new Date(current.getTime() + duration) : null;
      events.push({ summary: summary || '(無題)', start: new Date(current), end: evEnd, isAllDay: isAllDay, meetingUrl: meetingUrl });
      added++;
    }
    if (freq === 'DAILY') current.setDate(current.getDate() + interval);
    else if (freq === 'WEEKLY') { if (byDay) current.setDate(current.getDate() + 1); else current.setDate(current.getDate() + 7 * interval); }
    else if (freq === 'MONTHLY') current.setMonth(current.getMonth() + interval);
    else if (freq === 'YEARLY') current.setFullYear(current.getFullYear() + interval);
    else break;
  }
  return events;
}

// ===== 会議URL抽出 =====
var MEETING_URL_RE = /https?:\/\/(?:meet\.google\.com\/[a-z\-]+|zoom\.us\/j\/\d+|teams\.microsoft\.com\/l\/meetup-join\/[^\s"<]+)/gi;
function extractMeetingUrl(vevent) {
  var xgc = vevent.match(/X-GOOGLE-CONFERENCE:(.*)/i);
  if (xgc && xgc[1].trim()) return xgc[1].trim();
  var loc = vevent.match(/LOCATION:(.*)/i);
  if (loc) { var m = loc[1].match(MEETING_URL_RE); if (m) return m[0]; }
  var desc = vevent.match(/DESCRIPTION:([\s\S]*?)(?=\r?\n[A-Z])/i);
  if (desc) { var m2 = desc[1].replace(/\\n/g, '\n').match(MEETING_URL_RE); if (m2) return m2[0]; }
  return null;
}

function filterMonthEvents(events, targetDate) {
  var year = targetDate.getFullYear(), month = targetDate.getMonth();
  return events.filter(function(ev) { return ev.start.getFullYear() === year && ev.start.getMonth() === month; });
}
function updateCalendarDots(targetDate) {
  var monthEvents = filterMonthEvents(allEvents, targetDate);
  eventDays.clear();
  monthEvents.forEach(function(ev) { eventDays.add(ev.start.getDate()); });
}

// ===== 予定リスト描画（v1.3: カラードット + ソースバッジ） =====
function renderICalEventsList(items) {
  var container = document.getElementById('events-container');
  if (!items || items.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);">予定はありません</p>';
    return;
  }
  var groups = {}, dayNames = ['日','月','火','水','木','金','土'];
  items.forEach(function(ev) {
    var d = ev.start;
    var groupKey = (d.getMonth()+1) + '/' + d.getDate() + '（' + dayNames[d.getDay()] + '）';
    if (!groups[groupKey]) groups[groupKey] = [];
    var timeStr = ev.isAllDay ? '終日'
      : ev.start.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}) + (ev.end ? ' \u2013 ' + ev.end.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}) : '');
    groups[groupKey].push({ time:timeStr, title:ev.summary, meetingUrl:ev.meetingUrl, start:ev.start, end:ev.end, calendarColor:ev.calendarColor||null, source:ev.source||'ical' });
  });
  var html = '';
  Object.keys(groups).forEach(function(groupLabel) {
    html += '<div class="event-group"><div class="event-date-header">' + groupLabel + '</div>';
    groups[groupLabel].forEach(function(item) {
      var dot = item.calendarColor ? '<span class="event-cal-dot" style="background:' + escapeAttr(item.calendarColor) + '"></span>' : '';
      var sourceBadge = item.source === 'ical' ? ' 📅' : '';
      html += '<div class="event-item">' + dot +
        '<span class="event-time">' + escapeAttr(item.time) + '</span>' +
        '<span class="event-title">' + escapeAttr(item.title) + sourceBadge + '</span>';
      if (item.meetingUrl && item.end) {
        html += '<a class="meeting-join-btn inactive" href="' + escapeAttr(item.meetingUrl) + '" target="_blank" rel="noopener" data-start="' + item.start.toISOString() + '" data-end="' + item.end.toISOString() + '"><span class="meeting-btn-icon">▶</span>参加</a>';
      }
      html += '</div>';
    });
    html += '</div>';
  });
  container.innerHTML = html;
  updateMeetingButtons();
}

function updateMeetingButtons() {
  var now = new Date();
  document.querySelectorAll('.meeting-join-btn').forEach(function(btn) {
    var start = new Date(btn.getAttribute('data-start'));
    var end = new Date(btn.getAttribute('data-end'));
    var fiveMinBefore = new Date(start.getTime() - 5 * 60000);
    if (now >= fiveMinBefore && now <= end) { btn.classList.add('active'); btn.classList.remove('inactive'); }
    else { btn.classList.remove('active'); btn.classList.add('inactive'); }
  });
}
	