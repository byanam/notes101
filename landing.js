// landing.js - Landing Page Scaling, Animations, and Firebase Google Authentication

import { signInWithGoogle, listenToAuthState } from './firebase/auth.js';

// =========================================================================
// 1. RESPONSIVE CANVAS SCALING
// =========================================================================
(function () {
    var wrapper = document.getElementById('pageScaleWrapper');
    var canvas = document.getElementById('pageCanvas');
    var DESIGN_WIDTH = 1920;
    var DESIGN_HEIGHT = 3951;

    function updateScale() {
        if (!wrapper || !canvas) return;
        var clientWidth = document.documentElement.clientWidth || window.innerWidth;
        var scale = clientWidth / DESIGN_WIDTH;
        canvas.style.transform = 'scale(' + scale + ')';
        wrapper.style.height = (DESIGN_HEIGHT * scale) + 'px';
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }

    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);
    updateScale();
})();

// =========================================================================
// 2. SMOOTH SCROLL (Lenis) & GSAP ANIMATIONS
// =========================================================================
(function () {
    if (typeof Lenis === 'undefined' || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    var lenis = new Lenis({
        duration: 2.2,
        wheelMultiplier: 0.45,
        smoothWheel: true,
        smoothTouch: false
    });

    lenis.on('scroll', ScrollTrigger.update);

    gsap.ticker.add(function (time) {
        lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    document.querySelectorAll('.js-typewriter').forEach(function (el) {
        var plainText = el.textContent;
        el.setAttribute('aria-label', plainText);

        var inner = document.createElement('span');
        inner.setAttribute('aria-hidden', 'true');
        var chars = [];

        Array.from(el.childNodes).forEach(function (node) {
            if (node.nodeType === 3) { // TEXT_NODE
                var text = node.textContent;
                for (var i = 0; i < text.length; i++) {
                    if (text[i] === ' ') {
                        inner.appendChild(document.createTextNode(' '));
                    } else {
                        var span = document.createElement('span');
                        span.className = 'promo__heading-char';
                        span.textContent = text[i];
                        inner.appendChild(span);
                        chars.push(span);
                    }
                }
            } else if (node.nodeType === 1) { // ELEMENT_NODE (e.g. <em>)
                var wrapper = node.cloneNode(false);
                var text = node.textContent;
                for (var i = 0; i < text.length; i++) {
                    if (text[i] === ' ') {
                        wrapper.appendChild(document.createTextNode(' '));
                    } else {
                        var span = document.createElement('span');
                        span.className = 'promo__heading-char';
                        span.textContent = text[i];
                        wrapper.appendChild(span);
                        chars.push(span);
                    }
                }
                inner.appendChild(wrapper);
            }
        });

        el.textContent = '';
        el.appendChild(inner);

        gsap.fromTo(chars,
            { opacity: 0, y: 12, filter: 'blur(4px)' },
            {
                opacity: 1,
                y: 0,
                filter: 'blur(0px)',
                duration: 0.45,
                stagger: 0.035,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: el,
                    start: 'top 95%',
                    toggleActions: 'play none none none'
                }
            }
        );
    });

    // -------------------------------------------------------------------------
    // NEWSPAPER EDITORIAL SECTION ANIMATIONS
    // -------------------------------------------------------------------------

    // A2. App Screenshot Zoom-Out Pop-Up (Slower, gradual zoom over long scroll distance)
    var screenshot = document.querySelector('.promo__screenshot');
    if (screenshot) {
        gsap.fromTo(screenshot,
            { scale: 0.65, opacity: 0.6, transformOrigin: '50% 50%' },
            {
                scale: 1,
                opacity: 1,
                ease: 'power1.out',
                scrollTrigger: {
                    trigger: screenshot,
                    start: 'top 95%',
                    end: 'top 15%',
                    scrub: 1.5
                }
            }
        );
    }

    // B. Horizontal & Vertical Rule Line Drawing Effect
    document.querySelectorAll('.editorial__rule').forEach(function (rule) {
        gsap.fromTo(rule,
            { scaleX: 0, transformOrigin: 'left center', opacity: 0 },
            {
                scaleX: 1,
                opacity: 1,
                duration: 1.1,
                ease: 'power3.inOut',
                scrollTrigger: {
                    trigger: rule,
                    start: 'top 92%',
                    toggleActions: 'play none none none'
                }
            }
        );
    });

    var colDivider = document.querySelector('.editorial__col-divider');
    if (colDivider) {
        gsap.fromTo(colDivider,
            { scaleY: 0, transformOrigin: 'top center', opacity: 0 },
            {
                scaleY: 1,
                opacity: 1,
                duration: 1.3,
                ease: 'power3.inOut',
                scrollTrigger: {
                    trigger: colDivider,
                    start: 'top 90%',
                    toggleActions: 'play none none none'
                }
            }
        );
    }

    // C. Generic Character Stagger Helper for Editorial Headlines
    function animateTextReveal(selector, startTrigger, staggerDelay) {
        document.querySelectorAll(selector).forEach(function (el) {
            var plainText = el.textContent;
            el.setAttribute('aria-label', plainText);

            var inner = document.createElement('span');
            inner.setAttribute('aria-hidden', 'true');
            var chars = [];

            Array.from(el.childNodes).forEach(function (node) {
                if (node.nodeType === 3) {
                    var text = node.textContent;
                    for (var i = 0; i < text.length; i++) {
                        if (text[i] === ' ') {
                            inner.appendChild(document.createTextNode(' '));
                        } else {
                            var span = document.createElement('span');
                            span.style.display = 'inline-block';
                            span.textContent = text[i];
                            inner.appendChild(span);
                            chars.push(span);
                        }
                    }
                } else if (node.nodeType === 1) {
                    var wrapper = node.cloneNode(false);
                    var text = node.textContent;
                    for (var i = 0; i < text.length; i++) {
                        if (text[i] === ' ') {
                            wrapper.appendChild(document.createTextNode(' '));
                        } else {
                            var span = document.createElement('span');
                            span.style.display = 'inline-block';
                            span.textContent = text[i];
                            wrapper.appendChild(span);
                            chars.push(span);
                        }
                    }
                    inner.appendChild(wrapper);
                }
            });

            el.textContent = '';
            el.appendChild(inner);

            gsap.fromTo(chars,
                { opacity: 0, y: 30, filter: 'blur(6px)' },
                {
                    opacity: 1,
                    y: 0,
                    filter: 'blur(0px)',
                    duration: 0.5,
                    stagger: staggerDelay || 0.025,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: el,
                        start: startTrigger || 'top 92%',
                        toggleActions: 'play none none none'
                    }
                }
            );
        });
    }

    animateTextReveal('.editorial__headline1', 'top 92%', 0.02);
    animateTextReveal('.editorial__headline2', 'top 92%', 0.02);
    animateTextReveal('.editorial__col-heading--left', 'top 94%', 0.03);
    animateTextReveal('.editorial__col-heading--right', 'top 94%', 0.03);
    animateTextReveal('.editorial__thing-heading', 'top 94%', 0.03);
    animateTextReveal('.editorial__noads', 'top 92%', 0.025);

    // D. Paragraph Lift & Fade-In
    var paras = [
        '.editorial__left-para1',
        '.editorial__right-para1',
        '.editorial__left-para2',
        '.editorial__quote-attr'
    ];

    paras.forEach(function (sel) {
        var el = document.querySelector(sel);
        if (el) {
            gsap.fromTo(el,
                { opacity: 0, y: 35 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.9,
                    ease: 'power2.out',
                    scrollTrigger: {
                        trigger: el,
                        start: 'top 90%',
                        toggleActions: 'play none none none'
                    }
                }
            );
        }
    });

    // E. Editorial Quote Pop & Scale Reveal
    var quote = document.querySelector('.editorial__quote');
    if (quote) {
        gsap.fromTo(quote,
            { opacity: 0, scale: 0.92, y: 25, filter: 'blur(8px)' },
            {
                opacity: 1,
                scale: 1,
                y: 0,
                filter: 'blur(0px)',
                duration: 1.0,
                ease: 'back.out(1.4)',
                scrollTrigger: {
                    trigger: quote,
                    start: 'top 88%',
                    toggleActions: 'play none none none'
                }
            }
        );
    }

    // F. Hermes-Style Editorial Photo Blur-to-Sharp Unblur Reveal
    var photo = document.querySelector('.editorial__photo');
    if (photo) {
        gsap.fromTo(photo,
            {
                opacity: 0,
                scale: 0.82,
                y: 40,
                filter: 'blur(14px)'
            },
            {
                opacity: 1,
                scale: 1,
                y: 0,
                filter: 'blur(0px)',
                duration: 1.2,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: photo,
                    start: 'top 90%',
                    toggleActions: 'play none none none'
                }
            }
        );
    }

    // G. Editorial Footer Row Items Stagger
    document.querySelectorAll('.editorial__footer span').forEach(function (item, idx) {
        gsap.fromTo(item,
            { opacity: 0, y: 20 },
            {
                opacity: 1,
                y: 0,
                duration: 0.6,
                delay: idx * 0.15,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: '.editorial__footer',
                    start: 'top 95%',
                    toggleActions: 'play none none none'
                }
            }
        );
    });
    // H. Hermes-Style Curtain Reveal — newspaper lifts, contact fades in behind
    var contactFooter = document.getElementById('contactFooter');
    if (contactFooter) {
        var lastOpacity = -1;

        // Slow, gradual fade tied to newspaper exit.
        // Starts when remaining < 60% of viewport (newspaper mostly gone).
        // Takes the full 60% of viewport scrolling to reach full opacity.
        function updateContactReveal(scrollY) {
            var h = window.innerHeight;
            var maxScroll = Math.max(1, document.documentElement.scrollHeight - h);
            var remaining = maxScroll - scrollY;

            // Fade spans 60% of viewport height — with 60px tolerance so Windows scrollbars allow full 100% lift
            var opacity = Math.max(0, Math.min(1, (0.60 * h - (remaining - 60)) / (0.60 * h)));

            if (opacity !== lastOpacity) {
                lastOpacity = opacity;
                contactFooter.style.setProperty('--contact-opacity', opacity);
                contactFooter.style.setProperty('--contact-pe', opacity > 0.95 ? 'auto' : 'none');
            }
        }

        // Hook into Lenis scroll
        lenis.on('scroll', function () {
            updateContactReveal(lenis.scroll);
        });

        // Initial check
        updateContactReveal(window.scrollY);
    }

})();

