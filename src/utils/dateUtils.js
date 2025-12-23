export const formatLastPlayed = (timestamp) => {
    if (!timestamp || isNaN(new Date(timestamp).getTime())) return 'Never';

    const now = Date.now();
    const diff = now - timestamp;

    // Less than 1 minute
    if (diff < 60 * 1000) {
        return 'Just now';
    }

    // Less than 1 hour
    if (diff < 60 * 60 * 1000) {
        const mins = Math.floor(diff / (60 * 1000));
        return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    }

    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }

    // Less than 7 days
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return `${days} day${days !== 1 ? 's' : ''} ago`;
    }

    // Otherwise returning date string
    return new Date(timestamp).toLocaleDateString();
};
