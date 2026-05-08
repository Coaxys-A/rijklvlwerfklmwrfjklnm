import { useEffect, useMemo, useState } from 'react';
import { TeknavData } from '../../teknav-data.js';
import { api } from './api.js';
import { contentApi } from './content-api.js';
import { useNav } from '../../teknav-ui.jsx';

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://www.teknav.ir').replace(/\/$/, '');
const SITE_NAME = 'تکناو';
const DEFAULT_TITLE = 'تکناو | تحلیل فناوری، هوش مصنوعی و امنیت سایبری';
const DEFAULT_DESCRIPTION = 'تکناو رسانه فارسی تحلیل فناوری، هوش مصنوعی، علم داده، امنیت سایبری، نرم‌افزار، سخت‌افزار و آینده تکنولوژی است.';
const DEFAULT_KEYWORDS = 'تکناو, فناوری, هوش مصنوعی, علم داده, امنیت سایبری, نرم افزار, سخت افزار, استارتاپ, آینده فناوری, تحلیل تکنولوژی';
const DEFAULT_IMAGE = `${SITE_URL}/images/og/default.jpg`;

function cleanText(value, fallback = '') {
  return String(value ?? fallback)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value, max = 155) {
  const text = cleanText(value);
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

function absoluteUrl(path = '/') {
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}

function imageUrl(value) {
  return value ? absoluteUrl(value) : DEFAULT_IMAGE;
}

function uniqueList(values, limit = 18) {
  const seen = new Set();
  return values
    .map((value) => cleanText(value))
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLocaleLowerCase('fa-IR');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function articleKeywords(article, category, author) {
  return uniqueList([
    ...(article.keywords || []),
    ...(article.tags || []),
    article.title,
    article.subtitle,
    article.categoryName || category?.name,
    article.type,
    author?.specialty,
    'تحلیل فارسی فناوری',
    'تکناو',
  ]);
}

function articleEntities(article, category) {
  return uniqueList([
    article.categoryName || category?.name,
    ...(article.tags || []),
    ...(article.keywords || []),
  ], 24).map((name) => ({ '@type': 'Thing', name }));
}

function articleSections(content) {
  return [...String(content || '').matchAll(/<h2[^>]*>(.*?)<\/h2>/g)]
    .map((match) => cleanText(match[1]))
    .filter(Boolean)
    .slice(0, 12);
}

function setMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel, href, extra = {}) {
  let el = document.head.querySelector(`link[rel="${rel}"]${extra.hreflang ? `[hreflang="${extra.hreflang}"]` : ''}`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    if (extra.hreflang) el.setAttribute('hreflang', extra.hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(items) {
  document.head.querySelectorAll('script[data-teknav-seo="jsonld"]').forEach((el) => el.remove());
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.dataset.teknavSeo = 'jsonld';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': items.filter(Boolean),
  });
  document.head.appendChild(script);
}

function baseGraph() {
  return [
    {
      '@type': ['Organization', 'NewsMediaOrganization'],
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      alternateName: ['Teknav', 'تکنّاو'],
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
      logo: {
        '@type': 'ImageObject',
        '@id': `${SITE_URL}/#logo`,
        url: `${SITE_URL}/favicon.png`,
        width: { '@type': 'QuantitativeValue', value: 512 },
        height: { '@type': 'QuantitativeValue', value: 512 },
        caption: 'تکناو - رسانه فارسی فناوری',
      },
      image: { '@id': `${SITE_URL}/#logo` },
      publishingPrinciples: `${SITE_URL}/about`,
      masthead: `${SITE_URL}/authors`,
      areaServed: { '@type': 'Country', name: 'Iran' },
      audience: { '@type': 'Audience', audienceType: 'فارسی‌زبانان علاقه‌مند به فناوری' },
      sameAs: [
        'https://twitter.com/teknavir',
        'https://x.com/teknavir',
        'https://linkedin.com/company/teknav',
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'info@teknav.ir',
        contactType: 'customer service',
        availableLanguage: { '@type': 'Language', name: 'Persian' },
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      alternateName: 'Teknav',
      description: DEFAULT_DESCRIPTION,
      inLanguage: 'fa-IR',
      publisher: { '@id': `${SITE_URL}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ];
}

function breadcrumb(items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.path ? absoluteUrl(item.path) : undefined,
    })),
  };
}

function itemList(items, path) {
  return {
    '@type': 'ItemList',
    url: absoluteUrl(path),
    itemListElement: items.slice(0, 15).map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(item.canonicalPath || `/article/${item.slug}`),
      name: item.title,
    })),
  };
}

function findCategory(article) {
  return TeknavData.categories.find((c) => (
    c.id === article?.category ||
    c.slug === article?.category ||
    c.slug === article?.categorySlug ||
    c.name === article?.categoryName
  ));
}

function findAuthor(article) {
  return TeknavData.authors.find((a) => (
    a.id === article?.authorId ||
    a.slug === article?.authorSlug ||
    a.name === article?.authorName
  ));
}

function articleSeo(article) {
  const category = findCategory(article);
  const author = findAuthor(article);
  const path = article.canonicalPath || `/article/${article.slug}`;
  const title = article.ogTitle || `${article.title} | تکناو`;
  const description = truncate(article.metaDescription || article.ogDescription || article.summary || article.subtitle || article.content, 160);
  const datePublished = article.publishedAt || article.dateEn;
  const dateModified = article.dateModified || article.updatedAt || article.publishedAt || article.dateEn;
  const image = imageUrl(article.ogImage || article.imageUrl || article.coverUrl);
  const keywords = articleKeywords(article, category, author);
  const sections = articleSections(article.content);
  const about = [
    category ? { '@type': 'Thing', name: category.name, url: absoluteUrl(`/topics/${category.slug}`) } : null,
    ...articleEntities(article, category).slice(0, 5),
  ].filter(Boolean);
  const mentions = articleEntities(article, category);

  return {
    title,
    description,
    keywords: keywords.join(', '),
    canonical: absoluteUrl(path),
    type: 'article',
    image,
    jsonLd: [
      ...baseGraph(),
      {
        '@type': ['NewsArticle', 'TechArticle'],
        '@id': `${absoluteUrl(path)}#article`,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': absoluteUrl(path),
        },
        headline: cleanText(article.title).slice(0, 110),
        alternativeHeadline: cleanText(article.subtitle || article.summary).slice(0, 110) || undefined,
        description,
        abstract: cleanText(article.summary || article.subtitle || description),
        articleBody: truncate(article.content, 5000),
        image: {
          '@type': 'ImageObject',
          url: image,
          width: 1200,
          height: 630
        },
        datePublished,
        dateModified,
        inLanguage: 'fa-IR',
        articleSection: article.categoryName || category?.name,
        keywords,
        wordCount: cleanText(article.content).split(/\s+/).filter(Boolean).length || undefined,
        timeRequired: article.readTime ? `PT${article.readTime}M` : undefined,
        genre: article.type,
        teaches: sections,
        author: {
          '@type': 'Person',
          name: article.authorName || author?.name,
          url: author ? absoluteUrl(`/author/${author.slug}`) : undefined,
          jobTitle: author?.specialty,
          description: author?.bio,
          knowsAbout: author?.expertise,
          sameAs: author?.social ? Object.values(author.social).filter(v => v && v !== '#') : [],
        },
        publisher: { '@id': `${SITE_URL}/#organization` },
        about,
        mentions,
        isPartOf: [
          { '@id': `${SITE_URL}/#website` },
          category ? { '@type': 'CollectionPage', '@id': absoluteUrl(`/topics/${category.slug}`) } : null,
        ].filter(Boolean),
        speakable: {
          '@type': 'SpeakableSpecification',
          xpath: ['/html/head/title', '/html/head/meta[@name="description"]/@content']
        },
        isAccessibleForFree: true,
        educationalLevel: 'Intermediate',
        ...(article.factCheckedAt ? {
          reviewedBy: { '@id': `${SITE_URL}/#organization` },
          lastReviewed: article.factCheckedAt
        } : {})
      },
      breadcrumb([
        { name: SITE_NAME, path: '/' },
        { name: 'مقاله‌ها', path: '/articles' },
        category ? { name: category.name, path: `/category/${category.slug}` } : null,
        { name: article.title },
      ].filter(Boolean)),
    ],
  };
}

function pageSeo(page, data) {
  if (page.startsWith('/article/') && data.article) return articleSeo(data.article);

  if (page.startsWith('/category/')) {
    const slug = page.replace('/category/', '');
    const category = data.category || TeknavData.categories.find((c) => c.slug === slug || c.id === slug);
    const name = category?.name || 'دسته‌بندی فناوری';
    const description = truncate(category?.description || `مقاله‌ها و تحلیل‌های فارسی تکناو درباره ${name}.`, 155);
    return {
      title: `${name} | مقاله‌ها و تحلیل‌های تکناو`,
      description,
      keywords: `${name}, مقاله ${name}, تحلیل ${name}, فناوری, تکناو`,
      canonical: absoluteUrl(`/category/${slug}`),
      type: 'website',
      image: DEFAULT_IMAGE,
      jsonLd: [
        ...baseGraph(),
        { '@type': 'CollectionPage', name, description, url: absoluteUrl(`/category/${slug}`), inLanguage: 'fa-IR' },
        breadcrumb([{ name: SITE_NAME, path: '/' }, { name: name }]),
      ],
    };
  }

  if (page.startsWith('/tag/')) {
    const tag = decodeURIComponent(page.replace('/tag/', ''));
    const articles = TeknavData.articles
      .filter((article) => article.tags?.includes(tag) && article.status !== 'پیش‌نویس' && article.status !== 'در انتظار بررسی')
      .sort((a, b) => String(b.dateEn || '').localeCompare(String(a.dateEn || '')));
    return {
      title: `برچسب ${tag} | مقاله‌های تکنـاو`,
      description: truncate(`همه مقاله‌های تکنـاو درباره ${tag}، همراه با تحلیل فارسی، داده و مسیرهای مرتبط برای مطالعه بیشتر.`, 155),
      keywords: `${tag}, تکنـاو, مقاله فناوری, تحلیل فناوری`,
      canonical: absoluteUrl(`/tag/${encodeURIComponent(tag)}`),
      type: 'website',
      image: DEFAULT_IMAGE,
      jsonLd: [
        ...baseGraph(),
        {
          '@type': 'CollectionPage',
          name: `برچسب ${tag}`,
          url: absoluteUrl(`/tag/${encodeURIComponent(tag)}`),
          inLanguage: 'fa-IR',
          mainEntity: itemList(articles, `/tag/${encodeURIComponent(tag)}`),
        },
        breadcrumb([{ name: SITE_NAME, path: '/' }, { name: 'برچسب‌ها', path: '/articles' }, { name: tag }]),
      ],
    };
  }

  if (page.startsWith('/glossary/')) {
    const slug = page.replace('/glossary/', '');
    const term = TeknavData.glossary?.find((item) => item.slug === slug);
    const path = `/glossary/${slug}`;
    const title = term ? `${term.term} چیست؟ | فرهنگ واژگان تکنّاو` : 'فرهنگ واژگان فناوری | تکنّاو';
    const description = truncate(term?.summary || 'تعریف دقیق و فارسی واژه‌های فنی فناوری، هوش مصنوعی، داده، امنیت و نرم‌افزار در تکنّاو.', 160);
    return {
      title,
      description,
      keywords: [term?.term, term?.english, 'فرهنگ واژگان فناوری', 'تکنّاو'].filter(Boolean).join(', '),
      canonical: absoluteUrl(path),
      type: 'website',
      image: DEFAULT_IMAGE,
      jsonLd: [
        ...baseGraph(),
        {
          '@type': 'DefinedTerm',
          name: term?.term,
          alternateName: term?.english,
          description,
          inDefinedTermSet: absoluteUrl('/glossary'),
          url: absoluteUrl(path),
        },
        term?.faqs?.length ? {
          '@type': 'FAQPage',
          mainEntity: term.faqs.map(([question, answer]) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        } : null,
        breadcrumb([{ name: SITE_NAME, path: '/' }, { name: 'فرهنگ واژگان', path: '/articles' }, { name: term?.term || slug }]),
      ].filter(Boolean),
    };
  }

  if (page.startsWith('/topics/')) {
    const slug = page.replace('/topics/', '');
    const topic = TeknavData.topicHubs.find((item) => item.slug === slug);
    const category = TeknavData.categories.find((item) => item.slug === topic?.categorySlug);
    const articles = TeknavData.articles
      .filter((article) => article.category === topic?.categorySlug && article.status !== 'پیش‌نویس' && article.status !== 'در انتظار بررسی')
      .sort((a, b) => String(b.dateEn || '').localeCompare(String(a.dateEn || '')));
    const name = topic?.title || category?.name || 'موضوع فناوری';
    const description = truncate(topic?.description || category?.description || `مقاله‌ها و تحلیل‌های تکناو درباره ${name}.`, 160);
    const path = `/topics/${slug}`;
    return {
      title: topic?.seoTitle || `${name} | خوشه موضوعی تکناو`,
      description,
      keywords: (topic?.keywords ?? [name, 'تکناو', 'تحلیل فناوری']).join(', '),
      canonical: absoluteUrl(path),
      type: 'website',
      image: DEFAULT_IMAGE,
      jsonLd: [
        ...baseGraph(),
        {
          '@type': 'CollectionPage',
          name,
          description,
          url: absoluteUrl(path),
          inLanguage: 'fa-IR',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          mainEntity: itemList(articles, path),
        },
        topic?.faqs?.length ? {
          '@type': 'FAQPage',
          mainEntity: topic.faqs.map(([question, answer]) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        } : null,
        breadcrumb([{ name: SITE_NAME, path: '/' }, { name: 'موضوعات', path: '/articles' }, { name }]),
      ],
    };
  }

  if (page.startsWith('/series/')) {
    const slug = page.replace('/series/', '');
    const series = data.series;
    const path = `/series/${slug}`;
    const name = series?.title || 'سری مقاله تکناو';
    const description = truncate(series?.description || 'سری مقاله‌های تکناو برای دنبال کردن یک موضوع فناوری به‌ترتیب تحریریه.', 160);
    const articles = (series?.articles ?? []).map((item) => item.article).filter(Boolean);
    return {
      title: `${name} | سری مقاله‌های تکناو`,
      description,
      keywords: `${name}, سری مقاله, تکناو, تحلیل فناوری`,
      canonical: absoluteUrl(path),
      type: 'website',
      image: imageUrl(series?.coverImage),
      jsonLd: [
        ...baseGraph(),
        {
          '@type': 'CollectionPage',
          name,
          description,
          url: absoluteUrl(path),
          inLanguage: 'fa-IR',
          mainEntity: itemList(articles, path),
        },
        breadcrumb([{ name: SITE_NAME, path: '/' }, { name: 'سری مقاله‌ها', path: '/articles' }, { name }]),
      ],
    };
  }

  if (page.startsWith('/author/')) {
    const slug = page.replace('/author/', '');
    const author = data.author || TeknavData.authors.find((a) => a.slug === slug);
    const name = author?.name || 'نویسنده تکناو';
    const description = truncate(author?.bio || `آرشیو مقاله‌های ${name} در تکناو.`, 155);
    return {
      title: `${name} | نویسنده تکناو`,
      description,
      keywords: `${name}, نویسنده فناوری, تحلیل فناوری, تکناو`,
      canonical: absoluteUrl(`/author/${slug}`),
      type: 'profile',
      image: DEFAULT_IMAGE,
      jsonLd: [
        ...baseGraph(),
        {
          '@type': 'ProfilePage',
          name: `${name} در تکناو`,
          url: absoluteUrl(`/author/${slug}`),
          inLanguage: 'fa-IR',
          mainEntity: {
            '@type': 'Person',
            name,
            description,
            jobTitle: author?.specialty,
            url: absoluteUrl(`/author/${slug}`),
          },
        },
        breadcrumb([{ name: SITE_NAME, path: '/' }, { name: 'نویسندگان', path: '/authors' }, { name }]),
      ],
    };
  }

  if (page.startsWith('/profile/@')) {
    const username = page.replace('/profile/@', '');
    const name = data.profile?.name || `@${username}`;
    const description = truncate(data.profile?.bio || `پروفایل عمومی ${name} در تکناو.`, 155);
    return {
      title: `${name} | پروفایل تکناو`,
      description,
      keywords: `${name}, ${username}, پروفایل تکناو, نویسنده فناوری`,
      canonical: absoluteUrl(`/profile/@${username}`),
      type: 'profile',
      image: imageUrl(data.profile?.avatarUrl),
      jsonLd: [
        ...baseGraph(),
        {
          '@type': 'ProfilePage',
          name,
          description,
          url: absoluteUrl(`/profile/@${username}`),
          inLanguage: 'fa-IR',
          mainEntity: {
            '@type': 'Person',
            name,
            alternateName: `@${username}`,
            description,
            image: data.profile?.avatarUrl ? imageUrl(data.profile.avatarUrl) : undefined,
          },
        },
      ],
    };
  }

  if (page === '/articles') {
    return {
      title: 'مقاله‌های فناوری | تکناو',
      description: 'آرشیو مقاله‌های فارسی تکناو درباره هوش مصنوعی، علم داده، امنیت سایبری، نرم‌افزار، سخت‌افزار و آینده فناوری.',
      keywords: DEFAULT_KEYWORDS,
      canonical: absoluteUrl('/articles'),
      type: 'website',
      image: DEFAULT_IMAGE,
      jsonLd: [...baseGraph(), { '@type': 'CollectionPage', name: 'مقاله‌های فناوری تکناو', url: absoluteUrl('/articles'), inLanguage: 'fa-IR' }],
    };
  }

  if (page === '/authors') {
    return {
      title: 'نویسندگان تکناو | تحلیلگران فناوری',
      description: 'آشنایی با نویسندگان و تحلیلگران تکناو در حوزه هوش مصنوعی، امنیت سایبری، نرم‌افزار، سخت‌افزار و استارتاپ.',
      keywords: 'نویسندگان تکناو, تحلیلگر فناوری, نویسنده هوش مصنوعی, نویسنده امنیت سایبری',
      canonical: absoluteUrl('/authors'),
      type: 'website',
      image: DEFAULT_IMAGE,
      jsonLd: [...baseGraph(), { '@type': 'CollectionPage', name: 'نویسندگان تکناو', url: absoluteUrl('/authors'), inLanguage: 'fa-IR' }],
    };
  }

  if (page === '/newsletter') {
    return {
      title: 'آرشیو خبرنامه تکنـاو | تحلیل هفتگی فناوری',
      description: 'آرشیو خبرنامه‌های ارسال‌شده تکنـاو درباره هوش مصنوعی، امنیت سایبری، نرم‌افزار، سخت‌افزار، استارتاپ و داده.',
      keywords: 'خبرنامه تکنـاو, آرشیو خبرنامه فناوری, تحلیل هفتگی فناوری, هوش مصنوعی, امنیت سایبری',
      canonical: absoluteUrl('/newsletter'),
      type: 'website',
      image: DEFAULT_IMAGE,
      jsonLd: [
        ...baseGraph(),
        { '@type': 'CollectionPage', name: 'آرشیو خبرنامه تکنـاو', url: absoluteUrl('/newsletter'), inLanguage: 'fa-IR' },
        breadcrumb([{ name: SITE_NAME, path: '/' }, { name: 'خبرنامه' }]),
      ],
    };
  }

  if (page === '/jobs' || page === '/courses' || page === '/membership') {
    const meta = {
      '/jobs': ['فرصت‌های شغلی فناوری | تکناو', 'آگهی‌های شغلی منتخب فناوری و امکان ثبت موقعیت شغلی شرکت‌ها در تکناو.', 'شغل فناوری, استخدام برنامه نویس, استخدام هوش مصنوعی, تکناو جابز'],
      '/courses': ['دوره‌های تخصصی فناوری | تکناو', 'دوره‌های فارسی تکناو برای هوش مصنوعی، امنیت، نرم‌افزار و مهارت‌های فنی محصول‌محور.', 'دوره فناوری, آموزش هوش مصنوعی, آموزش امنیت, دوره فارسی برنامه نویسی'],
      '/membership': ['عضویت پریمیوم تکناو | محتوای اختصاصی فناوری', 'عضویت پریمیوم تکناو برای تجربه بدون تبلیغ، محتوای اختصاصی و دسترسی بهتر به دوره‌ها و گزارش‌های تخصصی.', 'عضویت تکناو, محتوای پریمیوم فناوری, تحلیل اختصاصی فناوری'],
    }[page];
    return {
      title: meta[0],
      description: meta[1],
      keywords: meta[2],
      canonical: absoluteUrl(page),
      type: 'website',
      image: DEFAULT_IMAGE,
      jsonLd: [
        ...baseGraph(),
        { '@type': 'CollectionPage', name: meta[0], url: absoluteUrl(page), inLanguage: 'fa-IR', description: meta[1] },
        breadcrumb([{ name: SITE_NAME, path: '/' }, { name: meta[0] }]),
      ],
    };
  }

  if (page.startsWith('/newsletter/')) {
    const slug = page.replace('/newsletter/', '');
    const issue = data.newsletterIssue;
    const name = issue?.subject || 'خبرنامه تکنـاو';
    const description = truncate(issue?.bodyHtml || 'نسخه‌ای از خبرنامه تکنـاو درباره روندهای مهم فناوری.', 155);
    return {
      title: `${name} | خبرنامه تکنـاو`,
      description,
      keywords: `${name}, خبرنامه تکنـاو, فناوری, هوش مصنوعی, امنیت سایبری`,
      canonical: absoluteUrl(`/newsletter/${slug}`),
      type: 'article',
      image: DEFAULT_IMAGE,
      jsonLd: [
        ...baseGraph(),
        {
          '@type': 'Article',
          headline: cleanText(name).slice(0, 110),
          description,
          datePublished: issue?.sentAt,
          dateModified: issue?.sentAt || issue?.createdAt,
          inLanguage: 'fa-IR',
          mainEntityOfPage: absoluteUrl(`/newsletter/${slug}`),
          publisher: { '@id': `${SITE_URL}/#organization` },
        },
        breadcrumb([{ name: SITE_NAME, path: '/' }, { name: 'خبرنامه', path: '/newsletter' }, { name }]),
      ],
    };
  }

  if (page.startsWith('/search')) {
    const q = new URLSearchParams(page.split('?')[1] || '').get('q') || '';
    return {
      title: q ? `جستجو برای ${q} | تکناو` : 'جستجو در تکناو',
      description: q ? `نتایج جستجوی تکناو برای ${q} در مقاله‌های فارسی فناوری.` : 'جستجو در مقاله‌های فارسی تکناو درباره فناوری و تکنولوژی.',
      keywords: q ? `${q}, جستجوی فناوری, تکناو` : DEFAULT_KEYWORDS,
      canonical: absoluteUrl(q ? `/search?q=${encodeURIComponent(q)}` : '/search'),
      type: 'website',
      image: DEFAULT_IMAGE,
      jsonLd: baseGraph(),
    };
  }

  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    keywords: DEFAULT_KEYWORDS,
    canonical: absoluteUrl('/'),
    type: 'website',
    image: DEFAULT_IMAGE,
    jsonLd: [
      ...baseGraph(),
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/#webpage`,
        name: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
        url: absoluteUrl('/'),
        inLanguage: 'fa-IR',
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#organization` },
        speakable: {
          '@type': 'SpeakableSpecification',
          xpath: ['/html/head/title', '/html/head/meta[@name="description"]/@content'],
        },
      },
    ],
  };
}

export function SeoManager() {
  const { page } = useNav();
  const [data, setData] = useState({});

  useEffect(() => {
    let cancelled = false;
    setData({});

    if (page.startsWith('/article/')) {
      const rawSlug = page.replace('/article/', '');
      const slug = rawSlug === 'ai-agents-2026' ? 'agentic-ai-production' : rawSlug;
      const fallback = contentApi.fallbackArticles().find((a) => a.slug === slug);
      if (fallback) setData({ article: fallback });
      contentApi.getArticle(slug).then((res) => {
        if (!cancelled && res?.article) setData({ article: res.article });
      }).catch(() => {});
    } else if (page.startsWith('/category/')) {
      const slug = page.replace('/category/', '');
      const fallback = TeknavData.categories.find((c) => c.slug === slug || c.id === slug);
      if (fallback) setData({ category: fallback });
      contentApi.getCategory(slug).then((category) => {
        if (!cancelled && category) setData({ category });
      }).catch(() => {});
    } else if (page.startsWith('/author/')) {
      const slug = page.replace('/author/', '');
      const fallback = TeknavData.authors.find((a) => a.slug === slug);
      if (fallback) setData({ author: fallback });
      contentApi.getAuthor(slug).then((author) => {
        if (!cancelled && author) setData({ author });
      }).catch(() => {});
    } else if (page.startsWith('/profile/@')) {
      const username = page.replace('/profile/@', '');
      api.get(`/api/profile/${username}`)
        .then((res) => { if (!cancelled && res?.profile) setData({ profile: res.profile }); })
        .catch(() => {});
    } else if (page.startsWith('/series/')) {
      const slug = page.replace('/series/', '');
      contentApi.getSeries(slug)
        .then((series) => { if (!cancelled && series) setData({ series }); })
        .catch(() => {});
    } else if (page.startsWith('/newsletter/')) {
      const slug = page.replace('/newsletter/', '');
      contentApi.getNewsletterIssue(slug)
        .then((newsletterIssue) => { if (!cancelled && newsletterIssue) setData({ newsletterIssue }); })
        .catch(() => {});
    }

    return () => { cancelled = true; };
  }, [page]);

  const seo = useMemo(() => pageSeo(page, data), [page, data]);

  useEffect(() => {
    const isEn = typeof window !== 'undefined' && window.location.search.includes('lang=en');
    // Canonical always points to the clean URL — ?lang=en is a UI preference, not a content variant.
    // This prevents Google from indexing ?lang=en as a separate page.
    const canonical = seo.canonical.split('?')[0];

    document.documentElement.lang = isEn ? 'en' : 'fa';
    document.documentElement.dir = 'rtl';
    document.title = seo.title;
    setMeta('name', 'description', seo.description);
    setMeta('name', 'keywords', seo.keywords);
    setMeta('name', 'robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    setMeta('name', 'googlebot', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    setMeta('name', 'bingbot', 'index,follow,max-snippet:-1,max-image-preview:large');
setMeta('name', 'author', SITE_NAME);
    setMeta('name', 'language', 'fa-IR');
    setMeta('property', 'og:locale', 'fa_IR');
    setMeta('property', 'og:site_name', SITE_NAME);
    setMeta('property', 'og:type', seo.type);
    setMeta('property', 'og:title', seo.title);
    setMeta('property', 'og:description', seo.description);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:image', seo.image);
    setMeta('property', 'og:image:width', '1200');
    setMeta('property', 'og:image:height', '630');
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', seo.title);
    setMeta('name', 'twitter:description', seo.description);
    setMeta('name', 'twitter:image', seo.image);
    setLink('canonical', canonical);
    // Clean up old fa-IR hreflang if it exists from a previous session
    const oldFaIr = document.head.querySelector('link[rel="alternate"][hreflang="fa-IR"]');
    if (oldFaIr) oldFaIr.remove();
    // Single fa hreflang pointing to the canonical URL — no en variant since content is Persian
    setLink('alternate', canonical, { hreflang: 'fa' });
    setJsonLd(seo.jsonLd);
  }, [seo]);

  return null;
}
