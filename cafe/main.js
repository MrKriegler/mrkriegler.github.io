/**
 * Iron Pig Café - step inside.
 *
 * Loaded only when someone clicks "Step inside" on the 2D page. Builds the
 * café from the page's own layout and text, unfolds it with a dolly zoom
 * that starts pixel-aligned with the flat illustration, and tears
 * everything down again on the way out.
 */
import * as THREE from '../vendor/three/three.r186.min.js';
import { buildWorld, PX } from './world.js';
import { Player, easeInOutCubic } from './controls.js';
import { Hud, el } from './hud.js';
import { loadImage } from './textures.js';
import { disposeMaterialCache, outlineMaterial, highlightMaterial } from './kit.js';

const DESKTOP_QUERY = '(width >= 769px) and (height >= 561px) and (orientation: landscape), (width >= 1101px) and (height >= 561px)';
const STORAGE_KEY = 'ironpig-cafe-v1';
const EMAIL = 'hello@iron-pig.com';
const INTRO_SECONDS = 2.8;
const OUTRO_SECONDS = 2.0;
const START_DISTANCE = 90;
// Looking slightly down, so Pebbles and her welcome are in the opening shot
const HOME = { pos: new THREE.Vector3(0, 1.6, 5.6), look: new THREE.Vector3(0, 0.85, 0) };
const FINAL_FOV = 62;

/** Portrait phones see more of the room through a wider lens */
function playFov() {
    const aspect = window.innerWidth / window.innerHeight;
    if (aspect >= 1) return FINAL_FOV;
    return FINAL_FOV + THREE.MathUtils.clamp((1 - aspect) / 0.55, 0, 1) * 23;
}

const ACHIEVEMENTS = [
    { id: 'welcome', icon: '☕', title: 'Step inside', text: 'Welcome to the Iron Pig café.' },
    { id: 'menu', icon: '📋', title: 'Read the menu', text: 'Read all four chalkboards.' },
    { id: 'barista', icon: '♨️', title: 'Barista', text: 'Pulled a shot on the big machine.' },
    { id: 'order', icon: '🧾', title: 'Order up!', text: 'Placed a coffee order.' },
    { id: 'goodboy', icon: '🐾', title: 'Good girl', text: 'Gave Pebbles, Head of Morale, a pat.' },
    { id: 'ni', icon: '🌿', title: 'Ni!', text: 'Appeased the Knights Who Say Ni.' },
    { id: 'beans', icon: '☕', title: 'Bean counter', text: 'Found all four coffee beans.' },
    { id: 'hq', icon: '🍳', title: 'Kitchen Table HQ', text: 'Found the real headquarters.' },
    { id: 'night', icon: '💡', title: 'Lights on', text: 'Found the light switch by the door.' },
    { id: 'neon', icon: '💡', title: 'Neon dreams', text: 'Changed the colour of the sign.' },
    { id: 'gallery', icon: '🖼️', title: 'Art lover', text: 'Looked at every piece of work on the walls.' },
    { id: 'grenade', icon: '💥', title: 'Three shall be the number', text: 'Lobbed the Holy Hand Grenade at the Black Knight.' },
    { id: 'parrot', icon: '🦜', title: 'Ex-parrot', text: 'Got Pebbles to admit the truth about the Norwegian Blue.' },
    { id: 'argument', icon: '🗣️', title: 'Five minutes, £1', text: 'Had an argument. Well, a contradiction.' },
    { id: 'inquisition', icon: '🟥', title: 'Nobody expects…', text: 'Flicked the lights until the Inquisition turned up.' },
    { id: 'silly', icon: '🎩', title: 'Ministry approved', text: 'Hopped about until the Ministry of Silly Walks noticed.' },
    { id: 'tap', icon: '🚰', title: 'Water works', text: 'Ran the kitchen tap.' }
];

const PLACES = [
    { id: 'services', icon: '📋', label: 'Services menu' },
    { id: 'help', icon: '🛠️', label: 'How I help' },
    { id: 'builds', icon: '🚀', label: 'Recent builds' },
    { id: 'art-six', icon: '🖼️', label: 'The gallery' },
    { id: 'contact', icon: '✉️', label: 'Let\'s talk' },
    { id: 'order', icon: '🧾', label: 'Order a coffee' },
    { id: 'machine', icon: '♨️', label: 'Espresso machine' },
    { id: 'plant', icon: '🌿', label: 'The shrubbery' },
    { id: 'neon', icon: '💡', label: 'Neon sign' },
    { id: 'laptop', icon: '💻', label: 'Kitchen Table HQ' },
    { id: 'fridge', icon: '📝', label: 'Notes on the fridge' },
    { id: 'parrot', icon: '🦜', label: 'The Norwegian Blue' },
    { id: 'argument', icon: '🗣️', label: 'Argument Clinic' },
    { id: 'switch', icon: '💡', label: 'Light switch' },
    { id: 'exit', icon: '🚪', label: 'Exit to 2D' }
];

// Pebbles' guided tour: where she goes and what she says when she gets there.
// Stops near a hidden bean add a nudge, but only while that bean is still out there.
const TOUR = [
    { id: 'services', title: 'The menu', line: 'This is the menu. More cups means a bigger job. Fire drills are three cups, obviously.', bean: 'bean-menu', nudge: 'Psst: look up. Right on top of this board. 👀' },
    { id: 'help', title: 'How I help', line: 'Build, fix, lead. That\'s the whole job. Mostly fixing, if I\'m honest.' },
    { id: 'builds', title: 'Recent builds', line: 'Real things, actually shipped. The Guinness one was very important research.', bean: 'bean-table', nudge: 'Also, have a sniff under that table. Just saying. 👀' },
    { id: 'art-six', title: 'The gallery', line: 'And now for something completely different: the bigger work. SIX, Merlin\'s guest ledger, Throughline. Click any frame for the story.' },
    { id: 'machine', title: 'The machine', line: 'The espresso machine. Give it a poke, it hisses.', bean: 'bean-counter', nudge: 'Somebody dropped a bean behind the counter. Wasn\'t me.' },
    { id: 'order', title: 'The till', line: 'Order a coffee here and it turns into a project brief.' },
    { id: 'plant', title: 'The shrubbery', line: 'This plant only talks to the Knights Who Say Ni. Try typing N-I.' },
    { id: 'laptop', title: 'Kitchen Table HQ', line: 'Welcome to HQ. Yes, it\'s a kitchen table.', bean: 'bean-bed', nudge: 'That\'s my bed by the wall. Might be something in it. 🐾' },
    { id: 'fridge', title: 'The fridge', line: 'The fridge has the real rules. Docs live in YOUR repo, so nothing ever goes missing.' },
    { id: 'contact', title: 'Let\'s talk', line: 'That\'s the tour! Want to talk? The email\'s right here. I\'ll be by the door, wagging.' }
];
const BARKS = ['Woof!', 'Bork bork!', '*happy tail wag*', 'Arf!', '🐾 Pebbles, Head of Morale'];
const NI = ['Ni!', 'Ni! Ni!', 'We are the Knights Who Say... Ni!', 'We want... a shrubbery!', 'One that looks nice. And not too expensive.'];
// The Black Knight: guarding, then (after the grenade) gamely carrying on
const KNIGHT_GUARD = ['None shall pass.', 'None shall pass!', 'I move for no barista.', 'Have at you!', 'Your shrubbery is safe with me. Nobody else\'s is.'];
const KNIGHT_BEATEN = ['\'Tis but a scratch.', 'It\'s just a flesh wound.', 'Come back! I\'ll nibble your ankles!', 'All right, we\'ll call it a draw.'];
// The Norwegian Blue: Pebbles does the shop-keeping, badly
const PARROT = [
    ['parrot', '…'],
    ['corgi', 'Lovely plumage, the Norwegian Blue 🐾'],
    ['corgi', 'It\'s not dead. It\'s resting.'],
    ['corgi', 'Pining for the fjords, probably.'],
    ['parrot', '…'],
    ['corgi', 'Fine. It\'s an ex-parrot. Please don\'t tell the fridge. 🐾']
];
// Argument Clinic, Room 12A: you pick a line, the clinic disagrees with it
const ARGUMENT = [
    ['Is this the right room for an argument?', 'I\'ve told you once.'],
    ['No you haven\'t.', 'Yes I have.'],
    ['When?', 'Just now.'],
    ['That\'s not an argument, that\'s just contradiction.', 'No it isn\'t.'],
    ['An argument is reasons, leading somewhere.', 'Is it?'],
    ['Yes!', 'No.'],
    ['This is pointless.', 'Ah, I\'m afraid that\'s your five minutes.'],
    ['That was never five minutes!', 'Agreed. Disagreed. Whichever costs more.'],
    ['I want to complain.', 'Complaints are next door. For a conversation that actually goes somewhere, try hello@iron-pig.com.']
];

