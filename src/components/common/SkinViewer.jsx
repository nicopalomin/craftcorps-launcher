import React, { useEffect, useRef } from 'react';
import { SkinViewer as SkinViewer3D, IdleAnimation, WalkingAnimation, RunningAnimation, FlyingAnimation } from 'skinview3d';
import * as THREE from 'three';

// Custom Name Tag Generator
const createNameTag = (text) => {
    if (!text) return null;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const fontSize = 60; // High resolution for crisp text
    const font = `${fontSize}px Minecraft, monospace`;
    ctx.font = font;

    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;

    // Adjust these values to change background size
    const paddingX = 10; // Horizontal Padding
    const paddingY = 5; // Vertical Padding

    const canvasWidth = textWidth + paddingX * 2;
    const canvasHeight = fontSize + paddingY * 2;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Draw Background (Rounded)
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"; // Semi-transparent black
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(0, 0, canvasWidth, canvasHeight, 20); // 20px radius
    } else {
        ctx.rect(0, 0, canvasWidth, canvasHeight);
    }
    ctx.fill();

    // Draw Text
    ctx.font = font;
    ctx.fillStyle = "white";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    // Adjust Y slightly for visual centering
    ctx.fillText(text, canvasWidth / 2, canvasHeight / 2 + 5);

    const texture = new THREE.CanvasTexture(canvas);
    // Keep text crisp
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);

    // Determine world size
    // Standard head is 8x8x8. We want name tag to be proportional.
    // Height of 5 units seems appropriate relative to head size.
    const worldHeight = 5;
    sprite.scale.set((canvasWidth / canvasHeight) * worldHeight, worldHeight, 1);

    return sprite;
};

