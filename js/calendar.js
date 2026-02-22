// ===== カスタム月カレンダー + 今月の予定リスト =====
// iCal URL から VEVENT を取得してカレンダードット＋予定リストを描画

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

  // 前月・次月ナビゲーション（ドットのみ更新、予定リストは非連動）
  document.getElementById('cal-prev').addEventListener('click', function() {
    currentDate.setMonth(currentDate.getMonth() - 1);
    updateCalendarDots(currentDate);
    renderCalendar();
  });

  document.getElementById('cal-next').addEventListener('click', function() {
    currentDate.setMonth(currentDate.getMonth() + 1);
    updateCalendarDots(currentDate);
    renderCalendar();
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
  var events = [];
  var blocks = text.split('BEGIN:VEVENT');
  for (var i = 1; i < blocks.length; i++) {
    var block = blocks[i].split('END:VEVENT')[0];
    var summary = '';
    var dtstart = null;
    var isAllDay = false;
    var lines = block.split(/\r?\n/);
    for (var j = 0; j < lines.length; j++) {
      var line = lines[j];
      if (line.indexOf('SUMMARY:') === 0) {
        summary = line.substring(8);
      } else if (line.indexOf('DTSTART') === 0) {
        dtstart = parseICalDate(line);
        isAllDay = line.indexOf('VALUE=DATE:') !== -1;
      }
    }
    if (dtstart) {
      events.push({ summary: summary || '(無題)', start: dtstart, isAllDay: isAllDay });
    }
  }
  events.sort(function(a, b) { return a.start - b.start; });
  return events;
}
function parseICalDate(line) {
  var m = line.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
  if (!m) return null;
  if (m[4]) {
    return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]),
                    parseInt(m[4]), parseInt(m[5]), parseInt(m[6]));
  }
  return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
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
    container.innerHTML = '<p style="color:#888;">今月の予定はありません 🎉</p>';
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