// =========================================================================
// =========================================================================
// 3. FIREBASE GOOGLE AUTHENTICATION FLOW
// =========================================================================
window.firebaseAuthInitialized = true;

function initAuthUI() {
    const loginBtn = document.getElementById('loginBtn') || document.querySelector('.hero__button');
    const loginBtnText = document.getElementById('loginBtnText') || document.querySelector('.hero__button-text');
    let isRedirecting = false;

    // Toast Notification for Error/Success Messages
    function showAuthToast(message, isSuccess = false) {
        const existing = document.querySelector('.auth-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `auth-toast ${isSuccess ? 'auth-toast--success' : ''}`;
        toast.innerHTML = `
            <span style="font-size: 1.2rem;">${isSuccess ? '✓' : '⚠️'}</span>
            <div>${message}</div>
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 400);
        }, 5000);
    }

    // Set Button Loading State
    function setLoading(isLoading, customText = 'Signing in...') {
        if (!loginBtn) return;
        if (isLoading) {
            loginBtn.classList.add('loading');
            loginBtn.disabled = true;
            if (loginBtnText) {
                loginBtnText.innerHTML = `<span class="hero__cta-spinner"></span>${customText}`;
            }
        } else {
            loginBtn.classList.remove('loading');
            loginBtn.disabled = false;
            if (loginBtnText) {
                loginBtnText.textContent = 'Sign In';
            }
        }
    }

    // Auto-detect existing logged-in session (Requirement #3)
    const justLoggedOut = window.location.search.includes('logout=true') || sessionStorage.getItem('justLoggedOut') === 'true';
    try {
        listenToAuthState((user) => {
            if (user && !isRedirecting && !justLoggedOut) {
                isRedirecting = true;
                console.log("[Landing] Active session detected for:", user.email);
                setLoading(true, 'Redirecting...');

                setTimeout(() => {
                    if (!window.location.pathname.endsWith('editor.html') && !window.location.href.includes('editor.html')) {
                        window.location.href = 'editor.html';
                    }
                }, 300);
            }
        });
    } catch (err) {
        console.warn("[Landing] Auth state listener warning:", err);
    }

    // Login Action Handler
    let isAuthenticating = false;
    async function handleLoginAction(e) {
        if (e) e.preventDefault();
        if (isRedirecting || isAuthenticating) return;

        sessionStorage.removeItem('justLoggedOut');
        sessionStorage.removeItem('demoMode');
        isAuthenticating = true;
        setLoading(true, 'Signing in...');

        const response = await signInWithGoogle();
        isAuthenticating = false;

        if (response.success) {
            isRedirecting = true;
            setLoading(true, 'Redirecting...');
            window.location.href = 'editor.html';
        } else if (response.redirecting) {
            setLoading(true, 'Redirecting...');
        } else if (response.isUnconfigured) {
            showAuthToast("Firebase credentials required! Add your Firebase details in firebase/firebase-config.js. Entering Preview Mode...", false);
            setLoading(true, 'Preview Mode...');
            setTimeout(() => {
                window.location.href = 'editor.html';
            }, 1800);
        } else {
            setLoading(false);
            showAuthToast(response.error, false);
        }
    }

    if (loginBtn && loginBtnText) {
        loginBtn.addEventListener('click', handleLoginAction);
    }

    // Expose globally for inline onclick fallback
    window.triggerGoogleLogin = handleLoginAction;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthUI);
} else {
    initAuthUI();
}
