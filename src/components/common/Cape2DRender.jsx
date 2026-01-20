import React, { useRef, useEffect } from 'react';

/**
 * Renders a Minecraft cape texture in 2D with perspective
 * Cape textures are 64x32 or 46x22 pixels
 */
const Cape2DRender = ({ capeUrl, scale = 3, className = '' }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!capeUrl || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            // Cape dimensions - typically 64x32 or 46x22
            const capeWidth = img.width;
            const capeHeight = img.height;

            // Set canvas size based on cape back portion (20x16 for 64x32, or 10x16 for 46x22)
            const backWidth = capeWidth >= 64 ? 10 : 10;  // Back portion width
            const backHeight = capeHeight >= 32 ? 16 : 16; // Back portion height

            canvas.width = backWidth * scale;
            canvas.height = backHeight * scale;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Disable image smoothing for crisp pixels
            ctx.imageSmoothingEnabled = false;

            // Draw the back portion of the cape (the visible part when worn)
            // Cape texture layout: front on left (1-10), back in middle (11-20)
            const sourceX = capeWidth >= 64 ? 1 : 1;   // Start of back portion
            const sourceY = capeWidth >= 64 ? 1 : 1;   // Top of cape
            const sourceWidth = backWidth;
            const sourceHeight = backHeight;

            ctx.drawImage(
                img,
                sourceX, sourceY, sourceWidth, sourceHeight,  // Source rectangle (back of cape)
                0, 0, canvas.width, canvas.height              // Destination (fill canvas)
            );
        };

        img.onerror = () => {
            console.error('[Cape2DRender] Failed to load cape:', capeUrl);
        };

        img.src = capeUrl;

    }, [capeUrl, scale]);

    return (
        <canvas
            ref={canvasRef}
            className={`cape-render ${className}`}
            style={{
                imageRendering: 'pixelated'

            }}
        />
    );
};

export default Cape2DRender;
