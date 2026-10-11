/**
 * Iron Pig Café - the Black Knight.
 *
 * Guards the shrubbery once all four beans are found. None shall pass,
 * until someone counts to three (no more, no less) and lobs the Holy Hand
 * Grenade of Antioch. Then the limbs come off, cartoon-style, and he calls
 * it a draw. No blood: it's a family café.
 */
import * as THREE from '../vendor/three/three.r186.min.js';
import { toon, outline, capsule, cyl, rbox, sphere } from './kit.js';

const ARMOUR = '#2b2d31';
const ARMOUR_DARK = '#1b1c1f';
const TABARD = '#141416';
const STEEL = '#c3cacd';
const GOLD = '#d9b45a';

const HIP_Y = 0.86;
const GRAVITY = 9.8;

function part(geometry, color, parent, x, y, z, { rx = 0, ry = 0, rz = 0, inked = true } = {}) {
    const mesh = new THREE.Mesh(geometry, toon(color));
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    if (inked) outline(mesh);
    parent.add(mesh);
    return mesh;
}

export class Knight {
    constructor() {
        this.root = new THREE.Group();      // on the floor, facing +z
        this.upper = new THREE.Group();     // everything above the hips
        this.upper.position.y = HIP_Y;
        this.root.add(this.upper);
        this.time = 0;
        this.defeated = false;
        this.flying = [];                   // limbs in the air after the blast
        this.drop = 0;                      // how far the torso has sunk
        this.dropTarget = 0;
        this.swing = 0;
        this.build();
    }

    build() {
        const u = this.upper;
        // Legs on hip pivots
        this.legs = [-0.11, 0.11].map(x => {
            const hip = new THREE.Group();
            hip.position.set(x, HIP_Y, 0);
            part(capsule(0.075, 0.5), ARMOUR, hip, 0, -0.38, 0);
            part(sphere(0.07, 14, 10), ARMOUR_DARK, hip, 0, -0.42, 0.03, { inked: false });
            part(rbox(0.15, 0.08, 0.26, 0.02), ARMOUR_DARK, hip, 0, -0.82, 0.04);
            this.root.add(hip);
            return hip;
        });

        // Torso: mail under a plain black tabard, belt, gold buckle
        part(rbox(0.44, 0.58, 0.26, 0.06), ARMOUR, u, 0, 0.3, 0);
        part(rbox(0.46, 0.66, 0.02, 0.01), TABARD, u, 0, 0.24, 0.135);
        part(rbox(0.47, 0.06, 0.29, 0.02), ARMOUR_DARK, u, 0, 0.04, 0, { inked: false });
        part(rbox(0.06, 0.05, 0.02, 0.01), GOLD, u, 0, 0.04, 0.15, { inked: false });
        // Pauldrons
        [-1, 1].forEach(s => part(sphere(0.1, 14, 10), ARMOUR_DARK, u, s * 0.25, 0.56, 0));

        // Great helm with a visor slit and a breathing cross
        this.head = new THREE.Group();
        this.head.position.set(0, 0.72, 0);
        u.add(this.head);
        part(cyl(0.135, 0.145, 0.3, 20), ARMOUR, this.head, 0, 0.1, 0);
        part(cyl(0.135, 0.135, 0.02, 20), ARMOUR_DARK, this.head, 0, 0.25, 0, { inked: false });
        part(rbox(0.2, 0.025, 0.02, 0.006), '#050505', this.head, 0, 0.14, 0.137, { inked: false });
        part(rbox(0.02, 0.1, 0.02, 0.006), '#050505', this.head, 0, 0.04, 0.142, { inked: false });
        part(rbox(0.07, 0.02, 0.02, 0.006), '#050505', this.head, 0, 0.05, 0.142, { inked: false });

        // Arms on shoulder pivots: sword in the right, shield on the left
        const arm = side => {
            const shoulder = new THREE.Group();
            shoulder.position.set(side * 0.29, 0.52, 0);
            part(capsule(0.065, 0.42), ARMOUR, shoulder, 0, -0.27, 0);
            part(sphere(0.07, 12, 10), ARMOUR_DARK, shoulder, 0, -0.52, 0.02, { inked: false });
            u.add(shoulder);
            return shoulder;
        };
        this.armR = arm(-1);
        this.armL = arm(1);
        // Sword, pointing up and forward out of the right fist
        const sword = new THREE.Group();
        sword.position.set(0, -0.52, 0.05);
        sword.rotation.x = Math.PI / 2 + 0.5;
        this.armR.add(sword);
        part(rbox(0.035, 0.12, 0.035, 0.01), '#3b2a1e', sword, 0, -0.02, 0, { inked: false });
        part(rbox(0.2, 0.03, 0.035, 0.01), GOLD, sword, 0, 0.06, 0);
        part(rbox(0.045, 0.78, 0.012, 0.004), STEEL, sword, 0, 0.47, 0);
        part(sphere(0.025, 10, 8), GOLD, sword, 0, -0.09, 0, { inked: false });
        this.armR.rotation.x = -0.9;
        // Shield on the left forearm
        const shield = part(rbox(0.36, 0.46, 0.035, 0.03), TABARD, this.armL, 0.02, -0.38, 0.1, { rz: 0.05 });
        part(rbox(0.3, 0.4, 0.01, 0.02), ARMOUR_DARK, shield, 0, 0, 0.02, { inked: false });
        this.armL.rotation.x = -0.45;
        this.armL.rotation.z = -0.12;

        this.limbs = [this.armR, this.armL, ...this.legs];
        this.root.traverse(o => { if (o.isMesh) o.castShadow = false; });
    }

