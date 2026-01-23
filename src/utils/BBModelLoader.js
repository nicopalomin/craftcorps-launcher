
import * as THREE from 'three';

/**
 * BBModel Loader for Three.js
 * Loads Blockbench (.bbmodel) JSON files and creates Three.js geometry
 * 
 * Key features:
 * - Supports zero-width faces (planes)
 * - Creates per-face textures with proper UV mapping
 * - Uses BoxGeometry with multi-material approach
 * - Centers model at (0,0,0) in Minecraft coordinate space
 */

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
        return null; // Return null so caller can create invisible material
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    let [u1, v1, u2, v2] = face.uv;

    // Calculate dimensions
    const width = Math.abs(u2 - u1);
    const height = Math.abs(v2 - v1);

    if (width < 0.01 || height < 0.01) {
        console.log(`      → ${direction}: ZERO-SIZE UV (${width.toFixed(2)}x${height.toFixed(2)}) - will be invisible`);
        return null; // Return null so caller can create invisible material
    }

    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    ctx.imageSmoothingEnabled = false;

    // Handle UV flipping
    let flipX = u1 > u2;
    let flipY = v1 > v2;

    // Special case for down face
    if (direction === 'down') {
        flipX = !flipX;
    }

    console.log(`      → ${direction}: Canvas ${canvas.width}x${canvas.height}, flipX=${flipX}, flipY=${flipY}, rot=${face.rotation || 0}`);

    // Apply transformations
    if (face.rotation) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((face.rotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
    }

    if (flipX) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }
    if (flipY) {
        ctx.translate(0, canvas.height);
        ctx.scale(1, -1);
    }

    // Draw texture region
    const srcX = Math.min(u1, u2);
    const srcY = Math.min(v1, v2);

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

/**
 * Load and parse a BBModel file
 */
