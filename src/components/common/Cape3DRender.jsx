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

        let mounted = true;

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
            if (!mounted || !canvasRef.current) return;
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
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
        keyLight.position.set(-10, 15, 15);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
        fillLight.position.set(10, -5, 10);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffffff, 0.15);
        rimLight.position.set(0, 5, -15);
        scene.add(rimLight);

        // Load Cape Texture
        const textureLoader = new THREE.TextureLoader();
        textureLoader.setCrossOrigin('anonymous');

        textureLoader.load(
            capeUrl,
            (texture) => {
                if (!mounted) {
                    texture.dispose();
                    return;
                }

                // Ensure crisp pixels
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.flipY = false;
                texture.colorSpace = THREE.SRGBColorSpace;

                // Minecraft cape dimensions
                const textureWidth = 64;
                const textureHeight = 32;

                // Create Cape Geometry
                const capeWidth = 10;
                const capeHeight = 16;
                const capeDepth = 1;

                const geometry = new THREE.BoxGeometry(
                    capeWidth,
                    capeHeight,
                    capeDepth
                );

                const uvs = geometry.attributes.uv;
                const uvArray = uvs.array;

                const setFaceUVs = (faceIndex, x1, y1, x2, y2) => {
                    const offset = faceIndex * 8;
                    uvArray[offset + 0] = x1 / textureWidth;
                    uvArray[offset + 1] = y1 / textureHeight;
                    uvArray[offset + 2] = x2 / textureWidth;
                    uvArray[offset + 3] = y1 / textureHeight;
                    uvArray[offset + 4] = x1 / textureWidth;
                    uvArray[offset + 5] = y2 / textureHeight;
                    uvArray[offset + 6] = x2 / textureWidth;
                    uvArray[offset + 7] = y2 / textureHeight;
                };

                // Face mapping
                setFaceUVs(0, 1, 1, 0, 17);
                setFaceUVs(1, 12, 1, 11, 17);
                setFaceUVs(2, 11, 0, 1, 1);
                setFaceUVs(3, 21, 0, 11, 1);
                setFaceUVs(4, 22, 1, 12, 17);
                setFaceUVs(5, 1, 1, 11, 17);

                uvs.needsUpdate = true;

                const material = new THREE.MeshStandardMaterial({
                    map: texture,
                    transparent: true,
                    alphaTest: 0.5,
                    roughness: 1.0,
                    metalness: 0.0
                });

                const capeGroup = new THREE.Group();
                scene.add(capeGroup);

                const cape = new THREE.Mesh(geometry, material);
                cape.position.set(0, 0, 0);
                capeGroup.add(cape);
                capeRef.current = cape;

                const groupObj = capeGroup;
                groupObj.rotation.y = Math.PI;
                cape.rotation.x = 0;
                cape.rotation.y = 0;

                // Animation loop
                let time = 0;
                const animate = () => {
                    if (!mounted) return;
                    animationFrameRef.current = requestAnimationFrame(animate);

                    time += 0.005;

                    if (capeRef.current) {
                        if (autoRotate) {
                            groupObj.rotation.y += 0.015;
                        }
                        groupObj.position.y = Math.sin(time) * 0.3;
                        capeRef.current.rotation.x = -0.2 + Math.sin(time * 0.7) * 0.05;
                    }

                    renderer.render(scene, camera);
                };

                animate();
            },
            undefined,
            (error) => {
                if (mounted) {
                    console.error('[Cape3DRender] Failed to load texture:', error);
                }
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
            mounted = false;
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
                sceneRef.current = null;
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
