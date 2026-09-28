(function () {
  'use strict';

  function parsedHttpsUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return url.protocol === 'https:' ? url : null;
    } catch (_error) {
      return null;
    }
  }

  function isYouTubeHost(hostname) {
    const host = String(hostname || '').toLowerCase().replace(/^www\./, '');
    return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
  }

  function youtubeVideoId(value) {
    const url = parsedHttpsUrl(value);
    if (!url || !isYouTubeHost(url.hostname)) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let candidate = '';
    if (host === 'youtu.be') {
      candidate = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (url.pathname === '/watch') {
      candidate = url.searchParams.get('v') || '';
    } else {
      const parts = url.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) candidate = parts[1] || '';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  }

  function cardFor(row) {
    const url = parsedHttpsUrl(row.url);
    if (!url) return null;
    const videoId = youtubeVideoId(url.href);
    if (isYouTubeHost(url.hostname) && !videoId) return null;

    const card = document.createElement('article');
    card.className = 'learning-video-card';
    const title = document.createElement('h3');
    title.textContent = String(row.title || url.href);

    if (videoId) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'learning-video-thumbnail';
      button.dataset.videoId = videoId;
      button.setAttribute('aria-label', `Play ${title.textContent}`);
      const image = document.createElement('img');
      image.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      image.alt = '';
      image.loading = 'lazy';
      const play = document.createElement('span');
      play.className = 'learning-video-play';
      play.setAttribute('aria-hidden', 'true');
      play.textContent = '▶';
      button.append(image, play);
      card.append(button, title);
    } else {
      const link = document.createElement('a');
      link.className = 'learning-video-external';
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Open resource ↗';
      card.append(title, link);
    }
    return card;
  }

  function closeModal(root) {
    const modal = root.querySelector('[data-learning-video-modal]');
    const player = root.querySelector('[data-learning-video-player]');
    if (!modal || !player) return;
    player.replaceChildren();
    modal.hidden = true;
    document.body.classList.remove('learning-video-modal-open');
    const trigger = root._learningVideoTrigger;
    if (trigger && document.contains(trigger)) trigger.focus();
    root._learningVideoTrigger = null;
  }

  function openModal(root, trigger, videoId) {
    const modal = root.querySelector('[data-learning-video-modal]');
    const player = root.querySelector('[data-learning-video-player]');
    if (!modal || !player) return;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`;
    iframe.title = trigger.getAttribute('aria-label') || 'YouTube video player';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    player.replaceChildren(iframe);
    root._learningVideoTrigger = trigger;
    modal.hidden = false;
    document.body.classList.add('learning-video-modal-open');
    const close = modal.querySelector('[data-learning-video-close]');
    if (close) close.focus();
  }

  function bindModal(root) {
    if (root.dataset.learningVideoBound) return;
    root.dataset.learningVideoBound = 'true';
    root.addEventListener('click', event => {
      const trigger = event.target.closest('[data-video-id]');
      if (trigger && root.contains(trigger)) {
        openModal(root, trigger, trigger.dataset.videoId);
        return;
      }
      if (event.target.closest('[data-learning-video-close]') ||
          event.target.matches('[data-learning-video-modal]')) closeModal(root);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeModal(root);
    });
  }

  async function render(root) {
    bindModal(root);
    const content = root.querySelector('[data-learning-video-content]');
    if (!content || !window.PortfolioData) return;
    const rows = await window.PortfolioData.getSheet('Learning_Videos');
    const unique = [];
    const seen = new Set();
    rows.slice().sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0))
      .forEach(row => {
        const url = String(row.url || '').trim();
        const key = `${row.series || ''}\n${url}`;
        if (!url || seen.has(key)) return;
        seen.add(key);
        unique.push(row);
      });

    const language = window.PortfolioData.currentLanguage();
    const groups = new Map();
    unique.forEach(row => {
      const card = cardFor(row);
      if (!card) return;
      const id = String(row.series || 'other');
      if (!groups.has(id)) groups.set(id, {row, cards: []});
      groups.get(id).cards.push(card);
    });

    content.replaceChildren();
    groups.forEach(group => {
      const section = document.createElement('section');
      section.className = 'learning-video-series';
      const heading = document.createElement('h2');
      heading.textContent = language === 'ko'
        ? (group.row.series_label_ko || group.row.series_label_en || group.row.series)
        : (group.row.series_label_en || group.row.series_label_ko || group.row.series);
      const grid = document.createElement('div');
      grid.className = 'learning-video-grid';
      grid.append(...group.cards);
      section.append(heading, grid);
      content.append(section);
    });
    if (!groups.size) {
      const empty = document.createElement('p');
      empty.className = 'portfolio-empty';
      empty.textContent = language === 'ko'
        ? '등록된 학습 영상이 없습니다.'
        : 'No learning videos are available yet.';
      content.append(empty);
    }
  }

  function initialize() {
    document.querySelectorAll('[data-learning-videos]').forEach(render);
  }

  window.LearningVideos = {youtubeVideoId, render};
  document.addEventListener('DOMContentLoaded', initialize);
  document.addEventListener('portfolio:languagechange', initialize);
  document.addEventListener('portfolio:dataupdated', event => {
    if (event.detail && event.detail.sheet === 'Learning_Videos') initialize();
  });
})();
