(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {
    navigating: false,
    revealObserver: null,
  };

  function initLiveBackground() {
    if (document.getElementById('live-background')) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'live-background';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrame = 0;
    let lastTime = performance.now();
    let particles = [];
    let pointerX = 0;
    let pointerY = 0;
    let targetPointerX = 0;
    let targetPointerY = 0;
    let visible = !document.hidden;

    const depth = 950;
    const focalLength = 560;

    function particleCount() {
      const areaCount = Math.round((width * height) / 15500);
      const upperLimit = width < 720 ? 60 : 105;
      return prefersReducedMotion ? Math.min(34, areaCount) : Math.max(42, Math.min(upperLimit, areaCount));
    }

    function makeParticle(resetNear = false) {
      return {
        x: (Math.random() - 0.5) * width * 1.45,
        y: (Math.random() - 0.5) * height * 1.45,
        z: resetNear ? depth : Math.random() * depth,
        speed: 0.12 + Math.random() * 0.24,
        size: 0.55 + Math.random() * 1.4,
        tone: Math.random(),
      };
    }

    function rebuildParticles() {
      particles = Array.from({ length: particleCount() }, () => makeParticle(false));
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      rebuildParticles();
    }

    function project(particle) {
      const scale = focalLength / (focalLength + particle.z);
      return {
        x: width / 2 + (particle.x + pointerX * 70) * scale,
        y: height / 2 + (particle.y + pointerY * 52) * scale,
        scale,
        alpha: Math.max(0.06, Math.min(0.7, 1 - particle.z / depth)),
      };
    }

    function drawOrb(x, y, radius, color) {
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.45, color.replace(/0\.([0-9]+)\)/, '0.045)'));
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }

    function draw(time) {
      const delta = Math.min(32, time - lastTime);
      lastTime = time;
      context.clearRect(0, 0, width, height);

      pointerX += (targetPointerX - pointerX) * 0.035;
      pointerY += (targetPointerY - pointerY) * 0.035;

      const drift = time * 0.00008;
      drawOrb(
        width * (0.18 + Math.sin(drift) * 0.035),
        height * (0.2 + Math.cos(drift * 1.3) * 0.04),
        Math.min(width, height) * 0.34,
        'rgba(48, 152, 204, 0.075)'
      );
      drawOrb(
        width * (0.82 + Math.cos(drift * 0.9) * 0.04),
        height * (0.34 + Math.sin(drift * 1.1) * 0.035),
        Math.min(width, height) * 0.3,
        'rgba(120, 91, 218, 0.065)'
      );

      const projected = [];
      const movement = prefersReducedMotion ? 0 : delta;

      for (const particle of particles) {
        particle.z -= particle.speed * movement;
        particle.x += Math.sin(time * 0.00018 + particle.z) * 0.004 * movement;

        if (particle.z < 1) Object.assign(particle, makeParticle(true));

        const point = project(particle);
        projected.push({ ...point, particle });

        if (point.x < -80 || point.x > width + 80 || point.y < -80 || point.y > height + 80) {
          Object.assign(particle, makeParticle(true));
          continue;
        }

        const blue = particle.tone > 0.72;
        context.fillStyle = blue
          ? `rgba(158, 139, 255, ${point.alpha * 0.72})`
          : `rgba(126, 220, 255, ${point.alpha})`;
        context.beginPath();
        context.arc(point.x, point.y, particle.size * (0.7 + point.scale * 1.7), 0, Math.PI * 2);
        context.fill();
      }

      const connectionDistance = width < 720 ? 92 : 122;
      for (let i = 0; i < projected.length; i += 1) {
        const a = projected[i];
        if (a.alpha < 0.18) continue;

        for (let j = i + 1; j < projected.length; j += 1) {
          const b = projected[j];
          if (b.alpha < 0.18) continue;

          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.hypot(dx, dy);
          if (distance > connectionDistance) continue;

          const opacity = (1 - distance / connectionDistance) * Math.min(a.alpha, b.alpha) * 0.22;
          context.strokeStyle = `rgba(126, 220, 255, ${opacity})`;
          context.lineWidth = 0.65;
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.stroke();
        }
      }

      if (visible) animationFrame = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', (event) => {
      targetPointerX = (event.clientX / Math.max(1, width) - 0.5) * 2;
      targetPointerY = (event.clientY / Math.max(1, height) - 0.5) * 2;
    }, { passive: true });
    window.addEventListener('pointerleave', () => {
      targetPointerX = 0;
      targetPointerY = 0;
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      visible = !document.hidden;
      if (visible && !animationFrame) {
        lastTime = performance.now();
        animationFrame = requestAnimationFrame(draw);
      }
      if (!visible && animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    });

    resize();
    animationFrame = requestAnimationFrame(draw);
  }

  function initMenu() {
    const menuButton = document.querySelector('.menu-btn');
    const navLinks = document.querySelector('.nav-links');
    if (!menuButton || !navLinks || menuButton.dataset.ready === 'true') return;

    menuButton.dataset.ready = 'true';
    menuButton.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(open));
    });
  }

  function closeMenu() {
    const menuButton = document.querySelector('.menu-btn');
    const navLinks = document.querySelector('.nav-links');
    navLinks?.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
  }

  function initReveal() {
    state.revealObserver?.disconnect();

    if (!('IntersectionObserver' in window) || prefersReducedMotion) {
      document.querySelectorAll('.reveal').forEach((element) => element.classList.add('visible'));
      return;
    }

    state.revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          state.revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('.reveal').forEach((element) => state.revealObserver.observe(element));
  }

  function updateYear() {
    document.querySelectorAll('[data-year]').forEach((element) => {
      element.textContent = String(new Date().getFullYear());
    });
  }

  function normalizePath(pathname) {
    const cleaned = pathname.replace(/\/+$/, '');
    return cleaned === '' ? '/index.html' : cleaned.endsWith('/') ? `${cleaned}index.html` : cleaned;
  }

  function updateActiveNavigation(url) {
    const currentPath = normalizePath(url.pathname);
    document.querySelectorAll('.nav-links a').forEach((link) => {
      const linkUrl = new URL(link.href, window.location.href);
      const active = normalizePath(linkUrl.pathname) === currentPath ||
        (currentPath === '/index.html' && normalizePath(linkUrl.pathname) === '/');

      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function initPage() {
    initMenu();
    initReveal();
    updateYear();
    updateActiveNavigation(new URL(window.location.href));
  }

  function isInternalPageLink(anchor, url) {
    if (anchor.target && anchor.target !== '_self') return false;
    if (anchor.hasAttribute('download')) return false;
    if (url.origin !== window.location.origin) return false;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

    const path = url.pathname.toLowerCase();
    return path.endsWith('.html') || path.endsWith('/') || !path.split('/').pop()?.includes('.');
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  async function navigate(url, { push = true } = {}) {
    if (state.navigating) return;

    const current = new URL(window.location.href);
    if (url.href === current.href) {
      closeMenu();
      return;
    }

    state.navigating = true;
    document.body.classList.add('is-transitioning');
    closeMenu();

    try {
      await wait(prefersReducedMotion ? 0 : 190);
      const response = await fetch(url.href, {
        headers: { 'X-Requested-With': 'portfolio-navigation' },
        cache: 'no-cache',
      });
      if (!response.ok) throw new Error(`Navigation failed with status ${response.status}`);

      const html = await response.text();
      const nextDocument = new DOMParser().parseFromString(html, 'text/html');
      const nextMain = nextDocument.querySelector('main');
      const nextFooter = nextDocument.querySelector('.site-footer');
      const currentMain = document.querySelector('main');
      const currentFooter = document.querySelector('.site-footer');

      if (!nextMain || !currentMain) throw new Error('The requested page has no main content.');

      currentMain.replaceWith(nextMain);
      if (nextFooter && currentFooter) currentFooter.replaceWith(nextFooter);
      document.title = nextDocument.title || document.title;

      if (push) history.pushState({ portfolioPage: true }, '', url.href);

      updateActiveNavigation(url);
      initPage();

      if (url.hash) {
        requestAnimationFrame(() => document.querySelector(url.hash)?.scrollIntoView());
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }

      await wait(30);
      document.body.classList.remove('is-transitioning');
    } catch (error) {
      console.error(error);
      window.location.href = url.href;
      return;
    } finally {
      state.navigating = false;
    }
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target.closest('a[href]');
    if (!anchor) return;

    const url = new URL(anchor.href, window.location.href);
    if (!isInternalPageLink(anchor, url)) return;

    const current = new URL(window.location.href);
    if (url.pathname === current.pathname && url.search === current.search && url.hash) return;

    event.preventDefault();
    navigate(url);
  });

  window.addEventListener('popstate', () => {
    navigate(new URL(window.location.href), { push: false });
  });

  initLiveBackground();
  initPage();
})();
