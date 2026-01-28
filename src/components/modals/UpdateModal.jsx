import React from 'react';
import { Download, RefreshCw, AlertTriangle, FolderOpen } from 'lucide-react';

const UpdateOverlay = ({ updateStatus, updateInfo, downloadProgress, updateError, updatePath }) => {
    const isDownloading = updateStatus === 'downloading';
    const isDownloaded = updateStatus === 'downloaded';
    const needsManualInstall = updateStatus === 'manual-install-required';

    if (!isDownloading && !isDownloaded && !needsManualInstall) return null;

    const openUpdateFolder = () => {
        if (updatePath && window.electronAPI?.openPath) {
            window.electronAPI.openPath(updatePath);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-sm">
            <div className="w-full max-w-md text-center px-8">
                {/* Icon */}
                <div className="mb-6 flex justify-center">
                    {needsManualInstall ? (
                        <AlertTriangle size={48} className="text-amber-400" />
                    ) : isDownloaded ? (
                        <RefreshCw size={48} className="text-emerald-400 animate-spin" />
                    ) : (
                        <Download size={48} className="text-emerald-400 animate-bounce" />
                    )}
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-white mb-2">
                    {needsManualInstall
                        ? 'Manual Installation Required'
                        : isDownloaded
                        ? 'Installing Update...'
                        : 'Updating CraftCorps'}
                </h2>

                {/* Version */}
                {updateInfo?.version && !needsManualInstall && (
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
                {isDownloaded && !needsManualInstall && (
                    <p className="text-sm text-slate-400">
                        Restarting launcher...
                    </p>
                )}

                {/* Manual install instructions */}
                {needsManualInstall && (
                    <div className="space-y-4 text-left">
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                            <p className="text-sm text-slate-300 mb-3">
                                The update downloaded successfully, but automatic installation failed because the app is not code-signed.
                            </p>
                            <p className="text-sm text-slate-300 mb-3">
                                Please install manually by following these steps:
                            </p>
                            <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
                                <li>Click "Open Download Folder" below</li>
                                <li>Extract the CraftCorps-*.zip file</li>
                                <li>Move CraftCorps.app to Applications folder</li>
                                <li>Launch the new version</li>
                            </ol>
                        </div>

                        <div className="flex flex-col gap-2">
                            <button
                                onClick={openUpdateFolder}
                                className="w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                            >
                                <FolderOpen size={18} />
                                Open Download Folder
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
                            >
                                Close
                            </button>
                        </div>

                        {updatePath && (
                            <p className="text-xs text-slate-500 break-all">
                                Path: {updatePath}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpdateOverlay;
