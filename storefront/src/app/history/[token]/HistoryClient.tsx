'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';

interface Entry {
  id: string;
  entryDate: string;
  pageCount: number;
  source: string;
  imageUrls: string[];
}

interface HistoryData {
  customer: { name: string; phone: string | null };
  entries: Entry[];
}

interface Slide { url: string | null; date: string; seed: number; pg: number; }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Words that appear in stored customer names but are not part of the actual name
const JUNK_RE = /^(delivery|deliveries|deliv|customer|customers|cust|apna|chotu|aab|shop|stores?|home|house|order)$/i;

function cleanName(raw: string): string {
  const words = raw.trim().split(/\s+/);
  const filtered = words.filter(w => !JUNK_RE.test(w));
  return (filtered.length ? filtered : words).join(' ');
}
const MILESTONES: Record<number, string> = {
  0: 'First order', 24: '25th order', 49: '50th order',
  74: '75th order', 99: '100th order', 124: '125th order',
};

function drawNotebook(canvas: HTMLCanvasElement, W: number, H: number, seed: number) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.fillStyle = '#F5F0E6'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#D8C8A8'; ctx.lineWidth = 0.6;
  for (let y = 22; y < H - 4; y += 12) { ctx.beginPath(); ctx.moveTo(6, y); ctx.lineTo(W - 4, y); ctx.stroke(); }
  ctx.strokeStyle = '#C8705A'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(14, H); ctx.stroke();
  let rng = ((seed * 1664525 + 1013904223) | 0) >>> 0;
  const rand = () => { rng = ((rng * 1664525 + 1013904223) | 0) >>> 0; return rng / 4294967296; };
  const nLines = Math.floor((H - 26) / 12);
  for (let i = 0; i < nLines; i++) {
    const y = 26 + i * 12; if (rand() < 0.07) continue;
    ctx.strokeStyle = `rgba(44,27,16,${(0.45 + rand() * 0.4).toFixed(2)})`; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(18, y);
    let x = 18; const tw = (0.4 + rand() * 0.45) * (W - 26);
    while (x < 18 + tw) {
      const nx = Math.min(18 + tw, x + 5);
      ctx.quadraticCurveTo((x + nx) / 2, y + (rand() - 0.5) * 1.5, nx, y + (rand() - 0.5) * 0.7);
      x = nx;
    }
    ctx.stroke();
  }
}

