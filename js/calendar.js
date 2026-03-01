// ===== カスタム月カレンダー + 予定リスト =====
// iCal URL から VEVENT を取得してカレンダードット＋予定リストを描画
// v1.2: 月連動・RRULE展開・UTC→ローカル変換・会議参加ボタン対応

var currentDate = new Date();
var eventDays = new Set();
var allEvents = [];
var filterMode = 'month';

function loadCalendarEmbed() {
  loadFilterMode(function() {
    renderFilterTabs();
    renderCalendar();
    fetchICalData(true);
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

// ===== カレンダーグリッド描画 =====
function renderCalendar() {
  var container = document.getElementById('calendar-container');
  var year = currentDate.getFullYear();
  var month = currentDate.getMonth();

  var monthNames = [
    '1月','2月','3月','4月','5月','6月',
    '7月','8月','9月','10月','11月','12月'
  ];
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
    var isToday = today.getFullYear() === year &&
                  today.getMonth() === month &&
                  today.getDate() === day;
    var dayOfWeek = (firstDay + day - 1) % 7;
    var hasEvent = eventDays.has(day);

    var classes = 'cal-cell';
    if (isToday) classes += ' today';
    if (dayOfWeek === 0) classes += ' sun';
    if (dayOfWeek === 6) classes += ' sat';

    html += '<div class="' + classes + '" data-day="' + day + '">' +
      '<span class="cal-date">' + day + '</span>' +
      (hasEvent ? '<span class="cal-dot"></span>' : '') +
      '</div>';
  }

  html += '</div>';
  container.innerHTML = html;

  // 前月・次月ナビゲーション（予定リストも連動）
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
}

// ===== iCal データ取得 =====
async function fetchICalData(renderList) {
  try {
    var result = await new Promise(function(resolve) {
      chrome.storage.sync.get('icalUrl', resolve);
    });
    var icalUrl = result.icalUrl;
    if (!icalUrl) {
      if (renderList) {
        document.getElementById('events-container').innerHTML =
          '<p class="loading">設定画面でiCal URLを登録してください。</p>';
      }
      return;
    }
    var res = await fetch(icalUrl);
    var text = await res.text();
    allEvents = parseICalEvents(text);
    updateCalendarDots(currentDate);
    renderCalendar();
    if (renderList) renderFilteredEvents();
  } catch (err) {
    console.error('iCal fetch error:', err);
    if (renderList) {
      document.getElementById('events-container').innerHTML =
        '<p class="loading">カレンダーに接続できませんでした。設定を確認してください。</p>';
    }
  }
}

// ===== フィルタモードに応じた予定リスト描画 =====
function renderFilteredEvents() {
  var filtered;
  if (filterMode === 'week') {
    filtered = filterWeekEvents(allEvents);
  } else if (filterMode === 'day') {
    filtered = filterDayEvents(allEvents);
  } else {
    filtered = filterMonthEvents(allEvents, currentDate);
  }
  renderICalEventsList(filtered);
}
// ===== 今週の予定フィルタ =====
function filterWeekEvents(events) {
  var now = new Date();
  var dayOfWeek = now.getDay();
  var weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);
  var weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  return events.filter(function(ev) {
    return ev.start >= weekStart && ev.start < weekEnd;
  });
}
// ===== 今日の予定フィルタ =====
function filterDayEvents(events) {
  var now = new Date();
  var dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var dayEnd = new Date(dayStart);
  dayEnd.setDate(dayStart.getDate() + 1);
  return events.filter(function(ev) {
    return ev.start >= dayStart && ev.start < dayEnd;
  });
}

// ===== iCal テキストパーサー =====
function parseICalEvents(text) {
  var events = [];
  var blocks = text.split('BEGIN:VEVENT');
  for (var i = 1; i < blocks.length; i++) {
    var block = blocks[i].split('END:VEVENT')[0];
    var summary = '';
    var dtstart = null;
    var dtend = null;
    var isAllDay = false;
    var rrule = null;
    var exdates = [];
    var meetingUrl = null;
    var lines = unfoldLines(block.split(/\r?\n/));
    for (var j = 0; j < lines.length; j++) {
      var line = lines[j];
      if (line.indexOf('SUMMARY:') === 0) {
        summary = line.substring(8);
      } else if (line.indexOf('DTSTART') === 0) {
        dtstart = parseICalDate(line);
        isAllDay = line.indexOf('VALUE=DATE:') !== -1;
      } else if (line.indexOf('DTEND') === 0) {
        dtend = parseICalDate(line);
      } else if (line.indexOf('RRULE:') === 0) {
        rrule = line.substring(6);
      } else if (line.indexOf('EXDATE') === 0) {
        var exVal = line.replace(/^EXDATE[^:]*:/, '');
        exVal.split(',').forEach(function(d) {
          var parsed = parseICalDateValue(d.trim());
          if (parsed) exdates.push(parsed.toDateString());
        });
      }
    }
    meetingUrl = extractMeetingUrl(block);
    if (dtstart) {
      if (rrule) {
        var expanded = expandRRule(rrule, dtstart, dtend, isAllDay, summary, meetingUrl, exdates);
        events = events.concat(expanded);
      } else {
        events.push({
          summary: summary || '(無題)',
          start: dtstart,
          end: dtend,
          isAllDay: isAllDay,
          meetingUrl: meetingUrl
        });
      }
    }
  }
  events.sort(function(a, b) { return a.start - b.start; });
  return events;
}

// ===== 行の折り返し展開（RFC 5545） =====
function unfoldLines(lines) {
  var result = [];
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].charAt(0) === ' ' || lines[i].charAt(0) === '\t') {
      if (result.length > 0) result[result.length - 1] += lines[i].substring(1);
    } else {
      result.push(lines[i]);
    }
  }
  return result;
}

