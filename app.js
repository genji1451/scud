// Загружаем данные и строим дашборд

let rawData = []; // [{ Сотрудник, Дата, Первый вход, Последний выход, net_seconds, work_hours }]

document.addEventListener('DOMContentLoaded', () => {
  fetch('work_summary.json')
    .then(r => r.json())
    .then(data => {
      rawData = data;
      initControls();
      updateView();
    })
    .catch(err => {
      console.error('Ошибка загрузки work_summary.json:', err);
      alert('Не удалось загрузить данные work_summary.json. Убедитесь, что вы запустили локальный сервер (например: python -m http.server).');
    });
});

let chart;

function initControls() {
  const employeeSelect = document.getElementById('employeeSelect');
  const monthSelect = document.getElementById('monthSelect');
  const weekSelect = document.getElementById('weekSelect');
  const employees = Array.from(new Set(rawData.map(r => r['Сотрудник']))).sort();

  // Показать общее количество сотрудников
  document.getElementById('employeeCount').textContent = employees.length;

  employees.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    employeeSelect.appendChild(opt);
  });

  employeeSelect.addEventListener('change', updateView);

  // Наполнить фильтры по месяцам и неделям
  const monthKeys = Array.from(new Set(rawData.map(r => r['Дата'].slice(3)))).sort(); // ММ.ГГГГ
  monthKeys.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    monthSelect.appendChild(opt);
  });

  const weekKeys = Array.from(new Set(rawData.map(r => getYearWeek(r['Дата'])))).sort();
  weekKeys.forEach(w => {
    const opt = document.createElement('option');
    opt.value = w;
    opt.textContent = w.replace('-', ' / ');
    weekSelect.appendChild(opt);
  });

  monthSelect.addEventListener('change', updateView);
  weekSelect.addEventListener('change', updateView);
}

function updateView() {
  const employeeSelect = document.getElementById('employeeSelect');
  const monthSelect = document.getElementById('monthSelect');
  const weekSelect = document.getElementById('weekSelect');
  const selectedEmployee = employeeSelect.value;

  // фильтрация по сотруднику, месяцу и неделе
  let data = rawData;
  if (selectedEmployee !== 'ALL') {
    data = data.filter(r => r['Сотрудник'] === selectedEmployee);
  }

  const selectedMonth = monthSelect.value;
  if (selectedMonth !== 'ALL') {
    data = data.filter(r => r['Дата'].slice(3) === selectedMonth);
  }

  const selectedWeek = weekSelect.value;
  if (selectedWeek !== 'ALL') {
    data = data.filter(r => getYearWeek(r['Дата']) === selectedWeek);
  }

  // всегда группируем по дням (ДАТА)
  let grouped = groupByKey(data, r => r['Дата']);

  // пересчет чисел
  grouped = grouped.map(g => {
    const totalSeconds = g.items.reduce((sum, r) => sum + (r.net_seconds || 0), 0);
    const hours = totalSeconds / 3600;
    return {
      key: g.key,
      hours,
      items: g.items,
    };
  }).sort((a, b) => a.key.localeCompare(b.key));

  renderSummary(grouped, data);
  renderTable(grouped, selectedEmployee, data);
  renderBreaks(data, selectedEmployee);
  renderChart(grouped);
}

function groupByKey(data, keyFn) {
  const map = new Map();
  data.forEach(r => {
    const key = keyFn(r);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  });
  return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
}

