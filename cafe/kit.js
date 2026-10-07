/**
 * Iron Pig Café - building blocks.
 *
 * Toon materials in the CSS palette, inverted-hull ink outlines, and a
 * batcher that merges every static prop into a handful of draw calls.
 */
import * as THREE from '../vendor/three/three.r186.min.js';
import { RoundedBoxGeometry, mergeGeometries } from '../vendor/three/three.r186.min.js';
import { COLORS } from './textures.js';

/* ---------- Materials ---------- */

// Three hard bands: shadow, mid, lit
const toonRamp = (() => {
    const data = new Uint8Array([105, 180, 255]);
    const texture = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
})();

const materialCache = new Map();

export function toon(color, options = {}) {
    // Only plain colours are shared; anything with options gets its own material
    const key = Object.keys(options).length ? null : `toon:${color}`;
    if (key && materialCache.has(key)) return materialCache.get(key);
    const material = new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, ...options });
    if (key) materialCache.set(key, material);
    return material;
}

export function lambert(color, options = {}) {
    return new THREE.MeshLambertMaterial({ color, ...options });
}

/** Unlit and untouched by tone mapping: neon, screens, glows */
export function glowMaterial(options = {}) {
    return new THREE.MeshBasicMaterial({ toneMapped: false, ...options });
}

export function disposeMaterialCache() {
    materialCache.forEach(m => m.dispose());
    materialCache.clear();
}

/* ---------- Ink outlines (inverted hull) ---------- */

function makeOutlineMaterial(color, thickness) {
    return new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(color) },
            thickness: { value: thickness }
        },
        vertexShader: /* glsl */`
            uniform float thickness;
            void main() {
                vec3 pushed = position + normalize(normal) * thickness;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pushed, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 color;
            void main() {
                gl_FragColor = vec4(color, 1.0);
                #include <colorspace_fragment>
            }
        `,
        side: THREE.BackSide
    });
}

export const outlineMaterial = makeOutlineMaterial(COLORS.outline, 0.009);
export const highlightMaterial = makeOutlineMaterial(COLORS.accent, 0.018);

/** Give a mesh an ink outline as a child, so it follows any animation */
export function outline(mesh) {
    const hull = new THREE.Mesh(mesh.geometry, outlineMaterial);
    hull.userData.isOutline = true;
    hull.raycast = () => {};
    mesh.add(hull);
    return mesh;
}

/* ---------- Geometry helpers ---------- */

export function rbox(w, h, d, radius = 0.012) {
    const r = Math.min(radius, w / 2.01, h / 2.01, d / 2.01);
    return new RoundedBoxGeometry(w, h, d, 2, r);
}

export function cyl(rTop, rBottom, h, segments = 24, open = false) {
    return new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1, open);
}

export function sphere(r, w = 20, h = 14) {
    return new THREE.SphereGeometry(r, w, h);
}

export function capsule(r, length, cap = 6, radial = 12) {
    return new THREE.CapsuleGeometry(r, length, cap, radial);
}

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();

export function matrix(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    tmpEuler.set(rx, ry, rz);
    tmpQuat.setFromEuler(tmpEuler);
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), tmpQuat, new THREE.Vector3(1, 1, 1));
}

/**
 * Collects static parts in world space, then merges them per material.
 * Outlined parts also go into one merged hull.
 */
export class Batcher {
    constructor() {
        this.byMaterial = new Map();
        this.hulls = [];
    }

    add(geometry, material, transform, { outlined = true, parent } = {}) {
        let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
        geometry.dispose();
        Object.keys(g.attributes).forEach(name => {
            if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
        });
        if (!g.attributes.uv) {
            g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        }
        tmpMatrix.copy(transform);
        if (parent) tmpMatrix.premultiply(parent);
        g.applyMatrix4(tmpMatrix);
        if (!this.byMaterial.has(material)) this.byMaterial.set(material, []);
        this.byMaterial.get(material).push(g);
        if (outlined) this.hulls.push(g);
        return g;
    }

    build(target) {
        const meshes = [];
        this.byMaterial.forEach((geos, material) => {
            const merged = mergeGeometries(geos, false);
            const mesh = new THREE.Mesh(merged, material);
            mesh.matrixAutoUpdate = false;
            target.add(mesh);
            meshes.push(mesh);
        });
        if (this.hulls.length) {
            const hullGeo = mergeGeometries(this.hulls.map(g => {
                const copy = new THREE.BufferGeometry();
                copy.setAttribute('position', g.attributes.position);
                copy.setAttribute('normal', g.attributes.normal);
                return copy;
            }), false);
            const hull = new THREE.Mesh(hullGeo, outlineMaterial);
            hull.matrixAutoUpdate = false;
            hull.raycast = () => {};
            target.add(hull);
        }
        this.byMaterial.forEach(geos => geos.forEach(g => g.dispose()));
        this.byMaterial.clear();
        this.hulls = [];
        return meshes;
    }
}

/** Additive cone of lamp light - fades from the shade down to nothing */
export function glowConeMaterial(color = '#ffdc96', opacity = 0.32) {
    return new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(color) },
            opacity: { value: opacity }
        },
        vertexShader: /* glsl */`
            varying float vY;
            varying vec3 vNormalView;
            varying vec3 vViewDir;
            void main() {
                vY = uv.y;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vNormalView = normalize(normalMatrix * normal);
                vViewDir = normalize(-mv.xyz);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 color;
            uniform float opacity;
            varying float vY;
            varying vec3 vNormalView;
            varying vec3 vViewDir;
            void main() {
                float rim = pow(abs(dot(vNormalView, vViewDir)), 1.5);
                float fade = pow(vY, 1.6);
                gl_FragColor = vec4(color, opacity * fade * rim);
                #include <colorspace_fragment>
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
}

/**
 * Merge a prop's static parts (and their ink outlines) into one mesh per
 * material, in the group's own space, so it can still move as a whole.
 * Anything in `keep` (and its children) stays separate for animation.
 */
export function compactGroup(group, keep = []) {
    group.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const keepSet = new Set(keep);
    const isKept = o => {
        for (let p = o; p && p !== group; p = p.parent) if (keepSet.has(p)) return true;
        return false;
    };
    const byMaterial = new Map();
    const hulls = [];
    const merged = [];
    group.traverse(o => {
        if (!o.isMesh || o.userData.isOutline || isKept(o) || o.material.transparent) return;
        const outlined = o.children.some(c => c.userData.isOutline);
        let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        Object.keys(g.attributes).forEach(name => {
            if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
        });
        if (!g.attributes.uv) {
            g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        }
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
        if (!byMaterial.has(o.material)) byMaterial.set(o.material, []);
        byMaterial.get(o.material).push(g);
        if (outlined) hulls.push(g);
        merged.push(o);
    });
    merged.forEach(o => {
        o.geometry.dispose();
        o.parent.remove(o);
        // Kept children of a merged mesh move up to the group
        [...o.children].forEach(c => { if (!c.userData.isOutline) group.attach(c); });
    });
    byMaterial.forEach((geos, material) => {
        group.add(new THREE.Mesh(mergeGeometries(geos, false), material));
    });
    if (hulls.length) {
        const hull = new THREE.Mesh(mergeGeometries(hulls.map(g => {
            const copy = new THREE.BufferGeometry();
            copy.setAttribute('position', g.attributes.position);
            copy.setAttribute('normal', g.attributes.normal);
            return copy;
        }), false), outlineMaterial);
        hull.userData.isOutline = true;
        hull.raycast = () => {};
        group.add(hull);
    }
    return group;
}
