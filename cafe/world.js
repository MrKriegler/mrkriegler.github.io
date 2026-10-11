/**
 * Iron Pig Café - the world.
 *
 * Every position comes from the 2D page's CSS numbers (1 stage px = 4mm), so
 * from the right camera the café lines up with the flat illustration.
 * Back wall is z = 0, the room extends towards +z, floor is y = 0.
 */
import * as THREE from '../vendor/three/three.r186.min.js';
import {
    toon, lambert, glowMaterial, outline, rbox, cyl, sphere, capsule, matrix,
    Batcher, glowConeMaterial, compactGroup
} from './kit.js';
import {
    COLORS, brickTexture, floorTexture, rugTexture, floorBandTexture, checkerTexture,
    plasterTexture, subwayTileTexture, radialTexture, boardTexture, neonTextures,
    labelTexture, stickyNoteTexture, laptopScreenTexture, skylineTexture, mugTexture,
    logoTexture
} from './textures.js';
import { Corgi } from './corgi.js';
import { Knight, holyHandGrenade } from './knight.js';
import { hangGallery } from './gallery.js';

export const PX = 0.004;
export const ROOM_DEPTH = 7;
const KITCHEN_WIDTH = 3.5;
const WALL = 0.12;

const NEON_STYLES = [
    { color: COLORS.neon, glow: COLORS.neonGlow, light: '#b5c99a' },
    { color: '#ffe3f3', glow: '#ff4fa3', light: '#ff7cc0' },
    { color: '#fff3d6', glow: '#ffae42', light: '#ffc46b' },
    { color: '#e6f7ff', glow: '#3fb7ff', light: '#7fd0ff' }
];