// преобразование ДД.ММ.ГГГГ -> ГГГГ-Wxx
function getYearWeek(dateStr) {
  const [d, m, y] = dateStr.split('.').map(Number);
  const dt = new Date(y, m - 1, d);
  const onejan = new Date(dt.getFullYear(), 0, 1);
  const week = Math.ceil((((dt - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return `${y}-W${String(week).padStart(2, '0')}`;
}

function renderSummary(grouped, filteredData) {
  const totalHours = grouped.reduce((sum, g) => sum + g.hours, 0);
  const avgPerDay = grouped.length ? totalHours / grouped.length : 0;
  const maxPerDay = grouped.reduce((max, g) => Math.max(max, g.hours), 0);

  document.getElementById('totalHours').textContent = formatHours(totalHours);
  document.getElementById('avgPerDay').textContent = formatHours(avgPerDay);
  document.getElementById('maxPerDay').textContent = formatHours(maxPerDay);

  // Количество рабочих периодов (дней/недель/месяцев)
  document.getElementById('workDaysCount').textContent = grouped.length;

  // Расчет времени работы минус обед и минус перекуры
  let totalNetHours = 0;
  let totalMinusLunchHours = 0;
  let totalMinusSmokeHours = 0;
  
  if (filteredData && filteredData.length > 0) {
    totalNetHours = filteredData.reduce((sum, r) => sum + (r.net_seconds || 0), 0) / 3600;
    totalMinusLunchHours = filteredData.reduce((sum, r) => sum + (r.net_minus_lunch_seconds || 0), 0) / 3600;
    totalMinusSmokeHours = filteredData.reduce((sum, r) => sum + (r.net_minus_smoke_seconds || 0), 0) / 3600;
  }

  document.getElementById('netWorkHours').textContent = formatHours(totalNetHours);
  document.getElementById('workMinusLunch').textContent = formatHours(totalMinusLunchHours);
  document.getElementById('workMinusSmoke').textContent = formatHours(totalMinusSmokeHours);

  // Лидер по часам в текущем фильтре
  let topName = '—';
  let topHours = 0;
  if (filteredData && filteredData.length > 0) {
    const byEmployee = groupByKey(filteredData, r => r['Сотрудник']).map(g => {
      const totalSec = g.items.reduce((sum, r) => sum + (r.net_seconds || 0), 0);
      return { name: g.key, hours: totalSec / 3600 };
    });
    byEmployee.sort((a, b) => b.hours - a.hours);
    if (byEmployee[0] && byEmployee[0].hours > 0) {
      topName = `${byEmployee[0].name} (${formatHours(byEmployee[0].hours)})`;
    }
  }
  document.getElementById('topEmployee').textContent = topName;
}

function renderTable(grouped, selectedEmployee, filteredData) {
  const tbody = document.querySelector('#dataTable tbody');
  tbody.innerHTML = '';

  grouped.forEach(g => {
    const tr = document.createElement('tr');
    const tdEmp = document.createElement('td');
    const tdKey = document.createElement('td');
    const tdIn = document.createElement('td');
    const tdOut = document.createElement('td');
    const tdNetHours = document.createElement('td');
    const tdMinusLunch = document.createElement('td');
    const tdMinusSmoke = document.createElement('td');
    const tdBreaks = document.createElement('td');

    tdEmp.textContent = selectedEmployee === 'ALL' ? 'Все сотрудники' : selectedEmployee;
    tdKey.textContent = g.key;

    let firstIn = '-';
    let lastOut = '-';
    let breaksText = '-';
    let netHours = g.hours;
    let minusLunchHours = 0;
    let minusSmokeHours = 0;
    
    if (selectedEmployee !== 'ALL' && g.items.length > 0) {
      // Для одного сотрудника и дневного просмотра у нас ровно одна запись на день
      const item = g.items[0];
      firstIn = item['Первый вход'] || '-';
      lastOut = item['Последний выход'] || '-';
      
      // Получаем время работы минус обед и минус перекуры
      netHours = (item['net_seconds'] || 0) / 3600;
      minusLunchHours = (item['net_minus_lunch_seconds'] || 0) / 3600;
      minusSmokeHours = (item['net_minus_smoke_seconds'] || 0) / 3600;
      
      // Формируем текст о перерывах
      const breaks = item['breaks'] || [];
      if (breaks.length > 0) {
        const breaksList = breaks.map(b => {
          const icon = b['Тип'] === 'Обед' ? '🍽️' : '🚬';
          return `${icon} ${b['Время выхода']}-${b['Время возвращения']}`;
        });
        breaksText = breaksList.join(', ');
      }
    } else {
      // Для "Все сотрудники" суммируем значения
      const totalNetSec = g.items.reduce((sum, r) => sum + (r.net_seconds || 0), 0);
      const totalMinusLunchSec = g.items.reduce((sum, r) => sum + (r.net_minus_lunch_seconds || 0), 0);
      const totalMinusSmokeSec = g.items.reduce((sum, r) => sum + (r.net_minus_smoke_seconds || 0), 0);
      netHours = totalNetSec / 3600;
      minusLunchHours = totalMinusLunchSec / 3600;
      minusSmokeHours = totalMinusSmokeSec / 3600;
    }

    tdIn.textContent = firstIn;
    tdOut.textContent = lastOut;
    tdNetHours.textContent = formatHours(netHours);
    tdMinusLunch.textContent = formatHours(minusLunchHours);
    tdMinusSmoke.textContent = formatHours(minusSmokeHours);
    tdBreaks.textContent = breaksText;
    tdBreaks.style.fontSize = '12px';

    tr.appendChild(tdEmp);
    tr.appendChild(tdKey);
    tr.appendChild(tdIn);
    tr.appendChild(tdOut);
    tr.appendChild(tdNetHours);
    tr.appendChild(tdMinusLunch);
    tr.appendChild(tdMinusSmoke);
    tr.appendChild(tdBreaks);
    tbody.appendChild(tr);
  });
}

function renderBreaks(filteredData, selectedEmployee) {
  const breaksSection = document.getElementById('breaksSection');
  const breaksTbody = document.querySelector('#breaksTable tbody');
  breaksTbody.innerHTML = '';

  if (selectedEmployee === 'ALL') {
    breaksSection.style.display = 'none';
    return;
  }

  // Собираем все перерывы из отфильтрованных данных
  const allBreaks = [];
  filteredData.forEach(item => {
    const breaks = item['breaks'] || [];
    breaks.forEach(b => {
      allBreaks.push({
        'Сотрудник': item['Сотрудник'],
        'Дата': item['Дата'],
        'Тип': b['Тип'],
        'Время выхода': b['Время выхода'],
        'Время возвращения': b['Время возвращения'],
        'Длительность_сек': b['Длительность_сек']
      });
    });
  });

  if (allBreaks.length === 0) {
    breaksSection.style.display = 'none';
    return;
  }

  breaksSection.style.display = 'block';

  allBreaks.forEach(b => {
    const tr = document.createElement('tr');
    const tdEmp = document.createElement('td');
    const tdDate = document.createElement('td');
    const tdType = document.createElement('td');
    const tdOut = document.createElement('td');
    const tdIn = document.createElement('td');
    const tdDur = document.createElement('td');

    tdEmp.textContent = b['Сотрудник'];
    tdDate.textContent = b['Дата'];
    
    const icon = b['Тип'] === 'Обед' ? '🍽️' : '🚬';
    tdType.innerHTML = `<span class="break-type ${b['Тип'] === 'Обед' ? 'lunch' : 'smoke'}">${icon} ${b['Тип']}</span>`;
    
    tdOut.textContent = b['Время выхода'];
    tdIn.textContent = b['Время возвращения'];
    tdDur.textContent = formatDuration(b['Длительность_сек']);

    tr.appendChild(tdEmp);
    tr.appendChild(tdDate);
    tr.appendChild(tdType);
    tr.appendChild(tdOut);
    tr.appendChild(tdIn);
    tr.appendChild(tdDur);
    breaksTbody.appendChild(tr);
  });
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  }
  return `${minutes}м`;
}

function renderChart(grouped) {
  const ctx = document.getElementById('workChart').getContext('2d');
  const labels = grouped.map(g => g.key);
  const values = grouped.map(g => g.hours);

  const title = 'Часы работы по дням';
  document.getElementById('chartTitle').textContent = title;

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Часы работы',
        data: values,
        backgroundColor: '#3b82f6',
      }],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Часы' },
        },
      },
    },
  });
}

function formatHours(h) {
  const totalMinutes = Math.round(h * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0 && minutes === 0) return '0 ч';
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} м`;
}

