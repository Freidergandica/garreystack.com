/* ================================================
   GarreyStack — Interactive Script v3
   All bugs fixed: consolidated scroll, spatial grid
   particles, proper reduced-motion, honest form,
   no transform conflicts, correct animation timing
   ================================================ */

document.addEventListener('DOMContentLoaded', () => {

    // =============================================
    // REDUCED MOTION CHECK — must run FIRST
    // Bug #11 fix: check before any animation starts
    // =============================================
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // =============================================
    // LOADING SCREEN
    // =============================================
    const loader = document.getElementById('loader');
    const loaderBar = document.getElementById('loaderBar');

    if (prefersReducedMotion) {
        // Skip loader entirely, show content immediately
        loader.classList.add('hidden');
        document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
        const heroTitle = document.getElementById('heroTitle');
        if (heroTitle) {
            heroTitle.classList.add('words-visible');
            heroTitle.querySelectorAll('.word').forEach(w => {
                w.style.transitionDelay = '0s';
            });
        }
    } else {
        document.body.classList.add('loading');
        let progress = 0;
        const loaderInterval = setInterval(() => {
            progress += Math.random() * 25 + 10;
            if (progress >= 100) {
                progress = 100;
                clearInterval(loaderInterval);
                loaderBar.style.width = '100%';
                setTimeout(() => {
                    loader.classList.add('hidden');
                    document.body.classList.remove('loading');
                    startHeroAnimations();
                }, 400);
            } else {
                loaderBar.style.width = progress + '%';
            }
        }, 200);
    }

    // =============================================
    // PARTICLE SYSTEM
    // Bug #14 fix: spatial grid for O(n) connections
    // =============================================
    const canvas = document.getElementById('particleCanvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let mouseX = -1000;
    let mouseY = -1000;
    let animationId;

    // Spatial grid config
    const GRID_CELL_SIZE = 120; // same as connection distance
    let gridCols, gridRows, grid;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gridCols = Math.ceil(canvas.width / GRID_CELL_SIZE) + 1;
        gridRows = Math.ceil(canvas.height / GRID_CELL_SIZE) + 1;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.3;
            this.speedY = (Math.random() - 0.5) * 0.3;
            this.opacity = Math.random() * 0.5 + 0.1;
            this.color = Math.random() > 0.5 ? '108, 92, 231' : '0, 206, 201';
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;

            const dx = mouseX - this.x;
            const dy = mouseY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150 && dist > 0) {
                const force = (150 - dist) / 150;
                this.x -= (dx / dist) * force * 0.8;
                this.y -= (dy / dist) * force * 0.8;
            }

            if (this.x < 0) this.x = canvas.width;
            if (this.x > canvas.width) this.x = 0;
            if (this.y < 0) this.y = canvas.height;
            if (this.y > canvas.height) this.y = 0;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.color}, ${this.opacity})`;
            ctx.fill();
        }
    }

    // Fewer particles on mobile for performance
    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? 25 : Math.min(60, Math.floor(window.innerWidth / 25));
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    // Bug #14 fix: spatial grid reduces O(n²) to ~O(n)
    // Only check neighbors in adjacent grid cells
    function buildGrid() {
        grid = new Array(gridCols * gridRows);
        for (let i = 0; i < grid.length; i++) grid[i] = [];

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const col = Math.floor(p.x / GRID_CELL_SIZE);
            const row = Math.floor(p.y / GRID_CELL_SIZE);
            const idx = row * gridCols + col;
            if (idx >= 0 && idx < grid.length) {
                grid[idx].push(i);
            }
        }
    }

    function drawConnections() {
        buildGrid();

        const drawn = new Set();
        for (let row = 0; row < gridRows; row++) {
            for (let col = 0; col < gridCols; col++) {
                const cellIdx = row * gridCols + col;
                const cell = grid[cellIdx];
                if (!cell || cell.length === 0) continue;

                // Check current cell + right, bottom, bottom-right, bottom-left neighbors
                const neighbors = [
                    cellIdx,
                    col + 1 < gridCols ? cellIdx + 1 : -1,
                    row + 1 < gridRows ? cellIdx + gridCols : -1,
                    col + 1 < gridCols && row + 1 < gridRows ? cellIdx + gridCols + 1 : -1,
                    col - 1 >= 0 && row + 1 < gridRows ? cellIdx + gridCols - 1 : -1
                ];

                for (const i of cell) {
                    for (const neighborIdx of neighbors) {
                        if (neighborIdx < 0) continue;
                        const neighborCell = grid[neighborIdx];
                        if (!neighborCell) continue;

                        for (const j of neighborCell) {
                            if (i >= j) continue; // avoid duplicates
                            const key = i * 1000 + j;
                            if (drawn.has(key)) continue;
                            drawn.add(key);

                            const dx = particles[i].x - particles[j].x;
                            const dy = particles[i].y - particles[j].y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist < GRID_CELL_SIZE) {
                                ctx.beginPath();
                                ctx.moveTo(particles[i].x, particles[i].y);
                                ctx.lineTo(particles[j].x, particles[j].y);
                                ctx.strokeStyle = `rgba(108, 92, 231, ${0.06 * (1 - dist / GRID_CELL_SIZE)})`;
                                ctx.lineWidth = 0.5;
                                ctx.stroke();
                            }
                        }
                    }
                }
            }
        }
    }

    function animateParticles() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        // Skip connections on mobile — too expensive
        if (!isMobile) drawConnections();
        animationId = requestAnimationFrame(animateParticles);
    }

    if (!prefersReducedMotion) {
        animateParticles();
    }

    // =============================================
    // CURSOR GLOW
    // =============================================
    const cursorGlow = document.getElementById('cursorGlow');
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        cursorGlow.style.left = e.clientX + 'px';
        cursorGlow.style.top = e.clientY + 'px';
    });

    // =============================================
    // HERO WORD-BY-WORD ANIMATION
    // Bug #12 fix: heroTitle is NOT a .reveal element
    // Only .word children animate, no double opacity:0
    // =============================================
    function startHeroAnimations() {
        const heroTitle = document.getElementById('heroTitle');
        if (!heroTitle) return;

        const words = heroTitle.querySelectorAll('.word');
        words.forEach((word, i) => {
            word.style.transitionDelay = `${i * 0.07}s`;
        });

        requestAnimationFrame(() => {
            heroTitle.classList.add('words-visible');
        });

        // Stagger reveals for other hero elements
        document.querySelectorAll('.hero-content .reveal').forEach((el, i) => {
            setTimeout(() => {
                el.classList.add('visible');
            }, 300 + i * 150);
        });
    }

    // =============================================
    // NAVIGATION
    // =============================================
    const nav = document.getElementById('nav');
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    const navLinkEls = navLinks.querySelectorAll('.nav-link:not(.nav-link--cta)');

    // Mobile menu
    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navLinks.classList.toggle('active');
        document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
    });

    navLinks.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navLinks.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // =============================================
    // CONSOLIDATED SCROLL HANDLER
    // Bug #5 fix: one handler with rAF throttle
    // Combines: nav sticky + active nav + parallax
    // =============================================
    const sections = document.querySelectorAll('section[id]');
    const heroBg = document.querySelector('.hero-bg');
    const heroContent = document.querySelector('.hero-content');
    let scrollTicking = false;

    function onScroll() {
        const scrollY = window.scrollY;
        const vh = window.innerHeight;

        // --- Nav sticky ---
        if (scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }

        // --- Active nav indicator ---
        // Bug #4 fix: sections without id (like mission) are skipped
        // gracefully — the previous active link stays until the next
        // id'd section is reached
        const scrollCheck = scrollY + 120;
        let currentSection = null;

        sections.forEach(section => {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            if (scrollCheck >= top && scrollCheck < top + height) {
                currentSection = section.getAttribute('id');
            }
        });

        if (currentSection) {
            navLinkEls.forEach(link => {
                link.classList.toggle(
                    'active',
                    link.getAttribute('href') === '#' + currentSection
                );
            });
        }

        // --- Parallax ---
        // Bug #2 fix: apply parallax to hero-bg only, NOT hero-content.
        // hero-content uses reveal animations with their own transforms.
        if (!prefersReducedMotion && scrollY < vh) {
            const ratio = scrollY / vh;
            if (heroBg) {
                heroBg.style.transform = `translateY(${scrollY * 0.25}px)`;
            }
            if (heroContent) {
                heroContent.style.opacity = Math.max(0, 1 - ratio * 1.3);
            }
        }

        scrollTicking = false;
    }

    window.addEventListener('scroll', () => {
        if (!scrollTicking) {
            requestAnimationFrame(onScroll);
            scrollTicking = true;
        }
    }, { passive: true });

    // =============================================
    // SCROLL REVEAL (IntersectionObserver)
    // Bug #12 fix: exclude hero-content reveals, those
    // are handled by startHeroAnimations()
    // =============================================
    const revealElements = document.querySelectorAll('.reveal:not(.hero-content .reveal)');
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -60px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));

    // =============================================
    // COUNTER ANIMATION
    // =============================================
    const statNumbers = document.querySelectorAll('.stat-number[data-target]');
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                const target = parseInt(el.getAttribute('data-target'));
                animateCounter(el, target);
                counterObserver.unobserve(el);
            }
        });
    }, { threshold: 0.5 });

    statNumbers.forEach(el => counterObserver.observe(el));

    function animateCounter(el, target) {
        const duration = 2000;
        const start = performance.now();

        function update(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(target * eased);
            if (progress < 1) requestAnimationFrame(update);
        }
        requestAnimationFrame(update);
    }

    // =============================================
    // 3D TILT EFFECT ON CARDS
    // Bug #1 fix: JS handles ALL transforms on tilt cards.
    // CSS :hover only changes border-color/box-shadow.
    // mouseleave resets cleanly without conflicting.
    // =============================================
    if (!prefersReducedMotion) {
        const tiltCards = document.querySelectorAll('.service-card, .mission-card, .diferencial-card');

        tiltCards.forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;

                const rotateX = ((y - centerY) / centerY) * -5;
                const rotateY = ((x - centerX) / centerX) * 5;

                card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(8px)`;

                // Mouse glow position for service cards
                if (card.classList.contains('service-card')) {
                    const px = (x / rect.width) * 100;
                    const py = (y / rect.height) * 100;
                    card.style.setProperty('--mouse-x', px + '%');
                    card.style.setProperty('--mouse-y', py + '%');
                }
            });

            card.addEventListener('mouseleave', () => {
                // Clean reset — no leftover transforms
                card.style.transform = '';
            });
        });
    }

    // =============================================
    // MAGNETIC BUTTONS
    // =============================================
    if (!prefersReducedMotion) {
        const magneticBtns = document.querySelectorAll('.magnetic');

        magneticBtns.forEach(btn => {
            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.transform = '';
            });
        });
    }

    // =============================================
    // BUTTON RIPPLE EFFECT
    // =============================================
    document.querySelectorAll('.btn--primary').forEach(btn => {
        btn.addEventListener('click', function (e) {
            const rect = this.getBoundingClientRect();
            const ripple = document.createElement('span');
            ripple.classList.add('btn-ripple');
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
            ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
            this.appendChild(ripple);
            ripple.addEventListener('animationend', () => ripple.remove());
        });
    });

    // =============================================
    // SMOOTH SCROLL FOR ANCHOR LINKS
    // Bug #13 fix: preventDefault on href="#" too
    // =============================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault(); // always prevent default for # links
            const targetId = this.getAttribute('href');
            if (targetId === '#') return; // logo click — stay at top

            const targetEl = document.querySelector(targetId);
            if (targetEl) {
                const offset = 80;
                const top = targetEl.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });

    // =============================================
    // CONTACT FORM
    // Bug #15 fix: form now uses FormSubmit (real delivery).
    // JS only handles UX: loading state + success feedback.
    // If FormSubmit redirects, the native submit handles it.
    // We add a fetch-based submit for SPA feel.
    // =============================================
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const btn = document.getElementById('submitBtn');
            const originalHTML = btn.innerHTML;
            const formData = new FormData(contactForm);

            // Show loading state
            btn.disabled = true;
            btn.innerHTML = '<span>Enviando...</span><span class="material-symbols-outlined">hourglass_empty</span>';

            fetch(contactForm.action, {
                method: 'POST',
                body: formData,
                headers: { 'Accept': 'application/json' }
            })
            .then(response => {
                if (response.ok) {
                    btn.innerHTML = '<span>¡Mensaje enviado!</span><span class="material-symbols-outlined">check</span>';
                    btn.style.background = 'linear-gradient(135deg, #00cec9, #00b894)';
                    contactForm.reset();
                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        btn.style.background = '';
                        btn.disabled = false;
                    }, 3000);
                } else {
                    throw new Error('Error del servidor');
                }
            })
            .catch(() => {
                btn.innerHTML = '<span>Error al enviar. Intenta de nuevo.</span><span class="material-symbols-outlined">error</span>';
                btn.style.background = 'linear-gradient(135deg, #e17055, #d63031)';
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.style.background = '';
                    btn.disabled = false;
                }, 3000);
            });
        });
    }

    // =============================================
    // TEXT SCRAMBLE EFFECT ON HOVER (section tags)
    // =============================================
    if (!prefersReducedMotion) {
        document.querySelectorAll('.section-tag').forEach(tag => {
            const textNode = Array.from(tag.childNodes).find(
                n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
            );
            if (!textNode) return;
            const original = textNode.textContent.trim();
            let isScrambling = false;

            tag.addEventListener('mouseenter', () => {
                if (isScrambling) return; // prevent overlapping scrambles
                isScrambling = true;

                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                let iterations = 0;

                const interval = setInterval(() => {
                    textNode.textContent = ' ' + original.split('').map((char, i) => {
                        if (char === ' ') return ' ';
                        if (i < iterations) return original[i];
                        return chars[Math.floor(Math.random() * chars.length)];
                    }).join('');

                    iterations += 1;
                    if (iterations > original.length) {
                        clearInterval(interval);
                        textNode.textContent = ' ' + original;
                        isScrambling = false;
                    }
                }, 30);
            });
        });
    }
});
