(function () {
  'use strict';

  const API_URL = window.PORTFOLIO_API_URL || '';
  const FALLBACK_URL = '/assets/data/portfolio-data.json';
  const CV_FALLBACK_URL = '/assets/data/cv-content.json';
  const PROJECT_SHOWCASE_URL = '/assets/data/project-showcase.json';
  const IMSI_PEOPLE_URL =
    'https://docs.google.com/spreadsheets/d/1nr8EWtSU3Y50oK7oeKvwIZ1tHBUMmOhiSjtFYYufSYI/gviz/tq';
  const cache = new Map();
  const remoteLoads = new Map();
  const remoteStates = new Map();
  const cacheSources = new Map();
  const syncStatusByRoot = new WeakMap();
  const REMOTE_TIMEOUT_MS = 30000;
  const REMOTE_ATTEMPTS = 2;
  const SESSION_CACHE_PREFIX = 'portfolio-sheet-v5:';
  const PREFETCH_SHEETS = window.PORTFOLIO_PREFETCH_SHEETS || [
    'CV_Content', 'Professional_Credentials', 'Publications',
    'Projects', 'Project_Content', 'Learning_Videos', 'DB_People'
  ];
  let fallbackPromise;
  let cvFallbackPromise;
  let projectShowcasePromise;

  const PROJECT_CATEGORIES = [
    'All', 'Medical AI', 'Computer Vision', 'GenAI', 'LLM & NLP',
    'Document AI', 'ML & DL', 'Software', 'Research'
  ];

  const PUBLICATION_HEADERS = [
    'Pub_ID', 'Year', 'Title', 'Venue_Name', 'Authors', 'Spacer',
    'Project_Link', 'GDrive_Link', 'arXiv_Link', 'Paper_Link', 'Venue_Link',
    'Code', 'Model', 'Poster_Link', 'Slides_link', 'Cite',
    'In Google Scholar', 'Cited at Least Once', 'Notes', 'Remarks'
  ];

  const aliases = {
    Publications: '07_Publications',
    Projects: '08_Projects',
    Project_Content: '09_Project_Content',
    Professional_Credentials: '10_Credentials',
    CV_Content: '06_CV_Content',
    Learning_Videos: 'Learning_Videos'
  };

  const expectedApiSheets = {
    Publications: 'WEB_Publications',
    Projects: 'Projects',
    Project_Content: 'Project_Content',
    Professional_Credentials: 'Professional_Credentials',
    CV_Content: 'CV_Content',
    Learning_Videos: 'Learning_Videos'
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
    'Hyunsu Go': 'https://gohyunsu.github.io/',
    'Sieun Hyeon': 'https://hyeonsieun.github.io/'
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

  function compareProjects(a, b, lang) {
    return String(b.sort_date || '').localeCompare(String(a.sort_date || '')) ||
      Number(a.display_order || 0) - Number(b.display_order || 0) ||
      localized(a, 'title', lang).localeCompare(localized(b, 'title', lang));
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

  function validateRemoteRows(name, rows) {
    if (name !== 'Publications') return;
    const first = rows[0] || {};
    const missing = PUBLICATION_HEADERS.filter(header => !Object.prototype.hasOwnProperty.call(first, header));
    const hasRealRow = rows.some(row => String(row.Title || '').trim() && String(row.Authors || '').trim());
    if (missing.length || !hasRealRow) {
      throw new Error(`Invalid WEB_Publications schema${missing.length ? `; missing ${missing.join(', ')}` : ''}`);
    }
  }

  function readSessionSheet(name) {
    try {
      const stored = JSON.parse(sessionStorage.getItem(`${SESSION_CACHE_PREFIX}${name}`));
      if (!stored || !Array.isArray(stored.rows)) return null;
      const rows = stored.rows.map(row => normalizeRow(name, row));
      if (name === 'Publications') validateRemoteRows(name, rows);
      return rows;
    } catch (error) {
      sessionStorage.removeItem(`${SESSION_CACHE_PREFIX}${name}`);
      return null;
    }
  }

  function writeSessionSheet(name, rows) {
    try {
      sessionStorage.setItem(`${SESSION_CACHE_PREFIX}${name}`, JSON.stringify({
        savedAt: new Date().toISOString(),
        rows
      }));
    } catch (error) {
      console.warn(`Session cache unavailable for ${name}:`, error.message);
    }
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

  async function projectShowcase() {
    if (!projectShowcasePromise) {
      projectShowcasePromise = fetch(PROJECT_SHOWCASE_URL, {cache: 'force-cache'}).then(response => {
        if (!response.ok) throw new Error(`Project showcase HTTP ${response.status}`);
        return response.json();
      });
    }
    return projectShowcasePromise;
  }

  function projectRowKey(name, row) {
    return name === 'Projects' ? row.project_id : row.content_id;
  }

  function nonEmptyMerge(base, update) {
    const result = Object.assign({}, base);
    Object.entries(update || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') result[key] = value;
    });
    return result;
  }

  function mergeProjectRows(name, baseRows, updateRows) {
    if (!['Projects', 'Project_Content'].includes(name)) return updateRows;
    const merged = new Map((baseRows || []).map(row => [projectRowKey(name, row), Object.assign({}, row)]));
    (updateRows || []).forEach(row => {
      const key = projectRowKey(name, row);
      if (key) merged.set(key, nonEmptyMerge(merged.get(key) || {}, row));
    });
    return [...merged.values()];
  }

  function mergeCvRows(baseRows, updateRows) {
    const merged = new Map((baseRows || []).map(row => [row.content_id, Object.assign({}, row)]));
    (updateRows || []).forEach(row => {
      if (row.content_id) merged.set(row.content_id, nonEmptyMerge(merged.get(row.content_id) || {}, row));
    });
    return [...merged.values()];
  }

  async function addCuratedCvRows(name, rows) {
    if (name !== 'CV_Content') return rows;
    const curated = (await cvFallback()).map(row => normalizeRow(name, row));
    const curatedById = new Map(curated.map(row => [row.content_id, row]));
    const canonicalResearch = new Set([
      'CV_RES_001', 'CV_RES_002', 'CV_RES_003', 'CV_RES_004', 'CV_HIL_001'
    ]);
    return mergeCvRows(curated, rows).map(row => {
      if (canonicalResearch.has(row.content_id)) {
        return nonEmptyMerge(row, curatedById.get(row.content_id));
      }
      if (row.content_id === 'CV_LEC_008') {
        return Object.assign({}, row, {image_url: '', image_alt_en: '', image_alt_ko: ''});
      }
      return row;
    });
  }

  async function addCuratedProjects(name, rows) {
    if (!['Projects', 'Project_Content'].includes(name)) return rows;
    const showcase = await projectShowcase();
    const curated = name === 'Projects' ? showcase.projects : showcase.content;
    return mergeProjectRows(name, rows, curated);
  }

  function syncSheetsForRoot(root) {
    if (root.matches('[data-portfolio-publications]')) return ['Publications'];
    if (root.matches('[data-portfolio-projects]')) return ['Projects'];
    if (root.matches('[data-portfolio-project-detail]')) return ['Projects', 'Project_Content'];
    if (root.matches('[data-portfolio-credentials]')) return ['Professional_Credentials'];
    if (root.matches('[data-portfolio-cv]')) return ['CV_Content', 'Professional_Credentials'];
    if (root.matches('[data-learning-videos]')) return ['Learning_Videos'];
    return [];
  }

  function syncRoots() {
    return document.querySelectorAll([
      '[data-portfolio-publications]',
      '[data-portfolio-projects]',
      '[data-portfolio-project-detail]',
      '[data-portfolio-credentials]',
      '[data-portfolio-cv]',
      '[data-learning-videos]'
    ].join(','));
  }

  function ensureSyncStatus(root) {
    if (syncStatusByRoot.has(root)) return syncStatusByRoot.get(root);
    const status = document.createElement('div');
    status.className = 'portfolio-sync-status is-hidden';
    status.dataset.portfolioSyncStatus = '';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    root.parentNode.insertBefore(status, root);
    syncStatusByRoot.set(root, status);
    return status;
  }

  function refreshSyncStatuses() {
    const lang = currentLanguage();
    syncRoots().forEach(root => {
      const sheets = syncSheetsForRoot(root);
      const entries = sheets.map(sheet => ({sheet, state: remoteStates.get(sheet)}))
        .filter(entry => entry.state);
      const errors = entries.filter(entry => entry.state === 'error');
      const existing = syncStatusByRoot.get(root);
      if (!errors.length) {
        if (existing) existing.classList.add('is-hidden');
        return;
      }
      const status = ensureSyncStatus(root);
      status.dataset.state = 'error';
      status.classList.remove('is-hidden');
      status.innerHTML = `<span class="portfolio-sync-dot" aria-hidden="true"></span>
        <span>${lang === 'ko' ? '저장된 버전을 표시하고 있습니다.' : 'Showing the saved version.'}</span>
        <button type="button" data-portfolio-sync-retry="${errors.map(entry => escapeHtml(entry.sheet)).join(',')}">
          ${lang === 'ko' ? '다시 시도' : 'Retry'}
        </button>`;
    });
  }

  function setRemoteState(name, state) {
    remoteStates.set(name, state);
    refreshSyncStatuses();
  }

  function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  async function fetchRemotePayload(url) {
    let lastError;
    for (let attempt = 1; attempt <= REMOTE_ATTEMPTS; attempt += 1) {
      try {
        return await fetchWithTimeout(url, REMOTE_TIMEOUT_MS);
      } catch (error) {
        lastError = error;
        if (attempt < REMOTE_ATTEMPTS) await wait(650 * attempt);
      }
    }
    throw lastError;
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
          cacheSources.set(name, 'remote');
          writeSessionSheet(name, rows);
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
      peoplePromise.then(() => {
        if (remoteLoads.get(name) === peoplePromise) remoteLoads.delete(name);
      });
      return peoplePromise;
    }

    if (!API_URL) return;
    setRemoteState(name, 'loading');
    const promise = (async () => {
      try {
        const queryName = aliases[name] || name;
        const separator = API_URL.includes('?') ? '&' : '?';
        const url = `${API_URL}${separator}sheet=${encodeURIComponent(queryName)}&lang=all`;
        const payload = await fetchRemotePayload(url);
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
        let rows = source.map(row => normalizeRow(name, row));
        if (['Projects', 'Project_Content'].includes(name)) {
          rows = mergeProjectRows(name, cache.get(name) || [], rows);
        }
        rows = await addCuratedCvRows(name, rows);
        validateRemoteRows(name, rows);
        cache.set(name, rows);
        cacheSources.set(name, 'remote');
        writeSessionSheet(name, rows);
        setRemoteState(name, 'success');
        document.dispatchEvent(new CustomEvent('portfolio:dataupdated', {
          detail: {sheet: name}
        }));
        return rows;
      } catch (error) {
        setRemoteState(name, 'error');
        console.warn(`Portfolio live update unavailable for ${name}:`, error.message);
        return null;
      }
    })();
    remoteLoads.set(name, promise);
    promise.then(() => {
      if (remoteLoads.get(name) === promise) remoteLoads.delete(name);
    });
    return promise;
  }

  function retryRemote(name) {
    remoteLoads.delete(name);
    return loadRemote(name);
  }

  async function getSheet(name) {
    if (cache.has(name)) return cache.get(name);
    const saved = readSessionSheet(name);
    if (saved) {
      const rows = await addCuratedCvRows(name, saved);
      cache.set(name, rows);
      cacheSources.set(name, 'session');
      return rows;
    }
    const source = name === 'CV_Content'
      ? await cvFallback()
      : (await fallback()).sheets[name] || [];
    let rows = source.map(row => normalizeRow(name, row));
    rows = await addCuratedProjects(name, rows);
    rows = await addCuratedCvRows(name, rows);
    if (!cache.has(name)) {
      cache.set(name, rows);
      cacheSources.set(name, 'fallback');
    }
    return cache.get(name);
  }

  function navigationIsReload() {
    const entries = typeof performance.getEntriesByType === 'function'
      ? performance.getEntriesByType('navigation') : [];
    return Boolean(entries[0] && entries[0].type === 'reload');
  }

  async function startBackgroundSync() {
    const force = navigationIsReload();
    await Promise.all(PREFETCH_SHEETS.map(name => getSheet(name)));
    PREFETCH_SHEETS.forEach(name => {
      if (force || cacheSources.get(name) !== 'session') loadRemote(name);
    });
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
      if (count) {
        const noun = term ? (filtered.length === 1 ? 'result' : 'results') :
          (filtered.length === 1 ? 'publication' : 'publications');
        count.textContent = `${filtered.length} ${noun}`;
      }
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
      .sort((a, b) => compareProjects(a, b, lang));
    const categoryCounts = new Map(PROJECT_CATEGORIES.map(category => [category,
      category === 'All' ? projects.length : projects.filter(project =>
        String(project.categories || '').split(';').map(item => item.trim()).includes(category)
      ).length
    ]));
    root.innerHTML = `<div class="project-filter-bar" role="group" aria-label="Project categories">
      ${PROJECT_CATEGORIES.map((category, index) => `<button type="button" class="project-filter" data-project-category="${escapeHtml(category)}" aria-pressed="${index === 0 ? 'true' : 'false'}">${escapeHtml(category)} <span>${categoryCounts.get(category)}</span></button>`).join('')}
    </div><p class="project-filter-count" data-project-filter-count aria-live="polite"></p>
    <div class="portfolio-project-grid">${projects.map(project => {
      const title = localized(project, 'title', lang);
      const summary = localized(project, 'summary', lang);
      const categories = String(project.categories || '').split(';').map(item => item.trim()).filter(Boolean);
      const period = localized(project, 'period', lang);
      const organization = localized(project, 'organization', lang);
      const detailUrl = `/projects/detail/?project=${encodeURIComponent(project.slug || project.project_id)}`;
      return `<article class="portfolio-project-card" data-project-categories="${escapeHtml(categories.join('|'))}" data-project-sort-date="${escapeHtml(project.sort_date || '')}">
        <a class="project-card-visual" href="${detailUrl}" aria-label="${escapeHtml(title)} — ${lang === 'ko' ? '자세히 보기' : 'View details'}"><img src="${escapeHtml(project.cover_image_url)}" alt="${escapeHtml(title)}" loading="lazy"></a>
        <div><p class="project-card-date">${escapeHtml(period || String(project.sort_date || '').slice(0, 4))}</p><h2><a href="${detailUrl}">${escapeHtml(title)}</a></h2><p>${escapeHtml(summary)}</p>
        ${organization ? `<p class="project-card-organization">${escapeHtml(organization)}</p>` : ''}
        <p class="portfolio-tags">${escapeHtml(project.tags)}</p>
        <div class="project-category-chips">${categories.map(category => `<span>${escapeHtml(category)}</span>`).join('')}</div>
        <div class="portfolio-actions"><a class="portfolio-chip" href="${detailUrl}">${lang === 'ko' ? '자세히 보기' : 'View Details'}</a>${actionLink(project.github_link, 'GitHub')}${actionLink(project.paper_or_demo_link, 'Paper / Demo')}</div></div>
      </article>`;
    }).join('')}</div>`;
    const count = root.querySelector('[data-project-filter-count]');
    const drawCategory = category => {
      let visible = 0;
      root.querySelectorAll('.portfolio-project-card').forEach(card => {
        const categories = String(card.dataset.projectCategories || '').split('|');
        const show = category === 'All' || categories.includes(category);
        card.hidden = !show;
        if (show) visible += 1;
      });
      root.querySelectorAll('.project-filter').forEach(button =>
        button.setAttribute('aria-pressed', button.dataset.projectCategory === category ? 'true' : 'false')
      );
      if (count) count.textContent = lang === 'ko'
        ? `프로젝트 ${visible}개`
        : `${visible} ${visible === 1 ? 'project' : 'projects'}`;
    };
    root.querySelector('.project-filter-bar').addEventListener('click', event => {
      const button = event.target.closest('.project-filter');
      if (button) drawCategory(button.dataset.projectCategory);
    });
    drawCategory('All');
  }

  function detailParagraph(value) {
    return String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean)
      .map(line => `<p>${escapeHtml(line)}</p>`).join('');
  }

  async function renderProjectDetail(root) {
    const lang = currentLanguage();
    const requested = new URLSearchParams(window.location.search).get('project') || root.dataset.projectId || '';
    const [projects, content] = await Promise.all([getSheet('Projects'), getSheet('Project_Content')]);
    const project = projects.find(row => String(row.slug) === requested || String(row.project_id) === requested);
    if (!project) {
      root.innerHTML = `<p class="portfolio-empty">${lang === 'ko' ? '프로젝트를 찾을 수 없습니다.' : 'Project not found.'}</p>`;
      return;
    }
    const title = localized(project, 'title', lang);
    const summary = localized(project, 'summary', lang);
    const period = localized(project, 'period', lang);
    const organization = localized(project, 'organization', lang);
    const role = localized(project, 'role', lang);
    const contribution = localized(project, 'contribution', lang);
    const metrics = Array.isArray(project.scope_metrics) ? project.scope_metrics : [];
    const categories = String(project.categories || '').split(';').map(item => item.trim()).filter(Boolean);
    const blocks = content.filter(row => row.project_id === project.project_id &&
      (row.is_visible === undefined || truthy(row.is_visible)))
      .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
    root.innerHTML = `<a class="project-detail-back" href="/projects/">← ${lang === 'ko' ? '모든 프로젝트' : 'All Projects'}</a>
      <header class="project-detail-hero">
        <div><p class="project-detail-eyebrow">${escapeHtml(organization)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(summary)}</p>
        ${period ? `<p class="project-detail-period">${escapeHtml(period)}</p>` : ''}
        <div class="project-category-chips">${categories.map(category => `<span>${escapeHtml(category)}</span>`).join('')}</div>
        <div class="portfolio-actions">${actionLink(project.github_link, 'GitHub')}${actionLink(project.paper_or_demo_link, 'Paper / Demo')}</div></div>
        <img src="${escapeHtml(project.cover_image_url)}" alt="${escapeHtml(title)}">
      </header>
      ${metrics.length ? `<section class="project-scope-metrics" aria-label="${lang === 'ko' ? '프로젝트 범위 요약' : 'Project scope at a glance'}">
        ${metrics.map(metric => `<div class="project-scope-metric"><strong>${escapeHtml(metric.value)}</strong><span>${escapeHtml(lang === 'ko' ? metric.label_ko : metric.label_en)}</span></div>`).join('')}
      </section>` : ''}
      ${role || contribution ? `<aside class="project-role-callout">
        <span>${lang === 'ko' ? '담당 역할' : 'My Role'}</span>
        ${role ? `<strong>${escapeHtml(role)}</strong>` : ''}
        ${contribution ? `<p>${escapeHtml(contribution)}</p>` : ''}
      </aside>` : ''}
      <div class="project-detail-content">${blocks.map(block => {
        const heading = localized(block, 'title', lang);
        const body = localized(block, 'content', lang);
        const caption = localized(block, 'caption', lang);
        const mediaUrl = block.media_url === project.cover_image_url ? '' : block.media_url;
        return `<section class="project-detail-block"><div>${heading ? `<h2>${escapeHtml(heading)}</h2>` : ''}${detailParagraph(body)}</div>
          ${mediaUrl ? `<figure><img src="${escapeHtml(mediaUrl)}" alt="${escapeHtml(caption || heading || title)}" loading="lazy">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>` : ''}</section>`;
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
      ? `<ul>${items.map(item => `<li>${cvInlineLinks(item)}</li>`).join('')}</ul>`
      : '';
  }

  function cvInlineLinks(value) {
    const source = String(value || '');
    const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let output = '';
    let cursor = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      output += escapeHtml(source.slice(cursor, match.index));
      const label = match[1].trim();
      const rawUrl = match[2].trim();
      const externalUrl = safeLink(rawUrl);
      const localImage = /^\/assets\/img\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp)$/i.test(rawUrl)
        ? rawUrl : '';
      if (localImage) {
        output += `<button class="cv-inline-media" type="button" data-cv-media="${escapeHtml(localImage)}" data-cv-media-alt="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
      } else if (externalUrl) {
        output += `<a href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
      } else {
        output += escapeHtml(match[0]);
      }
      cursor = pattern.lastIndex;
    }
    return output + escapeHtml(source.slice(cursor));
  }

  function cvRelatedLinks(row) {
    const links = String(row.related_links || '').split(';;').map(item => {
      const separator = item.indexOf('|');
      if (separator < 1) return '';
      const label = item.slice(0, separator).trim();
      const url = safeLink(item.slice(separator + 1));
      return label && url
        ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
        : '';
    }).filter(Boolean);
    return links.length ? `<div class="cv-related-links">${links.join('')}</div>` : '';
  }

  function cvMedia(row, lang, title) {
    const rawUrls = String(row.image_url || '').split('|').map(value => value.trim()).filter(Boolean);
    const alts = String(localized(row, 'image_alt', lang) || '').split('|').map(value => value.trim());
    const items = rawUrls.map((rawUrl, index) => {
      const imageUrl = safeLink(rawUrl) || (/^\/[^/]/.test(rawUrl) ? rawUrl : '');
      if (!imageUrl) return '';
      const imageAlt = alts[index] || alts[0] || title;
      return `<button class="cv-entry-media" type="button" data-cv-media="${escapeHtml(imageUrl)}" data-cv-media-alt="${escapeHtml(imageAlt)}" aria-label="${escapeHtml(`Enlarge ${imageAlt}`)}"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" loading="lazy"><span>${escapeHtml(imageAlt)}</span></button>`;
    }).filter(Boolean);
    return items.length ? `<div class="cv-entry-media-grid">${items.join('')}</div>` : '';
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
    if (type === 'research_metric') {
      return `<article class="cv-research-metric">
        <span>${escapeHtml(title)}</span>
        <strong>${escapeHtml(period)}</strong>
        <small>${escapeHtml(subtitle)}</small>
      </article>`;
    }
    const linkedTitle = url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>`
      : escapeHtml(title);
    const media = cvMedia(row, lang, title);
    return `<article class="cv-entry">
      <h3>${linkedTitle}${period ? `<span>${escapeHtml(period)}</span>` : ''}</h3>
      ${subtitle ? `<h4>${escapeHtml(subtitle)}</h4>` : ''}
      ${cvRelatedLinks(row)}
      ${cvDescription(row, lang)}
      ${media}
    </article>`;
  }

  function closeMediaModal() {
    const modal = document.querySelector('[data-portfolio-media-modal]');
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    const image = modal.querySelector('[data-portfolio-media-image]');
    if (image) image.removeAttribute('src');
    document.body.classList.remove('portfolio-media-modal-open');
    if (modal._trigger && document.contains(modal._trigger)) modal._trigger.focus();
    modal._trigger = null;
  }

  function openMediaModal(trigger) {
    const modal = document.querySelector('[data-portfolio-media-modal]');
    if (!modal || !trigger) return;
    const image = modal.querySelector('[data-portfolio-media-image]');
    const caption = modal.querySelector('[data-portfolio-media-caption]');
    if (!image || !caption) return;
    image.src = trigger.dataset.cvMedia || '';
    image.alt = trigger.dataset.cvMediaAlt || '';
    caption.textContent = trigger.dataset.cvMediaAlt || '';
    modal._trigger = trigger;
    modal.hidden = false;
    document.body.classList.add('portfolio-media-modal-open');
    modal.querySelector('[data-portfolio-media-close]')?.focus();
  }

  function bindMediaModal() {
    if (document.documentElement.dataset.portfolioMediaBound) return;
    document.documentElement.dataset.portfolioMediaBound = 'true';
    document.addEventListener('click', event => {
      const trigger = event.target.closest('[data-cv-media]');
      if (trigger) {
        openMediaModal(trigger);
        return;
      }
      if (event.target.closest('[data-portfolio-media-close]') ||
          event.target.matches('[data-portfolio-media-modal]')) closeMediaModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeMediaModal();
    });
  }

  async function renderCV(root) {
    const lang = currentLanguage();
    const sectionFilter = new Set(String(root.dataset.sectionFilter || '')
      .split(',').map(value => value.trim()).filter(Boolean));
    const sectionExclude = new Set(String(root.dataset.sectionExclude || '')
      .split(',').map(value => value.trim()).filter(Boolean));
    const rows = (await getSheet('CV_Content'))
      .filter(row => row.is_visible === undefined || truthy(row.is_visible))
      .filter(row => !sectionFilter.size || sectionFilter.has(String(row.section_id || '')))
      .filter(row => !sectionExclude.has(String(row.section_id || '')))
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
      const researchMetrics = section.rows.every(row => row.entry_type === 'research_metric');
      const content = credentials
        ? '<div data-cv-credentials><p>Loading credentials…</p></div>'
        : section.rows.map(row => cvEntry(row, lang)).join('');
      return `${index ? '<br>' : ''}<section class="cv-section" id="${escapeHtml(section.id)}">
        <h1>${escapeHtml(section.title)}</h1>
        <div${contacts ? ' class="cv-contact-grid"' : researchMetrics ? ' class="cv-research-metrics"' : ''}>${content}</div>
      </section>`;
    }).join('');
    const credentialRoot = root.querySelector('[data-cv-credentials]');
    if (credentialRoot) await renderCredentials(credentialRoot);
    document.querySelectorAll('[data-cv-download]').forEach(link => {
      const cvLanguage = link.dataset.cvDownload;
      if (lang === 'ko') {
        link.textContent = cvLanguage === 'ko'
          ? '📄 한글 이력서 열기 (PDF)'
          : '📄 영문 이력서 열기 (PDF)';
      } else {
        link.textContent = cvLanguage === 'ko'
          ? '📄 Download CV (Korean PDF)'
          : '📄 Download CV (English PDF)';
      }
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
      ...publications.map(row => ({type: 'Publication', title: row.Title, text: `${row.Authors} ${row.Venue_Name} ${row.Year}`, url: '/publications/'})),
      ...projects.map(row => ({type: 'Project', title: row.title_en, text: `${row.summary_en} ${row.tags}`, url: `/projects/detail/?project=${encodeURIComponent(row.slug || row.project_id)}`})),
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
    bindMediaModal();
    document.addEventListener('click', event => {
      const retry = event.target.closest('[data-portfolio-sync-retry]');
      if (!retry) return;
      String(retry.dataset.portfolioSyncRetry || '').split(',').filter(Boolean).forEach(retryRemote);
    });
    document.querySelectorAll('[data-portfolio-publications]').forEach(root => renderPublications(root, Number(root.dataset.limit || 0)));
    document.querySelectorAll('[data-portfolio-projects]').forEach(renderProjects);
    document.querySelectorAll('[data-portfolio-project-detail]').forEach(renderProjectDetail);
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
      refreshSyncStatuses();
      document.querySelectorAll('[data-portfolio-projects]').forEach(renderProjects);
      document.querySelectorAll('[data-portfolio-project-detail]').forEach(renderProjectDetail);
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
        document.querySelectorAll('[data-portfolio-project-detail]').forEach(renderProjectDetail);
      }
      if (sheet === 'Project_Content') {
        document.querySelectorAll('[data-portfolio-project-detail]').forEach(renderProjectDetail);
      }
      if (sheet === 'Professional_Credentials') {
        document.querySelectorAll('[data-portfolio-credentials]').forEach(renderCredentials);
        document.querySelectorAll('[data-portfolio-cv]').forEach(renderCV);
      }
      if (sheet === 'CV_Content') {
        document.querySelectorAll('[data-portfolio-cv]').forEach(renderCV);
      }
    });
    const schedule = window.requestIdleCallback || (callback => setTimeout(callback, 0));
    schedule(startBackgroundSync);
  }

  window.PortfolioData = {getSheet, currentLanguage};
  document.addEventListener('DOMContentLoaded', initialize);
})();