export function buildWorld({ layout, content, logo }) {
    const { W, H } = layout;
    const hw = (W / 2) * PX;
    const ceil = (H - 100) * PX;
    const D = ROOM_DEPTH;
    const X = px => (px - W / 2) * PX;
    const Y = py => (H - 100 - py) * PX;
    const kx0 = -hw - WALL - KITCHEN_WIDTH;   // kitchen far wall
    const kx1 = -hw - WALL;                   // kitchen side of the shared wall
    const kz0 = 0.8;
    const kz1 = 5.2;
    const doorZ0 = 2.2;
    const doorZ1 = 3.2;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#d8cbb6');
    const batch = new Batcher();
    const textures = [];
    const track = t => { textures.push(t); return t; };
    const occluders = [];
    const colliders = [];
    const interactables = new Map();
    const animated = [];
    const block = (x0, x1, z0, z1) => colliders.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });

    /* ------------------------------------------------------------------
       SHELL: walls, floor, ceiling
       ------------------------------------------------------------------ */
    const brick = track(brickTexture());
    brick.repeat.set(1 / 0.96, 1 / 0.512);
    const wallMat = lambert('#ffffff', { map: brick });

    function wall(shapeFn, material, place) {
        const shape = new THREE.Shape();
        shapeFn(shape);
        const geometry = new THREE.ShapeGeometry(shape);
        const mesh = new THREE.Mesh(geometry, material);
        place(mesh);
        mesh.updateMatrix();
        mesh.matrixAutoUpdate = false;
        scene.add(mesh);
        occluders.push(mesh);
        return mesh;
    }
    const rect = (s, x0, y0, x1, y1) => { s.moveTo(x0, y0); s.lineTo(x1, y0); s.lineTo(x1, y1); s.lineTo(x0, y1); s.lineTo(x0, y0); };
    const hole = (s, x0, y0, x1, y1) => { const p = new THREE.Path(); rect(p, x0, y0, x1, y1); s.holes.push(p); };

    // Back wall (faces +z)
    wall(s => rect(s, -hw, 0, hw, ceil), wallMat, () => {});
    // Café left wall with the doorway into the kitchen (faces +x)
    wall(s => { rect(s, -D, 0, 0, ceil); hole(s, -doorZ1, 0, -doorZ0, 2.15); }, wallMat, m => {
        m.rotation.y = Math.PI / 2;
        m.position.x = -hw;
    });
    // Right wall (faces -x)
    wall(s => rect(s, 0, 0, D, ceil), wallMat, m => {
        m.rotation.y = -Math.PI / 2;
        m.position.x = hw;
    });

    // Floor
    const planks = track(floorTexture());
    planks.repeat.set(1 / 1.28, 1 / 1.28);
    const floorGeo = new THREE.PlaneGeometry(hw * 2, D);
    floorGeo.rotateX(-Math.PI / 2);
    floorGeo.translate(0, 0, D / 2);
    remapUVToWorld(floorGeo, 'x', 'z');
    const floor = new THREE.Mesh(floorGeo, lambert('#ffffff', { map: planks }));
    scene.add(floor);
    occluders.push(floor);

    // The strip under the 2D scene: only seen in the opening frame
    const band = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2 + 2, 0.42), glowMaterial({ map: track(floorBandTexture()) }));
    band.position.set(0, -0.21, D);
    scene.add(band);

    // Ceiling (faces down, so it vanishes when looked at from outside)
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, D), lambert('#efe4cf'));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, ceil, D / 2);
    scene.add(ceiling);
    // Ceiling beams
    for (let z = 1.2; z < D; z += 1.6) {
        batch.add(rbox(hw * 2, 0.12, 0.16, 0.01), toon('#9d8055'), matrix(0, ceil - 0.06, z), { outlined: false });
    }
    // Skirting along the back wall
    batch.add(rbox(hw * 2, 0.1, 0.03, 0.005), toon('#8B6F47'), matrix(0, 0.05, 0.015), { outlined: false });

    // Rug
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.3), lambert('#ffffff', { map: track(rugTexture()), transparent: true }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.2, 0.004, 4.1);
    scene.add(rug);

    // Soft contact shadows
    const shadowTex = track(radialTexture([[0, 'rgba(40,25,15,0.45)'], [0.6, 'rgba(40,25,15,0.18)'], [1, 'rgba(40,25,15,0)']]));
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
    function contactShadow(x, z, sx, sz = sx, parent = scene) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), shadowMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, 0.006, z);
        m.raycast = () => {};
        parent.add(m);
        return m;
    }

    /* ------------------------------------------------------------------
       COUNTER
       ------------------------------------------------------------------ */
    const counterZ0 = 0.9;
    const counterZ1 = 1.65;
    const counterTop = (250 + 18) * PX; // 1.072
    const counterW = hw + 0.02;
    const counterCX = -hw + counterW / 2;
    batch.add(rbox(counterW, 1.0, counterZ1 - counterZ0, 0.02), toon(COLORS.counter), matrix(counterCX, 0.5, (counterZ0 + counterZ1) / 2));
    // Panelled front
    const panelCount = Math.max(1, Math.round(counterW / 0.8));
    const panelPitch = counterW / panelCount;
    for (let i = 0; i < panelCount; i++) {
        batch.add(rbox(panelPitch - 0.2, 0.62, 0.02, 0.01), toon('#342a27'), matrix(-hw + panelPitch * (i + 0.5), 0.52, counterZ1 + 0.005), { outlined: false });
    }
    batch.add(rbox(counterW, 0.08, 0.05, 0.01), toon('#1d1716'), matrix(counterCX, 0.04, counterZ1 - 0.03), { outlined: false });
    // Light wood top, overhanging on the right like the CSS ::before
    batch.add(rbox(counterW + 0.06, 0.072, 0.86, 0.02), toon(COLORS.wood), matrix(counterCX + 0.03, 1.036, (counterZ0 + counterZ1) / 2));
    block(-hw, 0.1, counterZ0 - 0.05, counterZ1 + 0.08);
    contactShadow(counterCX, counterZ1 + 0.1, counterW + 0.4, 0.5);

    // Barista's back shelf under the boards
    batch.add(rbox(hw * 0.9, 0.04, 0.25, 0.01), toon('#8B6F47'), matrix(-hw * 0.5, 0.95, 0.13));
    const shelfTop = 0.97;
    let bx = -hw + 0.35;
    // Mugs on saucers, with handles
    for (let i = 0; i < 3; i++, bx += 0.26) {
        batch.add(cyl(0.075, 0.075, 0.012, 24), toon('#ffffff'), matrix(bx, shelfTop + 0.006, 0.14));
        batch.add(cyl(0.045, 0.038, 0.08, 20), toon(i === 1 ? COLORS.green : '#ffffff'), matrix(bx, shelfTop + 0.052, 0.14));
        batch.add(new THREE.TorusGeometry(0.024, 0.007, 8, 16), toon(i === 1 ? COLORS.green : '#ffffff'), matrix(bx + 0.05, shelfTop + 0.055, 0.14));
    }
    // Syrup bottles: body, neck, pump cap
    bx += 0.08;
    ['#8a3b2a', '#c7892f', '#5b7a3a', '#6b3f6b'].forEach(color => {
        batch.add(cyl(0.035, 0.035, 0.2, 16), toon(color), matrix(bx, shelfTop + 0.1, 0.13));
        batch.add(cyl(0.015, 0.03, 0.05, 12), toon(color), matrix(bx, shelfTop + 0.225, 0.13));
        batch.add(cyl(0.012, 0.012, 0.05, 10), toon('#1d1d1d'), matrix(bx, shelfTop + 0.275, 0.13));
        bx += 0.11;
    });
    // A leaning tower of takeaway cups with green sleeves and lids
    bx += 0.1;
    for (let k = 0; k < 5; k++) {
        batch.add(cyl(0.045, 0.035, 0.11, 18), toon('#f4efe4'), matrix(bx, shelfTop + 0.055 + k * 0.035, 0.13));
    }
    batch.add(cyl(0.044, 0.04, 0.04, 18), toon(COLORS.green), matrix(bx, shelfTop + 0.05, 0.13));
    batch.add(cyl(0.048, 0.048, 0.015, 18), toon('#ffffff'), matrix(bx + 0.13, shelfTop + 0.0075, 0.13));
    batch.add(cyl(0.045, 0.035, 0.11, 18), toon('#f4efe4'), matrix(bx + 0.13, shelfTop + 0.07, 0.13));
    batch.add(cyl(0.044, 0.04, 0.04, 18), toon(COLORS.green), matrix(bx + 0.13, shelfTop + 0.065, 0.13));
    batch.add(cyl(0.048, 0.046, 0.016, 18), toon('#2a2220'), matrix(bx + 0.13, shelfTop + 0.133, 0.13));

    /* ------------------------------------------------------------------
       ESPRESSO MACHINE (interactive)
       ------------------------------------------------------------------ */
    const machine = new THREE.Group();
    const machineX = X(0.06 * W) + 0.44;
    machine.position.set(machineX, counterTop, 1.12);
    scene.add(machine);
    const mpart = (geo, color, x, y, z, opts) => { const m = new THREE.Mesh(geo, toon(color, opts)); m.position.set(x, y, z); outline(m); machine.add(m); return m; };
    mpart(rbox(0.93, 0.1, 0.66, 0.01), '#111111', 0, 0.05, 0.07);
    mpart(rbox(0.84, 0.036, 0.62, 0.008), '#4a7c4f', 0, 0.118, 0.08);
    mpart(rbox(0.79, 0.35, 0.42, 0.02), '#bcb0af', 0, 0.31, -0.02);
    mpart(rbox(0.71, 0.22, 0.04, 0.03), '#776f6e', 0, 0.245, 0.2);
    mpart(rbox(0.88, 0.18, 0.46, 0.04), '#ddcfcc', 0, 0.575, 0);
    [-0.36, -0.3].forEach(x => mpart(cyl(0.022, 0.022, 0.02, 16), '#282323', x, 0.6, 0.235).rotation.x = Math.PI / 2);
    [0.28, 0.31, 0.34].forEach(x => mpart(rbox(0.014, 0.05, 0.01, 0.004), '#9b9091', x, 0.62, 0.235));
    // The display: the same Iron Pig mark as the 2D machine
    const display = new THREE.Mesh(cyl(0.05, 0.05, 0.02, 32), toon('#4a7c4f'));
    display.rotation.x = Math.PI / 2;
    display.position.set(0, 0.575, 0.235);
    outline(display);
    machine.add(display);
    const displayFace = new THREE.Mesh(new THREE.CircleGeometry(0.04, 32), glowMaterial({ map: track(logoTexture(logo, '#8db88f')) }));
    displayFace.position.set(0, 0.575, 0.252);
    machine.add(displayFace);
    // Group heads, cups and the coffee streams
    const streams = [];
    const cups = [];
    [-0.17, 0.17].forEach(x => {
        mpart(rbox(0.13, 0.044, 0.16, 0.01), '#231f20', x, 0.47, 0.25);
        mpart(cyl(0.05, 0.04, 0.05, 20), '#231f20', x, 0.43, 0.3);
        const cup = mpart(cyl(0.055, 0.042, 0.075, 24), '#ffffff', x, 0.175, 0.3);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.007, 8, 16), toon('#ffffff'));
        handle.position.set(0.06, 0, 0);
        cup.add(handle);
        // Coffee in the cup, just under the rim
        const crema = new THREE.Mesh(new THREE.CircleGeometry(0.05, 24), toon('#8a5a3c'));
        crema.rotation.x = -Math.PI / 2;
        crema.position.y = 0.0385;
        cup.add(crema);
        cups.push(cup);
        // Long enough to reach into the cup even at the shortest wobble
        // (the pour scales it to 85-90%); the cup hides the extra
        const stream = new THREE.Mesh(cyl(0.006, 0.006, 0.24, 8), toon('#74372b'));
        stream.geometry.translate(0, -0.12, 0);
        stream.position.set(x, 0.405, 0.3);
        stream.scale.y = 0.001;
        machine.add(stream);
        streams.push(stream);
    });
    const machineState = { running: false, pour: 0, timer: 0 };

    /* ------------------------------------------------------------------
       COUNTER PROPS: plant (Ni!), mug, till
       ------------------------------------------------------------------ */
    const plant = new THREE.Group();
    plant.position.set(X(0.42 * W + 35), counterTop, 1.3);
    scene.add(plant);
    const plantInner = new THREE.Group();
    plant.add(plantInner);
    const pot = new THREE.Mesh(cyl(0.075, 0.052, 0.12, 20), toon('#c97a5f'));
    pot.position.y = 0.06;
    outline(pot);
    plant.add(pot);
    const rim = new THREE.Mesh(cyl(0.08, 0.08, 0.018, 20), toon('#b56f56'));
    rim.position.y = 0.12;
    plant.add(rim);
    [[0, 0.24, 0], [-0.05, 0.2, -0.25], [0.05, 0.21, 0.3]].forEach(([x, h, tilt]) => {
        const stem = new THREE.Mesh(cyl(0.006, 0.008, h, 8), toon('#3f7a4a'));
        stem.position.set(x * 0.5, 0.12 + h / 2, 0);
        stem.rotation.z = tilt;
        plantInner.add(stem);
        const flower = new THREE.Group();
        flower.position.set(x * 0.5 - Math.sin(tilt) * h / 2 * 1.9, 0.12 + h * 0.98, 0);
        for (let p = 0; p < 5; p++) {
            const petal = new THREE.Mesh(sphere(0.022, 10, 8), toon('#e8b89a'));
            const a = (p / 5) * Math.PI * 2;
            petal.position.set(Math.cos(a) * 0.024, Math.sin(a) * 0.024, 0.01);
            petal.scale.set(1, 1, 0.5);
            flower.add(petal);
        }
        const centre = new THREE.Mesh(sphere(0.014, 10, 8), toon('#ffd700'));
        centre.position.z = 0.02;
        flower.add(centre);
        plantInner.add(flower);
    });
    for (let i = 0; i < 7; i++) {
        const leaf = new THREE.Mesh(sphere(0.04, 12, 8), toon(i % 2 ? COLORS.green : '#4a8550'));
        const a = i * 0.9;
        leaf.position.set(Math.cos(a) * 0.05, 0.16 + (i % 3) * 0.04, Math.sin(a) * 0.04);
        leaf.scale.set(1, 0.45, 0.6);
        leaf.rotation.z = Math.cos(a) * 0.7;
        outline(leaf);
        plantInner.add(leaf);
    }
    const plantState = { grow: 0, target: 0 };

    const mug = new THREE.Group();
    mug.position.set(X(0.47 * W + 40), counterTop, 1.32);
    scene.add(mug);
    // A real cup: open at the top, with an inside wall, a rim and coffee in it
    const mugBody = new THREE.Mesh(cyl(0.1, 0.095, 0.24, 32, true), toon('#ffffff', { map: track(mugTexture(logo)) }));
    mugBody.rotation.y = Math.PI;
    mugBody.position.y = 0.12;
    outline(mugBody);
    mug.add(mugBody);
    const mugInside = new THREE.Mesh(cyl(0.091, 0.087, 0.235, 32, true), toon('#efe9dc', { side: THREE.BackSide }));
    mugInside.position.y = 0.122;
    mug.add(mugInside);
    const mugRim = new THREE.Mesh(new THREE.TorusGeometry(0.0955, 0.0055, 8, 40), toon('#ffffff'));
    mugRim.rotation.x = Math.PI / 2;
    mugRim.position.y = 0.24;
    mug.add(mugRim);
    const mugBase = new THREE.Mesh(new THREE.CircleGeometry(0.095, 32), toon('#e8e2d4'));
    mugBase.rotation.x = Math.PI / 2;
    mugBase.position.y = 0.001;
    mug.add(mugBase);
    const coffeeTop = new THREE.Mesh(new THREE.CircleGeometry(0.089, 32), toon('#3d2218'));
    coffeeTop.rotation.x = -Math.PI / 2;
    coffeeTop.position.y = 0.205;
    mug.add(coffeeTop);
    const crema = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.088, 32), toon('#7a4a2e'));
    crema.rotation.x = -Math.PI / 2;
    crema.position.y = 0.206;
    mug.add(crema);
    const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 10, 20, Math.PI * 1.2), toon(COLORS.green));
    mugHandle.rotation.z = -Math.PI * 0.6;
    mugHandle.position.set(0.1, 0.13, 0);
    outline(mugHandle);
    mug.add(mugHandle);

    // The till / order point at the end of the counter
    const till = new THREE.Group();
    const plantX = X(0.42 * W + 35);
    till.position.set(plantX - 0.5, counterTop, 1.3);
    scene.add(till);
    const tillBody = new THREE.Mesh(rbox(0.3, 0.14, 0.24, 0.02), toon(COLORS.green));
    tillBody.position.y = 0.07;
    outline(tillBody);
    till.add(tillBody);
    const tillScreen = new THREE.Mesh(rbox(0.2, 0.13, 0.02, 0.008), toon('#1a1a1a'));
    tillScreen.position.set(0, 0.2, -0.05);
    tillScreen.rotation.x = -0.3;
    outline(tillScreen);
    till.add(tillScreen);
    const tillGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.1), glowMaterial({
        map: track(labelTexture(256, 150, '#0f1a12', [{ text: 'ORDER', size: 34, weight: 700, color: COLORS.accent, spacing: 4 }, { text: 'HERE ☕', size: 30, color: '#e8f5c8' }]))
    }));
    tillGlow.position.set(0, 0.2, -0.032);
    tillGlow.rotation.x = -0.3;
    till.add(tillGlow);
    // A-frame chalk sign on the counter
    const aframe = new THREE.Group();
    aframe.position.set(plantX - 0.98, counterTop, 1.42);
    aframe.rotation.y = 0.25;
    scene.add(aframe);
    const signTex = track(labelTexture(256, 320, COLORS.chalkWarm, [
        { text: 'Today\'s', size: 34, script: true, color: COLORS.text },
        { text: 'special', size: 34, script: true, color: COLORS.text },
        { text: 'FRESHLY', size: 26, weight: 700, color: COLORS.accent, spacing: 2 },
        { text: 'SHIPPED', size: 26, weight: 700, color: COLORS.accent, spacing: 2 },
        { text: 'hold the drama', size: 24, italic: true, color: COLORS.label }
    ], { border: '#8B6F47' }));
    const aBoard = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.25), toon('#ffffff', { map: signTex }));
    aBoard.position.set(0, 0.125, 0.03);
    aBoard.rotation.x = -0.18;
    aframe.add(aBoard);
    const aBack = new THREE.Mesh(rbox(0.21, 0.26, 0.012, 0.004), toon('#8B6F47'));
    aBack.position.set(0, 0.125, 0.018);
    aBack.rotation.x = -0.18;
    outline(aBack);
    aframe.add(aBack);
    const aLeg = new THREE.Mesh(rbox(0.21, 0.26, 0.012, 0.004), toon('#8B6F47'));
    aLeg.position.set(0, 0.125, -0.03);
    aLeg.rotation.x = 0.18;
    aframe.add(aLeg);

    /* ------------------------------------------------------------------
       CHALKBOARDS - painted from the 2D page's own text
       ------------------------------------------------------------------ */
    const boards = {};
    Object.entries(layout.boards).forEach(([id, r]) => {
        const data = content.boards[id];
        if (!data) return;
        const group = new THREE.Group();
        const cx = X(r.x + r.w / 2);
        const cy = Y(r.y + r.h / 2);
        group.position.set(cx, cy, 0.03);
        // Hang from the top edge so hover leans swing like a real sign
        const pivot = new THREE.Group();
        pivot.position.y = (r.h / 2) * PX;
        group.add(pivot);
        const frame = new THREE.Mesh(rbox(r.w * PX, r.h * PX, 0.045, 0.01), toon('#8B6F47'));
        frame.position.y = -(r.h / 2) * PX;
        outline(frame);
        pivot.add(frame);
        const faceTex = track(boardTexture(data, r.w - 16, r.h - 16));
        const face = new THREE.Mesh(new THREE.PlaneGeometry((r.w - 16) * PX, (r.h - 16) * PX), glowMaterial({ map: faceTex, color: '#ffffff' }));
        face.position.set(0, -(r.h / 2) * PX, 0.028);
        pivot.add(face);
        // Two little hanging strings to the top edge
        [-0.3, 0.3].forEach(f => {
            const string = new THREE.Mesh(cyl(0.003, 0.003, 0.14, 6), toon('#3a3230'));
            string.position.set(f * r.w * PX, 0.06, -0.01);
            string.rotation.z = -f * 0.6;
            pivot.add(string);
        });
        scene.add(group);
        boards[id] = { group, pivot, face, lean: new THREE.Vector2(), leanTarget: new THREE.Vector2(), rect: r, cx, cy };
    });

    /* ------------------------------------------------------------------
       NEON SIGN
       ------------------------------------------------------------------ */
    const neon = new THREE.Group();
    neon.position.set(X(W / 2), Y(0.42 * H), 0.05);
    scene.add(neon);
    let neonStyle = 0;
    let neonTex = neonTextures();
    const neonPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(neonTex.widthPx * PX, neonTex.heightPx * PX),
        glowMaterial({ map: neonTex.sign, transparent: true, depthWrite: false })
    );
    neonPlane.position.z = 0.02;
    neon.add(neonPlane);
    const neonGlowMat = glowMaterial({
        map: track(radialTexture([[0, 'rgba(255,255,255,0.75)'], [0.35, 'rgba(255,255,255,0.45)'], [0.7, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']])),
        color: '#7d8a5e', transparent: true, depthWrite: false, opacity: 0.75
    });
    const neonGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.9), neonGlowMat);
    neonGlow.raycast = () => {};
    neon.add(neonGlow);
    // After dark the tube really glows
    const neonBloomMat = glowMaterial({
        map: neonGlowMat.map, color: NEON_STYLES[0].glow, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0
    });
    const neonBloom = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.5), neonBloomMat);
    neonBloom.position.z = 0.01;
    neonBloom.raycast = () => {};
    neon.add(neonBloom);
    const neonLight = new THREE.PointLight(NEON_STYLES[0].light, 1.2, 4, 1.5);
    neonLight.position.set(0, 0, 0.6);
    neon.add(neonLight);

    function cycleNeon() {
        neonStyle = (neonStyle + 1) % NEON_STYLES.length;
        const style = NEON_STYLES[neonStyle];
        const next = neonTextures(style.color, style.glow);
        neonPlane.material.map.dispose();
        neonPlane.material.map = next.sign;
        neonPlane.material.needsUpdate = true;
        neonTex = next;
        neonGlowMat.color.set(style.glow).multiplyScalar(0.6);
        neonBloomMat.color.set(style.glow);
        neonLight.color.set(style.light);
        return neonStyle;
    }

    /* ------------------------------------------------------------------
       SHELVES
       ------------------------------------------------------------------ */
    const shelfX = X(0.28 * W + 60) + 0.3;
    [Y(0.17 * H), Y(0.27 * H)].forEach((top, i) => {
        batch.add(rbox(0.6, 0.032, 0.22, 0.008), toon('#8B6F47'), matrix(shelfX, top - 0.016, 0.11));
        [-0.24, 0.24].forEach(dx => batch.add(rbox(0.02, 0.08, 0.16, 0.004), toon('#6d5737'), matrix(shelfX + dx, top - 0.07, 0.08), { outlined: false }));
        if (i === 0) {
            [-0.22, -0.09, 0.04].forEach(dx => {
                batch.add(rbox(0.11, 0.16, 0.08, 0.01), toon('#8B6F47'), matrix(shelfX + dx, top + 0.08, 0.11));
                batch.add(cyl(0.035, 0.035, 0.005, 20), toon(COLORS.green), matrix(shelfX + dx, top + 0.1, 0.152, Math.PI / 2), { outlined: false });
            });
            batch.add(cyl(0.035, 0.026, 0.06, 16), toon('#c97a5f'), matrix(shelfX + 0.2, top + 0.03, 0.11));
            batch.add(sphere(0.045, 12, 8), toon('#4a8550'), matrix(shelfX + 0.2, top + 0.1, 0.11));
        } else {
            batch.add(cyl(0.04, 0.03, 0.07, 16), toon('#1d1d1d'), matrix(shelfX - 0.22, top + 0.035, 0.11));
            batch.add(sphere(0.05, 12, 8), toon('#4a8550'), matrix(shelfX - 0.22, top + 0.11, 0.11));
            [-0.08, 0.04].forEach(dx => {
                batch.add(cyl(0.045, 0.045, 0.12, 20), toon('#b49a78', { transparent: true, opacity: 0.85 }), matrix(shelfX + dx, top + 0.06, 0.11));
                batch.add(cyl(0.047, 0.047, 0.025, 20), toon('#8B6F47'), matrix(shelfX + dx, top + 0.13, 0.11));
            });
            [0, 1, 2].forEach(k => batch.add(cyl(0.05, 0.035, 0.045, 20), toon('#ffffff'), matrix(shelfX + 0.2, top + 0.025 + k * 0.035, 0.11)));
        }
    });

    /* ------------------------------------------------------------------
       PENDANT LAMPS
       ------------------------------------------------------------------ */
    const lamps = [];
    const coneMats = [];
    function pendant(x, z, y0, parent = scene, cordLength = 22 * PX) {
        const shadeTop = y0 - cordLength;
        batch.add(cyl(0.004, 0.004, cordLength + 0.02, 6), toon('#3a3230'), matrix(x, y0 - cordLength / 2, z), { outlined: false });
        const shadeGeo = new THREE.LatheGeometry([
            new THREE.Vector2(0.02, 0), new THREE.Vector2(0.05, -0.03), new THREE.Vector2(0.09, -0.1), new THREE.Vector2(0.115, -0.16), new THREE.Vector2(0.11, -0.165)
        ], 28);
        batch.add(shadeGeo, toon('#8B6F47', { side: THREE.DoubleSide }), matrix(x, shadeTop, z));
        const bulb = new THREE.Mesh(sphere(0.035, 14, 10), glowMaterial({ color: '#fff3c4' }));
        bulb.position.set(x, shadeTop - 0.15, z);
        parent.add(bulb);
        const coneMat = glowConeMaterial('#ffdc96', 0.22);
        const coneH = Math.min(2.4, shadeTop - 0.4);
        const cone = new THREE.Mesh(cyl(0.11, 1.15, coneH, 32, true), coneMat);
        cone.position.set(x, shadeTop - 0.16 - coneH / 2, z);
        cone.raycast = () => {};
        parent.add(cone);
        coneMats.push(coneMat);
        const light = new THREE.PointLight('#ffd59a', 1.4, 6, 1.4);
        light.position.set(x, shadeTop - 0.25, z);
        parent.add(light);
        lamps.push({ light, bulb });
    }
    pendant(X(0.25 * W + 30), 0.75, ceil);
    pendant(X(0.75 * W + 30), 0.75, ceil);

    /* ------------------------------------------------------------------
       TABLE & STOOLS
       ------------------------------------------------------------------ */
    const tableX = X(W - 300);
    const tableZ = 3.2;
    batch.add(cyl(0.42, 0.42, 0.048, 40), toon(COLORS.tableWood), matrix(tableX, 0.776, tableZ));
    batch.add(cyl(0.035, 0.07, 0.75, 16), toon(COLORS.tableLeg), matrix(tableX, 0.39, tableZ));
    batch.add(cyl(0.22, 0.24, 0.03, 32), toon(COLORS.tableLeg), matrix(tableX, 0.015, tableZ));
    contactShadow(tableX, tableZ, 1.2);
    block(tableX - 0.42, tableX + 0.42, tableZ - 0.42, tableZ + 0.42);
    [[-0.68, 0], [0.68, 0]].forEach(([dx, dz]) => {
        const sx = tableX + dx;
        const sz = tableZ + dz;
        batch.add(cyl(0.14, 0.14, 0.05, 28), toon(COLORS.tableWood), matrix(sx, 0.52, sz));
        batch.add(cyl(0.016, 0.016, 0.5, 10), toon(COLORS.tableLeg), matrix(sx, 0.25, sz));
        batch.add(new THREE.TorusGeometry(0.1, 0.008, 8, 24), toon(COLORS.tableLeg), matrix(sx, 0.2, sz, Math.PI / 2), { outlined: false });
        batch.add(cyl(0.12, 0.13, 0.02, 24), toon(COLORS.tableLeg), matrix(sx, 0.01, sz));
        contactShadow(sx, sz, 0.45);
        block(sx - 0.15, sx + 0.15, sz - 0.15, sz + 0.15);
    });
    // "Reserved" card on the table
    const reserved = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), toon('#ffffff', {
        map: track(labelTexture(320, 200, '#f6f0e1', [
            { text: 'RESERVED', size: 40, weight: 700, color: COLORS.counter, spacing: 4 },
            { text: 'for your next project', size: 28, italic: true, color: '#6b5a48' }
        ], { border: '#8B6F47' })),
        side: THREE.DoubleSide
    }));
    reserved.position.set(tableX, 0.85, tableZ + 0.05);
    reserved.rotation.x = -0.25;
    scene.add(reserved);
    batch.add(cyl(0.05, 0.045, 0.1, 20), toon('#ffffff'), matrix(tableX + 0.2, 0.85, tableZ - 0.12));

    /* ------------------------------------------------------------------
       FRONT WALL: windows on London, the exit door, the light switch
       (only drawn once the camera is inside the room)
       ------------------------------------------------------------------ */
    const front = new THREE.Group();
    scene.add(front);
    const winW = 1.6;
    const winX = hw - 1.4;
    const frontWall = wall(s => {
        rect(s, -hw, 0, hw, ceil);
        hole(s, -0.6, 0, 0.6, 2.25);
        hole(s, -winX - winW / 2, 0.95, -winX + winW / 2, 2.35);
        hole(s, winX - winW / 2, 0.95, winX + winW / 2, 2.35);
    }, wallMat, m => {
        m.rotation.y = Math.PI;
        m.position.z = D;
    });
    scene.remove(frontWall);
    front.add(frontWall);
    const dayTex = track(skylineTexture(false));
    // A plane showing the middle of the 2:1 skyline at its true proportions
    const skylinePane = (pw, ph) => {
        const g = new THREE.PlaneGeometry(pw, ph);
        const keep = Math.min(1, pw / ph / 2);
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, 0.5 + (uv.getX(i) - 0.5) * keep);
        return g;
    };
    const nightTex = track(skylineTexture(true));
    const nightPanes = [];
    function windowView(x, y, z, w, h, rotY = 0, parent = front, depth = 0.8) {
        const view = new THREE.Group();
        view.position.set(x, y, z);
        view.rotation.y = rotY;
        parent.add(view);
        // The skyline is painted 2:1; crop its middle to the pane's shape
        // instead of squashing it (that made the moon an egg)
        const paneGeo = () => skylinePane(w * 1.6, h * 1.5);
        const day = new THREE.Mesh(paneGeo(), glowMaterial({ map: dayTex }));
        day.position.z = -depth;
        view.add(day);
        const night = new THREE.Mesh(paneGeo(), glowMaterial({ map: nightTex, transparent: true, opacity: 0 }));
        night.position.z = -depth + 0.01;
        view.add(night);
        nightPanes.push(night);
        // Frame, mullions, sill
        const frameMat = toon('#2E5E3F');
        [[0, h / 2, w + 0.1, 0.06], [0, -h / 2, w + 0.1, 0.06]].forEach(([fx, fy, fw, fh]) => {
            const bar = new THREE.Mesh(rbox(fw, fh, 0.12, 0.01), frameMat);
            bar.position.set(fx, fy, -0.02);
            outline(bar);
            view.add(bar);
        });
        [-w / 2, 0, w / 2].forEach(fx => {
            const bar = new THREE.Mesh(rbox(0.05, h, 0.1, 0.01), frameMat);
            bar.position.set(fx, 0, -0.02);
            outline(bar);
            view.add(bar);
        });
        const sill = new THREE.Mesh(rbox(w + 0.25, 0.04, 0.22, 0.01), toon(COLORS.wood));
        sill.position.set(0, -h / 2 - 0.04, 0.08);
        outline(sill);
        view.add(sill);
        return view;
    }
    const winY = (0.95 + 2.35) / 2;
    windowView(-winX, winY, D, winW, 1.4, Math.PI);
    windowView(winX, winY, D, winW, 1.4, Math.PI);
    // Window lettering facing in (mirror-reads "IRON PIG CAFÉ" from inside)
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), glowMaterial({
        map: track(labelTexture(512, 128, null, [{ text: 'Iron Pig', size: 64, script: true, color: '#f5f5dc' }])),
        transparent: true, depthWrite: false, opacity: 0.85, side: THREE.DoubleSide
    }));
    decal.position.set(winX, 2.0, D - 0.03);
    decal.rotation.y = Math.PI;
    decal.scale.x = -1;
    front.add(decal);

    // The exit door
    const door = new THREE.Group();
    door.position.set(0, 0, D);
    front.add(door);
    const doorLeaf = new THREE.Mesh(rbox(1.16, 2.2, 0.06, 0.015), toon(COLORS.green));
    doorLeaf.position.set(0, 1.1, 0.02);
    outline(doorLeaf);
    door.add(doorLeaf);
    const doorGlassDay = new THREE.Mesh(skylinePane(0.8, 1.0), glowMaterial({ map: dayTex }));
    doorGlassDay.position.set(0, 1.45, -0.02);
    doorGlassDay.rotation.y = Math.PI;
    door.add(doorGlassDay);
    const doorGlassNight = new THREE.Mesh(skylinePane(0.8, 1.0), glowMaterial({ map: nightTex, transparent: true, opacity: 0 }));
    doorGlassNight.position.set(0, 1.45, -0.026);
    doorGlassNight.rotation.y = Math.PI;
    door.add(doorGlassNight);
    nightPanes.push(doorGlassNight);
    const handle = new THREE.Mesh(cyl(0.015, 0.015, 0.3, 10), toon('#c9a87a'));
    handle.position.set(-0.42, 1.05, -0.06);
    outline(handle);
    door.add(handle);
    [[-0.62, 1.15, 0.08, 2.35], [0.62, 1.15, 0.08, 2.35], [0, 2.3, 1.32, 0.1]].forEach(([fx, fy, fw, fh]) => {
        const trim = new THREE.Mesh(rbox(fw, fh, 0.1, 0.01), toon('#8B6F47'));
        trim.position.set(fx, fy, -0.03);
        outline(trim);
        door.add(trim);
    });
    const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.26), glowMaterial({
        map: track(labelTexture(400, 208, COLORS.chalkWarm, [
            { text: 'Thanks for', size: 38, script: true, color: COLORS.text },
            { text: 'stopping by', size: 38, script: true, color: COLORS.text },
            { text: 'EXIT TO 2D →', size: 28, weight: 700, color: COLORS.accent, spacing: 2 }
        ], { border: '#8B6F47' }))
    }));
    exitSign.position.set(0, 1.45, -0.08);
    exitSign.rotation.y = Math.PI;
    door.add(exitSign);
    block(-hw, hw, D - 0.05, D + 0.3);

    // Light switch
    const lightSwitch = new THREE.Group();
    lightSwitch.position.set(0.95, 1.35, D - 0.02);
    lightSwitch.rotation.y = Math.PI;
    front.add(lightSwitch);
    const plate = new THREE.Mesh(rbox(0.1, 0.14, 0.02, 0.008), toon('#f4efe4'));
    outline(plate);
    lightSwitch.add(plate);
    const toggle = new THREE.Mesh(rbox(0.03, 0.05, 0.03, 0.006), toon('#c9a87a'));
    toggle.position.z = 0.02;
    toggle.rotation.x = -0.35;
    lightSwitch.add(toggle);
    const switchLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.07), glowMaterial({
        map: track(labelTexture(256, 76, null, [{ text: 'lights', size: 34, script: true, color: '#5a4a3a' }])), transparent: true
    }));
    switchLabel.position.set(0, 0.13, 0.01);
    lightSwitch.add(switchLabel);

    // Plants on the window sills (part of the front wall, so hidden from outside)
    [-winX, winX].forEach((x, i) => {
        const sillPot = new THREE.Mesh(cyl(0.07, 0.05, 0.12, 16), toon('#c97a5f'));
        sillPot.position.set(x + (i ? -0.5 : 0.5), 0.97, D - 0.12);
        outline(sillPot);
        front.add(sillPot);
        const sillLeaves = new THREE.Mesh(sphere(0.09, 12, 8), toon('#4a8550'));
        sillLeaves.position.set(x + (i ? -0.5 : 0.5), 1.1, D - 0.12);
        outline(sillLeaves);
        front.add(sillLeaves);
    });

    /* ------------------------------------------------------------------
       KITCHEN TABLE HQ - the back room
       ------------------------------------------------------------------ */
    const kitchen = new THREE.Group();
    scene.add(kitchen);
    const kcx = (kx0 + kx1) / 2;
    const plaster = track(plasterTexture('#c9d6c2'));
    plaster.repeat.set(1, 1);
    const kWallMat = lambert('#ffffff', { map: plaster });
    const kWall = (shapeFn, place) => { const m = wall(shapeFn, kWallMat, place); scene.remove(m); kitchen.add(m); return m; };
    // Shared wall, kitchen side (faces -x)
    kWall(s => { rect(s, kz0, 0, kz1, ceil); hole(s, doorZ0, 0, doorZ1, 2.15); }, m => {
        m.rotation.y = -Math.PI / 2;
        m.position.x = kx1;
    });
    // Back (faces +z)
    kWall(s => rect(s, kx0, 0, kx1, ceil), m => { m.position.z = kz0; });
    // Front (faces -z)
    kWall(s => rect(s, -kx1, 0, -kx0, ceil), m => { m.rotation.y = Math.PI; m.position.z = kz1; });
    // Far wall with a window (faces +x)
    kWall(s => { rect(s, -kz1, 0, -kz0, ceil); hole(s, -3.8, 1.0, -2.4, 2.2); }, m => {
        m.rotation.y = Math.PI / 2;
        m.position.x = kx0;
    });
    windowView(kx0, 1.6, 3.1, 1.4, 1.2, Math.PI / 2, kitchen, 0.8);
    // Door jambs through the wall thickness
    [[doorZ0 - 0.04, 0.08], [doorZ1 + 0.04, 0.08]].forEach(([z, w]) => {
        batch.add(rbox(WALL + 0.06, 2.2, w, 0.01), toon('#8B6F47'), matrix(-hw - WALL / 2, 1.1, z));
    });
    batch.add(rbox(WALL + 0.06, 0.1, doorZ1 - doorZ0 + 0.16, 0.01), toon('#8B6F47'), matrix(-hw - WALL / 2, 2.2, (doorZ0 + doorZ1) / 2));
    batch.add(new THREE.BoxGeometry(WALL + 0.04, 0.012, doorZ1 - doorZ0), toon('#8B6F47'), matrix(-hw - WALL / 2, 0.006, (doorZ0 + doorZ1) / 2), { outlined: false });
    // "Staff only" sign over the doorway, café side
    const staffSign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), glowMaterial({
        map: track(labelTexture(600, 200, COLORS.chalkWarm, [
            { text: 'STAFF ONLY*', size: 54, weight: 700, color: COLORS.text, spacing: 5 },
            { text: '*that\'s me. Kitchen Table HQ →', size: 30, italic: true, color: COLORS.accent }
        ], { border: '#8B6F47' }))
    }));
    staffSign.position.set(-hw + 0.02, 2.55, (doorZ0 + doorZ1) / 2);
    staffSign.rotation.y = Math.PI / 2;
    scene.add(staffSign);

    // Kitchen floor and ceiling
    const checker = track(checkerTexture());
    checker.repeat.set(1 / 0.8, 1 / 0.8);
    const kFloorGeo = new THREE.PlaneGeometry(kx1 - kx0, kz1 - kz0);
    kFloorGeo.rotateX(-Math.PI / 2);
    kFloorGeo.translate(kcx, 0, (kz0 + kz1) / 2);
    remapUVToWorld(kFloorGeo, 'x', 'z');
    const kFloor = new THREE.Mesh(kFloorGeo, lambert('#ffffff', { map: checker }));
    kitchen.add(kFloor);
    occluders.push(kFloor);
    const kCeil = new THREE.Mesh(new THREE.PlaneGeometry(kx1 - kx0 + WALL, kz1 - kz0), lambert('#f3ecdc'));
    kCeil.rotation.x = Math.PI / 2;
    kCeil.position.set(kcx, ceil, (kz0 + kz1) / 2);
    kitchen.add(kCeil);
    block(kx0 - 0.2, kx0, kz0, kz1);
    block(kx0, kx1, kz0 - 0.2, kz0);
    block(kx0, kx1, kz1, kz1 + 0.2);
    // The shared wall either side of the doorway, and the café's own walls
    block(-hw - WALL - 0.02, -hw, 0, doorZ0);
    block(-hw - WALL - 0.02, -hw, doorZ1, D);
    block(hw, hw + 0.2, 0, D);
    block(-hw, hw, -0.2, 0);

    // Kitchen run along the back wall: fridge, cabinets, sink, kettle
    const tiles = track(subwayTileTexture());
    tiles.repeat.set(1 / 0.5, 1 / 0.25);
    const splashGeo = new THREE.PlaneGeometry(2.2, 0.6);
    remapUVToWorld(splashGeo, 'x', 'y');
    const splash = new THREE.Mesh(splashGeo, lambert('#ffffff', { map: tiles }));
    splash.position.set(kx0 + 2.05, 1.25, kz0 + 0.005);
    kitchen.add(splash);
    const runX0 = kx0 + 0.95;
    const runX1 = kx0 + 3.15;
    const runCX = (runX0 + runX1) / 2;
    batch.add(rbox(runX1 - runX0, 0.72, 0.62, 0.015), toon('#7a9a7c'), matrix(runCX, 0.36, kz0 + 0.31));
    // Rail under the worktop (the cabinet stops short so the sink basin fits)
    batch.add(rbox(runX1 - runX0, 0.15, 0.03, 0.008), toon('#7a9a7c'), matrix(runCX, 0.785, kz0 + 0.605));
    [runX0 + 0.015, runX1 - 0.015].forEach(x => batch.add(rbox(0.03, 0.15, 0.62, 0.008), toon('#7a9a7c'), matrix(x, 0.785, kz0 + 0.31), { outlined: false }));
    for (let x = runX0 + 0.28; x < runX1; x += 0.55) {
        batch.add(rbox(0.48, 0.66, 0.02, 0.01), toon('#8fa890'), matrix(x, 0.46, kz0 + 0.625), { outlined: false });
        batch.add(rbox(0.12, 0.02, 0.02, 0.006), toon('#c9a87a'), matrix(x, 0.72, kz0 + 0.64), { outlined: false });
    }
    const topY = 0.91;
    const wood = toon('#b8865a');
    const steel = toon('#c3cacd');
    const steelDark = toon('#8d979b');
    const wx0 = runX0 - 0.02;
    const wx1 = runX1 + 0.02;
    const wz0 = kz0;
    const wz1 = kz0 + 0.66;
    const sinkX = runCX + 0.3;
    const sinkZ = kz0 + 0.37;
    const sinkW = 0.5;
    const sinkD = 0.34;
    const sinkDepth = 0.17;
    const sx0 = sinkX - sinkW / 2;
    const sx1 = sinkX + sinkW / 2;
    const sz0 = sinkZ - sinkD / 2;
    const sz1 = sinkZ + sinkD / 2;
    // Worktop in four pieces around the opening
    batch.add(rbox(sx0 - wx0, 0.05, wz1 - wz0, 0.004), wood, matrix((wx0 + sx0) / 2, topY - 0.025, (wz0 + wz1) / 2));
    batch.add(rbox(wx1 - sx1, 0.05, wz1 - wz0, 0.004), wood, matrix((sx1 + wx1) / 2, topY - 0.025, (wz0 + wz1) / 2));
    batch.add(new THREE.BoxGeometry(sinkW, 0.05, sz0 - wz0), wood, matrix(sinkX, topY - 0.025, (wz0 + sz0) / 2), { outlined: false });
    batch.add(new THREE.BoxGeometry(sinkW, 0.05, wz1 - sz1), wood, matrix(sinkX, topY - 0.025, (sz1 + wz1) / 2), { outlined: false });
    // The basin: floor, four walls, a drain
    const basinY = topY - sinkDepth;
    batch.add(new THREE.BoxGeometry(sinkW - 0.02, 0.01, sinkD - 0.02), steelDark, matrix(sinkX, basinY, sinkZ), { outlined: false });
    batch.add(new THREE.BoxGeometry(sinkW, sinkDepth, 0.01), steel, matrix(sinkX, basinY + sinkDepth / 2, sz0 + 0.005), { outlined: false });
    batch.add(new THREE.BoxGeometry(sinkW, sinkDepth, 0.01), steel, matrix(sinkX, basinY + sinkDepth / 2, sz1 - 0.005), { outlined: false });
    batch.add(new THREE.BoxGeometry(0.01, sinkDepth, sinkD), steel, matrix(sx0 + 0.005, basinY + sinkDepth / 2, sinkZ), { outlined: false });
    batch.add(new THREE.BoxGeometry(0.01, sinkDepth, sinkD), steel, matrix(sx1 - 0.005, basinY + sinkDepth / 2, sinkZ), { outlined: false });
    batch.add(cyl(0.028, 0.028, 0.006, 20), toon('#3b3f41'), matrix(sinkX, basinY + 0.008, sinkZ), { outlined: false });
    batch.add(cyl(0.014, 0.014, 0.007, 16), steel, matrix(sinkX, basinY + 0.01, sinkZ), { outlined: false });
    // Steel rim round the opening
    batch.add(new THREE.BoxGeometry(sinkW + 0.03, 0.006, 0.018), steel, matrix(sinkX, topY + 0.003, sz0 - 0.004), { outlined: false });
    batch.add(new THREE.BoxGeometry(sinkW + 0.03, 0.006, 0.018), steel, matrix(sinkX, topY + 0.003, sz1 + 0.004), { outlined: false });
    batch.add(new THREE.BoxGeometry(0.018, 0.006, sinkD), steel, matrix(sx0 - 0.004, topY + 0.003, sinkZ), { outlined: false });
    batch.add(new THREE.BoxGeometry(0.018, 0.006, sinkD), steel, matrix(sx1 + 0.004, topY + 0.003, sinkZ), { outlined: false });
    // Gooseneck tap on a round base, with two levers (interactive: it runs)
    const tapZ = kz0 + 0.1;
    const tap = new THREE.Group();
    tap.position.set(sinkX, topY, tapZ);
    kitchen.add(tap);
    const tpart = (geo, mat, x, y, z, parent = tap) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); outline(m); parent.add(m); return m; };
    tpart(cyl(0.03, 0.034, 0.03, 20), steel, 0, 0.015, 0);
    const neck = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(0, 0.29, 0.05),
        new THREE.Vector3(0, 0.27, 0.13), new THREE.Vector3(0, 0.21, 0.155)
    ]);
    tpart(new THREE.TubeGeometry(neck, 32, 0.013, 12, false), steel, 0, 0.02, 0);
    tpart(cyl(0.016, 0.013, 0.025, 12), steelDark, 0, 0.22, 0.155);
    const tapLevers = [-1, 1].map(side => {
        tpart(cyl(0.016, 0.018, 0.035, 14), steel, side * 0.09, 0.0175, 0);
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.09, 0.035, 0);
        tap.add(pivot);
        const lever = tpart(rbox(0.012, 0.012, 0.06, 0.004), steel, 0, 0.005, 0.025, pivot);
        lever.rotation.x = -0.35;
        return pivot;
    });
    // Running water: from the spout down into the basin
    const waterLen = 0.2075 + sinkDepth;
    const water = new THREE.Mesh(cyl(0.007, 0.009, waterLen, 10), toon('#a9d8f0', { transparent: true, opacity: 0.75 }));
    water.geometry.translate(0, -waterLen / 2, 0);
    water.position.set(0, 0.2075, 0.155);
    water.visible = false;
    water.raycast = () => {};
    tap.add(water);
    const splashRing = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.03, 20), toon('#d6eef9', { transparent: true, opacity: 0.6 }));
    splashRing.rotation.x = -Math.PI / 2;
    splashRing.position.set(0, -sinkDepth + 0.012, 0.155);
    splashRing.visible = false;
    splashRing.raycast = () => {};
    tap.add(splashRing);
    const tapState = { on: false, flow: 0 };
    // A sponge and a bottle of washing-up liquid
    batch.add(rbox(0.1, 0.035, 0.065, 0.008), toon('#f2c94c'), matrix(sx1 + 0.12, topY + 0.0175, sinkZ + 0.05, 0, 0.3));
    batch.add(rbox(0.1, 0.012, 0.065, 0.004), toon('#4a8550'), matrix(sx1 + 0.12, topY + 0.041, sinkZ + 0.05, 0, 0.3), { outlined: false });
    batch.add(cyl(0.028, 0.032, 0.17, 16), toon('#6fbf73'), matrix(sx1 + 0.12, topY + 0.085, tapZ + 0.03));
    batch.add(cyl(0.01, 0.014, 0.03, 10), toon('#ffffff'), matrix(sx1 + 0.12, topY + 0.185, tapZ + 0.03));
    // Kettle
    batch.add(cyl(0.08, 0.1, 0.2, 24), toon('#2E5E3F'), matrix(runCX - 0.55, 1.01, kz0 + 0.3));
    batch.add(cyl(0.03, 0.05, 0.03, 16), toon('#1d1d1d'), matrix(runCX - 0.55, 1.125, kz0 + 0.3));
    batch.add(new THREE.TorusGeometry(0.06, 0.012, 8, 16, Math.PI), toon('#1d1d1d'), matrix(runCX - 0.55, 1.1, kz0 + 0.3, 0, Math.PI / 2));
    // Jars of beans
    [0, 1, 2].forEach(i => batch.add(cyl(0.05, 0.05, 0.14 - i * 0.02, 16), toon('#74372b'), matrix(runX0 + 0.2 + i * 0.13, 0.98 - i * 0.01, kz0 + 0.2)));
    block(runX0, runX1, kz0, kz0 + 0.68);

    // Fridge, covered in notes (interactive)
    const fridge = new THREE.Group();
    fridge.position.set(kx0 + 0.48, 0, kz0 + 0.36);
    kitchen.add(fridge);
    const fridgeBody = new THREE.Mesh(rbox(0.78, 1.95, 0.68, 0.05), toon('#e8e4da'));
    fridgeBody.position.y = 0.975;
    outline(fridgeBody);
    fridge.add(fridgeBody);
    const fridgeLine = new THREE.Mesh(rbox(0.74, 0.012, 0.01, 0.004), toon('#b9b3a6'));
    fridgeLine.position.set(0, 1.3, 0.342);
    fridge.add(fridgeLine);
    [1.6, 0.9].forEach(y => {
        const h = new THREE.Mesh(rbox(0.03, 0.3, 0.04, 0.01), toon('#9d9789'));
        h.position.set(0.32, y, 0.36);
        outline(h);
        fridge.add(h);
    });
    const notes = [
        ['Ship it.', '#f7e27a', -0.18, 1.62, 0.1],
        ['Fix prod first', '#ffb3c7', 0.08, 1.7, -0.08],
        ['No meetings about meetings', '#b8e3ff', -0.12, 1.1, -0.05],
        ['Buy Spam (& oat milk)', '#c5f0a4', 0.12, 1.02, 0.12],
        ['Docs live in YOUR repo', '#f7e27a', -0.05, 0.62, 0.04]
    ];
    notes.forEach(([text, color, nx, ny, rot]) => {
        const note = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), toon('#ffffff', { map: track(stickyNoteTexture(text, color)) }));
        note.position.set(nx, ny, 0.35);
        note.rotation.z = rot;
        fridge.add(note);
    });
    block(kx0, kx0 + 0.9, kz0, kz0 + 0.75);

    // THE kitchen table
    const kTableX = kx0 + 1.75;
    const kTableZ = 3.55;
    batch.add(rbox(1.5, 0.05, 0.9, 0.015), toon('#c08e5c'), matrix(kTableX, 0.75, kTableZ));
    [[-0.68, -0.38], [0.68, -0.38], [-0.68, 0.38], [0.68, 0.38]].forEach(([dx, dz]) => {
        batch.add(rbox(0.06, 0.73, 0.06, 0.01), toon('#a8754a'), matrix(kTableX + dx, 0.365, kTableZ + dz));
    });
    contactShadow(kTableX, kTableZ, 1.9, 1.3, kitchen);
    block(kTableX - 0.76, kTableX + 0.76, kTableZ - 0.46, kTableZ + 0.46);
    // Chairs: the CEO's (back to the window) and a visitor's
    [[-1.0, 0, Math.PI / 2], [0.25, 0.75, Math.PI]].forEach(([dx, dz, ry]) => {
        const cx = kTableX + dx;
        const cz = kTableZ + dz;
        const parentM = matrix(cx, 0, cz, 0, ry);
        batch.add(rbox(0.42, 0.04, 0.42, 0.01), toon('#a8754a'), matrix(0, 0.46, 0), { parent: parentM });
        batch.add(rbox(0.42, 0.45, 0.04, 0.01), toon('#a8754a'), matrix(0, 0.7, -0.2), { parent: parentM });
        [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([lx, lz]) => {
            batch.add(rbox(0.035, 0.46, 0.035, 0.008), toon('#8f6038'), matrix(lx, 0.23, lz), { parent: parentM });
        });
        block(cx - 0.24, cx + 0.24, cz - 0.24, cz + 0.24);
    });
    // Laptop (interactive) - screen faces the doorway
    const laptop = new THREE.Group();
    laptop.position.set(kTableX - 0.1, 0.775, kTableZ - 0.05);
    laptop.rotation.y = Math.PI / 2;
    kitchen.add(laptop);
    const lapBase = new THREE.Mesh(rbox(0.36, 0.018, 0.25, 0.006), toon('#c8ccd0'));
    lapBase.position.y = 0.009;
    outline(lapBase);
    laptop.add(lapBase);
    const lapLid = new THREE.Group();
    lapLid.position.set(0, 0.018, -0.12);
    lapLid.rotation.x = -0.25;
    laptop.add(lapLid);
    const lid = new THREE.Mesh(rbox(0.36, 0.24, 0.012, 0.006), toon('#c8ccd0'));
    lid.position.y = 0.12;
    outline(lid);
    lapLid.add(lid);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.21), glowMaterial({ map: track(laptopScreenTexture(content.builds)) }));
    screen.position.set(0, 0.12, 0.011);
    lapLid.add(screen);
    // Nameplate (interactive)
    const nameplate = new THREE.Group();
    nameplate.position.set(kTableX + 0.42, 0.775, kTableZ + 0.2);
    nameplate.rotation.y = Math.PI / 2 - 0.3;
    kitchen.add(nameplate);
    const wedge = new THREE.Mesh(rbox(0.34, 0.08, 0.07, 0.008), toon('#2a2220'));
    wedge.position.y = 0.04;
    outline(wedge);
    nameplate.add(wedge);
    const plateFace = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.07), glowMaterial({
        map: track(labelTexture(640, 140, '#2a2220', [
            { text: 'CEO · CTO', size: 46, weight: 700, color: '#e8d6a8', spacing: 4 },
            { text: 'Chief Coffee Officer', size: 34, italic: true, color: COLORS.accent }
        ]))
    }));
    plateFace.position.set(0, 0.04, 0.041);
    nameplate.add(plateFace);
    // Desk mug + sticky notes + notebook
    batch.add(cyl(0.045, 0.04, 0.1, 20), toon('#2E5E3F'), matrix(kTableX - 0.05, 0.83, kTableZ + 0.32));
    batch.add(rbox(0.2, 0.02, 0.28, 0.006), toon('#3a3230'), matrix(kTableX + 0.35, 0.785, kTableZ - 0.22, 0, 0.2));
    [['Find the problem', '#f7e27a', 0.15, -0.3], ['Fix it', '#ffb3c7', 0.4, 0.05], ['Move on', '#b8e3ff', -0.45, 0.3]].forEach(([text, color, dx, dz], i) => {
        const note = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), toon('#ffffff', { map: track(stickyNoteTexture(text, color)) }));
        note.rotation.x = -Math.PI / 2;
        note.rotation.z = Math.PI / 2 + (i - 1) * 0.3;
        note.position.set(kTableX + dx, 0.777, kTableZ + dz);
        kitchen.add(note);
    });
    pendant(kTableX, kTableZ, ceil, kitchen, 0.7);

    // Framed motto on the kitchen front wall
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), glowMaterial({
        map: track(labelTexture(600, 400, '#f6f0e1', [
            { text: 'Find the problem.', size: 52, script: true, color: COLORS.counter },
            { text: 'Fix it.', size: 52, script: true, color: COLORS.counter },
            { text: 'Move on.', size: 52, script: true, color: COLORS.green }
        ], { border: '#2a2220' }))
    }));
    poster.position.set(kcx + 0.4, 1.7, kz1 - 0.035);
    poster.rotation.y = Math.PI;
    kitchen.add(poster);
    batch.add(rbox(0.96, 0.66, 0.03, 0.01), toon('#2a2220'), matrix(kcx + 0.4, 1.7, kz1 - 0.005));

    // Pebbles' bed and bowl - the Head of Morale's office
    const bedX = kx1 - 0.7;
    const bedZ = 4.55;
    batch.add(cyl(0.38, 0.4, 0.08, 32), toon('#7a9a7c'), matrix(bedX, 0.04, bedZ));
    batch.add(new THREE.TorusGeometry(0.33, 0.08, 12, 32), toon('#8fa890'), matrix(bedX, 0.11, bedZ, Math.PI / 2));
    batch.add(cyl(0.12, 0.09, 0.07, 24), toon('#c97a5f'), matrix(bedX - 0.6, 0.035, bedZ + 0.25));
    // Canvas wide enough for the whole title (the old one clipped both ends)
    const bowlLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.1), glowMaterial({
        map: track(labelTexture(620, 100, null, [{ text: 'PEBBLES · HEAD OF MORALE', size: 34, weight: 700, color: '#2a2220', spacing: 2 }])), transparent: true
    }));
    bowlLabel.position.set(bedX, 0.6, kz1 - 0.02);
    bowlLabel.rotation.y = Math.PI;
    kitchen.add(bowlLabel);

    // A Norwegian Blue, on its back in its cage. Beautiful plumage.
    const parrot = new THREE.Group();
    parrot.position.set(runCX - 0.16, topY, kz0 + 0.34);
    parrot.rotation.y = 0.4;
    kitchen.add(parrot);
    const brass = toon('#c9a24f');
    const cageBase = new THREE.Mesh(cyl(0.14, 0.15, 0.03, 24), toon('#3a3230'));
    cageBase.position.y = 0.015;
    outline(cageBase);
    parrot.add(cageBase);
    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const bar = new THREE.Mesh(cyl(0.004, 0.004, 0.3, 4), brass);
        bar.position.set(Math.sin(a) * 0.13, 0.18, Math.cos(a) * 0.13);
        parrot.add(bar);
    }
    [0.04, 0.33].forEach(y => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.006, 6, 32), brass);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = y;
        parrot.add(ring);
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), brass);
    dome.position.y = 0.33;
    dome.scale.y = 0.45;
    parrot.add(dome);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.005, 6, 16), brass);
    hook.position.y = 0.41;
    parrot.add(hook);
    const perch = new THREE.Mesh(cyl(0.006, 0.006, 0.24, 6), toon('#8f6038'));
    perch.rotation.z = Math.PI / 2;
    perch.position.y = 0.2;
    parrot.add(perch);
    // The bird: lying on its back, feet in the air. It's resting.
    const bird = new THREE.Group();
    bird.position.set(0, 0.075, 0);
    parrot.add(bird);
    const blue = toon('#2f6fd1');
    const birdBody = new THREE.Mesh(capsule(0.032, 0.07, 4, 10), blue);
    birdBody.rotation.z = Math.PI / 2;
    outline(birdBody);
    bird.add(birdBody);
    const birdHead = new THREE.Mesh(sphere(0.03, 12, 10), blue);
    birdHead.position.set(0.075, 0.004, 0);
    outline(birdHead);
    bird.add(birdHead);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 8), toon('#3a3230'));
    beak.position.set(0.108, 0.0, 0);
    beak.rotation.z = -Math.PI / 2 - 0.4;
    bird.add(beak);
    const tail = new THREE.Mesh(rbox(0.07, 0.008, 0.035, 0.003), toon('#1f4f9e'));
    tail.position.set(-0.09, -0.004, 0);
    bird.add(tail);
    [-0.012, 0.012].forEach(z => {
        const leg = new THREE.Mesh(cyl(0.003, 0.003, 0.04, 4), toon('#d0a050'));
        leg.position.set(0.0, 0.05, z);
        bird.add(leg);
        const eye = new THREE.Mesh(rbox(0.012, 0.003, 0.003, 0.001), toon('#111111'));
        eye.position.set(0.085, 0.022, z * 1.6);
        eye.rotation.y = z > 0 ? 0.8 : -0.8;
        bird.add(eye);
    });
    const parrotTag = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.06), glowMaterial({
        map: track(labelTexture(400, 120, '#f6f0e1', [{ text: 'Norwegian Blue', size: 44, script: true, color: '#1f4f9e' }], { border: '#8B6F47' }))
    }));
    parrotTag.position.set(0, 0.015, 0.152);
    parrotTag.rotation.x = -0.25;
    parrot.add(parrotTag);

    // Argument Clinic, Room 12A: on the café wall, just past the kitchen door
    const clinic = new THREE.Group();
    clinic.position.set(-hw + 0.02, 1.48, doorZ1 + 0.38);
    clinic.rotation.y = Math.PI / 2;
    scene.add(clinic);
    const clinicBack = new THREE.Mesh(rbox(0.44, 0.3, 0.02, 0.008), toon('#8B6F47'));
    clinicBack.position.z = 0.0;
    outline(clinicBack);
    clinic.add(clinicBack);
    const clinicFace = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.26), glowMaterial({
        map: track(labelTexture(480, 312, '#f3ead6', [
            { text: 'ARGUMENT', size: 50, weight: 700, color: COLORS.text, spacing: 4 },
            { text: 'CLINIC', size: 50, weight: 700, color: COLORS.text, spacing: 4 },
            { text: 'Room 12A · 5 min £1', size: 30, italic: true, color: COLORS.accent }
        ]))
    }));
    clinicFace.position.z = 0.012;
    clinic.add(clinicFace);

    /* ------------------------------------------------------------------
       CORGI
       ------------------------------------------------------------------ */
    const corgi = new Corgi();
    corgi.root.position.set(X(0.58 * W + 60), 0, 2.7);
    corgi.heading = Math.PI / 2 + 0.6;
    scene.add(corgi.root);
    const corgiShadow = contactShadow(0, 0, 0.55, 0.35);

    /* ------------------------------------------------------------------
       BEANS & THE SHRUBBERY
       ------------------------------------------------------------------ */
    const servicesRect = layout.boards.services;
    const beanSpots = [
        { id: 'bean-menu', label: 'a bean on top of the Services board', pos: new THREE.Vector3(X(servicesRect.x + servicesRect.w * 0.8), Y(servicesRect.y) + 0.04, 0.05) },
        { id: 'bean-table', label: 'a bean under the table', pos: new THREE.Vector3(tableX + 0.18, 0.035, tableZ + 0.24) },
        { id: 'bean-counter', label: 'a bean behind the counter', pos: new THREE.Vector3(-1.1, 0.035, 0.45) },
        { id: 'bean-bed', label: 'a bean in Pebbles\' bed', pos: new THREE.Vector3(bedX, 0.13, bedZ) }
    ];
    const beanGlowTex = track(radialTexture([[0, 'rgba(255,230,140,0.9)'], [0.5, 'rgba(255,210,100,0.25)'], [1, 'rgba(255,200,80,0)']]));
    const beans = beanSpots.map((spot, i) => {
        const group = new THREE.Group();
        group.position.copy(spot.pos);
        const half = new THREE.Mesh(sphere(0.045, 16, 12), toon('#6b3e22'));
        half.scale.set(1, 0.72, 0.8);
        outline(half);
        group.add(half);
        const crease = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.005, 6, 16, Math.PI), toon('#3b2112'));
        crease.rotation.set(0, Math.PI / 2, Math.PI / 2);
        crease.position.y = 0.031;
        group.add(crease);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: beanGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        halo.scale.set(0.3, 0.3, 1);
        halo.raycast = () => {};
        group.add(halo);
        group.userData.base = spot.pos.y;
        group.userData.phase = i * 1.7;
        scene.add(group);
        return { ...spot, group, found: false };
    });

    const shrubbery = new THREE.Group();
    shrubbery.position.set(hw - 0.75, 0, D - 0.75);
    shrubbery.visible = false;
    scene.add(shrubbery);
    const tub = new THREE.Mesh(cyl(0.28, 0.22, 0.36, 24), toon('#c97a5f'));
    tub.position.y = 0.18;
    outline(tub);
    shrubbery.add(tub);
    [[0, 0.62, 0, 0.3], [0.17, 0.52, 0.08, 0.22], [-0.17, 0.5, -0.05, 0.23], [0.05, 0.82, -0.05, 0.2], [-0.08, 0.66, 0.15, 0.2]].forEach(([x, y, z, r], i) => {
        const bush = new THREE.Mesh(sphere(r, 16, 12), toon(i % 2 ? '#4a8550' : COLORS.green));
        bush.position.set(x, y, z);
        outline(bush);
        shrubbery.add(bush);
    });
    const shrubSign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.14), glowMaterial({
        map: track(labelTexture(420, 140, '#f6f0e1', [{ text: 'One shrubbery.', size: 40, script: true, color: COLORS.counter }, { text: 'Not too expensive.', size: 26, italic: true, color: '#6b5a48' }], { border: '#8B6F47' }))
    }));
    // On a stake in front of the tub, facing back into the room, clear of the leaves
    const signFacing = Math.atan2(-0.6, -0.8);
    const signStake = new THREE.Mesh(cyl(0.008, 0.008, 0.2, 6), toon('#8f6038'));
    signStake.position.set(Math.sin(signFacing) * 0.42, 0.1, Math.cos(signFacing) * 0.42);
    shrubbery.add(signStake);
    shrubSign.position.set(Math.sin(signFacing) * 0.43, 0.24, Math.cos(signFacing) * 0.43);
    shrubSign.rotation.set(-0.2, signFacing, 0, 'YXZ');
    shrubbery.add(shrubSign);

    /* ------------------------------------------------------------------
       THE BLACK KNIGHT & THE HOLY HAND GRENADE (after all four beans)
       ------------------------------------------------------------------ */
    // Guarding the front door: just to its right as you face it from inside,
    // turned a little into the room
    const knight = new Knight();
    knight.root.position.set(-1.15, 0, D - 0.5);
    knight.root.rotation.y = Math.atan2(0.25, -0.97);
    knight.root.visible = false;
    scene.add(knight.root);
    const knightShadow = contactShadow(knight.root.position.x, knight.root.position.z, 0.7, 0.5);
    knightShadow.visible = false;

    // Brother Maynard left it on the café table, on a little cushion
    const grenade = new THREE.Group();
    grenade.position.set(tableX - 0.2, 0.8, tableZ + 0.14);
    grenade.visible = false;
    scene.add(grenade);
    const cushion = new THREE.Mesh(rbox(0.16, 0.035, 0.16, 0.015), toon('#9e2b35'));
    cushion.position.y = 0.0175;
    outline(cushion);
    grenade.add(cushion);
    const orb = holyHandGrenade();
    orb.position.y = 0.03;
    grenade.add(orb);
    const grenadeHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: beanGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    grenadeHalo.scale.set(0.45, 0.45, 1);
    grenadeHalo.position.y = 0.12;
    grenadeHalo.raycast = () => {};
    grenade.add(grenadeHalo);

    // The one we throw (a copy, so the cushion stays put)
    const thrown = holyHandGrenade();
    thrown.visible = false;
    scene.add(thrown);

    // One soft golden bloom when it lands: a single swell, never a flicker
    const blast = new THREE.Sprite(new THREE.SpriteMaterial({
        map: track(radialTexture([[0, 'rgba(255,244,200,1)'], [0.35, 'rgba(255,214,120,0.7)'], [1, 'rgba(255,190,80,0)']])),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0
    }));
    blast.visible = false;
    blast.raycast = () => {};
    scene.add(blast);

    /* ------------------------------------------------------------------
       FLYING CIRCUS: a Norwegian Blue and the Argument Clinic
       ------------------------------------------------------------------ */
    
    /* ------------------------------------------------------------------
       STEAM - one particle system for every hot thing
       ------------------------------------------------------------------ */
    const steam = new Steam(track(radialTexture([[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']], 64)));
    scene.add(steam.points);
    const steamSources = {
        mug: { pos: new THREE.Vector3(mug.position.x, counterTop + 0.25, mug.position.z), rate: 4, on: true },
        cupL: { pos: new THREE.Vector3(machineX - 0.17, counterTop + 0.23, 1.42), rate: 6, on: false },
        cupR: { pos: new THREE.Vector3(machineX + 0.17, counterTop + 0.23, 1.42), rate: 6, on: false },
        deskMug: { pos: new THREE.Vector3(kTableX - 0.05, 0.9, kTableZ + 0.32), rate: 2.5, on: true }
    };

    /* ------------------------------------------------------------------
       LIGHTS
       ------------------------------------------------------------------ */
    const hemi = new THREE.HemisphereLight('#fff6e8', '#b8967a', 1.2);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff1dc', 1.65);
    sun.position.set(2.5, 6, 9);
    sun.target.position.set(0, 1, 2);
    scene.add(sun);
    scene.add(sun.target);

    /* ------------------------------------------------------------------
       BATCH STATICS
       ------------------------------------------------------------------ */
    batch.build(scene).forEach(m => occluders.push(m));

    /* ------------------------------------------------------------------
       GALLERY: real work, framed on the side walls
       ------------------------------------------------------------------ */
    const galleryGroup = new THREE.Group();
    scene.add(galleryGroup);
    const artY = 1.9;
    const artSpots = [
        { x: hw - 0.025, y: artY, z: 1.6, rotY: -Math.PI / 2 },
        { x: hw - 0.025, y: artY, z: 3.0, rotY: -Math.PI / 2 },
        { x: hw - 0.025, y: artY, z: 4.4, rotY: -Math.PI / 2 },
        { x: hw - 0.025, y: artY, z: 5.8, rotY: -Math.PI / 2 },
        { x: -hw + 0.025, y: artY, z: 4.3, rotY: Math.PI / 2 },
        { x: -hw + 0.025, y: artY, z: 5.7, rotY: Math.PI / 2 },
        { x: -hw + 0.025, y: artY + 0.1, z: 1.25, rotY: Math.PI / 2 }
    ];
    const artworks = hangGallery(galleryGroup, artSpots, { toon, outline, rbox, glowMaterial, track });

    /* ------------------------------------------------------------------
       COMPACT the props: one draw call per material, moving parts kept
       ------------------------------------------------------------------ */
    compactGroup(machine, [...streams, displayFace]);
    compactGroup(plantInner);
    compactGroup(plant, [plantInner]);
    compactGroup(mug);
    compactGroup(till);
    compactGroup(aframe);
    Object.values(boards).forEach(b => compactGroup(b.pivot, [b.face]));
    compactGroup(door);
    compactGroup(lightSwitch, [toggle]);
    compactGroup(fridge);
    compactGroup(laptop);
    compactGroup(nameplate);
    compactGroup(shrubbery);
    compactGroup(grenade, [grenadeHalo]);
    compactGroup(parrot);
    compactGroup(clinic);
    compactGroup(tap, [...tapLevers, water, splashRing]);

    /* ------------------------------------------------------------------
       INTERACTABLES
       ------------------------------------------------------------------ */
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    function register(id, object, info) {
        box.setFromObject(object, true);
        if (info.pad) box.expandByScalar(info.pad);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const proxy = new THREE.Mesh(new THREE.BoxGeometry(Math.max(size.x, 0.12), Math.max(size.y, 0.12), Math.max(size.z, 0.12)), proxyMat);
        proxy.position.copy(center);
        proxy.userData.id = id;
        scene.add(proxy);
        const hulls = [];
        const meshes = [];
        object.traverse(o => {
            if (o.userData.isOutline) hulls.push(o);
            else if (o.isMesh) {
                o.userData.hitId = id;
                meshes.push(o);
            }
        });
        // Small or moving things keep a forgiving box; everything else is hit
        // on its real shape so neighbours never steal each other's clicks
        const useProxy = ['bean', 'corgi', 'switch', 'order'].includes(info.kind);
        interactables.set(id, { id, object, proxy, hulls, meshes, useProxy, center, ...info });
    }

    const viewFrom = (x, z, look) => ({ pos: new THREE.Vector3(x, 1.6, z), look });
    // Stand back far enough that the board sits comfortably in frame
    // (boards over the counter need a little more room)
    const boardView = b => viewFrom(b.cx * 0.92, b.cx < 0.3 ? 3.3 : 2.9, new THREE.Vector3(b.cx, b.cy - 0.15, 0));
    const boardLabels = { services: 'Services menu', help: 'How I help', builds: 'Recent builds', contact: 'Let\'s talk' };
    Object.entries(boards).forEach(([id, b]) => {
        register(id, b.group, {
            label: boardLabels[id], verb: 'Read', kind: 'board',
            view: boardView(b), dogSpot: new THREE.Vector3(b.cx, 0, 2.2)
        });
    });
    register('machine', machine, {
        label: 'Espresso machine', verb: 'Pull a shot', kind: 'machine',
        view: viewFrom(machineX + 0.2, 2.4, new THREE.Vector3(machineX, counterTop + 0.35, 1.1)), dogSpot: new THREE.Vector3(machineX + 0.4, 0, 2.1)
    });
    register('order', till, {
        label: 'Order a coffee', verb: 'Order', kind: 'order', pad: 0.08,
        view: viewFrom(till.position.x + 0.05, 2.35, new THREE.Vector3(till.position.x, counterTop + 0.15, 1.3)), dogSpot: new THREE.Vector3(till.position.x + 0.5, 0, 2.05)
    });
    register('plant', plant, {
        label: 'The shrubbery', verb: 'Say Ni', kind: 'plant', pad: 0.05,
        view: viewFrom(plant.position.x + 0.1, 2.3, new THREE.Vector3(plant.position.x, counterTop + 0.2, 1.3)), dogSpot: new THREE.Vector3(plant.position.x, 0, 2.0)
    });
    register('neon', neonPlane, {
        label: 'Neon sign', verb: 'Change colour', kind: 'neon',
        view: viewFrom(0, 3.6, new THREE.Vector3(0, neon.position.y, 0)), dogSpot: new THREE.Vector3(0.3, 0, 2.6)
    });
    register('switch', lightSwitch, {
        label: 'Light switch', verb: 'Flip', kind: 'switch', pad: 0.06,
        view: { pos: new THREE.Vector3(0.95, 1.6, D - 1.4), look: new THREE.Vector3(0.95, 1.35, D) }, dogSpot: new THREE.Vector3(1.4, 0, D - 1.0)
    });
    register('exit', door, {
        label: 'Exit to 2D', verb: 'Leave', kind: 'exit',
        view: { pos: new THREE.Vector3(0, 1.6, D - 1.8), look: new THREE.Vector3(0, 1.3, D) }, dogSpot: new THREE.Vector3(-0.6, 0, D - 1.0)
    });
    register('laptop', laptop, {
        label: 'Laptop (builds)', verb: 'Open', kind: 'laptop', pad: 0.05,
        view: { pos: new THREE.Vector3(kTableX + 1.0, 1.45, kTableZ - 0.05), look: new THREE.Vector3(kTableX - 0.1, 0.9, kTableZ - 0.05) }, dogSpot: new THREE.Vector3(kTableX + 0.95, 0, kTableZ - 0.7)
    });
    register('nameplate', nameplate, {
        label: 'Nameplate', verb: 'Read', kind: 'about', pad: 0.05,
        view: { pos: new THREE.Vector3(kTableX + 1.1, 1.4, kTableZ + 0.35), look: new THREE.Vector3(kTableX + 0.42, 0.82, kTableZ + 0.2) }, dogSpot: new THREE.Vector3(kTableX + 0.95, 0, kTableZ + 0.8)
    });
    register('fridge', fridge, {
        label: 'Notes on the fridge', verb: 'Read', kind: 'fridge',
        view: { pos: new THREE.Vector3(kx0 + 0.6, 1.6, kz0 + 1.9), look: new THREE.Vector3(kx0 + 0.48, 1.2, kz0 + 0.7) }, dogSpot: new THREE.Vector3(kx0 + 1.2, 0, kz0 + 1.3)
    });
    artworks.forEach(({ project, group }) => {
        const facing = Math.sign(-group.position.x); // into the room
        register(project.id, group, {
            label: project.name, verb: 'View', kind: 'art', project,
            view: viewFrom(group.position.x + facing * 1.9, group.position.z, new THREE.Vector3(group.position.x, group.position.y - 0.05, group.position.z)),
            dogSpot: new THREE.Vector3(group.position.x + facing * 1.1, 0, group.position.z + 0.3)
        });
    });
    register('corgi', corgi.root, { label: 'Pebbles', verb: 'Pet', kind: 'corgi', pad: 0.06, dynamic: true });
    // Beans are tiny, so their click box is generous
    beans.forEach(bean => register(bean.id, bean.group, { label: 'Coffee bean', verb: 'Pick up', kind: 'bean', pad: 0.16, dynamic: true, bean }));
    register('shrubbery', shrubbery, { label: 'A shrubbery', verb: 'Admire', kind: 'shrubbery', pad: 0.05, hidden: true });
    // Registered while visible so the boxes measure properly, then hidden
    knight.root.visible = true;
    grenade.visible = true;
    register('knight', knight.root, {
        label: 'The Black Knight', verb: 'Challenge', kind: 'knight', pad: 0.08, hidden: true,
        view: viewFrom(knight.root.position.x + 0.5, D - 2.9, new THREE.Vector3(knight.root.position.x, 1.25, knight.root.position.z)),
        dogSpot: new THREE.Vector3(knight.root.position.x + 0.9, 0, D - 1.4)
    });
    register('grenade', grenade, {
        label: 'The Holy Hand Grenade of Antioch', verb: 'Take', kind: 'grenade', pad: 0.12, hidden: true,
        view: viewFrom(tableX - 0.3, tableZ + 1.3, new THREE.Vector3(tableX - 0.2, 0.85, tableZ + 0.14)),
        dogSpot: new THREE.Vector3(tableX - 0.7, 0, tableZ + 0.8)
    });
    knight.root.visible = false;
    grenade.visible = false;
    register('parrot', parrot, {
        label: 'Norwegian Blue', verb: 'Inspect', kind: 'parrot', pad: 0.06,
        view: { pos: new THREE.Vector3(parrot.position.x + 0.1, 1.5, kz0 + 1.45), look: new THREE.Vector3(parrot.position.x, topY + 0.15, parrot.position.z) },
        dogSpot: new THREE.Vector3(parrot.position.x + 0.5, 0, kz0 + 1.3)
    });
    register('tap', tap, {
        label: 'Kitchen tap', verb: 'Turn on', kind: 'tap', pad: 0.05,
        view: { pos: new THREE.Vector3(sinkX + 0.15, 1.55, kz0 + 1.35), look: new THREE.Vector3(sinkX, topY + 0.05, sinkZ) },
        dogSpot: new THREE.Vector3(sinkX + 0.6, 0, kz0 + 1.3)
    });
    register('argument', clinic, {
        label: 'Argument Clinic', verb: 'Have an argument', kind: 'argument', pad: 0.04,
        view: viewFrom(-hw + 1.6, clinic.position.z, new THREE.Vector3(-hw, 1.45, clinic.position.z)),
        dogSpot: new THREE.Vector3(-hw + 0.9, 0, clinic.position.z + 0.5)
    });

    /* ------------------------------------------------------------------
       NAVIGATION GRAPH (for the corgi)
       ------------------------------------------------------------------ */
    const v2 = (x, z) => new THREE.Vector3(x, 0, z);
    const nodes = {
        hall: v2(0.7, 2.6), counter: v2(-1.6, 2.35), endC: v2(0.5, 1.95), behind: v2(0.5, 0.5), behindL: v2(-1.3, 0.5),
        tableN: v2(tableX, 2.2), front: v2(0, 5.4), frontR: v2(hw - 0.9, 5.7), frontL: v2(-hw + 0.8, 5.2),
        doorC: v2(-hw + 0.45, 2.7), doorK: v2(-hw - WALL - 0.45, 2.7), kitchen: v2(kTableX, 2.2), kitchenS: v2(kTableX + 1.0, 4.4), bed: v2(bedX, bedZ - 0.5)
    };
    const edges = [
        ['hall', 'counter'], ['hall', 'endC'], ['endC', 'behind'], ['behind', 'behindL'], ['hall', 'tableN'], ['hall', 'front'],
        ['front', 'frontR'], ['front', 'frontL'], ['counter', 'frontL'], ['counter', 'doorC'], ['doorC', 'doorK'],
        ['doorK', 'kitchen'], ['doorK', 'kitchenS'], ['kitchenS', 'bed'], ['frontR', 'hall']
    ];
    const adjacency = {};
    edges.forEach(([a, b]) => {
        (adjacency[a] = adjacency[a] || []).push(b);
        (adjacency[b] = adjacency[b] || []).push(a);
    });
    function nearestNode(p) {
        let best = null;
        let bestD = Infinity;
        Object.entries(nodes).forEach(([k, n]) => {
            const d = Math.hypot(n.x - p.x, n.z - p.z);
            if (d < bestD) { bestD = d; best = k; }
        });
        return best;
    }
    function findPath(from, to) {
        const start = nearestNode(from);
        const goal = nearestNode(to);
        const prev = { [start]: null };
        const queue = [start];
        while (queue.length) {
            const k = queue.shift();
            if (k === goal) break;
            (adjacency[k] || []).forEach(n => { if (!(n in prev)) { prev[n] = k; queue.push(n); } });
        }
        const route = [];
        for (let k = goal; k; k = prev[k]) route.unshift(nodes[k].clone());
        route.push(to.clone());
        return route;
    }

    /* ------------------------------------------------------------------
       COLLISION
       ------------------------------------------------------------------ */
    function collide(pos, radius) {
        for (let pass = 0; pass < 2; pass++) {
            for (const c of colliders) {
                if (c.disabled) continue;
                const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
                const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
                const dx = pos.x - nx;
                const dz = pos.z - nz;
                const d2 = dx * dx + dz * dz;
                if (d2 < radius * radius) {
                    if (d2 > 1e-8) {
                        const d = Math.sqrt(d2);
                        pos.x = nx + (dx / d) * radius;
                        pos.z = nz + (dz / d) * radius;
                    } else {
                        // Inside the box: push out the shortest way
                        const pushes = [[c.x0 - radius - pos.x, 0], [c.x1 + radius - pos.x, 0], [0, c.z0 - radius - pos.z], [0, c.z1 + radius - pos.z]];
                        pushes.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
                        pos.x += pushes[0][0];
                        pos.z += pushes[0][1];
                    }
                }
            }
        }
    }
    /** Pull a floor point back inside whichever room it belongs to */
    function clampInside(p, inKitchen = p.x < -hw - WALL / 2, margin = 0.35) {
        if (inKitchen) {
            p.x = THREE.MathUtils.clamp(p.x, kx0 + margin, kx1 - margin);
            p.z = THREE.MathUtils.clamp(p.z, kz0 + margin, kz1 - margin);
        } else {
            p.x = THREE.MathUtils.clamp(p.x, -hw + margin, hw - margin);
            p.z = THREE.MathUtils.clamp(p.z, margin, D - margin);
        }
        return p;
    }

    const shrubCollider = { x0: shrubbery.position.x - 0.3, x1: shrubbery.position.x + 0.3, z0: shrubbery.position.z - 0.3, z1: shrubbery.position.z + 0.3, disabled: true };
    colliders.push(shrubCollider);
    const kp = knight.root.position;
    const knightCollider = { x0: kp.x - 0.3, x1: kp.x + 0.3, z0: kp.z - 0.3, z1: kp.z + 0.4, disabled: true };
    colliders.push(knightCollider);

    /* ------------------------------------------------------------------
       DAY / NIGHT
       ------------------------------------------------------------------ */
    const dayBg = new THREE.Color('#d8cbb6');
    const nightBg = new THREE.Color('#15110f');
    const hemiDaySky = new THREE.Color('#fff6e8');
    const hemiNightSky = new THREE.Color('#6d7aa8');
    let night = 0;
    function applyNight(n) {
        night = n;
        hemi.intensity = THREE.MathUtils.lerp(1.2, 0.32, n);
        hemi.color.copy(hemiDaySky).lerp(hemiNightSky, n);
        sun.intensity = THREE.MathUtils.lerp(1.65, 0.08, n);
        lamps.forEach(l => { l.light.intensity = THREE.MathUtils.lerp(1.4, 5.5, n); });
        coneMats.forEach(m => { m.uniforms.opacity.value = THREE.MathUtils.lerp(0.2, 0.5, n); });
        neonGlowMat.opacity = THREE.MathUtils.lerp(0.75, 1, n);
        neonLight.intensity = THREE.MathUtils.lerp(1.2, 3.5, n);
        neonBloomMat.opacity = n * 0.6;
        nightPanes.forEach(p => { p.material.opacity = n; });
        scene.background.copy(dayBg).lerp(nightBg, n);
        toggle.rotation.x = THREE.MathUtils.lerp(-0.35, 0.35, n);
    }
    applyNight(0);

    /* ------------------------------------------------------------------
       PER-FRAME UPDATE
       ------------------------------------------------------------------ */
    const tmp = new THREE.Vector3();
    function update(dt, time, { reducedMotion, playerPos }) {
        // Espresso machine pour
        if (machineState.timer > 0) {
            machineState.timer -= dt;
            machineState.pour = Math.min(1, machineState.pour + dt * 3);
        } else {
            machineState.pour = Math.max(0, machineState.pour - dt * 2);
        }
        streams.forEach((s, i) => { s.scale.y = Math.max(0.001, machineState.pour * (0.85 + Math.sin(time * 20 + i) * 0.05)); });
        steamSources.cupL.on = steamSources.cupR.on = machineState.timer > 0 || machineState.pour > 0.2;

        // Plant growth spring
        plantState.grow += (plantState.target - plantState.grow) * Math.min(1, dt * 6);
        const s = 1 + plantState.grow * 0.35 + (reducedMotion ? 0 : Math.sin(time * 9) * 0.02 * plantState.grow);
        plantInner.scale.setScalar(s);

        // Neon flicker: gentle, slower than 3 times a second
        if (!reducedMotion) {
            const flicker = 0.9 + 0.1 * Math.sin(time * 1.7) * Math.sin(time * 0.6);
            neonPlane.material.opacity = flicker;
            neonGlowMat.opacity = THREE.MathUtils.lerp(0.75, 1, night) * (0.88 + 0.12 * Math.sin(time * 1.1));
        }

        // Board hover lean
        Object.values(boards).forEach(b => {
            b.lean.lerp(b.leanTarget, Math.min(1, dt * 6));
            b.pivot.rotation.x = b.lean.y * 0.06;
            b.pivot.rotation.z = -b.lean.x * 0.035;
            b.pivot.position.z = Math.abs(b.lean.x) * 0.02 + Math.abs(b.lean.y) * 0.02;
        });

        // Beans bob and spin
        beans.forEach(bean => {
            if (bean.found) return;
            const g = bean.group;
            g.rotation.y += dt * 1.6;
            if (!reducedMotion) g.position.y = g.userData.base + 0.02 + Math.sin(time * 2.4 + g.userData.phase) * 0.015;
        });

        // Corgi
        corgi.update(dt, { reducedMotion, collide });
        corgiShadow.position.set(corgi.root.position.x, 0.007, corgi.root.position.z);
        const corgiInfo = interactables.get('corgi');
        corgiInfo.proxy.position.set(corgi.root.position.x, 0.2, corgi.root.position.z);
        corgiInfo.center.copy(corgiInfo.proxy.position);

        // Kitchen tap: levers swing round and the water eases on and off
        tapState.flow += ((tapState.on ? 1 : 0) - tapState.flow) * Math.min(1, dt * 8);
        tapLevers.forEach((l, i) => { l.rotation.y = (i ? -1 : 1) * tapState.flow * 0.9; });
        water.visible = splashRing.visible = tapState.flow > 0.03;
        if (water.visible) {
            const wobble = reducedMotion ? 1 : 1 + Math.sin(time * 31) * 0.08;
            water.scale.set(tapState.flow * wobble, 1, tapState.flow * wobble);
            splashRing.scale.setScalar(tapState.flow * (reducedMotion ? 1 : 1 + Math.sin(time * 17) * 0.15));
        }

        // The Black Knight (once he's turned up)
        if (knight.root.visible) knight.update(dt);

        // Steam
        steam.update(dt, Object.values(steamSources), reducedMotion);

        // Front wall only exists once we're inside
        front.visible = playerPos.z < D - 0.02;
        tmp.set(0, 0, 0);
    }

    return {
        scene, update, interactables, occluders, colliders, collide, clampInside, findPath, artworks, beans, corgi, shrubbery, shrubCollider,
        knight, knightShadow, knightCollider, grenade, thrown, blast, tap: tapState,
        boards, machine: machineState, plant: plantState, cycleNeon, applyNight, getNight: () => night,
        bounds: { hw, ceil, D, kx0, kx1, kz0, kz1, doorZ0, doorZ1 },
        dispose() {
            scene.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) {
                    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
                        if (m.map) m.map.dispose();
                        m.dispose();
                    });
                }
            });
            textures.forEach(t => t.dispose());
        }
    };
}

