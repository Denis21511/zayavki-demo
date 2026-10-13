'use strict';
/* =========================================================
   Цех Заявки — демо
   Квиз для клиента → заявка в Telegram → напоминания → отчёт.
   Все данные живут в localStorage этого браузера.
   ========================================================= */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
const rub = n => Math.round(n).toLocaleString('ru-RU') + ' ₽';
const fmt1 = n => String(Math.round(n * 10) / 10).replace('.', ',');
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; };
function dur(ms) {
  if (ms < MIN) return 'меньше минуты';
  if (ms < HOUR) { const m = Math.floor(ms / MIN); return `${m} мин`; }
  if (ms < DAY) { const h = Math.floor(ms / HOUR); return `${h} ${plural(h, 'час', 'часа', 'часов')}`; }
  const d = Math.floor(ms / DAY); return `${d} ${plural(d, 'день', 'дня', 'дней')}`;
}
const ago = ms => ms < MIN ? 'только что' : dur(ms) + ' назад';
const clock = t => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dayLabel = t => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const digits = s => String(s).replace(/\D/g, '');

const LS = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим — работаем без сохранения */ } },
};

/* ---------- иконки ---------- */
const ICONS = {
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  board: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  forward: '<path d="m13 17 5-5-5-5M6 17l5-5-5-5"/>',
  gift: '<rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13M3 12h18M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
};
const icon = (n, s = 20) => `<svg class="ic ic-${n}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

/* ---------- каталог и цены (из «Цеха», средние по Челябинску) ---------- */
const TIERS = {
  eco: { label: 'Эконом', sub: 'ЛДСП', kitchen: 28000, kupe: 14000, other: [25000, 60000] },
  mid: { label: 'Стандарт', sub: 'МДФ в плёнке', kitchen: 34000, kupe: 16000, other: [40000, 90000] },
  pro: { label: 'Премиум', sub: 'МДФ эмаль, массив', kitchen: 52000, kupe: 19000, other: [70000, 150000] },
};
const WHEN = { month: 'в ближайший месяц', q: 'через 1–3 месяца', look: 'пока присматривается' };
const CHANNEL = { whatsapp: 'WhatsApp', telegram: 'Telegram', call: 'звонок' };
const OTHER_KINDS = ['Прихожая', 'Гардеробная', 'Детская', 'Шкаф в комнату', 'Мебель для ванной', 'Другое'];

function priceOf(q) {
  const T = TIERS[q.tier];
  const r = n => Math.round(n / 1000) * 1000;
  if (q.cat === 'other') return { lo: T.other[0], hi: T.other[1] };
  const base = q.cat === 'kitchen'
    ? q.size * T.kitchen + (q.layout === 'corner' ? 5000 : q.layout === 'u' ? 10000 : 0)
    : Math.max(2, Math.ceil(q.size / 0.9)) * T.kupe * (q.layout === 'niche' ? .85 : 1);
  return { lo: r(base * .9), hi: r(base * 1.15) };
}
function itemOf(q) {
  if (q.cat === 'kitchen') return `${{ line: 'Кухня прямая', corner: 'Кухня угловая', u: 'Кухня П-образная' }[q.layout]} ${fmt1(q.size)} м`;
  if (q.cat === 'kupe') return `${q.layout === 'niche' ? 'Шкаф-купе в нишу' : 'Шкаф-купе'} ${fmt1(q.size)} м`;
  return q.kind;
}
const range = p => `${rub(p.lo)} – ${rub(p.hi)}`;
const midSum = p => Math.round((p.lo + p.hi) / 2 / 1000) * 1000;

/* ---------- этапы продажи и напоминания ---------- */
const STAGES = [
  { key: 'new', label: 'Новая', col: 'Новые', sla: 15 * MIN, next: 'Позвонил, поговорили', done: 'Связались с клиентом' },
  { key: 'contact', label: 'Связались', col: 'Связались', sla: DAY, next: 'Замер назначен', done: 'Назначен замер' },
  { key: 'measure', label: 'Замер', col: 'Замер', sla: 2 * DAY, next: 'Назвал цену', done: 'Клиенту назвали цену' },
  { key: 'quote', label: 'Цена названа', col: 'Думают', sla: 2 * DAY, next: 'Подписали договор', done: 'Подписан договор' },
  { key: 'deal', label: 'Договор', col: 'Договор', sla: 0 },
];
const SI = Object.fromEntries(STAGES.map((s, i) => [s.key, { ...s, i }]));
const LOST = ['Дорого', 'Ушёл к другим', 'Передумал', 'Не отвечает'];
const LATE2 = 5 * DAY; // второе напоминание для «думают»

function alertOf(l, now) {
  if (l.lost || l.stage === 'deal') return null;
  const wait = now - l.stageAt, st = SI[l.stage];
  if (wait < st.sla) return null;
  const level = l.stage === 'quote' && wait >= LATE2 ? 2 : 1;
  const text = {
    new: `Ждёт звонка уже ${dur(wait)}. Чем дольше ждёт, тем выше шанс, что позвонит в другой цех.`,
    contact: `Поговорили ${ago(wait)}, а замер до сих пор не назначен.`,
    measure: `Замер был ${ago(wait)}. Клиент ждёт проект и цену.`,
    quote: level === 2 ? `Молчит уже ${dur(wait)}. Последняя попытка, потом отметьте результат.` : `Цену назвали ${ago(wait)}, клиент молчит. Самое время написать.`,
  }[l.stage];
  return { level, wait, text, key: `${l.id}:${l.stage}:${level}`, at: l.stageAt + (level === 2 ? LATE2 : st.sla) };
}

function templateFor(l, level = 1) {
  const co = Store.s.company === 'Ваш цех' ? 'мебельный цех' : `«${Store.s.company}»`;
  const item = itemOf(l.q).toLowerCase();
  return {
    new: `Здравствуйте, ${l.name}! Это ${co}. Получили ваш расчёт: ${item}. Удобно сейчас созвониться на пару минут? Уточню детали и скажу точнее по цене.`,
    contact: `${l.name}, добрый день! Когда вам удобно, чтобы замерщик приехал? Замер бесплатный, займёт минут 30. Могу предложить завтра или в субботу.`,
    measure: `${l.name}, добрый день! Проект по вашему заказу (${item}) почти готов, пришлю сегодня вместе с точной ценой.`,
    quote: level === 2
      ? `${l.name}, не буду надоедать, напишу один раз. Если заказ ещё актуален, закреплю цену до конца месяца. Если решили иначе, просто напишите, я пойму.`
      : `${l.name}, добрый день! Успели посмотреть проект? Если что-то смущает в цене, скажите: подберём вариант, например другие фасады или оплату частями.`,
  }[l.stage] || '';
}

/* ---------- данные ---------- */
const KEY = 'zayavki.demo.v1';

function seed(company, city) {
  const t0 = Date.now();
  const L = [
    { name: 'Ирина', phone: '+7 900 000-12-41', channel: 'whatsapp', source: 'Квиз на сайте', q: { cat: 'kitchen', layout: 'corner', size: 3.4, tier: 'mid', when: 'month' }, stage: 'new', ago: 9 * MIN },
    { name: 'Андрей', phone: '+7 900 000-37-15', channel: 'call', source: 'Авито', q: { cat: 'kupe', layout: 'box', size: 2.4, tier: 'mid', when: 'month' }, stage: 'new', ago: 47 * MIN },
    { name: 'Виктор', phone: '+7 900 000-58-02', channel: 'telegram', source: 'Квиз на сайте', q: { cat: 'kitchen', layout: 'corner', size: 3.8, tier: 'eco', when: 'q' }, stage: 'contact', ago: 5 * HOUR, inStage: 3 * HOUR, replyMin: 12 },
    { name: 'Ольга', phone: '+7 900 000-71-90', channel: 'whatsapp', source: 'Квиз на сайте', q: { cat: 'kitchen', layout: 'line', size: 2.8, tier: 'eco', when: 'month' }, stage: 'contact', ago: 2 * DAY, inStage: DAY + 3 * HOUR, replyMin: 25 },
    { name: 'Сергей', phone: '+7 900 000-24-66', channel: 'call', source: 'Телефон', q: { cat: 'kitchen', layout: 'u', size: 5.2, tier: 'pro', when: 'q' }, stage: 'measure', ago: 3 * DAY, inStage: 20 * HOUR, replyMin: 8 },
    { name: 'Елена', phone: '+7 900 000-83-17', channel: 'whatsapp', source: 'Авито', q: { cat: 'kupe', layout: 'niche', size: 1.8, tier: 'eco', when: 'month' }, stage: 'quote', ago: 4 * DAY, inStage: DAY, replyMin: 40 },
    { name: 'Наталья', phone: '+7 900 000-45-38', channel: 'whatsapp', source: 'Квиз на сайте', q: { cat: 'kitchen', layout: 'corner', size: 4.0, tier: 'mid', when: 'month' }, stage: 'quote', ago: 6 * DAY, inStage: 3 * DAY + 2 * HOUR, replyMin: 15 },
    { name: 'Дмитрий', phone: '+7 900 000-90-54', channel: 'telegram', source: 'Квиз на сайте', q: { cat: 'other', kind: 'Гардеробная', tier: 'pro', when: 'look' }, stage: 'quote', ago: 9 * DAY, inStage: 6 * DAY, replyMin: 90 },
    { name: 'Максим', phone: '+7 900 000-16-73', channel: 'call', source: 'Квиз на сайте', q: { cat: 'kitchen', layout: 'line', size: 3.0, tier: 'mid', when: 'month' }, stage: 'deal', ago: 7 * DAY, inStage: 2 * DAY, replyMin: 10 },
    { name: 'Татьяна', phone: '+7 900 000-62-29', channel: 'whatsapp', source: 'Авито', q: { cat: 'other', kind: 'Прихожая', tier: 'eco', when: 'month' }, stage: 'deal', ago: 8 * DAY, inStage: 5 * DAY, replyMin: 18 },
    { name: 'Алексей', phone: '+7 900 000-38-81', channel: 'whatsapp', source: 'Квиз на сайте', q: { cat: 'kitchen', layout: 'corner', size: 3.6, tier: 'pro', when: 'q' }, stage: 'quote', ago: 8 * DAY, inStage: 4 * DAY, lostAgo: DAY, lost: 'Дорого', replyMin: 55 },
    { name: 'Юлия', phone: '+7 900 000-07-48', channel: 'call', source: 'Авито', q: { cat: 'kupe', layout: 'box', size: 2.0, tier: 'mid', when: 'look' }, stage: 'new', ago: 6 * DAY, inStage: 6 * DAY, lostAgo: 5 * DAY, lost: 'Не отвечает', replyMin: null },
  ];
  const s = { v: 1, company: company || 'Ваш цех', city: city || 'Челябинск', seq: 2001, shift: 0, tg: [], sent: {}, tgSeen: t0, leads: [] };
  L.reverse().forEach(o => {
    const createdAt = t0 - o.ago, stageAt = t0 - (o.inStage ?? o.ago), k = SI[o.stage].i;
    const price = priceOf(o.q);
    const l = { id: s.seq++, name: o.name, phone: o.phone, channel: o.channel, source: o.source, q: o.q, price, stage: o.stage, max: k, createdAt, stageAt, replyMin: o.replyMin ?? null, sum: k >= 3 ? midSum(price) : null, lost: o.lost || null, lostAt: o.lost ? t0 - o.lostAgo : null, history: [] };
    l.history.push({ t: createdAt, text: `Заявка: ${o.source}` });
    for (let i = 1; i <= k; i++) {
      const t = i === k ? stageAt : i === 1 && l.replyMin ? createdAt + l.replyMin * MIN : createdAt + (stageAt - createdAt) * i / k;
      l.history.push({ t, text: STAGES[i - 1].done + (i === 3 ? `: ${rub(l.sum)}` : '') });
    }
    if (l.lost) l.history.push({ t: l.lostAt, text: `Клиент потерян: ${l.lost.toLowerCase()}` });
    s.leads.push(l);
    s.tg.push({ id: s.tg.length + 1, t: createdAt, kind: 'lead', lead: l.id });
  });
  return s;
}

const Store = {
  s: null,
  now() { return Date.now() + (this.s.shift || 0); },
  load() {
    const saved = LS.get(KEY);
    const q = new URLSearchParams(location.search);
    this.s = saved && saved.v === 1 ? saved : seed();
    if (q.get('n')) this.s.company = q.get('n').trim().slice(0, 40) || this.s.company;
    if (q.get('c')) this.s.city = q.get('c').trim().slice(0, 30) || this.s.city;
    this.scan();
    this.save();
  },
  save() { LS.set(KEY, this.s); },
  reset() { this.s = seed(this.s.company, this.s.city); this.scan(); this.save(); },
  lead(id) { return this.s.leads.find(l => l.id === +id); },
  active() { return this.s.leads.filter(l => !l.lost); },
  tgPush(m) { this.s.tg.push({ id: this.s.tg.length + 1, t: this.now(), ...m }); },
  unread() { return this.s.tg.filter(m => m.t > this.s.tgSeen).length; },

  /* новые напоминания в Telegram для просроченных этапов */
  scan() {
    const now = this.now(); let n = 0;
    for (const l of this.s.leads) {
      const a = alertOf(l, now);
      if (!a || this.s.sent[a.key]) continue;
      this.s.sent[a.key] = 1;
      // напоминание приходит в момент просрочки, текст — на этот же момент
      const t = Math.min(now, a.at), then = alertOf(l, t) || a;
      this.s.tg.push({ id: this.s.tg.length + 1, t, kind: 'remind', lead: l.id, level: a.level, stage: l.stage, text: then.text });
      n++;
    }
    this.s.tg.sort((a, b) => a.t - b.t);
    return n;
  },

  setStage(id, key) {
    const l = this.lead(id); if (!l || l.stage === key) return;
    const now = this.now();
    if (key === 'contact' && l.replyMin == null) l.replyMin = Math.max(1, Math.round((now - l.createdAt) / MIN));
    if (key === 'quote' && !l.sum) l.sum = midSum(l.price);
    l.stage = key; l.stageAt = now; l.max = Math.max(l.max, SI[key].i);
    l.history.push({ t: now, text: STAGES[SI[key].i - 1].done + (key === 'quote' ? `: ${rub(l.sum)}` : '') });
    this.scan(); this.save();
  },
  lose(id, reason) {
    const l = this.lead(id); if (!l) return;
    l.lost = reason; l.lostAt = this.now();
    l.history.push({ t: l.lostAt, text: `Клиент потерян: ${reason.toLowerCase()}` });
    this.save();
  },
  restore(id) {
    const l = this.lead(id); if (!l) return;
    l.lost = null; l.lostAt = null; l.stageAt = this.now();
    l.history.push({ t: l.stageAt, text: 'Клиент снова в работе' });
    this.save();
  },
  setSum(id, sum) { const l = this.lead(id); if (l && sum > 0) { l.sum = sum; this.save(); } },
  add(q, c) {
    const now = this.now(), price = priceOf(q);
    const l = { id: this.s.seq++, name: c.name, phone: c.phone, channel: c.channel, source: 'Квиз на сайте', q, price, stage: 'new', max: 0, createdAt: now, stageAt: now, replyMin: null, sum: null, lost: null, lostAt: null, fresh: true, history: [{ t: now, text: 'Заявка: квиз на сайте' }] };
    this.s.leads.push(l);
    this.tgPush({ kind: 'lead', lead: l.id });
    this.save();
    return l;
  },
  timeShift(ms) { this.s.shift = (this.s.shift || 0) + ms; const n = this.scan(); this.save(); return n; },
};

/* ---------- тема: как в телефоне, пока человек не выбрал сам ---------- */
const Theme = {
  KEY: 'zayavki.theme',
  mq: window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null,
  saved() { try { const t = localStorage.getItem(this.KEY); return t === 'dark' || t === 'light' ? t : null; } catch (e) { return null; } },
  apply(t) {
    document.documentElement.dataset.theme = t;
    const m = $('meta[name="theme-color"]'); if (m) m.content = t === 'dark' ? '#141c27' : '#0d2440';
  },
  toggle() {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(this.KEY, t); } catch (e) { /* без сохранения */ }
    this.apply(t);
  },
  init() {
    this.apply(this.saved() || (this.mq && this.mq.matches ? 'dark' : 'light'));
    if (this.mq && this.mq.addEventListener) this.mq.addEventListener('change', e => { if (!this.saved()) this.apply(e.matches ? 'dark' : 'light'); });
    document.addEventListener('click', e => { if (e.target.closest('[data-theme-toggle]')) this.toggle(); });
  },
};
const themeBtn = () => `<button class="themebtn" data-theme-toggle aria-label="Светлая или тёмная тема" title="Светлая / тёмная тема">${icon('moon', 18)}${icon('sun', 18)}</button>`;

/* ---------- всплывашки ---------- */
function toast({ title, text = '', act, onAct, tone = '' }) {
  const el = document.createElement('div');
  el.className = 'toast ' + tone;
  el.innerHTML = `<div><b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}</div>${act ? `<button class="btn btn--sm btn--light">${esc(act)}</button>` : ''}`;
  $('#toasts').appendChild(el);
  const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  if (act) $('button', el).onclick = () => { close(); onAct && onAct(); };
  setTimeout(close, 6000);
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast({ title: 'Текст скопирован', text: 'Вставьте его в переписку с клиентом' }); }
  catch (e) { prompt('Скопируйте текст:', t); }
}
const waLink = (phone, text) => `https://wa.me/${digits(phone)}?text=${encodeURIComponent(text)}`;