    /** A quick sword flourish, for "None shall pass" */
    flourish() {
        if (!this.defeated && this.armR.parent === this.upper) this.swing = 1;
    }

    /**
     * The grenade lands. Every limb leaves for the floor in its own
     * direction and the rest of him sinks to the ground, still talking.
     */
    blowUp(scene, { reducedMotion = false, bounds = null } = {}) {
        if (this.defeated) return;
        this.defeated = true;
        this.swing = 0;
        this.bounds = bounds;
        this.root.updateMatrixWorld(true);
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.root.quaternion);
        const side = new THREE.Vector3(1, 0, 0).applyQuaternion(this.root.quaternion);
        this.limbs.forEach((limb, i) => {
            scene.attach(limb);
            // Mostly sideways, a little forwards: nobody wants a gauntlet in the face
            const dir = side.clone().multiplyScalar([-1, 1, -0.7, 0.7][i]).addScaledVector(forward, 0.3);
            // Lying flat, a limb's pivot sits about one armour-thickness up
            const rest = 0.08;
            if (reducedMotion) {
                limb.position.addScaledVector(dir, 0.6);
                limb.position.y = rest;
                limb.rotation.set(Math.PI / 2, limb.rotation.y + i, 0);
                return;
            }
            this.flying.push({
                limb,
                vel: dir.multiplyScalar(1.1 + i * 0.1).setY(2.0 + (i % 2) * 0.5),
                spin: new THREE.Vector3(3 + i, 0, 2 - i),
                rest,
                done: false
            });
        });
        this.dropTarget = HIP_Y - 0.06;
        if (reducedMotion) this.drop = this.dropTarget;
    }

    update(dt) {
        this.time += dt;
        // Breathing, and a sword that settles back after a flourish
        if (!this.defeated) {
            this.upper.position.y = HIP_Y + Math.sin(this.time * 1.8) * 0.006;
            this.swing = Math.max(0, this.swing - dt * 1.6);
            const s = Math.sin(this.swing * Math.PI);
            this.armR.rotation.x = -0.9 - s * 0.9;
            this.armR.rotation.z = s * 0.3;
        } else {
            this.drop += (this.dropTarget - this.drop) * Math.min(1, dt * 7);
            this.upper.position.y = HIP_Y - this.drop + Math.abs(Math.sin(this.time * 2.4)) * 0.01;
        }
        // Limbs in flight: simple gravity, a bounce, then rest
        this.flying.forEach(f => {
            if (f.done) return;
            f.vel.y -= GRAVITY * dt;
            f.limb.position.addScaledVector(f.vel, dt);
            // Walls stop them; they slide down rather than leave the café
            const b = this.bounds;
            if (b) {
                const x = THREE.MathUtils.clamp(f.limb.position.x, b.x0, b.x1);
                const z = THREE.MathUtils.clamp(f.limb.position.z, b.z0, b.z1);
                if (x !== f.limb.position.x) f.vel.x *= -0.2;
                if (z !== f.limb.position.z) f.vel.z *= -0.2;
                f.limb.position.x = x;
                f.limb.position.z = z;
            }
            f.limb.rotation.x += f.spin.x * dt;
            f.limb.rotation.z += f.spin.z * dt;
            if (f.limb.position.y < f.rest) {
                f.limb.position.y = f.rest;
                if (Math.abs(f.vel.y) < 0.8) {
                    f.done = true;
                    // Lie flat-ish on the floor
                    f.limb.rotation.x = Math.round(f.limb.rotation.x / Math.PI) * Math.PI + Math.PI / 2;
                    f.limb.rotation.z = 0;
                } else {
                    f.vel.y *= -0.3;
                    f.vel.x *= 0.5;
                    f.vel.z *= 0.5;
                    f.spin.multiplyScalar(0.4);
                }
            }
        });
    }
}

/** The Holy Hand Grenade of Antioch: a golden orb with a cross on top */
export function holyHandGrenade() {
    const g = new THREE.Group();
    part(sphere(0.06, 20, 14), GOLD, g, 0, 0.06, 0);
    part(cyl(0.062, 0.062, 0.014, 20), '#b8923e', g, 0, 0.06, 0, { inked: false });
    part(rbox(0.016, 0.075, 0.016, 0.004), GOLD, g, 0, 0.15, 0);
    part(rbox(0.05, 0.016, 0.016, 0.004), GOLD, g, 0, 0.165, 0);
    // Jewels round the band
    [0, 1, 2, 3].forEach(i => {
        const a = (i / 4) * Math.PI * 2;
        part(sphere(0.011, 8, 6), i % 2 ? '#2f6fd1' : '#c8323c', g, Math.sin(a) * 0.063, 0.06, Math.cos(a) * 0.063, { inked: false });
    });
    return g;
}
