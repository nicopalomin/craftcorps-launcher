export const formatLastPlayed = (timestamp, t) => {
    if (!timestamp || isNaN(new Date(timestamp).getTime())) return t ? t('time_never') : 'Never';

    const now = Date.now();
    const diff = now - timestamp;

    // Less than 1 minute
    if (diff < 60 * 1000) {
        return t ? t('time_just_now') : 'Just now';
    }

    // Less than 1 hour
    if (diff < 60 * 60 * 1000) {
        const mins = Math.floor(diff / (60 * 1000));
        return t ? t('time_minutes_ago', { count: mins }) : `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    }

    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000));
        return t ? t('time_hours_ago', { count: hours }) : `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }

    // Less than 7 days
    if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000));
        return t ? t('time_days_ago', { count: days }) : `${days} day${days !== 1 ? 's' : ''} ago`;
    }

    // Otherwise returning date string
    return new Date(timestamp).toLocaleDateString();
};
