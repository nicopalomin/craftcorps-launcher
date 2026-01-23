import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

/**
 * Renders a 3D Minecraft cape with slow rotation
 * Uses the same texture mapping as Minecraft/skinview3d
 */
const Cape3DRender = ({ capeUrl, className = '', autoRotate = true }) => {
    const canvasRef = useRef(null);
    const sceneRef = useRef(null);
    const capeRef = useRef(null);
    const animationFrameRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current || !capeUrl) return;

        // Scene Setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Camera Setup
        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        camera.position.set(0, 0, 30);
        camera.lookAt(0, 0, 0);

        // Renderer Setup
        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            alpha: true,
            antialias: true
        });
        renderer.outputColorSpace = THREE.SRGBColorSpace; // Critical for correct color vibrancy

        const updateSize = () => {
            const parent = canvasRef.current?.parentElement;
            if (!parent) return;

            const width = parent.clientWidth;
            const height = parent.clientHeight;
            const dpr = Math.max(window.devicePixelRatio || 1, 2);

            renderer.setSize(width, height);
            renderer.setPixelRatio(dpr);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        };

        updateSize();

        // Lighting Setup - Adjusted to match 2D render brightness
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2); // Balanced for clean colors
        scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 0.6); // Softer directional light
        keyLight.position.set(-10, 15, 15);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.2); // Subtle fill
        fillLight.position.set(10, -5, 10);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffffff, 0.15); // Minimal rim catch
        rimLight.position.set(0, 5, -15);
        scene.add(rimLight);

        // Load Cape Texture
        const textureLoader = new THREE.TextureLoader();
        textureLoader.setCrossOrigin('anonymous');

        textureLoader.load(
            capeUrl,
            (texture) => {
                // Ensure crisp pixels
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                // Don't flip the texture - we'll handle orientation correctly with UVs
                texture.flipY = false;
                // Ensure correct color mapping
                texture.colorSpace = THREE.SRGBColorSpace;

                // Minecraft cape dimensions (in pixels on texture)
                // Standard cape texture is 64x32
                // Back of cape is 10 pixels wide, 16 pixels tall
                const textureWidth = 64;
                const textureHeight = 32;

                // Cape back texture coordinates in the 64x32 texture
                // X: 1 to 11 (10 pixels)
                // Y: 1 to 17 (16 pixels)
                const capeBackX = 1;
                const capeBackY = 1;
                const capeBackWidth = 10;
                const capeBackHeight = 16;

                // Create Cape Geometry - using BoxGeometry for blocky 3D appearance
                const capeWidth = 10;
                const capeHeight = 16;
                const capeDepth = 1; // Thickness of the cape

                const geometry = new THREE.BoxGeometry(
                    capeWidth,
                    capeHeight,
                    capeDepth
                );

                // No curve needed for blocky style - keep it straight like Minecraft

                // Fix UV mapping to match Minecraft cape texture layout
                // Minecraft cape texture (64x32) layout:
                // Front (inner): x=0-10, y=1-17
                // Back (visible): x=12-22, y=1-17
                // Right edge: x=11-12, y=1-17
                // Left edge: x=0-1, y=1-17
                // Top: x=1-11, y=0-1
                // Bottom: x=11-21, y=0-1

                const uvs = geometry.attributes.uv;
                const uvArray = uvs.array;

                // BoxGeometry has 6 faces, each with 4 vertices (24 vertices total)
                // Face order: right, left, top, bottom, front, back
                // Each face: 4 UVs (bottom-left, bottom-right, top-left, top-right)

                // Helper function to set UVs for a face
                // Helper function to set UVs for a face - BufferGeometry order: TL, TR, BL, BR
                const setFaceUVs = (faceIndex, x1, y1, x2, y2) => {
                    const offset = faceIndex * 8;
                    // Top-Left (0)
                    uvArray[offset + 0] = x1 / textureWidth;
                    uvArray[offset + 1] = y1 / textureHeight;
                    // Top-Right (1)
                    uvArray[offset + 2] = x2 / textureWidth;
                    uvArray[offset + 3] = y1 / textureHeight;
                    // Bottom-Left (2)
                    uvArray[offset + 4] = x1 / textureWidth;
                    uvArray[offset + 5] = y2 / textureHeight;
                    // Bottom-Right (3)
                    uvArray[offset + 6] = x2 / textureWidth;
                    uvArray[offset + 7] = y2 / textureHeight;
                };

                // Mapping based on standard 64x32 Minecraft Cape texture
                // Layout:
                // Right side: x=0-1, y=1-17
                // Back (visible): x=1-11, y=1-17
                // Left side: x=11-12, y=1-17
                // Front (inner): x=12-22, y=1-17
                // Top: x=1-11, y=0-1
                // Bottom: x=11-21, y=0-1
                // Face indices: 0:Right, 1:Left, 2:Top, 3:Bottom, 4:Front, 5:Back

                // Right side (Face 0)
                setFaceUVs(0, 1, 1, 0, 17);

                // Left side (Face 1)
                setFaceUVs(1, 12, 1, 11, 17);

                // Top (Face 2)
                setFaceUVs(2, 11, 0, 1, 1);

                // Bottom (Face 3)
                setFaceUVs(3, 21, 0, 11, 1);

                // Front/inner (Face 4)
                setFaceUVs(4, 22, 1, 12, 17);

                // Back/visible (Face 5) - Main visible face
                setFaceUVs(5, 1, 1, 11, 17);

                uvs.needsUpdate = true;

                // Create Material - Matte Minecraft look
                const material = new THREE.MeshStandardMaterial({
                    map: texture,
                    side: THREE.FrontSide, // FrontSide is better for closed boxes
                    transparent: true,
                    alphaTest: 0.5, // Aggressive alpha test to ensure clean edges
                    roughness: 1.0,
                    metalness: 0.0
                });

                // Create a container group for the cape to handle tilt and rotation separately
                const capeGroup = new THREE.Group();
                scene.add(capeGroup);

                // Create Mesh
                const cape = new THREE.Mesh(geometry, material);
                cape.position.set(0, 0, 0);
                // Removed cape.rotation.z = Math.PI - Handling orientation in UVs now

                // Add to group
                capeGroup.add(cape);
                capeRef.current = cape;

                // Keep reference to group for rotation
                const groupObj = capeGroup;

                // Start facing the camera (design side)
                // Back face is at -z. To see it, we rotate 180 degrees (Math.PI)
                groupObj.rotation.y = Math.PI;

                // Apply permanent tilt
                cape.rotation.x = 0;
                cape.rotation.y = 0;

                // Animation loop
                let time = 0;
                const animate = () => {
                    animationFrameRef.current = requestAnimationFrame(animate);

                    time += 0.005;

                    if (capeRef.current) {
                        // Rotate the group instead of the mesh
                        if (autoRotate) {
                            groupObj.rotation.y += 0.015;
                        }

                        // Gentle floating bob
                        groupObj.position.y = Math.sin(time) * 0.3;

                        // Subtle sway relative to the tilt (Reversed)
                        capeRef.current.rotation.x = -0.2 + Math.sin(time * 0.7) * 0.05;
                    }

                    renderer.render(scene, camera);
                };

                animate();
            },
            undefined,
            (error) => {
                console.error('[Cape3DRender] Failed to load texture:', error);
            }
        );

        // Resize observer
        const resizeObserver = new ResizeObserver(() => {
            updateSize();
        });

        if (canvasRef.current.parentElement) {
            resizeObserver.observe(canvasRef.current.parentElement);
        }

        // Cleanup
        return () => {
            resizeObserver.disconnect();

            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            if (sceneRef.current) {
                sceneRef.current.traverse((object) => {
                    if (object.geometry) object.geometry.dispose();
                    if (object.material) {
                        if (object.material.map) object.material.map.dispose();
                        object.material.dispose();
                    }
                });
            }

            renderer.dispose();
        };
    }, [capeUrl, autoRotate]);

    return (
        <canvas
            ref={canvasRef}
            className={`cape-3d-render ${className}`}
            style={{
                width: '100%',
                height: '100%',
                display: 'block'
            }}
        />
    );
};

export default Cape3DRender;
