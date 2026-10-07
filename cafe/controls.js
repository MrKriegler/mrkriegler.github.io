/**
 * Iron Pig Café - getting around.
 *
 * Drag to look (the cursor stays free so the HUD is always clickable),
 * WASD to walk, arrow keys to look, a virtual joystick on touch, and smooth glides to
 * hotspots. No head-bob, no pointer lock, no camera shake.
 */
import * as THREE from '../vendor/three/three.r186.min.js';

const EYE = 1.6;
const WALK_SPEED = 2.1;
const RUN_SPEED = 3.4;
const LOOK_SPEED = 0.0032;
const TOUCH_LOOK_SPEED = 0.0055;
const TURN_SPEED = 1.9;
const PITCH_LIMIT = 1.2;

export class Player {
    constructor(camera, canvas, { collide, onTap, onHover, onJump, reducedMotion }) {
        this.camera = camera;
        this.canvas = canvas;
        this.collide = collide;
        this.onTap = onTap;
        this.onHover = onHover;
        this.onJump = onJump;
        this.jumpY = 0;
        this.jumpVelocity = 0;
        this.reducedMotion = reducedMotion;
        this.position = new THREE.Vector3(0, EYE, 5.6);
        this.velocity = new THREE.Vector3();
        this.yaw = 0;
        this.pitch = 0;
        this.keys = new Set();
        this.enabled = false;
        this.glide = null;
        this.follow = null;
        this.joystick = null;
        this.lookPointer = null;
        this.pointers = new Map();
        this.hoverPoint = new THREE.Vector2();
        this.hasHover = false;
        this.moved = false;
        this.listeners = [];
        this.bind();
    }

    on(target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        this.listeners.push(() => target.removeEventListener(type, fn, opts));
    }

