import React from 'react';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import BackgroundBlobs from '../components/common/BackgroundBlobs';

function WelcomeView({ onConnect, disableAnimations }) {
    const { t } = useTranslation();

    return (
        <div className="flex-1 flex flex-col items-center justify-center relative select-none overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />
            <div className="absolute inset-0 bg-[url('/cubes.png')] opacity-5" />
            <BackgroundBlobs disabled={disableAnimations} />

            {/* Content Card */}
            <div className="relative z-10 w-full max-w-sm mx-auto p-8 rounded-3xl bg-slate-900/50 backdrop-blur-xl border border-white/5 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/20 mb-6 rotate-6 transform hover:rotate-0 transition-all duration-500 group cursor-pointer">
                    <User size={40} className="text-white drop-shadow-md" />
                </div>

                <h2 className="text-3xl font-bold text-white mb-3">{t('home_welcome_back')}</h2>
                <p className="text-slate-400 mb-8 leading-relaxed text-sm">
                    {t('home_connect_identity')}
                </p>

                <button
                    onClick={onConnect}
                    className="w-full bg-emerald-600 text-white font-bold py-4 rounded-2xl hover:bg-emerald-500 transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-3 group border border-emerald-500/50"
                >
                    <div className="bg-emerald-700/50 p-1.5 rounded-lg group-hover:bg-emerald-600/50 transition-colors">
                        <User size={18} className="text-emerald-100" />
                    </div>
                    <span>{t('home_btn_connect')}</span>
                </button>
            </div>
        </div>
    );
}

export default WelcomeView;
