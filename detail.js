/* Детайлни страници.
 *
 * Маршрутизация през хеша, за да остане сайтът статичен:
 *   #v/<ЕИК>            възложител
 *   #i/<ЕИК>            изпълнител
 *   #p/<ЕИКв>/<ЕИКи>    двойка
 *
 * Договорите се зареждат МЪРЗЕЛИВО и на части — по последна цифра на ЕИК,
 * ~2 MB вместо 35. Затова има отделни части „v0..v9" и „i0..i9".
 */
import { nf, pari, pct, esc } from './util.js';

const cache = new Map();

async function shard(kind, eik) {
  const key = `${kind}${eik.slice(-1)}`;
  if (!cache.has(key)) {
    cache.set(key, fetch(`data/dogovori/${key}.json`).then((r) => r.json()));
  }
  return cache.get(key);
}

let ANEXI = null;
async function anexi() {
  if (!ANEXI) ANEXI = await fetch('data/anexi.json').then((r) => r.json());
  return ANEXI;
}

/* ---------------------------------------------------------- находки ---- */

/** Подредени от най-съмнително към по-малко. Всяка носи защо е там. */
function findings(ctx) {
  const f = [];
  const add = (t, tejest, txt, why) => f.push({ t, tejest, txt, why });

  if (ctx.type === 'v') {
    const { row, pairs, dog } = ctx;
    if (row.nay_golyam_dial >= 50) {
      add('концентрация', row.nay_golyam_dial,
        `${nf(0)(row.nay_golyam_dial)}% от парите отиват при един доставчик`,
        `${row.nay_golyam}. При ${nf(0)(row.izpalniteli)} доставчика общо.`);
    }
    if (row.hhi >= 2500) {
      add('пазар', row.hhi / 100,
        `HHI ${nf(0)(row.hhi)} — силно концентриран`,
        'Под 1500 се смята за конкурентен пазар. 10 000 значи един доставчик '
        + 'взима всичко.');
    }
    if (row.dial_edna >= 60) {
      add('един кандидат', row.dial_edna,
        `${nf(0)(row.dial_edna)}% от договорите са с един кандидат`,
        `Средно за страната е 43,6%. Тук са ${
          nf(0)(dog.filter((d) => d.o === 1).length)} от ${nf(0)(dog.length)}.`);
    }
    pairs.filter((p) => p.dial_edna >= 80 && p.dogovori >= 5)
      .slice(0, 5).forEach((p) => {
        add('доставчик', 60 + p.dial_edna / 5,
          `${p.izpalnitel} — ${nf(0)(p.dogovori)} договора, ${
            nf(0)(p.dial_edna)}% с един кандидат`,
          `${pari(p.stoinost)} лв., ${nf(0)(p.dial_pari)}% от разходите.`);
      });
  }

  if (ctx.type === 'p') {
    const { row, dog, vrow } = ctx;
    const edna = dog.filter((d) => d.o === 1).length;
    if (row.dial_edna >= 60) {
      add('един кандидат', row.dial_edna,
        `${nf(0)(row.dial_edna)}% от договорите между двамата са с един кандидат`,
        `${nf(0)(edna)} от ${nf(0)(dog.length)}. Средно за страната е 43,6%.`);
    }
    if (row.dial_pari >= 20) {
      add('дял от бюджета', 50 + row.dial_pari,
        `${nf(0)(row.dial_pari)}% от разходите на възложителя отиват тук`,
        `${pari(row.stoinost)} лв. от ${pari(vrow.stoinost)} лв. общо, при ${
          nf(0)(vrow.izpalniteli)} доставчика.`);
    }
    if (row.dial_broi >= 20) {
      add('дял от броя', 40 + row.dial_broi,
        `${nf(0)(row.dial_broi)}% от всички договори на възложителя`,
        `${nf(0)(row.dogovori)} от ${nf(0)(vrow.dogovori)}.`);
    }
    if (row.dogovori >= 10) {
      add('повторяемост', 30 + row.dogovori,
        `${nf(0)(row.dogovori)} договора между едни и същи две страни`, '');
    }
    (ctx.obshti || []).slice(0, 3).forEach((o) => {
      const drugi = o.firmi.filter((f) => f.eik !== ctx.eik_i);
      const edno = o.lica.length === 1;
      add('общо лице', 90,
        `Зад този доставчик и зад ${drugi.map((f) => f.ime).join(', ')} `
        + `сто${edno ? 'и едно и също лице' : 'ят едни и същи лица'}`,
        `${o.lica.join(', ')} — по вписвания в Търговския регистър. И двете `
        + 'фирми се явяват пред един и същ възложител.');
    });
    if (vrow.hhi >= 2500) {
      add('пазар', vrow.hhi / 200,
        `Пазарът на възложителя е концентриран — HHI ${nf(0)(vrow.hhi)}`,
        'Под 1500 се смята за конкурентен. 10 000 значи един доставчик '
        + 'взима всичко.');
    }
  }

  if (ctx.type === 'i') {
    const { row, pairs } = ctx;
    if (row.vazlojiteli === 1 && row.dogovori >= 5) {
      add('зависимост', 95,
        'Работи само с един възложител',
        `${nf(0)(row.dogovori)} договора, ${pari(row.stoinost)} лв., всички от `
        + 'едно място.');
    }
    if (row.dial_edna >= 70) {
      add('един кандидат', row.dial_edna,
        `${nf(0)(row.dial_edna)}% от договорите са спечелени без конкуренция`,
        `Средно за страната е 43,6%.`);
    }
    pairs.filter((p) => p.dial_pari >= 25).slice(0, 5).forEach((p) => {
      add('дял', 50 + p.dial_pari,
        `Взима ${nf(0)(p.dial_pari)}% от разходите на ${p.vazlojitel}`,
        `${nf(0)(p.dogovori)} договора за ${pari(p.stoinost)} лв.`);
    });
  }

  // Поскъпванията НЕ влизат тук — те имат собствен блок с ленти отдолу.
  // Дублирането им беше главната причина страницата да се чете тежко.
  return f.sort((x, y) => y.tejest - x.tejest);
}

