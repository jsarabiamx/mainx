/* ═══════════════════════════════════════════════════════════════════
   CCTV Fleet Control — Responsive Controller v8.0
   Manages: Hamburger nav, filter accordion, keyboard avoidance
═══════════════════════════════════════════════════════════════════ */

window.RESP = (function () {
  'use strict';

  /* ── State ── */
  let navOpen = false;

  /* ── Elements ── */
  function el(id) { return document.getElementById(id); }

  /* ──────────────────────────────────────────────
     NAV TOGGLE
  ─────────────────────────────────────────────── */
  function toggleNav() {
    navOpen ? closeNav() : openNav();
  }

  function openNav() {
    const nav      = document.querySelector('.nav');
    const btn      = el('hamburgerBtn');
    const backdrop = el('mobileNavBackdrop');
    if (!nav) return;

    navOpen = true;
    nav.classList.add('mobile-open');
    btn && btn.classList.add('open');

    if (backdrop) {
      backdrop.style.display = 'block';
      requestAnimationFrame(() => backdrop.classList.add('visible'));
    }

    // Prevent body scroll while nav is open
    document.body.style.overflow = 'hidden';
  }

  function closeNav() {
    const nav      = document.querySelector('.nav');
    const btn      = el('hamburgerBtn');
    const backdrop = el('mobileNavBackdrop');
    if (!nav) return;

    navOpen = false;
    nav.classList.remove('mobile-open');
    btn && btn.classList.remove('open');

    if (backdrop) {
      backdrop.classList.remove('visible');
      setTimeout(() => { backdrop.style.display = 'none'; }, 250);
    }

    document.body.style.overflow = '';
  }

  /* Close nav when a nav button is clicked on mobile */
  function bindNavButtons() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.innerWidth <= 768) closeNav();
      });
    });

    const vtBtns = document.querySelectorAll('.vtbtn');
    vtBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.innerWidth <= 768) closeNav();
      });
    });
  }

  /* ──────────────────────────────────────────────
     FILTER ACCORDION — wraps filter rows in collapsible on mobile
  ─────────────────────────────────────────────── */
  function initFilterAccordions() {
    if (window.innerWidth > 768) return;

    const filterBars = document.querySelectorAll('.filters-bar-horizontal');
    filterBars.forEach(bar => {
      // Already processed
      if (bar.querySelector('.filter-toggle-mobile')) return;

      const filterRows = bar.querySelectorAll('.filter-row');
      if (filterRows.length === 0) return;

      // Create toggle button
      const toggle = document.createElement('button');
      toggle.className = 'filter-toggle-mobile';
      toggle.innerHTML = `
        <span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-right:6px;opacity:0.7">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="16" y2="12"/><line x1="4" y1="18" x2="12" y2="18"/>
          </svg>
          Filtros
        </span>
        <svg class="ftm-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      `;

      // Wrap existing filter rows in collapsible
      const collapsible = document.createElement('div');
      collapsible.className = 'filter-collapsible';
      filterRows.forEach(row => collapsible.appendChild(row));

      bar.insertBefore(toggle, bar.firstChild);
      bar.appendChild(collapsible);

      // Bind toggle
      toggle.addEventListener('click', () => {
        const isOpen = collapsible.classList.toggle('open');
        toggle.classList.toggle('active', isOpen);
      });
    });
  }

  /* ──────────────────────────────────────────────
     KEYBOARD AVOIDANCE — ensure focused inputs scroll into view
  ─────────────────────────────────────────────── */
  function initKeyboardAvoidance() {
    if (window.innerWidth > 768) return;

    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        // Small delay to let the keyboard appear
        setTimeout(() => {
          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      });
    });

    // Listen for viewport changes (keyboard open/close on mobile)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
          setTimeout(() => {
            active.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      });
    }
  }

  /* ──────────────────────────────────────────────
     RESIZE HANDLER — cleanup on orientation change
  ─────────────────────────────────────────────── */
  function onResize() {
    if (window.innerWidth > 768 && navOpen) {
      closeNav();
    }
  }

  /* ──────────────────────────────────────────────
     ESC KEY
  ─────────────────────────────────────────────── */
  function onKeydown(e) {
    if (e.key === 'Escape' && navOpen) closeNav();
  }

  /* ──────────────────────────────────────────────
     MUTATION OBSERVER — re-init accordions when nav buttons are injected
     (app-modules.js injects nav buttons dynamically)
  ─────────────────────────────────────────────── */
  function observeDOMChanges() {
    const observer = new MutationObserver(() => {
      bindNavButtons();
      if (window.innerWidth <= 768) initFilterAccordions();
    });

    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
      observer.observe(mainContent, { childList: true, subtree: true });
    }

    const navLeft = document.getElementById('navLeft');
    if (navLeft) {
      observer.observe(navLeft, { childList: true, subtree: true });
    }
  }

  /* ──────────────────────────────────────────────
     INIT
  ─────────────────────────────────────────────── */
  function init() {
    bindNavButtons();
    initFilterAccordions();
    initKeyboardAvoidance();
    observeDOMChanges();

    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('keydown', onKeydown);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Slight delay to allow app JS to render its components
    setTimeout(init, 100);
  }

  /* ── Public API ── */
  return { toggleNav, openNav, closeNav };
})();
