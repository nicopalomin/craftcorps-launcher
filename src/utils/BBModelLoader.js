import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// Three.js BoxGeometry material groups (when using material array):
// Index 0: Right face (+X) = east
// Index 1: Left face (-X) = west  
// Index 2: Top face (+Y) = up
// Index 3: Bottom face (-Y) = down
// Index 4: Front face (+Z) = south
// Index 5: Back face (-Z) = north
const FACE_ORDER = ['east', 'west', 'up', 'down', 'south', 'north'];

/**
 * Create a texture for a single face by extracting UV region from atlas
 */
function createFaceTexture(image, face, texWidth, texHeight, direction) {
    if (!face || !face.uv) {
        return null;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let [u1, v1, u2, v2] = face.uv;

    // User logic: [Offset Horizontal, Offset Vertical, Size Horizontal, Size Vertical]
    const width = u2;
    const height = v2;

    if (width < 0.01 || height < 0.01) {
        return null;
    }

    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    ctx.imageSmoothingEnabled = false;

    if (face.rotation) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((face.rotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
    }

    // No automatic flipping based on coordinates, using start positions directly
    const srcX = u1;
    const srcY = v1;

    ctx.drawImage(
        image,
        srcX, srcY, width, height,
        0, 0, canvas.width, canvas.height
    );

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}

const createCubeMesh = (cube, texWidth, texHeight, image) => {
    const origin = cube.origin || [0, 0, 0];
    const size = cube.size || [0, 0, 0];
    const uv = cube.uv || [0, 0];
    const inflate = cube.inflate || 0;

    const w = size[0] + inflate * 2;
    const h = size[1] + inflate * 2;
    const d = size[2] + inflate * 2;

    if (w === 0 && h === 0 && d === 0) return null;

    const geometry = new THREE.BoxGeometry(w || 0.05, h || 0.05, d || 0.05);
    const materials = [];

    if (Array.isArray(uv)) {
        const u = uv[0];
        const v = uv[1];
        const sw = size[0];
        const sh = size[1];
        const sd = size[2];

        const faces = [
            { name: 'east', rx: u + sd + sw, ry: v + sd, rw: sd, rh: sh },
            { name: 'west', rx: u, ry: v + sd, rw: sd, rh: sh },
            { name: 'up', rx: u + sd, ry: v, rw: sw, rh: sd },
            { name: 'down', rx: u + sd + sw, ry: v, rw: sw, rh: sd },
            { name: 'south', rx: u + sd, ry: v + sd, rw: sw, rh: sh },
            { name: 'north', rx: u + sd + sw + sd, ry: v + sd, rw: sw, rh: sh },
        ];

        faces.forEach(f => {
            const u1 = f.rx;
            const v1 = f.ry;
            const u2 = f.rx + f.rw;
            const v2 = f.ry + f.rh;
            const mockFace = { uv: [u1, v1, u2, v2] };
            const texture = image ? createFaceTexture(image, mockFace, texWidth, texHeight, f.name) : null;

            if (texture) {
                materials.push(new THREE.MeshStandardMaterial({
                    map: texture,
                    transparent: true,
                    alphaTest: 0.1,
                    side: THREE.DoubleSide
                }));
            } else {
                materials.push(new THREE.MeshStandardMaterial({
                    color: 0xFFFFFF,
                    visible: !!image,
                    transparent: true,
                    opacity: 0.5
                }));
            }
        });
    } else {
        for (let i = 0; i < 6; i++) {
            materials.push(new THREE.MeshBasicMaterial({ color: 0xcccccc, wireframe: true }));
        }
    }

    const mesh = new THREE.Mesh(geometry, materials);
    mesh.position.set(
        origin[0] + w / 2 - inflate,
        origin[1] + h / 2 - inflate,
        origin[2] + d / 2 - inflate
    );

    return mesh;
};

const parseBones = (bones, texWidth, texHeight, image, group) => {
    const boneMap = new Map();
    const rootBones = [];

    bones.forEach(bone => {
        const boneGroup = new THREE.Group();
        boneGroup.name = bone.name;
        boneMap.set(bone.name, boneGroup);
        boneGroup.userData.pivot = bone.pivot || [0, 0, 0];
        boneGroup.userData.rotation = bone.rotation || [0, 0, 0];

        if (bone.cubes) {
            bone.cubes.forEach(cube => {
                const mesh = createCubeMesh(cube, texWidth, texHeight, image);
                if (mesh) boneGroup.add(mesh);
            });
        }
    });

    bones.forEach(bone => {
        const boneGroup = boneMap.get(bone.name);
        if (bone.parent) {
            const parentGroup = boneMap.get(bone.parent);
            if (parentGroup) parentGroup.add(boneGroup);
            else rootBones.push(boneGroup);
        } else {
            rootBones.push(boneGroup);
        }

        const pivot = boneGroup.userData.pivot;
        if (bone.rotation) {
            const rot = bone.rotation;
            boneGroup.rotation.set(
                (rot[0] || 0) * Math.PI / 180,
                (rot[1] || 0) * Math.PI / 180,
                (rot[2] || 0) * Math.PI / 180
            );

            if (pivot) {
                boneGroup.children.forEach(child => {
                    if (child.isMesh) {
                        child.position.x -= pivot[0];
                        child.position.y -= pivot[1];
                        child.position.z -= pivot[2];
                    }
                });
                boneGroup.position.set(pivot[0], pivot[1], pivot[2]);
            }
        }
    });

    rootBones.forEach(b => group.add(b));
};

const createGenericElementMesh = (element, texture, texWidth, texHeight) => {
    const from = element.from;
    const to = element.to;

    // Size Logic: Size = to - from (with small epsilon for zero-thickness)
    const w = Math.max(to[0] - from[0], 0.01);
    const h = Math.max(to[1] - from[1], 0.01);
    const d = Math.max(to[2] - from[2], 0.01);

    // Positions based on FROM + SIZE/2
    const cx = from[0] + w / 2;
    const cy = from[1] + h / 2;
    const cz = from[2] + d / 2;

    const group = new THREE.Group();

    // Shared material for all faces if texture exists
    const material = texture ? new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.1
    }) : new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.DoubleSide });

    // Faces based on user SIZE + OFFSET logic
    const faceConfigs = [
        { name: 'north', width: w, height: h, pos: [cx, cy, from[2]], rot: [0, Math.PI, 0] },
        { name: 'south', width: w, height: h, pos: [cx, cy, from[2] + d], rot: [0, 0, 0] },
        { name: 'east', width: d, height: h, pos: [from[0] + w, cy, cz], rot: [0, Math.PI / 2, 0] },
        { name: 'west', width: d, height: h, pos: [from[0], cy, cz], rot: [0, -Math.PI / 2, 0] },
        { name: 'up', width: w, height: d, pos: [cx, from[1] + h, cz], rot: [-Math.PI / 2, 0, 0] },
        { name: 'down', width: w, height: d, pos: [cx, from[1], cz], rot: [Math.PI / 2, 0, 0] },
    ];

    faceConfigs.forEach(f => {
        if (!element.faces || !element.faces[f.name]) return;

        const faceData = element.faces[f.name];
        const geom = new THREE.PlaneGeometry(Math.max(f.width, 0.001), Math.max(f.height, 0.001));

        // Direct UV Mapping
        if (texture && faceData.uv) {
            let [u1, v1, u2, v2] = faceData.uv;

            // Convert to 0-1 range
            const uMin = u1 / texWidth;
            const vMin = 1 - (v2 / texHeight); // Invert Y
            const uMax = u2 / texWidth;
            const vMax = 1 - (v1 / texHeight); // Invert Y

            // Standard quad has 4 UVs: top-left, top-right, bottom-left, bottom-right
            // PlaneGeometry vertices are: [0] Top-Left, [1] Top-Right, [2] Bottom-Left, [3] Bottom-Right
            const uvAttribute = geom.attributes.uv;

            // Set UVs explicitly to match the sub-region
            uvAttribute.setXY(0, uMin, vMax); // Top-Left
            uvAttribute.setXY(1, uMax, vMax); // Top-Right
            uvAttribute.setXY(2, uMin, vMin); // Bottom-Left
            uvAttribute.setXY(3, uMax, vMin); // Bottom-Right

            // Handle texture rotation (90 deg steps)
            if (faceData.rotation) {
                const cx = (uMin + uMax) / 2;
                const cy = (vMin + vMax) / 2;
                const r = -faceData.rotation * (Math.PI / 180); // Negative because UV space usually rotates opposite

                for (let i = 0; i < uvAttribute.count; i++) {
                    const x = uvAttribute.getX(i) - cx;
                    const y = uvAttribute.getY(i) - cy;
                    const x2 = x * Math.cos(r) - y * Math.sin(r);
                    const y2 = x * Math.sin(r) + y * Math.cos(r);
                    uvAttribute.setXY(i, x2 + cx, y2 + cy);
                }
            }
        }

        const mesh = new THREE.Mesh(geom, material);
        mesh.position.set(f.pos[0], f.pos[1], f.pos[2]);
        mesh.rotation.set(f.rot[0], f.rot[1], f.rot[2]);
        group.add(mesh);
    });

    if (element.rotation) {
        const { origin, axis, angle } = element.rotation;
        const pivot = new THREE.Group();
        pivot.position.set(origin[0], origin[1], origin[2]);

        const rad = (angle || 0) * (Math.PI / 180);
        if (axis === 'x') pivot.rotation.x = rad;
        else if (axis === 'y') pivot.rotation.y = rad;
        else if (axis === 'z') pivot.rotation.z = rad;

        group.position.sub(pivot.position);
        pivot.add(group);
        return pivot;
    }

    return group;
};