/** Plane/shape UVs in metres along two world axes, so tiled textures line up */
function remapUVToWorld(geometry, a, b) {
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
        uv.setXY(i, pos[`get${a.toUpperCase()}`](i), pos[`get${b.toUpperCase()}`](i));
    }
    uv.needsUpdate = true;
}

/** A small pool of soft steam puffs */
class Steam {
    constructor(texture, count = 90) {
        this.count = count;
        const geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(count * 3);
        this.colors = new Float32Array(count * 4);
        this.life = new Float32Array(count);
        this.max = new Float32Array(count);
        this.drift = new Float32Array(count * 2);
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
        this.points = new THREE.Points(geometry, new THREE.PointsMaterial({
            size: 0.09, map: texture, transparent: true, depthWrite: false, vertexColors: true, sizeAttenuation: true
        }));
        this.points.frustumCulled = false;
        this.points.raycast = () => {};
        this.cursor = 0;
        this.accum = new Map();
    }

    update(dt, sources, reducedMotion) {
        sources.forEach(src => {
            if (!src.on || reducedMotion) return;
            const acc = (this.accum.get(src) || 0) + dt * src.rate;
            let n = Math.floor(acc);
            this.accum.set(src, acc - n);
            while (n-- > 0) {
                const i = this.cursor;
                this.cursor = (this.cursor + 1) % this.count;
                this.positions[i * 3] = src.pos.x + (Math.random() - 0.5) * 0.04;
                this.positions[i * 3 + 1] = src.pos.y;
                this.positions[i * 3 + 2] = src.pos.z + (Math.random() - 0.5) * 0.04;
                this.life[i] = 0;
                this.max[i] = 1.6 + Math.random() * 0.8;
                this.drift[i * 2] = (Math.random() - 0.5) * 0.08;
                this.drift[i * 2 + 1] = (Math.random() - 0.5) * 0.08;
            }
        });
        for (let i = 0; i < this.count; i++) {
            if (this.max[i] === 0) { this.colors[i * 4 + 3] = 0; continue; }
            this.life[i] += dt;
            const t = this.life[i] / this.max[i];
            if (t >= 1) { this.max[i] = 0; this.colors[i * 4 + 3] = 0; continue; }
            this.positions[i * 3] += (this.drift[i * 2] + Math.sin(this.life[i] * 3 + i) * 0.02) * dt;
            this.positions[i * 3 + 1] += dt * 0.12;
            this.positions[i * 3 + 2] += this.drift[i * 2 + 1] * dt;
            this.colors[i * 4] = this.colors[i * 4 + 1] = this.colors[i * 4 + 2] = 1;
            this.colors[i * 4 + 3] = Math.sin(t * Math.PI) * 0.45;
        }
        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.color.needsUpdate = true;
    }
}