// ===== iCal 日付パーサー（UTC→ローカル変換対応） =====
function parseICalDate(line) {
  var value = line.replace(/^[^:]*:/, '');
  return parseICalDateValue(value);
}

function parseICalDateValue(value) {
  var m = value.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?/);
  if (!m) return null;
  var year = parseInt(m[1]), month = parseInt(m[2]) - 1, day = parseInt(m[3]);
  if (m[4]) {
    var h = parseInt(m[4]), min = parseInt(m[5]), sec = parseInt(m[6]);
    if (m[7]) {
      // UTC → ローカルタイムに変換
      return new Date(Date.UTC(year, month, day, h, min, sec));
    }
    return new Date(year, month, day, h, min, sec);
  }
  return new Date(year, month, day);
}

// ===== RRULE 展開 =====
function expandRRule(rrule, dtstart, dtend, isAllDay, summary, meetingUrl, exdates) {
  var events = [];
  var params = {};
  rrule.split(';').forEach(function(part) {
    var kv = part.split('=');
    if (kv.length === 2) params[kv[0]] = kv[1];
  });
  var freq = params.FREQ;
  var count = params.COUNT ? parseInt(params.COUNT) : null;
  var until = params.UNTIL ? parseICalDateValue(params.UNTIL) : null;
  var interval = params.INTERVAL ? parseInt(params.INTERVAL) : 1;
  var byDay = params.BYDAY ? params.BYDAY.split(',') : null;
  var duration = (dtend && dtstart) ? dtend.getTime() - dtstart.getTime() : 0;
  var maxOccurrences = count || 365;
  var dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  var current = new Date(dtstart);
  var added = 0;

  for (var iter = 0; iter < maxOccurrences * 7 && added < maxOccurrences; iter++) {
    if (until && current > until) break;
    var dateStr = current.toDateString();
    var shouldAdd = true;

    if (freq === 'WEEKLY' && byDay) {
      shouldAdd = byDay.indexOf(
        Object.keys(dayMap).find(function(k) { return dayMap[k] === current.getDay(); })
      ) !== -1;
    }

    if (shouldAdd && exdates.indexOf(dateStr) === -1) {
      var evEnd = duration ? new Date(current.getTime() + duration) : null;
      events.push({
        summary: summary || '(無題)',
        start: new Date(current),
        end: evEnd,
        isAllDay: isAllDay,
        meetingUrl: meetingUrl
      });
      added++;
    }

    if (freq === 'DAILY') {
      current.setDate(current.getDate() + interval);
    } else if (freq === 'WEEKLY') {
      if (byDay) {
        current.setDate(current.getDate() + 1);
      } else {
        current.setDate(current.getDate() + 7 * interval);
      }
    } else if (freq === 'MONTHLY') {
      current.setMonth(current.getMonth() + interval);
    } else if (freq === 'YEARLY') {
      current.setFullYear(current.getFullYear() + interval);
    } else {
      break;
    }
  }
  return events;
}