export const loadBBModel = async (url, textureUrl = null) => {
    console.log('[BBModelLoader] Loading BBModel from:', url);

    try {
        // Load model JSON
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load model: ${response.statusText}`);
        }
        const modelData = await response.json();

        // Determine texture path
        let texturePath = textureUrl;
        if (!texturePath && modelData.textures) {
            if (Array.isArray(modelData.textures)) {
                const tex = modelData.textures.find(t => t.source);
                if (tex) texturePath = tex.source;
            } else {
                // Object format - get first non-reference texture
                for (const key in modelData.textures) {
                    const value = modelData.textures[key];
                    if (value && !value.startsWith('#')) {
                        texturePath = value;
                        break;
                    }
                }
            }
        }

        if (!texturePath) {
            console.warn('[BBModelLoader] No texture found in model');
        }

        // Load texture image
        const image = await new Promise((resolve, reject) => {
            if (!texturePath) {
                resolve(null);
                return;
            }
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = (e) => {
                console.warn('[BBModelLoader] Failed to load texture:', e);
                resolve(null);
            };
            img.src = texturePath;
        });

        // Get texture size
        const texWidth = modelData.texture_size ? modelData.texture_size[0] : 16;
        const texHeight = modelData.texture_size ? modelData.texture_size[1] : 16;

        console.log('[BBModelLoader] Texture size:', texWidth, 'x', texHeight);
        console.log('[BBModelLoader] Elements:', modelData.elements?.length);

        // Create group to hold all meshes
        const group = new THREE.Group();

        if (!modelData.elements || modelData.elements.length === 0) {
            console.warn('[BBModelLoader] No elements in model');
            return group;
        }

        // Process each element (cube/plane)
        modelData.elements.forEach((element, index) => {
            if (!element.from || !element.to) {
                console.warn(`[BBModelLoader] Element ${index} missing from/to`);
                return;
            }

            const elementName = element.name || `Element_${index}`;
            console.log(`\n[BBModelLoader] ========== Processing ${elementName} ==========`);

            // Calculate size
            const size = [
                element.to[0] - element.from[0],
                element.to[1] - element.from[1],
                element.to[2] - element.from[2]
            ];

            console.log(`[BBModelLoader] Original size: [${size[0]}, ${size[1]}, ${size[2]}]`);
            console.log(`[BBModelLoader] From: [${element.from.join(', ')}] To: [${element.to.join(', ')}]`);

            // Use small epsilon for zero-width dimensions to prevent degenerate geometry
            // This creates a very thin box that can still be rendered
            const EPSILON = 0.05;
            const width = size[0] || EPSILON;
            const height = size[1] || EPSILON;
            const depth = size[2] || EPSILON;

            console.log(`[BBModelLoader] Geometry size: [${width}, ${height}, ${depth}]`);

            // Create box geometry
            const geometry = new THREE.BoxGeometry(width, height, depth);

            // Create materials for each face
            const materials = FACE_ORDER.map(direction => {
                const face = element.faces?.[direction];

                if (!face) {
                    console.log(`[BBModelLoader]   ${direction}: NO FACE DEFINED`);
                    // No face defined - use invisible material
                    return new THREE.MeshBasicMaterial({
                        visible: false,
                        transparent: true,
                        side: THREE.DoubleSide
                    });
                }

                console.log(`[BBModelLoader]   ${direction}: UV=[${face.uv?.join(', ') || 'none'}] rotation=${face.rotation || 0}`);

                if (!image) {
                    // No texture - use colored material
                    return new THREE.MeshStandardMaterial({
                        color: 0xFF00FF,
                        roughness: 1,
                        metalness: 0,
                        side: THREE.DoubleSide
                    });
                }

                // Create texture for this face
                const texture = createFaceTexture(image, face, texWidth, texHeight, direction);

                // If texture is null (zero-size UV or invalid), make face invisible
                if (!texture) {
                    return new THREE.MeshBasicMaterial({
                        visible: false,
                        transparent: true,
                        side: THREE.DoubleSide
                    });
                }

                return new THREE.MeshStandardMaterial({
                    map: texture,
                    transparent: true,
                    alphaTest: 0.1,
                    roughness: 1,
                    metalness: 0,
                    side: THREE.DoubleSide  // Critical for thin/zero-width elements
                });
            });

            // Create mesh
            const mesh = new THREE.Mesh(geometry, materials);
            mesh.name = elementName;

            // Position: center of the box in Minecraft coordinates
            // Minecraft uses 0-16 coordinate space, we center at (8, 8, 8)
            // So we subtract 8 from the midpoint to center at (0, 0, 0)
            const centerX = (element.from[0] + element.to[0]) / 2 - 8;
            const centerY = (element.from[1] + element.to[1]) / 2 - 8;
            const centerZ = (element.from[2] + element.to[2]) / 2 - 8;

            mesh.position.set(centerX, centerY, centerZ);

            console.log(`[BBModelLoader] Mesh position: [${centerX.toFixed(2)}, ${centerY.toFixed(2)}, ${centerZ.toFixed(2)}]`);

            // Handle rotation if specified
            if (element.rotation) {
                const { origin, axis, angle } = element.rotation;

                // Pivot point in centered coordinates
                const pivotX = origin[0] - 8;
                const pivotY = origin[1] - 8;
                const pivotZ = origin[2] - 8;

                // Translate to pivot
                mesh.position.sub(new THREE.Vector3(pivotX, pivotY, pivotZ));

                // Apply rotation
                const angleRad = (angle * Math.PI) / 180;
                const rotMatrix = new THREE.Matrix4();

                if (axis === 'x') rotMatrix.makeRotationX(angleRad);
                else if (axis === 'y') rotMatrix.makeRotationY(angleRad);
                else if (axis === 'z') rotMatrix.makeRotationZ(angleRad);

                mesh.applyMatrix4(rotMatrix);

                // Translate back from pivot
                mesh.position.add(new THREE.Vector3(pivotX, pivotY, pivotZ));
            }

            group.add(mesh);
            console.log(`[BBModelLoader] ✓ Added ${elementName} to group`);
        });

        console.log('[BBModelLoader] Loaded', group.children.length, 'elements');

        // NOTE: We do NOT apply display.head transforms here
        // The JSON only contains model geometry data
        // Placement/scaling is handled by the parent system (SkinViewer)

        return group;

    } catch (error) {
        console.error('[BBModelLoader] Error loading model:', error);
        return null;
    }
};