function findingsHtml(f) {
  if (!f.length) {
    return '<p class="none">Няма отчетени признаци по критериите на сайта.</p>';
  }
  return `<ol class="finds">${f.map((x) => `
    <li>
      <span class="tag">${x.t}</span>
      <div><b>${x.txt}</b><em>${x.why}</em></div>
    </li>`).join('')}</ol>`;
}

/* --------------------------------------------------- преди и след ------ */

function beforeAfter(list) {
  const top = list.filter((a) => a.r >= 20).sort((a, b) => b.b - a.b).slice(0, 8);
  if (!top.length) return '';
  const max = Math.max(...top.map((a) => a.b));
  return `<section class="block">
    <h3>Договори, които са поскъпнали</h3>
    <p class="hint">Сива лента — цената при подписа. Червена — цената след
      измененията.</p>
    <div class="ba">${top.map((a) => `
      <div class="row">
        <div class="lbl">${a.n ? esc(a.n) : '—'}</div>
        <div class="bars">
          <div class="bar before" style="--w:${a.a / max * 100}%">
            <span>${pari(a.a)}</span></div>
          <div class="bar after" style="--w:${a.b / max * 100}%">
            <span>${pari(a.b)}</span></div>
        </div>
        <div class="delta">+${nf(0)(a.r)}%</div>
      </div>`).join('')}</div>
  </section>`;
}

/* ------------------------------------------------------- свързаност ---- */

function connections(ctx) {
  const { type, pairs } = ctx;
  const isV = type === 'v';
  const rows = pairs.slice(0, 25);
  const other = isV ? 'izpalnitel' : 'vazlojitel';
  const link = isV ? 'i' : 'v';
  const eik = isV ? 'eik_i' : 'eik_v';
  return `<section class="block">
    <h3>${isV ? 'Доставчици' : 'Възложители'}</h3>
    <p class="hint">${isV
    ? 'Кой получава парите на тази институция.'
    : 'Кой плаща на тази фирма.'}</p>
    <table class="mini"><thead><tr>
      <th class="l">${isV ? 'Фирма' : 'Институция'}</th>
      <th>Договори</th><th>Стойност</th><th>Дял</th><th>Един кандидат</th>
    </tr></thead><tbody>
    ${rows.map((p) => `<tr>
      <td class="l"><a href="#${link}/${p[eik]}">${esc(p[other])}</a></td>
      <td>${nf(0)(p.dogovori)}</td>
      <td>${pari(p.stoinost)}</td>
      <td>${pct(isV ? p.dial_pari : p.dial_pari, 30)}</td>
      <td>${pct(p.dial_edna, 80)}</td>
    </tr>`).join('')}</tbody></table>
  </section>`;
}