let session = null;

export function isCafeOpen() {
    return !!session;
}

export async function enterCafe(options = {}) {
    if (session) return;
    session = new CafeSession(options);
    try {
        await session.start();
    } catch (error) {
        session.destroy();
        session = null;
        throw error;
    }
}

/** For poking at the café from the console */
export function cafeSession() {
    return session;
}

export function exitCafe() {
    if (session) session.exit();
}

function readStorage() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
        return {};
    }
}

function writeStorage(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* private mode: progress just isn't kept */ }
}

function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise(resolve => setTimeout(resolve, ms))]);
}

class CafeSession {
    constructor({ fromDeepLink = false } = {}) {
        this.fromDeepLink = fromDeepLink;
        this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.coarse = window.matchMedia('(pointer: coarse)').matches;
        this.saved = readStorage();
        this.trophies = new Set(this.saved.trophies || []);
        this.visited = new Set();
        this.boardsRead = new Set();
        this.raycaster = new THREE.Raycaster();
        this.ndc = new THREE.Vector2();
        this.hovered = null;
        this.centerTarget = null;
        this.mode = 'loading';
        this.cleanup = [];
        this.niIndex = 0;
        this.barkIndex = 0;
        this.knightIndex = 0;
        this.parrotIndex = 0;
        this.lightFlips = 0;
        this.jumps = [];
        this.holding = null;
        this.keyBuffer = '';
        this.frameTimes = [];
        this.lastDogCheck = 0;
        this.dogMode = 'follow';
        this.inKitchen = false;
        this.maxDelta = 0.05; // long frames (tab switches) never teleport anything
    }

    reducedMotion() {
        return this.reducedMotionQuery.matches;
    }

    listen(target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        this.cleanup.push(() => target.removeEventListener(type, fn, opts));
    }

    /* ==============================================================
       STARTUP
       ============================================================== */

