(function () {
  'use strict';

  const API_URL = window.PORTFOLIO_API_URL || '';
  const FALLBACK_URL = '/assets/data/portfolio-data.json';
  const cache = new Map();
  let fallbackPromise;

  const aliases = {
    Publications: '07_Publications',
    Projects: '08_Projects',
    Project_Content: '09_Project_Content',
    Professional_Credentials: '10_Credentials'
  };

  function currentLanguage() {
    const value = localStorage.getItem('language') || 'en';
    return value === 'kr' ? 'ko' : value;
  }

  function truthy(value) {
    return value === true || /^(true|1|yes|y|o)$/i.test(String(value || ''));
  }

  function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = value == null ? '' : String(value);
    return element.innerHTML;
  }

  function localized(row, key, lang) {
    return row[`${key}_${lang}`] || row[`${key}_en`] || row[key] || '';
  }

  function normalizeRow(name, row) {
    const normalized = Object.assign({}, row);
    const publicationKeys = {
      Pub_ID: ['pub_id'], Year: ['year'], Title: ['title'], Venue_Name: ['venue_name'],
      Authors: ['authors'], Paper_Link: ['paper_link'], Venue_Link: ['venue_link'],
      Notes: ['notes', 'abstract_or_notes_en'], Code: ['code', 'code_link'],
      Poster_Link: ['poster_link'], Slides_link: ['slides_link'], Cite: ['cite', 'bibtex'],
      Status: ['status', 'publication_status'], Oral: ['oral'],
      Featured: ['featured', 'featured_on_home'], Display_Order: ['display_order'],
      Is_Visible: ['is_visible']
    };
    if (name === 'Publications') {
      Object.entries(publicationKeys).forEach(([target, sources]) => {
        if (normalized[target] !== undefined) return;
        const source = sources.find(key => row[key] !== undefined);
        if (source) normalized[target] = row[source];
      });
    }
    return normalized;
  }

  function apiLooksCurrent(name, rows) {
    if (name === 'Publications') {
      return rows.length >= 10 && rows.some(row => String(row.Authors || '').includes('Kyeonghun Kim'));
    }
    if (name === 'Projects') return rows.length >= 4;
    if (name === 'Professional_Credentials') return rows.length >= 10;
    return rows.length > 0;
  }

  async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {signal: controller.signal, cache: 'no-store'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function fallback() {
    if (!fallbackPromise) fallbackPromise = fetch(FALLBACK_URL).then(r => r.json());
    return fallbackPromise;
  }

  async function getSheet(name) {
    if (cache.has(name)) return cache.get(name);
    const promise = (async () => {
      if (API_URL) {
        try {
          const queryName = aliases[name] || name;
          const url = `${API_URL}?sheet=${encodeURIComponent(queryName)}&lang=all`;
          const payload = await fetchWithTimeout(url, 4500);
          const rows = (Array.isArray(payload) ? payload : payload.data || [])
            .map(row => normalizeRow(name, row));
          if (apiLooksCurrent(name, rows)) return rows;
        } catch (error) {
          console.warn(`Portfolio API fallback for ${name}:`, error.message);
        }
      }
      const payload = await fallback();
      return (payload.sheets[name] || []).map(row => normalizeRow(name, row));
    })();
    cache.set(name, promise);
    return promise;
  }

  function buildAuthorLinks(authors, people) {
    const byName = new Map(people.map(person => [String(person.Name_EN || person.Name_EN_FULL || '').trim(), person]));
    return String(authors || '').split(',').map(raw => {
      const marked = raw.trim();
      const name = marked.replace(/[\*†‡]+$/g, '').trim();
      const suffix = marked.slice(name.length);
      const person = byName.get(name) || {};
      const url = person.Primary_URL || person.Primary_URL_EN || person.Github ||
        `https://github.com/search?q=${encodeURIComponent(name)}&type=users`;
      const label = name === 'Kyeonghun Kim' ? `<strong>${escapeHtml(name)}</strong>` : escapeHtml(name);
      return `<a class="portfolio-author" href="${escapeHtml(url)}" target="_blank" rel="noopener">${label}</a>${escapeHtml(suffix)}`;
    }).join(', ');
  }

  function actionLink(url, label) {
    if (!url || url === '-') return '';
    return `<a class="portfolio-chip" href="${escapeHtml(url)}" target="_blank" rel="noopener">${label}</a>`;
  }

  function publicationCard(pub, people) {
    const oral = truthy(pub.Oral) || /oral/i.test(pub.Venue_Name || '');
    const titleLink = pub.Paper_Link && pub.Paper_Link !== '-'
      ? `<a href="${escapeHtml(pub.Paper_Link)}" target="_blank" rel="noopener">${escapeHtml(pub.Title)}</a>`
      : escapeHtml(pub.Title);
    const status = /under review/i.test(pub.Status || pub.Venue_Name || '') ? '<span class="portfolio-status">Under Review</span>' : '';
    return `<article class="portfolio-card publication-card">
      <h3>${titleLink}</h3>
      <p class="portfolio-authors">${buildAuthorLinks(pub.Authors, people)}</p>
      <p class="portfolio-meta">${escapeHtml(pub.Venue_Name)} · ${escapeHtml(pub.Year)} ${oral ? '<span class="portfolio-oral">Oral</span>' : ''} ${status}</p>
      <div class="portfolio-actions">
        ${actionLink(pub.Paper_Link, 'Paper')}
        ${actionLink(pub.Code, 'Code')}
        ${actionLink(pub.Poster_Link, 'Poster')}
        ${actionLink(pub.Slides_link, 'Slides')}
        ${actionLink(pub.Venue_Link, 'Venue')}
      </div>
    </article>`;
  }

  async function renderPublications(root, limit) {
    const [publications, people] = await Promise.all([getSheet('Publications'), getSheet('DB_People')]);
    const visible = publications.filter(row => row.Is_Visible === undefined || truthy(row.Is_Visible));
    visible.sort((a, b) => Number(b.Year || 0) - Number(a.Year || 0) || Number(a.Display_Order || 0) - Number(b.Display_Order || 0));
    const rows = limit ? visible.slice(0, limit) : visible;
    const input = root.querySelector('[data-publication-search]');
    const list = root.querySelector('[data-publication-list]') || root;
    function draw(query) {
      const term = String(query || '').trim().toLowerCase();
      const filtered = rows.filter(row => !term || [row.Title, row.Authors, row.Venue_Name, row.Year].join(' ').toLowerCase().includes(term));
      const years = [...new Set(filtered.map(row => row.Year))];
      list.innerHTML = years.map(year => `<section class="portfolio-year"><h2>${escapeHtml(year)}</h2>
        <div class="portfolio-grid">${filtered.filter(row => row.Year === year).map(row => publicationCard(row, people)).join('')}</div>
      </section>`).join('') || '<p class="portfolio-empty">No matching publications.</p>';
    }
    if (input) input.addEventListener('input', event => draw(event.target.value));
    draw('');
  }

  async function renderProjects(root) {
    const lang = currentLanguage();
    const projects = (await getSheet('Projects'))
      .filter(row => row.is_visible === undefined || truthy(row.is_visible))
      .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
    root.innerHTML = `<div class="portfolio-project-grid">${projects.map(project => {
      const title = localized(project, 'title', lang);
      const summary = localized(project, 'summary', lang);
      return `<article class="portfolio-project-card">
        <img src="${escapeHtml(project.cover_image_url)}" alt="${escapeHtml(title)}" loading="lazy">
        <div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(summary)}</p>
        <p class="portfolio-tags">${escapeHtml(project.tags)}</p>
        <div class="portfolio-actions">${actionLink(project.github_link, 'GitHub')}${actionLink(project.paper_or_demo_link, 'Paper / Demo')}</div></div>
      </article>`;
    }).join('')}</div>`;
  }

  async function renderCredentials(root) {
    const lang = currentLanguage();
    const rows = (await getSheet('Professional_Credentials'))
      .filter(row => row.is_visible === undefined || truthy(row.is_visible))
      .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
    root.innerHTML = `<div class="credential-grid">${rows.map(row => `<article class="credential-item">
      <strong>${escapeHtml(localized(row, 'name', lang))}</strong>
      <span>${escapeHtml(localized(row, 'level', lang))}</span>
      <small>${escapeHtml(localized(row, 'issuer', lang))} · ${escapeHtml(localized(row, 'date', lang))}</small>
    </article>`).join('')}</div>`;
  }

  async function openGlobalSearch() {
    const overlay = document.getElementById('portfolio-search-overlay');
    if (!overlay) return;
    overlay.hidden = false;
    document.body.classList.add('portfolio-search-open');
    const input = overlay.querySelector('input');
    input.focus();
    if (overlay.dataset.ready) return;
    const [publications, projects, credentials] = await Promise.all([
      getSheet('Publications'), getSheet('Projects'), getSheet('Professional_Credentials')
    ]);
    const records = [
      ...publications.map(row => ({type: 'Publication', title: row.Title, text: `${row.Authors} ${row.Venue_Name} ${row.Year}`, url: '/publication'})),
      ...projects.map(row => ({type: 'Project', title: row.title_en, text: `${row.summary_en} ${row.tags}`, url: '/project'})),
      ...credentials.map(row => ({type: 'Credential', title: row.name_en, text: `${row.level_en} ${row.issuer_en}`, url: '/CV#credentials'}))
    ];
    const results = overlay.querySelector('[data-global-search-results]');
    function draw(value) {
      const words = String(value || '').toLowerCase().split(/\s+/).filter(Boolean);
      const found = records.filter(item => words.every(word => `${item.title} ${item.text}`.toLowerCase().includes(word))).slice(0, 30);
      results.innerHTML = found.map(item => `<a href="${item.url}"><small>${item.type}</small><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.text)}</span></a>`).join('') ||
        (words.length ? '<p>No results.</p>' : '<p>Search publications, projects, authors, venues, and credentials.</p>');
    }
    input.addEventListener('input', event => draw(event.target.value));
    draw('');
    overlay.dataset.ready = 'true';
  }

  function closeGlobalSearch() {
    const overlay = document.getElementById('portfolio-search-overlay');
    if (overlay) overlay.hidden = true;
    document.body.classList.remove('portfolio-search-open');
  }

  function initialize() {
    document.querySelectorAll('[data-portfolio-publications]').forEach(root => renderPublications(root, Number(root.dataset.limit || 0)));
    document.querySelectorAll('[data-portfolio-projects]').forEach(renderProjects);
    document.querySelectorAll('[data-portfolio-credentials]').forEach(renderCredentials);
    document.querySelectorAll('[data-open-portfolio-search]').forEach(button => button.addEventListener('click', openGlobalSearch));
    document.querySelectorAll('[data-close-portfolio-search]').forEach(button => button.addEventListener('click', closeGlobalSearch));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeGlobalSearch();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openGlobalSearch();
      }
    });
    document.addEventListener('portfolio:languagechange', () => {
      document.querySelectorAll('[data-portfolio-projects]').forEach(renderProjects);
      document.querySelectorAll('[data-portfolio-credentials]').forEach(renderCredentials);
    });
  }

  window.PortfolioData = {getSheet, currentLanguage};
  document.addEventListener('DOMContentLoaded', initialize);
})();
