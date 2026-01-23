import React, { useRef, useEffect } from 'react';

/**
 * Renders a Minecraft cape texture in 2D with perspective
 * Cape textures are 64x32 or 46x22 pixels
 */
const Cape2DRender = ({ capeUrl, scale = 6, className = '' }) => {
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

            // Define the cape back portion dimensions
            const backWidth = capeWidth >= 64 ? 10 : 10;  // Back portion width
            const backHeight = capeHeight >= 32 ? 16 : 16; // Back portion height

            // Cape texture layout: back portion starts at x=1, y=1
            const sourceX = 1;
            const sourceY = 1;

            // STEP 1: Extract the back portion to a temporary canvas
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = backWidth;
            tempCanvas.height = backHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.imageSmoothingEnabled = false;

            // Draw just the back portion at 1:1 scale
            tempCtx.drawImage(
                img,
                sourceX, sourceY, backWidth, backHeight,  // Source rectangle (back of cape)
                0, 0, backWidth, backHeight               // Destination (1:1)
            );

            // STEP 2: Upscale the pixel data using nearest-neighbor
            // Create a higher resolution version
            const upscaleFactor = scale;
            const upscaledWidth = backWidth * upscaleFactor;
            const upscaledHeight = backHeight * upscaleFactor;

            const upscaleCanvas = document.createElement('canvas');
            upscaleCanvas.width = upscaledWidth;
            upscaleCanvas.height = upscaledHeight;
            const upscaleCtx = upscaleCanvas.getContext('2d');
            upscaleCtx.imageSmoothingEnabled = false;

            // Draw the temp canvas to upscaled canvas with nearest-neighbor
            upscaleCtx.drawImage(
                tempCanvas,
                0, 0, backWidth, backHeight,           // Source (original size)
                0, 0, upscaledWidth, upscaledHeight    // Destination (upscaled)
            );

            // STEP 3: Set final canvas size and render the upscaled texture
            canvas.width = upscaledWidth;
            canvas.height = upscaledHeight;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Disable image smoothing for final render
            ctx.imageSmoothingEnabled = false;

            // Draw the upscaled texture
            ctx.drawImage(upscaleCanvas, 0, 0);
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
