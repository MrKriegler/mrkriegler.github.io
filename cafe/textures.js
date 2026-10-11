/**
 * Iron Pig Café - textures painted at runtime.
 *
 * Nothing here is downloaded: every surface is drawn onto a canvas using the
 * same colours as the CSS illustration, so the 3D café and the 2D page can
 * never drift apart.
 */
import * as THREE from '../vendor/three/three.r186.min.js';

export const COLORS = {
    wallTop: '#ddd0bc',
    wallBottom: '#d1c4af',
    mortar: '#c4b8a7',
    floor: '#d4b398',
    floorLine: '#c3a283',
    counter: '#2a2220',
    wood: '#c9a87a',
    woodDark: '#8B6F47',
    tableWood: '#b8967a',
    tableLeg: '#a88567',
    chalk: '#1a1a1a',
    chalkWarm: '#2a2520',
    text: '#f5f5f5',
    label: '#b8967a',
    accent: '#d4e157',
    link: '#7cb9e8',
    green: '#2E5E3F',
    neon: '#f5f5dc',
    neonGlow: '#b5c99a',
    sageLightest: '#a3b5a4',
    sageLight: '#8fa890',
    sageMedium: '#7a9a7c',
    sageWarm: '#7a8a70',
    sageDark: '#6b8a6d',
    sageDarkest: '#5a7a5d',
    outline: '#2a1f1a'
};

const BODY_FONT = '"adineue PRO", -apple-system, BlinkMacSystemFont, sans-serif';
const SCRIPT_FONT = 'Pacifico, cursive';

function makeCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return [canvas, canvas.getContext('2d')];
}

function toTexture(canvas, { repeat = false, anisotropy = 8 } = {}) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    if (repeat) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
    }
    return texture;
}

/** Deterministic pseudo-random so the café looks the same on every visit */
function seeded(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function speckle(ctx, width, height, count, alpha, rand) {
    for (let i = 0; i < count; i++) {
        ctx.fillStyle = rand() > 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
        ctx.fillRect(rand() * width, rand() * height, 2, 2);
    }
}

function setSpacing(ctx, px) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

/**
 * Wall tiles: rows match the CSS mortar spacing (32px stage = 0.128m).
 * One texture tile covers 0.96m x 0.512m, so UVs in metres repeat by
 * (1/0.96, 1/0.512).
 */
export function brickTexture() {
    const [canvas, ctx] = makeCanvas(512, 256);
    const rand = seeded(7);
    const rowHeight = 64;
    const brickWidth = 256;
    for (let row = 0; row < 4; row++) {
        const offset = row % 2 ? brickWidth / 2 : 0;
        for (let col = -1; col < 3; col++) {
            const x = col * brickWidth + offset;
            const y = row * rowHeight;
            const tint = (rand() - 0.5) * 10;
            const grad = ctx.createLinearGradient(0, y, 0, y + rowHeight);
            grad.addColorStop(0, shade(COLORS.wallTop, tint + 2));
            grad.addColorStop(1, shade(COLORS.wallBottom, tint));
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, brickWidth, rowHeight);
        }
    }
    speckle(ctx, 512, 256, 900, 0.025, rand);
    ctx.fillStyle = COLORS.mortar;
    for (let row = 0; row < 4; row++) {
        const y = row * rowHeight;
        ctx.fillRect(0, y, 512, 4);
        const offset = row % 2 ? brickWidth / 2 : 0;
        for (let col = 0; col < 3; col++) {
            ctx.fillRect(col * brickWidth + offset - 2, y, 4, rowHeight);
        }
    }
    return toTexture(canvas, { repeat: true });
}

