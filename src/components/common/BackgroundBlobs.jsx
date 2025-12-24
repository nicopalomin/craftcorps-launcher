import React, { useEffect, useState } from 'react';

const BackgroundBlobs = ({ disabled }) => {
    const [blobs, setBlobs] = useState([]);

    useEffect(() => {
        if (disabled) {
            setBlobs([]);
            return;
        }

        const interval = setInterval(() => {
            const id = Date.now();
            const size = Math.random() * 150 + 100; // 100-250px
            const left = Math.random() * 100; // 0-100%
            const top = Math.random() * 100; // 0-100%
            const duration = Math.random() * 10 + 10; // 10-20s
            const delay = Math.random() * 5; // 0-5s
            const color = Math.random() > 0.5 ? 'bg-emerald-500' : 'bg-cyan-500';

            const newBlob = { id, size, left, top, duration, delay, color };

            setBlobs(prev => [...prev, newBlob]);

            // Remove blob after duration + delay
            setTimeout(() => {
                setBlobs(prev => prev.filter(b => b.id !== id));
            }, (duration + delay) * 1000 + 100);

        }, 1000); // New blob every 1 second

        return () => clearInterval(interval);
    }, [disabled]);

    if (disabled) return null;

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
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
