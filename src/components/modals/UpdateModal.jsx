import React, { useEffect, useState } from 'react';
import { Download, Rocket, X, AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const UpdateModal = ({ isOpen, onClose, updateInfo, updateStatus, downloadProgress, onDownload, onInstall }) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    const isDownloading = updateStatus === 'downloading';
    const isReadyToInstall = updateStatus === 'downloaded';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        {isReadyToInstall ? (
                            <><Rocket className="w-6 h-6" /> Update Ready</>
                        ) : (
                            <><Download className="w-6 h-6" /> Update Available</>
                        )}
                    </h2>
                    {!isDownloading && (
                        <button onClick={onClose} className="text-emerald-100 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-medium text-slate-400">New Version:</span>
                            <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded text-sm font-bold border border-emerald-500/20">
                                v{updateInfo?.version || 'Unknown'}
                            </span>
                        </div>
                        <div className="prose prose-sm prose-invert max-w-none text-slate-300 max-h-48 overflow-y-auto custom-scrollbar">
                            <p>A new version of CraftCorps Launcher is available!</p>
                            {/* We could render release notes here if updateInfo.releaseNotes was passed */}
                        </div>
                    </div>

                    {isDownloading ? (
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm text-slate-400">
                                <span>Downloading...</span>
                                <span>{Math.round(downloadProgress?.percent || 0)}%</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                                    style={{ width: `${downloadProgress?.percent || 0}%` }}
                                />
                            </div>
                            <div className="text-xs text-slate-500 text-right">
                                {(downloadProgress?.transferred / 1024 / 1024).toFixed(1)} MB / {(downloadProgress?.total / 1024 / 1024).toFixed(1)} MB
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={isReadyToInstall ? onInstall : onDownload}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-lg font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 group"
                            >
                                {isReadyToInstall ? (
                                    <>
                                        <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                                        Restart & Install
                                    </>
                                ) : (
                                    <>
                                        <Download size={18} className="group-hover:translate-y-0.5 transition-transform" />
                                        Download Update
                                    </>
                                )}
                            </button>
                            {!isReadyToInstall && (
                                <button
                                    onClick={onClose}
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-lg font-medium transition-colors"
                                >
                                    Remind Me Later
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UpdateModal;
