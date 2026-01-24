import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { loadBBModel } from '../../utils/BBModelLoader';


/**
 * Renders an arbitrary 3D Model (JSON+UV) with auto-rotation
 * Uses BBModelLoader to support Blockbench/Bedrock/GeckoLib formats
 */
const Model3DRender = ({ modelUrl, textureUrl, className = '', autoRotate = true, scale = 1 }) => {
    const canvasRef = useRef(null);
    const sceneRef = useRef(null);
    const modelRef = useRef(null);
    const animationFrameRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current || !modelUrl) return;

        let mounted = true;

        // Scene Setup
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Camera Setup
        const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        camera.position.set(0, 0, 40); // Start further back
        camera.lookAt(0, 0, 0);

        // Renderer Setup
        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            alpha: true,
            antialias: true
        });
        renderer.outputColorSpace = THREE.SRGBColorSpace;

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

        // Lighting Setup
        // Stronger, more dramatic lighting for products
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
        keyLight.position.set(-10, 20, 20);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
        fillLight.position.set(20, 0, 10);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
        rimLight.position.set(0, 5, -20);
        scene.add(rimLight);



        // Load Model
        const loadModel = async () => {
            try {
                const group = await loadBBModel(modelUrl, textureUrl);

                if (!mounted) return;

                if (group) {
                    // Center and Scale Model
                    const box = new THREE.Box3().setFromObject(group);
                    const center = box.getCenter(new THREE.Vector3());
                    const size = box.getSize(new THREE.Vector3());

                    // Recenter geometry
                    group.position.sub(center);

                    // Normalize scale to fit in view
                    // Max dimension should be around 16 units (like a head)
                    const maxDim = Math.max(size.x, size.y, size.z);
                    const targetSize = 16 * scale;

                    if (maxDim > 0) {
                        const scaleFactor = targetSize / maxDim;
                        group.scale.set(scaleFactor, scaleFactor, scaleFactor);
                    }

                    // Rotation Container
                    const pivotGroup = new THREE.Group();
                    pivotGroup.add(group);

                    // Initial Rotation for nice angle
                    pivotGroup.rotation.y = Math.PI / 4;
                    pivotGroup.rotation.x = 0.2;

                    scene.add(pivotGroup);
                    modelRef.current = pivotGroup;
                } else {
                    console.warn('[Model3DRender] Failed to generate geometry');
                }
            } catch (err) {
                console.error('[Model3DRender] Error loading model', err);
            }
        };

        loadModel();

        // Animation loop
        let time = 0;
        const animate = () => {
            if (!mounted) return;
            animationFrameRef.current = requestAnimationFrame(animate);

            time += 0.01;

            if (modelRef.current) {
                if (autoRotate) {
                    modelRef.current.rotation.y += 0.01;
                }

                // Gentle float
                modelRef.current.position.y = Math.sin(time) * 1.0;
            }

            renderer.render(scene, camera);
        };

        animate();

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
                sceneRef.current.clear();
                renderer.dispose();
            }
        };
    }, [modelUrl, textureUrl, autoRotate, scale]);

    return (
        <canvas
            ref={canvasRef}
            className={`model-3d-render ${className}`}
            style={{
                width: '100%',
                height: '100%',
                display: 'block'
            }}
        />
    );
};

export default Model3DRender;
