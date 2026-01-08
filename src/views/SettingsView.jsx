import React from 'react';
import { Cpu, Globe, Monitor, Terminal, Palette } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SettingsView = ({ ram, setRam, javaPath, setJavaPath, hideOnLaunch, setHideOnLaunch, disableAnimations, setDisableAnimations, availableJavas, enableDiscordRPC, setEnableDiscordRPC, theme, setTheme }) => {
    const { t, i18n } = useTranslation();
    const languages = [
        { code: 'en', label: 'English' },
        { code: 'es', label: 'Español' },
        { code: 'pt-BR', label: 'Português (Brasil)' },
        { code: 'fr', label: 'Français' },
        { code: 'de', label: 'Deutsch' },
        { code: 'ru', label: 'Русский' },
        { code: 'tr', label: 'Türkçe' },
        { code: 'pl', label: 'Polski' },
        { code: 'zh', label: '中文' },
        { code: 'ja', label: '日本語' },
        { code: 'ko', label: '한국어' }
    ];

    const handleBrowseJava = async () => {
        if (window.electronAPI && window.electronAPI.selectFile) {
            const path = await window.electronAPI.selectFile();
            if (path) {
                setJavaPath(path);
            }
        } else {
            console.warn("Electron API not available");
        }
    };

    return (
        <div className="flex-1 overflow-y-auto p-8 animate-in fade-in slide-in-from-bottom-4 duration-300 select-none custom-scrollbar">
            <h2 className="text-3xl font-bold text-slate-200 mb-8">{t('settings_title')}</h2>

            <div className="space-y-6">
                {/* Language Settings */}
                <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                    <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
                        <Globe size={18} className="text-emerald-500" /> {t('settings_language')}
                    </h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-200 font-medium">{t('settings_language')}</p>
                            <p className="text-xs text-slate-500">{t('settings_language_desc')}</p>
                        </div>
                        <select
                            value={i18n.language}
                            onChange={(e) => i18n.changeLanguage(e.target.value)}
                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                        >
                            {languages.map(lang => (
                                <option key={lang.code} value={lang.code}>
                                    {lang.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                    <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
                        <Palette size={18} className="text-emerald-500" /> {t('settings_theme', 'Theme')}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {[
                            { id: 'classic', name: 'Corps Classic', color: '#0f172a' },
                            { id: 'midnight', name: 'Midnight', color: '#2b2d31' },
                            { id: 'white', name: 'Pro White (Beta)', color: '#ffffff' }
                        ].map((tOption) => (
                            <button
                                key={tOption.id}
                                onClick={() => setTheme(tOption.id)}
                                className={`relative p-3 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${theme === tOption.id
                                    ? `border-emerald-500 bg-slate-800`
                                    : 'border-slate-800 bg-slate-950/50 hover:bg-slate-800 hover:border-slate-700'
                                    }`}
                            >
                                <div className="w-6 h-6 rounded-full border border-slate-700 shadow-sm" style={{ backgroundColor: tOption.color }}></div>
                                <span className="text-sm font-medium text-slate-200">{tOption.name}</span>
                                {theme === tOption.id && (
                                    <div className="absolute right-3 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                    <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
                        <Cpu size={18} className="text-emerald-500" /> {t('settings_java_title')}
                    </h3>

                    <div className="space-y-4">
                        {/* Java Path */}
                        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800/50">
                            <label className="block text-sm font-medium text-slate-300 mb-3">{t('settings_java_path')}</label>
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <select
                                        value={javaPath}
                                        onChange={(e) => setJavaPath(e.target.value)}
                                        className="w-full appearance-none bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-300 font-mono pr-8 focus:outline-none focus:border-emerald-500/50 transition-colors"
                                    >
                                        <option value="" disabled>Select Java Version</option>
                                        {availableJavas && availableJavas.length > 0 ? (
                                            availableJavas.map((j, i) => (
                                                <option key={i} value={j.path}>
                                                    {j.name} (v{j.version}) - {j.path}
                                                </option>
                                            ))
                                        ) : (
                                            <option value={javaPath} disabled>{t('settings_no_java') || "No detected runtimes"}</option>
                                        )}
                                        {/* Always allow the current path even if not detected, so it doesn't break */}
                                        {!availableJavas?.find(j => j.path === javaPath) && javaPath && (
                                            <option value={javaPath}>{javaPath} (Custom)</option>
                                        )}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                </div>
                                <button
                                    onClick={handleBrowseJava}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium text-slate-200 transition-colors whitespace-nowrap"
                                >{t('btn_browse')}</button>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                                Select a detected Java Runtime or browse for a custom executable (javaw.exe).
                            </p>
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="block text-sm text-slate-400">{t('settings_ram_allocation')}</label>
                                <span className="text-sm font-bold text-emerald-400">{ram} GB</span>
                            </div>
                            <div className="relative pb-6 pt-2">
                                <input
                                    type="range"
                                    min="2"
                                    max="16"
                                    step="0.5"
                                    value={ram}
                                    onChange={(e) => setRam(e.target.value)}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 relative z-10"
                                />
                                {[2, 4, 8].map((cut) => {
                                    const ratio = (cut - 2) / (16 - 2);
                                    return (
                                        <div
                                            key={cut}
                                            className="absolute top-4 flex flex-col items-center -translate-x-1/2 pointer-events-none"
                                            style={{ left: `calc(0.5rem + (100% - 1rem) * ${ratio})` }}
                                        >
                                            <div className="w-0.5 h-1.5 bg-slate-600 mb-1"></div>
                                            <span className="text-[10px] font-mono text-slate-500">{cut} GB</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                    <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
                        <Monitor size={18} className="text-emerald-500" /> {t('settings_launcher_behavior')}
                    </h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-200 font-medium">{t('settings_hide_on_launch')}</p>
                            <p className="text-xs text-slate-500">{t('settings_launcher_behavior')}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={hideOnLaunch}
                                onChange={(e) => setHideOnLaunch(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-800/50">
                        <div>
                            <p className="text-sm text-slate-200 font-medium">
                                {t('settings_disable_animations')}
                                {theme === 'midnight' && <span className="ml-2 text-xs text-orange-400 font-normal">(Always off in Midnight)</span>}
                            </p>
                            <p className="text-xs text-slate-500">{t('settings_performance')}</p>
                        </div>
                        <label className={`relative inline-flex items-center cursor-pointer ${theme === 'midnight' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={disableAnimations || theme === 'midnight'}
                                onChange={(e) => setDisableAnimations(e.target.checked)}
                                disabled={theme === 'midnight'}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-800/50">
                        <div>
                            <p className="text-sm text-slate-200 font-medium">Discord Rich Presence</p>
                            <p className="text-xs text-slate-500">Show your game status on Discord</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={enableDiscordRPC}
                                onChange={(e) => setEnableDiscordRPC(e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>
                </div>

                {/* Troubleshooting */}
                <div className="bg-slate-900 rounded-xl p-6 border border-slate-800">
                    <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
                        <Terminal size={18} className="text-emerald-500" /> {t('settings_troubleshooting', 'Troubleshooting')}
                    </h3>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-200 font-medium">{t('settings_logs')}</p>
                            <p className="text-xs text-slate-500">{t('settings_logs_desc')}</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => window.electronAPI.openLogsFolder()}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium text-slate-200 transition-colors"
                            >
                                {t('btn_open_logs')}
                            </button>
                            <button
                                onClick={async () => {
                                    const btn = document.getElementById('upload-logs-btn');
                                    if (btn) { btn.disabled = true; btn.innerText = "Uploading..."; }
                                    try {
                                        const res = await window.electronAPI.uploadLogsManually();
                                        alert(res.success ? "Logs uploaded successfully!" : "Upload failed: " + res.error);
                                    } catch (e) { alert("Error uploading logs"); }
                                    if (btn) { btn.disabled = false; btn.innerText = "Upload to Support"; }
                                }}
                                id="upload-logs-btn"
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white transition-colors shadow-lg shadow-emerald-900/20"
                            >
                                Upload to Support
                            </button>
                        </div>
                    </div>
                </div>
                {/* Version Info */}
                <div className="text-center pt-8 pb-4">
                    <p className="text-slate-600 text-xs font-mono">
                        CraftCorps Launcher v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'}
                    </p>
                    <p className="text-slate-700 text-[10px] mt-1">
                        &copy; 2025 CraftCorps Authors
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
