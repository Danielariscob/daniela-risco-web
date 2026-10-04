(function () {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const headerHeight = () => document.querySelector('.site-header')?.offsetHeight || 0;

  /* ---------- Load sequence ---------- */
  const reveal = () => document.body.classList.add('is-loaded');
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))])
      .then(() => requestAnimationFrame(reveal));
  } else {
    reveal();
  }

  /* ---------- Smooth scroll (Lenis) ---------- */
  let lenis = null;
  if (!reduceMotion && window.Lenis) {
    lenis = new window.Lenis({
      duration: 1.15,
      easing: (t) => 1 - Math.pow(1 - t, 4),
      smoothWheel: true,
    });
    const loop = (time) => { lenis.raf(time); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  // in-page links glide to their section, below the sticky header
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      const target = id === '#top' ? document.body : document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) {
        lenis.scrollTo(id === '#top' ? 0 : target, { offset: -headerHeight() - 8 });
      } else {
        const y = id === '#top' ? 0 : target.getBoundingClientRect().top + window.scrollY - headerHeight() - 8;
        window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
      if (id !== '#top') target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });

  /* ---------- Stacked bands: covered bands settle back slightly ---------- */
  const bands = Array.from(document.querySelectorAll('.band'));
  const pinned = window.matchMedia('(min-width: 900px) and (min-height: 700px)');
  let ticking = false;

  function updateBands() {
    ticking = false;
    if (!pinned.matches || reduceMotion) {
      bands.forEach((b) => b.style.setProperty('--cover', 0));
      return;
    }
    for (let i = 0; i < bands.length - 1; i++) {
      const a = bands[i].getBoundingClientRect();
      const b = bands[i + 1].getBoundingClientRect();
      const covered = Math.min(Math.max((a.bottom - b.top) / a.height, 0), 1);
      bands[i].style.setProperty('--cover', covered.toFixed(3));
    }
  }
  const requestBands = () => { if (!ticking) { ticking = true; requestAnimationFrame(updateBands); } };
  window.addEventListener('scroll', requestBands, { passive: true });
  window.addEventListener('resize', requestBands);
  updateBands();

  /* ---------- Current section in the nav ---------- */
  const navLinks = Array.from(document.querySelectorAll('.site-nav a'));
  const sections = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => a.removeAttribute('aria-current'));
      const active = navLinks.find((a) => a.getAttribute('href') === '#' + entry.target.id);
      if (active) active.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => navObserver.observe(s));

  /* ---------- Experience tabs ---------- */
  document.querySelectorAll('[data-tabs]').forEach((tabs) => {
    const list = tabs.querySelector('[role="tablist"]');
    const buttons = Array.from(tabs.querySelectorAll('[role="tab"]'));
    const marker = tabs.querySelector('.tabs__marker');

    function moveMarker(btn) {
      marker.style.setProperty('--y', btn.offsetTop + 'px');
      marker.style.setProperty('--h', btn.offsetHeight + 'px');
      marker.style.setProperty('--x', btn.offsetLeft + 'px');
      marker.style.setProperty('--w', btn.offsetWidth + 'px');
    }

    function select(btn, focus) {
      buttons.forEach((b) => {
        const on = b === btn;
        b.setAttribute('aria-selected', on);
        b.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(b.getAttribute('aria-controls'));
        if (on) {
          panel.hidden = false;
          panel.classList.remove('is-entering');
          void panel.offsetWidth;          // restart the entrance animation
          panel.classList.add('is-entering');
        } else {
          panel.hidden = true;
        }
      });
      moveMarker(btn);
      if (focus) btn.focus();
      if (btn.scrollIntoView && list.scrollWidth > list.clientWidth) {
        list.scrollTo({ left: btn.offsetLeft - 16, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    }

    buttons.forEach((btn, i) => {
      btn.addEventListener('click', () => select(btn, false));
      btn.addEventListener('keydown', (e) => {
        const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        if (e.key in keys) {
          e.preventDefault();
          select(buttons[(i + keys[e.key] + buttons.length) % buttons.length], true);
        } else if (e.key === 'Home') { e.preventDefault(); select(buttons[0], true); }
        else if (e.key === 'End') { e.preventDefault(); select(buttons[buttons.length - 1], true); }
      });
    });

    const current = () => buttons.find((b) => b.getAttribute('aria-selected') === 'true') || buttons[0];
    moveMarker(current());
    window.addEventListener('resize', () => moveMarker(current()));
    if (document.fonts) document.fonts.ready.then(() => moveMarker(current()));
  });

  /* ---------- Show all courses ---------- */
  document.querySelectorAll('.more__toggle').forEach((btn) => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    panel.inert = true;
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', open);
      panel.classList.toggle('is-open', open);
      panel.inert = !open;
      btn.textContent = open ? btn.dataset.openLabel : btn.dataset.closedLabel;
      // let Lenis recalculate the page height after the animation
      if (lenis) setTimeout(() => lenis.resize(), 850);
    });
  });

  /* ---------- Copy email ---------- */
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    const label = btn.textContent;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = 'Email copied';
      } catch {
        btn.textContent = 'Copy failed, use the link';
      }
      btn.classList.add('is-done');
      setTimeout(() => { btn.textContent = label; btn.classList.remove('is-done'); }, 2200);
    });
  });

  /* ---------- Missing screenshots fall back to grain ---------- */
  document.querySelectorAll('.band__media img').forEach((img) => {
    const hide = () => { img.remove(); };
    if (img.complete && img.naturalWidth === 0) hide();
    else img.addEventListener('error', hide);
  });

  /* ---------- Footer year ---------- */
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
