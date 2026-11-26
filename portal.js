// Lightweight ambient motion for the single-game portal. No dependencies.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Scroll reveal, with a safe fallback when IntersectionObserver is unavailable.
  const reveals = [...document.querySelectorAll('[data-reveal]')];
  if (reduced || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('shown'));
  } else {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('shown');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
    reveals.forEach(el => observer.observe(el));
  }

  // Subtle pointer parallax on the game preview.
  const hero = document.querySelector('.hero');
  const showcase = document.querySelector('.showcase');
  if (!reduced && hero && showcase && matchMedia('(pointer:fine)').matches) {
    hero.addEventListener('pointermove', event => {
      const x = event.clientX / innerWidth - 0.5;
      const y = event.clientY / innerHeight - 0.5;
      showcase.style.setProperty('--px', `${(-x * 12).toFixed(2)}px`);
      showcase.style.setProperty('--py', `${(-y * 9).toFixed(2)}px`);
    }, { passive: true });
    hero.addEventListener('pointerleave', () => {
      showcase.style.setProperty('--px', '0px');
      showcase.style.setProperty('--py', '0px');
    });
  }

  // Ambient starfield.
  const canvas = document.getElementById('stars');
  if (!canvas || reduced) return;
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, stars = [];
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(180, Math.floor(w * h / 7600));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.5 + .3, a: Math.random() * .42 + .12,
      v: Math.random() * .11 + .025, p: Math.random() * 6.28
    }));
  }
  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      s.y -= s.v; if (s.y < -2) { s.y = h + 2; s.x = Math.random() * w; }
      const alpha = s.a * (.62 + .38 * Math.sin(t * .001 + s.p));
      ctx.beginPath(); ctx.fillStyle = `rgba(169,245,203,${alpha.toFixed(3)})`;
      ctx.arc(s.x, s.y, s.r, 0, 6.28); ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  addEventListener('resize', resize);
  resize(); requestAnimationFrame(draw);
})();
