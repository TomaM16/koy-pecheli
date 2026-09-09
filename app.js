/* „Кой печели" — начална страница и маршрутизация.
 *
 * Началната показва ЕДНО число и десет карти. Всичко останало — таблиците,
 * речникът, източниците — е в свити секции. Таблица от 151 реда с осем
 * колони не казва на никого откъде да започне.
 *
 * Детайлните страници са в detail.js и се отварят през хеша.
 */
import { nf, pari, pct, esc } from './util.js';
import { renderDetail } from './detail.js';

const [META, DVOYKI, VAZL, IZPL, POKRITIE] = await Promise.all(
  ['meta', 'dvoyki', 'vazlojiteli', 'izpalniteli', 'pokritie']
    .map((n) => fetch(`data/${n}.json`)
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)));
const DATA = { META, DVOYKI, VAZL, IZPL, POKRITIE };

const $ = (s) => document.querySelector(s);

let theme = localStorage.getItem('theme')
  || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = theme;
$('#themebtn').onclick = () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', theme);
  document.documentElement.dataset.theme = theme;
};

/* ------------------------------------------------------- начална ------- */

/* Началната казва ЕДНО нещо. Петте водещи числа отгоре и трите колони
 * обяснение бяха повече, отколкото читателят поема наведнъж — останалото е
 * прибрано в разгъващи се секции. */
function renderHero() {
  $('#bignum').textContent = `${nf(1)(META.dial_edna)}%`;
  const mlrd = (v) => nf(1)(v / 1e9);
  $('#bigsay').innerHTML = `от <b>${nf(0)(META.dogovori)}</b> договора за
    обществени поръчки са сключени, след като е подадена <b>само една
    оферта</b>. Това са <b>${mlrd(META.stoinost_edna)} от общо ${
  mlrd(META.stoinost)} милиарда лева</b>, за ${META.godini[0]}–${
  META.godini[1]} г.`;

  $('#summ').textContent = `${nf(0)(META.dvoyki_flag)} двойки · ${
    nf(0)(META.vazlojiteli)} възложителя · ${nf(0)(META.izpalniteli)} фирми`;

  if (POKRITIE && POKRITIE.izpalniteli) {
    $('#registar').innerHTML = `Собствениците идват от <b>Търговския
      регистър</b> — Агенция по вписванията, отворени данни. Регистърът се
      публикува като ДНЕВНИ ПРОМЕНИ от 2021 г. нататък, затова фирма без
      вписване оттогава не се появява: намерени са
      <b>${nf(0)(POKRITIE.v_registara)}</b> от
      ${nf(0)(POKRITIE.izpalniteli)} изпълнителя
      (<b>${nf(1)(POKRITIE.dial)}%</b>, ${nf(1)(POKRITIE.dial_pari)}% по
      стойност). Липсата на лица <b>не значи, че фирмата е чиста</b> — значи,
      че я няма в тези данни.`;
  }

  $('#obhvat').innerHTML = `Обхват: <b>${nf(0)(META.dogovori)}</b> договора за
    ${META.godini[0]}–${META.godini[1]} г. и <b>${nf(0)(META.anexi)}</b>
    анекса, от които <b>${nf(0)(META.anexi_poskapvane)}</b> вдигат стойността
    с над 20%.`;
}

/** Признаците, казани с думи. Значките и точките изискваха читателят първо
 *  да научи речника; изречението не изисква нищо. */
function zashto(p) {
  const s = [];
  if (p.dial_edna >= 80) {
    s.push(p.dial_edna >= 99 ? 'всички са с един кандидат'
      : `${nf(0)(p.dial_edna)}% са с един кандидат`);
  }
  if (p.dial_pari >= 30) {
    s.push(`взима ${nf(0)(p.dial_pari)}% от парите на възложителя`);
  }
  if (p.anexi) {
    s.push(p.anexi === 1 ? 'един договор е поскъпнал след подписа'
      : `${nf(0)(p.anexi)} договора са поскъпнали след подписа`);
  }
  if (!s.length) s.push('едни и същи две страни в много договори');
  const t = s.join(', ');
  return `${t[0].toUpperCase()}${t.slice(1)}.`;
}

/** Десетте най-тежки случая като карти — това е входната точка. */
function renderTop() {
  // Тежестта и размерът се УМНОЖАВАТ, не се подреждат едно след друго.
  // При лексикографско сравнение детска градина с пет признака и 41 хил. лв.
  // излизаше над двойка за 313 млн. — вярно по броене, безполезно за читател.
  // Логаритъмът е за да не смачка размерът признаците напълно.
  const top = [...DVOYKI].sort((a, b) => {
    const s = (x) => x.tochki * Math.log10(Math.max(x.stoinost, 1e4));
    return s(b) - s(a);
  }).slice(0, 10);

  $('#top').innerHTML = top.map((p, n) => `
    <a class="card" href="#p/${p.eik_v}/${p.eik_i}">
      <div class="n">${n + 1}</div>
      <div class="body">
        <div class="who">
          <b>${esc(p.vazlojitel)}</b>
          <span class="arrow">плаща на</span>
          <b>${esc(p.izpalnitel)}</b>
        </div>
        <div class="facts">
          <span class="big">${pari(p.stoinost)} лв.</span>
          <span>${nf(0)(p.dogovori)} договора</span>
        </div>
        <p class="why">${zashto(p)}</p>
      </div>
    </a>`).join('');
}

/* -------------------------------------------------------- таблици ------ */

