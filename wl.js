// ─── WatchFolio Shared Helper ─────────────────────────────
// <script src="wl.js"></script> on every page
// ──────────────────────────────────────────────────────────

const WL_SUPABASE_URL      = 'https://vhnbulihurzpzdzdivlc.supabase.co';
const WL_SUPABASE_ANON_KEY = 'sb_publishable_OzoDhNIRlJhfvLiZYs3myg_hJNTxyPq';
const WL_TMDB_KEY          = '12c07491ff5d8b932fe25c2d554dddbf';
const WL_TMDB_BASE         = 'https://api.themoviedb.org/3';
const WL_IMG_BASE          = 'https://image.tmdb.org/t/p/w300';

if (!window._wlSupabase) {
  window._wlSupabase = window.supabase.createClient(WL_SUPABASE_URL, WL_SUPABASE_ANON_KEY);
}
const _wlDb = window._wlSupabase;

let _wlUser         = null;
let _wlIds          = new Set();
let _wlFavMovieIds  = new Set();
let _wlFavSeriesIds = new Set();

// ── ITEM REGISTRY ──
const _wlRegistry = new Map();
function wlRegister(item) { _wlRegistry.set(String(item.id), item); return String(item.id); }
function wlGet(id)        { return _wlRegistry.get(String(id)); }

