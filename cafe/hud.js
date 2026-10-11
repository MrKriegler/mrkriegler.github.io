/**
 * Iron Pig Café - the HTML layer on top of the 3D view.
 *
 * Exit and contact are always on screen, everything is a real button, and
 * anything the 3D world says is mirrored into a polite live region.
 */

function el(tag, className, attrs = {}, children = []) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else node.setAttribute(k, v);
    });
    children.forEach(c => c && node.appendChild(c));
    return node;
}

export class Hud {
    constructor({ onExit, onContact, onGuide, onTourNext, onTourEnd, onJump, onTrophies, onHelp, places }) {
        this.root = el('div', 'cafe-hud', { 'aria-label': 'Iron Pig café controls' });

        // Top left: where you are and how you're doing
        this.beansEl = el('span', 'cafe-chip__value', { text: '0/4' });
        this.trophyEl = el('span', 'cafe-chip__value', { text: '0' });
        const brand = el('div', 'cafe-brand', {}, [
            el('span', 'cafe-brand__name', { text: 'Iron Pig Café' }),
            el('span', 'cafe-brand__sub', { text: 'Kitchen Table HQ · est. 2025' })
        ]);
        const beans = el('div', 'cafe-chip', { title: 'Coffee beans found' }, [el('span', 'cafe-bean-icon', { 'aria-hidden': 'true' }), el('span', 'visually-hidden', { text: 'Beans found: ' }), this.beansEl]);
        const trophies = el('button', 'cafe-chip cafe-chip--button', { type: 'button', title: 'Achievements' }, [el('span', '', { text: '🏆', 'aria-hidden': 'true' }), el('span', 'visually-hidden', { text: 'Achievements: ' }), this.trophyEl]);
        trophies.addEventListener('click', onTrophies);
        this.root.appendChild(el('div', 'cafe-hud__tl', {}, [brand, el('div', 'cafe-chips', {}, [beans, trophies])]));

        // Top right: the two things that must always be one click away
        const contact = el('button', 'cafe-btn cafe-btn--accent', { type: 'button', text: 'Let\'s talk' });
        contact.addEventListener('click', onContact);
        this.exitBtn = el('button', 'cafe-btn', { type: 'button', 'aria-label': 'Exit the café and return to the 2D page' }, [el('span', '', { text: 'Exit' }), el('span', 'cafe-btn__x', { text: '✕', 'aria-hidden': 'true' })]);
        this.exitBtn.addEventListener('click', onExit);
        this.root.appendChild(el('div', 'cafe-hud__tr', {}, [contact, this.exitBtn]));

        // Bottom left: how to play
        const touch = window.matchMedia('(pointer: coarse)').matches;
        this.hint = el('div', 'cafe-hint', {
            html: touch
                ? '<strong>Drag</strong> to look · <strong>left thumb</strong> to walk · <strong>tap</strong> anything'
                : '<strong>Drag</strong> to look · <strong>WASD</strong> to walk · <strong>arrows</strong> to look · <strong>Space</strong> to jump · <strong>click</strong> anything · <strong>E</strong> to use'
        });
        const help = el('button', 'cafe-icon-btn', { type: 'button', 'aria-label': 'How to play', text: '?' });
        help.addEventListener('click', onHelp);
        this.root.appendChild(el('div', 'cafe-hud__bl', {}, [help, this.hint]));

        // Bottom right: Pebbles' tour and the jump menu
        const guide = el('button', 'cafe-btn cafe-btn--ghost', { type: 'button' }, [el('span', '', { text: '🐾', 'aria-hidden': 'true' }), el('span', '', { text: 'Follow Pebbles' })]);
        guide.addEventListener('click', onGuide);
        this.guideBtn = guide;
        this.jumpBtn = el('button', 'cafe-btn cafe-btn--ghost', { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'cafe-jump' }, [el('span', '', { text: 'Jump to' }), el('span', '', { text: '▴', 'aria-hidden': 'true' })]);
        this.jumpMenu = el('div', 'cafe-jump', { id: 'cafe-jump', role: 'menu', hidden: '' });
        places.forEach(place => {
            const item = el('button', 'cafe-jump__item', { type: 'button', role: 'menuitem', 'data-id': place.id }, [
                el('span', 'cafe-jump__icon', { text: place.icon, 'aria-hidden': 'true' }),
                el('span', '', { text: place.label })
            ]);
            item.addEventListener('click', () => { this.toggleJump(false); onJump(place.id); });
            this.jumpMenu.appendChild(item);
        });
        this.jumpBtn.addEventListener('click', () => this.toggleJump());
        // Whatever you're carrying (the Holy Hand Grenade, so far)
        this.itemBtn = el('button', 'cafe-btn cafe-btn--accent cafe-item', { type: 'button', hidden: '' });
        this.itemBtn.addEventListener('click', () => this.onUseItem && this.onUseItem());
        this.root.appendChild(el('div', 'cafe-hud__br', {}, [this.itemBtn, guide, el('div', 'cafe-jump-wrap', {}, [this.jumpMenu, this.jumpBtn])]));

        // Centre prompt for keyboard / gaze interaction
        this.prompt = el('div', 'cafe-prompt', { 'aria-hidden': 'true' });
        this.root.appendChild(this.prompt);

        // Floating label that follows the mouse over things
        this.tooltip = el('div', 'cafe-tooltip', { 'aria-hidden': 'true' });
        this.root.appendChild(this.tooltip);

        // Speech bubbles projected from 3D
        this.bubbleLayer = el('div', 'cafe-bubbles', { 'aria-hidden': 'true' });
        this.root.appendChild(this.bubbleLayer);
        this.bubbles = new Map();

        // Subtitles: whoever is talking off-screen still gets heard
        this.subtitle = el('div', 'cafe-subtitle', { 'aria-hidden': 'true' }, [
            el('span', 'cafe-subtitle__who'), el('span', 'cafe-subtitle__text')
        ]);
        this.root.appendChild(this.subtitle);

        // Tour progress bar
        this.tourTitle = el('span', 'cafe-tour__title');
        this.tourStep = el('span', 'cafe-tour__step');
        const next = el('button', 'cafe-btn cafe-btn--small cafe-btn--accent', { type: 'button', text: 'Next ›' });
        this.tourNext = next;
        next.addEventListener('click', onTourNext);
        const end = el('button', 'cafe-btn cafe-btn--small cafe-btn--ghost', { type: 'button', text: 'End tour' });
        end.addEventListener('click', onTourEnd);
        this.tourBar = el('div', 'cafe-tour', { role: 'group', 'aria-label': 'Guided tour', hidden: '' }, [
            el('span', 'cafe-tour__paw', { text: '🐾', 'aria-hidden': 'true' }),
            el('div', 'cafe-tour__info', {}, [this.tourStep, this.tourTitle]),
            next, end
        ]);
        this.root.appendChild(this.tourBar);

        this.toasts = el('div', 'cafe-toasts', { 'aria-hidden': 'true' });
        this.root.appendChild(this.toasts);
        this.live = el('div', 'visually-hidden', { role: 'status', 'aria-live': 'polite' });
        this.root.appendChild(this.live);

        // Dialog for boards, the order form, trophies
        this.panel = el('div', 'cafe-panel', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'cafe-panel-title', hidden: '' });
        this.panelTitle = el('h2', 'cafe-panel__title', { id: 'cafe-panel-title' });
        this.panelBody = el('div', 'cafe-panel__body');
        const close = el('button', 'cafe-panel__close', { type: 'button', 'aria-label': 'Close', text: '✕' });
        close.addEventListener('click', () => this.closePanel());
        this.panel.appendChild(el('div', 'cafe-panel__card', {}, [close, this.panelTitle, this.panelBody]));
        this.panel.addEventListener('click', e => { if (e.target === this.panel) this.closePanel(); });
        this.panel.addEventListener('keydown', e => this.trapFocus(e));
        this.root.appendChild(this.panel);