/* ---------- общие куски разметки ---------- */
const pill = l => l.lost ? '<span class="pill pill--red">Потерян</span>' : `<span class="pill pill--${l.stage}">${SI[l.stage].label}</span>`;
const avatar = name => `<span class="ava">${esc(name[0])}</span>`;

function leadCard(l, now) {
  const a = alertOf(l, now);
  const money = l.sum ? rub(l.sum) : 'от ' + rub(l.price.lo);
  return `<a class="lcard ${a ? 'is-late' : ''} ${l.fresh ? 'is-fresh' : ''}" href="#/lead/${l.id}">
    <div class="lcard__t">${avatar(l.name)}<div><b>${esc(l.name)}</b><small>${esc(itemOf(l.q))}</small></div></div>
    <div class="lcard__b"><span class="money">${money}</span><span class="${a ? 'late' : 'muted'}">${icon(a ? 'alert' : 'clock', 14)}${l.stage === 'deal' ? ago(now - l.stageAt) : dur(now - l.stageAt)}</span></div>
  </a>`;
}

/* =========================================================
   Экраны
   ========================================================= */
const Views = {
  /* --- вводная для владельца: её показывают при визите --- */
  intro(v) {
    const s = Store.s, named = s.company !== 'Ваш цех';
    v.innerHTML = `<section class="intro">
      <div class="kicker">${named ? `Демо для «${esc(s.company)}»` : 'Демо-версия'} · ${esc(s.city)}</div>
      <h1>Ни одна заявка<br>не потеряется</h1>
      <p class="lead">Клиент считает кухню на вашем сайте или по ссылке из Авито, а вы сразу получаете заявку в Telegram. Дальше система сама напоминает, кому позвонить и что написать, пока клиент не ушёл в другой цех.</p>
      <div class="cta">
        <a class="btn btn--primary btn--lg" href="#/quiz">${icon('calc')}Посмотреть глазами клиента</a>
        <a class="btn btn--outline btn--lg" href="#/board">${icon('board')}Открыть кабинет владельца</a>
      </div>
      <ol class="steps">
        <li><span>1</span><div><b>Клиент считает цену за минуту</b><p>Квиз на сайте. Ориентир цены клиент видит, только оставив телефон, поэтому контакт остаётся у вас.</p></div></li>
        <li><span>2</span><div><b>Заявка сразу в Telegram</b><p>Имя, телефон, что хочет и на какую сумму. Кто первым позвонил, того и клиент.</p></div></li>
        <li><span>3</span><div><b>Напоминания, пока не поздно</b><p>Клиент получил цену и молчит два дня? Бот напомнит и даст готовый текст сообщения.</p></div></li>
        <li><span>4</span><div><b>Отчёт раз в неделю</b><p>Сколько заявок, сколько договоров и на каком шаге уходят клиенты.</p></div></li>
      </ol>
      <form class="card personal" id="personal">
        <b>Показать на примере вашего цеха</b>
        <div class="row"><input class="input" name="n" maxlength="40" placeholder="Название, например «Мебель Урал»" value="${named ? esc(s.company) : ''}"><button class="btn btn--primary">Применить</button></div>
      </form>
      <p class="foot muted">Все клиенты и цифры в демо вымышленные. <button class="link" id="reset">${icon('rotate', 14)}Сбросить демо</button></p>
    </section>`;
    $('#personal', v).onsubmit = e => {
      e.preventDefault();
      const n = new FormData(e.target).get('n').trim();
      Store.s.company = n.slice(0, 40) || 'Ваш цех'; Store.save(); App.render();
      toast({ title: n ? `Теперь демо для «${Store.s.company}»` : 'Название сброшено' });
    };
    $('#reset', v).onclick = () => { Store.reset(); App.render(); toast({ title: 'Демо-данные восстановлены' }); };
  },

  /* --- доска заявок --- */
  board(v) {
    const now = Store.now(), act = Store.active();
    const late = act.map(l => [l, alertOf(l, now)]).filter(x => x[1]).sort((a, b) => b[1].wait - a[1].wait);
    const inWork = act.filter(l => l.stage !== 'deal');
    const risk = late.reduce((t, [l]) => t + (l.sum || midSum(l.price)), 0);
    const deals = act.filter(l => l.stage === 'deal');
    const lost = Store.s.leads.filter(l => l.lost);
    v.innerHTML = `<div class="page">
      <div class="phead"><h1>Заявки</h1><a class="btn btn--sm btn--outline" href="#/quiz">${icon('calc', 16)}Квиз клиента</a></div>
      <div class="kpis">
        <div class="kpi"><small>В работе</small><b>${inWork.length}</b><span>${rub(inWork.reduce((t, l) => t + (l.sum || midSum(l.price)), 0))}</span></div>
        <div class="kpi kpi--red"><small>Под угрозой</small><b>${late.length}</b><span>${late.length ? rub(risk) : 'всё под контролем'}</span></div>
        <div class="kpi kpi--green"><small>Договоры</small><b>${deals.length}</b><span>${rub(deals.reduce((t, l) => t + l.sum, 0))}</span></div>
      </div>
      ${late.length ? `<section class="attn"><h2>${icon('alert', 18)}Требуют внимания сейчас</h2>${late.map(([l, a]) => `
        <a class="attn__i" href="#/lead/${l.id}">${avatar(l.name)}<div><b>${esc(l.name)} · ${esc(itemOf(l.q))}</b><p>${esc(a.text)}</p></div>${icon('right', 18)}</a>`).join('')}</section>` : `<section class="attn attn--ok"><h2>${icon('check', 18)}Все клиенты под контролем</h2></section>`}
      <div class="kanban">${STAGES.map(st => { const ls = act.filter(l => l.stage === st.key).sort((a, b) => a.stageAt - b.stageAt);
        return `<div class="col"><div class="col__h"><span class="dot dot--${st.key}"></span>${st.col}<em>${ls.length}</em></div>${ls.map(l => leadCard(l, now)).join('') || '<div class="col__empty">пусто</div>'}</div>`; }).join('')}
        <div class="col col--lost"><div class="col__h"><span class="dot dot--lost"></span>Потеряны<em>${lost.length}</em></div>${lost.map(l => `<a class="lcard lcard--lost" href="#/lead/${l.id}"><div class="lcard__t">${avatar(l.name)}<div><b>${esc(l.name)}</b><small>${esc(l.lost)} · на шаге «${SI[l.stage].label}»</small></div></div></a>`).join('') || '<div class="col__empty">пусто</div>'}</div>
      </div>
    </div>`;
  },

  /* --- карточка клиента --- */
  lead(v, id) {
    const l = Store.lead(id);
    if (!l) { v.innerHTML = `<div class="page"><div class="card empty">Заявка не найдена. <a class="link" href="#/board">К заявкам</a></div></div>`; return; }
    if (l.fresh) { l.fresh = false; Store.save(); }
    const now = Store.now(), a = alertOf(l, now), st = SI[l.stage];
    const tpl = !l.lost && l.stage !== 'deal' ? templateFor(l, a ? a.level : 1) : '';
    v.innerHTML = `<div class="page page--narrow">
      <a class="back" href="#/board">${icon('left', 16)}Заявки</a>
      <div class="lhead">${avatar(l.name)}<div><h1>${esc(l.name)}</h1><p class="muted">${esc(itemOf(l.q))} · ${esc(l.source)} · ${ago(now - l.createdAt)}</p></div>${pill(l)}</div>
      ${a ? `<div class="banner banner--red">${icon('alert', 18)}<p>${esc(a.text)}</p></div>` : ''}
      ${tpl ? `<div class="card tpl"><div class="card__h"><b>Что написать клиенту</b><small class="muted">готовый текст</small></div>
        <p class="tpl__t" id="tpl">${esc(tpl)}</p>
        <div class="row"><button class="btn btn--outline btn--sm" id="copy">${icon('copy', 16)}Скопировать</button><a class="btn btn--wa btn--sm" target="_blank" rel="noopener" href="${waLink(l.phone, tpl)}">${icon('chat', 16)}Открыть в WhatsApp</a><a class="btn btn--outline btn--sm" href="tel:${digits(l.phone)}">${icon('phone', 16)}Позвонить</a></div></div>` : ''}
      ${!l.lost && st.next ? `<div class="card next"><div><small class="muted">Следующий шаг</small><b>${st.next}</b></div><button class="btn btn--primary" id="next">${icon('check', 18)}Готово</button></div>` : ''}
      ${l.stage === 'deal' && !l.lost ? `<div class="banner banner--green">${icon('check', 18)}<p>Договор подписан ${ago(now - l.stageAt)} на ${rub(l.sum)}.</p></div>` : ''}
      <div class="grid2">
        <div class="card"><div class="card__h"><b>Что хочет клиент</b></div><dl class="dl">
          <dt>Изделие</dt><dd>${esc(itemOf(l.q))}</dd>
          <dt>Уровень</dt><dd>${TIERS[l.q.tier].label} (${TIERS[l.q.tier].sub})</dd>
          <dt>Когда</dt><dd>${WHEN[l.q.when]}</dd>
          <dt>Ориентир из квиза</dt><dd>${range(l.price)}</dd>
          ${l.sum ? `<dt>Названная цена</dt><dd><input class="input input--sum" id="sum" inputmode="numeric" value="${l.sum}"> ₽</dd>` : ''}
        </dl></div>
        <div class="card"><div class="card__h"><b>Контакты</b></div><dl class="dl">
          <dt>Телефон</dt><dd><a class="link" href="tel:${digits(l.phone)}">${esc(l.phone)}</a></dd>
          <dt>Удобнее</dt><dd>${CHANNEL[l.channel]}</dd>
          <dt>Первый звонок</dt><dd>${l.replyMin != null ? `через ${dur(l.replyMin * MIN)}` : 'ещё не звонили'}</dd>
        </dl></div>
      </div>
      <div class="card"><div class="card__h"><b>История</b></div><ul class="hist">${l.history.slice().reverse().map(h => `<li><span>${dayLabel(h.t)}, ${clock(h.t)}</span>${esc(h.text)}</li>`).join('')}</ul></div>
      ${l.lost ? `<div class="card lostbox"><p>Клиент отмечен как потерянный: <b>${esc(l.lost.toLowerCase())}</b>.</p><button class="btn btn--outline btn--sm" id="restore">${icon('rotate', 16)}Вернуть в работу</button></div>`
        : l.stage !== 'deal' ? `<div class="card lostbox"><small class="muted">Клиент отказался? Отметьте причину, она попадёт в отчёт</small><div class="chips">${LOST.map(r => `<button class="chip" data-lost="${r}">${r}</button>`).join('')}</div></div>` : ''}
    </div>`;
    const c = $('#copy', v); if (c) c.onclick = () => copyText(tpl);
    const n = $('#next', v); if (n) n.onclick = () => {
      const key = STAGES[st.i + 1].key; Store.setStage(l.id, key); App.render(true);
      toast({ title: `${l.name}: «${SI[key].label}»`, text: key === 'deal' ? 'Поздравляем с договором!' : `Если следующий шаг затянется, бот напомнит через ${dur(SI[key].sla)}`, tone: key === 'deal' ? 'ok' : '' });
    };
    const sum = $('#sum', v); if (sum) sum.onchange = () => { Store.setSum(l.id, +digits(sum.value)); toast({ title: 'Цена сохранена' }); };
    $$('[data-lost]', v).forEach(b => b.onclick = () => { Store.lose(l.id, b.dataset.lost); App.render(true); });
    const r = $('#restore', v); if (r) r.onclick = () => { Store.restore(l.id); App.render(true); };
  },

  /* --- Telegram владельца --- */
  tg(v) {
    const s = Store.s, now = Store.now();
    s.tgSeen = now; Store.save(); App.badges();
    let lastDay = '';
    const msgs = s.tg.slice(-60).map(m => {
      const l = m.lead ? Store.lead(m.lead) : null;
      const d = dayLabel(m.t), sep = d !== lastDay ? `<div class="tg__day">${d}</div>` : ''; lastDay = d;
      let body = '', btns = '';
      if (m.kind === 'lead' && l) {
        body = `<b>🆕 Новая заявка · ${esc(l.source)}</b><br>${esc(itemOf(l.q))}<br>${TIERS[l.q.tier].label}, ${WHEN[l.q.when]}<br>Ориентир: ${range(l.price)}<br><br>👤 ${esc(l.name)} · ${esc(l.phone)}<br>Удобнее: ${CHANNEL[l.channel]}`;
        btns = (l.stage === 'new' && !l.lost ? `<button data-call="${l.id}">✅ Позвонил</button>` : '') + `<a href="#/lead/${l.id}">Карточка</a>`;
      } else if (m.kind === 'remind' && l) {
        body = `<b>⏰ ${esc(l.name)} · ${esc(itemOf(l.q))}</b><br>${esc(m.text)}`;
        btns = `<a href="#/lead/${l.id}">✍️ Готовый текст</a>`;
      } else if (m.kind === 'note') body = esc(m.text);
      else if (m.kind === 'report') body = m.html;
      return body ? `${sep}<div class="tg__msg ${m.t > now - 2 * MIN ? 'is-new' : ''}"><div class="tg__b">${body}<time>${clock(m.t)}</time></div>${btns ? `<div class="tg__btns">${btns}</div>` : ''}</div>` : '';
    }).join('');
    v.innerHTML = `<div class="page page--narrow">
      <div class="phead"><h1>Telegram владельца</h1></div>
      <p class="muted small">Так выглядят уведомления в Telegram на телефоне владельца. Чтобы увидеть напоминания, перемотайте время вперёд:</p>
      <div class="chips chips--time"><button class="chip" data-shift="${20 * MIN}">${icon('forward', 14)}+20 минут</button><button class="chip" data-shift="${DAY}">${icon('forward', 14)}+1 день</button><button class="chip" data-shift="${3 * DAY}">${icon('forward', 14)}+3 дня</button><button class="chip" id="weekly">📊 Недельный отчёт</button></div>
      <div class="tg">
        <div class="tg__head"><span class="ava ava--bot">${icon('send', 16)}</span><div><b>${esc(s.company)} · Заявки</b><small>бот</small></div></div>
        <div class="tg__list" id="tglist">${msgs}</div>
      </div>
    </div>`;
    const list = $('#tglist', v); list.scrollTop = list.scrollHeight;
    $$('[data-call]', v).forEach(b => b.onclick = () => {
      const l = Store.lead(b.dataset.call); Store.setStage(l.id, 'contact');
      Store.tgPush({ kind: 'note', text: `✓ ${l.name}: отмечено «Связались». Следующий шаг — назначить замер. Если не назначите за сутки, напомню.` });
      Store.save(); App.render(true);
    });
    $$('[data-shift]', v).forEach(b => b.onclick = () => {
      const n = Store.timeShift(+b.dataset.shift); App.render(true);
      toast({ title: `Прошло ${b.textContent.replace('+', '').trim()}`, text: n ? `Пришло ${n} ${plural(n, 'напоминание', 'напоминания', 'напоминаний')}` : 'Новых напоминаний нет: все клиенты в сроке' });
    });
    $('#weekly', v).onclick = () => { const r = report(); Store.tgPush({ kind: 'report', html: `<b>📊 Отчёт за неделю</b><br>Заявок: ${r.total}<br>Договоров: ${r.deals.length} на ${rub(r.dealSum)}<br>Ждут ответа дольше нормы: ${r.late.length}<br>Средний первый звонок: ${r.avgReply != null ? 'через ' + dur(r.avgReply * MIN) : '—'}${r.worst ? `<br><br>Больше всего клиентов теряется на шаге «${r.worst.from} → ${r.worst.to}»` : ''}<br><a href="#/report">Подробнее</a>` }); Store.save(); App.render(true); };
  },

  /* --- недельный отчёт --- */
  report(v) {
    const r = report();
    const maxN = Math.max(1, r.funnel[0].n);
    v.innerHTML = `<div class="page page--narrow">
      <div class="phead"><h1>Отчёт за 2 недели</h1></div>
      <div class="kpis kpis--4">
        <div class="kpi"><small>Заявок</small><b>${r.total}</b><span>из квиза: ${r.fromQuiz}</span></div>
        <div class="kpi kpi--green"><small>Договоров</small><b>${r.deals.length}</b><span>${rub(r.dealSum)}</span></div>
        <div class="kpi"><small>Конверсия</small><b>${r.conv}%</b><span>заявка → договор</span></div>
        <div class="kpi"><small>Первый звонок</small><b>${r.avgReply != null ? dur(r.avgReply * MIN) : '—'}</b><span>в среднем</span></div>
      </div>
      ${r.worst ? `<div class="banner banner--amber">${icon('alert', 18)}<p>Больше всего клиентов теряется на шаге <b>«${r.worst.from} → ${r.worst.to}»</b>: ${r.worst.n} ${plural(r.worst.n, 'человек', 'человека', 'человек')}. ${r.worst.to === 'Договор' ? 'Помогает напоминание через 2 дня после цены и вариант подешевле.' : 'Проверьте, не затягивается ли этот шаг.'}</p></div>` : ''}
      <div class="card"><div class="card__h"><b>Воронка: сколько клиентов дошло до каждого шага</b></div>
        <div class="funnel">${r.funnel.map(f => `<div class="funnel__r"><span>${f.label}</span><div class="funnel__bar"><i style="width:${Math.max(4, f.n / maxN * 100)}%"></i></div><b>${f.n}</b></div>`).join('')}</div></div>
      <div class="grid2">
        <div class="card"><div class="card__h"><b>Почему уходят</b></div>${r.reasons.length ? `<ul class="bars">${r.reasons.map(([k, n]) => `<li><span>${esc(k)}</span><b>${n}</b></li>`).join('')}</ul>` : '<p class="muted">Потерянных клиентов нет</p>'}</div>
        <div class="card"><div class="card__h"><b>Откуда заявки</b></div><ul class="bars">${r.sources.map(([k, n]) => `<li><span>${esc(k)}</span><b>${n}</b></li>`).join('')}</ul></div>
      </div>
      <p class="muted small">Такой отчёт каждый понедельник приходит владельцу в Telegram.</p>
    </div>`;
  },
};

