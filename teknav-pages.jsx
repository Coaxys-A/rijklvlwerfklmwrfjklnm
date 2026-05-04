// teknav-pages.jsx — Search, Category, Authors pages (ES module)
import { useState, useMemo, useEffect } from 'react';
import { TeknavData } from './teknav-data.js';
import {
  useNav, useToast, useAuth,
  AuthorAvatar, CategoryBadge, TypeBadge, EmptyState,
  inputStyle, pillBtn,
} from './teknav-ui.jsx';
import { DiagramRenderer } from './teknav-diagrams.jsx';
import { ArticleRow } from './teknav-articles.jsx';
import { contentApi } from './src/lib/content-api.js';
import { engagementApi, pushApi } from './src/lib/engagement-api.js';

// ── Search Page ─────────────────────────────────────────────────────────────
function SearchPage({ initQ = '' }) {
  const [q, setQ] = useState(initQ);
  const [input, setInput] = useState(initQ);
  const [filters, setFilters] = useState({ category: '', author: '', type: '', tag: '', dateRange: '' });
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const { navigate } = useNav();

  const load = useCallback(() => {
    setLoading(true);
    const params = {
      q,
      category: filters.category,
      author: filters.author,
      type: filters.type,
      tag: filters.tag,
      limit: 50,
    };
    const apiCall = q ? contentApi.search(params) : contentApi.listArticles(params);
    apiCall
      .then(res => setItems(res.items ?? []))
      .finally(() => setLoading(false));
  }, [q, filters]);

  useEffect(() => { load(); }, [load]);

  const doSearch = (e) => { e.preventDefault(); setQ(input); };

  const highlightText = (text, query) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? `<mark style="background:#D49A2A30;color:#263238;border-radius:2px;padding:0 2px">${part}</mark>`
        : part
    ).join('');
  };

  return (
    <div style={{ paddingTop: 80, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#263238', margin: '0 0 8px' }}>جستجوی پیشرفته</h1>
        
        <form onSubmit={doSearch} style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="جستجو در مقاله‌ها..."
            style={{ flex: 1, ...inputStyle, fontSize: 16 }} dir="rtl" autoFocus />
          <button type="submit" style={{ ...pillBtn, background: '#0F6B73', color: '#fff', padding: '12px 32px' }}>جستجو</button>
        </form>

        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 32 }} className="search-layout">
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#263238' }}>دسته‌بندی</div>
              <select value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                <option value="">همه دسته‌ها</option>
                {TeknavData.categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#263238' }}>نویسنده</div>
              <select value={filters.author} onChange={e => setFilters(f => ({ ...f, author: e.target.value }))} style={inputStyle}>
                <option value="">همه نویسندگان</option>
                {TeknavData.authors.map(a => <option key={a.id} value={a.slug}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#263238' }}>نوع محتوا</div>
              <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
                <option value="">همه انواع</option>
                {['تحلیل عمیق', 'راهنمای فنی', 'داده‌نما', 'خبر فوری'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button onClick={() => setFilters({ category: '', author: '', type: '', tag: '', dateRange: '' })} style={{ ...pillBtn, background: '#F4EFE6', color: '#C94C4C', justifyContent: 'center' }}>پاک کردن فیلترها</button>
          </aside>

          <section>
            {loading ? <SkeletonLoader lines={5} /> : (
              <>
                {items.length === 0 ? <EmptyState title="نتیجه‌ای یافت نشد" /> : (
                  <div>
                    <div style={{ fontSize: 13, color: '#5F6B6D', marginBottom: 20 }}>{items.length.toLocaleString('fa-IR')} نتیجه پیدا شد</div>
                    {items.map((a, i) => <SearchResult key={a.id} article={a} q={q} highlight={highlightText} idx={i} />)}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
      <style>{`.search-layout { grid-template-columns: 240px 1fr; } @media(max-width:768px){ .search-layout { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function SearchResult({ article, q, highlight, idx }) {
  const { navigate } = useNav();
  return (
    <div onClick={() => navigate('/article/' + article.slug)} style={{
      padding: '24px 0', borderBottom: '1px solid #E4DDD2', cursor: 'pointer',
      opacity: 0, animation: `fadeIn 0.3s ${idx * 40}ms forwards`,
    }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <CategoryBadge name={article.categoryName} color={article.categoryColor} small />
        <span style={{ fontSize: 11, color: '#5F6B6D' }}>{article.date} · {article.readTime} دقیقه</span>
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 800, color: '#263238', margin: '0 0 8px' }}
        dangerouslySetInnerHTML={{ __html: highlight(article.title, q) }} />
      <p style={{ fontSize: 14, color: '#5F6B6D', lineHeight: 1.7, margin: 0 }}
        dangerouslySetInnerHTML={{ __html: highlight(article.summary.slice(0, 180) + '…', q) }} />
    </div>
  );
}

// ── Category Page ───────────────────────────────────────────────────────────
function CategoryPage({ slug }) {
  const { navigate } = useNav();
  const [cat, setCat] = useState(() => TeknavData.categories.find(c => c.slug === slug));
  const [articles, setArticles] = useState(() => contentApi.fallbackArticles().filter(a => a.category === slug));

  useEffect(() => {
    let cancelled = false;
    setCat(TeknavData.categories.find(c => c.slug === slug));
    setArticles(contentApi.fallbackArticles().filter(a => a.category === slug));
    Promise.all([
      contentApi.getCategory(slug).catch(() => null),
      contentApi.listArticles({ category: slug, limit: 100 }).catch(() => null),
    ]).then(([category, result]) => {
      if (cancelled) return;
      if (category) setCat({ ...(TeknavData.categories.find(c => c.slug === slug) ?? {}), ...category, id: category.slug });
      if (result?.items) setArticles(result.items);
    });
    return () => { cancelled = true; };
  }, [slug]);

  if (!cat) return <EmptyState title="دسته‌بندی یافت نشد" />;

  return (
    <div style={{ paddingTop: 64, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif' }}>
      {/* Category Hero */}
      <div style={{ background: `linear-gradient(135deg, ${cat.color}18 0%, #F4EFE6 100%)`, borderBottom: '1px solid #E4DDD2', padding: '48px 24px', direction: 'rtl' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 40, alignItems: 'center' }} className="cat-hero-grid">
          <div>
            <div style={{ display: 'inline-block', background: cat.color + '20', color: cat.color, padding: '4px 14px', borderRadius: 4, fontSize: 11, fontWeight: 700, marginBottom: 16 }}>دسته‌بندی</div>
            <h1 style={{ fontSize: 'clamp(28px,5vw,42px)', fontWeight: 900, color: '#263238', margin: '0 0 12px', fontFamily: 'Vazirmatn,sans-serif' }}>{cat.name}</h1>
            <p style={{ fontSize: 16, color: '#5F6B6D', lineHeight: 1.8, margin: '0 0 24px', maxWidth: 500 }}>{cat.description}</p>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              {[['تعداد مقاله', cat.articleCount], ['نویسنده فعال', cat.authorCount], ['میانگین زمان مطالعه', cat.avgReadTime + ' دقیقه']].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: cat.color }}>{v}</div>
                  <div style={{ fontSize: 12, color: '#5F6B6D' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <DiagramRenderer type={cat.diagram} />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 24px', direction: 'rtl' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#263238', margin: '0 0 24px' }}>مقاله‌های {cat.name} ({articles.length})</h2>
        {articles.length === 0 ? <EmptyState title="مقاله‌ای در این دسته وجود ندارد" /> : (
          articles.map((a, i) => <ArticleRow key={a.id} article={a} idx={i} />)
        )}
      </div>
      <style>{`.cat-hero-grid { grid-template-columns: 1fr 320px; } @media(max-width:768px){ .cat-hero-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

// ── Authors List Page ────────────────────────────────────────────────────────
function TagPage({ tag }) {
  const decoded = decodeURIComponent(tag);
  const [articles, setArticles] = useState(() => contentApi.fallbackArticles().filter((item) => item.tags?.includes(decoded)));
  useEffect(() => {
    let cancelled = false;
    setArticles(contentApi.fallbackArticles().filter((item) => item.tags?.includes(decoded)));
    contentApi.listArticles({ tag: decoded, limit: 100 })
      .then((res) => { if (!cancelled) setArticles(res.items ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [decoded]);
  return (
    <div style={{ paddingTop: 80, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: '#263238', margin: '0 0 10px' }}>برچسب {decoded}</h1>
        <p style={{ color: '#5F6B6D', lineHeight: 1.9, margin: '0 0 28px' }}>همه مقاله‌هایی که با این برچسب منتشر شده‌اند.</p>
        {articles.length === 0 ? <EmptyState title="مقاله‌ای برای این برچسب پیدا نشد" /> : articles.map((article, index) => (
          <ArticleRow key={article.id} article={article} idx={index} />
        ))}
      </div>
    </div>
  );
}

function GlossaryPage({ slug }) {
  const { navigate } = useNav();
  const term = TeknavData.glossary?.find((item) => item.slug === slug);
  const articles = contentApi.fallbackArticles().filter((article) => (
    article.tags?.some((tag) => tag.toLowerCase() === term?.term?.toLowerCase() || tag.toLowerCase() === term?.english?.toLowerCase())
    || article.summary?.toLowerCase().includes(term?.english?.toLowerCase() || '')
    || article.title?.toLowerCase().includes(term?.english?.toLowerCase() || '')
  )).slice(0, 6);

  if (!term) return <EmptyState title="واژه پیدا نشد" />;

  const related = (term.related ?? []).map((item) => TeknavData.glossary?.find((g) => g.slug === item)).filter(Boolean);
  const topic = TeknavData.topicHubs?.find((item) => item.slug === term.topic);

  return (
    <main style={{ paddingTop: 76, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
      <section style={{ borderBottom: '1px solid #E4DDD2', background: 'linear-gradient(135deg,#FFFFFF 0%,#F4EFE6 100%)', padding: '44px 24px' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <button onClick={() => navigate('/articles')} style={{ ...pillBtn, background: '#F4EFE6', color: '#0F6B73', border: '1px solid #E4DDD2', marginBottom: 18 }}>بازگشت به مقاله‌ها</button>
          <div style={{ color: '#0F6B73', fontSize: 12, fontWeight: 900, marginBottom: 8 }}>فرهنگ واژگان تکنّاو</div>
          <h1 style={{ fontSize: 'clamp(30px,5vw,48px)', color: '#263238', margin: '0 0 6px', fontWeight: 900 }}>{term.term}</h1>
          <div style={{ color: '#5F6B6D', fontSize: 18, direction: 'ltr', textAlign: 'right', marginBottom: 18 }}>{term.english}</div>
          <p style={{ maxWidth: 720, color: '#263238', lineHeight: 2, fontSize: 17, margin: 0 }}>{term.summary}</p>
        </div>
      </section>
      <section style={{ maxWidth: 1040, margin: '0 auto', padding: '32px 24px', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24 }} className="glossary-grid">
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 8, padding: 20 }}>
            <h2 style={{ margin: '0 0 14px', color: '#263238', fontSize: 20 }}>پرسش‌های رایج</h2>
            {(term.faqs ?? []).map(([q, a]) => (
              <div key={q} style={{ borderTop: '1px solid #E4DDD2', padding: '14px 0' }}>
                <strong style={{ color: '#0F6B73' }}>{q}</strong>
                <p style={{ margin: '8px 0 0', color: '#5F6B6D', lineHeight: 1.9 }}>{a}</p>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 8, padding: 20 }}>
            <h2 style={{ margin: '0 0 14px', color: '#263238', fontSize: 20 }}>مقاله‌های مرتبط</h2>
            {articles.length === 0 ? <EmptyState title="هنوز مقاله مرتبطی پیدا نشد" /> : articles.map((article, index) => <ArticleRow key={article.id} article={article} idx={index} />)}
          </div>
        </div>
        <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          {topic && (
            <button onClick={() => navigate(`/topics/${topic.slug}`)} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 8, padding: 18, textAlign: 'right', cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif' }}>
              <div style={{ fontSize: 12, color: '#5F6B6D' }}>خوشه موضوعی</div>
              <div style={{ fontSize: 18, color: '#0F6B73', fontWeight: 900 }}>{topic.title}</div>
            </button>
          )}
          <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 8, padding: 18 }}>
            <h3 style={{ margin: '0 0 12px', color: '#263238', fontSize: 16 }}>واژه‌های مرتبط</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {related.map((item) => (
                <button key={item.slug} onClick={() => navigate(`/glossary/${item.slug}`)} style={{ ...pillBtn, background: '#F4EFE6', color: '#0F6B73', border: '1px solid #E4DDD2', fontSize: 12 }}>{item.term}</button>
              ))}
            </div>
          </div>
        </aside>
      </section>
      <style>{`@media(max-width:850px){.glossary-grid{grid-template-columns:1fr!important}}`}</style>
    </main>
  );
}

function toDateKey(article) {
  return article?.dateEn || article?.publishedAt || article?.date || '';
}

function AuthorsListPage() {
  const { navigate } = useNav();
  const [authors, setAuthors] = useState(() => contentApi.fallbackAuthors());
  const [articles, setArticles] = useState(() => contentApi.fallbackArticles());
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      contentApi.listAuthors().catch(() => null),
      contentApi.listArticles({ limit: 100 }).catch(() => null),
    ]).then(([authorRows, articleRows]) => {
      if (cancelled) return;
      if (authorRows) setAuthors(authorRows);
      if (articleRows?.items) setArticles(articleRows.items);
    });
    return () => { cancelled = true; };
  }, []);
  return (
    <div style={{ paddingTop: 80, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', direction: 'rtl' }}>
        <div style={{ paddingTop: 32, paddingBottom: 32, borderBottom: '1px solid #E4DDD2' }}>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: '#263238', margin: '0 0 8px' }}>نویسندگان تکناو</h1>
          <p style={{ fontSize: 15, color: '#5F6B6D', margin: 0 }}>متخصصانی که روایت عمیق فناوری را می‌نویسند</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 20, padding: '32px 0' }}>
          {authors.map(author => {
            const latestArt = articles.find(a => a.authorId === author.id || a.authorSlug === author.slug);
            return (
              <div key={author.id} onClick={() => navigate('/author/' + author.slug)} style={{
                background: '#fff', border: '1px solid #E4DDD2', borderRadius: 14, padding: 24,
                cursor: 'pointer', direction: 'rtl', transition: 'all 0.2s',
              }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(0,0,0,0.08)'; }}
                 onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                  <AuthorAvatar author={author} size={60} />
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#263238', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {author.name}
                      {author.verifiedExpert && <span style={{ fontSize: 10, color: '#0F6B73', background: '#0F6B7314', border: '1px solid #0F6B7330', borderRadius: 999, padding: '2px 7px' }}>تاییدشده</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#5F6B6D', marginBottom: 6 }}>{author.specialty}</div>
                    <div style={{ fontSize: 12, color: '#0F6B73', fontWeight: 600 }}>{author.articleCount} مقاله منتشرشده</div>
                  </div>
                </div>
                <p style={{ fontSize: 13, color: '#5F6B6D', lineHeight: 1.7, margin: '0 0 16px' }}>{author.bio.slice(0, 120)}…</p>
                {latestArt && (
                  <div style={{ background: '#F4EFE6', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#263238' }}>
                    <span style={{ color: '#5F6B6D' }}>آخرین مقاله: </span>
                    {latestArt.title.slice(0, 50)}…
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Author Profile Page ─────────────────────────────────────────────────────
function SeriesPage({ slug }) {
  const { navigate } = useNav();
  const [series, setSeries] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    contentApi.getSeries(slug)
      .then((item) => { if (!cancelled) setSeries(item); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [slug]);

  if (error) {
    return (
      <div style={{ paddingTop: 100, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
        <EmptyState title="سری مقاله پیدا نشد" subtitle="این مجموعه در API وجود ندارد یا هنوز منتشر نشده است." />
      </div>
    );
  }

  if (!series) {
    return <div style={{ paddingTop: 120, minHeight: '60vh', textAlign: 'center', fontFamily: 'Vazirmatn,sans-serif', color: '#5F6B6D' }}>در حال بارگذاری...</div>;
  }

  return (
    <div style={{ paddingTop: 80, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
        <button onClick={() => navigate('/articles')} style={{ ...pillBtn, background: '#F4EFE6', color: '#0F6B73', border: '1px solid #E4DDD2', marginBottom: 18 }}>بازگشت به مقاله‌ها</button>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: '#263238', margin: '0 0 10px' }}>{series.title}</h1>
        {series.description && <p style={{ color: '#5F6B6D', fontSize: 15, lineHeight: 1.9, margin: '0 0 28px' }}>{series.description}</p>}
        {(series.articles ?? []).length === 0 ? <EmptyState title="هنوز مقاله‌ای در این سری نیست" /> : (
          <div style={{ display: 'grid', gap: 14 }}>
            {series.articles.map((item, index) => (
              <div key={item.article.id} style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 14, alignItems: 'start' }}>
                <div style={{ width: 36, height: 36, borderRadius: 999, background: '#0F6B73', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900 }}>{(item.position ?? index + 1).toLocaleString('fa-IR')}</div>
                <ArticleRow article={item.article} idx={index} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TopicHubPage({ slug }) {
  const { navigate } = useNav();
  const toast = useToast();
  const { user } = useAuth();
  const topic = TeknavData.topicHubs.find((item) => item.slug === slug);
  const category = TeknavData.categories.find((item) => item.slug === topic?.categorySlug);
  const [articles, setArticles] = useState(() => contentApi.fallbackArticles().filter((item) => item.category === topic?.categorySlug));
  const [series, setSeries] = useState([]);
  const [follow, setFollow] = useState({ following: false, count: 0 });
  const [guestPushEnabled, setGuestPushEnabled] = useState(false);
  const [guestPushBusy, setGuestPushBusy] = useState(false);

  useEffect(() => {
    if (!topic) return;
    let cancelled = false;
    setArticles(contentApi.fallbackArticles().filter((item) => item.category === topic.categorySlug));
    Promise.all([
      contentApi.listArticles({ category: topic.categorySlug, limit: 100 }).catch(() => null),
      contentApi.listSeries().catch(() => []),
      engagementApi.topicFollowers(topic.slug).catch(() => null),
    ]).then(([articleRows, seriesRows, followRow]) => {
      if (cancelled) return;
      if (articleRows?.items) setArticles(articleRows.items);
      setSeries((seriesRows ?? []).filter((row) => (row.articles ?? []).some((entry) => entry.article?.category === topic.categorySlug)));
      if (followRow) setFollow({ following: !!followRow.following, count: followRow.count ?? 0 });
    });
    // Check if guest push already subscribed
    if ('PushManager' in window && 'serviceWorker' in navigator) {
      pushApi.isSubscribed().then(setGuestPushEnabled).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [topic?.slug]);

  if (!topic) {
    return (
      <div style={{ paddingTop: 100, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
        <EmptyState title="موضوع پیدا نشد" subtitle="این خوشه محتوایی هنوز در تکناو تعریف نشده است." />
      </div>
    );
  }

  const featured = articles.filter((item) => item.featured).slice(0, 3);
  const latest = articles.slice().sort((a, b) => String(toDateKey(b)).localeCompare(String(toDateKey(a)))).slice(0, 8);
  const authors = TeknavData.authors.filter((author) => articles.some((article) => article.authorId === author.id || article.authorSlug === author.slug));

  const toggleTopicFollow = async () => {
    if (!user) {
      toast('برای دنبال کردن موضوع ابتدا وارد شوید', 'warning');
      return;
    }
    try {
      const result = follow.following
        ? await engagementApi.unfollowTopic(topic.slug)
        : await engagementApi.followTopic(topic.slug);
      setFollow({ following: !!result.following, count: result.count ?? 0 });
      toast(result.following ? 'موضوع دنبال شد' : 'دنبال کردن موضوع لغو شد');
    } catch {
      toast('دنبال کردن موضوع انجام نشد', 'warning');
    }
  };

  const toggleGuestPush = async () => {
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
      toast('مرورگر شما از اعلان‌های وب پشتیبانی نمی‌کند', 'warning');
      return;
    }
    setGuestPushBusy(true);
    try {
      if (guestPushEnabled) {
        await pushApi.unsubscribeGuest();
        setGuestPushEnabled(false);
        toast('اعلان‌های این موضوع غیرفعال شد');
      } else {
        const perm = typeof Notification !== 'undefined' ? await Notification.requestPermission() : 'denied';
        if (perm !== 'granted') {
          toast('اجازه اعلان داده نشد', 'warning');
          return;
        }
        await pushApi.subscribeAsGuest([topic.slug]);
        setGuestPushEnabled(true);
        toast('اعلان‌های مقالات جدید این موضوع فعال شد');
      }
    } catch {
      toast('عملیات ناموفق بود', 'error');
    } finally {
      setGuestPushBusy(false);
    }
  };

  return (
    <div style={{ paddingTop: 72, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
      <section style={{ borderBottom: '1px solid #E4DDD2', background: `linear-gradient(135deg, ${category?.color ?? '#0F6B73'}18, #F4EFE6)`, padding: '44px 24px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <button onClick={() => navigate('/articles')} style={{ ...pillBtn, background: '#FFFFFFAA', color: '#0F6B73', border: '1px solid #E4DDD2', marginBottom: 18 }}>همه مقاله‌ها</button>
          <h1 style={{ fontSize: 'clamp(30px,5vw,48px)', color: '#263238', fontWeight: 900, margin: '0 0 12px' }}>{topic.title}</h1>
          <p style={{ maxWidth: 760, color: '#4F5D60', fontSize: 16, lineHeight: 1.95, margin: 0 }}>{topic.intro}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <button onClick={toggleTopicFollow} style={{ ...pillBtn, background: follow.following ? '#0F6B73' : '#fff', color: follow.following ? '#fff' : '#0F6B73', border: '1px solid #0F6B7330' }}>
              {follow.following ? 'دنبال می‌کنید' : 'دنبال کردن موضوع'} · {(follow.count ?? 0).toLocaleString('fa-IR')}
            </button>
            {'PushManager' in window && (
              <button onClick={toggleGuestPush} disabled={guestPushBusy} style={{ ...pillBtn, background: guestPushEnabled ? '#fff' : '#FAF7F0', color: '#0F6B73', border: '1px solid #0F6B7330', opacity: guestPushBusy ? 0.6 : 1 }}>
                {guestPushBusy ? '…' : guestPushEnabled ? 'اعلان فعال است' : 'دریافت اعلان مقالات'}
              </button>
            )}
          </div>
        </div>
      </section>

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '36px 24px', display: 'grid', gap: 34 }}>
        <section>
          <h2 style={{ color: '#263238', fontSize: 22, margin: '0 0 18px' }}>مقاله‌های شاخص</h2>
          {featured.length === 0 ? <EmptyState title="مقاله شاخصی برای این موضوع ثبت نشده است" /> : (
            <div style={{ display: 'grid', gap: 14 }}>
              {featured.map((article, index) => <ArticleRow key={article.id} article={article} idx={index} />)}
            </div>
          )}
        </section>

        <section>
          <h2 style={{ color: '#263238', fontSize: 22, margin: '0 0 18px' }}>تازه‌ترین تحلیل‌ها</h2>
          {latest.length === 0 ? <EmptyState title="هنوز مقاله‌ای در این موضوع منتشر نشده است" /> : latest.map((article, index) => <ArticleRow key={article.id} article={article} idx={index} />)}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
          <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 20 }}>
            <h2 style={{ color: '#263238', fontSize: 18, margin: '0 0 14px' }}>سری‌های مرتبط</h2>
            {series.length === 0 ? <p style={{ color: '#5F6B6D', lineHeight: 1.8, margin: 0 }}>سری مقاله مرتبط پس از تایید سردبیر اینجا نمایش داده می‌شود.</p> : series.map((item) => (
              <button key={item.id} onClick={() => navigate(`/series/${item.slug}`)} style={{ display: 'block', width: '100%', textAlign: 'right', background: '#F4EFE6', border: '1px solid #E4DDD2', borderRadius: 8, padding: 12, marginBottom: 10, color: '#263238', cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif' }}>{item.title}</button>
            ))}
          </div>
          <div style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 20 }}>
            <h2 style={{ color: '#263238', fontSize: 18, margin: '0 0 14px' }}>نویسندگان مرتبط</h2>
            {authors.length === 0 ? <p style={{ color: '#5F6B6D', lineHeight: 1.8, margin: 0 }}>نویسنده مرتبطی پیدا نشد.</p> : authors.map((author) => (
              <button key={author.id} onClick={() => navigate(`/author/${author.slug}`)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'transparent', border: 0, padding: '8px 0', color: '#263238', cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif', textAlign: 'right' }}>
                <AuthorAvatar author={author} size={36} />
                <span>{author.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 20 }}>
          <h2 style={{ color: '#263238', fontSize: 18, margin: '0 0 14px' }}>پرسش‌های رایج</h2>
          {topic.faqs.map(([question, answer]) => (
            <details key={question} style={{ borderTop: '1px solid #E4DDD2', padding: '12px 0' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#263238' }}>{question}</summary>
              <p style={{ color: '#5F6B6D', lineHeight: 1.9, margin: '10px 0 0' }}>{answer}</p>
            </details>
          ))}
        </section>
      </div>
    </div>
  );
}

function AuthorProfilePage({ slug }) {
  const { navigate } = useNav();
  const [author, setAuthor] = useState(null);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      contentApi.getAuthor(slug).catch(() => null),
      contentApi.listArticles({ author: slug, limit: 100 }).catch(() => null),
    ]).then(([authorRow, articleRows]) => {
      if (cancelled) return;
      if (authorRow) setAuthor(authorRow);
      if (articleRows?.items) setArticles(articleRows.items);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return <div style={{ paddingTop: 120, textAlign: 'center', fontFamily: 'Vazirmatn,sans-serif', color: '#5F6B6D' }}>در حال بارگذاری…</div>;
  if (!author) return <EmptyState title="نویسنده یافت نشد" />;

  return (
    <div style={{ paddingTop: 80, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
      {/* Profile header */}
      <div style={{ background: 'linear-gradient(135deg,#20343A,#0F2830)', padding: '48px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
          <AuthorAvatar author={author} size={96} />
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#FAF7F0', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {author.name}
              {author.verifiedExpert && <span style={{ fontSize: 12, color: '#D49A2A', background: 'rgba(212,154,42,0.12)', border: '1px solid rgba(212,154,42,0.45)', borderRadius: 999, padding: '3px 10px' }}>متخصص تاییدشده</span>}
            </h1>
            {author.verifiedExpert && author.verificationNote && <div style={{ color: '#CFE2DD', fontSize: 12, marginBottom: 8 }}>{author.verificationNote}</div>}
            <div style={{ fontSize: 14, color: '#D49A2A', fontWeight: 600, marginBottom: 10 }}>{author.specialty}</div>
            <p style={{ fontSize: 14, color: '#90A4AE', lineHeight: 1.8, margin: '0 0 16px', maxWidth: 520 }}>{author.bio}</p>
            <div style={{ display: 'flex', gap: 24 }}>
              <div><span style={{ fontSize: 22, fontWeight: 800, color: '#D49A2A' }}>{author.articleCount}</span><span style={{ fontSize: 12, color: '#90A4AE', marginRight: 4 }}>مقاله</span></div>
              <div><span style={{ fontSize: 22, fontWeight: 800, color: '#D49A2A' }}>{articles.reduce((s, a) => s + (a.views || 0), 0).toLocaleString('fa')}</span><span style={{ fontSize: 12, color: '#90A4AE', marginRight: 4 }}>بازدید</span></div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#263238', margin: '0 0 24px' }}>مقاله‌های {author.name}</h2>
        {articles.length === 0 ? <EmptyState title="مقاله‌ای منتشر نشده" /> :
          articles.map((a, i) => <ArticleRow key={a.id} article={a} idx={i} />)
        }
      </div>
    </div>
  );
}

function NewsletterArchivePage() {
  const { navigate } = useNav();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    contentApi.listNewsletterArchive()
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ paddingTop: 80, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#263238', margin: '0 0 10px' }}>آرشیو خبرنامه تکنـاو</h1>
        <p style={{ color: '#5F6B6D', lineHeight: 1.9, margin: '0 0 28px' }}>نسخه‌های ارسال‌شده خبرنامه برای دنبال کردن روندهای مهم فناوری، هوش مصنوعی و امنیت.</p>
        {loading ? <div style={{ color: '#5F6B6D' }}>در حال بارگذاری...</div> : items.length === 0 ? <EmptyState title="هنوز خبرنامه‌ای منتشر نشده است" /> : (
          <div style={{ display: 'grid', gap: 14 }}>
            {items.map((item) => (
              <button key={item.id} onClick={() => navigate(`/newsletter/${item.slug}`)} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 10, padding: 18, textAlign: 'right', cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#263238', marginBottom: 6 }}>{item.subject}</div>
                <div style={{ color: '#5F6B6D', fontSize: 12 }}>{item.sentAt ? new Date(item.sentAt).toLocaleDateString('fa-IR') : 'منتشر نشده'}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewsletterIssuePage({ slug }) {
  const { navigate } = useNav();
  const [issue, setIssue] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    contentApi.getNewsletterIssue(slug)
      .then((row) => { if (!cancelled) setIssue(row); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [slug]);

  if (error) return <div style={{ paddingTop: 100, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}><EmptyState title="خبرنامه پیدا نشد" /></div>;
  if (!issue) return <div style={{ paddingTop: 120, textAlign: 'center', color: '#5F6B6D', fontFamily: 'Vazirmatn,sans-serif' }}>در حال بارگذاری...</div>;

  return (
    <div style={{ paddingTop: 80, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
      <article style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px' }}>
        <button onClick={() => navigate('/newsletter')} style={{ ...pillBtn, background: '#F4EFE6', color: '#0F6B73', border: '1px solid #E4DDD2', marginBottom: 18 }}>آرشیو خبرنامه</button>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: '#263238', lineHeight: 1.45, margin: '0 0 10px' }}>{issue.subject}</h1>
        <div style={{ color: '#5F6B6D', fontSize: 12, marginBottom: 28 }}>{issue.sentAt ? new Date(issue.sentAt).toLocaleDateString('fa-IR') : ''}</div>
        <div className="article-content" style={{ fontSize: 16, lineHeight: 2, color: '#263238', background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 24 }} dangerouslySetInnerHTML={{ __html: issue.bodyHtml }} />
      </article>
    </div>
  );
}

function JobsPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ company: '', title: '', location: 'Remote', remote: true, url: '', contactEmail: '', description: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    contentApi.listJobs().then(setItems).catch(() => setItems([]));
  }, []);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await contentApi.submitJob(form);
      setForm({ company: '', title: '', location: 'Remote', remote: true, url: '', contactEmail: '', description: '' });
      toast('آگهی شغلی برای بررسی ارسال شد');
    } catch {
      toast('ارسال آگهی ناموفق بود', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ paddingTop: 80, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#263238', margin: '0 0 8px' }}>فرصت‌های شغلی فناوری</h1>
        <p style={{ color: '#5F6B6D', lineHeight: 1.9, margin: '0 0 28px' }}>جایگاه‌های منتخب شرکت‌های فنی فارسی‌زبان. آگهی‌های جدید بعد از بررسی تحریریه منتشر می‌شوند.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 22 }} className="jobs-grid">
          <section style={{ display: 'grid', gap: 12 }}>
            {items.length === 0 ? <EmptyState title="هنوز آگهی منتشرشده‌ای وجود ندارد" /> : items.map((job) => (
              <article key={job.id} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ margin: '0 0 6px', fontSize: 18, color: '#263238' }}>{job.title}</h2>
                    <div style={{ color: '#0F6B73', fontWeight: 800, fontSize: 13 }}>{job.company}</div>
                  </div>
                  <span style={{ color: '#5F6B6D', fontSize: 12 }}>{job.remote ? 'Remote' : job.location}</span>
                </div>
                <p style={{ color: '#5F6B6D', lineHeight: 1.8, fontSize: 13 }}>{job.description}</p>
                {job.url && <a href={job.url} target="_blank" rel="noreferrer" style={{ color: '#0F6B73', fontWeight: 800 }}>مشاهده و ارسال رزومه</a>}
              </article>
            ))}
          </section>
          <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 18, alignSelf: 'start', display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 17, color: '#263238' }}>ثبت آگهی شرکت</h2>
            <input required value={form.company} onChange={e => set('company', e.target.value)} placeholder="نام شرکت" style={inputStyle} />
            <input required value={form.title} onChange={e => set('title', e.target.value)} placeholder="عنوان شغل" style={inputStyle} />
            <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="موقعیت" style={inputStyle} />
            <input value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} placeholder="ایمیل تماس" style={inputStyle} dir="ltr" />
            <input value={form.url} onChange={e => set('url', e.target.value)} placeholder="لینک درخواست" style={inputStyle} dir="ltr" />
            <label style={{ display: 'flex', gap: 8, fontSize: 13, color: '#263238' }}><input type="checkbox" checked={form.remote} onChange={e => set('remote', e.target.checked)} /> امکان دورکاری</label>
            <textarea required value={form.description} onChange={e => set('description', e.target.value)} placeholder="شرح موقعیت" style={{ ...inputStyle, minHeight: 110, resize: 'vertical' }} />
            <button disabled={busy} style={{ ...pillBtn, background: '#0F6B73', color: '#fff', justifyContent: 'center' }}>{busy ? 'در حال ارسال...' : 'ارسال برای بررسی'}</button>
          </form>
        </div>
      </div>
      <style>{`@media(max-width:850px){.jobs-grid{grid-template-columns:1fr!important}}`}</style>
    </div>
  );
}

function CoursesPage() {
  const [items, setItems] = useState([]);
  useEffect(() => { contentApi.listCourses().then(setItems).catch(() => setItems([])); }, []);
  return (
    <div style={{ paddingTop: 80, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#263238', margin: '0 0 8px' }}>دوره‌های تخصصی تکناو</h1>
        <p style={{ color: '#5F6B6D', lineHeight: 1.9, margin: '0 0 28px' }}>مسیرهای آموزشی فارسی برای تیم‌هایی که فناوری را در محصول و عملیات واقعی به کار می‌گیرند.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
          {items.map(course => (
            <article key={course.id} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 20 }}>
              <div style={{ color: '#0F6B73', fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{course.level}</div>
              <h2 style={{ margin: '0 0 10px', color: '#263238', fontSize: 19 }}>{course.title}</h2>
              <p style={{ color: '#5F6B6D', lineHeight: 1.9, fontSize: 13 }}>{course.summary}</p>
              <div style={{ marginTop: 16, color: '#D49A2A', fontWeight: 900 }}>{course.price ? `${course.price.toLocaleString('fa-IR')} تومان` : 'به‌زودی'}</div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function MembershipPage() {
  const { navigate } = useNav();
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch('/api/membership/status', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setStatus(d))
      .catch(() => {});
  }, []);

  const subscribe = async () => {
    if (!user) { navigate('/login'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/membership/subscribe', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        toast(data.error === 'payment_unavailable' ? 'درگاه پرداخت در دسترس نیست' : 'خطا در اتصال به درگاه پرداخت');
        setLoading(false);
      }
    } catch {
      toast('خطا در ارتباط با سرور');
      setLoading(false);
    }
  };

  const isPremium = status?.active;

  return (
    <div style={{ paddingTop: 80, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '44px 24px' }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#263238', margin: '0 0 8px' }}>عضویت پریمیوم تکناو</h1>
        <p style={{ color: '#5F6B6D', lineHeight: 1.9, marginBottom: 28 }}>
          تجربه بدون تبلیغ، مقاله‌های اختصاصی، دوره‌های کوتاه و گزارش‌های عمیق برای خوانندگان حرفه‌ای.
        </p>

        {isPremium && (
          <div style={{ background: '#0F6B7318', border: '1px solid #0F6B7340', borderRadius: 12, padding: '16px 20px', marginBottom: 28, color: '#0F6B73', fontWeight: 700 }}>
            ✓ شما در حال حاضر عضو ویژه هستید
            {status?.expiresAt && ` — اعتبار تا ${new Date(status.expiresAt).toLocaleDateString('fa-IR')}`}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, marginBottom: 32 }}>
          {[
            ['👑', 'بدون تبلیغ', 'خواندن آرام و سریع‌تر بدون جایگاه‌های تبلیغاتی.'],
            ['📖', 'محتوای اختصاصی', 'تحلیل‌های عمیق‌تر و پرونده‌های تخصصی برای اعضا.'],
            ['🎓', 'تخفیف دوره‌ها', 'دسترسی زودتر و تخفیف روی دوره‌های فارسی تکناو.'],
          ].map(([icon, title, body]) => (
            <section key={title} style={{ background: '#fff', border: '1px solid #E4DDD2', borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
              <h2 style={{ margin: '0 0 8px', fontSize: 18, color: '#263238' }}>{title}</h2>
              <p style={{ margin: 0, color: '#5F6B6D', lineHeight: 1.8 }}>{body}</p>
            </section>
          ))}
        </div>

        {!isPremium && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#5F6B6D', marginBottom: 16 }}>
              سالانه — ۵۰۰,۰۰۰ تومان
            </div>
            <button onClick={subscribe} disabled={loading} style={{
              background: 'linear-gradient(135deg, #D49A2A, #B8821E)', color: '#fff',
              border: 'none', borderRadius: 10, padding: '14px 36px', fontSize: 16, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              fontFamily: 'Vazirmatn,sans-serif',
            }}>
              {loading ? 'در حال اتصال به درگاه...' : 'شروع عضویت ویژه'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MembershipSuccessPage() {
  const { navigate } = useNav();
  return (
    <div style={{ paddingTop: 80, background: '#FAF7F0', minHeight: '100vh', fontFamily: 'Vazirmatn,sans-serif', direction: 'rtl', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 24px' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>👑</div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: '#263238', marginBottom: 12 }}>عضویت ویژه فعال شد!</h1>
        <p style={{ color: '#5F6B6D', lineHeight: 1.9, marginBottom: 28 }}>از حالا به همه مقالات پریمیوم دسترسی دارید. ممنون از حمایت شما از تکناو.</p>
        <button onClick={() => navigate('/')} style={{ ...pillBtn, background: '#0F6B73', color: '#fff', padding: '12px 28px', fontSize: 14 }}>بازگشت به خانه</button>
      </div>
    </div>
  );
}

export { SearchPage, CategoryPage, TagPage, GlossaryPage, AuthorsListPage, AuthorProfilePage, SeriesPage, TopicHubPage, NewsletterArchivePage, NewsletterIssuePage, JobsPage, CoursesPage, MembershipPage, MembershipSuccessPage };
