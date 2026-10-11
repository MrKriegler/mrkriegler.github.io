/**
 * Iron Pig Café - the gallery.
 *
 * Framed posters of real work on the side walls. Each poster is painted at
 * runtime in the project's own mood, like everything else in the café.
 */
import * as THREE from '../vendor/three/three.r186.min.js';

const SANS = '"adineue PRO", -apple-system, BlinkMacSystemFont, sans-serif';
const SCRIPT = 'Pacifico, cursive';
const SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif';

export const PROJECTS = [
    {
        id: 'art-six',
        name: 'SIX',
        kicker: 'Vecto Ventures · Coming soon',
        pitch: 'An invitation-only network that matches experienced operator-investors with early-stage founders.',
        highlights: [
            'AI matching with Claude and Cohere embeddings on Amazon Bedrock, served in the EU',
            'Multi-region by design: Terraform per region, a Cognito pool per region',
            '108 architecture decision records, security and privacy reviews',
            'Its own design system with WCAG AA contrast audits'
        ],
        stack: ['TypeScript', 'Hono', 'Postgres + pgvector', 'React 19', 'Bedrock', 'Terraform'],
        note: 'Launching soon',
        paint: paintSix
    },
    {
        id: 'art-merlin',
        name: 'Merlin',
        kicker: 'Merlin Entertainments · 2026',
        pitch: 'Guest entitlement and membership architecture for a global theme-park operator\'s single attractions app.',
        highlights: [
            'Neo: an event-sourced, bi-temporal ledger of what every guest has, had and will have',
            'Append-only, content-hashed ingest that stays idempotent under concurrent writes',
            'A membership service orchestrating billing, passes and the ledger with sagas',
            'Co-authored the architecture for replacing per-park apps with one app and one BFF'
        ],
        stack: ['TypeScript', 'Azure Functions', 'Cosmos DB', 'APIM', 'Terraform', 'Chargebee', 'accesso'],
        paint: paintMerlin
    },
    {
        id: 'art-throughline',
        name: 'Throughline',
        kicker: 'Iron Pig Labs · 2026',
        pitch: 'A founder diagnostic: a short AI interview, then sales, fundraising and marketing pipelines scored with a playbook for every blocker.',
        highlights: [
            'A live AI interviewer that captures facts as the founder talks',
            'Deterministic scoring engine: the AI never produces a score',
            'Projected scores after each playbook, run through the same engine',
            'Reads straight from HubSpot and Attio'
        ],
        stack: ['TypeScript', 'Next.js', 'Claude', 'Canvas + SVG'],
        note: 'Private demo, available on request',
        paint: paintThroughline
    },
    {
        id: 'art-mark',
        name: 'What Is This Mark?',
        kicker: 'Side project · live',
        pitch: 'Identify watch markings, serial numbers and case-back codes from a photo.',
        highlights: ['Photo analysis of markings across 13+ brands'],
        stack: ['AI vision', 'Web'],
        url: 'https://whatisthismark.com/',
        paint: paintWatch
    },
    {
        id: 'art-visa',
        name: 'Visa Requirements',
        kicker: 'Side project · live',
        pitch: 'Free visa application tools and requirement guides.',
        highlights: ['Cover letters, trip planners and sponsor letters for 9+ countries'],
        stack: ['Web', 'Document generation'],
        url: 'https://www.visa-requirements.io/',
        paint: paintVisa
    },
    {
        id: 'art-foam',
        name: 'Foam Finders',
        kicker: 'Side project · live',
        pitch: 'Find your perfect pint of the black stuff.',
        highlights: ['Rate and discover the best Guinness near you'],
        stack: ['Maps', 'Ratings', 'Web'],
        url: 'https://foamfinders.co.uk',
        paint: paintFoam
    },
    {
        id: 'art-thames',
        name: 'Thames Paddle Planner',
        kicker: 'Side project · live',
        pitch: 'Tide-aware paddle planning for kayaking and SUP on the Thames.',
        highlights: ['Live tide windows, 7-day forecasts and 12 launch points'],
        stack: ['Tide data', 'Forecasts', 'Web'],
        url: 'https://www.thamespaddleplanner.com/',
        paint: paintThames
    }
];

