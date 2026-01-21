import React from 'react';
import BackgroundBlobs from './BackgroundBlobs';

const GlobalBackground = ({
    selectedInstance,
    theme,
    disableAnimations,
    activeTab
}) => {
    const isModded = selectedInstance && selectedInstance.loader !== 'Vanilla';

    // We only show the dynamic gradient and blobs when on certain tabs or if we want a global look
    const showDynamicElements = activeTab === 'home';

    return (
        <div className={`fixed inset-0 overflow-hidden pointer-events-none z-0 transition-opacity duration-700 ${activeTab === 'home' ? 'opacity-100' : 'opacity-0'}`}>
            {/* Base Image Layer */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 animate-ken-burns"
                style={{ backgroundImage: "url('/images/hero-bg.png')" }}
            />

            {/* Vignette / Corner Blacking */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_50%,_rgba(0,0,0,0.85)_120%)]" />

            {/* Dynamic Instance Gradient - Only on Home */}
            {showDynamicElements && selectedInstance && !['midnight', 'white'].includes(theme) && (
                <div
                    className={`absolute inset-0 bg-gradient-to-br ${selectedInstance.bgGradient} transition-colors duration-1000 opacity-30 mix-blend-overlay`}
                />
            )}

            {/* Texture Overlay */}
            <div className="absolute inset-0 bg-[url('/cubes.png')] opacity-15 mix-blend-soft-light" />

            {/* Global Bottom Shadow/Gradient for readability */}
            <div className={`absolute inset-0 bg-gradient-to-t ${theme === 'midnight' ? 'from-[#050505] via-transparent' : 'from-slate-900 via-transparent'} to-transparent opacity-80`} />

            {/* Animated Blobs - Stay mostly behind content */}
            <BackgroundBlobs disabled={disableAnimations || (isModded && activeTab === 'home') || ['midnight', 'white'].includes(theme)} />
        </div>
    );
};

export default GlobalBackground;