export const loadBBModel = async (url, textureUrl = null) => {
    try {
        const response = await fetch(url);
        const modelData = await response.json();
        const group = new THREE.Group();

        let texture = null;
        if (textureUrl) {
            texture = await new THREE.TextureLoader().loadAsync(textureUrl);
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            texture.colorSpace = THREE.SRGBColorSpace;
        }

        const [texWidth, texHeight] = modelData.texture_size || [32, 32];

        if (modelData.elements) {
            let i = 0;

            modelData.elements.forEach(element => {

                // Task: Filter to ONLY these cubes for testing
                const isFirstCube = element.from[0] === 4 && element.from[1] === 4.5 && element.from[2] === 2;
                const isSecondCube = element.from[0] === 6 && element.from[1] === 4.5 && element.from[2] === 0;
                const isThirdCube = element.from[0] === 4 && element.from[1] === 4.5 && element.from[2] === 12;
                const isFourthCube = element.from[0] === 4 && element.from[1] === 11.5 && element.from[2] === 5;
                const isFifthCube = element.from[0] === 12.2 && element.from[1] === 11.75 && element.from[2] === 4.25;

                if (i++ < 12) {
                    console.log('[BBModelLoader] Rendering test cube:', element.from, element.to);
                    const mesh = createGenericElementMesh(element, texture, texWidth, texHeight);
                    if (mesh) group.add(mesh);
                }
            });
        }
        return group;
    } catch (error) {
        console.error('[BBModelLoader] Error:', error);
        return null;
    }
};
