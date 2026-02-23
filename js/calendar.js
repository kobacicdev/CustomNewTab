// ===== カスタム月カレンダー + 予定リスト =====
// iCal URL から VEVENT を取得してカレンダードット＋予定リストを描画
// v1.2: ナビ連動 + RRULE繰り返し展開 + UTC時刻修正

var currentDate = new Date();
var eventDays = new Set();
var allEvents = [];

function loadCalendarEmbed() {
  renderCalendar();
  fetchICalData(true);
}


// ===== カレンダーグリッド描画 =====
function renderCalendar() {
  var container = document.getElementById('calendar-container');
  var year = currentDate.getFullYear();
  var month = currentDate.getMonth();

  var monthNames = [
    '1月', '2月', '3月', '4月', '5月', '6月',
    '7月', '8月', '9月', '10月', '11月', '12月'
  ];
  var dayLabels = ['日', '月', '火', '水', '木', '金', '土'];

  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var today = new Date();

  var html = '<div class="cal-header">' +
    '<button class="cal-nav" id="cal-prev">‹</button>' +
    '<span class="cal-title">' + year + '年 ' + monthNames[month] + '</span>' +
    '<button class="cal-nav" id="cal-next">›</button>' +
    '</div><div class="cal-grid">';

  // 曜日ラベル
  for (var i = 0; i < 7; i++) {
    var labelClass = 'cal-day-label';
    if (i === 0) labelClass += ' sun';
    if (i === 6) labelClass += ' sat';
    html += '<div class="' + labelClass + '">' + dayLabels[i] + '</div>';
  }

  // 月初の空白セル
  for (var j = 0; j < firstDay; j++) {
    html += '<div class="cal-cell empty"></div>';
  }

  // 日付セル
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

  // 前月・次月ナビゲーション（v1.2: ドット＋予定リスト＋見出し連動）
  document.getElementById('cal-prev').addEventListener('click', function() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    updateCalendarDots(currentDate);
    renderCalendar();
    var monthEvents = filterMonthEvents(allEvents, currentDate);
    renderICalEventsList(monthEvents);
  });

  document.getElementById('cal-next').addEventListener('click', function() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    updateCalendarDots(currentDate);
    renderCalendar();
    var monthEvents = filterMonthEvents(allEvents, currentDate);
    renderICalEventsList(monthEvents);
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
    if (renderList) {
      var monthEvents = filterMonthEvents(allEvents, currentDate);
      renderICalEventsList(monthEvents);
    }
  } catch (err) {
    console.error('iCal fetch error:', err);
    if (renderList) {
      document.getElementById('events-container').innerHTML =
        '<p class="loading">カレンダーに接続できませんでした。設定を確認してください。</p>';
    }
  }
}

// ===== iCal テキストパーサー =====
function parseICalEvents(text) {
  text = text.replace(/\r?\n[ \t]/g, '');
  var events = [];
  var blocks = text.split('BEGIN:VEVENT');
  for (var i = 1; i < blocks.length; i++) {
    var block = blocks[i].split('END:VEVENT')[0];
    var summary = '';
    var dtstart = null;
    var isAllDay = false;
    var rrule = null;
    var exdates = [];
    var lines = block.split(/\r?\n/);
    for (var j = 0; j < lines.length; j++) {
      var line = lines[j];
      if (line.indexOf('SUMMARY:') === 0) {
        summary = line.substring(8);
      } else if (line.indexOf('DTSTART') === 0) {
        dtstart = parseICalDate(line);
        isAllDay = line.indexOf('VALUE=DATE:') !== -1 ||
                   /:\d{8}\s*$/.test(line);
      } else if (line.indexOf('RRULE:') === 0) {
        rrule = parseRRule(line.substring(6));
      } else if (line.indexOf('EXDATE') === 0) {
        var exVal = line.substring(line.indexOf(':') + 1);
        if (exVal) {
          exVal.split(',').forEach(function(v) {
            var ed = parseICalDate('DT:' + v.trim());
            if (ed) exdates.push(toDateKey(ed));
          });
        }
      }
    }
    if (dtstart) {
      events.push({ summary: summary || '(無題)', start: dtstart, isAllDay: isAllDay, rrule: rrule, exdates: exdates });
    }
  }
  var expanded = expandRecurringEvents(events);
  expanded.sort(function(a, b) { return a.start - b.start; });
  return expanded;
}

function parseICalDate(line) {
  var isUTC = /Z\s*$/.test(line);
  var m = line.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
  if (!m) return null;
  var y = parseInt(m[1]), mo = parseInt(m[2]) - 1, d = parseInt(m[3]);
  if (m[4]) {
    var h = parseInt(m[4]), mi = parseInt(m[5]), s = parseInt(m[6]);
    return isUTC ? new Date(Date.UTC(y, mo, d, h, mi, s)) : new Date(y, mo, d, h, mi, s);
  }
  return new Date(y, mo, d);
}