    bind() {
        const c = this.canvas;
        this.on(window, 'keydown', e => {
            if (!this.enabled || e.target.closest?.('input, textarea, select, [role="dialog"]')) return;
            const k = e.key.toLowerCase();
            // Space jumps (unless a button has focus, where space presses it)
            if (k === ' ' && !e.target.closest?.('button, a')) {
                e.preventDefault();
                this.jump();
                return;
            }
            if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'q'].includes(k)) {
                if (k.startsWith('arrow')) e.preventDefault();
                this.keys.add(k);
                if (k !== 'shift') { this.cancelGlide(); this.stopFollowing(); this.onManualInput?.(); }
            }
        });
        this.on(window, 'keyup', e => this.keys.delete(e.key.toLowerCase()));
        this.on(window, 'blur', () => this.keys.clear());

        this.on(c, 'pointerdown', e => {
            if (!this.enabled) return;
            c.setPointerCapture(e.pointerId);
            const start = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, time: performance.now(), moved: 0 };
            // Touch: left 40% of the screen is a joystick, the rest looks
            if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.4 && !this.joystick) {
                this.joystick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 };
                this.showJoystick(e.clientX, e.clientY);
                start.joystick = true;
            }
            this.pointers.set(e.pointerId, start);
        });
        this.on(c, 'pointermove', e => {
            if (!this.enabled) return;
            const p = this.pointers.get(e.pointerId);
            if (e.pointerType === 'mouse') {
                this.hoverPoint.set(e.clientX, e.clientY);
                this.hasHover = true;
            }
            if (!p) return;
            const dx = e.clientX - p.lastX;
            const dy = e.clientY - p.lastY;
            p.lastX = e.clientX;
            p.lastY = e.clientY;
            p.moved += Math.abs(dx) + Math.abs(dy);
            if (p.joystick && this.joystick?.id === e.pointerId) {
                const jx = e.clientX - this.joystick.ox;
                const jy = e.clientY - this.joystick.oy;
                const len = Math.min(1, Math.hypot(jx, jy) / 55);
                const ang = Math.atan2(jy, jx);
                this.joystick.x = Math.cos(ang) * len;
                this.joystick.y = Math.sin(ang) * len;
                this.moveJoystickKnob(this.joystick.x, this.joystick.y);
                if (len > 0.1) { this.cancelGlide(); this.stopFollowing(); this.onManualInput?.(); }
                return;
            }
            if (p.moved > 6) {
                const speed = e.pointerType === 'touch' ? TOUCH_LOOK_SPEED : LOOK_SPEED;
                this.yaw -= dx * speed;
                this.pitch = THREE.MathUtils.clamp(this.pitch - dy * speed, -PITCH_LIMIT, PITCH_LIMIT);
                this.cancelGlide();
                this.stopFollowing();
                this.onManualInput?.();
                c.classList.add('is-dragging');
            }
        });
        const end = e => {
            const p = this.pointers.get(e.pointerId);
            this.pointers.delete(e.pointerId);
            c.classList.remove('is-dragging');
            if (this.joystick?.id === e.pointerId) {
                this.joystick = null;
                this.hideJoystick();
            }
            if (!p || !this.enabled || e.type === 'pointercancel') return;
            if (p.moved < 8 && performance.now() - p.time < 600 && !p.joystick) {
                this.onTap(e.clientX, e.clientY);
            }
        };
        this.on(c, 'pointerup', end);
        this.on(c, 'pointercancel', end);
        this.on(c, 'pointerleave', () => { this.hasHover = false; this.onHover(null); });
        this.on(c, 'contextmenu', e => e.preventDefault());
    }

    showJoystick(x, y) {
        if (!this.joyEl) {
            this.joyEl = document.createElement('div');
            this.joyEl.className = 'cafe-joystick';
            this.joyEl.innerHTML = '<span class="cafe-joystick__knob"></span>';
            document.body.appendChild(this.joyEl);
        }
        this.joyEl.style.left = `${x}px`;
        this.joyEl.style.top = `${y}px`;
        this.joyEl.classList.add('is-visible');
        this.moveJoystickKnob(0, 0);
    }

    moveJoystickKnob(x, y) {
        if (this.joyEl) this.joyEl.firstChild.style.transform = `translate(${x * 40}px, ${y * 40}px)`;
    }

    hideJoystick() {
        if (this.joyEl) this.joyEl.classList.remove('is-visible');
    }

    /** Smoothly travel to a viewing pose. Resolves when we arrive. */
    glideTo(pos, look, duration = 1.1) {
        this.cancelGlide();
        const dir = look.clone().sub(pos);
        const targetYaw = Math.atan2(-dir.x, -dir.z);
        const targetPitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
        // Turn the short way round
        let yawDelta = ((targetYaw - this.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
        return new Promise(resolve => {
            if (this.reducedMotion()) {
                this.position.copy(pos);
                this.yaw = this.yaw + yawDelta;
                this.pitch = targetPitch;
                resolve(true);
                return;
            }
            this.glide = {
                from: this.position.clone(), to: pos.clone(),
                yaw0: this.yaw, yaw1: this.yaw + yawDelta,
                pitch0: this.pitch, pitch1: targetPitch,
                t: 0, duration: Math.max(0.5, Math.min(duration, 0.4 + this.position.distanceTo(pos) * 0.22)),
                resolve
            };
        });
    }

    /**
     * Walk along behind something (the corgi). `step` is called every frame
     * and returns { pos, look } to head for, or null when we've arrived.
     */
    startFollowing(step, onStop) {
        this.stopFollowing();
        this.follow = { step, onStop };
    }

    stopFollowing() {
        if (!this.follow) return;
        const f = this.follow;
        this.follow = null;
        if (f.onStop) f.onStop();
    }

    jump() {
        if (this.jumpY > 0.001 || this.jumpVelocity !== 0) return;
        this.jumpVelocity = 3.3;
        if (this.onJump) this.onJump();
    }

    cancelGlide() {
        if (this.glide) {
            const g = this.glide;
            this.glide = null;
            g.resolve(false);
        }
    }

    update(dt) {
        if (this.glide) {
            const g = this.glide;
            g.t = Math.min(1, g.t + dt / g.duration);
            const e = easeInOutCubic(g.t);
            this.position.lerpVectors(g.from, g.to, e);
            this.yaw = THREE.MathUtils.lerp(g.yaw0, g.yaw1, e);
            this.pitch = THREE.MathUtils.lerp(g.pitch0, g.pitch1, e);
            if (g.t >= 1) {
                this.glide = null;
                g.resolve(true);
            }
        } else if (this.enabled && this.follow) {
            const target = this.follow.step();
            if (!target) {
                this.follow = null;
            } else {
                const dx = target.pos.x - this.position.x;
                const dz = target.pos.z - this.position.z;
                const dist = Math.hypot(dx, dz);
                if (dist > 0.05) {
                    // Hurry a little when the dog gets ahead
                    const speed = Math.min(RUN_SPEED, WALK_SPEED * (0.6 + dist * 0.5));
                    const stepLen = Math.min(dist, speed * dt);
                    this.position.x += (dx / dist) * stepLen;
                    this.position.z += (dz / dist) * stepLen;
                    this.collide(this.position, 0.28);
                }
                const dir = target.look.clone().sub(this.position);
                const wantYaw = Math.atan2(-dir.x, -dir.z);
                const wantPitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
                let yawDelta = ((wantYaw - this.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
                if (yawDelta < -Math.PI) yawDelta += Math.PI * 2;
                const ease = Math.min(1, dt * 4);
                this.yaw += yawDelta * ease;
                this.pitch += (wantPitch - this.pitch) * ease;
                this.velocity.set(0, 0, 0);
            }
        } else if (this.enabled) {
            const k = this.keys;
            let forward = (k.has('w') ? 1 : 0) - (k.has('s') ? 1 : 0);
            let strafe = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
            const turn = (k.has('arrowleft') || k.has('q') ? 1 : 0) - (k.has('arrowright') ? 1 : 0);
            this.yaw += turn * TURN_SPEED * dt;
            // Up / down arrows tilt the view
            const tilt = (k.has('arrowup') ? 1 : 0) - (k.has('arrowdown') ? 1 : 0);
            this.pitch = THREE.MathUtils.clamp(this.pitch + tilt * TURN_SPEED * 0.7 * dt, -PITCH_LIMIT, PITCH_LIMIT);
            if (this.joystick) {
                forward = -this.joystick.y;
                strafe = this.joystick.x;
            }
            const speed = k.has('shift') ? RUN_SPEED : WALK_SPEED;
            const sin = Math.sin(this.yaw);
            const cos = Math.cos(this.yaw);
            const target = new THREE.Vector3(
                (-sin * forward + cos * strafe),
                0,
                (-cos * forward - sin * strafe)
            );
            if (target.lengthSq() > 1) target.normalize();
            target.multiplyScalar(speed);
            this.velocity.lerp(target, Math.min(1, dt * 10));
            this.position.addScaledVector(this.velocity, dt);
            this.position.y = EYE;
            this.collide(this.position, 0.28);
            if (this.velocity.lengthSq() > 0.01) this.moved = true;
        }
        // Jump arc, layered on top of whatever else is moving us
        if (this.jumpVelocity !== 0 || this.jumpY > 0) {
            this.jumpVelocity -= 9.8 * dt;
            this.jumpY += this.jumpVelocity * dt;
            if (this.jumpY <= 0) {
                this.jumpY = 0;
                this.jumpVelocity = 0;
            }
        }
        this.camera.position.copy(this.position);
        this.camera.position.y += this.jumpY;
        this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    }

    setPose(pos, look) {
        this.position.copy(pos);
        const dir = look.clone().sub(pos);
        this.yaw = Math.atan2(-dir.x, -dir.z);
        this.pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    }

    dispose() {
        this.listeners.forEach(off => off());
        this.listeners = [];
        if (this.joyEl) this.joyEl.remove();
    }
}

export function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
