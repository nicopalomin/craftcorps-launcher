import React from 'react';

const InstanceIcon = ({ instance, size = 48, className = '' }) => {
    // Helper to get initials
    const getInitials = (name) => {
        if (!name) return '??';
        // Remove special chars but keep spaces to identify words
        const cleaned = name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
        const parts = cleaned.split(/\s+/).filter(p => p.length > 0);

        if (parts.length === 0) return '??';

        if (parts.length >= 2) {
            // First letter of first two words
            return (parts[0][0] + parts[1][0]).toUpperCase();
        } else {
            // First two letters of the single word
            return parts[0].substring(0, 2).toUpperCase();
        }
    };

    // 5 Premium Color Gradients
    const GRADIENTS = [
        'linear-gradient(135deg, #475569 0%, #0f172a 100%)', // Slate (Default)
        'linear-gradient(135deg, #059669 0%, #064e3b 100%)', // Emerald
        'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)', // Violet
        'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)', // Red
        'linear-gradient(135deg, #d97706 0%, #78350f 100%)', // Amber
    ];

    const getGradient = (name) => {
        if (!name) return GRADIENTS[0];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % GRADIENTS.length;
        return GRADIENTS[index];
    };

    if (instance.icon) {
        return (
            <img
                src={instance.icon}
                alt={instance.name}
                className={`w-full h-full object-cover ${className}`}
            />
        );
    }

    // Dynamic Icon
    return (
        <div
            className={`w-full h-full flex items-center justify-center relative overflow-hidden rounded-[28%] ${className}`}
            style={{
                background: getGradient(instance.name),
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.15), inset 0 -1px 1px rgba(0,0,0,0.2)',
                opacity: 0.85
            }}
        >
            {/* Radial Highlight Overlay */}
            <div
                className="absolute inset-0 pointer-events-none opacity-40"
                style={{
                    background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.2) 0%, transparent 75%)'
                }}
            />

            {/* Noise Overlay */}
            <div
                className="absolute inset-0 opacity-[0.12] mix-blend-overlay pointer-events-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                }}
            />

            {/* Text */}
            <span
                className="relative z-10 font-['Minecraft'] leading-none select-none flex items-center justify-center mt-[-0.12em]"
                style={{
                    fontSize: `${size * 0.42}px`,
                    color: '#F2F6FF',
                    textShadow: '0 2px 4px rgba(0,0,0,0.3), 0 0 8px rgba(255,255,255,0.2)'
                }}
            >
                {getInitials(instance.name)}
            </span>

            {/* Subtle Inner Border/Bevel */}
            <div className="absolute inset-0 border border-white/5 rounded-[inherit] pointer-events-none shadow-[inset_0_0_10px_rgba(0,0,0,0.1)]" />
        </div>
    );
};

export default InstanceIcon;
