import React from 'react';
import { Download, RefreshCw } from 'lucide-react';

const UpdateOverlay = ({ updateStatus, updateInfo, downloadProgress }) => {
    const isDownloading = updateStatus === 'downloading';
    const isDownloaded = updateStatus === 'downloaded';

    if (!isDownloading && !isDownloaded) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-sm">
            <div className="w-full max-w-sm text-center px-8">
                {/* Icon */}
                <div className="mb-6 flex justify-center">
                    {isDownloaded ? (
                        <RefreshCw size={48} className="text-emerald-400 animate-spin" />
                    ) : (
                        <Download size={48} className="text-emerald-400 animate-bounce" />
                    )}
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-white mb-2">
                    {isDownloaded ? 'Installing Update...' : 'Updating CraftCorps'}
                </h2>

                {/* Version */}
                {updateInfo?.version && (
                    <p className="text-sm text-slate-400 mb-6">
                        Version {updateInfo.version}
                    </p>
                )}

                {/* Progress bar */}
                {isDownloading && (
                    <div className="space-y-2">
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                                style={{ width: `${downloadProgress?.percent || 0}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>
                                {downloadProgress?.transferred && downloadProgress?.total
                                    ? `${(downloadProgress.transferred / 1024 / 1024).toFixed(1)} MB / ${(downloadProgress.total / 1024 / 1024).toFixed(1)} MB`
                                    : 'Preparing...'}
                            </span>
                            <span>{Math.round(downloadProgress?.percent || 0)}%</span>
                        </div>
                    </div>
                )}

                {/* Restarting message */}
                {isDownloaded && (
                    <p className="text-sm text-slate-400">
                        Restarting launcher...
                    </p>
                )}
            </div>
        </div>
    );
};

export default UpdateOverlay;
