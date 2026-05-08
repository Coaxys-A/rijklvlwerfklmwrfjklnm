// teknav-home.jsx — Homepage (ES module)
import { useState, useEffect, useRef } from 'react';
import { TeknavData } from './teknav-data.js';
import { useNav, useAuth, AuthorAvatar, CategoryBadge, TypeBadge, NewsletterForm, StreakWidget, ContinueReadingBar, ReadingListModal, pillBtn } from './teknav-ui.jsx';
import { DiagramRenderer } from './teknav-diagrams.jsx';
import { contentApi } from './src/lib/content-api.js';
import { engagementApi } from './src/lib/engagement-api.js';

// ── Hero Neural Background ──────────────────────────────────────────────────
function HeroBackground() {
  const canvasRef = useRef();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf,t = 0;
    const palette = [
    'rgba(15,107,115,',  // deep teal (Teknav brand)
    'rgba(196,106,77,',  // terracotta
    'rgba(47,143,107,'   // warm green
    ];
    const nodes = Array.from({ length: 32 }, (_, i) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 3 + 1.5,
      color: palette[i % palette.length],
      phase: Math.random() * Math.PI * 2
    }));

    const resize = () => {canvas.width = canvas.offsetWidth;canvas.height = canvas.offsetHeight;};
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      t += 0.012;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      nodes.forEach((n) => {
        n.x += n.vx;n.y += n.vy;
        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;
        nodes.forEach((m) => {
          const d = Math.hypot(n.x - m.x, n.y - m.y);
          if (d < 130) {
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);ctx.lineTo(m.x, m.y);
            ctx.strokeStyle = `rgba(15,107,115,${0.18 * (1 - d / 130)})`;
            ctx.lineWidth = 0.8;ctx.stroke();
          }
        });
        const pulse = 0.45 + 0.18 * Math.sin(t + n.phase);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.color + pulse + ')';
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {cancelAnimationFrame(raf);window.removeEventListener('resize', resize);};
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

// ── Article Card (grid) ─────────────────────────────────────────────────────
function ArticleCard({ article, delay = 0, readProgress = null }) {
  const { navigate } = useNav();
  const { user } = useAuth();
  const [vis, setVis] = useState(false);
  const [listModalOpen, setListModalOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {if (e.isIntersecting) setVis(true);}, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  const author = TeknavData.authors.find((a) => a.id === article.authorId);
  const cat = TeknavData.categories.find((c) => c.id === article.category);
  const showContinue = readProgress !== null && readProgress >= 5 && readProgress <= 95;

  return (
    <div ref={ref} onClick={() => navigate('/article/' + article.slug)} style={{
      background: '#fff', borderRadius: 12, border: '1px solid #E4DDD2',
      padding: 24, cursor: 'pointer', direction: 'rtl',
      opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.5s ${delay}ms, transform 0.5s ${delay}ms, box-shadow 0.2s`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)'
    }} onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)'}
    onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)'}>
      {/* Diagram thumbnail */}
      <div style={{ height: 120, borderRadius: 8, background: '#F4EFE6', marginBottom: 16, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ transform: 'scale(0.7)', transformOrigin: 'center', width: '100%' }}>
          <DiagramRenderer type={article.diagram} compact={true} />
        </div>
        {showContinue && (
          <>
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(0,0,0,0.1)' }}>
              <div style={{ height: '100%', background: '#0F6B73', width: `${readProgress}%`, transition: 'width 0.3s' }} />
            </div>
            <span style={{ position: 'absolute', bottom: 8, insetInlineEnd: 8, background: '#0F6B73', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, fontFamily: 'Vazirmatn,sans-serif' }}>ادامه مطالعه</span>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <TypeBadge type={article.type} small />
        <CategoryBadge name={article.categoryName} color={cat?.color} small />
        {article.sponsored && <span style={{ background: '#FFF4D8', color: '#8A5A00', border: '1px solid #D49A2A55', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 800 }}>Promoted Content</span>}
        {article.premiumOnly && <span style={{ background: '#0F2A2E', color: '#D49A2A', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 800 }}>Premium</span>}
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#263238', margin: '0 0 8px', lineHeight: 1.5, fontFamily: 'Vazirmatn,sans-serif' }}>{article.title}</h3>
      <p style={{ fontSize: 12, color: '#5F6B6D', lineHeight: 1.7, margin: '0 0 16px' }}>{article.summary.slice(0, 100)}...</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#5F6B6D' }}>
        <span>{article.date}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {author && <AuthorAvatar author={author} size={22} />}
          <span>{article.readTime} دقیقه</span>
          {user && (
            <button onClick={(e) => { e.stopPropagation(); setListModalOpen(true); }} title="ذخیره در لیست" style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
              color: '#0F6B73', fontSize: 14, lineHeight: 1,
            }}>🔖</button>
          )}
        </div>
      </div>
      {listModalOpen && <ReadingListModal articleId={article.id} onDone={() => setListModalOpen(false)} />}
    </div>);

}

// ── Featured Article ────────────────────────────────────────────────────────
function FeaturedArticle({ article }) {
  const { navigate } = useNav();
  const author = TeknavData.authors.find((a) => a.id === article.authorId);
  const cat = TeknavData.categories.find((c) => c.id === article.category);
  return (
    <div onClick={() => navigate('/article/' + article.slug)} style={{
      background: '#fff', borderRadius: 16, border: '1px solid #E4DDD2', padding: 0,
      cursor: 'pointer', overflow: 'hidden', direction: 'rtl',
      boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 280,
      transition: 'box-shadow 0.2s'
    }} className="featured-card" onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 12px 48px rgba(0,0,0,0.12)'}
    onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.06)'}>
      <div style={{ padding: '32px 32px 32px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <TypeBadge type={article.type} />
            <CategoryBadge name={article.categoryName} color={cat?.color} />
            {article.sponsored && <span style={{ background: '#FFF4D8', color: '#8A5A00', border: '1px solid #D49A2A55', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 800 }}>Promoted Content</span>}
            {article.premiumOnly && <span style={{ background: '#0F2A2E', color: '#D49A2A', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 800 }}>Premium</span>}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#263238', margin: '0 0 12px', lineHeight: 1.5, fontFamily: 'Vazirmatn,sans-serif' }}>{article.title}</h2>
          <p style={{ fontSize: 14, color: '#5F6B6D', lineHeight: 1.8, margin: 0 }}>{article.summary}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid #E4DDD2' }}>
          {author && <AuthorAvatar author={author} size={36} />}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#263238' }}>{article.authorName}</div>
            <div style={{ fontSize: 11, color: '#5F6B6D' }}>{article.date} · {article.readTime} دقیقه مطالعه</div>
          </div>
        </div>
      </div>
      <div style={{ background: '#F4EFE6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <DiagramRenderer type={article.diagram} />
      </div>
    </div>);

}

// ── Resolve an author's profile URL (username from API or static fallback) ───
function authorProfilePath(author) {
  const username = author.username || TeknavData.authors.find(a => a.slug === author.slug)?.username;
  return username ? `/profile/@${username}` : `/author/${author.slug}`;
}

// ── Authors Section ─────────────────────────────────────────────────────────
function AuthorsSection() {
  const { navigate } = useNav();
  const [authors, setAuthors] = useState(TeknavData.authors);

  useEffect(() => {
    let cancelled = false;
    contentApi.listAuthors()
      .then(items => {
        if (cancelled || !items?.length) return;
        // Merge API data with static data to fill missing fields (username, bio, expertise)
        const merged = items.map(apiAuthor => {
          const seed = TeknavData.authors.find(a => a.slug === apiAuthor.slug || a.id === apiAuthor.id);
          return { ...seed, ...apiAuthor, username: apiAuthor.username || seed?.username, bio: seed?.bio || apiAuthor.bio, specialty: seed?.specialty || apiAuthor.specialty };
        });
        setAuthors(merged);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <section style={{ padding: '60px 0', direction: 'rtl' }}>
      <h2 style={sectionTitle}>نویسندگان تکناو</h2>
      <p style={sectionSubtitle}>متخصصانی که روایت عمیق فناوری را می‌نویسند</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }} className="authors-grid">
        {authors.map((author) =>
          <div key={author.id} onClick={() => navigate(authorProfilePath(author))} style={{
            background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 20,
            cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
          }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <AuthorAvatar author={author} size={56} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#263238', marginBottom: 4 }}>{author.name}</div>
            <div style={{ fontSize: 11, color: '#5F6B6D', marginBottom: 8 }}>{author.specialty}</div>
            <div style={{ fontSize: 11, color: '#0F6B73', fontWeight: 600 }}>{author.articleCount} مقاله</div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Hero Section (light bg, parallax + shimmer) ─────────────────────────────
function HeroSection({ featured, navigate }) {
  const wrapRef = useRef();
  const cardRef = useRef();

  // Subtle parallax tilt on mouse-move (disabled on touch)
  useEffect(() => {
    const wrap = wrapRef.current;
    const card = cardRef.current;
    if (!wrap || !card) return;
    const onMove = (e) => {
      const r = wrap.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5;
      const dy = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-dy * 4).toFixed(2)}deg) rotateY(${(dx * 6).toFixed(2)}deg) translateY(0)`;
    };
    const onLeave = () => { card.style.transform = 'perspective(900px) rotateX(0) rotateY(0)'; };
    wrap.addEventListener('mousemove', onMove);
    wrap.addEventListener('mouseleave', onLeave);
    return () => { wrap.removeEventListener('mousemove', onMove); wrap.removeEventListener('mouseleave', onLeave); };
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative', background: '#F4F1EC', overflow: 'hidden', minHeight: 560 }}>
      {/* Soft glows tuned for light bg */}
      <div style={{ position: 'absolute', top: '20%', right: '10%', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle, rgba(15,107,115,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '0%', left: '15%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,106,77,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />
      {/* Subtle grid overlay for depth */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(15,42,46,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,42,46,0.04) 1px, transparent 1px)', backgroundSize: '48px 48px', maskImage: 'radial-gradient(circle at 50% 40%, #000 30%, transparent 75%)', WebkitMaskImage: 'radial-gradient(circle at 50% 40%, #000 30%, transparent 75%)', pointerEvents: 'none' }} />
      <HeroBackground />

      <div className="home-hero-inner" style={{ position: 'relative', zIndex: 2, maxWidth: 1280, margin: '0 auto', padding: '76px 24px 70px', direction: 'rtl' }}>
        <div style={{ maxWidth: 600, marginBottom: 44 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(15,107,115,0.08)', border: '1px solid rgba(15,107,115,0.25)', color: '#0F6B73', padding: '6px 16px', borderRadius: 999, fontSize: 11, fontWeight: 700, marginBottom: 26, letterSpacing: '0.08em', animation: 'heroReveal 0.6s 0.1s both' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0F6B73', display: 'inline-block', animation: 'pulseRing 2.2s infinite' }} />
            روایت عمیق فناوری
          </div>
          <h1 style={{ fontSize: 'clamp(34px,5.4vw,58px)', fontWeight: 800, color: '#0F2A2E', margin: '0 0 4px', lineHeight: 1.25, fontFamily: "'PelakFA','Vazirmatn',sans-serif", animation: 'heroReveal 0.7s 0.35s both', letterSpacing: '-0.01em' }}>
            درک عمیق‌تر
          </h1>
          <h1 className="gold-shimmer" style={{ fontSize: 'clamp(34px,5.4vw,58px)', fontWeight: 800, margin: '0 0 22px', lineHeight: 1.25, fontFamily: "'PelakFA','Vazirmatn',sans-serif", animation: 'heroReveal 0.7s 0.6s both', letterSpacing: '-0.01em' }}>
            دنیای فناوری
          </h1>
          <p style={{ fontSize: 16, color: '#4A5A5C', lineHeight: 2, margin: '0 0 32px', animation: 'heroReveal 0.7s 0.85s both', maxWidth: 540 }}>
            تحلیل‌های علمی، تخصصی و مستقل از پیشرفت‌های هوش مصنوعی، علم داده، امنیت سایبری و آینده فناوری.
          </p>
          <div className="home-hero-actions" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', animation: 'heroReveal 0.7s 1.1s both' }}>
            <button onClick={() => navigate('/articles')} style={{ background: '#0F6B73', color: '#fff', border: 'none', padding: '14px 32px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif', boxShadow: '0 6px 22px rgba(15,107,115,0.28)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(15,107,115,0.35)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 22px rgba(15,107,115,0.28)'; }}>
              مشاهده همه مقاله‌ها →
            </button>
            <button onClick={() => navigate('/category/ai')} style={{ background: 'rgba(196,106,77,0.08)', color: '#A8512E', border: '1px solid rgba(196,106,77,0.45)', padding: '14px 30px', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(196,106,77,0.16)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(196,106,77,0.08)'; }}>
              هوش مصنوعی
            </button>
          </div>
        </div>

        {/* Featured card — light theme, parallax tilt, soft shadow */}
        {featured &&
          <div ref={cardRef} className="hero-tilt" style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 16, padding: '20px 24px', direction: 'rtl', maxWidth: 580, animation: 'heroReveal 0.7s 1.35s both', boxShadow: '0 14px 40px rgba(15,42,46,0.08), 0 2px 8px rgba(15,42,46,0.04)', position: 'relative', overflow: 'hidden' }}>
            {/* Decorative accent stripe */}
            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 4, background: 'linear-gradient(180deg, #D49A2A, #C46A4D)' }} />
            <div style={{ fontSize: 10, color: '#C46A4D', fontWeight: 700, marginBottom: 10, letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', animation: 'float-y 3s ease-in-out infinite' }}>✦</span>
              مقاله ویژه
            </div>
            <div onClick={() => navigate('/article/' + featured.slug)} style={{ fontSize: 18, fontWeight: 700, color: '#0F2A2E', cursor: 'pointer', lineHeight: 1.65, transition: 'color 0.15s', fontFamily: "'PelakFA','Vazirmatn',sans-serif" }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#0F6B73'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#0F2A2E'}>
              {featured.title}
            </div>
            <div style={{ fontSize: 12, color: '#5F6B6D', marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: '#0F6B73' }}>{featured.authorName}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{featured.type}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{featured.readTime} دقیقه مطالعه</span>
            </div>
          </div>
        }
      </div>

      {/* Wave divider for smooth transition into next section */}
      <svg viewBox="0 0 1440 60" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -1, left: 0, width: '100%', height: 50, display: 'block', pointerEvents: 'none' }}>
        <path d="M0,40 C240,60 480,10 720,30 C960,50 1200,15 1440,35 L1440,60 L0,60 Z" fill="#ebe3d2" />
      </svg>

      <style>{`
        @keyframes heroReveal {
          from { opacity: 0; filter: blur(6px); transform: translateY(18px); }
          to   { opacity: 1; filter: blur(0);  transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Stats Bar ───────────────────────────────────────────────────────────────
function CountUp({ to, suffix = '', duration = 1400 }) {
  const [n, setN] = useState(0);
  const ref = useRef();
  const started = useRef(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setN(Math.round(to * eased));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to, duration]);
  // Render Persian digits
  const fa = String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
  // Add thousands separator (٬ for Persian)
  const formatted = fa.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return <span ref={ref}>{formatted}{suffix}</span>;
}

function StatsBar() {
  const stats = [
    { label: 'مقاله منتشرشده', to: 180, suffix: '+', icon: '◉' },
    { label: 'نویسنده فعال',   to: 3,   suffix: '',  icon: '✎' },
    { label: 'خواننده ماهانه', to: 45000, suffix: '+', icon: '◐' },
    { label: 'میانگین زمان مطالعه', to: 8, suffix: ' دقیقه', icon: '◷' },
  ];

  return (
    <div style={{ background: '#ebe3d2', padding: '40px 24px', direction: 'rtl', borderTop: '1px solid rgba(15,42,46,0.06)', borderBottom: '1px solid rgba(15,42,46,0.06)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16 }} className="stats-bar-inner">
        {stats.map((s, i) =>
          <div key={s.label} className="lift-on-hover" style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 12, position: 'relative' }}>
            <div style={{ fontSize: 14, color: '#0F6B73', marginBottom: 6, opacity: 0.7 }}>{s.icon}</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: '#A8761B', marginBottom: 6, fontFamily: "'PelakFA','Vazirmatn',sans-serif", letterSpacing: '-0.01em' }}>
              <CountUp to={s.to} suffix={s.suffix} />
            </div>
            <div style={{ fontSize: 13, color: '#4A5A5C', fontWeight: 500 }}>{s.label}</div>
            {i < stats.length - 1 &&
              <div style={{ position: 'absolute', left: 0, top: '20%', height: '60%', width: 1, background: 'rgba(15,42,46,0.08)' }} />
            }
          </div>
        )}
      </div>
    </div>);

}

// ── Shared section styles ───────────────────────────────────────────────────
const sectionTitle = { fontSize: 22, fontWeight: 800, color: '#263238', margin: '0 0 8px', fontFamily: 'Vazirmatn,sans-serif' };
const sectionSubtitle = { fontSize: 14, color: '#5F6B6D', margin: '0 0 32px', lineHeight: 1.7 };

// ── Homepage ────────────────────────────────────────────────────────────────
function HomePage() {
  const { navigate } = useNav();
  const { user } = useAuth();
  const [articles, setArticles] = useState(() => contentApi.fallbackArticles());
  const [personalized, setPersonalized] = useState([]);
  const [readProgressMap, setReadProgressMap] = useState({});

  useEffect(() => {
    let cancelled = false;
    contentApi.listArticles({ limit: 50 })
      .then((res) => { if (!cancelled) setArticles(res.items ?? []); })
      .catch(() => {});

    if (user) {
      contentApi.listArticles({ limit: 12, sort: 'personalized' })
        .then((res) => { if (!cancelled) setPersonalized(res.items ?? []); })
        .catch(() => {});
      engagementApi.getStreaks()
        .then((data) => {
          if (cancelled) return;
          const map = {};
          (data.continueReading ?? []).forEach(item => {
            map[item.slug] = Math.round((item.progress ?? 0) * 100);
          });
          setReadProgressMap(map);
        })
        .catch(() => {});
    } else {
      setPersonalized([]);
      setReadProgressMap({});
    }

    return () => { cancelled = true; };
  }, [user]);

  const featured = articles.find((a) => a.featured) || articles[0];
  const latest = articles.filter((a) => a.id !== featured?.id).slice(0, 6);
  const popular = [...articles].sort((a, b) => b.views - a.views).slice(0, 4);
  const deep = articles.filter((a) => a.type === 'تحلیل عمیق').slice(0, 3);

  return (
    <main style={{ paddingTop: 64, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif' }}>
      {/* Personalized Bar / Streak */}
      {user && (
        <div style={{ background: '#F4EFE6', borderBottom: '1px solid #E4DDD2', padding: '10px 24px', direction: 'rtl' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <StreakWidget />
            <ContinueReadingBar />
          </div>
        </div>
      )}

      {/* Hero */}
      <HeroSection featured={featured} navigate={navigate} />

      <StatsBar />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
        {/* Personalized Feed */}
        {personalized.length > 0 && (
          <section className="home-section" style={{ padding: '60px 0 20px', direction: 'rtl' }} aria-labelledby="personalized-title">
            <h2 id="personalized-title" style={sectionTitle}>پیشنهاد برای شما</h2>
            <p style={sectionSubtitle}>بر اساس علایق و تاریخچه مطالعه شما</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }} className="article-grid">
              {personalized.map((a, i) => <ArticleCard key={a.id} article={a} delay={i * 80} readProgress={readProgressMap[a.slug] ?? null} />)}
            </div>
          </section>
        )}

        {/* Featured article */}
        {featured &&
          <section className="home-section" style={{ padding: '60px 0 40px', direction: 'rtl' }} aria-labelledby="featured-title">
            <h2 id="featured-title" style={sectionTitle}>مقاله منتخب</h2>
            <p style={sectionSubtitle}>عمیق‌ترین تحلیل این هفته</p>
            <FeaturedArticle article={featured} />
          </section>
        }

        {/* Latest */}
        <section className="home-section" style={{ padding: '40px 0', direction: 'rtl' }} aria-labelledby="latest-title">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 id="latest-title" style={{ ...sectionTitle, margin: 0 }}>تازه‌ترین خبرها</h2>
            <button onClick={() => navigate('/articles')} style={{ background: 'none', border: 'none', color: '#0F6B73', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif' }} aria-label="مشاهده همه مقالات">مشاهده همه ←</button>
          </div>
          <p style={sectionSubtitle}>آخرین تحلیل‌ها و مقالات تکناو</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }} className="article-grid">
            {latest.map((a, i) => <ArticleCard key={a.id} article={a} delay={i * 80} readProgress={readProgressMap[a.slug] ?? null} />)}
          </div>
        </section>

        {/* Deep analysis */}
        {deep.length > 0 &&
          <section className="home-section" style={{ padding: '40px 0', direction: 'rtl' }} aria-labelledby="deep-title">
            <h2 id="deep-title" style={sectionTitle}>تحلیل‌های عمیق</h2>
            <p style={sectionSubtitle}>بررسی‌های تخصصی و مستند</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {deep.map((a) => <ArticleRowCompact key={a.id} article={a} />)}
            </div>
          </section>
        }

        {/* Popular */}
        <section className="home-section" style={{ padding: '40px 0', direction: 'rtl' }} aria-labelledby="popular-title">
          <h2 id="popular-title" style={sectionTitle}>محبوب‌ترین‌ها</h2>
          <p style={sectionSubtitle}>پرخواننده‌ترین مقالات تکناو</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 }} className="article-grid">
            {popular.map((a, i) => <ArticleCard key={a.id} article={a} delay={i * 100} readProgress={readProgressMap[a.slug] ?? null} />)}
          </div>
        </section>

        {/* Categories */}
        <section className="home-section" style={{ padding: '40px 0', direction: 'rtl' }} aria-labelledby="categories-title">
          <h2 id="categories-title" style={sectionTitle}>دسته‌بندی‌ها</h2>
          <p style={sectionSubtitle}>کشف مطالب بر اساس حوزه تخصصی</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }} className="categories-grid">
            {TeknavData.categories.map((cat) => {
              const { navigate } = useNav();
              return (
                <div key={cat.id} onClick={() => navigate('/category/' + cat.slug)} style={{
                  background: '#fff', border: `1px solid ${cat.color}30`, borderRadius: 10, padding: '20px 16px',
                  cursor: 'pointer', direction: 'rtl', transition: 'all 0.2s',
                  borderRight: `3px solid ${cat.color}`
                }} onMouseEnter={(e) => e.currentTarget.style.background = cat.color + '08'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#263238', marginBottom: 4 }}>{cat.name}</div>
                  <div style={{ fontSize: 11, color: '#5F6B6D', marginBottom: 10 }}>{cat.description}</div>
                  <div style={{ fontSize: 11, color: cat.color, fontWeight: 600 }}>{cat.articleCount} مقاله</div>
                </div>);

            })}
          </div>
        </section>

        {/* Authors */}
        <AuthorsSection />

        {/* Newsletter */}
        <section style={{ padding: '40px 0 60px', direction: 'rtl' }} aria-labelledby="newsletter-title">
          <div className="newsletter-box" style={{ background: '#ebe3d2', borderRadius: 20, padding: '52px 32px', textAlign: 'center', position: 'relative', overflow: 'hidden', border: '1px solid rgba(15,42,46,0.06)' }}>
            <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(15,107,115,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -60, left: -60, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(196,106,77,0.10) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 22, marginBottom: 6, color: '#0F6B73' }}>✉</div>
              <h2 id="newsletter-title" style={{ fontSize: 26, fontWeight: 800, color: '#0F2A2E', margin: '0 0 10px', fontFamily: "'PelakFA','Vazirmatn',sans-serif", letterSpacing: '-0.01em' }}>عضو خبرنامه تکناو شوید</h2>
              <p style={{ fontSize: 14, color: '#4A5A5C', margin: '0 0 28px', lineHeight: 1.9, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>هر هفته بهترین مقاله‌های تحلیلی تکناو مستقیم در صندوق ورودی ایمیل شما</p>
              <NewsletterForm />
            </div>
          </div>
        </section>
      </div>
      <style>{`
        @media (max-width: 640px) {
          .featured-card { grid-template-columns: 1fr !important; }
          .featured-card .diagram-col { min-height: 200px; }
          .hero-text { padding: 48px 16px 40px !important; }
          .stats-bar-inner { grid-template-columns: repeat(2, 1fr) !important; }
          .article-grid { grid-template-columns: 1fr !important; }
          .authors-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .categories-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .newsletter-box { padding: 36px 20px !important; }
        }
      `}</style>
    </main>);

}

// ── Article Row Compact (for homepage) ─────────────────────────────────────
function ArticleRowCompact({ article }) {
  const { navigate } = useNav();
  const cat = TeknavData.categories.find((c) => c.id === article.category);
  return (
    <div onClick={() => navigate('/article/' + article.slug)} style={{
      display: 'flex', gap: 20, padding: '20px 0', borderBottom: '1px solid #E4DDD2',
      cursor: 'pointer', direction: 'rtl', alignItems: 'flex-start',
      transition: 'background 0.15s'
    }} onMouseEnter={(e) => e.currentTarget.style.background = '#F4EFE620'}
    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <TypeBadge type={article.type} small />
          <CategoryBadge name={article.categoryName} color={cat?.color} small />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#263238', margin: '0 0 6px', lineHeight: 1.5 }}>{article.title}</h3>
        <p style={{ fontSize: 13, color: '#5F6B6D', margin: '0 0 10px', lineHeight: 1.7 }}>{article.summary.slice(0, 140)}…</p>
        <div style={{ fontSize: 11, color: '#5F6B6D' }}>{article.authorName} · {article.date} · {article.readTime} دقیقه</div>
      </div>
      <div style={{ width: 80, height: 80, background: '#F4EFE6', borderRadius: 8, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ transform: 'scale(0.55)', transformOrigin: 'center' }}>
          <DiagramRenderer type={article.diagram} compact />
        </div>
      </div>
    </div>);

}

export { HomePage, ArticleCard, FeaturedArticle, ArticleRowCompact, sectionTitle, sectionSubtitle };