export default function HistoryClient({ data }: { data: HistoryData }) {
  // Chronological (oldest first) for milestone numbering + display
  const ordered = useMemo(() => [...data.entries].reverse(), [data.entries]);

  // Flat slide list for lightbox
  const slides = useMemo<Slide[]>(() => {
    const result: Slide[] = []; let seed = 100;
    ordered.forEach(e => {
      const d = new Date(e.entryDate);
      const ds = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
      if (e.imageUrls.length > 0) {
        e.imageUrls.forEach((url, pi) => result.push({ url, date: ds, seed: seed++, pg: pi + 1 }));
      } else {
        result.push({ url: null, date: ds, seed: seed++, pg: 1 });
      }
    });
    return result;
  }, [ordered]);

  // Slide start index per entry (for mapping entry → lightbox index)
  const slideStarts = useMemo(() => {
    const arr: number[] = []; let c = 0;
    ordered.forEach(e => { arr.push(c); c += Math.max(1, e.imageUrls.length); });
    return arr;
  }, [ordered]);

  // Activity data per year/month
  const { act, yearMonthMap, yearCounts, years } = useMemo(() => {
    const act: Record<string, number> = {};
    const yearMonthMap: Record<string, string[]> = {};
    const yearCounts: Record<string, number> = {};
    const seenMK = new Set<string>();
    ordered.forEach(e => {
      const d = new Date(e.entryDate);
      const yr = String(d.getUTCFullYear());
      const mk = `${yr}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      act[mk] = (act[mk] || 0) + 1;
      yearCounts[yr] = (yearCounts[yr] || 0) + 1;
      if (!yearMonthMap[yr]) yearMonthMap[yr] = [];
      if (!seenMK.has(mk)) { yearMonthMap[yr].push(MONTHS[d.getUTCMonth()]); seenMK.add(mk); }
    });
    return { act, yearMonthMap, yearCounts, years: Object.keys(yearMonthMap).sort() };
  }, [ordered]);

  // Stats
  const firstYear = years[0] ? parseInt(years[0]) : new Date().getFullYear();
  const yearsWithUs = new Date().getFullYear() - firstYear;
  const lastE = data.entries[0];
  const lastD = lastE ? new Date(lastE.entryDate) : null;
  const lastStr = lastD ? `${lastD.getUTCDate()} ${MONTHS[lastD.getUTCMonth()]} ${lastD.getUTCFullYear()}` : '—';
  const nameParts = cleanName(data.customer.name).split(/\s+/);
  const firstName = nameParts[0];
  const restName = nameParts.slice(1).join(' ');

  // Lightbox
  const [lbOpen, setLbOpen] = useState(false);
  const [lbIdx, setLbIdx] = useState(0);
  const lbImgRef = useRef<HTMLImageElement>(null);
  const lbCnvRef = useRef<HTMLCanvasElement>(null);
  const slidesRef = useRef(slides);
  slidesRef.current = slides;

  const openLb = useCallback((idx: number) => { setLbIdx(idx); setLbOpen(true); }, []);
  const closeLb = useCallback(() => setLbOpen(false), []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (!lbOpen) return;
      if (e.key === 'Escape') { closeLb(); return; }
      if (e.key === 'ArrowLeft') setLbIdx(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setLbIdx(i => Math.min(slidesRef.current.length - 1, i + 1));
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [lbOpen, closeLb]);

  // Render lightbox image when slide changes
  useEffect(() => {
    if (!lbOpen) return;
    const slide = slidesRef.current[lbIdx];
    const img = lbImgRef.current; const cnv = lbCnvRef.current;
    if (!img || !cnv || !slide) return;
    if (slide.url) {
      cnv.style.display = 'none'; img.style.display = 'block'; img.src = slide.url;
      img.onerror = () => {
        img.style.display = 'none'; cnv.style.display = 'block';
        drawNotebook(cnv, 360, 468, slide.seed);
      };
    } else {
      img.style.display = 'none'; cnv.style.display = 'block';
      drawNotebook(cnv, 360, 468, slide.seed);
    }
  }, [lbOpen, lbIdx]);

  // Nav state
  const [activeYear, setActiveYear] = useState(years[years.length - 1] || '');

  // Canvas dot-grid activity map
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotTipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !years.length) return;
    const dotPos: Record<string, { cx: number; cy: number; r: number }> = {};
    const CW = 22, RH = 26, PAD_L = 36, PAD_T = 18;

    function draw() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const W = (canvas.parentElement?.clientWidth ?? 300) - 32;
      const H = years.length * RH + PAD_T + 10;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      const ctx = canvas.getContext('2d')!; ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);
      ctx.font = `500 7px 'Hanken Grotesk',system-ui,sans-serif`;
      ctx.fillStyle = '#6A5340'; ctx.textAlign = 'center';
      MONTHS.forEach((mn, mi) => ctx.fillText(mn[0], PAD_L + mi * CW + CW / 2, PAD_T - 5));
      years.forEach((yr, yi) => {
        const baseY = PAD_T + yi * RH;
        ctx.font = `600 9px 'Hanken Grotesk',system-ui,sans-serif`;
        ctx.fillStyle = '#6A5340'; ctx.textAlign = 'right';
        ctx.fillText(yr, PAD_L - 4, baseY + RH / 2 + 3);
        MONTHS.forEach((_, mi) => {
          const key = `${yr}-${String(mi + 1).padStart(2, '0')}`;
          const cx = PAD_L + mi * CW + CW / 2, cy = baseY + RH / 2, r = 6.5;
          dotPos[key] = { cx, cy, r };
          if (act[key]) {
            ctx.beginPath(); ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(217,131,36,.12)'; ctx.fill();
            const g = ctx.createRadialGradient(cx - 1, cy - 1, 1, cx, cy, r);
            g.addColorStop(0, '#D98324'); g.addColorStop(1, '#AE5E16');
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = g; ctx.fill();
            if (act[key] > 1) {
              ctx.fillStyle = '#fff';
              ctx.font = `bold 6.5px 'Hanken Grotesk',system-ui,sans-serif`;
              ctx.textAlign = 'center';
              ctx.fillText(String(act[key]), cx, cy + 2.3);
            }
          } else {
            ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(44,27,16,.18)'; ctx.lineWidth = 1; ctx.stroke();
          }
        });
      });
    }

    draw();

    const getHit = (cx: number, cy: number) => {
      if (!canvas) return null;
      const dpr = window.devicePixelRatio || 1, rect = canvas.getBoundingClientRect();
      const px = (cx - rect.left) * (canvas.width / rect.width / dpr);
      const py = (cy - rect.top) * (canvas.height / rect.height / dpr);
      for (const [key, p] of Object.entries(dotPos))
        if (Math.hypot(px - p.cx, py - p.cy) <= p.r + 4 && act[key]) return key;
      return null;
    };

    let tipTimer: ReturnType<typeof setTimeout>;
    const showTip = (key: string, x: number, y: number, brief: boolean) => {
      const tip = dotTipRef.current; if (!tip) return;
      const [yr, mo] = key.split('-');
      tip.textContent = `${MONTHS[parseInt(mo) - 1]} ${yr} · ${act[key]} order${act[key] > 1 ? 's' : ''}`;
      tip.style.display = 'block'; tip.style.left = x + 'px'; tip.style.top = y + 'px';
      clearTimeout(tipTimer);
      if (brief) tipTimer = setTimeout(() => { if (dotTipRef.current) dotTipRef.current.style.display = 'none'; }, 2000);
    };
    const hideTip = () => { clearTimeout(tipTimer); if (dotTipRef.current) dotTipRef.current.style.display = 'none'; };

    const onClick = (e: MouseEvent) => {
      const key = getHit(e.clientX, e.clientY); if (!key) return;
      const yr = key.split('-')[0]; setActiveYear(yr);
      document.getElementById('e-' + key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const onMove = (e: MouseEvent) => {
      const key = getHit(e.clientX, e.clientY);
      if (key) { showTip(key, e.clientX + 14, e.clientY - 24, false); canvas.style.cursor = 'pointer'; }
      else { hideTip(); canvas.style.cursor = 'default'; }
    };
    const onLeave = () => hideTip();

    // Touch: needed for phone users who receive this link on WhatsApp
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]; if (!t) return;
      const key = getHit(t.clientX, t.clientY); if (!key) return;
      e.preventDefault();
      const yr = key.split('-')[0]; setActiveYear(yr);
      showTip(key, t.clientX - 60, t.clientY - 44, true); // brief tooltip above finger
      document.getElementById('e-' + key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    canvas.addEventListener('click', onClick);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    const ro = new ResizeObserver(draw);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    return () => {
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('touchend', onTouchEnd);
      clearTimeout(tipTimer);
      ro.disconnect();
    };
  }, [years, act]);

  // Lazy-load page thumbnails via IntersectionObserver
  const timelineRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tl = timelineRef.current; if (!tl) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const thumb = en.target as HTMLElement;
        const seed = parseInt(thumb.dataset.seed ?? '0');
        const url = thumb.dataset.url ?? '';
        thumb.querySelector('.thumb-skel')?.remove();
        if (url) {
          const img = document.createElement('img');
          img.loading = 'lazy'; img.src = url;
          img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:10px';
          img.onerror = () => {
            img.remove();
            const cnv = document.createElement('canvas');
            cnv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
            thumb.appendChild(cnv); drawNotebook(cnv, 82, 107, seed);
          };
          thumb.appendChild(img);
        } else {
          const cnv = document.createElement('canvas');
          cnv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
          thumb.appendChild(cnv); drawNotebook(cnv, 82, 107, seed);
        }
        obs.unobserve(thumb);
      });
    }, { rootMargin: '500px' });
    tl.querySelectorAll('.page-thumb').forEach(t => obs.observe(t));
    return () => obs.disconnect();
  }, [ordered]);

  const shareLink = () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: `${data.customer.name}'s Order History`, url: window.location.href });
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  // Build timeline JSX: year blocks → entries, track milestone counter
  const timelineJsx = useMemo(() => {
    let oi = 0;
    return years.map(yr => {
      const seenMK = new Set<string>();
      const yearEntries = ordered
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => new Date(e.entryDate).getUTCFullYear() === parseInt(yr));

      const items = yearEntries.map(({ e, i }) => {
        const d = new Date(e.entryDate);
        const mk = `${yr}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        const day = String(d.getUTCDate()).padStart(2, '0');
        const mon = MONTHS[d.getUTCMonth()];
        const dateStr = `${d.getUTCDate()} ${mon} ${yr}`;
        const ss = slideStarts[i];
        const milestone = MILESTONES[oi];
        const anchorId = seenMK.has(mk) ? undefined : 'e-' + mk;
        if (!seenMK.has(mk)) seenMK.add(mk);
        oi++;

        return (
          <div key={e.id}>
            {milestone && (
              <div className="hp-milestone">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                {milestone} &nbsp;·&nbsp; {dateStr}
              </div>
            )}
            <div id={anchorId} className="hp-entry">
              <div className="hp-date-stamp">
                <div className="hp-ds-day">{day}</div>
                <div className="hp-ds-mon">{mon}</div>
              </div>
              <div className="hp-entry-sep" />
              <div className="hp-entry-body">
                {e.imageUrls.length > 0 ? (
                  <div className="hp-img-strip">
                    {e.imageUrls.map((url, pi) => (
                      <div
                        key={pi}
                        className="hp-page-thumb page-thumb"
                        data-url={url}
                        data-seed={String(ss + pi + 100)}
                        onClick={() => openLb(ss + pi)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={ev => ev.key === 'Enter' && openLb(ss + pi)}
                        aria-label={`View order list page ${pi + 1}`}
                      >
                        <div className="thumb-skel" />
                        <span className="hp-pg-num">pg {pi + 1}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="hp-doc-only">
                    <div className="hp-doc-icon" aria-hidden="true">
                      <svg width="11" height="13" viewBox="0 0 14 16" fill="rgba(255,255,255,.9)">
                        <path d="M2 0h8l4 4v12H0V0h2zm7 0v4h4L9 0zM2 6h10v1H2V6zm0 3h10v1H2V9zm0 3h6v1H2v-1z"/>
                      </svg>
                    </div>
                    Order list
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      });

      return (
        <div key={yr} id={`yr-${yr}`} className="hp-yr-block">
          <div className="hp-yr-div">
            <div className="hp-yr-label">
              <span className="hp-yr-text">{yr}</span>
              <span className="hp-yr-tally">{yearCounts[yr]} order{yearCounts[yr] !== 1 ? 's' : ''}</span>
            </div>
          </div>
          {items}
        </div>
      );
    });
  }, [ordered, years, yearCounts, slideStarts, openLb]);

  const currentSlide = slides[lbIdx];

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="hp-wrap">
        {/* Hero */}
        <section className="hp-hero">
          <div className="hp-hero-seal">
            <div className="hp-seal" aria-hidden="true">
              <svg className="hp-seal-ring" viewBox="0 0 230 230" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <path id="hpc" fill="none" d="M115,115 m-92,0 a92,92 0 1,1 184,0 a92,92 0 1,1 -184,0"/>
                </defs>
                <text>
                  <textPath href="#hpc" startOffset="0">PURE · TRUST · QUALITY · SINCE 1980 · PURE · TRUST · QUALITY · SINCE 1980 · </textPath>
                </text>
              </svg>
              <div className="hp-seal-core">
                <div className="hp-seal-yr">1980</div>
                <div className="hp-seal-leaf" />
                <div className="hp-seal-sub">Kirana &amp; General</div>
              </div>
            </div>
          </div>
          <div className="hp-hero-copy">
            <div className="hp-eyebrow">Your personal order history</div>
            <h1 className="hp-hero-name">
              {firstName}{restName && <> <em>{restName}</em></>}
            </h1>
            {data.customer.phone && (
              <p className="hp-hero-sub">
                +91 {data.customer.phone.replace(/^(\d{5})(\d{5})$/, '$1 $2')} &nbsp;·&nbsp; Valued customer
              </p>
            )}
          </div>
        </section>

        {/* Stats row */}
        <div className="hp-stats-row">
          <div className="hp-stat-card">
            <div className="hp-stat-label">Customer since</div>
            <div className="hp-stat-val hp-stat-sm">{firstYear}</div>
          </div>
          <div className="hp-stat-card">
            <div className="hp-stat-label">Total orders</div>
            <div className="hp-stat-val">{ordered.length}</div>
          </div>
          <div className="hp-stat-card">
            <div className="hp-stat-label">Last order</div>
            <div className="hp-stat-val hp-stat-sm">{lastStr}</div>
          </div>
          <div className="hp-stat-card">
            <div className="hp-stat-label">Years with us</div>
            <div className="hp-stat-val">{yearsWithUs > 0 ? `${yearsWithUs}+` : '1'}</div>
          </div>
        </div>

        {/* Personal letter */}
        <div className="hp-letter-card">
          <div className="hp-letter-greeting">Hello {firstName}, welcome back!</div>
          <h2 className="hp-letter-headline">&ldquo;Your kitchen, <em>our shelves.</em>&rdquo;</h2>
          <div className="hp-letter-body">
            <p>Some customers walk in. Some call. You chose to write.</p>
            <p>Every list you sent — page after page, season after season — arrived here as a kind of trust. You wrote what your home needed, and we made sure it was packed and ready. That has not changed. Not through the rains, not through the years.</p>
            <p>We have read every line. Packed every item. And somewhere along the way, without either of us saying so, this became a relationship — not just a transaction.</p>
            <p>A store remembers the customers who stay. <em>You are one of them.</em></p>
            <p>Thank you for trusting us with your kitchen, {firstName}.</p>
          </div>
          <div className="hp-letter-sig">
            <div>
              <div className="hp-sig-store">Srivani Stores</div>
              <div className="hp-sig-sub">Sangareddy · Est. 1980</div>
            </div>
            <div className="hp-sig-badge" aria-hidden="true">SRI<br/>VANI<br/><span style={{fontSize:'9px',fontWeight:400}}>1980</span></div>
          </div>
        </div>

        {/* How-to */}
        <div className="hp-howto-card">
          <div className="hp-eyebrow">How to use this page</div>
          <div className="hp-howto-list">
            <div className="hp-howto-row">
              <div className="hp-howto-ic" aria-hidden="true">●</div>
              <div className="hp-howto-text">
                <strong>Tap a dot on the grid below</strong>
                <span>Each filled dot is a month you ordered. Tap to jump directly to those orders.</span>
              </div>
            </div>
            <div className="hp-howto-row">
              <div className="hp-howto-ic" aria-hidden="true">📷</div>
              <div className="hp-howto-text">
                <strong>Tap any thumbnail</strong>
                <span>Opens your handwritten list full screen. Use Prev / Next to flip through pages.</span>
              </div>
            </div>
            <div className="hp-howto-row">
              <div className="hp-howto-ic" aria-hidden="true">⋮</div>
              <div className="hp-howto-text">
                <strong>Year and month tabs</strong>
                <span>The bar below sticks to the top as you scroll — tap any year or month to jump there.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Activity dot grid */}
        <div className="hp-grid-section">
          <div className="hp-grid-label">Order activity — tap any dot to jump →</div>
          <div className="hp-grid-card">
            <canvas ref={canvasRef} style={{display:'block',width:'100%',cursor:'default'}} />
          </div>
        </div>
      </div>

      {/* Sticky nav */}
      <div className="hp-sticky-nav">
        <div className="hp-sticky-inner">
          <div className="hp-year-tabs">
            {years.map(yr => (
              <button
                key={yr}
                className={`hp-ytab${activeYear === yr ? ' active' : ''}`}
                onClick={() => {
                  setActiveYear(yr);
                  document.getElementById('yr-' + yr)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >{yr}</button>
            ))}
          </div>
          <div className="hp-month-pills">
            {(yearMonthMap[activeYear] || []).map(mn => {
              const mi = MONTHS.indexOf(mn) + 1;
              return (
                <button
                  key={mn}
                  className="hp-mpill"
                  onClick={() =>
                    document.getElementById(`e-${activeYear}-${String(mi).padStart(2, '0')}`)
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                >{mn}</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="hp-wrap" style={{paddingTop:0}}>
        <div className="hp-timeline" ref={timelineRef}>
          {timelineJsx}
        </div>
      </div>

      {/* Fixed action bar */}
      <div className="hp-actions">
        <button className="hp-btn-shop" onClick={() => { window.location.href = '/products'; }}>
          Shop Now
        </button>
        <button className="hp-btn-share" onClick={shareLink}>
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#25D366" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51-.17 0-.37-.01-.57-.01s-.52.07-.79.37c-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zm-5.42 7.4h-.01a9.87 9.87 0 01-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37A9.86 9.86 0 012.16 11.9C2.16 6.44 6.6 2 12.05 2c2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 012.89 7c0 5.45-4.44 9.88-9.88 9.88zm8.41-18.3A11.82 11.82 0 0012.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 005.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.89a11.82 11.82 0 00-3.48-8.41z"/>
          </svg>
          Share
        </button>
      </div>

      {/* Lightbox */}
      {lbOpen && (
        <div
          className="hp-lb"
          role="dialog"
          aria-modal="true"
          aria-label="Order list viewer"
          onClick={e => { if (e.target === e.currentTarget) closeLb(); }}
        >
          <div className="hp-lb-inner">
            <button className="hp-lb-close" onClick={closeLb} aria-label="Close">×</button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={lbImgRef}
              alt="Order list"
              style={{display:'none',maxWidth:'100%',maxHeight:'78vh',objectFit:'contain',borderRadius:'12px',margin:'0 auto'}}
            />
            <canvas
              ref={lbCnvRef}
              style={{display:'none',width:'100%',borderRadius:'12px'}}
            />
            <div className="hp-lb-date">
              {currentSlide?.date} · pg {currentSlide?.pg}
            </div>
            <div className="hp-lb-nav">
              {lbIdx > 0 && (
                <button className="hp-lb-nav-btn" onClick={() => setLbIdx(i => i - 1)}>← Prev</button>
              )}
              {lbIdx < slides.length - 1 && (
                <button className="hp-lb-nav-btn" onClick={() => setLbIdx(i => i + 1)}>Next →</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tooltip for canvas dots */}
      <div ref={dotTipRef} className="hp-dot-tip" aria-hidden="true" />
    </>
  );
}

const CSS = `
body { background: #FAF3E4 !important; overflow-x: hidden; }
body::before {
  content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: .5;
  background:
    radial-gradient(900px 500px at 78% -8%, rgba(217,131,36,.18), transparent 60%),
    radial-gradient(700px 600px at -10% 110%, rgba(124,45,26,.10), transparent 60%);
}
.hp-wrap {
  position: relative; z-index: 1;
  max-width: 960px; margin: 0 auto; padding: 0 24px 140px;
}
/* ── Hero ── */
.hp-hero {
  padding: 40px 0 28px; display: flex;
  align-items: flex-start; gap: 24px; flex-wrap: wrap;
}
.hp-seal { position: relative; width: 90px; height: 90px; flex-shrink: 0; }
.hp-seal-ring {
  width: 100%; height: 100%;
  animation: hp-spin 26s linear infinite; overflow: visible;
}
.hp-seal-ring text {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-size: 12.2px; letter-spacing: 3.5px;
  text-transform: uppercase; fill: #6A5340; font-weight: 600;
}
@keyframes hp-spin { to { transform: rotate(360deg); } }
.hp-seal-core {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center;
}
.hp-seal-yr {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 900; font-size: 18px; color: #AE5E16; line-height: 1;
}
.hp-seal-leaf { width: 12px; height: 1px; background: #4E7A41; margin: 4px 0; }
.hp-seal-sub {
  font-size: 4.5px; letter-spacing: 1.2px;
  text-transform: uppercase; color: #6A5340;
}
.hp-hero-copy { flex: 1; min-width: 220px; }
.hp-eyebrow {
  font-size: 11px; letter-spacing: 4px; text-transform: uppercase;
  color: #AE5E16; font-weight: 600; margin-bottom: 8px;
}
.hp-hero-name {
  font-family: 'Fraunces', Georgia, serif;
  font-size: clamp(34px, 5vw, 52px); font-weight: 500;
  line-height: 1.05; letter-spacing: -1px;
  color: #2C1B10; margin: 0 0 6px;
}
.hp-hero-name em { font-style: italic; color: #AE5E16; }
.hp-hero-sub { font-size: 15px; color: #6A5340; margin: 0; }
/* ── Stats ── */
.hp-stats-row {
  display: flex; gap: 12px; flex-wrap: wrap;
  padding: 22px 0 28px;
  border-bottom: 1px solid rgba(44,27,16,.14);
  margin-bottom: 32px;
}
.hp-stat-card {
  background: rgba(255,255,255,.55);
  border: 1px solid rgba(44,27,16,.14);
  border-radius: 14px; padding: 16px 22px;
  flex: 1; min-width: 110px;
  transition: border-color .2s, transform .2s;
}
.hp-stat-card:hover { border-color: rgba(217,131,36,.4); transform: translateY(-2px); }
.hp-stat-label {
  font-size: 10.5px; font-weight: 600; letter-spacing: 2px;
  text-transform: uppercase; color: #6A5340; margin-bottom: 6px;
}
.hp-stat-val {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 26px; font-weight: 900; color: #AE5E16; line-height: 1;
}
.hp-stat-sm { font-size: 16px; line-height: 1.25; }
/* ── Letter ── */
.hp-letter-card {
  background: rgba(255,255,255,.55);
  border: 1px solid rgba(44,27,16,.14);
  border-radius: 18px; padding: 32px 30px 28px; margin-bottom: 24px;
}
.hp-letter-greeting {
  font-size: 11px; letter-spacing: 3.5px; text-transform: uppercase;
  color: #AE5E16; font-weight: 600; margin-bottom: 12px;
}
.hp-letter-headline {
  font-family: 'Fraunces', Georgia, serif;
  font-size: clamp(22px, 3vw, 28px); font-weight: 400;
  line-height: 1.25; color: #2C1B10; margin: 0 0 18px; letter-spacing: -.3px;
}
.hp-letter-headline em { font-style: italic; color: #6A5340; }
.hp-letter-body { font-size: 14.5px; color: #6A5340; line-height: 1.8; }
.hp-letter-body p { margin: 0; }
.hp-letter-body p + p { margin-top: 12px; }
.hp-letter-body em {
  font-family: 'Fraunces', Georgia, serif;
  font-style: italic; font-size: 15px; color: #2C1B10;
}
.hp-letter-sig {
  margin-top: 24px; padding-top: 18px;
  border-top: 1px solid rgba(44,27,16,.14);
  display: flex; align-items: center; justify-content: space-between;
}
.hp-sig-store { font-size: 13px; font-weight: 600; color: #2C1B10; line-height: 1.4; }
.hp-sig-sub { font-size: 11px; color: #6A5340; margin-top: 2px; }
.hp-sig-badge {
  width: 40px; height: 40px;
  border: 1.5px solid #AE5E16; border-radius: 50%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  font-family: 'Fraunces', Georgia, serif;
  font-size: 7px; font-weight: 900; color: #AE5E16;
  text-align: center; line-height: 1.2; opacity: .7; flex-shrink: 0;
}
/* ── How-to ── */
.hp-howto-card {
  background: rgba(255,255,255,.55);
  border: 1px solid rgba(44,27,16,.14);
  border-radius: 18px; padding: 24px 26px; margin-bottom: 32px;
}
.hp-howto-card .hp-eyebrow { margin-bottom: 16px; }
.hp-howto-list { display: flex; flex-direction: column; gap: 14px; }
.hp-howto-row { display: flex; align-items: flex-start; gap: 14px; }
.hp-howto-ic {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  background: rgba(217,131,36,.1); color: #AE5E16;
  display: flex; align-items: center; justify-content: center; font-size: 16px;
}
.hp-howto-text strong { display: block; font-size: 13px; font-weight: 600; color: #2C1B10; margin-bottom: 2px; }
.hp-howto-text span { font-size: 12.5px; color: #6A5340; line-height: 1.5; }
/* ── Canvas grid ── */
.hp-grid-section { margin-bottom: 32px; }
.hp-grid-label {
  font-size: 11px; font-weight: 600; letter-spacing: 3px;
  text-transform: uppercase; color: #6A5340; margin-bottom: 10px;
}
.hp-grid-card {
  background: rgba(255,255,255,.55);
  border: 1px solid rgba(44,27,16,.14);
  border-radius: 14px; padding: 16px; overflow: hidden;
}
/* ── Sticky nav ── */
.hp-sticky-nav {
  position: sticky; top: 61px; z-index: 19;
  background: rgba(250,243,228,.94);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(44,27,16,.14);
}
.hp-sticky-inner { max-width: 960px; margin: 0 auto; padding: 0 24px; }
.hp-year-tabs {
  display: flex; gap: 6px; padding: 10px 0 0;
  overflow-x: auto; scrollbar-width: none;
}
.hp-year-tabs::-webkit-scrollbar { display: none; }
.hp-ytab {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-size: 12px; font-weight: 600; letter-spacing: .5px;
  padding: 6px 16px; border-radius: 100px;
  border: 1.5px solid rgba(44,27,16,.14);
  background: transparent; color: #6A5340;
  cursor: pointer; white-space: nowrap; flex-shrink: 0;
  transition: all .15s;
}
.hp-ytab.active, .hp-ytab:hover {
  background: #AE5E16; color: #fff; border-color: #AE5E16;
  box-shadow: 0 4px 12px -4px rgba(174,94,22,.45);
}
.hp-month-pills {
  display: flex; gap: 5px; padding: 7px 0 10px;
  overflow-x: auto; scrollbar-width: none;
}
.hp-month-pills::-webkit-scrollbar { display: none; }
.hp-mpill {
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-size: 11px; font-weight: 500;
  padding: 4px 12px; border-radius: 100px;
  border: 1px solid rgba(44,27,16,.14);
  background: rgba(255,255,255,.45); color: #6A5340;
  cursor: pointer; white-space: nowrap; flex-shrink: 0; transition: all .12s;
}
.hp-mpill:hover {
  background: rgba(217,131,36,.12); color: #AE5E16;
  border-color: rgba(217,131,36,.3);
}
/* ── Timeline ── */
.hp-timeline { padding-top: 86px; }
.hp-yr-block { margin-top: 32px; }
.hp-yr-div {
  display: flex; align-items: center; gap: 12px; padding: 6px 0 14px;
}
.hp-yr-div::before, .hp-yr-div::after {
  content: ''; flex: 1; height: 1px;
  background: linear-gradient(90deg, rgba(44,27,16,.14), rgba(44,27,16,.07));
}
.hp-yr-label {
  display: flex; flex-direction: column;
  align-items: center; flex-shrink: 0; gap: 1px;
}
.hp-yr-text {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 900; font-size: 13px; letter-spacing: 2px;
  color: #6A5340; text-transform: uppercase;
}
.hp-yr-tally { font-size: 10.5px; color: #6A5340; opacity: .65; }
.hp-milestone {
  display: flex; align-items: center; gap: 9px;
  margin: 8px 0 4px; padding: 8px 14px;
  background: linear-gradient(90deg, rgba(231,200,139,.2), transparent);
  border-left: 2px solid #E7C88B; border-radius: 0 8px 8px 0;
  font-size: 12px; font-weight: 600; color: #6A5340; letter-spacing: .3px;
}
.hp-milestone svg { color: #E7C88B; flex-shrink: 0; }
.hp-entry {
  display: flex; gap: 14px; padding: 12px 0;
  border-bottom: 1px solid rgba(44,27,16,.07);
}
.hp-date-stamp { flex-shrink: 0; width: 44px; text-align: center; padding-top: 2px; }
.hp-ds-day {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 22px; font-weight: 900; color: #AE5E16;
  line-height: 1; font-variant-numeric: tabular-nums;
}
.hp-ds-mon {
  font-size: 9px; letter-spacing: 1px; text-transform: uppercase;
  color: #6A5340; margin-top: 2px; font-weight: 500;
}
.hp-entry-sep {
  width: 1px; background: rgba(44,27,16,.14);
  flex-shrink: 0; align-self: stretch; min-height: 30px; margin: 2px 0;
}
.hp-entry-body { flex: 1; min-width: 0; }
.hp-img-strip {
  display: flex; gap: 7px;
  overflow-x: auto; padding-bottom: 2px; scrollbar-width: none;
}
.hp-img-strip::-webkit-scrollbar { display: none; }
.hp-page-thumb {
  width: 82px; height: 107px; flex-shrink: 0;
  border-radius: 10px; border: 1px solid rgba(44,27,16,.14);
  cursor: pointer; position: relative; overflow: hidden;
  transition: transform .15s, box-shadow .15s, border-color .15s;
  background: #F3E8CF;
}
.hp-page-thumb:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 20px -6px rgba(44,27,16,.22);
  border-color: rgba(217,131,36,.4);
}
.hp-pg-num {
  position: absolute; bottom: 4px; right: 5px; z-index: 2;
  font-size: 8px; font-weight: 600; color: rgba(44,27,16,.45); pointer-events: none;
}
.thumb-skel {
  position: absolute; inset: 0;
  background: linear-gradient(90deg, #F3E8CF 25%, #FAF3E4 50%, #F3E8CF 75%);
  background-size: 200% 100%; animation: hp-shimmer 1.4s infinite;
}
@keyframes hp-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
.hp-doc-only {
  display: inline-flex; align-items: center; gap: 10px;
  background: rgba(255,255,255,.55);
  border: 1px solid rgba(44,27,16,.14);
  border-radius: 10px; padding: 10px 14px;
  font-size: 12px; font-weight: 500; color: #6A5340;
}
.hp-doc-icon {
  width: 22px; height: 28px; background: #AE5E16;
  border-radius: 3px; display: flex; align-items: center;
  justify-content: center; flex-shrink: 0;
}
/* ── Action bar ── */
.hp-actions {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: min(960px, 100%);
  padding: 12px 24px calc(12px + env(safe-area-inset-bottom));
  background: rgba(250,243,228,.95);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid rgba(44,27,16,.14);
  display: flex; gap: 10px; z-index: 30;
}
.hp-btn-shop {
  flex: 1; padding: 14px; background: #AE5E16; color: #fff;
  border: none; border-radius: 100px;
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-size: 14px; font-weight: 700; cursor: pointer;
  box-shadow: 0 8px 20px -8px rgba(174,94,22,.6);
  transition: background .2s, transform .2s;
}
.hp-btn-shop:hover { background: #7C2D1A; transform: translateY(-1px); }
.hp-btn-share {
  flex: 1; padding: 14px;
  background: rgba(37,211,102,.12); color: #1a6e38;
  border: 1.5px solid rgba(37,211,102,.35); border-radius: 100px;
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-size: 14px; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: background .2s;
}
.hp-btn-share:hover { background: rgba(37,211,102,.2); }
/* ── Lightbox ── */
.hp-lb {
  display: flex; position: fixed; inset: 0;
  background: rgba(20,10,4,.92); z-index: 100;
  align-items: center; justify-content: center;
  padding: 24px; backdrop-filter: blur(4px);
}
.hp-lb-inner { position: relative; max-width: min(460px, 88vw); width: 100%; }
.hp-lb-close {
  position: absolute; top: -48px; right: 0;
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(255,255,255,.12); border: none;
  color: rgba(255,255,255,.8); font-size: 20px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background .15s;
}
.hp-lb-close:hover { background: rgba(255,255,255,.22); }
.hp-lb-date {
  margin-top: 12px; text-align: center;
  font-size: 11px; font-weight: 500; letter-spacing: 2px;
  text-transform: uppercase; color: rgba(250,243,228,.45);
}
.hp-lb-nav { display: flex; justify-content: center; gap: 10px; margin-top: 10px; }
.hp-lb-nav-btn {
  background: rgba(255,255,255,.1); border: none;
  color: rgba(250,243,228,.75);
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-size: 12px; font-weight: 600; padding: 6px 18px;
  border-radius: 100px; cursor: pointer; transition: background .15s;
}
.hp-lb-nav-btn:hover { background: rgba(255,255,255,.2); }
/* ── Tooltip ── */
.hp-dot-tip {
  position: fixed; z-index: 60;
  background: #2C1B10; color: #FAF3E4;
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-size: 11px; font-weight: 500; padding: 5px 11px;
  border-radius: 100px; pointer-events: none; display: none;
  white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,.2);
}
/* ── Responsive ── */
@media (max-width: 600px) {
  .hp-hero-name { font-size: 36px; }
  .hp-stats-row { gap: 8px; }
  .hp-stat-card { padding: 12px 14px; }
  .hp-stat-val { font-size: 22px; }
  .hp-letter-card { padding: 22px 18px 20px; }
}
@media (max-width: 400px) {
  .hp-hero { gap: 14px; }
  .hp-seal { width: 72px; height: 72px; }
}
@media (prefers-reduced-motion: reduce) {
  .hp-seal-ring { animation: none; }
  .thumb-skel { animation: none; }
}
`;