// ===== 会議URL抽出（iCalパーサー拡張） =====
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

// ===== 月イベントフィルタ =====
function filterMonthEvents(events, targetDate) {
  var year = targetDate.getFullYear();
  var month = targetDate.getMonth();
  return events.filter(function(ev) {
    return ev.start.getFullYear() === year && ev.start.getMonth() === month;
  });
}

// ===== カレンダードット更新 =====
function updateCalendarDots(targetDate) {
  var monthEvents = filterMonthEvents(allEvents, targetDate);
  eventDays.clear();
  monthEvents.forEach(function(ev) {
    eventDays.add(ev.start.getDate());
  });
}

// ===== 予定リスト描画（日付グルーピング + 会議参加ボタン） =====
function renderICalEventsList(items) {
  var container = document.getElementById('events-container');
  if (!items || items.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);">予定はありません</p>';
    return;
  }
  var groups = {};
  var dayNames = ['日','月','火','水','木','金','土'];
  items.forEach(function(ev) {
    var dateObj = ev.start;
    var dateKey = (dateObj.getMonth() + 1) + '/' + dateObj.getDate();
    var dayName = dayNames[dateObj.getDay()];
    var groupKey = dateKey + '（' + dayName + '）';
    if (!groups[groupKey]) groups[groupKey] = [];
    var timeStr = ev.isAllDay
      ? '終日'
      : ev.start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    groups[groupKey].push({
      time: timeStr,
      title: ev.summary,
      meetingUrl: ev.meetingUrl,
      start: ev.start,
      end: ev.end
    });
  });
  var html = '';
  Object.keys(groups).forEach(function(groupLabel) {
    html += '<div class="event-group">';
    html += '<div class="event-date-header">' + groupLabel + '</div>';
    groups[groupLabel].forEach(function(item) {
      html += '<div class="event-item">' +
        '<span class="event-time">' + escapeAttr(item.time) + '</span>' +
        '<span class="event-title">' + escapeAttr(item.title) + '</span>';
      if (item.meetingUrl && item.end) {
        html += '<a class="meeting-join-btn inactive" href="' + escapeAttr(item.meetingUrl) + '"' +
          ' target="_blank" rel="noopener"' +
          ' data-start="' + item.start.toISOString() + '"' +
          ' data-end="' + item.end.toISOString() + '"><span class="meeting-btn-icon">▶</span>参加</a>';
      }
      html += '</div>';
    });
    html += '</div>';
  });
  container.innerHTML = html;
  updateMeetingButtons();
}

// ===== 会議参加ボタン表示状態更新 =====
function updateMeetingButtons() {
  var now = new Date();
  document.querySelectorAll('.meeting-join-btn').forEach(function(btn) {
    var start = new Date(btn.getAttribute('data-start'));
    var end = new Date(btn.getAttribute('data-end'));
    var fiveMinBefore = new Date(start.getTime() - 5 * 60000);
    if (now >= fiveMinBefore && now <= end) {
      btn.classList.add('active');
      btn.classList.remove('inactive');
    } else {
      btn.classList.remove('active');
      btn.classList.add('inactive');
    }
  });
}