/** Floor planks: 80px stage planks (0.32m); one tile = 4 planks = 1.28m square */
export function floorTexture() {
    const [canvas, ctx] = makeCanvas(512, 512);
    const rand = seeded(11);
    const plank = 128;
    for (let i = 0; i < 4; i++) {
        ctx.fillStyle = shade(COLORS.floor, (rand() - 0.5) * 8);
        ctx.fillRect(i * plank, 0, plank, 512);
        ctx.strokeStyle = 'rgba(120, 80, 50, 0.08)';
        ctx.lineWidth = 2;
        for (let g = 0; g < 7; g++) {
            const gx = i * plank + 10 + rand() * (plank - 20);
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.bezierCurveTo(gx + 6, 170, gx - 6, 340, gx + 3, 512);
            ctx.stroke();
        }
        const joint = rand() * 512;
        ctx.fillStyle = COLORS.floorLine;
        ctx.fillRect(i * plank, joint, plank, 3);
    }
    ctx.fillStyle = COLORS.floorLine;
    for (let i = 0; i < 4; i++) ctx.fillRect(i * plank, 0, 3, 512);
    return toTexture(canvas, { repeat: true });
}

/** The sage weave rug, with fringe painted on the short ends */
export function rugTexture() {
    const [canvas, ctx] = makeCanvas(1024, 512);
    const fringe = 40;
    const stripes = [COLORS.sageMedium, COLORS.sageLight, COLORS.sageWarm, COLORS.sageDark, COLORS.sageLightest, COLORS.sageMedium];
    const widths = [2, 3, 2, 3, 2, 3];
    let x = fringe;
    let i = 0;
    while (x < 1024 - fringe) {
        const w = widths[i % widths.length] * 3;
        ctx.fillStyle = stripes[i % stripes.length];
        ctx.fillRect(x, 0, w, 512);
        x += w;
        i++;
    }
    ctx.globalAlpha = 0.35;
    for (let y = 0; y < 512; y += 8) {
        ctx.fillStyle = y % 16 ? COLORS.sageDark : COLORS.sageLight;
        ctx.fillRect(fringe, y, 1024 - fringe * 2, 3);
    }
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = COLORS.sageDarkest;
    ctx.lineWidth = 2;
    for (let d = -512; d < 1024; d += 18) {
        ctx.beginPath();
        ctx.moveTo(d, 0);
        ctx.lineTo(d + 512, 512);
        ctx.moveTo(d + 512, 0);
        ctx.lineTo(d, 512);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = COLORS.sageDarkest;
    ctx.lineWidth = 12;
    ctx.strokeRect(fringe + 6, 6, 1024 - fringe * 2 - 12, 500);
    ctx.lineWidth = 3;
    ctx.strokeRect(fringe + 26, 26, 1024 - fringe * 2 - 52, 460);
    // Fringe tassels
    for (let y = 4; y < 512; y += 9) {
        ctx.fillStyle = y % 18 ? COLORS.sageDark : COLORS.sageMedium;
        ctx.fillRect(0, y, fringe, 4);
        ctx.fillRect(1024 - fringe, y, fringe, 4);
    }
    return toTexture(canvas);
}

/** The strip of floor-and-rug that sits under the 2D scene, for the opening frame */
export function floorBandTexture() {
    const [canvas, ctx] = makeCanvas(1024, 64);
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(0, 0, 1024, 64);
    const stripes = [COLORS.sageMedium, COLORS.sageLight, COLORS.sageWarm, COLORS.sageDark, COLORS.sageLightest];
    for (let x = 6, i = 0; x < 1018; x += 4, i++) {
        ctx.fillStyle = stripes[i % stripes.length];
        ctx.fillRect(x, 6, 4, 58);
    }
    ctx.fillStyle = COLORS.sageDarkest;
    ctx.fillRect(6, 6, 1012, 2);
    return toTexture(canvas);
}

export function checkerTexture() {
    const [canvas, ctx] = makeCanvas(256, 256);
    for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
            ctx.fillStyle = (x + y) % 2 ? '#e9e2cf' : '#9fb3a0';
            ctx.fillRect(x * 64, y * 64, 64, 64);
        }
    }
    ctx.strokeStyle = 'rgba(60, 50, 40, 0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 256; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }
    return toTexture(canvas, { repeat: true });
}