    async start() {
        await Promise.all([
            this.loadStyles(),
            withTimeout(Promise.all([
                document.fonts.load('400 95px Pacifico'),
                document.fonts.load('700 30px "adineue PRO"'),
                document.fonts.load('400 30px "adineue PRO"')
            ]), 2000)
        ]);
        const logo = await loadImage('iron_pig_mark.svg');

        this.layout = readLayout();
        this.content = readContent();
        this.world = buildWorld({ layout: this.layout, content: this.content, logo });

        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.coarse ? 1.5 : 2));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.domElement.className = 'cafe-canvas';
        renderer.domElement.setAttribute('aria-hidden', 'true');
        renderer.domElement.tabIndex = -1;
        document.body.appendChild(renderer.domElement);
        this.renderer = renderer;
        // Signs are mostly seen at an angle: use the sharpest filtering the GPU offers
        const maxAniso = renderer.capabilities.getMaxAnisotropy();
        this.world.scene.traverse(o => {
            const map = o.material && o.material.map;
            if (map && map.anisotropy > 1) map.anisotropy = maxAniso;
        });

        // Near plane at 10cm keeps depth precision high enough that thin
        // signs never flicker against their frames
        this.camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 400);
        this.player = new Player(this.camera, renderer.domElement, {
            collide: (p, r) => this.world.collide(p, r),
            onTap: (x, y) => this.handleTap(x, y),
            onHover: () => this.setHover(null),
            onJump: () => this.onPlayerJump(),
            reducedMotion: () => this.reducedMotion()
        });

        // Opening frame: lined up with the flat page
        this.applyStartPose();
        renderer.compile(this.world.scene, this.camera);
        this.world.update(0, 0, { reducedMotion: true, playerPos: this.camera.position });
        renderer.render(this.world.scene, this.camera);

        this.timer = new THREE.Timer();
        renderer.setAnimationLoop(time => this.tick(time));

        this.listen(window, 'resize', () => this.onResize());
        this.listen(window, 'keydown', e => this.onKey(e));
        this.listen(window, 'popstate', () => {
            if (location.hash !== '#cafe' && this.mode !== 'leaving') this.exit({ fromHistory: true });
        });
        // Hidden tabs stop animation frames on their own; maxDelta stops the
        // first frame back from teleporting anything

        if (this.fromDeepLink) {
            this.pushedHistory = false;
        } else {
            history.pushState({ cafe: true }, '', '#cafe');
            this.pushedHistory = true;
        }

        await this.fadeCanvas(true);
        document.body.classList.add('cafe-open');
        document.querySelector('main')?.setAttribute('inert', '');
        await this.intro();
        this.beginPlay();
    }

    loadStyles() {
        if (document.getElementById('cafe-styles')) return Promise.resolve();
        return new Promise(resolve => {
            const link = document.createElement('link');
            link.id = 'cafe-styles';
            link.rel = 'stylesheet';
            // Same version stamp as the import map gave this module
            link.href = `cafe/cafe.css${new URL(import.meta.url).search}`;
            link.onload = resolve;
            link.onerror = resolve;
            document.head.appendChild(link);
        });
    }

    fadeCanvas(show) {
        const canvas = this.renderer.domElement;
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                canvas.classList.toggle('is-visible', show);
                setTimeout(resolve, this.reducedMotion() ? 200 : 520);
            });
        });
    }

    /* The flat page and this camera frame the back wall identically */
    startPose() {
        const { W, H } = this.layout;
        const aspect = window.innerWidth / window.innerHeight;
        const halfH = (H * PX) / 2;
        const halfW = (W * PX) / 2;
        const fitHalf = Math.max(halfH, halfW / aspect);
        const fov = THREE.MathUtils.radToDeg(2 * Math.atan(fitHalf / START_DISTANCE));
        const centerY = halfH - 100 * PX;
        return { fov, centerY, halfH: fitHalf };
    }

    applyStartPose() {
        const pose = this.startPose();
        this.camera.fov = pose.fov;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.camera.position.set(0, pose.centerY, START_DISTANCE);
        this.fitDepthRange(START_DISTANCE);
        this.camera.rotation.set(0, 0, 0, 'YXZ');
    }

    /**
     * From 90m away the gap between a chalkboard and its frame is smaller
     * than the depth buffer can resolve, so clamp near/far tightly around
     * the room while the camera is outside it.
     */
    fitDepthRange(z) {
        const room = this.world.bounds;
        const outside = z - room.D;
        this.camera.near = outside > 1 ? Math.max(0.1, outside - 0.5) : 0.1;
        this.camera.far = outside > 1 ? z + 12 : 60;
        this.camera.updateProjectionMatrix();
    }

    /** Dolly zoom: the room's depth unfolds out of the flat picture */
    animateDolly(reverse) {
        const duration = reverse ? OUTRO_SECONDS : INTRO_SECONDS;
        const pose = this.startPose();
        const zEnd = HOME.pos.z;
        return new Promise(resolve => {
            if (this.reducedMotion()) {
                if (!reverse) this.player.setPose(HOME.pos, HOME.look);
                resolve();
                return;
            }
            let t = 0;
            this.cinematic = dt => {
                t = Math.min(1, t + dt / duration);
                if (this.skipCinematic) {
                    this.skipCinematic = false;
                    t = 1;
                }
                const p = reverse ? 1 - t : t;
                const e = easeInOutCubic(p);
                const z = Math.exp(THREE.MathUtils.lerp(Math.log(START_DISTANCE), Math.log(zEnd), e));
                const k = THREE.MathUtils.smoothstep(e, 0.45, 1);
                const matchFov = THREE.MathUtils.radToDeg(2 * Math.atan(pose.halfH / z));
                const y = THREE.MathUtils.lerp(pose.centerY, HOME.pos.y, k);
                const lookY = THREE.MathUtils.lerp(pose.centerY, HOME.look.y, k);
                this.camera.fov = THREE.MathUtils.lerp(matchFov, playFov(), k);
                this.camera.updateProjectionMatrix();
                this.camera.position.set(0, y, z);
                this.fitDepthRange(z);
                this.camera.rotation.set(Math.atan2(lookY - y, z), 0, 0, 'YXZ');
                if (t >= 1) {
                    this.cinematic = null;
                    resolve();
                }
            };
        });
    }

    async intro() {
        this.mode = 'intro';
        await this.animateDolly(false);
        this.camera.fov = playFov();
        this.camera.updateProjectionMatrix();
        this.player.setPose(HOME.pos, HOME.look);
    }

    beginPlay() {
        this.mode = 'play';
        this.fadeLights(1, 1800);
        this.player.enabled = true;
        // Walking or looking around yourself ends the tour
        this.player.onManualInput = () => this.pauseTour();
        this.hud = new Hud({
            places: PLACES,
            onExit: () => this.exit(),
            onContact: () => this.openContact(),
            onGuide: () => this.startTour(),
            onTourNext: () => (this.tour && this.tour.paused ? this.resumeTour() : this.nextTourStop()),
            onTourEnd: () => this.endTour(false),
            onJump: id => this.activate(id, { fromMenu: true }),
            onTrophies: () => this.openTrophies(),
            onHelp: () => this.showControls()
        });
        this.hud.setBeans(0, this.world.beans.length);
        this.hud.setTrophies(this.trophies.size, ACHIEVEMENTS.length);
        this.unlock('welcome');
        // Show how to get around every time someone steps inside
        setTimeout(() => this.mode === 'play' && !this.tour && this.showControls(), 900);
        setTimeout(() => {
            if (this.mode === 'play') this.hud.say('corgi', 'Woof! I\'m Pebbles. Welcome in. Click anything, or press “Follow Pebbles” and I\'ll show you round 🐾', 4200);
        }, 600);
        this.renderer.domElement.focus({ preventScroll: true });
    }

    /* ==============================================================
       FRAME LOOP
       ============================================================== */

    tick(timestamp) {
        this.timer.update(timestamp);
        const dt = Math.min(this.maxDelta, this.timer.getDelta());
        const time = this.timer.getElapsed();
        if (this.cinematic) this.cinematic(dt);
        else if (this.player) this.player.update(dt);

        const reduced = this.reducedMotion();
        this.world.update(dt, time, { reducedMotion: reduced, playerPos: this.camera.position });

        if (this.mode === 'play') {
            // Raycasts are the priciest thing per frame, so spread them out
            this.frame = (this.frame || 0) + 1;
            this.updateCorgi(time);
            if (this.frame % 2 === 0) this.updateHover();
            if (this.frame % 4 === 1) this.updateCenterTarget();
            this.updateBeans();
            this.updateBubbles();
            this.updateKitchen();
        }
        this.renderer.render(this.world.scene, this.camera);
        this.adaptQuality(dt);
    }

    adaptQuality(dt) {
        if (this.mode !== 'play' || this.qualityLocked) return;
        // Skip the first second: shader compiles and texture uploads aren't the real frame rate
        this.qualityWarmup = (this.qualityWarmup || 0) + 1;
        if (this.qualityWarmup < 60) return;
        this.frameTimes.push(dt);
        if (this.frameTimes.length < 120) return;
        // Median, so the odd hitch doesn't cost a sharp screen its resolution
        const median = this.frameTimes.sort((a, b) => a - b)[this.frameTimes.length >> 1];
        this.frameTimes = [];
        const ratio = this.renderer.getPixelRatio();
        // Retina screens never drop below 1.5: at 1x the text turns to mush
        const floor = window.devicePixelRatio >= 2 && !this.coarse ? 1.5 : 1;
        if (median > 0.028 && ratio > floor) {
            this.renderer.setPixelRatio(Math.max(floor, ratio - 0.25));
        } else {
            this.qualityLocked = true;
        }
    }

    onResize() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.camera.aspect = window.innerWidth / window.innerHeight;
        if (this.mode === 'play') this.camera.fov = playFov();
        this.camera.updateProjectionMatrix();
    }

    /* ==============================================================
       POINTING AT THINGS
       ============================================================== */

    pick(x, y, maxDistance = Infinity) {
        this.ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
        this.raycaster.setFromCamera(this.ndc, this.camera);
        this.raycaster.far = maxDistance;
        const targets = [];
        this.world.interactables.forEach(info => {
            if (!info.object.visible) return;
            if (info.bean && info.bean.found) return;
            if (info.useProxy) targets.push(info.proxy);
            else targets.push(...info.meshes);
        });
        const hits = this.raycaster.intersectObjects([...targets, ...this.world.occluders], false);
        const first = hits.find(h => h.object.userData.id || h.object.userData.hitId || h.object.material?.visible !== false);
        const id = first && (first.object.userData.id || first.object.userData.hitId);
        if (!id) return null;
        return { id, point: first.point };
    }

    setHover(hit) {
        const id = hit ? hit.id : null;
        if (id !== this.hovered) {
            if (this.hovered) this.setHighlight(this.hovered, false);
            this.hovered = id;
            if (id) this.setHighlight(id, true);
            this.renderer.domElement.classList.toggle('is-pointing', !!id);
        }
        // Boards lean towards the pointer, like the 2D proximity pull
        Object.entries(this.world.boards).forEach(([boardId, b]) => {
            if (hit && hit.id === boardId) {
                const r = b.rect;
                b.leanTarget.set(
                    THREE.MathUtils.clamp((hit.point.x - b.cx) / ((r.w / 2) * PX), -1, 1),
                    THREE.MathUtils.clamp((hit.point.y - b.cy) / ((r.h / 2) * PX), -1, 1)
                );
            } else {
                b.leanTarget.set(0, 0);
            }
        });
    }

    setHighlight(id, on) {
        const info = this.world.interactables.get(id);
        if (!info) return;
        info.hulls.forEach(h => { h.material = on ? highlightMaterial : outlineMaterial; });
    }

    updateHover() {
        const p = this.player;
        if (!p.hasHover || this.renderer.domElement.classList.contains('is-dragging') || this.hud.isPanelOpen()) {
            if (this.hovered) this.setHover(null);
            this.hud.showTooltip(null);
            return;
        }
        const hit = this.pick(p.hoverPoint.x, p.hoverPoint.y);
        this.setHover(hit);
        if (hit) {
            const info = this.world.interactables.get(hit.id);
            this.hud.showTooltip(`${info.verb} · ${info.label}`, p.hoverPoint.x, p.hoverPoint.y);
        } else {
            this.hud.showTooltip(null);
        }
    }

    updateCenterTarget() {
        if (this.coarse || this.hud.isPanelOpen()) {
            this.centerTarget = null;
            this.hud.showPrompt(null);
            return;
        }
        const hit = this.pick(window.innerWidth / 2, window.innerHeight / 2, 3.4);
        const id = hit ? hit.id : null;
        if (id !== this.centerTarget) {
            this.centerTarget = id;
            const info = id && this.world.interactables.get(id);
            this.hud.showPrompt(info ? `${info.verb} · ${info.label}` : null);
        }
    }

    handleTap(x, y) {
        if (this.mode !== 'play' || this.hud.isPanelOpen()) return;
        const hit = this.pick(x, y);
        if (hit) this.activate(hit.id);
    }

    onKey(e) {
        if (this.mode !== 'play') {
            if (e.key === 'Escape' && this.mode === 'intro') this.skipIntro();
            return;
        }
        const typing = e.target.closest?.('input, textarea, select');
        if (e.key === 'Escape') {
            e.preventDefault();
            if (this.hud.hideControls()) return;
            if (this.hud.closePanel()) return;
            if (!this.hud.jumpMenu.hidden) { this.hud.toggleJump(false); this.hud.jumpBtn.focus(); return; }
            this.exit();
            return;
        }
        if (typing || this.hud.isPanelOpen()) return;
        if (this.hud.controls && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
            this.hud.hideControls();
        }
        if ((e.key === 'e' || e.key === 'E') && this.centerTarget) {
            e.preventDefault();
            this.activate(this.centerTarget);
            return;
        }
        if (e.key.length === 1) {
            this.keyBuffer = (this.keyBuffer + e.key.toLowerCase()).slice(-8);
            if (this.keyBuffer.endsWith('ni')) {
                this.keyBuffer = '';
                this.sayNi();
            }
        }
    }

    skipIntro() {
        if (this.cinematic) this.skipCinematic = true;
    }

    /* ==============================================================
       DOING THINGS
       ============================================================== */

    async goTo(info) {
        if (!info.view) return true;
        const far = this.player.position.distanceTo(info.view.pos) > 0.5;
        if (!far) return true;
        return this.player.glideTo(info.view.pos, info.view.look);
    }

    async activate(id, { fromMenu = false } = {}) {
        const info = this.world.interactables.get(id);
        if (!info || this.mode !== 'play') return;
        // Stopping to look at something pauses the tour (patting her doesn't)
        if (info.kind !== 'corgi') this.pauseTour();
        this.markVisited(id);
        const w = this.world;
        switch (info.kind) {
            case 'board':
                if (!(await this.goTo(info))) break;
                this.openBoard(id);
                break;
            case 'machine':
                if (fromMenu) await this.goTo(info);
                w.machine.timer = 3.6;
                this.hud.say('machine', 'Pssssshhhh… ☕', 2200);
                this.unlock('barista');
                break;
            case 'order':
                if (!(await this.goTo(info))) break;
                this.openOrder();
                break;
            case 'plant':
                if (fromMenu) await this.goTo(info);
                this.sayNi();
                break;
            case 'neon':
                if (fromMenu) await this.goTo(info);
                w.cycleNeon();
                this.unlock('neon');
                break;
            case 'switch':
                if (fromMenu) await this.goTo(info);
                this.toggleNight();
                break;
            case 'exit':
                this.exit();
                break;
            case 'laptop':
                if (!(await this.goTo(info))) break;
                this.openBuilds('Kitchen Table HQ · ~/builds');
                break;
            case 'about':
                if (!(await this.goTo(info))) break;
                this.openAbout();
                break;
            case 'fridge':
                if (!(await this.goTo(info))) break;
                this.openFridge();
                break;
            case 'art':
                if (!(await this.goTo(info))) break;
                this.openArt(info.project);
                break;
            case 'corgi':
                this.petCorgi();
                break;
            case 'bean':
                this.collectBean(info.bean);
                break;
            case 'shrubbery':
                this.hud.say('shrubbery', 'It is a good shrubbery. I like the laurels particularly.');
                break;
            case 'knight':
                if (fromMenu || this.holding === 'grenade') await this.goTo(info);
                if (this.holding === 'grenade') this.throwGrenade();
                else this.challengeKnight();
                break;
            case 'grenade':
                this.takeGrenade();
                break;
            case 'parrot':
                if (fromMenu) await this.goTo(info);
                this.inspectParrot();
                break;
            case 'argument':
                if (!(await this.goTo(info))) break;
                this.openArgument();
                break;
            case 'tap':
                if (fromMenu) await this.goTo(info);
                this.toggleTap();
                break;
            default:
                break;
        }
    }

    markVisited(id) {
        this.visited.add(id);
        if (this.hud) this.hud.setJumpVisited(id);
        if (id === 'laptop' || id === 'nameplate' || id === 'fridge') this.unlock('hq');
    }

    unlock(id) {
        if (this.trophies.has(id)) return;
        const a = ACHIEVEMENTS.find(x => x.id === id);
        if (!a) return;
        this.trophies.add(id);
        this.saved.trophies = [...this.trophies];
        writeStorage(this.saved);
        if (this.hud) {
            this.hud.setTrophies(this.trophies.size, ACHIEVEMENTS.length);
            this.hud.toast(a.title, a.text, a.icon);
        }
    }

    sayNi() {
        const plant = this.world.plant;
        plant.target = 1;
        clearTimeout(this.niTimer);
        this.niTimer = setTimeout(() => { plant.target = 0; }, 4000);
        this.hud.say('plant', NI[this.niIndex], 3600);
        this.niIndex = (this.niIndex + 1) % NI.length;
        this.markVisited('plant');
        this.unlock('ni');
    }

    /** Jump near Pebbles and she joins in */
    onPlayerJump() {
        if (this.mode !== 'play') return;
        const dog = this.world.corgi.root.position;
        const me = this.player.position;
        // Enough hopping about and the Ministry takes an interest
        const now = performance.now();
        this.jumps = this.jumps.filter(t => now - t < 6000).concat(now);
        if (this.jumps.length >= 6 && !this.trophies.has('silly')) {
            this.hud.say('corgi', 'That\'s a very silly walk. The Ministry would fund that. 🎩', 3200);
            this.unlock('silly');
        }
        if (Math.hypot(dog.x - me.x, dog.z - me.z) < 3.5) {
            setTimeout(() => this.world.corgi.doHop(), 180);
            if (Math.random() < 0.35) this.hud.say('corgi', 'Boing! 🐾', 1200);
        }
    }

    petCorgi() {
        const c = this.world.corgi;
        c.doHop();
        c.doBark();
        this.hud.say('corgi', BARKS[this.barkIndex], 2200);
        this.barkIndex = (this.barkIndex + 1) % BARKS.length;
        this.unlock('goodboy');
    }

    toggleNight() {
        const to = this.world.getNight() > 0.5 ? 0 : 1;
        this.unlock('night');
        // Flick it enough times and someone unexpected turns up
        this.lightFlips++;
        if (this.lightFlips === 5) {
            this.hud.say('corgi', 'NOBODY expects the Spanish Inquisition! 🐾', 2600);
            this.later(() => this.hud.say('corgi', 'Our chief weapon is surprise.', 3600), 2800);
            this.unlock('inquisition');
        }
        this.hud.announce(to ? 'Lights down.' : 'Lights up.');
        this.fadeLights(to, 1200);
    }

    /** Tween the room between bright (0) and low light (1) */
    fadeLights(to, ms) {
        const w = this.world;
        const from = w.getNight();
        const token = this.lightToken = (this.lightToken || 0) + 1;
        return new Promise(resolve => {
            if (this.reducedMotion() || from === to) {
                w.applyNight(to);
                resolve();
                return;
            }
            const start = performance.now();
            const step = () => {
                if (token !== this.lightToken || this.mode === 'gone') return resolve();
                const t = Math.min(1, (performance.now() - start) / ms);
                w.applyNight(THREE.MathUtils.lerp(from, to, easeInOutCubic(t)));
                if (t < 1) requestAnimationFrame(step);
                else resolve();
            };
            step();
        });
    }

    collectBean(bean) {
        if (bean.found) return;
        bean.found = true;
        const group = bean.group;
        const start = group.position.clone();
        const t0 = performance.now();
        const fly = () => {
            const t = Math.min(1, (performance.now() - t0) / 450);
            const target = this.camera.position.clone().add(new THREE.Vector3(0, -0.3, 0));
            group.position.lerpVectors(start, target, easeInOutCubic(t) * 0.6);
            group.scale.setScalar(1 - t);
            if (t < 1) requestAnimationFrame(fly);
            else group.visible = false;
        };
        if (this.reducedMotion()) group.visible = false;
        else fly();
        const found = this.world.beans.filter(b => b.found).length;
        const total = this.world.beans.length;
        this.hud.setBeans(found, total);
        this.world.corgi.doBark();
        if (found === total) {
            this.unlock('beans');
            const shrub = this.world.shrubbery;
            shrub.visible = true;
            this.world.shrubCollider.disabled = false;
            this.hud.say('plant', 'All four beans! The Knights accept this… shrubbery. 🌳', 4200);
            this.world.corgi.doHop();
            this.spawnKnight();
        } else {
            this.hud.toast(`Bean ${found} of ${total}`, `You found ${bean.label}.`, '☕');
        }
    }

    /** setTimeout that's cleared if the café closes first */
    later(fn, ms) {
        this.timeouts = this.timeouts || [];
        const id = setTimeout(() => { if (this.mode === 'play') fn(); }, ms);
        this.timeouts.push(id);
        return id;
    }

    wait(ms) {
        return new Promise(resolve => this.later(resolve, ms));
    }

    /* ---------- The Black Knight ---------- */

    spawnKnight() {
        const w = this.world;
        w.knight.root.visible = true;
        w.knightShadow.visible = true;
        w.knightCollider.disabled = false;
        w.grenade.visible = true;
        this.later(() => {
            w.knight.flourish();
            this.hud.say('knight', 'None shall pass.', 2600);
        }, 4600);
        this.later(() => this.hud.say('corgi', 'Psst. Something holy just turned up on the café table 🐾', 3600), 7600);
    }

    challengeKnight() {
        const k = this.world.knight;
        if (k.defeated) {
            this.hud.say('knight', KNIGHT_BEATEN[this.knightIndex % KNIGHT_BEATEN.length]);
        } else {
            k.flourish();
            this.hud.say('knight', KNIGHT_GUARD[this.knightIndex % KNIGHT_GUARD.length]);
            if (this.world.grenade.visible && this.knightIndex === 1) {
                this.later(() => this.hud.say('corgi', 'He won\'t budge. Maybe something on the café table can help? 🐾', 3400), 2400);
            }
        }
        this.knightIndex++;
    }

    takeGrenade() {
        const w = this.world;
        if (!w.grenade.visible) return;
        w.grenade.visible = false;
        this.holding = 'grenade';
        this.hud.setHolding('💥 Throw the Holy Hand Grenade', () => this.activate('knight', { fromMenu: true }));
        this.hud.toast('The Holy Hand Grenade of Antioch', 'Count to three. Three is the number. Then click the Black Knight.', '✨');
    }

    async throwGrenade() {
        if (this.throwing) return;
        this.throwing = true;
        const w = this.world;
        const k = w.knight;
        this.holding = null;
        this.hud.setHolding(null);
        this.hud.say('corgi', 'One… two… five!', 1500);
        await this.wait(1600);
        this.hud.say('corgi', 'Three, my lord! THREE! 🐾', 1300);
        await this.wait(1300);

        const target = k.root.position.clone().add(new THREE.Vector3(0, 1.15, 0));
        const land = () => {
            w.thrown.visible = false;
            const { hw, D } = w.bounds;
            k.blowUp(w.scene, { reducedMotion: this.reducedMotion(), bounds: { x0: -hw + 0.25, x1: hw - 0.25, z0: 0.3, z1: D - 0.25 } });
            this.boom(target);
            w.corgi.doBark();
            this.unlock('grenade');
            this.later(() => this.hud.say('knight', '\'Tis but a scratch.', 2400), 900);
            this.later(() => this.hud.say('knight', 'It\'s just a flesh wound.', 2600), 3500);
            this.knightIndex = 2;
            this.throwing = false;
        };
        if (this.reducedMotion()) {
            land();
            return;
        }
        // A lob from just below the eye line, in an arc, spinning
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        const start = this.camera.position.clone().addScaledVector(forward, 0.4).add(new THREE.Vector3(0, -0.25, 0));
        const g = w.thrown;
        g.position.copy(start);
        g.visible = true;
        const t0 = performance.now();
        const fly = () => {
            if (this.mode !== 'play') return;
            const t = Math.min(1, (performance.now() - t0) / 900);
            g.position.lerpVectors(start, target, t);
            g.position.y += Math.sin(Math.PI * t) * 0.7;
            g.rotation.set(t * 9, t * 4, 0);
            if (t < 1) requestAnimationFrame(fly);
            else land();
        };
        fly();
    }

    /** One soft golden swell where the grenade lands. Never flashes. */
    boom(at) {
        const b = this.world.blast;
        if (this.reducedMotion()) return;
        b.position.copy(at);
        b.visible = true;
        const t0 = performance.now();
        const step = () => {
            const t = Math.min(1, (performance.now() - t0) / 700);
            b.scale.setScalar(0.2 + easeInOutCubic(t) * 2.6);
            b.material.opacity = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
            if (t < 1 && this.mode === 'play') requestAnimationFrame(step);
            else b.visible = false;
        };
        step();
    }

    /* ---------- Flying Circus ---------- */

    inspectParrot() {
        const [who, line] = PARROT[this.parrotIndex];
        this.hud.say(who, line, who === 'parrot' ? 1600 : undefined);
        if (this.parrotIndex === PARROT.length - 1) this.unlock('parrot');
        this.parrotIndex = (this.parrotIndex + 1) % PARROT.length;
    }

    openArgument() {
        const SESSION = 300; // five minutes, allegedly
        const body = el('div', 'cafe-board cafe-argue');
        const clock = el('span', 'cafe-argue__clock', { 'aria-label': 'Time left' });
        const fill = el('span');
        const log = el('ol', 'cafe-argue__log', { role: 'log', 'aria-live': 'polite' });
        const footer = el('div', 'cafe-argue__footer');
        body.append(
            el('div', 'cafe-argue__head', {}, [el('span', '', { text: 'Room 12A · five minutes, £1' }), clock]),
            el('div', 'cafe-argue__bar', { 'aria-hidden': 'true' }, [fill]),
            log,
            footer
        );
        let step = 0;
        let left = SESSION;
        const quick = this.reducedMotion();
        const setClock = seconds => {
            left = Math.max(0, seconds);
            clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
            clock.classList.toggle('is-up', left === 0);
            fill.style.width = `${(left / SESSION) * 100}%`;
        };
        const addLine = (who, text) => {
            const li = el('li', `cafe-argue__line cafe-argue__line--${who}`, {}, [
                el('span', 'cafe-argue__who', { text: who === 'you' ? 'You' : 'Clinic' }), el('span', '', { text })
            ]);
            log.appendChild(li);
            log.scrollTop = log.scrollHeight;
            return li;
        };
        const focusFooter = () => footer.querySelector('button')?.focus({ preventScroll: true });
        const render = () => {
            footer.innerHTML = '';
            if (step < ARGUMENT.length) {
                const say = el('button', 'cafe-argue__say', { type: 'button' }, [
                    el('span', 'cafe-argue__say-label', { text: 'Say' }),
                    el('span', 'cafe-argue__say-text', { text: ARGUMENT[step][0] }),
                    el('span', 'cafe-argue__say-go', { text: '↵', 'aria-hidden': 'true' })
                ]);
                say.addEventListener('click', () => {
                    const [mine, theirs] = ARGUMENT[step];
                    say.disabled = true;
                    addLine('you', mine);
                    // A beat before the clinic disagrees, like it's thinking about it
                    const typing = el('li', 'cafe-argue__line cafe-argue__line--clinic cafe-argue__typing', { 'aria-hidden': 'true' }, [el('i'), el('i'), el('i')]);
                    log.appendChild(typing);
                    log.scrollTop = log.scrollHeight;
                    this.later(() => {
                        // Closed mid-sentence: the clinic has nobody to disagree with
                        if (!body.isConnected || !this.hud.isPanelOpen()) return;
                        typing.remove();
                        addLine('clinic', theirs);
                        // The clock runs fast, then "runs out" well short of five minutes
                        setClock(step >= 6 ? 0 : SESSION - (step + 1) * 25);
                        step++;
                        if (step === ARGUMENT.length) this.unlock('argument');
                        render();
                        focusFooter();
                    }, quick ? 150 : 700);
                });
                footer.appendChild(say);
            } else {
                const talk = el('button', 'cafe-btn cafe-btn--accent cafe-btn--block', { type: 'button', text: 'Have a real conversation ☕' });
                talk.addEventListener('click', () => { this.hud.closePanel(); this.openContact(); });
                const again = el('button', 'cafe-argue__again', { type: 'button', text: 'Another five minutes (£1)' });
                again.addEventListener('click', () => { step = 0; log.innerHTML = ''; setClock(SESSION); render(); focusFooter(); });
                footer.append(talk, again);
            }
        };
        setClock(SESSION);
        render();
        this.hud.openPanel('Argument Clinic', body);
    }

    toggleTap() {
        const tap = this.world.tap;
        tap.on = !tap.on;
        const info = this.world.interactables.get('tap');
        info.verb = tap.on ? 'Turn off' : 'Turn on';
        this.hud.announce(tap.on ? 'The tap is running.' : 'Tap off.');
        if (tap.on) this.unlock('tap');
        // Hovered things keep their old label until the pointer moves
        this.centerTarget = null;
    }

    /* ==============================================================
       THE CORGI
       ============================================================== */

    updateCorgi(time) {
        const corgi = this.world.corgi;
        const player = this.player.position;
        const cp = corgi.root.position;
        corgi.face(player);
        if (time - this.lastDogCheck < 0.6) return;
        this.lastDogCheck = time;
        if (this.dogMode === 'guide') {
            if (corgi.state === 'idle' && !this.guideArrived) {
                this.guideArrived = true;
                corgi.doBark();
                this.onTourArrive();
            }
            return;
        }
        // Only reposition once the player has stopped, so she isn't underfoot
        const last = this.lastPlayerSpot || player.clone();
        const still = last.distanceTo(player) < 0.05;
        this.lastPlayerSpot = player.clone();
        if (!still || corgi.state !== 'idle') return;
        const dx = cp.x - player.x;
        const dz = cp.z - player.z;
        const dist = Math.hypot(dx, dz);
        // Is she in front of the camera? (forward is -z rotated by yaw)
        const fx = -Math.sin(this.player.yaw);
        const fz = -Math.cos(this.player.yaw);
        const inView = dist > 0.01 && (dx * fx + dz * fz) / dist > Math.cos(THREE.MathUtils.degToRad(40));
        if (dist > 4 || (!inView && dist > 0.6)) {
            // Trot to a spot a couple of metres ahead and a little to the side,
            // where she's easy to see
            const goal = new THREE.Vector3(
                player.x + fx * 2.1 - fz * 0.45,
                0,
                player.z + fz * 2.1 + fx * 0.45
            );
            // The spot ahead might be through a wall: keep it in the player's room
            this.world.clampInside(goal, player.x < this.world.bounds.kx1 + 0.06);
            this.world.collide(goal, 0.3);
            corgi.walkTo(this.world.findPath(cp, goal));
        }
    }

    /* ---------- The guided tour ---------- */

    startTour() {
        if (this.tour) {
            this.endTour(false);
            return;
        }
        this.hud.closePanel();
        this.hud.hideControls(true);
        this.tour = { index: 0, timer: null, paused: false, arrived: false };
        const left = this.world.beans.filter(b => !b.found).length;
        this.hud.say('corgi', left ? 'Follow me! Keep an eye out for coffee beans on the way 🐾' : 'Follow me! I\'ll show you round 🐾', 2400);
        this.runTourStop();
    }

    runTourStop() {
        const tour = this.tour;
        if (!tour) return;
        clearTimeout(tour.timer);
        tour.arrived = false;
        const stop = TOUR[tour.index];
        const w = this.world;
        const info = w.interactables.get(stop.id);
        this.hud.showTour(tour.index + 1, TOUR.length, stop.title);
        const corgi = w.corgi;
        corgi.walkTo(w.findPath(corgi.root.position, info.dogSpot));
        this.dogMode = 'guide';
        this.guideArrived = false;
        this.guideTarget = info.center.clone();
        this.leadTheWay(info);
    }

    onTourArrive() {
        const tour = this.tour;
        if (!tour) return;
        const stop = TOUR[tour.index];
        tour.arrived = true;
        this.markVisited(stop.id);
        const ms = this.hud.say('corgi', this.tourLine(stop));
        // Long enough to read the line and look around, then move on
        // (unless they've paused to poke at something)
        if (!tour.paused) tour.timer = setTimeout(() => this.nextTourStop(), ms + 1800);
    }

    /** A stop's line, plus a bean hint if one's still hidden nearby, plus a tally at the end */
    tourLine(stop) {
        let line = stop.line;
        const bean = stop.bean && this.world.beans.find(b => b.id === stop.bean);
        if (bean && !bean.found) line += ` ${stop.nudge}`;
        if (stop === TOUR[TOUR.length - 1]) {
            const found = this.world.beans.filter(b => b.found).length;
            const total = this.world.beans.length;
            line += found === total
                ? ' And you found all four beans. Watch out for the knight by the door.'
                : ` You\'ve found ${found} of ${total} beans. Find them all and see who turns up.`;
        }
        return line;
    }

    /** Clicking or walking around mid-tour pauses it rather than ending it */
    pauseTour() {
        const tour = this.tour;
        if (!tour || tour.paused) return;
        clearTimeout(tour.timer);
        tour.paused = true;
        this.player.stopFollowing();
        this.hud.setTourPaused(true);
    }

    resumeTour() {
        const tour = this.tour;
        if (!tour) return;
        tour.paused = false;
        this.hud.setTourPaused(false);
        this.hud.closePanel();
        // Done with this stop? Carry on to the next. Otherwise lead the way again.
        if (tour.arrived) this.nextTourStop();
        else this.runTourStop();
    }

    nextTourStop() {
        const tour = this.tour;
        if (!tour) return;
        clearTimeout(tour.timer);
        if (tour.index >= TOUR.length - 1) {
            this.endTour(false, 'Thanks for the walk! Have a wander, I\'ll be around 🐾');
            return;
        }
        tour.index++;
        tour.paused = false;
        this.hud.setTourPaused(false);
        this.player.stopFollowing();
        this.player.cancelGlide();
        this.runTourStop();
    }

    endTour(byPlayer, line) {
        const tour = this.tour;
        if (!tour) return;
        clearTimeout(tour.timer);
        this.tour = null;
        this.dogMode = 'follow';
        this.world.corgi.walkTo([]);
        this.player.stopFollowing();
        this.hud.hideTour();
        this.hud.say('corgi', line || (byPlayer ? 'Okay, you drive. I\'ll tag along 🐾' : 'Tour over! Have a wander 🐾'));
    }

    /**
     * The camera walks behind Pebbles along the exact route it takes
     * (a breadcrumb trail), so it never cuts through the counter. On
     * arrival we glide into view of whatever the dog found.
     */
    leadTheWay(info) {
        const corgi = this.world.corgi;
        const trail = [this.player.position.clone().setY(0), corgi.root.position.clone()];
        const GAP = 1.3;
        const head = new THREE.Vector3();
        this.player.cancelGlide();
        this.player.startFollowing(() => {
            const c = corgi.root.position;
            if (c.distanceTo(trail[trail.length - 1]) > 0.15) trail.push(c.clone());
            if (this.guideArrived) {
                if (info && info.view) this.player.glideTo(info.view.pos, info.view.look);
                return null;
            }
            // Walk back along the trail GAP metres from the dog
            let remaining = GAP;
            let point = trail[trail.length - 1].clone();
            for (let i = trail.length - 1; i > 0; i--) {
                const seg = trail[i].distanceTo(trail[i - 1]);
                if (seg >= remaining) {
                    point = trail[i].clone().lerp(trail[i - 1], remaining / seg);
                    break;
                }
                remaining -= seg;
                point = trail[i - 1].clone();
            }
            point.y = 1.6;
            // Keep the dog in view but look ahead, towards where we're going
            corgi.worldHeadPosition(head);
            const look = head.lerp(this.guideTarget, 0.35);
            look.y = Math.max(1.1, Math.min(look.y, 1.8));
            return { pos: point, look };
        }, () => {
            this.renderer.domElement.classList.remove('is-following');
        });
        this.renderer.domElement.classList.add('is-following');
    }

    updateBeans() {
        const p = this.player.position;
        this.world.beans.forEach(bean => {
            if (bean.found) return;
            const g = bean.group.position;
            if (Math.hypot(g.x - p.x, g.z - p.z) < 1.1 && Math.abs(g.y - p.y) < 1.8) this.collectBean(bean);
        });
    }

    updateKitchen() {
        const inside = this.player.position.x < this.world.bounds.kx1 + 0.05;
        if (inside && !this.inKitchen) {
            this.inKitchen = true;
            this.unlock('hq');
            this.hud.say('corgi', 'Welcome to HQ. Yes, it\'s a kitchen.', 2800);
        } else if (!inside) {
            this.inKitchen = false;
        }
    }

    updateBubbles() {
        const v = new THREE.Vector3();
        const place = (key, pos) => {
            v.copy(pos).project(this.camera);
            const onScreen = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
            this.hud.placeBubble(key, (v.x + 1) / 2 * window.innerWidth, (1 - v.y) / 2 * window.innerHeight, onScreen);
        };
        place('corgi', this.world.corgi.worldHeadPosition(new THREE.Vector3()));
        const plant = this.world.interactables.get('plant');
        place('plant', plant.center.clone().add(new THREE.Vector3(0, 0.25, 0)));
        const machine = this.world.interactables.get('machine');
        place('machine', machine.center.clone().add(new THREE.Vector3(0, 0.35, 0)));
        const shrub = this.world.interactables.get('shrubbery');
        place('shrubbery', shrub.center.clone().add(new THREE.Vector3(0, 0.6, 0)));
        place('knight', this.world.knight.head.getWorldPosition(v).add(new THREE.Vector3(0, 0.45, 0)).clone());
        const parrot = this.world.interactables.get('parrot');
        place('parrot', parrot.center.clone().add(new THREE.Vector3(0, 0.3, 0)));
    }

    /* ==============================================================
       PANELS
       ============================================================== */

    openBoard(id) {
        this.boardsRead.add(id);
        if (this.boardsRead.size >= 4) this.unlock('menu');
        if (id === 'services') this.openServices();
        if (id === 'help') this.openHelpBoard();
        if (id === 'builds') this.openBuilds();
        if (id === 'contact') this.openContact();
    }

    openArt(project) {
        const body = el('div', 'cafe-board cafe-art');
        body.append(
            el('p', 'cafe-art__kicker', { text: project.kicker }),
            el('p', 'cafe-contact__lead', { text: project.pitch })
        );
        const list = el('ul', 'cafe-art__list');
        project.highlights.forEach(h => list.appendChild(el('li', '', { text: h })));
        body.appendChild(list);
        const chips = el('div', 'cafe-art__stack');
        project.stack.forEach(t => chips.appendChild(el('span', 'cafe-art__chip', { text: t })));
        body.appendChild(chips);
        if (project.note) body.appendChild(el('p', 'cafe-note', { text: project.note }));
        if (project.url) {
            body.appendChild(el('a', 'cafe-btn cafe-btn--accent cafe-btn--block', {
                href: project.url, target: '_blank', rel: 'noopener noreferrer',
                text: `Visit ${project.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')} →`
            }));
        }
        body.appendChild(this.orderButton('Want something like this? Order a coffee ☕'));
        this.hud.openPanel(project.name, body, { wide: true });
        this.artSeen = this.artSeen || new Set();
        this.artSeen.add(project.id);
        if (this.artSeen.size >= this.world.artworks.length) this.unlock('gallery');
    }

    openServices() {
        const body = el('div', 'cafe-board');
        const list = el('ul', 'cafe-menu');
        this.content.boards.services.rows.forEach(row => {
            list.appendChild(el('li', '', {}, [el('span', '', { text: row.label }), el('span', 'cafe-menu__price', { text: row.value })]));
        });
        body.append(list, el('p', 'cafe-note', { text: 'More cups means a bigger job. Not sure which you need? Order a coffee and I\'ll work it out with you.' }), this.orderButton());
        this.hud.openPanel('Services', body);
    }

    openHelpBoard() {
        const body = el('div', 'cafe-board');
        const pairs = el('dl', 'cafe-pairs');
        this.content.boards.help.rows.forEach(r => pairs.append(el('dt', '', { text: r.label }), el('dd', '', { text: r.value })));
        body.append(pairs, cloneExtra('#tech-stack-panel'));
        this.hud.openPanel('How I help', body);
    }

    openBuilds(title = 'Recent builds') {
        const body = el('div', 'cafe-board');
        body.appendChild(cloneExtra('#recent-builds-panel'));
        const showcase = document.querySelector('.wifi-sign__link--showcase');
        if (showcase) body.appendChild(el('a', 'cafe-btn cafe-btn--ghost cafe-btn--block', { href: showcase.getAttribute('href'), text: 'See the full showcase →' }));
        this.hud.openPanel(title, body);
        this.markVisited('builds');
    }

    openContact() {
        const body = el('div', 'cafe-board cafe-contact');
        const mail = el('a', 'cafe-contact__email', { href: `mailto:${EMAIL}`, text: EMAIL });
        const copy = el('button', 'cafe-btn cafe-btn--ghost cafe-btn--small', { type: 'button', text: 'Copy' });
        copy.addEventListener('click', () => {
            const done = ok => {
                copy.textContent = ok ? 'Copied ✓' : 'Copy failed';
                this.hud.announce(ok ? 'Email address copied' : 'Could not copy the email address');
                setTimeout(() => { copy.textContent = 'Copy'; }, 1800);
            };
            if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(EMAIL).then(() => done(true), () => done(false));
            else done(false);
        });
        body.append(
            el('p', 'cafe-contact__lead', { text: 'Pull up a chair. Tell me what\'s stuck, and I\'ll tell you honestly whether I can help.' }),
            el('div', 'cafe-contact__row', {}, [mail, copy]),
            el('p', 'cafe-contact__where', { text: '📍 London · usually within a day' }),
            this.orderButton('Or order a coffee (a quick project brief) ☕'),
            cloneExtra('#contact-info-panel')
        );
        this.hud.openPanel('Let\'s talk', body);
        this.markVisited('contact');
    }

    orderButton(text = 'Order a coffee ☕') {
        const btn = el('button', 'cafe-btn cafe-btn--accent cafe-btn--block', { type: 'button', text });
        btn.addEventListener('click', () => { this.hud.closePanel(); this.openOrder(); });
        return btn;
    }

    openOrder() {
        const form = el('form', 'cafe-order');
        const group = (name, legend, hint, options) => {
            const fs = el('fieldset', 'cafe-order__group', {}, [el('legend', '', {}, [el('span', '', { text: legend }), el('small', '', { text: hint })])]);
            const chips = el('div', 'cafe-order__chips');
            options.forEach(([value, label, sub], i) => {
                const id = `order-${name}-${i}`;
                const input = el('input', '', { type: 'radio', name, id, value });
                if (i === 1) input.checked = true;
                chips.append(input, el('label', 'cafe-chip-option', { for: id }, [el('strong', '', { text: label }), el('span', '', { text: sub })]));
            });
            fs.appendChild(chips);
            return fs;
        };
        form.append(
            group('size', 'Size', 'how big is it?', [
                ['Espresso', 'Espresso', 'a quick fix'],
                ['Flat white', 'Flat white', 'a proper project'],
                ['Bottomless', 'Bottomless', 'ongoing partnership']
            ]),
            group('blend', 'Blend', 'what do you need?', [
                ['Build', 'Build', 'make the thing'],
                ['Fix', 'Fix', 'unstick the thing'],
                ['Lead', 'Lead', 'steer the team']
            ]),
            group('shots', 'Shots', 'how urgent?', [
                ['Single', 'Single', 'whenever'],
                ['Double', 'Double', 'soon-ish'],
                ['Triple', 'Triple', 'it\'s on fire 🔥']
            ])
        );
        const nameInput = el('input', 'cafe-input', { type: 'text', name: 'name', id: 'order-name', autocomplete: 'name', placeholder: 'Sam' });
        const notes = el('textarea', 'cafe-input', { name: 'notes', id: 'order-notes', rows: '3', placeholder: 'Our deploys take a day and everyone is scared of the payments code…' });
        form.append(
            el('label', 'cafe-order__field', { for: 'order-name' }, [el('span', '', { text: 'Name for the cup' }), nameInput]),
            el('label', 'cafe-order__field', { for: 'order-notes' }, [el('span', '', { text: 'Anything else? (optional)' }), notes])
        );
        const ticket = el('div', 'cafe-order__ticket', { 'aria-live': 'polite' });
        const submit = el('button', 'cafe-btn cafe-btn--accent cafe-btn--block', { type: 'submit', text: 'Place order ☕' });
        form.append(ticket, submit, el('p', 'cafe-note', { text: `Opens your email app with the order written up. No forms, no tracking: it's just an email to ${EMAIL}.` }));

        const summary = () => {
            const data = new FormData(form);
            const who = (data.get('name') || '').trim();
            return {
                size: data.get('size'), blend: data.get('blend'), shots: data.get('shots'), who,
                text: `1 × ${data.get('size')}, ${data.get('blend')} blend, ${data.get('shots').toLowerCase()} shot${who ? `, for ${who}` : ''}`
            };
        };
        const refresh = () => { ticket.textContent = `🧾 ${summary().text}`; };
        form.addEventListener('input', refresh);
        refresh();
        form.addEventListener('submit', e => {
            e.preventDefault();
            const s = summary();
            const extra = (new FormData(form).get('notes') || '').trim();
            const subject = `Coffee order: ${s.size}, ${s.blend}, ${s.shots} shot`;
            const bodyText = [
                `Hi Iron Pig,`,
                ``,
                `I'd like to order: ${s.text}.`,
                ``,
                `Size: ${s.size === 'Espresso' ? 'a quick fix' : s.size === 'Flat white' ? 'a proper project' : 'an ongoing partnership'}`,
                `Blend: ${s.blend === 'Build' ? 'build something' : s.blend === 'Fix' ? 'fix something' : 'lead a team'}`,
                `Urgency: ${s.shots === 'Single' ? 'whenever suits' : s.shots === 'Double' ? 'soon' : 'it\'s on fire'}`,
                ``,
                extra ? `More context:\n${extra}\n` : '',
                `(Ordered from the café at iron-pig.com)`
            ].join('\n');
            window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
            this.world.machine.timer = 3.6;
            this.unlock('order');
            this.hud.closePanel();
            this.hud.say('corgi', `Order up! ${s.who ? `One for ${s.who}!` : ''} 🐾`, 3000);
            this.world.corgi.doHop();
        });
        this.hud.openPanel('Order a coffee', form, { wide: true });
        this.markVisited('order');
    }

    openAbout() {
        const body = el('div', 'cafe-board');
        body.append(
            el('p', 'cafe-contact__lead', { text: 'I run Iron Pig Ltd. I\'m also the cleaner.' }),
            el('p', '', { text: 'Iron Pig is a one-person software consultancy run from this kitchen table (and a few London coffee shops). No account managers, no hand-offs: when you hire Iron Pig, you get me.' }),
            cloneExtra('#contact-info-panel'),
            el('p', 'cafe-note', { text: 'Pebbles handles morale.' }),
            this.orderButton()
        );
        this.hud.openPanel('About me', body);
    }

    openFridge() {
        const body = el('div', 'cafe-board');
        const notes = el('ul', 'cafe-fridge');
        [
            ['Ship it.', 'Small, frequent releases beat big, scary ones.'],
            ['Fix prod first.', 'Users before roadmaps. Always.'],
            ['No meetings about meetings.', 'Decisions get written down, then we move.'],
            ['Docs live in YOUR repo.', 'No secret recipes. If I get hit by a bus, you\'re fine.'],
            ['Buy Spam. And oat milk.', 'Spam, spam, eggs and spam. Some things are non-negotiable.']
        ].forEach(([title, text], i) => notes.appendChild(el('li', `cafe-fridge__note cafe-fridge__note--${i}`, {}, [el('strong', '', { text: title }), el('span', '', { text })])));
        body.append(notes, cloneExtra('#tech-stack-panel'));
        this.hud.openPanel('Notes on the fridge', body, { wide: true });
    }

    openTrophies() {
        const list = el('ul', 'cafe-trophies');
        ACHIEVEMENTS.forEach(a => {
            const got = this.trophies.has(a.id);
            list.appendChild(el('li', got ? 'is-unlocked' : '', {}, [
                el('span', 'cafe-trophies__icon', { text: got ? a.icon : '🔒', 'aria-hidden': 'true' }),
                el('div', '', {}, [el('strong', '', { text: got ? a.title : 'Locked' }), el('span', '', { text: got ? a.text : hintFor(a.id) })])
            ]));
        });
        this.hud.openPanel(`Achievements · ${this.trophies.size}/${ACHIEVEMENTS.length}`, list, { wide: true });
    }

    showControls() {
        this.hud.showControls(() => {
            this.renderer.domElement.focus({ preventScroll: true });
        });
    }

    openHelp() {
        const body = el('div', 'cafe-board');
        body.innerHTML = `
            <dl class="cafe-pairs cafe-pairs--keys">
                <dt>Look around</dt><dd>Drag with the mouse or a finger</dd>
                <dt>Walk</dt><dd>WASD · Shift to hurry · Space to jump · left-thumb joystick on touch</dd>
                <dt>Look with the keyboard</dt><dd>Arrow keys: ← → to turn, ↑ ↓ to look up and down</dd>
                <dt>Use things</dt><dd>Click or tap them, or face them and press <kbd>E</kbd></dd>
                <dt>Get somewhere fast</dt><dd>“Jump to” in the corner, or follow Pebbles 🐾</dd>
                <dt>Leave</dt><dd><kbd>Esc</kbd>, the Exit button, the front door, or your browser's back button</dd>
            </dl>
            <p class="cafe-note">There are four coffee beans hidden around the café, ${ACHIEVEMENTS.length} achievements, at least one shrubbery, and someone who won't let you pass. Nothing can be failed and nothing is timed.</p>`;
        this.hud.openPanel('How to play', body);
    }

    /* ==============================================================
       LEAVING
       ============================================================== */

    async exit({ fromHistory = false } = {}) {
        if (this.mode === 'leaving' || this.mode === 'gone') return;
        const wasPlaying = this.mode === 'play';
        this.mode = 'leaving';
        if (this.hud) {
            this.hud.closePanel();
            this.hud.hide();
        }
        if (this.player) {
            this.player.enabled = false;
            this.player.cancelGlide();
        }
        if (!fromHistory && this.pushedHistory && location.hash === '#cafe') {
            history.back();
        } else if (this.fromDeepLink && location.hash === '#cafe') {
            history.replaceState(null, '', location.pathname + location.search);
        }
        this.fadeLights(0, 1400);
        if (wasPlaying && !this.reducedMotion()) {
            await this.player.glideTo(HOME.pos, HOME.look, 0.9);
            this.camera.fov = playFov();
            await this.animateDolly(true);
        }
        document.body.classList.remove('cafe-open');
        document.querySelector('main')?.removeAttribute('inert');
        await this.fadeCanvas(false);
        this.destroy();
        session = null;
        const trigger = document.querySelector('.step-inside');
        if (trigger) trigger.focus({ preventScroll: true });
    }

    destroy() {
        this.mode = 'gone';
        (this.timeouts || []).forEach(clearTimeout);
        this.cleanup.forEach(off => off());
        clearTimeout(this.niTimer);
        if (this.tour) clearTimeout(this.tour.timer);
        if (this.timer) this.timer.dispose();
        if (this.renderer) {
            this.renderer.setAnimationLoop(null);
            this.renderer.domElement.remove();
            this.renderer.dispose();
            this.renderer.forceContextLoss();
        }
        if (this.player) this.player.dispose();
        if (this.hud) this.hud.dispose();
        if (this.world) this.world.dispose();
        disposeMaterialCache();
        document.body.classList.remove('cafe-open');
        document.querySelector('main')?.removeAttribute('inert');
    }
}

