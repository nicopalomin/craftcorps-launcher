import React, { useState, useEffect } from 'react';
import { Gift, HelpCircle, Clock, Users, Share2, Clipboard, AlertTriangle } from 'lucide-react';

const ProgressBar = ({ current, milestones, theme, label, icon: Icon, action }) => {
    // Custom visual positions (percentages) for the milestones
    // User requested 1st and 2nd cuts closer to the left.
    const visualPositions = [25, 61, 100];

    // Calculate progress percentage based on variable segments
    const getProgress = () => {
        const allPoints = [0, ...milestones];
        const allVisuals = [0, ...visualPositions];

        // Find which segment we are in
        for (let i = 0; i < milestones.length; i++) {
            const start = allPoints[i];
            const end = allPoints[i + 1];

            if (current >= end) {
                // Fully completed this segment, check next
                if (i === milestones.length - 1) return 100;
                continue;
            } else if (current >= start) {
                // We are in this segment
                const segmentProgress = (current - start) / (end - start);
                const visualStart = allVisuals[i];
                const visualEnd = allVisuals[i + 1];
                return visualStart + (segmentProgress * (visualEnd - visualStart));
            }
        }

        // Fallback for > max (should be caught by loop above usually)
        return 100;
    };

    const progressPercent = getProgress();

    return (
        <div className={`w-full max-w-3xl mb-12 p-8 rounded-2xl border backdrop-blur-sm shadow-xl transition-all duration-300 hover:shadow-2xl ${theme === 'white' ? 'bg-white/80 border-slate-200' : 'bg-slate-900/60 border-white/5'}`}>
            <div className="flex items-center gap-4 mb-8">
                <div className={`p-3 rounded-xl ${theme === 'white' ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-400'}`}>
                    <Icon size={24} />
                </div>
                <h3 className={`text-2xl font-bold ${theme === 'white' ? 'text-slate-800' : 'text-slate-200'}`}>{label}</h3>
            </div>

            <div className="relative h-6 w-full bg-slate-700/30 rounded-full mb-16 mt-4 shadow-inner">
                {/* Progress Fill */}
                <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                    style={{ width: `${progressPercent}%` }}
                />

                {/* Milestones */}
                {milestones.map((milestone, index) => {
                    // Use the custom visual positions
                    const position = visualPositions[index];
                    const isUnlocked = progressPercent >= (position - 0.1); // Small tolerance

                    return (
                        <div
                            key={milestone}
                            className="absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-help"
                            style={{ left: `${position}%` }}
                        >
                            {/* Cut/Bubble */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 z-10 transition-all duration-500 ${isUnlocked
                                ? 'bg-indigo-500 border-indigo-200 text-white shadow-[0_0_20px_rgba(99,102,241,0.6)] scale-110'
                                : (theme === 'white' ? 'bg-slate-100 border-slate-300 text-slate-400' : 'bg-slate-800 border-slate-600 text-slate-500')
                                }`}>
                                {isUnlocked ? <Gift size={18} className="animate-bounce-slow" /> : <HelpCircle size={18} />}
                            </div>

                            {/* Label */}
                            <div className={`absolute top-14 whitespace-nowrap text-sm font-bold tracking-wide transition-colors ${theme === 'white' ? (isUnlocked ? 'text-indigo-600' : 'text-slate-400') : (isUnlocked ? 'text-indigo-400' : 'text-slate-500')
                                }`}>
                                {milestone} {index === milestones.length - 1 && typeof milestone === 'number' && label.toLowerCase().includes('play') ? 'Hours' : ''}
                                {index !== milestones.length - 1 && typeof milestone === 'number' && label.toLowerCase().includes('play') ? 'h' : ''}
                            </div>

                            {/* Tooltip for Reward (Mock) */}
                            <div className={`absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap px-3 py-2 rounded-lg text-xs font-medium pointer-events-none transform translate-y-2 group-hover:translate-y-0 duration-200 ${theme === 'white' ? 'bg-slate-800 text-white shadow-xl' : 'bg-white text-slate-900 shadow-xl'}`}>
                                {isUnlocked ? "Eligible for Reward" : "Reach this milestone to be eligible for a reward!"}
                                <div className={`absolute left-1/2 -translate-x-1/2 top-100 w-2 h-2 rotate-45 ${theme === 'white' ? 'bg-slate-800' : 'bg-white'} `}></div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer Action/Info */}
            <div className="flex flex-col items-center justify-center gap-4 mt-8">
                <p className={`text-base text-center font-medium ${theme === 'white' ? 'text-slate-500' : 'text-slate-400'}`}>
                    {label.includes('Play') ? (
                        "Play time is automatically recorded while you play using CraftCorps."
                    ) : (
                        "Invite friends to join the beta and be eligible for exclusive cosmetic rewards!"
                    )}
                </p>
                {action && (
                    <div className="mt-2 w-full flex justify-center">
                        {action}
                    </div>
                )}
            </div>
        </div>
    );
};

const BetaRewardsView = ({ theme, selectedInstance }) => {
    const [playTime, setPlayTime] = useState(0.5); // Default start
    const [friendsInvited, setFriendsInvited] = useState(0);

    // Fetch playtime from currently selected instance as a proxy for "launcher playtime"
    // Ideally this would be a global user stat, but we use what we have for now.
    useEffect(() => {
        let active = true;
        if (selectedInstance?.path && window.electronAPI) {
            window.electronAPI.getInstancePlayTime(selectedInstance.path).then((ms) => {
                if (active && ms) {
                    const hours = ms / (1000 * 60 * 60);
                    setPlayTime(hours);
                }
            });
        }
        return () => { active = false; };
    }, [selectedInstance]);

    return (
        <div className={`w-full h-full overflow-y-auto custom-scrollbar relative animate-in fade-in duration-500 select-none ${theme === 'white' ? 'bg-slate-50' : 'bg-transparent'}`}>

            {/* Background Ambience */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden fixed">
                <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-20 ${theme === 'white' ? 'bg-indigo-300' : 'bg-indigo-600/30'}`} />
                <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] opacity-20 ${theme === 'white' ? 'bg-purple-300' : 'bg-purple-600/30'}`} />
            </div>

            <div className="min-h-full w-full flex flex-col items-center justify-center py-12">
                <div className="w-full max-w-4xl px-6 z-10 flex flex-col items-center">
                    <div className={`w-full max-w-2xl mb-4 p-4 rounded-xl border flex items-center gap-4 ${theme === 'white' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-amber-900/20 border-amber-500/20 text-amber-200'}`}>
                        <AlertTriangle className="shrink-0" size={24} />
                        <p className="text-sm font-medium">
                            Beta Rewards are currently in development and your progress might not count towards it at this time. We do not promise any rewards at this time.
                        </p>
                    </div>

                    <div className={`w-full max-w-2xl mb-12 p-4 rounded-xl border flex items-center gap-4 ${theme === 'white' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-amber-900/20 border-amber-500/20 text-amber-200'}`}>
                        <AlertTriangle className="shrink-0" size={24} />
                        <p className="text-sm font-medium">
                            Progress shown here represents participation only. Cosmetic rewards, if offered, are discretionary, subject to change, and not guaranteed.
                        </p>
                    </div>

                    <div className="text-center mb-16">
                        <div className="inline-flex items-center justify-center p-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30 mb-6">
                            <Gift size={48} className="text-white" />
                        </div>
                        <h1 className={`text-5xl font-black tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r ${theme === 'white' ? 'from-slate-900 to-slate-700' : 'from-white to-slate-400'}`}>Beta Rewards</h1>
                        <p className={`text-xl max-w-2xl mx-auto ${theme === 'white' ? 'text-slate-600' : 'text-slate-400'}`}>
                            Thank you for being an early supporter! Play and invite friends to be eligible for exclusive cosmetic rewards.
                        </p>
                    </div>

                    {/* Play Time Progress */}
                    <ProgressBar
                        current={playTime}
                        milestones={[1, 10, 50]}
                        theme={theme}
                        label="Play Time"
                        icon={Clock}
                    />

                    {/* Friends Progress */}
                    <ProgressBar
                        current={friendsInvited}
                        milestones={[1, 5, 10]}
                        theme={theme}
                        label="Friends Invited"
                        icon={Users}
                        action={
                            <button
                                disabled
                                className={`group relative flex items-center gap-3 px-8 py-3 rounded-xl font-bold text-lg transition-all opacity-70 cursor-not-allowed ${theme === 'white'
                                    ? 'bg-slate-200 text-slate-400'
                                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                                    }`}
                            >
                                <Share2 size={20} />
                                <span>Invite Friends (Coming Soon)</span>
                            </button>
                        }
                    />

                    <div className="w-full max-w-4xl mt-16 px-2">
                        <h3 className={`text-2xl font-bold mb-6 ${theme === 'white' ? 'text-slate-800' : 'text-slate-200'}`}>Eligible Rewards</h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Mock Cards */}
                            {[1, 2, 3].map((i) => (
                                <div key={i} className={`relative overflow-hidden rounded-2xl border p-6 flex flex-col items-center justify-between text-center min-h-[240px] transition-all duration-300 hover:scale-[1.02] ${theme === 'white'
                                    ? 'bg-white/60 border-slate-200 hover:shadow-xl hover:bg-white/80'
                                    : 'bg-slate-900/40 border-white/5 hover:shadow-2xl hover:bg-slate-900/60'
                                    }`}>
                                    {/* Card Content Placeholder */}
                                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${theme === 'white' ? 'bg-slate-100 text-slate-300' : 'bg-white/5 text-slate-600'
                                        }`}>
                                        <Gift size={32} />
                                    </div>

                                    <div className="mb-4">
                                        <div className={`h-4 w-24 rounded-full mb-2 mx-auto ${theme === 'white' ? 'bg-slate-200' : 'bg-slate-800'}`} />
                                        <div className={`h-3 w-16 rounded-full mx-auto opacity-50 ${theme === 'white' ? 'bg-slate-200' : 'bg-slate-800'}`} />
                                    </div>

                                    <p className={`text-xs font-medium px-4 py-2 rounded-lg ${theme === 'white' ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/10 text-amber-400'
                                        }`}>
                                        Cosmetic Rewards will be available in the future
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BetaRewardsView;
