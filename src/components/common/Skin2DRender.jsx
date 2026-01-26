import React, { useEffect, useRef } from 'react';

const Skin2DRender = ({ skinUrl, model = 'classic', scale = 10, className = "" }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const STEVE_URL = "https://mc-heads.net/skin/steve";
        const ALEX_URL = "https://mc-heads.net/skin/alex";
        const fallback = model === 'slim' ? ALEX_URL : STEVE_URL;

        // Ensure we don't try to load the literally string "null" or "undefined"
        const isUrlValid = (url) => url && url !== 'null' && url !== 'undefined';
        const initialUrl = isUrlValid(skinUrl) ? skinUrl : fallback;

        const img = new Image();
        img.crossOrigin = "Anonymous";

        img.onerror = () => {
            if (img.src !== fallback) {
                console.warn(`[Skin2DRender] Failed to load skin: ${img.src}. Falling back to default.`);
                img.src = fallback;
            } else {
                console.error(`[Skin2DRender] Even fallback skin failed to load: ${fallback}`);
            }
        };

        img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

            // Clear
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.imageSmoothingEnabled = false;

            const isSlim = model === 'slim';
            const armWidth = isSlim ? 3 : 4;

            // Source coordinates (Standard 64x64)
            const hasLeftLayers = img.height === 64;

            const drawPart = (sx, sy, sw, sh, dx, dy) => {
                ctx.drawImage(img, sx, sy, sw, sh, dx * scale, dy * scale, sw * scale, sh * scale);
            };

            // HEAD (8x8)
            drawPart(8, 8, 8, 8, 4, 0); // Base
            drawPart(40, 8, 8, 8, 4, 0); // Overlay

            // BODY (8x12)
            drawPart(20, 20, 8, 12, 4, 8); // Base
            if (img.height === 64) drawPart(20, 36, 8, 12, 4, 8); // Overlay

            // RIGHT ARM (Viewer's Left)
            drawPart(44, 20, armWidth, 12, 4 - armWidth, 8); // Base
            if (img.height === 64) drawPart(44, 36, armWidth, 12, 4 - armWidth, 8); // Overlay

            // LEFT ARM (Viewer's Right)
            if (hasLeftLayers) {
                drawPart(36, 52, armWidth, 12, 12, 8);
                drawPart(52, 52, armWidth, 12, 12, 8);
            } else {
                drawPart(44, 20, armWidth, 12, 12, 8);
            }

            // RIGHT LEG (Viewer's Left)
            drawPart(4, 20, 4, 12, 4, 20);
            if (img.height === 64) drawPart(4, 36, 4, 12, 4, 20);

            // LEFT LEG (Viewer's Right)
            if (hasLeftLayers) {
                drawPart(20, 52, 4, 12, 8, 20);
                drawPart(4, 52, 4, 12, 8, 20);
            } else {
                drawPart(4, 20, 4, 12, 8, 20);
            }
        };

        img.src = initialUrl;

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