// ── THEME ──
const WL_THEMES = [
  { id:'red',    accent:'#e63946', accent2:'#f4a261' },
  { id:'blue',   accent:'#3b82f6', accent2:'#60a5fa' },
  { id:'green',  accent:'#22c55e', accent2:'#86efac' },
  { id:'purple', accent:'#a855f7', accent2:'#c084fc' },
  { id:'orange', accent:'#f97316', accent2:'#fb923c' },
  { id:'pink',   accent:'#ec4899', accent2:'#f9a8d4' },
  { id:'teal',   accent:'#14b8a6', accent2:'#5eead4' },
  { id:'gold',   accent:'#eab308', accent2:'#fde047' },
];
function wlApplyTheme(id) {
  const t = WL_THEMES.find(t=>t.id===id) || WL_THEMES[0];
  document.documentElement.style.setProperty('--accent',  t.accent);
  document.documentElement.style.setProperty('--accent2', t.accent2);
  localStorage.setItem('wf_theme', id);
  document.querySelectorAll('.theme-dot').forEach(d => {
    const isActive = d.dataset.theme === id;
    d.classList.toggle('active', isActive);
    d.style.borderColor = isActive ? 'white' : 'transparent';
  });
}
function wlInitTheme() { wlApplyTheme(localStorage.getItem('wf_theme') || 'red'); }
function wlAccent()    { return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e63946'; }
function wlRenderThemePicker(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  const cur = localStorage.getItem('wf_theme') || 'red';
  c.innerHTML = WL_THEMES.map(t => `
    <button class="theme-dot ${t.id===cur?'active':''}" data-theme="${t.id}"
      title="${t.id}" onclick="wlApplyTheme('${t.id}')"
      style="background:${t.accent};width:18px;height:18px;border-radius:50%;
      border:2px solid ${t.id===cur?'white':'transparent'};
      cursor:pointer;transition:transform .15s,border-color .15s;padding:0;flex-shrink:0;">
    </button>`).join('');
}

// ── INIT ──
async function wlInit() {
  wlInitTheme();
  const { data:{ session } } = await _wlDb.auth.getSession();
  _wlUser = session?.user ?? null;
  if (_wlUser) await Promise.all([_wlLoadIds(), _wlLoadFavIds()]);
  return _wlUser;
}
async function _wlLoadIds() {
  const { data } = await _wlDb.from('watchlist').select('movie_id').eq('user_id', _wlUser.id);
  _wlIds = new Set((data||[]).map(r => r.movie_id));
}
async function _wlLoadFavIds() {
  const { data } = await _wlDb.from('profiles').select('fav_movies,fav_series').eq('id',_wlUser.id).single();
  if (data) {
    _wlFavMovieIds  = new Set((data.fav_movies  ||[]).map(f=>f.id));
    _wlFavSeriesIds = new Set((data.fav_series  ||[]).map(f=>f.id));
  }
}

// ── STATUS PICKER ──
const WL_STATUSES = [
  { value:'watching',   label:'▶  Watching'      },
  { value:'completed',  label:'✓  Completed'      },
  { value:'planning',   label:'🕐  Plan to Watch' },
  { value:'rewatching', label:'🔁  Rewatching'    },
  { value:'paused',     label:'⏸  Paused'         },
  { value:'dropped',    label:'✕  Dropped'        },
];
let _picker = null;

function wlShowStatusPicker(btnEl, itemId, mouseEvent) {
  // handle case where btnEl is actually the event (old call style)
  if (btnEl && btnEl.type === 'click') { mouseEvent = btnEl; btnEl = mouseEvent.currentTarget; }

  const item = wlGet(String(itemId));
  if (!item) {
    console.warn('wlShowStatusPicker: item not found for id:', itemId, '| registry size:', _wlRegistry.size);
    wlToast('Error: item not found. Try refreshing.');
    return;
  }
  if (!_wlUser) { wlToast('Log in to add to watchlist!'); setTimeout(()=>location.href='login.html',800); return; }
  if (wlIsInList(item.id)) { wlToast('Already in your watchlist!'); return; }

  if (_picker) { _picker.remove(); _picker = null; }

  const p = document.createElement('div');
  p.style.cssText = `
    position:fixed;z-index:999999;
    background:#13131a;border:1px solid #333;
    border-radius:10px;padding:6px;
    display:flex;flex-direction:column;gap:2px;
    box-shadow:0 8px 40px rgba(0,0,0,.9);
    min-width:185px;font-family:'DM Sans',sans-serif;
  `;
  WL_STATUSES.forEach(opt => {
    const b = document.createElement('button');
    b.textContent = opt.label;
    b.style.cssText = `background:none;border:none;color:#f0eee8;padding:10px 14px;
      text-align:left;cursor:pointer;border-radius:6px;font-size:13px;
      font-family:'DM Sans',sans-serif;transition:background .12s;width:100%;`;
    b.onmouseenter = () => b.style.background = 'rgba(255,255,255,.08)';
    b.onmouseleave = () => b.style.background = 'none';
    b.onclick = (e) => { e.stopPropagation(); p.remove(); _picker=null; _wlAdd(item, opt.value, btnEl); };
    p.appendChild(b);
  });
  document.body.appendChild(p);
  _picker = p;

  // position at cursor if event passed, else near button
  const pw = 190;
  const ph = WL_STATUSES.length * 44 + 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let cx, cy;
  if (mouseEvent && mouseEvent.clientX !== undefined) {
    cx = mouseEvent.clientX;
    cy = mouseEvent.clientY;
  } else {
    const r = btnEl.getBoundingClientRect();
    cx = r.left;
    cy = r.bottom;
  }

  // keep within viewport
  let left = cx;
  if (left + pw > vw - 8) left = vw - pw - 8;
  if (left < 8) left = 8;

  let top = cy + 8;
  if (top + ph > vh - 8) top = cy - ph - 8; // flip above cursor
  if (top < 8) top = 8;

  p.style.left = `${left}px`;
  p.style.top  = `${top}px`;

  setTimeout(() => {
    function outside(e) {
      if (!p.contains(e.target) && e.target !== btnEl) {
        p.remove(); _picker = null;
        document.removeEventListener('click', outside);
      }
    }
    document.addEventListener('click', outside);
  }, 10);
}

async function _wlAdd(item, status, btnEl) {
  if (wlIsInList(item.id)) { wlToast('Already in your watchlist!'); return; }
  let country = null;
  try {
    const r = await fetch(`${WL_TMDB_BASE}/${item.type}/${item.id}?api_key=${WL_TMDB_KEY}`);
    const d = await r.json();
    country = d.production_countries?.[0]?.iso_3166_1 || d.origin_country?.[0] || null;
  } catch(e) {}
  const { error } = await _wlDb.from('watchlist').insert({
    user_id:  _wlUser.id,
    movie_id: item.id,
    title:    item.title,
    poster:   item.poster || null,
    rating:   String(item.tmdbRating || ''),
    year:     String(item.year || ''),
    type:     item.type,
    status,
    country,
  });
  if (error) { wlToast(error.message || 'Error saving'); return; }
  _wlIds.add(item.id);
  wlToast(`"${item.title}" added as ${status}!`);
  if (btnEl) { btnEl.textContent='✓'; btnEl.classList.remove('primary'); btnEl.classList.add('added'); btnEl.disabled=true; }
  const b2 = document.getElementById('wl-btn-'+item.id);
  if (b2 && b2!==btnEl) { b2.textContent='✓'; b2.classList.remove('primary'); b2.classList.add('added'); }
}

// legacy
function wlAdd(item) {
  if (typeof item==='object') wlRegister(item);
  const btn = document.getElementById('bannerWatchlistBtn') || document.body;
  wlShowStatusPicker(btn, String(item.id), null);
}

// ── FAV ──
async function wlToggleFav(itemId) {
  const item = wlGet(String(itemId));
  if (!item) return;
  if (!_wlUser) { wlToast('Log in!'); return; }
  const key   = item.type==='tv' ? 'fav_series' : 'fav_movies';
  const idSet = item.type==='tv' ? _wlFavSeriesIds : _wlFavMovieIds;
  const { data:prof } = await _wlDb.from('profiles').select(key).eq('id',_wlUser.id).single();
  let favs = prof?.[key] || [];
  const idx = favs.findIndex(f=>f.id===item.id);
  if (idx>=0) {
    favs.splice(idx,1); idSet.delete(item.id); wlToast('Removed from favourites');
  } else {
    if (favs.length>=5) { wlToast('Max 5 favourites per category!'); return; }
    const poster = item.poster
      ? (item.poster.startsWith('http') ? item.poster : `${WL_IMG_BASE}${item.poster}`)
      : null;
    favs.push({ id:item.id, title:item.title, poster });
    idSet.add(item.id); wlToast('Added to favourites!');
  }
  await _wlDb.from('profiles').upsert({ id:_wlUser.id, [key]:favs });
  const fb = document.getElementById(`fav-btn-${item.id}`);
  if (fb) fb.style.color = idSet.has(item.id) ? 'var(--accent)' : 'rgba(255,255,255,.5)';
}

function wlIsInList(id) { return _wlIds.has(Number(id)) || _wlIds.has(String(id)); }
function wlIsFav(id,type) { return type==='tv' ? _wlFavSeriesIds.has(id) : _wlFavMovieIds.has(id); }

// ── TOAST ──
function wlToast(msg) {
  let t = document.getElementById('_wlToast');
  if (!t) {
    t = document.createElement('div'); t.id='_wlToast';
    t.style.cssText='position:fixed;bottom:28px;right:28px;background:#13131a;border:1px solid #2a2a3a;border-left:3px solid var(--accent);color:#f0eee8;padding:12px 20px;border-radius:8px;font-size:13px;font-family:"DM Sans",sans-serif;opacity:0;transform:translateY(10px);transition:all .3s;pointer-events:none;z-index:999999;max-width:280px;';
    document.body.appendChild(t);
  }
  t.textContent=msg; t.style.opacity='1'; t.style.transform='translateY(0)';
  clearTimeout(t._t);
  t._t=setTimeout(()=>{t.style.opacity='0';t.style.transform='translateY(10px)';},2500);
}

// ── SHARED MEDIA MODAL (used by all pages) ──
// Opens a rich detail modal for any movie/TV item
// Requires: #wlMediaModal in the page HTML (injected by wlInjectModal)
function wlInjectModal() {
  if (document.getElementById('wlMediaModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
  <div id="wlMediaModal" style="display:none;position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.88);backdrop-filter:blur(8px);overflow-y:auto;">
    <div style="max-width:720px;margin:40px auto 60px;background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden;position:relative;">
      <button onclick="wlCloseModal()" style="position:absolute;top:14px;right:14px;background:rgba(0,0,0,.6);border:1px solid var(--border);color:var(--text);width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;z-index:10;">✕</button>
      <div id="wlModalBackdrop" style="width:100%;height:240px;background:var(--bg);background-size:cover;background-position:center;"></div>
      <div style="padding:24px;">
        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center;">
          <span id="wlModalBadge" style="background:var(--accent);color:white;font-size:10px;font-weight:600;padding:3px 10px;border-radius:4px;letter-spacing:1px;text-transform:uppercase;"></span>
          <span id="wlModalTmdb" style="background:rgba(0,0,0,.5);color:var(--accent2);font-size:12px;padding:3px 10px;border-radius:4px;border:1px solid var(--border);"></span>
          <span id="wlModalYear" style="color:var(--muted);font-size:13px;padding:3px 6px;"></span>
        </div>
        <div id="wlModalTitle" style="font-family:'Bebas Neue',sans-serif;font-size:2.2rem;letter-spacing:2px;margin-bottom:8px;line-height:1;"></div>
        <div id="wlModalGenres" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;"></div>
        <div id="wlModalDetails" style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:14px;"></div>
        <div id="wlModalAvg" style="display:none;align-items:center;gap:8px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:14px;">
          <div>
            <div id="wlModalAvgNum" style="font-family:'Bebas Neue',sans-serif;font-size:2rem;color:var(--accent2);line-height:1;"></div>
            <div style="font-size:11px;color:var(--muted);">Member Avg Score</div>
          </div>
          <div id="wlModalAvgCount" style="font-size:12px;color:var(--muted);margin-left:4px;"></div>
        </div>
        <div id="wlModalOverview" style="color:var(--muted);font-size:14px;line-height:1.7;margin-bottom:20px;"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button id="wlModalWlBtn" style="background:var(--accent);border:none;color:white;padding:10px 22px;border-radius:6px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;">+ Watchlist</button>
          <button id="wlModalFavBtn" style="background:none;border:1px solid var(--border);color:var(--muted);padding:10px 22px;border-radius:6px;font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;">❤️ Favourite</button>
          <button onclick="wlCloseModal()" style="background:none;border:1px solid var(--border);color:var(--muted);padding:10px 22px;border-radius:6px;font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;">Close</button>
        </div>
      </div>
    </div>
  </div>`);
  document.getElementById('wlMediaModal').addEventListener('click', function(e){ if(e.target===this) wlCloseModal(); });
}

function wlCloseModal() {
  const m = document.getElementById('wlMediaModal');
  if (m) { m.style.display='none'; document.body.style.overflow=''; }
}

async function wlOpenMedia(type, id, regId) {
  wlInjectModal();
  const modal = document.getElementById('wlMediaModal');
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';

  // reset
  document.getElementById('wlModalTitle').textContent    = 'Loading...';
  document.getElementById('wlModalOverview').textContent = '';
  document.getElementById('wlModalBackdrop').style.backgroundImage = '';
  document.getElementById('wlModalGenres').innerHTML     = '';
  document.getElementById('wlModalDetails').innerHTML    = '';
  document.getElementById('wlModalAvg').style.display    = 'none';

  try {
    const [tmdbRes, wlRes] = await Promise.all([
      fetch(`${WL_TMDB_BASE}/${type}/${id}?api_key=${WL_TMDB_KEY}&append_to_response=credits`),
      _wlDb.from('watchlist').select('user_rating').eq('movie_id', id).not('user_rating','is',null),
    ]);
    const d     = await tmdbRes.json();
    const title = d.title||d.name||'Unknown';
    const year  = (d.release_date||d.first_air_date||'').slice(0,4);
    const tmdb  = d.vote_average ? d.vote_average.toFixed(1) : '?';

    document.getElementById('wlModalTitle').textContent    = title;
    document.getElementById('wlModalOverview').textContent = d.overview||'No description available.';
    document.getElementById('wlModalBadge').textContent    = type==='tv'?'TV Show':'Movie';
    document.getElementById('wlModalTmdb').textContent     = `★ ${tmdb} TMDB`;
    document.getElementById('wlModalYear').textContent     = year;
    if (d.backdrop_path) document.getElementById('wlModalBackdrop').style.backgroundImage = `url(https://image.tmdb.org/t/p/w1280${d.backdrop_path})`;

    document.getElementById('wlModalGenres').innerHTML = (d.genres||[]).slice(0,5).map(g=>
      `<span style="background:var(--bg);border:1px solid var(--border);color:var(--muted);font-size:11px;padding:3px 10px;border-radius:99px;">${g.name}</span>`).join('');

    // detail pills — robust fallbacks for both movie and TV
    const dets = [];
    const country = d.production_countries?.[0]?.name
      || (d.origin_country?.[0] ? d.origin_country[0] : null);
    if (country) dets.push(['Country', country]);

    const lang = d.spoken_languages?.[0]?.english_name
      || d.spoken_languages?.[0]?.name
      || d.original_language
      || null;
    if (lang) dets.push(['Language', lang]);

    if (type==='movie' && d.runtime)          dets.push(['Runtime',  `${d.runtime} min`]);
    if (type==='tv' && d.number_of_seasons)   dets.push(['Seasons',  d.number_of_seasons]);
    if (type==='tv' && d.number_of_episodes)  dets.push(['Episodes', d.number_of_episodes]);

    const rel = d.release_date || d.first_air_date || null;
    if (rel) dets.push(['Released', rel]);

    // status (TV only)
    if (type==='tv' && d.status) dets.push(['Status', d.status]);

    document.getElementById('wlModalDetails').innerHTML = dets.length ? dets.map(([l,v])=>`
      <div style="display:flex;flex-direction:column;gap:3px;min-width:80px;">
        <span style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);">${l}</span>
        <span style="font-size:13px;color:var(--text);font-weight:500;">${v}</span>
      </div>`).join('') : '';

    // member avg rating
    const ratings = (wlRes.data||[]).map(r=>r.user_rating).filter(Boolean);
    if (ratings.length) {
      const avg = (ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1);
      document.getElementById('wlModalAvgNum').textContent   = avg;
      document.getElementById('wlModalAvgCount').textContent = `${ratings.length} member${ratings.length>1?'s':''}`;
      document.getElementById('wlModalAvg').style.display    = 'flex';
    }

    // wire buttons
    const regItem = { id:d.id, title, year, tmdbRating:tmdb, type, poster:d.poster_path };
    const mId     = wlRegister(regItem);
    const wlBtn   = document.getElementById('wlModalWlBtn');
    const favBtn  = document.getElementById('wlModalFavBtn');
    const isIn    = wlIsInList(d.id);
    wlBtn.textContent = isIn ? '✓ In Watchlist' : '+ Watchlist';
    wlBtn.disabled    = isIn;
    wlBtn.onclick = isIn ? null : (e) => wlShowStatusPicker(wlBtn, mId, e);
    favBtn.textContent = wlIsFav(d.id,type) ? '💔 Unfavourite' : '❤️ Favourite';
    favBtn.onclick     = () => wlToggleFav(mId);
  } catch(e) {
    document.getElementById('wlModalOverview').textContent='Could not load details.';
  }
}
