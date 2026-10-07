/**
 * Iron Pig Café - Pebbles, Head of Morale.
 *
 * A scruffy black-and-tan girl with a grey muzzle and floppy ears, built
 * from capsules and spheres the way the 2D version is built from divs, and
 * animated procedurally: walk cycle, tail wag, sit, bark and a happy hop.
 */
import * as THREE from '../vendor/three/three.r186.min.js';
import { toon, outline, capsule, sphere, rbox } from './kit.js';

const COAT = '#2b2422';
const COAT_DARK = '#1c1817';
const TAN = '#b98a5c';
const MUZZLE = '#cdb89c';
const INK = '#0f0c0c';

function part(geometry, color, parent, x, y, z, { rx = 0, ry = 0, rz = 0, inked = true, scale } = {}) {
    const mesh = new THREE.Mesh(geometry, typeof color === 'string' ? toon(color) : color);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    if (scale) mesh.scale.set(...scale);
    if (inked) outline(mesh);
    parent.add(mesh);
    return mesh;
}

export class Corgi {
    constructor() {
        this.root = new THREE.Group();      // position + heading on the floor
        this.body = new THREE.Group();      // bobs, pitches when sitting, hops
        this.root.add(this.body);
        this.state = 'idle';
        this.speed = 0;
        this.walkPhase = 0;
        this.time = Math.random() * 10;
        this.sit = 0;
        this.hop = 0;
        this.bark = 0;
        this.wagBoost = 0;
        this.heading = 0;
        this.path = [];
        this.lookTarget = null;
        this.build();
    }

    build() {
        const b = this.body;
        // Facing +x. A little shorter in the body than a corgi.
        this.torso = part(capsule(0.095, 0.2), COAT, b, 0, 0.18, 0, { rz: Math.PI / 2 });
        // Tan chest and a scruffy ruff
        part(capsule(0.066, 0.1), TAN, b, 0.1, 0.14, 0, { rz: Math.PI / 2 - 0.35, inked: false });
        part(sphere(0.075, 16, 12), COAT, b, 0.15, 0.2, 0, { inked: false });

        // Legs on hip pivots so they can swing; tan socks
        this.legs = [];
        [[0.11, 0.055], [0.11, -0.055], [-0.11, 0.055], [-0.11, -0.055]].forEach(([x, z], i) => {
            const hip = new THREE.Group();
            hip.position.set(x, 0.13, z);
            part(capsule(0.03, 0.05), i < 2 ? COAT : COAT_DARK, hip, 0, -0.045, 0);
            part(capsule(0.027, 0.03), TAN, hip, 0.004, -0.09, 0, { inked: false });
            part(sphere(0.032, 12, 8), TAN, hip, 0.014, -0.112, 0, { inked: false });
            b.add(hip);
            this.legs.push(hip);
        });

        // Neck + head on a pivot for nods and barks
        this.headPivot = new THREE.Group();
        this.headPivot.position.set(0.19, 0.26, 0);
        b.add(this.headPivot);
        const h = this.headPivot;
        part(capsule(0.06, 0.05), COAT, h, -0.02, -0.02, 0, { rz: -0.6 });
        part(sphere(0.085), COAT, h, 0.05, 0.06, 0);
        // Tan cheeks and eyebrows, grey grizzled muzzle
        [0.05, -0.05].forEach(z => {
            part(sphere(0.042, 12, 10), TAN, h, 0.09, 0.03, z, { inked: false, scale: [1, 0.8, 0.6] });
            part(sphere(0.013, 10, 8), TAN, h, 0.115, 0.118, z * 0.85, { inked: false, scale: [1, 0.6, 1.3] });
        });
        part(capsule(0.04, 0.05), MUZZLE, h, 0.14, 0.025, 0, { rz: Math.PI / 2 });
        part(sphere(0.022, 12, 8), INK, h, 0.2, 0.038, 0);
        [0.045, -0.045].forEach(z => {
            part(sphere(0.014, 10, 8), INK, h, 0.11, 0.09, z, { inked: false });
            part(sphere(0.005, 8, 6), '#ffffff', h, 0.122, 0.096, z * 1.12, { inked: false });
        });
        this.jaw = part(rbox(0.07, 0.016, 0.05, 0.006), MUZZLE, h, 0.15, -0.008, 0);
        this.tongue = part(rbox(0.035, 0.008, 0.03, 0.004), '#F15F55', h, 0.17, -0.012, 0, { inked: false });
        this.tongue.visible = false;

        // Floppy ears hanging down beside her face, tan at the fringe
        this.ears = [];
        [0.07, -0.07].forEach((z, i) => {
            const ear = new THREE.Group();
            ear.position.set(0.0, 0.11, z);
            const flap = part(capsule(0.036, 0.07, 6, 12), i ? COAT_DARK : COAT, ear, 0, -0.055, 0, { scale: [1, 1, 0.45] });
            part(sphere(0.028, 10, 8), TAN, flap, 0, -0.045, i ? -0.006 : 0.006, { inked: false, scale: [1, 0.8, 0.5] });
            ear.rotation.x = i ? -0.3 : 0.3;
            ear.rotation.z = 0.25;
            h.add(ear);
            this.ears.push(ear);
        });

        // A scruffy grey beard under the chin
        part(sphere(0.034, 12, 10), MUZZLE, h, 0.15, -0.025, 0, { inked: false, scale: [1.1, 0.8, 0.9] });
        [[0.14, -0.012], [0.158, 0.008], [0.15, 0.0]].forEach(([x, z], i) => {
            part(new THREE.ConeGeometry(0.012, 0.03, 6), MUZZLE, h, x, -0.05, z, { rx: Math.PI, rz: (i - 1) * 0.15, inked: false });
        });

        // Tail: a fluffy plume on a wag pivot
        this.tail = new THREE.Group();
        this.tail.position.set(-0.17, 0.23, 0);
        part(capsule(0.035, 0.08), COAT_DARK, this.tail, -0.04, 0.04, 0, { rz: 0.9 });
        part(sphere(0.04, 12, 10), TAN, this.tail, -0.085, 0.075, 0, { inked: false, scale: [0.9, 0.8, 0.8] });
        b.add(this.tail);

        // Every part of her is clickable as one thing
        this.root.traverse(o => { if (o.isMesh && !o.userData.isOutline) o.userData.corgi = true; });
    }