function hintFor(id) {
    return {
        menu: 'Every board has something to say.',
        barista: 'That machine looks like it wants poking.',
        order: 'The till takes orders.',
        goodboy: 'Someone deserves a pat.',
        ni: 'The plant answers to two letters.',
        beans: 'Four beans. Up high, down low, in back, in bed.',
        hq: 'Staff only. (Go on.)',
        night: 'It\'s dim in here. There\'s a switch by the door.',
        neon: 'Signs can be persuaded.',
        gallery: 'There\'s art on the walls. Look closer.',
        grenade: 'Find all four beans. Then count to three. Not five.',
        parrot: 'There\'s a very quiet bird in the kitchen.',
        argument: 'Room 12A. Five minutes, £1.',
        inquisition: 'Nobody expects it. Try the lights. A lot.',
        silly: 'Jump about a bit. Sillier.',
        tap: 'The kitchen sink works. Probably.'
    }[id] || 'Keep exploring.';
}

/* ==============================================================
   READING THE 2D PAGE
   ============================================================== */

// Board rects on a 1600x1000 stage, used when the 2D page is in its
// stacked (phone) layout and can't be measured
const FALLBACK_LAYOUT = {
    W: 1600,
    H: 1000,
    boards: {
        services: { x: 96, y: 80, w: 400, h: 352 },
        contact: { x: 670, y: 80, w: 260, h: 222 },
        help: { x: 1124, y: 80, w: 280, h: 238 },
        builds: { x: 1124, y: 360, w: 280, h: 296 }
    }
};

