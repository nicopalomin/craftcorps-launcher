
// Helper to generate a consistent gradient based on string
export const getGradient = (str) => {
    const hash = str
        .split("")
        .reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const colors = [
        "from-amber-400 to-orange-600",
        "from-emerald-400 to-teal-600",
        "from-purple-400 to-indigo-600",
        "from-blue-400 to-cyan-600",
        "from-red-400 to-pink-600",
        "from-indigo-400 to-violet-600",
    ];
    return colors[Math.abs(hash) % colors.length];
};

export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export const toInt = (v) => {
    const n = parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
};