/* ---------------------------------------------------------- договори --- */

const VIDIMI = 20;

/** Договорите са хиляди. Първите двайсет се виждат, останалите се разгъват —
 *  иначе таблицата е няколко хиляди пиксела и погребва секциите под нея. */
function contracts(dog) {
  const all = [...dog].sort((a, b) => b.s - a.s);
  const tr = (d) => `<tr>
      <td>${d.g}</td>
      <td class="l">${esc(d.p || '—')}</td>
      <td>${d.o === 1 ? '<b class="warn">1</b>' : nf(0)(d.o)}</td>
      <td>${pari(d.s)}</td>
    </tr>`;
  const rest = all.length - VIDIMI;
  return `<section class="block">
    <h3>Договори <span class="mut">${nf(0)(all.length)} общо, подредени по
      стойност</span></h3>
    <table class="mini"><thead><tr>
      <th>Година</th><th class="l">Предмет</th><th>Кандидати</th><th>Стойност</th>
    </tr></thead><tbody>${all.slice(0, VIDIMI).map(tr).join('')}</tbody></table>
    ${rest > 0 ? `<details class="acc more"><summary>Още ${
    nf(0)(rest)} договора</summary><div class="accbody">
      <table class="mini"><tbody>${
  all.slice(VIDIMI).map(tr).join('')}</tbody></table></div></details>` : ''}
  </section>`;
}

/* ------------------------------------------------------ страница двойка */

/** Общият блок в дъното на всяка детайлна страница — казва честно какво
 *  липсва, вместо да мълчи за него. */
const HORA = `<section class="block people">
  <h3>Свързани хора</h3>
  <p class="hint">За тази фирма <b>няма вписани лица в наличните данни</b>.
    Търговският регистър се публикува като дневни промени и наличното започва
    от 2021 г. — фирма без вписване оттогава просто не се появява.
    <b>Това не значи, че е чиста</b>, значи че я няма тук.</p>
  <p class="hint">Проверка по конкретна фирма:
    <a href="https://portal.registryagency.bg/CR/en/Reports/VerificationPersonOrg"
       target="_blank" rel="noopener">Търговски регистър →</a></p>
</section>`;

/* ------------------------------------------------------ хора и връзки --- */

/* Лицата са нарязани по последна цифра на ЕИК, като договорите. Ако файлът
 * още го няма (конвейерът за регистъра не е пускан), всичко се държи все
 * едно фирмата няма вписани лица — сайтът не се чупи. */