// ===== 日付キー（EXDATE比較用） =====
function toDateKey(d) {
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
// ===== RRULE パーサー =====
function parseRRule(str) {
  var rule = {};
  var parts = str.split(';');
  for (var i = 0; i < parts.length; i++) {
    var kv = parts[i].split('=');
    if (kv[0] === 'FREQ') rule.freq = kv[1];
    else if (kv[0] === 'COUNT') rule.count = parseInt(kv[1]);
    else if (kv[0] === 'UNTIL') rule.until = parseICalDate('DT:' + kv[1]);
    else if (kv[0] === 'INTERVAL') rule.interval = parseInt(kv[1]);
    else if (kv[0] === 'BYDAY') rule.byday = kv[1].split(',');
  }
  if (!rule.interval) rule.interval = 1;
  return rule;
}
// ===== 繰り返しイベント展開 =====
function expandRecurringEvents(events) {
  var result = [];
  var now = new Date();
  var rangeStart = new Date(now.getFullYear() - 1, 0, 1);
  var rangeEnd = new Date(now.getFullYear() + 1, 11, 31);
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    if (!ev.rrule) {
      result.push({ summary: ev.summary, start: ev.start, isAllDay: ev.isAllDay });
      continue;
    }
    var occs = generateOccurrences(ev, rangeStart, rangeEnd);
    for (var j = 0; j < occs.length; j++) {
      result.push({ summary: ev.summary, start: occs[j], isAllDay: ev.isAllDay });
    }
  }
  return result;
}
function generateOccurrences(ev, rangeStart, rangeEnd) {
  var dates = [];
  var rule = ev.rrule;
  var maxOcc = rule.count || 730;
  var until = rule.until || rangeEnd;
  if (until > rangeEnd) until = rangeEnd;
  var dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  var n = 0;
  if (rule.freq === 'WEEKLY' && rule.byday) {
    var targetDays = rule.byday.map(function(d) {
      var day = d.replace(/^-?\d+/, '');
      return dayMap[day] !== undefined ? dayMap[day] : -1;
    });
    var weekStart = new Date(ev.start.getTime());
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    var h = ev.start.getHours(), mi = ev.start.getMinutes(), s = ev.start.getSeconds();
    while (n < maxOcc && weekStart <= until) {
      for (var di = 0; di < 7 && n < maxOcc; di++) {
        if (targetDays.indexOf(di) === -1) continue;
        var c = new Date(weekStart.getFullYear(), weekStart.getMonth(),
                         weekStart.getDate() + di, h, mi, s);
        if (c < ev.start) continue;
        if (c > until) { n = maxOcc; break; }
        n++;
        if (c >= rangeStart && ev.exdates.indexOf(toDateKey(c)) === -1) {
          dates.push(c);
        }
      }
      weekStart.setDate(weekStart.getDate() + 7 * rule.interval);
    }
  } else {
    var d = new Date(ev.start.getTime());
    while (n < maxOcc && d <= until) {
      if (d >= rangeStart && ev.exdates.indexOf(toDateKey(d)) === -1) {
        dates.push(new Date(d.getTime()));
      }
      n++;
      switch (rule.freq) {
        case 'DAILY': d.setDate(d.getDate() + rule.interval); break;
        case 'WEEKLY': d.setDate(d.getDate() + 7 * rule.interval); break;
        case 'MONTHLY': d.setMonth(d.getMonth() + rule.interval); break;
        case 'YEARLY': d.setFullYear(d.getFullYear() + rule.interval); break;
        default: n = maxOcc;
      }
    }
  }
  return dates;
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

// ===== iCal 予定リスト描画（日付グルーピング） =====
function renderICalEventsList(items) {
  var container = document.getElementById('events-container');
  if (!items || items.length === 0) {
    container.innerHTML = '<p style="color:#888;">予定はありません 🎉</p>';
    return;
  }
  var groups = {};
  var dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  items.forEach(function(ev) {
    var dateObj = ev.start;
    var dateKey = (dateObj.getMonth() + 1) + '/' + dateObj.getDate();
    var dayName = dayNames[dateObj.getDay()];
    var groupKey = dateKey + '（' + dayName + '）';
    if (!groups[groupKey]) groups[groupKey] = [];
    var timeStr = ev.isAllDay
      ? '終日'
      : ev.start.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    groups[groupKey].push({ time: timeStr, title: ev.summary });
  });
  var html = '';
  Object.keys(groups).forEach(function(groupLabel) {
    html += '<div class="event-group">';
    html += '<div class="event-date-header">' + groupLabel + '</div>';
    groups[groupLabel].forEach(function(item) {
      html += '<div class="event-item">' +
        '<span class="event-time">' + item.time + '</span>' +
        '<span class="event-title">' + item.title + '</span>' +
        '</div>';
    });
    html += '</div>';
  });
  container.innerHTML = html;
}