const SkinViewer = ({
    skinUrl,
    capeUrl,
    width = 300,
    height = 400,
    model = 'classic',
    animation = 'idle',
    background = null,
    cosmetics = [],
    nameTag = null,
    zoom = 70
}) => {
    const canvasRef = useRef(null);
    const viewerRef = useRef(null);
    const cosmeticsRef = useRef([]);

    // Initialize Viewer & Resize Observer
    useEffect(() => {
        if (!canvasRef.current) return;

        console.log("[SkinViewer] Initializing Premium Renderer...");
        const viewer = new SkinViewer3D({
            canvas: canvasRef.current,
            width: width,
            height: height,
            skin: skinUrl,
            cape: capeUrl,
            model: model,
            alpha: true // Always transparent for custom background FX
        });

        // Set nameTag after constructor
        if (nameTag) {
            try {
                viewer.nameTag = createNameTag(nameTag);
            } catch (err) {
                console.warn("[SkinViewer] Failed to set nameTag:", err);
            }
        }

        // --- PREMIUM LIGHTING SETUP ---
        if (viewer.scene) {
            // 1. Scene Lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            viewer.scene.add(ambientLight);

            // Spot/Point light from top-left for drama
            const spotLight = new THREE.PointLight(0xffffff, 1.2);
            spotLight.position.set(-20, 40, 30);
            viewer.scene.add(spotLight);

            // Rim light from behind
            const rimLight = new THREE.PointLight(0xffffff, 0.8);
            rimLight.position.set(20, 20, -30);
            viewer.scene.add(rimLight);

            // --- GROUND SHADOW ---
            const shadowCanvas = document.createElement('canvas');
            shadowCanvas.width = 128;
            shadowCanvas.height = 128;
            const shadowCtx = shadowCanvas.getContext('2d');
            const gradient = shadowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
            gradient.addColorStop(0, 'rgba(0,0,0,0.6)');
            gradient.addColorStop(0.5, 'rgba(0,0,0,0.2)');
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            shadowCtx.fillStyle = gradient;
            shadowCtx.fillRect(0, 0, 128, 128);

            const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
            const shadowGeo = new THREE.PlaneGeometry(25, 25);
            const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.5 });
            const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
            shadowMesh.rotation.x = -Math.PI / 2;
            shadowMesh.position.y = -31.5; // Feet bottom
            viewer.scene.add(shadowMesh);
        } else {
            console.warn("[SkinViewer] viewer.scene is missing during initialization.");
        }

        // --- AMBIENT ROTATION ---
        viewer.autoRotate = true;
        viewer.autoRotateSpeed = 0.5; // Very slow cinematic turn

        if (viewer.controls) {
            viewer.controls.enableZoom = true;
            viewer.controls.enableRotate = true;
            viewer.controls.enablePan = false;

            // Limit Zoom
            viewer.controls.minDistance = 60;
            viewer.controls.maxDistance = 85;
        }

        // Set Initial Camera
        viewer.camera.position.z = zoom;
        viewer.camera.position.y = 10;
        viewer.camera.lookAt(0, 0, 0);

        applyAnimation(viewer, animation);
        viewerRef.current = viewer;

        // Resize Observer
        const canvas = canvasRef.current;
        const parent = canvas.parentElement;

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                const dpr = Math.max(window.devicePixelRatio || 1, 2);

                if (viewerRef.current) {
                    viewerRef.current.setSize(width * dpr, height * dpr);
                }

                canvas.style.width = `${width}px`;
                canvas.style.height = `${height}px`;
            }
        });

        if (parent) {
            resizeObserver.observe(parent);
        }

        return () => {
            resizeObserver.disconnect();
            if (viewerRef.current) {
                viewerRef.current.dispose();
                viewerRef.current = null;
            }
        };
    }, []);

    // Handle Prop Updates
    useEffect(() => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        const handleUpdate = async () => {
            // 1. Load Skin
            if (skinUrl !== viewer.skinUrl || model !== viewer.playerObject?.skin?.model) {
                console.log(`[SkinViewer] Loading skin: ${model}`);
                await viewer.loadSkin(skinUrl, { model: model });
            }

            // 2. Load Cape
            const cosmeticCape = cosmetics.find(c => c.type === 'cape');
            const finalCapeUrl = cosmeticCape ? cosmeticCape.texture : capeUrl;
            if (finalCapeUrl !== viewer.capeUrl) {
                console.log("[SkinViewer] Loading cape...");
                viewer.loadCape(finalCapeUrl);
            }

            // 3. Animation
            applyAnimation(viewer, animation);

            // 4. Cosmetics
            updateCosmetics(viewer, cosmetics);

            // 5. NameTag
            // We store the current nameTag string in a custom property on the viewer to avoid regenerating if unchanged
            if (nameTag !== viewer._currentNameTagStr) {
                viewer._currentNameTagStr = nameTag; // Track it
                viewer.nameTag = nameTag ? createNameTag(nameTag) : null;
            }
        };

        handleUpdate().catch(err => console.error("[SkinViewer] Update failed:", err));

    }, [skinUrl, capeUrl, model, animation, cosmetics, nameTag]);

    const updateCosmetics = (viewer, activeCosmetics) => {
        // Cleanup existing cosmetic meshes
        cosmeticsRef.current.forEach(mesh => {
            if (mesh.parent) mesh.parent.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        cosmeticsRef.current = [];

        if (!viewer.playerObject || !viewer.playerObject.skin) {
            return;
        }

        activeCosmetics.forEach(item => {
            if (item.type === 'cape') return;

            if (item.type === 'model') {
                let anchorGroup;
                if (item.anchor === 'head') anchorGroup = viewer.playerObject.skin.head;
                else if (item.anchor === 'body') anchorGroup = viewer.playerObject.skin.body;
                else if (item.anchor === 'leftArm') anchorGroup = viewer.playerObject.skin.leftArm;
                else if (item.anchor === 'rightArm') anchorGroup = viewer.playerObject.skin.rightArm;

                if (!anchorGroup) return;

                const geometry = new THREE.BoxGeometry(1, 1, 1);
                const material = new THREE.MeshBasicMaterial({
                    color: item.color || 0xFF0000,
                });
                const mesh = new THREE.Mesh(geometry, material);

                if (item.transform) {
                    const { pos, rot } = item.transform;
                    // Placeholder scaling for visibility
                    mesh.scale.set(4, 4, 4);
                    if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
                    if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
                }

                anchorGroup.add(mesh);
                cosmeticsRef.current.push(mesh);
            }
        });
    };

    const applyAnimation = (viewer, animName) => {
        if (viewer.animation && viewer._currentAnimName === animName) return;

        const AnimClass = getAnimClass(animName);
        if (!AnimClass) {
            viewer.animation = null;
            viewer._currentAnimName = null;
            return;
        }

        const animInstance = new AnimClass();
        const baseAnimate = animInstance.animate.bind(animInstance);

        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        const lerp = (a, b, t) => a + (b - a) * t;

        // Look limits (radians)
        const LIMIT_YAW = -0.2;
        const LIMIT_PITCH = 0.3;

        // Tune for "idle" feel
        const TARGET_CHANGE_MIN = 0.35; // seconds
        const TARGET_CHANGE_MAX = 1.1;  // seconds
        const SMOOTHING = 0.12;         // higher = more responsive
        const JITTER_YAW = 0.06;        // subtle micro movement
        const JITTER_PITCH = 0.04;

        const look = {
            // offsets (what we want to add)
            currYaw: 0,
            currPitch: 0,
            targetYaw: 0,
            targetPitch: 0,
            nextTargetTime: 0,

            // what we actually added last frame (so we can remove it before baseAnimate)
            appliedYaw: 0,
            appliedPitch: 0,
            hasApplied: false,

            // phases for gentle jitter
            phaseYaw: Math.random() * Math.PI * 2,
            phasePitch: Math.random() * Math.PI * 2,
        };

        animInstance.animate = (player, time) => {
            // Normalize time to seconds (robust across skinview3d versions)
            const t = time > 1e5 ? time / 1000 : time;

            // Always refetch head from player (don't cache it)
            let head = player?.skin?.head;

            // 1) Undo last frame’s offset BEFORE running base animation
            if (head && look.hasApplied) {
                head.rotation.y -= look.appliedYaw;
                head.rotation.x -= look.appliedPitch;
                look.hasApplied = false;
                look.appliedYaw = 0;
                look.appliedPitch = 0;
            }

            // 2) Run base animation on clean rotations
            baseAnimate(player, time);

            // 3) Re-fetch head AFTER base animation (important)
            head = player?.skin?.head;
            if (!head) return;

            // 4) Pick new random target frequently (so it never "locks")
            if (t >= look.nextTargetTime) {
                look.targetYaw = (Math.random() * 2 - 1) * LIMIT_YAW;
                look.targetPitch = (Math.random() * 2 - 1) * LIMIT_PITCH;

                const dt = TARGET_CHANGE_MIN + Math.random() * (TARGET_CHANGE_MAX - TARGET_CHANGE_MIN);
                look.nextTargetTime = t + dt;
            }

            // 5) Smoothly approach target
            look.currYaw = lerp(look.currYaw, look.targetYaw, SMOOTHING);
            look.currPitch = lerp(look.currPitch, look.targetPitch, SMOOTHING);

            // 6) Add tiny continuous jitter so idle always feels alive
            look.phaseYaw += 0.9 * (1 / 60);   // ~0.9 rad/sec at 60fps
            look.phasePitch += 0.75 * (1 / 60);

            const jitterYaw = Math.sin(look.phaseYaw + t * 0.8) * JITTER_YAW;
            const jitterPitch = Math.sin(look.phasePitch + t * 0.7) * JITTER_PITCH;

            const finalYaw = clamp(look.currYaw + jitterYaw, -LIMIT_YAW, LIMIT_YAW);
            const finalPitch = clamp(look.currPitch + jitterPitch, -LIMIT_PITCH, LIMIT_PITCH);

            // 7) Apply offsets on top of base animation
            head.rotation.y += finalYaw;
            head.rotation.x += finalPitch;

            // 8) Remember what we applied to undo next frame
            look.appliedYaw = finalYaw;
            look.appliedPitch = finalPitch;
            look.hasApplied = true;
        };

        viewer.animation = animInstance;
        viewer.animation.paused = false;
        viewer._currentAnimName = animName;
    };


    const getAnimClass = (name) => {
        switch (name) {
            case 'idle': return IdleAnimation;
            case 'walk': return WalkingAnimation;
            case 'run': return RunningAnimation;
            case 'fly': return FlyingAnimation;
            default: return IdleAnimation;
        }
    }




    return (
        <canvas
            ref={canvasRef}
            className="cursor-move w-full h-full block"
        />
    );
};

export default SkinViewer;