const LICA = new Map();
async function licaNa(eik) {
  const d = eik.slice(-1);
  if (!LICA.has(d)) {
    LICA.set(d, fetch(`data/lica/${d}.json`)
      .then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
  }
  return (await LICA.get(d))[eik] || [];
}

let SVARZANI = null;
async function svarzani() {
  if (!SVARZANI) {
    SVARZANI = fetch('data/svarzani.json')
      .then((r) => (r.ok ? r.json() : [])).catch(() => []);
  }
  return SVARZANI;
}

/** Кой управлява и притежава една фирма. */
function horaNaFirma(lica, ime) {
  if (!lica.length) return HORA;
  return `<section class="block people">
    <h3>Кой стои зад ${esc(ime)}</h3>
    <p class="hint">По вписвания в Търговския регистър. Това е публична
      информация и сама по себе си не значи нищо — служи да се види дали едни
      и същи имена се повтарят.</p>
    <ul class="lica">${lica.map((l) => `<li>
      <b>${esc(l.ime)}</b>
      <span class="rolya">${esc(l.rolya)}${
  l.dyal ? ` · ${nf(0)(l.dyal)}% от капитала` : ''}${l.yur ? ' · юридическо лице' : ''}</span>
    </li>`).join('')}</ul>
  </section>`;
}

/** Находката, заради която изобщо се сваля регистърът: две фирми, които се
 *  конкурират за поръчките на един възложител, с общо лице зад тях. */
function obshtiLica(sluchai) {
  if (!sluchai.length) return '';
  return `<section class="block people">
    <h3>Доставчици с общо лице</h3>
    <p class="hint">Тези фирми се явяват пред една и съща институция, а зад
      тях стои едно и също лице. Понякога е нормално — холдинг с дъщерни
      дружества. Понякога значи, че „две оферти" не са били две.</p>
    ${sluchai.slice(0, 12).map((s) => `<div class="krug">
      <div class="lice">${s.lica.map(esc).join(' · ')}</div>
      <ul class="firmi">${s.firmi.map((f) => `<li>
        <a href="#i/${f.eik}">${esc(f.ime)}</a>
        <span>${pari(f.pari)} лв.</span></li>`).join('')}</ul>
    </div>`).join('')}
  </section>`;
}

/** Един ред факти вместо четири плочки. Плочка с „0%“ заема място колкото
 *  плочка с истинско число, а не казва нищо — липсващият признак се
 *  премълчава, не се показва. */
function fakti(list) {
  const f = list.filter(Boolean);
  return `<p class="fakti">${f.map(([v, k], i) => `<span${
    i ? '' : ' class="first"'}><b>${v}</b> ${k}</span>`).join('')}</p>`;
}

function pairHtml(ctx, hora) {
  const { row, vrow, irow, dog } = ctx;
  const obshto = dog.reduce((s, d) => s + (d.s || 0), 0);
  return `
    <div class="dhead">
      <a class="close" href="#">← към списъка</a>
      <span class="kind">Двойка · възложител и изпълнител</span>
      <h2 class="pairh">
        <a href="#v/${ctx.eik}">${esc(vrow.ime)}</a>
        <span class="arrow">плаща на</span>
        <a href="#i/${ctx.eik_i}">${esc(irow.ime)}</a>
      </h2>
      ${fakti([
    [pari(obshto), 'лв. общо'],
    [nf(0)(dog.length), 'договора'],
    row.dial_pari >= 5 && [`${nf(0)(row.dial_pari)}%`,
      'от парите на възложителя'],
    row.dial_edna >= 5 && [`${nf(0)(row.dial_edna)}%`, 'с един кандидат'],
  ])}
      <p class="podskaz">ЕИК ${esc(ctx.eik)} · ${esc(ctx.eik_i)}. Кликни име
        горе за пълната картина за него — всички негови партньори и договори.</p>
    </div>

    <section class="block">
      <h3>Какво изпъква</h3>
      ${findingsHtml(findings(ctx))}
    </section>

    ${beforeAfter(ctx.anexi)}
    ${hora}
    ${contracts(dog)}`;
}

/* ------------------------------------------------------------ рендер --- */

export async function renderDetail(hash, DATA) {
  const [kind, a, b] = hash.replace(/^#/, '').split('/');
  const { VAZL, IZPL, DVOYKI } = DATA;
  const el = document.getElementById('detail');

  el.innerHTML = '<p class="loading">зареждам …</p>';

  const prazenV = (eik) => ({ eik, ime: eik, dogovori: 0, stoinost: 0,
    izpalniteli: 0, dial_edna: 0, hhi: 0, nay_golyam_dial: 0, nay_golyam: '' });

  let ctx;
  if (kind === 'p') {
    const vrow = VAZL.find((x) => x.eik === a) || prazenV(a);
    const irow = IZPL.find((x) => x.eik === b) || { eik: b, ime: b };
    const dog = (await shard('v', a)).filter((d) => d.v === a && d.i === b);
    const an = (await anexi()).filter((x) => x.v === a && x.i === b);
    const row = DVOYKI.find((p) => p.eik_v === a && p.eik_i === b) || {
      dogovori: dog.length,
      stoinost: dog.reduce((s, d) => s + (d.s || 0), 0),
      dial_edna: Math.round(
        dog.filter((d) => d.o === 1).length / (dog.length || 1) * 100),
      dial_pari: 0, dial_broi: 0, tochki: 0,
    };
    const obshti = (await svarzani()).filter(
      (x) => x.v === a && x.firmi.some((f) => f.eik === b));
    ctx = { type: 'p', row, vrow, irow, dog, anexi: an, pairs: [], eik: a,
      eik_i: b, obshti };
  } else if (kind === 'v') {
    const row = VAZL.find((x) => x.eik === a) || prazenV(a);
    const dog = (await shard('v', a)).filter((d) => d.v === a);
    const an = (await anexi()).filter((x) => x.v === a);
    const pairs = DVOYKI.filter((p) => p.eik_v === a);
    ctx = { type: 'v', row, dog, anexi: an, pairs, eik: a };
  } else if (kind === 'i') {
    const row = IZPL.find((x) => x.eik === a)
      || { eik: a, ime: a, dogovori: 0, stoinost: 0, vazlojiteli: 0,
        dial_edna: 0 };
    const dog = (await shard('i', a)).filter((d) => d.i === a);
    const an = (await anexi()).filter((x) => x.i === a);
    const pairs = DVOYKI.filter((p) => p.eik_i === a);
    ctx = { type: 'i', row, dog, anexi: an, pairs, eik: a };
  } else {
    el.innerHTML = '';
    return false;
  }

  if (ctx.type === 'p') {
    el.innerHTML = pairHtml(ctx, horaNaFirma(await licaNa(b), ctx.irow.ime));
    return true;
  }

  // Двойките от dvoyki.json са само съмнителните; за пълен списък на
  // партньорите смятаме наново от самите договори.
  const other = ctx.type === 'v' ? 'i' : 'v';
  const byOther = new Map();
  for (const d of ctx.dog) {
    const k = d[other];
    const o = byOther.get(k) || { dogovori: 0, stoinost: 0, edna: 0 };
    o.dogovori += 1; o.stoinost += d.s || 0; o.edna += d.o === 1 ? 1 : 0;
    byOther.set(k, o);
  }
  const nameOf = new Map(
    (ctx.type === 'v' ? IZPL : VAZL).map((x) => [x.eik, x.ime]));
  /* АОП вписва обединенията като СЛЕПЕНИ ЕИК-ове в едно поле — „8122336712
     06422081103029862177431256". Такъв ключ няма име и без това показваше
     трийсет цифри в таблицата. */
  const imeto = (k) => nameOf.get(k)
    || (k && k.length > 13 ? `Обединение от няколко фирми · ${k}` : k);
  const totalMoney = ctx.dog.reduce((s, d) => s + (d.s || 0), 0) || 1;
  ctx.pairs = [...byOther.entries()].map(([k, o]) => ({
    eik_i: ctx.type === 'v' ? k : ctx.eik,
    eik_v: ctx.type === 'v' ? ctx.eik : k,
    izpalnitel: ctx.type === 'v' ? imeto(k) : ctx.row.ime,
    vazlojitel: ctx.type === 'v' ? ctx.row.ime : imeto(k),
    dogovori: o.dogovori, stoinost: o.stoinost,
    dial_pari: Math.round(o.stoinost / totalMoney * 1000) / 10,
    dial_edna: Math.round(o.edna / o.dogovori * 100),
  })).sort((x, y) => y.stoinost - x.stoinost);

  const f = findings(ctx);
  const kindLabel = ctx.type === 'v' ? 'Възложител' : 'Изпълнител';
  // При институция интересното не са нейните лица (тя не е в Търговския
  // регистър), а дали двама от доставчиците ѝ имат общо лице зад себе си.
  const hora = ctx.type === 'v'
    ? obshtiLica((await svarzani()).filter((s) => s.v === ctx.eik))
    : horaNaFirma(await licaNa(ctx.eik), ctx.row.ime);
  el.innerHTML = `
    <div class="dhead">
      <a class="close" href="#">← към списъка</a>
      <span class="kind">${kindLabel}</span>
      <h2>${esc(ctx.row.ime)}</h2>
      <div class="eik">ЕИК ${esc(ctx.eik)}</div>
      ${fakti([
    [pari(totalMoney), 'лв. общо'],
    [nf(0)(ctx.dog.length), 'договора'],
    [nf(0)(ctx.pairs.length),
      ctx.type === 'v' ? 'доставчика' : 'възложителя'],
    ctx.row.dial_edna >= 5 && [`${nf(0)(ctx.row.dial_edna)}%`,
      'с един кандидат'],
  ])}
    </div>

    <section class="block">
      <h3>Какво изпъква</h3>
      ${findingsHtml(f)}
    </section>

    ${beforeAfter(ctx.anexi)}
    ${connections(ctx)}
    ${hora}
    ${contracts(ctx.dog)}`;
  return true;
}