export function plasterTexture(base) {
    const [canvas, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 256, 256, 1400, 0.03, seeded(23));
    return toTexture(canvas, { repeat: true });
}

export function subwayTileTexture() {
    const [canvas, ctx] = makeCanvas(256, 128);
    ctx.fillStyle = '#c7bfae';
    ctx.fillRect(0, 0, 256, 128);
    for (let row = 0; row < 4; row++) {
        const offset = row % 2 ? 32 : 0;
        for (let col = -1; col < 4; col++) {
            ctx.fillStyle = '#f3efe4';
            ctx.fillRect(col * 64 + offset + 2, row * 32 + 2, 60, 28);
        }
    }
    return toTexture(canvas, { repeat: true });
}

/** Soft radial blob - contact shadows, steam, glow */
export function radialTexture(stops, size = 128) {
    const [canvas, ctx] = makeCanvas(size, size);
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(([at, color]) => grad.addColorStop(at, color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    return toTexture(canvas, { anisotropy: 1 });
}

/* ==========================================================
   CHALKBOARDS - drawn from the live 2D page's text
   ========================================================== */

const BOARD_SCALE = 2.5; // canvas px per stage px

function boardBackground(ctx, w, h, warm) {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    if (warm) {
        grad.addColorStop(0, '#2a2520');
        grad.addColorStop(1, '#1f1d1a');
    } else {
        grad.addColorStop(0, '#1a1a1a');
        grad.addColorStop(1, '#0f0f0f');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // Chalk dust smudges
    const rand = seeded(w + h);
    for (let i = 0; i < 6; i++) {
        const x = rand() * w;
        const y = rand() * h;
        const r = 80 + rand() * 200;
        const smudge = ctx.createRadialGradient(x, y, 0, x, y, r);
        smudge.addColorStop(0, 'rgba(255,255,255,0.035)');
        smudge.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = smudge;
        ctx.fillRect(0, 0, w, h);
    }
}

function drawTitle(ctx, text, w, y, size) {
    ctx.font = `700 ${size}px ${BODY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    setSpacing(ctx, size * 0.12);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillText(text.toUpperCase(), w / 2 + 4, y + 4);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(text.toUpperCase(), w / 2, y);
    setSpacing(ctx, 0);
}

function fitText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let out = text;
    while (out.length > 3 && ctx.measureText(out + '…').width > maxWidth) out = out.slice(0, -1);
    return out + '…';
}

/**
 * Paint one chalkboard. `board` is plain data pulled from the 2D DOM:
 * { kind, title, rows: [{label, value}], items: [{icon, text}], hint, footer }
 */
export function boardTexture(board, widthPx, heightPx) {
    const s = BOARD_SCALE;
    const w = Math.round(widthPx * s);
    const h = Math.round(heightPx * s);
    const [canvas, ctx] = makeCanvas(w, h);
    boardBackground(ctx, w, h, board.kind === 'help' || board.kind === 'builds');
    const pad = 22 * s;
    let y = pad + 26 * s;

    drawTitle(ctx, board.title, w, y, (board.kind === 'contact' ? 26 : 24) * s);
    y += 22 * s;

    ctx.textBaseline = 'middle';
    if (board.kind === 'services') {
        const rowH = (h - y - pad) / board.rows.length;
        board.rows.forEach((row, i) => {
            const cy = y + rowH * (i + 0.5);
            ctx.textAlign = 'left';
            ctx.font = `400 ${15 * s}px ${BODY_FONT}`;
            ctx.fillStyle = COLORS.text;
            ctx.fillText(fitText(ctx, row.label, w * 0.7), pad + 8 * s, cy);
            ctx.textAlign = 'right';
            ctx.font = `400 ${17 * s}px ${BODY_FONT}`;
            ctx.fillText(row.value, w - pad - 8 * s, cy);
            if (i < board.rows.length - 1) {
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                ctx.fillRect(pad + 8 * s, y + rowH * (i + 1), w - pad * 2 - 16 * s, 2);
            }
        });
    } else if (board.kind === 'help') {
        ctx.textAlign = 'left';
        board.rows.forEach(row => {
            y += 14 * s;
            ctx.font = `700 ${14 * s}px ${BODY_FONT}`;
            ctx.fillStyle = COLORS.label;
            ctx.fillText(row.label, pad, y);
            y += 24 * s;
            ctx.font = `400 ${16 * s}px ${BODY_FONT}`;
            ctx.fillStyle = COLORS.text;
            ctx.fillText(fitText(ctx, row.value, w - pad * 2), pad, y);
            y += 6 * s;
        });
    } else if (board.kind === 'builds') {
        ctx.textAlign = 'left';
        y += 8 * s;
        board.items.forEach(item => {
            y += 26 * s;
            ctx.font = `400 ${17 * s}px ${BODY_FONT}`;
            ctx.fillText(item.icon, pad, y);
            ctx.font = `400 ${16 * s}px ${BODY_FONT}`;
            ctx.fillStyle = COLORS.text;
            ctx.fillText(fitText(ctx, item.text, w - pad * 2 - 34 * s), pad + 32 * s, y);
        });
        if (board.footer) {
            y += 34 * s;
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            roundRect(ctx, pad, y - 13 * s, w - pad * 2, 28 * s, 4 * s);
            ctx.fill();
            ctx.textAlign = 'center';
            ctx.font = `400 ${13 * s}px ${BODY_FONT}`;
            ctx.fillStyle = COLORS.link;
            ctx.fillText(board.footer, w / 2, y + 1 * s);
        }
    } else if (board.kind === 'contact') {
        ctx.textAlign = 'center';
        board.rows.forEach(row => {
            y += 16 * s;
            ctx.font = `400 ${12 * s}px ${BODY_FONT}`;
            ctx.fillStyle = COLORS.label;
            setSpacing(ctx, 1 * s);
            ctx.fillText(row.label.toUpperCase(), w / 2, y);
            setSpacing(ctx, 0);
            y += 22 * s;
            ctx.font = `400 ${16 * s}px ${BODY_FONT}`;
            ctx.fillStyle = COLORS.text;
            ctx.fillText(row.value, w / 2, y);
            y += 6 * s;
        });
    }

    if (board.hint) {
        ctx.textAlign = 'center';
        ctx.font = `italic 400 ${12 * s}px ${BODY_FONT}`;
        ctx.fillStyle = COLORS.accent;
        ctx.globalAlpha = 0.85;
        const hintY = board.kind === 'builds' && board.footer ? y + 38 * s : h - pad;
        if (board.kind !== 'services') ctx.fillText(board.hint, w / 2, Math.min(hintY, h - pad * 0.6));
        ctx.globalAlpha = 1;
    }
    return toTexture(canvas);
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

/* ==========================================================
   NEON SIGN
   ========================================================== */

/**
 * Returns the sign texture and its glow. Canvas is drawn at 2x stage px, so
 * plane size = canvas size / 2 * 0.004m.
 */
export function neonTextures(color = COLORS.neon, glow = COLORS.neonGlow) {
    const w = 1024;
    const h = 420;
    const [canvas, ctx] = makeCanvas(w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `400 190px ${SCRIPT_FONT}`;
    setSpacing(ctx, 8);
    // Layered glow then a crisp tube (the darker halo keeps it readable on a pale wall)
    [[46, glow, 1], [46, glow, 1], [24, glow, 1], [10, '#ffffff', 1]].forEach(([blur, shadow, alpha]) => {
        ctx.shadowColor = shadow;
        ctx.shadowBlur = blur;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.fillText('Iron Pig', w / 2, 250);
    });
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.fillText('Iron Pig', w / 2, 250);
    setSpacing(ctx, 4);
    ctx.font = `400 36px ${SCRIPT_FONT}`;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;
    ctx.fillText('EST. 2025', w / 2, 352);
    ctx.shadowBlur = 10;
    const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
    lineGrad.addColorStop(0.18, 'rgba(245,245,220,0)');
    lineGrad.addColorStop(0.32, color);
    lineGrad.addColorStop(0.68, color);
    lineGrad.addColorStop(0.82, 'rgba(245,245,220,0)');
    ctx.fillStyle = lineGrad;
    ctx.fillRect(w * 0.18, 337, w * 0.18, 3);
    ctx.fillRect(w * 0.64, 337, w * 0.18, 3);
    return { sign: toTexture(canvas), aspect: w / h, widthPx: w / 2, heightPx: h / 2 };
}

/* ==========================================================
   SMALL SIGNS, NOTES & SCREENS
   ========================================================== */

/**
 * A flat label: lines = [{ text, size, font, color, weight, italic }]
 */
export function labelTexture(width, height, background, lines, { border, radius = 0 } = {}) {
    const [canvas, ctx] = makeCanvas(width, height);
    if (background) {
        ctx.fillStyle = background;
        if (radius) {
            roundRect(ctx, 0, 0, width, height, radius);
            ctx.fill();
        } else {
            ctx.fillRect(0, 0, width, height);
        }
    }
    if (border) {
        ctx.strokeStyle = border;
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, width - 8, height - 8);
    }
    const total = lines.reduce((sum, l) => sum + l.size * 1.3, 0);
    let y = (height - total) / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    lines.forEach(line => {
        const family = line.script ? SCRIPT_FONT : BODY_FONT;
        const font = size => `${line.italic ? 'italic ' : ''}${line.weight || 400} ${size}px ${family}`;
        ctx.font = font(line.size);
        ctx.fillStyle = line.color || COLORS.text;
        setSpacing(ctx, line.spacing || 0);
        // Shrink a line that's too wide rather than clip it at the edges
        const room = width - 32;
        const measured = ctx.measureText(line.text).width;
        if (measured > room) ctx.font = font(Math.floor(line.size * room / measured));
        ctx.fillText(line.text, width / 2, y + line.size * 0.15);
        setSpacing(ctx, 0);
        y += line.size * 1.3;
    });
    return toTexture(canvas);
}

export function stickyNoteTexture(text, color = '#f7e27a') {
    const [canvas, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, 0, 256, 34);
    ctx.fillStyle = '#2b2b2b';
    ctx.font = `400 34px ${SCRIPT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const words = text.split(' ');
    const lines = [];
    let current = '';
    words.forEach(word => {
        const test = current ? current + ' ' + word : word;
        if (ctx.measureText(test).width > 220) {
            lines.push(current);
            current = word;
        } else {
            current = test;
        }
    });
    lines.push(current);
    lines.forEach((line, i) => ctx.fillText(line, 128, 140 + (i - (lines.length - 1) / 2) * 46));
    return toTexture(canvas);
}

/** The laptop on the kitchen table - a terminal listing the real builds */
export function laptopScreenTexture(builds) {
    const [canvas, ctx] = makeCanvas(512, 320);
    ctx.fillStyle = '#14181c';
    ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = '#20262c';
    ctx.fillRect(0, 0, 512, 28);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(18 + i * 20, 14, 6, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.font = '600 17px ui-monospace, Menlo, Consolas, monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.accent;
    ctx.fillText('~/iron-pig $ ls builds/', 18, 44);
    builds.forEach((b, i) => {
        ctx.fillStyle = '#9fd0ff';
        ctx.fillText(`${b.icon}  ${b.text}`, 18, 78 + i * 30);
        ctx.fillStyle = '#28c840';
        ctx.fillText('●', 470, 78 + i * 30);
    });
    ctx.fillStyle = COLORS.accent;
    ctx.fillText('~/iron-pig $ ship --friday', 18, 78 + builds.length * 30 + 16);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(18, 78 + builds.length * 30 + 48, 10, 18);
    return toTexture(canvas);
}

/** London through the window - two moods for the day/night switch */
export function skylineTexture(night) {
    const [canvas, ctx] = makeCanvas(1024, 512);
    const sky = ctx.createLinearGradient(0, 0, 0, 512);
    if (night) {
        sky.addColorStop(0, '#0b1222');
        sky.addColorStop(0.7, '#25365a');
        sky.addColorStop(1, '#3b3a5a');
    } else {
        sky.addColorStop(0, '#9ec9e2');
        sky.addColorStop(0.75, '#e6eef0');
        sky.addColorStop(1, '#f3e9d2');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1024, 512);
    const rand = seeded(night ? 99 : 42);
    if (night) {
        for (let i = 0; i < 120; i++) {
            ctx.fillStyle = `rgba(255,255,240,${0.3 + rand() * 0.7})`;
            ctx.fillRect(rand() * 1024, rand() * 300, 2, 2);
        }
        ctx.fillStyle = '#f5f1d8';
        ctx.beginPath();
        // Inside the middle 40%, which is all the narrowest pane (the door) shows
        ctx.arc(600, 80, 30, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        [[160, 90], [600, 60], [860, 120]].forEach(([cx, cy]) => {
            ctx.beginPath();
            ctx.ellipse(cx, cy, 70, 22, 0, 0, Math.PI * 2);
            ctx.ellipse(cx + 40, cy - 12, 46, 20, 0, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    const far = night ? '#1b2440' : '#a9b7c2';
    const near = night ? '#11172a' : '#7d8d99';
    // Far skyline: generic blocks, the Shard, the Gherkin, St Paul's
    ctx.fillStyle = far;
    for (let x = 0; x < 1024; x += 40 + rand() * 30) {
        const bh = 80 + rand() * 120;
        ctx.fillRect(x, 512 - bh, 36 + rand() * 20, bh);
    }
    ctx.beginPath(); // The Shard
    ctx.moveTo(700, 512); ctx.lineTo(742, 120); ctx.lineTo(784, 512); ctx.fill();
    ctx.beginPath(); // The Gherkin
    ctx.ellipse(300, 330, 34, 120, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = near;
    ctx.beginPath(); // St Paul's
    ctx.arc(520, 380, 56, Math.PI, 0); ctx.fill();
    ctx.fillRect(458, 380, 124, 132);
    ctx.fillRect(516, 300, 8, 30);
    for (let x = -20; x < 1024; x += 70 + rand() * 40) {
        const bh = 40 + rand() * 90;
        if (x > 440 && x < 600) continue;
        ctx.fillRect(x, 512 - bh, 60 + rand() * 30, bh);
    }
    if (night) {
        for (let i = 0; i < 260; i++) {
            ctx.fillStyle = rand() > 0.3 ? 'rgba(255, 214, 120, 0.9)' : 'rgba(180, 210, 255, 0.7)';
            ctx.fillRect(rand() * 1024, 300 + rand() * 212, 3, 4);
        }
    }
    return toTexture(canvas);
}

/** Wrap-around mug texture with the Iron Pig mark facing the front */
export function mugTexture(logoImage) {
    const [canvas, ctx] = makeCanvas(512, 256);
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#e2e2e2');
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, '#e2e2e2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
    if (logoImage) ctx.drawImage(logoImage, 256 - 70, 128 - 70, 140, 140);
    return toTexture(canvas);
}

export function logoTexture(logoImage, background) {
    const [canvas, ctx] = makeCanvas(256, 256);
    if (background) {
        ctx.fillStyle = background;
        ctx.beginPath();
        ctx.arc(128, 128, 128, 0, Math.PI * 2);
        ctx.fill();
    }
    if (logoImage) ctx.drawImage(logoImage, 38, 38, 180, 180);
    return toTexture(canvas);
}

export function loadImage(src) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

function shade(hex, percent) {
    const n = parseInt(hex.slice(1), 16);
    const amt = Math.round(2.55 * percent);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return `rgb(${r},${g},${b})`;
}
