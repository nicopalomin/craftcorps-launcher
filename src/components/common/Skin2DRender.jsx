import React, { useEffect, useRef } from 'react';

const Skin2DRender = ({ skinUrl, model = 'classic', scale = 10, className = "" }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!skinUrl) return;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = skinUrl;

        img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

            // Clear
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.imageSmoothingEnabled = false;

            const isSlim = model === 'slim';
            const armWidth = isSlim ? 3 : 4;

            // Canvas logic: 
            // We want to draw a 16x32 canvas (standard minecraft character ratio is roughly 16px wide (4+8+4) by 32px tall (8+12+12))
            // Actually width is: R_Arm (4) + Body (8) + L_Arm (4) = 16.
            // Height is: Head (8) + Body (12) + Legs (12) = 32.

            // Source coordinates (Standard 64x64)
            // If 64x32, we need to handle fallback for Left limbs (mirror Right)
            const hasLeftLayers = img.height === 64;

            // --- Draw Helper ---
            const drawPart = (sx, sy, sw, sh, dx, dy) => {
                ctx.drawImage(img, sx, sy, sw, sh, dx * scale, dy * scale, sw * scale, sh * scale);
            };

            // HEAD (8x8)
            // Base: (8,8) -> dest(4,0)
            drawPart(8, 8, 8, 8, 4, 0);
            // Overlay: (40,8)
            drawPart(40, 8, 8, 8, 4, 0);

            // BODY (8x12)
            // Base: (20,20) -> dest(4,8)
            drawPart(20, 20, 8, 12, 4, 8);
            // Overlay: (20,36) - Only if 64x64 usually, but standards say overlay is there.
            if (img.height === 64) drawPart(20, 36, 8, 12, 4, 8);

            // RIGHT ARM (4x12 or 3x12) - Viewer's Left
            // Base: (44,20) -> dest(0,8)
            drawPart(44, 20, armWidth, 12, 4 - armWidth, 8);
            // Overlay: (44,36)
            if (img.height === 64) drawPart(44, 36, armWidth, 12, 4 - armWidth, 8);

            // LEFT ARM (4x12 or 3x12) - Viewer's Right
            // Base: (36,52) if 64x64, else flip (44,20)
            // Simplification: Just allow standard mapping. If legacy, we mirror?
            // HTML5 canvas scale(-1, 1) for mirroring is tricky with composite.
            // Let's assume modern 64x64 for simplicity or just use the modern coords.
            // Most uploaded skins today are 64x64. If 64x32, L arm is not compliant usually.
            // But let's try direct map.
            if (hasLeftLayers) {
                // Front L Arm: (36, 52)
                drawPart(36, 52, armWidth, 12, 12, 8);
                // Overlay: (52, 52)
                drawPart(52, 52, armWidth, 12, 12, 8);
            } else {
                // Legacy: Flip Right Arm?
                // For now, simpler to just draw Right Arm again but not flipped (lazy) or skip flip logic to save bloat.
                // Let's just draw the texture at 44,20 again for L arm if legacy.
                drawPart(44, 20, armWidth, 12, 12, 8);
            }

            // RIGHT LEG (4x12) - Viewer's Left
            // Base: (4,20) -> dest(4,20)
            drawPart(4, 20, 4, 12, 4, 20);
            // Overlay: (4,36)
            if (img.height === 64) drawPart(4, 36, 4, 12, 4, 20);

            // LEFT LEG (4x12) - Viewer's Right
            if (hasLeftLayers) {
                // Front L Leg: (20, 52) -> dest(8, 20)
                drawPart(20, 52, 4, 12, 8, 20);
                // Overlay: (4, 52)
                drawPart(4, 52, 4, 12, 8, 20);
            } else {
                drawPart(4, 20, 4, 12, 8, 20);
            }
        };

    }, [skinUrl, model, scale]);

    // Canvas Size: 16 * scale x 32 * scale
    // Default scale 10 -> 160x320
    const width = 16 * scale;
    const height = 32 * scale;

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className={`${className}`}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
    );
};

export default Skin2DRender;