const VIEWS = [
  {
    id: 'dvoyki', label: 'Двойки', rows: DVOYKI,
    lede: 'Възложител и изпълнител с поне три признака едновременно.',
    search: (r) => `${r.vazlojitel} ${r.izpalnitel}`,
    href: (r) => `#p/${r.eik_v}/${r.eik_i}`,
    cols: [
      ['vazlojitel', 'Възложител', (v) => `<b>${esc(v)}</b>`, 'l'],
      ['izpalnitel', 'Изпълнител', (v) => esc(v), 'l'],
      ['stoinost', 'Стойност', pari],
      ['dogovori', 'Договори', nf(0)],
      ['dial_edna', 'Един кандидат', (v) => pct(v, 80)],
      ['dial_pari', 'Дял от парите', (v) => pct(v, 30)],
    ],
    sort: 'stoinost',
  },
  {
    id: 'vazlojiteli', label: 'Възложители', rows: VAZL,
    lede: 'Институции с поне 20 договора. „Дял на първия“ е каква част от '
      + 'парите отиват при най-големия им доставчик.',
    search: (r) => `${r.ime} ${r.nay_golyam}`,
    href: (r) => `#v/${r.eik}`,
    cols: [
      ['ime', 'Възложител', (v) => `<b>${esc(v)}</b>`, 'l'],
      ['stoinost', 'Стойност', pari],
      ['dogovori', 'Договори', nf(0)],
      ['izpalniteli', 'Доставчици', nf(0)],
      ['nay_golyam_dial', 'Дял на първия', (v) => pct(v, 50)],
      ['dial_edna', 'Един кандидат', (v) => pct(v, 60)],
    ],
    sort: 'stoinost',
  },
  {
    id: 'izpalniteli', label: 'Изпълнители', rows: IZPL,
    lede: 'Фирми с поне 5 договора. Един възложител при голяма сума значи '
      + 'зависимост от един клиент.',
    search: (r) => r.ime,
    href: (r) => `#i/${r.eik}`,
    cols: [
      ['ime', 'Фирма', (v) => `<b>${esc(v)}</b>`, 'l'],
      ['stoinost', 'Стойност', pari],
      ['dogovori', 'Договори', nf(0)],
      ['vazlojiteli', 'Възложители', (v) => v === 1
        ? `<b class="warn">${v}</b>` : nf(0)(v)],
      ['dial_edna', 'Един кандидат', (v) => pct(v, 60)],
    ],
    sort: 'stoinost',
  },
];

let view = VIEWS[0];
let sortKey = view.sort;
let sortDir = -1;
let shown = 40;
let query = '';

function renderTabs() {
  $('#tabs').innerHTML = VIEWS.map((v) =>
    `<button role="tab" data-id="${v.id}" aria-selected="${v.id === view.id}">
       ${v.label}<em>${nf(0)(v.rows.length)}</em></button>`).join('');
  $('#tabs').querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      view = VIEWS.find((v) => v.id === b.dataset.id);
      sortKey = view.sort; sortDir = -1; shown = 40; query = '';
      $('#q').value = '';
      renderTabs(); renderTable();
    };
  });
}

function filtered() {
  const q = query.trim().toLowerCase();
  let rows = q ? view.rows.filter((r) => view.search(r).toLowerCase().includes(q))
    : view.rows;
  const k = sortKey;
  return [...rows].sort((a, b) => {
    const x = a[k], y = b[k];
    if (typeof x === 'string') return sortDir * x.localeCompare(y, 'bg');
    return sortDir * ((x ?? -Infinity) - (y ?? -Infinity));
  });
}

function renderTable() {
  const rows = filtered();
  $('#count').textContent = `${nf(0)(rows.length)} реда · ${view.lede}`;
  $('#tbl thead').innerHTML = `<tr>${view.cols.map(([k, l, , al]) =>
    `<th data-k="${k}" class="${al === 'l' ? 'l' : ''} ${
      k === sortKey ? 'on' : ''}">${l}${
      k === sortKey ? (sortDir < 0 ? ' ▾' : ' ▴') : ''}</th>`).join('')}</tr>`;
  $('#tbl thead').querySelectorAll('th').forEach((th) => {
    th.onclick = () => {
      const k = th.dataset.k;
      if (k === sortKey) sortDir = -sortDir; else { sortKey = k; sortDir = -1; }
      renderTable();
    };
  });
  $('#tbl tbody').innerHTML = rows.slice(0, shown).map((r) =>
    `<tr onclick="location.hash='${view.href(r)}'">${view.cols.map(([k, , f, al]) =>
      `<td class="${al === 'l' ? 'l' : ''}">${f(r[k])}</td>`).join('')}</tr>`)
    .join('');
  $('#more').style.display = rows.length > shown ? '' : 'none';
  $('#more').textContent = `Покажи още ${Math.min(rows.length - shown, 40)}`;
}

/* Разгъващите се секции се отварят и отвън, за да може обяснението да се
 * повика от мястото, където е нужно, без да е винаги на екрана. */
document.querySelectorAll('.lnk[data-open]').forEach((b) => {
  b.onclick = () => {
    const d = document.getElementById(b.dataset.open);
    d.open = true;
    d.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
});

$('#q').oninput = (e) => { query = e.target.value; shown = 40; renderTable(); };
$('#more').onclick = () => { shown += 40; renderTable(); };

/* ------------------------------------------------------ маршрути ------- */

async function route() {
  const h = location.hash;
  const isDetail = /^#[vip]\//.test(h);
  // Изрично 'block', не '' — елементът носи вграден style в HTML и празният
  // низ не винаги го надделява предвидимо.
  $('#home').style.display = isDetail ? 'none' : 'block';
  $('#detail').style.display = isDetail ? 'block' : 'none';
  if (isDetail) {
    await renderDetail(h, DATA);
    window.scrollTo(0, 0);
  }
}
addEventListener('hashchange', route);

renderHero(); renderTop(); renderTabs(); renderTable(); route();