        document.body.appendChild(this.root);
        this.hintTimer = setTimeout(() => this.hint.classList.add('is-faded'), 12000);
        requestAnimationFrame(() => this.root.classList.add('is-visible'));
    }

    /**
     * The controls card: keycaps on desktop, gestures on touch. Closes on
     * "Let's go", Escape, or as soon as they start moving.
     */
    showControls(onClose) {
        this.hideControls(true);
        const touch = window.matchMedia('(pointer: coarse)').matches;
        const key = (...caps) => el('span', 'cafe-keys', {}, caps.map(c => el('kbd', '', { text: c })));
        const row = (keys, label) => el('li', 'cafe-controls__row', {}, [keys, el('span', 'cafe-controls__label', { text: label })]);
        const wasd = el('span', 'cafe-keys cafe-keys--wasd', {}, ['W', 'A', 'S', 'D'].map(c => el('kbd', '', { text: c })));
        const arrows = el('span', 'cafe-keys cafe-keys--wasd', {}, ['↑', '←', '↓', '→'].map(c => el('kbd', '', { text: c })));
        const gesture = (icon, text) => el('span', 'cafe-gesture', { text: icon, 'aria-label': text });
        const rows = touch ? [
            row(gesture('👆', 'Drag'), 'Drag anywhere to look around'),
            row(gesture('🕹️', 'Left thumb'), 'Hold the left side of the screen to walk'),
            row(gesture('✨', 'Tap'), 'Tap boards, the till, the machine… anything'),
            row(gesture('🐾', 'Follow'), '“Follow Pebbles” for a guided tour')
        ] : [
            row(wasd, 'Walk  ·  Shift to hurry'),
            row(arrows, 'Look around (or drag with the mouse)'),
            row(key('Space'), 'Jump'),
            row(key('E'), 'Use whatever you\'re looking at (or just click it)'),
            row(key('Esc'), 'Close a panel, or leave the café')
        ];
        const go = el('button', 'cafe-btn cafe-btn--accent', { type: 'button', text: 'Let\'s go ☕' });
        this.controls = el('div', 'cafe-controls', { role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'cafe-controls-title' }, [
            el('h2', 'cafe-controls__title', { id: 'cafe-controls-title', text: 'Getting around' }),
            el('ul', 'cafe-controls__list', {}, rows),
            el('p', 'cafe-controls__tip', { text: 'Four coffee beans are hidden somewhere. Pebbles knows where.' }),
            go
        ]);
        this.onControlsClose = onClose;
        go.addEventListener('click', () => this.hideControls());
        this.root.appendChild(this.controls);
        this.hint.classList.add('is-faded');
        requestAnimationFrame(() => {
            this.controls.classList.add('is-visible');
            go.focus({ preventScroll: true });
        });
    }

    hideControls(silent = false) {
        if (!this.controls) return false;
        const node = this.controls;
        this.controls = null;
        node.classList.remove('is-visible');
        setTimeout(() => node.remove(), 300);
        if (!silent && this.onControlsClose) this.onControlsClose();
        return true;
    }

    toggleJump(force) {
        const open = force ?? this.jumpMenu.hidden;
        this.jumpMenu.hidden = !open;
        this.jumpBtn.setAttribute('aria-expanded', String(open));
        if (open) this.jumpMenu.querySelector('button')?.focus();
    }

    setJumpVisited(id) {
        const item = this.jumpMenu.querySelector(`[data-id="${id}"]`);
        if (item) item.classList.add('is-visited');
    }

    setHolding(label, onUse) {
        this.itemBtn.hidden = !label;
        this.itemBtn.textContent = label || '';
        this.onUseItem = label ? onUse : null;
    }

    setBeans(found, total) {
        this.beansEl.textContent = `${found}/${total}`;
        this.beansEl.parentElement.classList.toggle('is-complete', found === total);
    }

    setTrophies(count, total) {
        this.trophyEl.textContent = `${count}/${total}`;
    }

    announce(text) {
        this.live.textContent = '';
        setTimeout(() => { this.live.textContent = text; }, 30);
    }

    toast(title, text, icon = '🏆') {
        const node = el('div', 'cafe-toast', {}, [
            el('span', 'cafe-toast__icon', { text: icon }),
            el('div', '', {}, [el('div', 'cafe-toast__title', { text: title }), el('div', 'cafe-toast__text', { text })])
        ]);
        this.toasts.appendChild(node);
        requestAnimationFrame(() => node.classList.add('is-in'));
        setTimeout(() => { node.classList.remove('is-in'); setTimeout(() => node.remove(), 500); }, 4200);
        this.announce(`${title}. ${text}`);
    }

    showPrompt(text) {
        if (!text) {
            this.prompt.classList.remove('is-visible');
            return;
        }
        this.prompt.innerHTML = '';
        this.prompt.append(el('kbd', '', { text: 'E' }), el('span', '', { text }));
        this.prompt.classList.add('is-visible');
    }

    showTooltip(text, x, y) {
        if (!text) {
            this.tooltip.classList.remove('is-visible');
            return;
        }
        this.tooltip.textContent = text;
        this.tooltip.style.transform = `translate(${x + 16}px, ${y + 18}px)`;
        this.tooltip.classList.add('is-visible');
    }

    showTour(step, total, title) {
        this.tourBar.hidden = false;
        this.tourStepText = `Tour ${step}/${total}`;
        this.tourStep.textContent = this.tourStepText;
        this.tourTitle.textContent = title;
        this.guideBtn.hidden = true;
        this.announce(`Tour stop ${step} of ${total}: ${title}`);
    }

    setTourPaused(paused) {
        this.tourBar.classList.toggle('is-paused', paused);
        this.tourStep.textContent = paused ? `Paused · ${this.tourStepText}` : this.tourStepText;
        this.tourNext.textContent = paused ? 'Continue ›' : 'Next ›';
        if (paused) this.announce('Tour paused. Press Continue to carry on.');
    }

    hideTour() {
        this.tourBar.classList.remove('is-paused');
        this.tourBar.hidden = true;
        this.guideBtn.hidden = false;
    }

    /**
     * Say something from a 3D point; position updated each frame.
     * Returns how long it stays up (long enough to read).
     */
    say(key, text, ms) {
        ms = ms || Math.max(2400, 1200 + text.length * 55);
        let b = this.bubbles.get(key);
        if (!b) {
            b = { node: el('div', `cafe-bubble cafe-bubble--${key}`), timer: null };
            this.bubbleLayer.appendChild(b.node);
            this.bubbles.set(key, b);
        }
        b.node.textContent = text;
        b.text = text;
        b.node.classList.add('is-visible');
        b.speaking = true;
        clearTimeout(b.timer);
        b.timer = setTimeout(() => {
            b.node.classList.remove('is-visible');
            b.speaking = false;
            if (this.subtitleKey === key) this.hideSubtitle();
        }, ms);
        this.announce(text);
        return ms;
    }

    placeBubble(key, x, y, onScreen) {
        const b = this.bubbles.get(key);
        if (!b) return;
        b.node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        b.node.classList.toggle('is-offscreen', !onScreen);
        // Off-screen speech becomes a subtitle
        if (b.speaking && !onScreen) this.showSubtitle(key, b.text);
        else if (this.subtitleKey === key) this.hideSubtitle();
    }

    showSubtitle(key, text) {
        if (this.subtitleKey === key && this.subtitle.lastChild.textContent === text) return;
        const names = { corgi: 'Pebbles', plant: 'The counter plant', machine: 'Espresso machine', shrubbery: 'The Knights Who Say Ni', knight: 'The Black Knight', parrot: 'The Norwegian Blue' };
        this.subtitleKey = key;
        this.subtitle.firstChild.textContent = names[key] || '';
        this.subtitle.lastChild.textContent = text;
        this.subtitle.classList.add('is-visible');
    }

    hideSubtitle() {
        this.subtitleKey = null;
        this.subtitle.classList.remove('is-visible');
    }

    openPanel(title, body, { wide = false } = {}) {
        this.lastFocus = document.activeElement;
        this.panelTitle.textContent = title;
        this.panelBody.innerHTML = '';
        if (typeof body === 'string') this.panelBody.innerHTML = body;
        else this.panelBody.appendChild(body);
        this.panel.classList.toggle('cafe-panel--wide', wide);
        this.panel.hidden = false;
        requestAnimationFrame(() => {
            this.panel.classList.add('is-open');
            const focusable = this.panel.querySelector('.cafe-panel__body a, .cafe-panel__body button, .cafe-panel__body input') || this.panel.querySelector('.cafe-panel__close');
            focusable.focus({ preventScroll: true });
        });
        this.onPanelClose = null;
    }

    closePanel() {
        if (this.panel.hidden) return false;
        this.panel.classList.remove('is-open');
        this.panel.hidden = true;
        if (this.onPanelClose) this.onPanelClose();
        if (this.lastFocus && document.contains(this.lastFocus)) this.lastFocus.focus({ preventScroll: true });
        return true;
    }

    isPanelOpen() {
        return !this.panel.hidden;
    }

    trapFocus(e) {
        if (e.key !== 'Tab') return;
        const items = [...this.panel.querySelectorAll('a[href], button, input, textarea, [tabindex]:not([tabindex="-1"])')].filter(n => !n.disabled && n.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    hide() {
        this.root.classList.remove('is-visible');
    }

    dispose() {
        clearTimeout(this.hintTimer);
        if (this.controls) this.controls.remove();
        this.bubbles.forEach(b => clearTimeout(b.timer));
        this.root.remove();
    }
}

export { el };
