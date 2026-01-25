import React from 'react';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function WelcomeView({ onConnect, disableAnimations }) {
    const { t } = useTranslation();

    return (
        <div className="flex-1 flex flex-col items-center justify-center relative select-none overflow-hidden">
            {/* Content Card - Using the new Widget System */}
            <div className="relative z-10 w-[clamp(320px,90vw,440px)] p-10 rounded-[3rem] glass-spotlight shadow-3xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-700">
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 backdrop-blur-md rounded-[2rem] flex items-center justify-center shadow-2xl border border-emerald-500/20 mb-8 transform hover:scale-105 transition-all duration-500">
                    <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/40">
                        <User size={32} className="text-white drop-shadow-md" />
                    </div>
                </div>

                <h2 className="text-[clamp(1.75rem,5vw,2.25rem)] font-bold text-white mb-3 tracking-tight">
                    {t('home_welcome_back')}
                </h2>

                <p className="text-slate-300 mb-8 leading-relaxed text-sm max-w-[280px]">
                    {t('home_connect_identity')}
                </p>

                <button
                    onClick={onConnect}
                    className="btn-premium-emerald w-full py-5 px-8 rounded-2xl text-white font-extrabold uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3"
                >
                    <User size={20} strokeWidth={3} />
                    <span>{t('home_btn_connect')}</span>
                </button>
            </div>
        </div>
    );
}

export default WelcomeView;
