import React, { useEffect, useState } from 'react';

const BackgroundBlobs = ({ disabled }) => {
    const [blobs, setBlobs] = useState([]);

    useEffect(() => {
        // Spawn initial blobs immediately
        const initialBlobs = Array.from({ length: 3 }).map(() => ({
            id: Date.now() + Math.random(),
            size: Math.random() * 150 + 100,
            left: Math.random() * 100,
            top: Math.random() * 100,
            duration: Math.random() * 10 + 10,
            delay: Math.random() * 2,
            color: Math.random() > 0.5 ? 'bg-emerald-500' : 'bg-cyan-500'
        }));
        setBlobs(initialBlobs);

        const interval = setInterval(() => {
            setBlobs(prev => {
                // Limit max blobs to prevent overcrowding
                if (prev.length >= 8) return prev;

                const id = Date.now();
                const size = Math.random() * 150 + 100;
                const duration = Math.random() * 10 + 10;
                const delay = Math.random() * 2;
                const color = Math.random() > 0.5 ? 'bg-emerald-500' : 'bg-cyan-500';

                // Try to find a position not too close to others
                let left, top, valid;
                let attempts = 0;

                do {
                    left = Math.random() * 90; // Keep somewhat within bounds
                    top = Math.random() * 90;
                    valid = true;
                    // Simple distance check against existing blobs
                    for (const b of prev) {
                        const db = Math.sqrt(Math.pow(b.left - left, 2) + Math.pow(b.top - top, 2));
                        if (db < 25) { // If closer than roughly 25% screen width/height
                            valid = false;
                            break;
                        }
                    }
                    attempts++;
                } while (!valid && attempts < 5);

                // If we couldn't find a spot, skip this spawn cycle
                if (!valid && prev.length > 3) return prev;

                const newBlob = { id, size, left, top, duration, delay, color };

                // Schedule cleanup
                setTimeout(() => {
                    setBlobs(current => current.filter(b => b.id !== id));
                }, (duration + delay) * 1000 + 100);

                return [...prev, newBlob];
            });

        }, 4000); // New blob every 4 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className={`absolute inset-0 overflow-hidden pointer-events-none z-0 transition-opacity ${disabled ? 'duration-75' : 'duration-[2000ms]'} ${disabled ? 'opacity-0' : 'opacity-100'}`}>
            {blobs.map(blob => (
                <div
                    key={blob.id}
                    className={`absolute rounded-full blur-3xl opacity-0 ${blob.color} animate-float-fade`}
                    style={{
                        width: `${blob.size}px`,
                        height: `${blob.size}px`,
                        left: `${blob.left}%`,
                        top: `${blob.top}%`,
                        animationDuration: `${blob.duration}s`,
                        animationDelay: `${blob.delay}s`,
                    }}
                />
            ))}
            <style jsx>{`
                @keyframes float-fade {
                    0% {
                        opacity: 0;
                        transform: translate(0, 0) scale(0.5);
                    }
                    25% {
                        opacity: 0.6;
                        transform: translate(10px, -20px) scale(1.1);
                    }
                    60% {
                        opacity: 0.3;
                        transform: translate(-5px, 10px) scale(0.9);
                    }
                    100% {
                        opacity: 0;
                        transform: translate(0, 0) scale(0.5);
                    }
                }
                .animate-float-fade {
                    animation-name: float-fade;
                    animation-timing-function: ease-in-out;
                    animation-fill-mode: forwards;
                }
            `}</style>
        </div>
    );
};

export default BackgroundBlobs;