function readLayout() {
    const main = document.querySelector('main');
    const desktop = window.matchMedia(DESKTOP_QUERY).matches && document.documentElement.classList.contains('js-stage');
    if (!desktop || !main) return FALLBACK_LAYOUT;
    const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stage-zoom')) || 1;
    const W = document.documentElement.clientWidth / zoom;
    const H = window.innerHeight / zoom;
    const mainRect = main.getBoundingClientRect();
    const scale = W / mainRect.width;
    const measure = selector => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const r = node.getBoundingClientRect();
        return { x: (r.left - mainRect.left) * scale, y: (r.top - mainRect.top) * scale, w: r.width * scale, h: r.height * scale };
    };
    const boards = {
        services: measure('.price-list'),
        contact: measure('.contact-info'),
        help: measure('.wifi-sign:not(.actual-wifi-sign)'),
        builds: measure('.actual-wifi-sign')
    };
    if (Object.values(boards).some(b => !b || b.w < 50)) return FALLBACK_LAYOUT;
    return { W, H, boards };
}

function text(node) {
    return node ? node.textContent.replace(/\s+/g, ' ').trim() : '';
}

function readContent() {
    const services = {
        kind: 'services',
        title: text(document.querySelector('.price-list__title')) || 'Services',
        rows: [...document.querySelectorAll('.price-list__item')].map(item => ({
            label: text(item.querySelector('.price-list__name')),
            value: text(item.querySelector('.price-list__price'))
        }))
    };
    const helpNode = document.getElementById('tech-stack-btn');
    const helpSpans = helpNode ? [...helpNode.querySelectorAll('.wifi-sign__content > span')] : [];
    const helpRows = [];
    for (let i = 0; i + 1 < helpSpans.length; i += 2) helpRows.push({ label: text(helpSpans[i]), value: text(helpSpans[i + 1]) });
    const help = { kind: 'help', title: text(helpNode?.querySelector('.board-toggle')) || 'How I Help', rows: helpRows, hint: 'Read more →' };
    const builds = [...document.querySelectorAll('.build-list li')].map(li => {
        const icon = text(li.querySelector('.build-list__icon'));
        return { icon, text: text(li).replace(icon, '').trim() };
    });
    const buildsBoard = {
        kind: 'builds',
        title: text(document.querySelector('#wifi-sign-btn .board-toggle')) || 'Recent Builds',
        items: builds,
        footer: 'See full showcase →',
        hint: 'Details →'
    };
    const contactNode = document.getElementById('contact-info-btn');
    const contactRows = contactNode ? [...contactNode.querySelectorAll('.contact-info__item')].map(item => {
        const label = text(item.querySelector('.contact-info__label'));
        const mail = item.querySelector('.contact-info__mail');
        const value = mail ? text(mail) : text(item).replace(label, '').trim();
        return { label, value };
    }) : [];
    const contact = { kind: 'contact', title: text(contactNode?.querySelector('.board-toggle')) || 'Let\'s Talk', rows: contactRows, hint: 'Say hello →' };
    return { boards: { services, help, builds: buildsBoard, contact }, builds };
}

/** Copy a 2D board's expandable panel into a café dialog */
function cloneExtra(selector) {
    const source = document.querySelector(selector);
    const wrap = el('div', 'cafe-extra');
    if (!source) return wrap;
    [...source.children].forEach(child => {
        const copy = child.cloneNode(true);
        copy.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
        wrap.appendChild(copy);
    });
    return wrap;
}
