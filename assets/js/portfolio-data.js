(function () {
  'use strict';

  const API_URL = window.PORTFOLIO_API_URL || '';
  const FALLBACK_URL = '/assets/data/portfolio-data.json';
  const CV_FALLBACK_URL = '/assets/data/cv-content.json';
  const IMSI_PEOPLE_URL =
    'https://docs.google.com/spreadsheets/d/1nr8EWtSU3Y50oK7oeKvwIZ1tHBUMmOhiSjtFYYufSYI/gviz/tq';
  const cache = new Map();
  const remoteLoads = new Map();
  let fallbackPromise;
  let cvFallbackPromise;

  const aliases = {
    Publications: '07_Publications',
    Projects: '08_Projects',
    Project_Content: '09_Project_Content',
    Professional_Credentials: '10_Credentials',
    CV_Content: '06_CV_Content'
  };

  const expectedApiSheets = {
    Publications: 'WEB_Publications',
    Projects: 'Projects',
    Project_Content: 'Project_Content',
    Professional_Credentials: 'Professional_Credentials',
    CV_Content: 'CV_Content'
  };

  const requestedAuthorUrls = new Map(Object.entries({
    'Eunseob Choi': 'https://eunseob.kr/',
    'Youngung Han': 'https://github.com/youngunghan',
    'Hyuk-Jae Lee': 'http://capp.snu.ac.kr/?p=people#Prof',
    'Jaehyeok Bae': 'https://jaehyeokbae.me/',
    'Nam-Joon Kim': 'https://imsilab.github.io/imsi/authors/investigators/nam-joon-kim/',
    'Seoyoung Ju': 'https://standyoung.github.io/',
    'Anna Jung': 'https://imsilab.github.io/imsi/authors/undergraduate_interns/anna-jung/',
    'Pa Hong': 'https://smc.skku.edu/doctor/main/main.do?mId=1&medDrSeq=274',
    'Won Jae Lee': 'https://smc.skku.edu/doctor/main/main.do?mId=1&medDrSeq=286',
    'Sumin Lee': 'https://suminxlee.com/',
    'Hyunsu Go': 'https://gohyunsu.github.io/'
  }).map(([name, url]) => [name.toLowerCase(), url]));

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
      Authors: ['authors'], Spacer: ['spacer'], Project_Link: ['project_link'],
      GDrive_Link: ['gdrive_link'], arXiv_Link: ['arxiv_link'],
      Paper_Link: ['paper_link'], Venue_Link: ['venue_link'],
      Notes: ['notes', 'abstract_or_notes_en'], Code: ['code', 'code_link'],
      Model: ['model', 'model_link'], Poster_Link: ['poster_link'],
      Slides_link: ['slides_link'], Cite: ['cite', 'bibtex'], Remarks: ['remarks'],
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

  async function fetchTextWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  function parseGoogleVisualization(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < start) throw new Error('Invalid Google Sheets response');
    const payload = JSON.parse(text.slice(start, end + 1));
    if (payload.status && payload.status !== 'ok') {
      throw new Error('Google Sheets query failed');
    }
    const table = payload.table || {};
    const headers = (table.cols || []).map((column, index) =>
      String(column.label || `Column_${index}`).trim()
    );
    return (table.rows || []).map(row => {
      const result = {};
      const cells = row.c || [];
      headers.forEach((header, index) => {
        const cell = cells[index];
        const value = cell && cell.v != null ? cell.v : '';
        result[header] = value;
        result[`Column_${index}`] = value;
      });
      return result;
    });
  }

  async function fallback() {
    if (!fallbackPromise) {
      fallbackPromise = fetch(FALLBACK_URL, {cache: 'force-cache'}).then(response => {
        if (!response.ok) throw new Error(`Fallback HTTP ${response.status}`);
        return response.json();
      });
    }
    return fallbackPromise;
  }

  async function cvFallback() {
    if (!cvFallbackPromise) {
      cvFallbackPromise = fetch(CV_FALLBACK_URL, {cache: 'force-cache'}).then(response => {
        if (!response.ok) throw new Error(`CV fallback HTTP ${response.status}`);
        return response.json();
      });
    }
    return cvFallbackPromise;
  }

  function loadRemote(name) {
    if (remoteLoads.has(name)) return remoteLoads.get(name);

    if (name === 'DB_People') {
      const peoplePromise = (async () => {
        try {
          const query = new URLSearchParams({
            tqx: `out:json;reqId:${Date.now()}`,
            sheet: 'DB_People',
            headers: '1'
          });
          const text = await fetchTextWithTimeout(`${IMSI_PEOPLE_URL}?${query}`, 5000);
          const rows = parseGoogleVisualization(text);
          cache.set(name, rows);
          document.dispatchEvent(new CustomEvent('portfolio:dataupdated', {
            detail: {sheet: name}
          }));
          return rows;
        } catch (error) {
          console.warn('IMSI DB_People live update unavailable:', error.message);
          return null;
        }
      })();
      remoteLoads.set(name, peoplePromise);
      return peoplePromise;
    }

    if (!API_URL) return;
    const promise = (async () => {
      try {
        const queryName = aliases[name] || name;
        const separator = API_URL.includes('?') ? '&' : '?';
        const url = `${API_URL}${separator}sheet=${encodeURIComponent(queryName)}&lang=all&_=${Date.now()}`;
        const payload = await fetchWithTimeout(url, 5000);
        if (!payload || payload.ok === false) {
          throw new Error(payload && payload.error ? payload.error : 'Invalid API response');
        }
        const expectedSheet = expectedApiSheets[name];
        if (expectedSheet && payload.sheet && payload.sheet !== expectedSheet) {
          throw new Error(
            `Outdated Apps Script deployment: expected ${expectedSheet}, received ${payload.sheet}`
          );
        }
        const source = Array.isArray(payload) ? payload : payload.data;
        if (!Array.isArray(source)) throw new Error('API data is not an array');
        const rows = source.map(row => normalizeRow(name, row));
        cache.set(name, rows);
        document.dispatchEvent(new CustomEvent('portfolio:dataupdated', {
          detail: {sheet: name}
        }));
        return rows;
      } catch (error) {
        console.warn(`Portfolio live update unavailable for ${name}:`, error.message);
        return null;
      }
    })();
    remoteLoads.set(name, promise);
    return promise;
  }

  async function getSheet(name) {
    if (cache.has(name)) return cache.get(name);
    const localPromise = (async () => {
      const source = name === 'CV_Content'
        ? await cvFallback()
        : (await fallback()).sheets[name] || [];
      const rows = source.map(row => normalizeRow(name, row));
      if (!cache.has(name)) cache.set(name, rows);
      return cache.get(name);
    })();
    loadRemote(name);
    return localPromise;
  }

  function buildAuthorLinks(authors, people) {
    const displayName = value => String(value || '')
      .replace(/[\*\u2020\u2021]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const normalizedName = value => displayName(value).toLowerCase();
    const byName = new Map();
    people.forEach(person => {
      const key = normalizedName(person.Name_EN_FULL || person.Name_EN);
      if (!key) return;
      const existing = byName.get(key);
      if (!existing || (!existing.Homepage && person.Homepage)) byName.set(key, person);
    });
    return String(authors || '').split(',').map(raw => {
      const marked = raw.trim();
      const name = displayName(marked);
      const suffix = (marked.match(/[\*\u2020\u2021]/g) || []).join('');
      const key = normalizedName(name);
      const person = byName.get(key) || {};
      const url = String(
        person.Homepage || person.Column_24 || requestedAuthorUrls.get(key) || ''
      ).trim();
      const label = name === 'Kyeonghun Kim' ? `<strong>${escapeHtml(name)}</strong>` : escapeHtml(name);
      const linkedLabel = /^https?:\/\//i.test(url)
        ? `<a class="portfolio-author" href="${escapeHtml(url)}" target="_blank" rel="noopener">${label}</a>`
        : label;
      return `${linkedLabel}${escapeHtml(suffix)}`;
    }).join(', ');
  }

  function actionLink(url, label) {
    if (!/^https?:\/\//i.test(String(url || '').trim())) return '';
    return `<a class="portfolio-chip" href="${escapeHtml(url)}" target="_blank" rel="noopener">${label}</a>`;
  }

  function publicationActions(pub) {
    const citeLabel = 'Cite';
    return [
      actionLink(pub.Project_Link, 'Project'),
      actionLink(pub.GDrive_Link, 'GDrive'),
      actionLink(pub.arXiv_Link, 'arXiv'),
      actionLink(pub.Paper_Link, 'Paper'),
      actionLink(pub.Venue_Link, 'Venue'),
      actionLink(pub.Code, 'Code'),
      actionLink(pub.Model, 'Model'),
      actionLink(pub.Poster_Link, 'Poster'),
      actionLink(pub.Slides_link, 'Slides'),
      pub.Cite && pub.Cite !== '-'
        ? `<button class="portfolio-chip portfolio-cite" type="button" data-cite="${escapeHtml(pub.Cite)}">${citeLabel}</button>`
        : ''
    ].join('');
  }

  function publicationCard(pub, people) {
    const oral = /oral/i.test(`${pub.Venue_Name || ''} ${pub.Notes || ''}`);
    const statusText = `${pub.Venue_Name || ''} ${pub.Notes || ''} ${pub.Remarks || ''}`;
    const status = /under review/i.test(statusText) ? '<span class="portfolio-status">Under Review</span>' : '';
    return `<article class="portfolio-card publication-card">
      <h3>${escapeHtml(pub.Title)}</h3>
      <p class="portfolio-authors">${buildAuthorLinks(pub.Authors, people)}</p>
      <p class="portfolio-meta">${escapeHtml(pub.Venue_Name)} · ${escapeHtml(pub.Year)} ${oral ? '<span class="portfolio-oral">Oral</span>' : ''} ${status}</p>
      <div class="portfolio-actions">
        ${publicationActions(pub)}
      </div>
    </article>`;
  }

  async function renderPublications(root, limit) {
    const [publications, people] = await Promise.all([getSheet('Publications'), getSheet('DB_People')]);
    const visible = publications.filter(row => String(row.Authors || '').split(',').some(author =>
      author.replace(/[\*\u2020\u2021]/g, '').trim().toLowerCase() === 'kyeonghun kim'
    ));
    visible.sort((a, b) => Number(b.Year || 0) - Number(a.Year || 0) ||
      Number((String(b.Pub_ID || '').match(/\d+/g) || [0]).pop()) - Number((String(a.Pub_ID || '').match(/\d+/g) || [0]).pop()));
    const rows = limit ? visible.slice(0, limit) : visible;
    const input = root.querySelector('[data-publication-search]');
    const count = root.querySelector('[data-publication-count]');
    const list = root.querySelector('[data-publication-list]') || root;
    function draw(query) {
      const term = String(query || '').trim().toLowerCase();
      const filtered = rows.filter(row => !term || [row.Title, row.Authors, row.Venue_Name, row.Year, row.Notes, row.Remarks].join(' ').toLowerCase().includes(term));
      if (count) count.textContent = term ? `${filtered.length} results` : `${filtered.length} publications`;
      const years = [...new Set(filtered.map(row => row.Year))];
      list.innerHTML = years.map(year => `<section class="portfolio-year"><h2>${escapeHtml(year)}</h2>
        <div class="portfolio-grid">${filtered.filter(row => row.Year === year).map(row => publicationCard(row, people)).join('')}</div>
      </section>`).join('') || '<p class="portfolio-empty">No matching publications.</p>';
    }
    if (input) input.oninput = event => draw(event.target.value);
    root.addEventListener('click', async event => {
      const button = event.target.closest('[data-cite]');
      if (!button || !root.contains(button)) return;
      const citation = button.dataset.cite || '';
      try {
        await navigator.clipboard.writeText(citation);
        const original = button.textContent;
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = original; }, 1200);
      } catch (error) {
        window.prompt('Copy citation', citation);
      }
    });
    draw(input ? input.value : '');
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
    root.innerHTML = `<div class="credential-grid">${rows.map(row => {
      const number = String(row.credential_number || '').trim();
      const verificationId = String(row.verification_id || '').trim();
      const identifiers = [number, verificationId].filter((value, index, values) =>
        value && values.indexOf(value) === index
      );
      const idLabel = lang === 'ko' ? '자격증 번호' : 'Credential No.';
      return `<article class="credential-item">
      <strong>${escapeHtml(localized(row, 'name', lang))}</strong>
      <span>${escapeHtml(localized(row, 'level', lang))}</span>
      <small>${escapeHtml(localized(row, 'issuer', lang))} · ${escapeHtml(localized(row, 'date', lang))}</small>
      ${identifiers.length ? `<small><strong>${idLabel}</strong> ${identifiers.map(escapeHtml).join(' · ')}</small>` : ''}
    </article>`;
    }).join('')}</div>`;
  }

  function safeLink(url) {
    const value = String(url || '').trim();
    return /^(https?:\/\/|mailto:)/i.test(value) ? value : '';
  }

  function cvDescription(row, lang) {
    const items = String(localized(row, 'description', lang) || '')
      .split(/\r?\n/)
      .map(item => item.trim())
      .filter(Boolean);
    return items.length
      ? `<ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : '';
  }

  function cvEntry(row, lang) {
    const type = String(row.entry_type || 'entry').toLowerCase();
    const title = localized(row, 'title', lang);
    const subtitle = localized(row, 'subtitle', lang);
    const period = localized(row, 'period', lang);
    const url = safeLink(row.link_url);
    if (type === 'skill') {
      return `<p class="cv-skill"><strong>${escapeHtml(title)}</strong>: ${escapeHtml(subtitle)}</p>`;
    }
    if (type === 'link') {
      const external = /^https?:\/\//i.test(url);
      return `<a class="cv-contact-link" href="${escapeHtml(url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>
        <span aria-hidden="true">${escapeHtml(row.icon || '🔗')}</span>${escapeHtml(title)}</a>`;
    }
    if (type === 'note') {
      return `<p class="cv-note">${escapeHtml(localized(row, 'description', lang))}</p>`;
    }
    const linkedTitle = url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>`
      : escapeHtml(title);
    return `<article class="cv-entry">
      <h3>${linkedTitle}${period ? `<span>${escapeHtml(period)}</span>` : ''}</h3>
      ${subtitle ? `<h4>${escapeHtml(subtitle)}</h4>` : ''}
      ${cvDescription(row, lang)}
    </article>`;
  }

  async function renderCV(root) {
    const lang = currentLanguage();
    const rows = (await getSheet('CV_Content'))
      .filter(row => row.is_visible === undefined || truthy(row.is_visible))
      .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
    const sections = [];
    const byId = new Map();
    rows.forEach(row => {
      const id = String(row.section_id || 'other');
      if (!byId.has(id)) {
        const section = {
          id: id.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
          title: localized(row, 'section_title', lang),
          rows: []
        };
        byId.set(id, section);
        sections.push(section);
      }
      byId.get(id).rows.push(row);
    });
    root.innerHTML = sections.map((section, index) => {
      const credentials = section.rows.some(row => row.entry_type === 'credentials');
      const contacts = section.rows.every(row => row.entry_type === 'link');
      const content = credentials
        ? '<div data-cv-credentials><p>Loading credentials…</p></div>'
        : section.rows.map(row => cvEntry(row, lang)).join('');
      return `${index ? '<br>' : ''}<section class="cv-section" id="${escapeHtml(section.id)}">
        <h1>${escapeHtml(section.title)}</h1>
        <div${contacts ? ' class="cv-contact-grid"' : ''}>${content}</div>
      </section>`;
    }).join('');
    const credentialRoot = root.querySelector('[data-cv-credentials]');
    if (credentialRoot) await renderCredentials(credentialRoot);
    document.querySelectorAll('[data-cv-download]').forEach(link => {
      link.textContent = lang === 'ko' ? '📄 CV 폴더 열기 (PDF)' : '📄 Download CV (PDF)';
    });
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
    document.querySelectorAll('[data-portfolio-cv]').forEach(renderCV);
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
      document.querySelectorAll('[data-portfolio-cv]').forEach(renderCV);
    });
    document.addEventListener('portfolio:dataupdated', event => {
      const sheet = event.detail && event.detail.sheet;
      if (sheet === 'Publications' || sheet === 'DB_People') {
        document.querySelectorAll('[data-portfolio-publications]').forEach(root =>
          renderPublications(root, Number(root.dataset.limit || 0))
        );
      }
      if (sheet === 'Projects') {
        document.querySelectorAll('[data-portfolio-projects]').forEach(renderProjects);
      }
      if (sheet === 'Professional_Credentials') {
        document.querySelectorAll('[data-portfolio-credentials]').forEach(renderCredentials);
        document.querySelectorAll('[data-portfolio-cv]').forEach(renderCV);
      }
      if (sheet === 'CV_Content') {
        document.querySelectorAll('[data-portfolio-cv]').forEach(renderCV);
      }
    });
  }

  window.PortfolioData = {getSheet, currentLanguage};
  document.addEventListener('DOMContentLoaded', initialize);
})();
