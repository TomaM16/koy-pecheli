/* Общи форматиращи функции. Държат се на едно място, за да изглеждат
 * числата еднакво в списъка и в детайлните страници. */

export const nf = (d = 0) => (v) => v == null || Number.isNaN(v) ? '–'
  : Number(v).toLocaleString('bg-BG',
    { minimumFractionDigits: d, maximumFractionDigits: d });

export const pari = (v) => v == null ? '–'
  : v >= 1e6
    ? `${(v / 1e6).toLocaleString('bg-BG', { maximumFractionDigits: 1 })} млн.`
    : v >= 1e3
      ? `${Math.round(v / 1e3).toLocaleString('bg-BG')} хил.`
      : Math.round(v).toLocaleString('bg-BG');

/** Процент със стълбче зад него; „горещо“ над прага. */
export const pct = (v, hot = 60) => v == null ? '–'
  : `<span class="pct" style="--w:${Math.min(v, 100)}%;--hot:${
    v >= hot ? 1 : 0}">${nf(0)(v)}%</span>`;

/** Данните идват от чужд източник и влизат в innerHTML — екранираме. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
