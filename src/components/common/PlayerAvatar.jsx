import React, { useState } from 'react';

const PlayerAvatar = ({ name, uuid, size = 64 }) => {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    const identifier = uuid || name;
    const src = identifier ? `https://minotar.net/helm/${identifier}/${size}.png` : null;

    return (
        <>
            {/* Fallback Text - Visible until loaded */}
            <span className={`font-bold text-sm text-white transition-opacity duration-300 ${loaded ? 'opacity-0' : 'opacity-100'}`}>
                {name?.[0]?.toUpperCase()}
            </span>

            {/* Image - Fade in */}
            {src && !error && (
                <img
                    src={src}
                    alt={name}
                    className={`absolute inset-0 w-full h-full object-cover rounded-full transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setLoaded(true)}
                    onError={() => setError(true)}
                    loading="lazy"
                    draggable="false"
                />
            )}
        </>
    );
};

export default PlayerAvatar;