/* ---------- Painting helpers ---------- */

const W = 768;
const H = 1024;

function canvas() {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    return [c, c.getContext('2d')];
}

function seeded(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

function spacing(ctx, px) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

function wrap(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    words.forEach(word => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
            ctx.fillText(line, x, y);
            line = word;
            y += lineHeight;
        } else {
            line = test;
        }
    });
    if (line) ctx.fillText(line, x, y);
    return y + lineHeight;
}

/** Shared footer: pitch + stack chips */
function footer(ctx, p, { ink, muted, chip, chipInk, top = 760 }) {
    ctx.textAlign = 'left';
    ctx.fillStyle = ink;
    ctx.font = `400 28px ${SANS}`;
    let y = wrap(ctx, p.pitch, 56, top, W - 112, 38);
    y += 8;
    let x = 56;
    ctx.font = `700 19px ${SANS}`;
    p.stack.slice(0, 5).forEach(tag => {
        const w = ctx.measureText(tag).width + 26;
        if (x + w > W - 56) {
            x = 56;
            y += 42;
        }
        ctx.fillStyle = chip;
        roundRect(ctx, x, y - 24, w, 34, 17);
        ctx.fill();
        ctx.fillStyle = chipInk;
        ctx.fillText(tag, x + 13, y);
        x += w + 10;
    });
    ctx.fillStyle = muted;
    ctx.font = `700 18px ${SANS}`;
    spacing(ctx, 3);
    ctx.fillText(p.kicker.toUpperCase(), 56, H - 44);
    spacing(ctx, 0);
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

function grain(ctx, alpha = 0.04, seed = 3) {
    const rand = seeded(seed);
    for (let i = 0; i < 5000; i++) {
        ctx.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
        ctx.fillRect(rand() * W, rand() * H, 2, 2);
    }
}

/* ---------- The posters ---------- */

function paintSix(ctx, p) {
    ctx.fillStyle = '#151617';
    ctx.fillRect(0, 0, W, H);
    // Soft coral sun
    const sun = ctx.createRadialGradient(W * 0.62, 330, 20, W * 0.62, 330, 380);
    sun.addColorStop(0, 'rgba(200, 74, 61, 0.55)');
    sun.addColorStop(1, 'rgba(200, 74, 61, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);
    // A constellation of members joined by fine lines
    const rand = seeded(6);
    const dots = Array.from({ length: 26 }, () => [60 + rand() * (W - 120), 90 + rand() * 520]);
    ctx.strokeStyle = 'rgba(222, 233, 233, 0.14)';
    ctx.lineWidth = 1.5;
    dots.forEach((d, i) => {
        const e = dots[(i * 7 + 3) % dots.length];
        ctx.beginPath(); ctx.moveTo(d[0], d[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
    });
    dots.forEach(([x, y], i) => {
        ctx.fillStyle = i % 5 === 0 ? '#c84a3d' : 'rgba(222, 233, 233, 0.7)';
        ctx.beginPath(); ctx.arc(x, y, i % 5 === 0 ? 7 : 3.5, 0, Math.PI * 2); ctx.fill();
    });
    // The SIX mark, from the product's own logo paths
    ctx.save();
    ctx.translate(W / 2 - 150, 170);
    ctx.scale(14, 14);
    ctx.fillStyle = '#F7F6EF';
    ctx.fill(new Path2D('M20.2309 6.89387L18.4095 3.7351L11.9368 7.4739V0H8.29407V9.57605L0 14.3641L1.82137 17.5228L8.29407 13.784V21.2579H11.9368V13.784L18.4095 17.5228L20.2309 14.3641L13.7582 10.629L20.2309 6.89387Z'));
    ctx.fillStyle = 'rgba(247, 246, 239, 0.55)';
    ctx.fill(new Path2D('M1.82137 3.73665L0 6.89136L4.56888 9.5292L6.39025 6.3745L1.82137 3.73665Z'));
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8f7f2';
    ctx.font = `600 120px ${SERIF}`;
    spacing(ctx, 18);
    ctx.fillText('SIX', W / 2 + 9, 650);
    spacing(ctx, 0);
    ctx.fillStyle = '#c84a3d';
    ctx.fillRect(W / 2 - 40, 680, 80, 4);
    footer(ctx, p, { ink: '#f8f7f2', muted: '#8a9799', chip: 'rgba(222,233,233,0.12)', chipInk: '#dee9e9', top: 750 });
    grain(ctx, 0.03, 6);
}

function paintMerlin(ctx, p) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#120c2e');
    sky.addColorStop(0.55, '#3b1d5e');
    sky.addColorStop(1, '#f08a4b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    const rand = seeded(11);
    for (let i = 0; i < 160; i++) {
        ctx.fillStyle = `rgba(255,255,240,${0.3 + rand() * 0.7})`;
        ctx.fillRect(rand() * W, rand() * 420, 2, 2);
    }
    // A rollercoaster loop drawn as a single sweeping track
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#ffd36e';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-20, 620);
    ctx.bezierCurveTo(150, 640, 230, 260, 380, 270);
    ctx.bezierCurveTo(540, 280, 560, 520, 420, 520);
    ctx.bezierCurveTo(290, 520, 330, 330, 470, 360);
    ctx.bezierCurveTo(640, 400, 650, 640, 790, 600);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 211, 110, 0.45)';
    for (let x = 20; x < W; x += 34) {
        ctx.beginPath(); ctx.moveTo(x, 700); ctx.lineTo(x + 10, 560 + Math.sin(x / 70) * 30); ctx.stroke();
    }
    // Skyline of towers and a big wheel
    ctx.fillStyle = '#0d0820';
    ctx.beginPath();
    ctx.moveTo(0, 720);
    [[60, 640], [90, 600], [120, 640], [200, 680], [260, 590], [300, 680], [560, 690], [600, 610], [640, 690], [W, 700]].forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(W, 760); ctx.lineTo(0, 760); ctx.fill();
    ctx.strokeStyle = '#0d0820';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(640, 560, 90, 0, Math.PI * 2); ctx.stroke();
    for (let a = 0; a < 12; a++) {
        const t = (a / 12) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(640, 560); ctx.lineTo(640 + Math.cos(t) * 90, 560 + Math.sin(t) * 90); ctx.stroke();
    }
    ctx.fillStyle = '#1a1030';
    ctx.fillRect(0, 740, W, H - 740);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd36e';
    ctx.font = `700 22px ${SANS}`;
    spacing(ctx, 6);
    ctx.fillText('MERLIN', 56, 110);
    spacing(ctx, 0);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 96px ${SANS}`;
    ctx.fillText('Neo', 56, 200);
    ctx.font = `400 26px ${SANS}`;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('the guest entitlements ledger', 60, 240);
    footer(ctx, p, { ink: '#f4ecff', muted: '#b9a6d6', chip: 'rgba(255,211,110,0.16)', chipInk: '#ffd36e', top: 800 });
}

function paintThroughline(ctx, p) {
    ctx.fillStyle = '#f3efe4';
    ctx.fillRect(0, 0, W, H);
    // Three flowing pipelines braiding into one line
    const bands = [['#7a9a7c', 0], ['#b0844a', 70], ['#2E5E3F', 140]];
    bands.forEach(([color, offset], i) => {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 46 - i * 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-40, 200 + offset);
        ctx.bezierCurveTo(250, 120 + offset * 1.6, 380, 600 - offset, W + 40, 470 - offset * 0.2);
        ctx.stroke();
    });
    ctx.globalAlpha = 1;
    const rand = seeded(21);
    for (let i = 0; i < 70; i++) {
        const t = rand();
        const x = t * W;
        const y = 260 + Math.sin(t * 6) * 120 + (rand() - 0.5) * 120;
        ctx.fillStyle = rand() > 0.5 ? 'rgba(46,94,63,0.6)' : 'rgba(176,132,74,0.6)';
        ctx.beginPath(); ctx.arc(x, y, 3 + rand() * 4, 0, Math.PI * 2); ctx.fill();
    }
    // A score dial
    ctx.lineWidth = 16;
    ctx.strokeStyle = 'rgba(42,34,32,0.12)';
    ctx.beginPath(); ctx.arc(W / 2, 590, 90, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
    ctx.strokeStyle = '#2E5E3F';
    ctx.beginPath(); ctx.arc(W / 2, 590, 90, Math.PI * 0.75, Math.PI * 1.85); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2a2220';
    ctx.font = `700 54px ${SANS}`;
    ctx.fillText('72', W / 2, 608);
    ctx.font = `400 64px ${SCRIPT}`;
    ctx.fillText('Throughline', W / 2, 120);
    footer(ctx, p, { ink: '#2a2220', muted: '#8b6f47', chip: 'rgba(46,94,63,0.12)', chipInk: '#2E5E3F', top: 750 });
    grain(ctx, 0.025, 21);
}

function paintWatch(ctx, p) {
    ctx.fillStyle = '#0f1e33';
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2;
    const cy = 380;
    const glow = ctx.createRadialGradient(cx, cy, 40, cx, cy, 300);
    glow.addColorStop(0, 'rgba(212, 175, 92, 0.25)');
    glow.addColorStop(1, 'rgba(212, 175, 92, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#d4af5c';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(cx, cy, 230, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 205, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2;
        const long = i % 5 === 0;
        ctx.lineWidth = long ? 6 : 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (long ? 170 : 186), cy + Math.sin(a) * (long ? 170 : 186));
        ctx.lineTo(cx + Math.cos(a) * 200, cy + Math.sin(a) * 200);
        ctx.stroke();
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 95, cy - 70); ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - 40, cy - 150); ctx.stroke();
    ctx.fillStyle = '#d4af5c';
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
    // A loupe over the dial
    ctx.strokeStyle = '#f2e6c4';
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.arc(cx + 150, cy + 150, 70, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 200, cy + 200); ctx.lineTo(cx + 270, cy + 270); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2e6c4';
    ctx.font = `700 44px ${SANS}`;
    ctx.fillText('What Is This Mark?', cx, 700);
    footer(ctx, p, { ink: '#e8edf5', muted: '#8fa3bf', chip: 'rgba(212,175,92,0.16)', chipInk: '#d4af5c', top: 770 });
}

function paintVisa(ctx, p) {
    ctx.fillStyle = '#f4ead6';
    ctx.fillRect(0, 0, W, H);
    const rand = seeded(31);
    const stamps = [['#b23a3a', 'ARRIVED'], ['#1f6f78', 'APPROVED'], ['#2E5E3F', 'ENTRY'], ['#6b3f6b', 'VISA'], ['#b0844a', 'DEPARTED']];
    for (let i = 0; i < 9; i++) {
        const [color, word] = stamps[i % stamps.length];
        ctx.save();
        ctx.translate(90 + rand() * (W - 180), 110 + rand() * 520);
        ctx.rotate((rand() - 0.5) * 0.9);
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 5;
        if (i % 2) {
            ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2); ctx.stroke();
        } else {
            roundRect(ctx, -95, -45, 190, 90, 10); ctx.stroke();
        }
        ctx.font = `700 24px ${SANS}`;
        ctx.textAlign = 'center';
        spacing(ctx, 3);
        ctx.fillText(word, 0, 8);
        spacing(ctx, 0);
        ctx.restore();
    }
    ctx.globalAlpha = 1;
    // Passport
    ctx.save();
    ctx.translate(W / 2, 440);
    ctx.rotate(-0.08);
    ctx.fillStyle = '#163a5f';
    roundRect(ctx, -120, -165, 240, 330, 14);
    ctx.fill();
    ctx.strokeStyle = '#d4af5c';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, -20, 50, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#d4af5c';
    ctx.font = `700 22px ${SANS}`;
    ctx.textAlign = 'center';
    spacing(ctx, 4);
    ctx.fillText('PASSPORT', 0, 90);
    spacing(ctx, 0);
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#163a5f';
    ctx.font = `700 48px ${SANS}`;
    ctx.fillText('Visa Requirements', W / 2, 700);
    footer(ctx, p, { ink: '#2a2220', muted: '#8b6f47', chip: 'rgba(22,58,95,0.1)', chipInk: '#163a5f', top: 770 });
    grain(ctx, 0.03, 31);
}

function paintFoam(ctx, p) {
    ctx.fillStyle = '#1b1512';
    ctx.fillRect(0, 0, W, H);
    // Warm pub glow
    const glow = ctx.createRadialGradient(W / 2, 360, 60, W / 2, 360, 420);
    glow.addColorStop(0, 'rgba(240, 180, 90, 0.35)');
    glow.addColorStop(1, 'rgba(240, 180, 90, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    // The perfect pint
    const cx = W / 2;
    ctx.fillStyle = '#0b0807';
    ctx.beginPath();
    ctx.moveTo(cx - 120, 160);
    ctx.lineTo(cx + 120, 160);
    ctx.bezierCurveTo(cx + 130, 260, cx + 95, 330, cx + 100, 380);
    ctx.lineTo(cx + 85, 620);
    ctx.lineTo(cx - 85, 620);
    ctx.lineTo(cx - 100, 380);
    ctx.bezierCurveTo(cx - 95, 330, cx - 130, 260, cx - 120, 160);
    ctx.fill();
    ctx.fillStyle = '#f1e4c8';
    ctx.beginPath();
    ctx.ellipse(cx, 168, 122, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 121, 168, 242, 50);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(cx - 95, 240, 18, 360);
    // Harp-ish badge
    ctx.strokeStyle = '#d4af5c';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, 420, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#d4af5c';
    ctx.font = `400 34px ${SCRIPT}`;
    ctx.textAlign = 'center';
    ctx.fillText('FF', cx, 434);
    // Stars
    ctx.fillStyle = '#f0b45a';
    ctx.font = `400 38px ${SANS}`;
    ctx.fillText('★ ★ ★ ★ ★', cx, 680);
    ctx.fillStyle = '#f1e4c8';
    ctx.font = `700 52px ${SANS}`;
    ctx.fillText('Foam Finders', cx, 118);
    footer(ctx, p, { ink: '#f1e4c8', muted: '#b39a74', chip: 'rgba(240,180,90,0.16)', chipInk: '#f0b45a', top: 770 });
}

function paintThames(ctx, p) {
    const sky = ctx.createLinearGradient(0, 0, 0, 560);
    sky.addColorStop(0, '#f6d9b0');
    sky.addColorStop(1, '#f2b38a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 560);
    ctx.fillStyle = '#ffe9c4';
    ctx.beginPath(); ctx.arc(W * 0.7, 250, 80, 0, Math.PI * 2); ctx.fill();
    // Tower Bridge silhouette
    ctx.fillStyle = '#5a4a5e';
    ctx.fillRect(140, 300, 70, 260);
    ctx.fillRect(500, 300, 70, 260);
    ctx.beginPath(); ctx.moveTo(130, 300); ctx.lineTo(175, 240); ctx.lineTo(220, 300); ctx.fill();
    ctx.beginPath(); ctx.moveTo(490, 300); ctx.lineTo(535, 240); ctx.lineTo(580, 300); ctx.fill();
    ctx.fillRect(210, 340, 290, 18);
    ctx.fillRect(210, 460, 290, 26);
    // The river, in tide bands
    const blues = ['#2f6f8f', '#3b82a6', '#4f97b9', '#2a5f7c', '#1f4c66'];
    for (let i = 0; i < 9; i++) {
        ctx.fillStyle = blues[i % blues.length];
        ctx.beginPath();
        const y = 540 + i * 36;
        ctx.moveTo(0, y);
        for (let x = 0; x <= W; x += 24) ctx.lineTo(x, y + Math.sin(x / 60 + i) * 8);
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    }
    // A paddleboarder
    ctx.fillStyle = '#1b1a1f';
    ctx.fillRect(W * 0.38, 600, 120, 10);
    ctx.fillRect(W * 0.38 + 55, 540, 10, 60);
    ctx.beginPath(); ctx.arc(W * 0.38 + 60, 530, 12, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1b1a1f';
    ctx.beginPath(); ctx.moveTo(W * 0.38 + 30, 520); ctx.lineTo(W * 0.38 + 100, 640); ctx.stroke();
    ctx.fillStyle = 'rgba(10, 30, 45, 0.55)';
    ctx.fillRect(0, 700, W, H - 700);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 46px ${SANS}`;
    ctx.fillText('Thames Paddle', 56, 110);
    ctx.fillText('Planner', 56, 162);
    footer(ctx, p, { ink: '#ffffff', muted: '#bcd8e6', chip: 'rgba(255,255,255,0.16)', chipInk: '#ffffff', top: 770 });
}

/* ---------- Building the frames ---------- */

/**
 * Hang every poster. `spots` is a list of { x, y, z, rotY } on the walls.
 * Returns [{ project, group, texture }] for registering as interactables.
 */
export function hangGallery(scene, spots, { toon, outline, rbox, glowMaterial, track }) {
    const POSTER_W = 0.78;
    const POSTER_H = POSTER_W * (H / W);
    const frameMat = toon('#1c1817');
    const brass = toon('#c9a25a');
    const lampGlowTex = (() => {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 128;
        const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, 128);
        g.addColorStop(0, 'rgba(255, 220, 160, 0.55)');
        g.addColorStop(1, 'rgba(255, 220, 160, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 128);
        return track(new THREE.CanvasTexture(c));
    })();
    return PROJECTS.slice(0, spots.length).map((project, i) => {
        const spot = spots[i];
        const [c, ctx] = canvas();
        project.paint(ctx, project);
        const texture = track(new THREE.CanvasTexture(c));
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        const group = new THREE.Group();
        group.position.set(spot.x, spot.y, spot.z);
        group.rotation.y = spot.rotY;
        // Frame + mat + the print
        const frame = new THREE.Mesh(rbox(POSTER_W + 0.1, POSTER_H + 0.1, 0.04, 0.008), frameMat);
        outline(frame);
        group.add(frame);
        const mat = new THREE.Mesh(new THREE.PlaneGeometry(POSTER_W + 0.05, POSTER_H + 0.05), toon('#f6f1e4'));
        mat.position.z = 0.0215;
        group.add(mat);
        const print = new THREE.Mesh(new THREE.PlaneGeometry(POSTER_W, POSTER_H), glowMaterial({ map: texture }));
        print.position.z = 0.026;
        group.add(print);
        // A little brass picture light
        const bar = new THREE.Mesh(rbox(0.32, 0.03, 0.05, 0.01), brass);
        bar.position.set(0, POSTER_H / 2 + 0.11, 0.1);
        outline(bar);
        group.add(bar);
        const arm = new THREE.Mesh(rbox(0.02, 0.02, 0.1, 0.006), brass);
        arm.position.set(0, POSTER_H / 2 + 0.11, 0.05);
        group.add(arm);
        const wash = new THREE.Mesh(new THREE.PlaneGeometry(POSTER_W + 0.2, POSTER_H * 0.6), glowMaterial({
            map: lampGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6
        }));
        wash.position.set(0, POSTER_H / 2 - POSTER_H * 0.3 + 0.05, 0.03);
        wash.raycast = () => {};
        group.add(wash);
        scene.add(group);
        return { project, group, size: [POSTER_W, POSTER_H] };
    });
}