    /** Called with the world-space point the dog should keep an eye on */
    face(target) {
        this.lookTarget = target;
    }

    doBark() {
        this.bark = 1;
        this.wagBoost = 3;
    }

    doHop() {
        this.hop = 1;
        this.wagBoost = 4;
    }

    walkTo(path) {
        this.path = path.slice();
        this.state = this.path.length ? 'walk' : 'idle';
    }

    update(dt, { reducedMotion, collide }) {
        this.time += dt;
        const root = this.root;

        // Follow the path
        let moving = false;
        if (this.state === 'walk' && this.path.length) {
            const target = this.path[0];
            const dx = target.x - root.position.x;
            const dz = target.z - root.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist < 0.08) {
                this.path.shift();
                if (!this.path.length) this.state = 'idle';
            } else {
                const desired = Math.atan2(-dz, dx);
                this.heading = turnTowards(this.heading, desired, dt * 8);
                const speed = Math.min(1.7, dist * 3 + 0.4);
                this.speed = THREE.MathUtils.lerp(this.speed, speed, Math.min(1, dt * 6));
                // Never step past the waypoint, however long the frame was
                const step = Math.min(this.speed * dt, dist);
                const before = root.position.clone();
                root.position.x += Math.cos(this.heading) * step;
                root.position.z -= Math.sin(this.heading) * step;
                if (collide) collide(root.position, 0.2);
                moving = true;
                // Pushing against something? Give up on this point rather than
                // trotting into the wall forever
                const progress = before.distanceTo(root.position);
                this.stuck = progress < step * 0.25 ? (this.stuck || 0) + dt : 0;
                if (this.stuck > 0.8) {
                    this.stuck = 0;
                    this.path.shift();
                    if (!this.path.length) this.state = 'idle';
                }
            }
        }
        if (!moving) {
            this.speed = THREE.MathUtils.lerp(this.speed, 0, Math.min(1, dt * 8));
            if (this.lookTarget) {
                const desired = Math.atan2(-(this.lookTarget.z - root.position.z), this.lookTarget.x - root.position.x);
                this.heading = turnTowards(this.heading, desired, dt * 2.5);
            }
        }
        root.rotation.y = this.heading;

        // Sit when idle for a moment
        const wantSit = !moving && this.state === 'idle' ? 1 : 0;
        this.sit = THREE.MathUtils.lerp(this.sit, wantSit, Math.min(1, dt * 4));

        // Walk cycle
        this.walkPhase += dt * this.speed * 14;
        const stride = Math.min(1, this.speed / 1.2) * 0.7;
        this.legs.forEach((hip, i) => {
            const front = i < 2;
            const phase = this.walkPhase + (i === 0 || i === 3 ? 0 : Math.PI);
            let angle = Math.sin(phase) * stride;
            if (!front) angle -= this.sit * 1.1;
            hip.rotation.z = angle;
        });

        // Body: bob while walking, pitch up when sitting, hop arc
        const bob = Math.abs(Math.sin(this.walkPhase)) * 0.015 * Math.min(1, this.speed);
        let hopY = 0;
        if (this.hop > 0) {
            this.hop = Math.max(0, this.hop - dt * 1.8);
            const t = 1 - this.hop;
            hopY = reducedMotion ? 0 : Math.sin(Math.min(1, t * 1.4) * Math.PI) * 0.16;
        }
        this.body.position.y = bob + hopY - this.sit * 0.03;
        this.body.rotation.z = this.sit * 0.32;

        // Tail wag: faster when happy
        this.wagBoost = Math.max(0, this.wagBoost - dt);
        const wagSpeed = 9 + this.wagBoost * 6;
        this.tail.rotation.x = Math.sin(this.time * wagSpeed) * (0.5 + Math.min(1, this.wagBoost) * 0.4);

        // Head: bark jerk, idle nods, ears flick
        if (this.bark > 0) this.bark = Math.max(0, this.bark - dt * 3);
        const barkKick = Math.sin((1 - this.bark) * Math.PI) * this.bark;
        this.headPivot.rotation.z = barkKick * 0.35 + Math.sin(this.time * 1.3) * 0.04 - this.sit * 0.25;
        this.jaw.rotation.z = -barkKick * 0.6;
        this.jaw.position.y = -0.008 - barkKick * 0.015;
        this.tongue.visible = this.wagBoost > 0.5 || this.speed > 0.6;
        this.ears.forEach((ear, i) => {
            ear.rotation.z = 0.25 + Math.sin(this.time * 4 + i) * 0.06 * (1 + this.wagBoost) + this.speed * 0.15;
        });
    }

    worldHeadPosition(target) {
        return this.headPivot.getWorldPosition(target).add(new THREE.Vector3(0, 0.22, 0));
    }
}

function turnTowards(current, desired, maxStep) {
    let delta = ((desired - current + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return current + Math.max(-maxStep, Math.min(maxStep, delta));
}
