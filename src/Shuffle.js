import { gsap } from 'gsap';

// Simple character splitting function (replacement for SplitText)
function splitText(element) {
    const text = element.textContent;
    const chars = [];

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === ' ') {
            chars.push(document.createTextNode(' '));
        } else {
            const span = document.createElement('span');
            span.className = 'shuffle-char';
            span.textContent = char;
            span.style.display = 'inline-block';
            chars.push(span);
        }
    }

    element.innerHTML = '';
    chars.forEach(char => element.appendChild(char));

    return {
        chars: element.querySelectorAll('.shuffle-char'),
        revert: () => {
            element.textContent = text;
        }
    };
}

export function initShuffle(element, options = {}) {
    const {
        shuffleDirection = 'right',
        duration = 0.35,
        ease = 'power3.out',
        shuffleTimes = 1,
        animationMode = 'evenodd',
        stagger = 0.03,
        scrambleCharset = '',
        colorFrom,
        colorTo,
        respectReducedMotion = true,
        onShuffleComplete,
        fontsLoaded = true
    } = options;

    if (!element || !fontsLoaded) return null;

    // Store original text
    const originalText = element.textContent;

    if (respectReducedMotion && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        onShuffleComplete?.();
        return null;
    }

    const wrappersRef = [];
    const tlRef = { current: null };
    const playingRef = { current: false };

    const rand = set => set.charAt(Math.floor(Math.random() * set.length)) || '';

    const teardown = () => {
        if (tlRef.current) {
            tlRef.current.kill();
            tlRef.current = null;
        }
        if (wrappersRef.length) {
            wrappersRef.forEach(wrap => {
                const inner = wrap.firstElementChild;
                const orig = inner?.querySelector('[data-orig="1"]');
                if (orig && wrap.parentNode) {
                    wrap.parentNode.replaceChild(orig, wrap);
                }
            });
            wrappersRef.length = 0;
        }
        playingRef.current = false;
    };

    const build = () => {
        teardown();

        const splitResult = splitText(element);
        const chars = Array.from(splitResult.chars);

        const rolls = Math.max(1, Math.floor(shuffleTimes));

        chars.forEach(ch => {
            if (!ch.parentElement) return;

            const w = ch.getBoundingClientRect().width;
            if (!w) return;

            const parent = ch.parentElement;
            const wrap = document.createElement('span');
            Object.assign(wrap.style, {
                display: 'inline-block',
                overflow: 'hidden',
                width: w + 'px',
                verticalAlign: 'baseline'
            });

            const inner = document.createElement('span');
            Object.assign(inner.style, {
                display: 'inline-block',
                whiteSpace: 'nowrap',
                willChange: 'transform'
            });

            parent.insertBefore(wrap, ch);
            wrap.appendChild(inner);

            const firstOrig = ch.cloneNode(true);
            Object.assign(firstOrig.style, {
                display: 'inline-block',
                width: w + 'px',
                textAlign: 'center'
            });
            ch.setAttribute('data-orig', '1');
            Object.assign(ch.style, {
                display: 'inline-block',
                width: w + 'px',
                textAlign: 'center'
            });

            inner.appendChild(firstOrig);

            for (let k = 0; k < rolls; k++) {
                const c = ch.cloneNode(true);
                if (scrambleCharset) {
                    c.textContent = rand(scrambleCharset);
                } else {
                    c.textContent = String.fromCharCode(33 + Math.floor(Math.random() * 94));
                }
                Object.assign(c.style, {
                    display: 'inline-block',
                    width: w + 'px',
                    textAlign: 'center'
                });
                inner.appendChild(c);
            }

            inner.appendChild(ch);

            const steps = rolls + 1;
            let startX = 0;
            let finalX = -steps * w;

            if (shuffleDirection === 'right') {
                const firstCopy = inner.firstElementChild;
                const real = inner.lastElementChild;
                if (real) inner.insertBefore(real, inner.firstChild);
                if (firstCopy) inner.appendChild(firstCopy);
                startX = -steps * w;
                finalX = 0;
            }

            gsap.set(inner, { x: startX, force3D: true });
            if (colorFrom) inner.style.color = colorFrom;
            inner.setAttribute('data-final-x', String(finalX));
            inner.setAttribute('data-start-x', String(startX));

            wrappersRef.push(wrap);
        });

        return splitResult;
    };

    const inners = () => wrappersRef.map(w => w.firstElementChild);

    const randomizeScrambles = () => {
        if (!scrambleCharset) return;
        wrappersRef.forEach(w => {
            const strip = w.firstElementChild;
            if (!strip) return;
            const kids = Array.from(strip.children);
            for (let i = 1; i < kids.length - 1; i++) {
                kids[i].textContent = scrambleCharset.charAt(
                    Math.floor(Math.random() * scrambleCharset.length)
                );
            }
        });
    };

    const cleanupToStill = () => {
        // Restore original text to the element
        element.textContent = originalText;
        element.innerHTML = originalText;

        // Remove all wrapper elements
        wrappersRef.forEach(w => {
            if (w.parentNode) {
                w.parentNode.removeChild(w);
            }
        });
        wrappersRef.length = 0;

        // Ensure element is visible and properly styled
        element.style.transform = 'none';
        element.style.willChange = 'auto';
        element.style.opacity = '1';
        element.style.visibility = 'visible';
    };

    const play = () => {
        const strips = inners();
        if (!strips.length) return;

        playingRef.current = true;

        const tl = gsap.timeline({
            smoothChildTiming: true,
            onComplete: () => {
                playingRef.current = false;
                cleanupToStill();
                if (colorTo) gsap.set(strips, { color: colorTo });
                onShuffleComplete?.();
            }
        });

        const addTween = (targets, at) => {
            tl.to(
                targets,
                {
                    x: (i, t) => parseFloat(t.getAttribute('data-final-x') || '0'),
                    duration,
                    ease,
                    force3D: true,
                    stagger: animationMode === 'evenodd' ? stagger : 0
                },
                at
            );
            if (colorFrom && colorTo) {
                tl.to(targets, { color: colorTo, duration, ease }, at);
            }
        };

        if (animationMode === 'evenodd') {
            const odd = strips.filter((_, i) => i % 2 === 1);
            const even = strips.filter((_, i) => i % 2 === 0);
            const oddTotal = duration + Math.max(0, odd.length - 1) * stagger;
            const evenStart = odd.length ? oddTotal * 0.7 : 0;
            if (odd.length) addTween(odd, 0);
            if (even.length) addTween(even, evenStart);
        } else {
            strips.forEach(strip => {
                tl.to(
                    strip,
                    {
                        x: parseFloat(strip.getAttribute('data-final-x') || '0'),
                        duration,
                        ease,
                        force3D: true
                    },
                    0
                );
                if (colorFrom && colorTo) {
                    tl.fromTo(
                        strip,
                        { color: colorFrom },
                        { color: colorTo, duration, ease },
                        0
                    );
                }
            });
        }

        tlRef.current = tl;
    };

    const create = () => {
        build();
        if (scrambleCharset) randomizeScrambles();
        play();
    };

    // Wait for fonts to load
    if ('fonts' in document) {
        if (document.fonts.status === 'loaded') {
            create();
        } else {
            document.fonts.ready.then(() => {
                create();
            });
        }
    } else {
        create();
    }

    return {
        play,
        teardown,
        rebuild: () => {
            teardown();
            create();
        }
    };
}