function report() {
  const L = Store.s.leads, now = Store.now();
  const count = f => Object.entries(L.reduce((m, l) => { const k = f(l); if (k) m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
  const deals = L.filter(l => !l.lost && l.stage === 'deal');
  const replies = L.filter(l => l.replyMin != null).map(l => l.replyMin);
  const funnel = STAGES.map((s, i) => ({ label: s.label, n: L.filter(l => l.max >= i).length }));
  let worst = null;
  for (let i = 0; i < funnel.length - 1; i++) {
    // ушли = дошли до шага i, но не дальше, и уже отмечены потерянными или висят дольше нормы
    const n = L.filter(l => l.max === i && (l.lost || alertOf(l, now))).length;
    if (n && (!worst || n >= worst.n)) worst = { from: STAGES[i].label, to: STAGES[i + 1].label, n };
  }
  return {
    total: L.length, fromQuiz: L.filter(l => l.source === 'Квиз на сайте').length,
    deals, dealSum: deals.reduce((t, l) => t + l.sum, 0),
    conv: L.length ? Math.round(deals.length / L.length * 100) : 0,
    avgReply: replies.length ? Math.round(replies.reduce((a, b) => a + b, 0) / replies.length) : null,
    late: L.filter(l => alertOf(l, now)), funnel, worst,
    reasons: count(l => l.lost), sources: count(l => l.source),
  };
}

/* =========================================================
   Квиз — так клиент видит расчёт на сайте цеха
   ========================================================= */
const Quiz = {
  st: null,
  reset() { this.st = { step: 0, q: { cat: null, layout: null, size: 3, tier: null, when: null }, c: { name: '', phone: '', channel: 'whatsapp' }, done: null }; },
  steps() {
    const q = this.st.q;
    return ['cat', q.cat === 'other' ? 'kind' : 'layout', ...(q.cat === 'other' ? [] : ['size']), 'tier', 'when', 'contact'];
  },
  opt(key, val, title, sub = '', art = '') {
    return `<button class="qopt ${this.st.q[key] === val ? 'is-on' : ''}" data-k="${key}" data-v="${esc(val)}">${art}<b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
  },
  art: {
    kitchen: '<svg viewBox="0 0 64 40"><rect x="6" y="18" width="52" height="16" rx="2"/><path d="M6 24h52M19 18v16M32 18v16M45 18v16"/><rect x="6" y="4" width="52" height="9" rx="2"/></svg>',
    kupe: '<svg viewBox="0 0 64 40"><rect x="12" y="3" width="40" height="34" rx="2"/><path d="M25 3v34M39 3v34"/><path d="M30 18v4M34 18v4"/></svg>',
    other: '<svg viewBox="0 0 64 40"><rect x="10" y="10" width="20" height="26" rx="2"/><rect x="34" y="18" width="20" height="18" rx="2"/><path d="M34 27h20M20 10V4"/></svg>',
    line: '<svg viewBox="0 0 64 40"><path d="M8 30V12h48v18" class="w"/><rect x="10" y="14" width="44" height="8"/></svg>',
    corner: '<svg viewBox="0 0 64 40"><path d="M8 34V6h48" class="w"/><path d="M10 8h44v8H18v18h-8z"/></svg>',
    u: '<svg viewBox="0 0 64 40"><path d="M8 34V6h48v28" class="w"/><path d="M10 8h44v26h-8V16H18v18h-8z"/></svg>',
    box: '<svg viewBox="0 0 64 40"><rect x="14" y="4" width="36" height="32" rx="2"/><path d="M26 4v32M38 4v32"/></svg>',
    niche: '<svg viewBox="0 0 64 40"><path d="M6 4h10v32H6M58 4H48v32h10" class="w"/><rect x="16" y="4" width="32" height="32"/><path d="M27 4v32M37 4v32"/></svg>',
  },
  view(v) {
    if (!this.st) this.reset();
    const st = this.st, q = st.q, steps = this.steps(), cur = steps[st.step], s = Store.s;
    const co = s.company === 'Ваш цех' ? 'Мебельный цех' : s.company;
    let body = '';
    if (st.done) body = this.result();
    else if (cur === 'cat') body = `<h2>Что хотите заказать?</h2><div class="qgrid">${this.opt('cat', 'kitchen', 'Кухня', 'на заказ по вашим размерам', this.art.kitchen)}${this.opt('cat', 'kupe', 'Шкаф-купе', 'корпусный или в нишу', this.art.kupe)}${this.opt('cat', 'other', 'Другая мебель', 'прихожая, гардеробная, детская', this.art.other)}</div>`;
    else if (cur === 'layout' && q.cat === 'kitchen') body = `<h2>Какой формы кухня?</h2><div class="qgrid">${this.opt('layout', 'line', 'Прямая', 'вдоль одной стены', this.art.line)}${this.opt('layout', 'corner', 'Угловая', 'буквой Г', this.art.corner)}${this.opt('layout', 'u', 'П-образная', 'вдоль трёх стен', this.art.u)}</div>`;
    else if (cur === 'layout') body = `<h2>Какой шкаф нужен?</h2><div class="qgrid qgrid--2">${this.opt('layout', 'box', 'Корпусный', 'отдельно стоящий', this.art.box)}${this.opt('layout', 'niche', 'Встроенный', 'в нишу, без боковин', this.art.niche)}</div>`;
    else if (cur === 'kind') body = `<h2>Что именно нужно?</h2><div class="qgrid qgrid--chips">${OTHER_KINDS.map(k => `<button class="qchip ${q.kind === k ? 'is-on' : ''}" data-k="kind" data-v="${k}">${k}</button>`).join('')}</div>`;
    else if (cur === 'size') {
      const kit = q.cat === 'kitchen', min = kit ? 1.5 : 1, max = kit ? 8 : 4;
      if (q.size < min || q.size > max || !q._sized) { q.size = kit ? { line: 2.8, corner: 3.4, u: 5 }[q.layout] : 2.2; q._sized = true; }
      body = `<h2>${kit ? 'Общая длина кухни по стенам' : 'Ширина шкафа'}</h2><p class="muted">${kit ? 'Сложите длину всех стен, вдоль которых будет кухня. Можно примерно.' : 'Ширина ниши или места под шкаф. Можно примерно.'}</p>
        <div class="qsize"><output id="sz">${fmt1(q.size)} м</output><input type="range" id="range" min="${min}" max="${max}" step="0.1" value="${q.size}"><div class="qsize__s"><span>${fmt1(min)} м</span><span>${fmt1(max)} м</span></div></div>
        <button class="btn btn--primary btn--lg btn--block" id="go">Далее${icon('right', 18)}</button>`;
    } else if (cur === 'tier') body = `<h2>Какие материалы рассматриваете?</h2><div class="qgrid">${Object.entries(TIERS).map(([k, t]) => this.opt('tier', k, t.label, t.sub)).join('')}</div>`;
    else if (cur === 'when') body = `<h2>Когда нужна мебель?</h2><div class="qgrid">${this.opt('when', 'month', 'В ближайший месяц')}${this.opt('when', 'q', 'Через 1–3 месяца')}${this.opt('when', 'look', 'Пока присматриваюсь')}</div>`;
    else if (cur === 'contact') body = `<div class="qready">${icon('check', 22)}<div><b>Расчёт готов!</b><p>Куда отправить цену и подборку фото похожих работ?</p></div></div>
      <form id="cform" class="cform" novalidate>
        <label>Ваше имя<input class="input" name="name" autocomplete="given-name" value="${esc(st.c.name)}" placeholder="Например, Анна"></label>
        <label>Телефон<input class="input" name="phone" type="tel" inputmode="tel" autocomplete="tel" value="${esc(st.c.phone)}" placeholder="+7 ___ ___-__-__"></label>
        <div class="seg">${Object.entries(CHANNEL).map(([k, t]) => `<button type="button" class="${st.c.channel === k ? 'is-on' : ''}" data-ch="${k}">${k === 'call' ? 'Позвонить' : t}</button>`).join('')}</div>
        <p class="err" id="err"></p>
        <button class="btn btn--primary btn--lg btn--block">Получить расчёт</button>
        <small class="muted">Нажимая кнопку, вы соглашаетесь на обработку персональных данных. Без спама: только расчёт по вашей заявке.</small>
      </form>`;
    v.innerHTML = `<div class="qbar"><span>${icon('user', 16)}Так клиент видит расчёт на вашем сайте</span><div class="qbar__r">${themeBtn()}<a href="#/board" class="link">Выйти ${icon('x', 14)}</a></div></div>
      <div class="quiz">
        <div class="quiz__brand"><b>${esc(co)}</b><small>${esc(s.city)} · мебель на заказ</small></div>
        ${st.done ? '' : `<div class="quiz__top"><h1>Рассчитайте стоимость мебели за 1 минуту</h1><div class="prog"><i style="width:${(st.step + 1) / steps.length * 100}%"></i></div><small class="muted">Шаг ${st.step + 1} из ${steps.length}${st.step ? ` · <button class="link" id="back">${icon('left', 14)}назад</button>` : ''}</small></div>`}
        <div class="quiz__card">${body}</div>
        ${st.done ? '' : `<div class="quiz__gift">${icon('gift', 20)}<span>Замер и 3D-проект бесплатно при заказе</span></div>`}
      </div>`;
    this.bind(v);
  },
  bind(v) {
    const st = this.st, q = st.q;
    $$('[data-k]', v).forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      if (k === 'cat' && q.cat !== b.dataset.v) { q.layout = null; q.kind = null; q._sized = false; }
      if (k === 'layout' && q.layout !== b.dataset.v) q._sized = false;
      q[k] = b.dataset.v; st.step++; this.view(v);
    });
    const rg = $('#range', v); if (rg) rg.oninput = () => { q.size = +rg.value; $('#sz', v).textContent = fmt1(q.size) + ' м'; };
    const go = $('#go', v); if (go) go.onclick = () => { st.step++; this.view(v); };
    const bk = $('#back', v); if (bk) bk.onclick = () => { st.step--; this.view(v); };
    $$('[data-ch]', v).forEach(b => b.onclick = () => { st.c.channel = b.dataset.ch; $$('[data-ch]', v).forEach(x => x.classList.toggle('is-on', x === b)); });
    const f = $('#cform', v);
    if (f) {
      const ph = f.elements.phone;
      ph.oninput = () => { ph.value = maskPhone(ph.value); };
      f.onsubmit = e => {
        e.preventDefault();
        st.c.name = f.elements.name.value.trim(); st.c.phone = ph.value.trim();
        const err = !st.c.name ? 'Напишите, как к вам обращаться' : digits(st.c.phone).length < 11 ? 'Проверьте номер телефона' : '';
        $('#err', v).textContent = err; if (err) return;
        const l = Store.add({ cat: q.cat, layout: q.layout, kind: q.kind, size: q.size, tier: q.tier, when: q.when }, { name: st.c.name.slice(0, 30), phone: st.c.phone, channel: st.c.channel });
        st.done = l.id; this.view(v); App.badges();
        setTimeout(() => toast({ title: 'В Telegram владельцу пришла заявка', text: `${l.name} · ${itemOf(l.q)}`, act: 'Посмотреть', onAct: () => { location.hash = '#/tg'; }, tone: 'tg' }), 900);
      };
    }
    const again = $('#again', v); if (again) again.onclick = () => { this.reset(); this.view(v); };
  },
  result() {
    const l = Store.lead(this.st.done);
    return `<div class="qres"><small class="muted">${esc(itemOf(l.q))} · ${TIERS[l.q.tier].label}</small>
      <h2>Ориентировочно</h2><div class="qres__p">${range(l.price)}</div>
      <p>Точную цену назовём после бесплатного замера: она зависит от фурнитуры, столешницы и техники.</p>
      <div class="qres__ok">${icon('clock', 18)}<span>${esc(l.name)}, мы свяжемся с вами в течение 15 минут ${l.channel === 'call' ? 'по телефону' : 'в ' + CHANNEL[l.channel]}.</span></div>
      <div class="row"><a class="btn btn--primary" href="#/tg">${icon('send', 16)}Что увидел владелец</a><button class="btn btn--outline" id="again">Пройти заново</button></div></div>`;
  },
};
function maskPhone(v) {
  let d = digits(v); if (!d) return '';
  if (d[0] === '8') d = '7' + d.slice(1); if (d[0] !== '7') d = '7' + d; d = d.slice(0, 11);
  const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
  return '+7' + (p[0] ? ' ' + p[0] : '') + (p[1] ? ' ' + p[1] : '') + (p[2] ? '-' + p[2] : '') + (p[3] ? '-' + p[3] : '');
}

/* =========================================================
   Каркас и маршрутизация
   ========================================================= */
const NAV = [['board', '#/board', 'board', 'Заявки'], ['tg', '#/tg', 'send', 'Telegram'], ['report', '#/report', 'chart', 'Отчёт'], ['quiz', '#/quiz', 'calc', 'Квиз']];
const App = {
  key: '',
  render(keep) {
    const [path] = (location.hash.slice(1) || '/').split('?');
    const parts = path.split('/').filter(Boolean), page = parts[0] || '';
    const root = $('#root');
    if (location.hash !== App.key && !keep) window.scrollTo(0, 0);
    App.key = location.hash;
    if (page === 'quiz') {
      document.title = `Расчёт мебели — ${Store.s.company}`;
      root.className = 'is-client'; root.innerHTML = '<main id="view"></main>';
      Quiz.view($('#view')); return;
    }
    Quiz.st = null;
    const s = Store.s, on = page === 'lead' ? 'board' : page;
    document.title = `${s.company} · Заявки`;
    root.className = '';
    root.innerHTML = `<header class="top"><a href="#/" class="logo"><span class="logo__m"></span>${esc(s.company)}<small>Заявки</small></a>
      <div class="top__r"><nav class="nav">${NAV.map(([k, h, ic, t]) => `<a href="${h}" class="${on === k ? 'is-on' : ''}">${icon(ic, 20)}<span>${t}</span>${k === 'tg' ? '<em class="badge" id="tgbadge"></em>' : ''}</a>`).join('')}</nav>${themeBtn()}</div></header>
      <main id="view"></main>`;
    const v = $('#view');
    if (page === 'board') Views.board(v);
    else if (page === 'lead') Views.lead(v, parts[1]);
    else if (page === 'tg') Views.tg(v);
    else if (page === 'report') Views.report(v);
    else Views.intro(v);
    App.badges();
  },
  badges() { const b = $('#tgbadge'); if (b) { const n = Store.unread(); b.textContent = n || ''; b.hidden = !n; } },
  start() {
    Theme.init();
    Store.load();
    window.addEventListener('hashchange', () => App.render());
    // время идёт само: раз в 30 секунд проверяем просрочки
    setInterval(() => {
      const n = Store.scan(); if (n) Store.save();
      const [path] = location.hash.slice(1).split('?'), page = path.split('/')[1];
      const busy = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
      if (!busy && ['board', 'report', 'tg'].includes(page)) App.render(true); else App.badges();
    }, 30000);
    App.render();
  },
};

App.start();
