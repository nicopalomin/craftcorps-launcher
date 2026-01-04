import React, { useState } from 'react';
import {
    Download, Check, X, Box, Info, ArrowLeft, Calendar, Package, Loader2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useToast } from '../../contexts/ToastContext';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

export const ModsDetailView = ({
    selectedProject,
    setSelectedProject,
    projectType,
    projectDetails,
    versions,
    selectedVersion,
    setSelectedVersion,
    dependencies,
    isLoadingDetails,
    activeTab,
    setActiveTab,
    installingStates,
    installProgress,
    handleInstall,
    handleCancel,
    getInstallStatus,
    formatBytes,
    isModpack
}) => {

    // We need to access some logic, but most is passed as props.
    // The render logic is large, so this split helps.

    if (!selectedProject) return null;

    const projectId = selectedProject.project_id;
    const isInstalling = installingStates[projectId];
    const progress = installProgress[projectId];

    // Check if currently selected version is installed
    const installStatus = getInstallStatus(selectedProject, selectedVersion);
    const isInstalled = installStatus.installed;

    return (
        <div className="flex flex-col h-full animate-in slide-in-from-right-10 duration-300">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => setSelectedProject(null)}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>

                <div className="w-16 h-16 bg-slate-800 rounded-xl overflow-hidden border border-slate-700/50 shadow-lg">
                    {selectedProject.icon_url ? (
                        <img src={selectedProject.icon_url} alt={selectedProject.title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                            <Package size={32} />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <h1 className="text-3xl font-bold text-white tracking-tight">{selectedProject.title}</h1>
                    <p className="text-emerald-500 font-medium text-sm mb-2">by {selectedProject.author}</p>

                    <div className="flex flex-wrap gap-2 mb-3">
                        {/* Loaders */}
                        {(selectedProject.categories?.filter(c => ['fabric', 'forge', 'quilt', 'neoforge'].includes(c)) || []).map(l => (
                            <span key={l} className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300 capitalize">
                                {l}
                            </span>
                        ))}
                        {/* Versions */}
                        {(selectedProject.versions || []).slice(0, 3).map(v => (
                            <span key={v} className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-500">
                                {v}
                            </span>
                        ))}
                        {(selectedProject.versions?.length || 0) > 3 && (
                            <span className="px-2 py-0.5 text-xs text-slate-600">+{selectedProject.versions.length - 3} versions</span>
                        )}
                    </div>

                    <p className="text-slate-400 text-sm flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><Download size={14} /> {selectedProject.downloads.toLocaleString()} downloads</span>
                        <span className="flex items-center gap-1.5"><Calendar size={14} /> Updated {new Date(selectedProject.date_modified).toLocaleDateString()}</span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs border border-slate-700">{selectedProject.project_type}</span>
                    </p>
                </div>

                <div className="flex flex-col items-end gap-2 min-w-[220px]">
                    <div className="flex items-center gap-2 w-full">
                        {/* Main Install Button (Selected Version) */}
                        <button
                            onClick={() => handleInstall(selectedProject, selectedVersion)}
                            disabled={isInstalling || !selectedVersion || isInstalled}
                            className={`flex-1 relative overflow-hidden text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-80 disabled:pointer-events-none ${isInstalled
                                ? 'bg-slate-700 text-slate-300 shadow-none cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
                                }`}
                        >
                            {isInstalling && progress ? (
                                <div className="absolute inset-0 bg-emerald-700 z-0">
                                    <div
                                        className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                                        style={{ width: `${progress.progress}%` }}
                                    />
                                </div>
                            ) : null}

                            <div className="relative z-10 flex items-center gap-2">
                                {isInstalling ? (
                                    <>
                                        <span className="text-sm font-medium">
                                            {progress ? `${Math.round(progress.progress)}%` : 'installing...'}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        {isInstalled ? <Check size={20} className="text-emerald-400" /> : <Download size={20} />}
                                        <span>
                                            {isInstalled
                                                ? 'Installed'
                                                : (selectedVersion ? `Install ${selectedVersion.version_number || selectedVersion.name}` : (isLoadingDetails ? 'Loading...' : 'Select Version'))}
                                        </span>
                                    </>
                                )}
                            </div>
                        </button>

                        {isInstalling && (
                            <button
                                onClick={() => handleCancel(projectId)}
                                className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors border border-red-500/20"
                                title="Cancel Installation"
                            >
                                <X size={20} />
                            </button>
                        )}
                    </div>

                    {isInstalled && (
                        <div className="text-xs text-emerald-500 font-medium">
                            Instance: {installStatus.instanceName}
                        </div>
                    )}

                    {isInstalling && progress && (
                        <div className="text-xs text-right text-slate-400 font-mono space-y-0.5">
                            <div>{progress.step}</div>
                            {progress.speed > 0 && (
                                <div className="flex gap-2 justify-end">
                                    <span>{formatBytes(progress.downloaded)} / {formatBytes(progress.total)}</span>
                                    <span className="text-emerald-500">{formatBytes(progress.speed)}/s</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-slate-900/50 p-1 rounded-xl w-fit">
                {['description', 'versions', ...(isModpack ? ['dependencies'] : [])].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900/30 rounded-2xl border border-white/5 p-6 shadow-inner">
                {isLoadingDetails ? (
                    <div className="flex flex-col items-center justify-center h-64 text-emerald-500">
                        <Loader2 size={40} className="animate-spin mb-4" />
                        <p className="text-slate-400">Fetching Details...</p>
                    </div>
                ) : (
                    <>
                        {/* Description Tab */}
                        {activeTab === 'description' && (
                            <div className="prose prose-invert prose-emerald max-w-none">
                                <p className="text-lg text-slate-300 leading-relaxed font-light mb-6">
                                    {selectedProject.description}
                                </p>
                                {projectDetails?.body ? (
                                    <div className="prose prose-invert prose-emerald max-w-none prose-img:rounded-xl prose-img:my-8 prose-p:my-4 prose-headings:text-slate-200 prose-headings:my-6 break-words">
                                        <ReactMarkdown
                                            children={projectDetails.body}
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeRaw]}
                                            components={{
                                                a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 no-underline hover:underline" />
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap text-slate-400">{projectDetails?.body}</div>
                                )}
                            </div>
                        )}

                        {/* Versions Tab */}
                        {activeTab === 'versions' && (
                            <div className="space-y-2">
                                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <div className="col-span-4">Version Name</div>
                                    <div className="col-span-3">Game Version</div>
                                    <div className="col-span-2">Loader</div>
                                    <div className="col-span-3 text-right">Action</div>
                                </div>
                                {versions.length === 0 && <p className="text-center text-slate-500 py-10">No versions found.</p>}
                                {versions.map(ver => {
                                    const verStatus = getInstallStatus(selectedProject, ver);
                                    const verInstalled = verStatus.installed;

                                    return (
                                        <div
                                            key={ver.id}
                                            onClick={() => setSelectedVersion(ver)}
                                            className={`grid grid-cols-12 gap-4 items-center border rounded-lg p-3 transition-colors cursor-pointer ${selectedVersion?.id === ver.id
                                                ? 'bg-emerald-900/20 border-emerald-500/50'
                                                : 'bg-slate-800/50 hover:bg-slate-800 border-white/5'
                                                }`}
                                        >
                                            <div className="col-span-4 font-medium text-slate-200 truncate flex items-center gap-2">
                                                {selectedVersion?.id === ver.id && <Check size={14} className="text-emerald-500" />}
                                                {verInstalled && <span className="bg-emerald-900/30 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">Inst</span>}
                                                <span title={ver.name}>{ver.name}</span>
                                            </div>
                                            <div className="col-span-3 flex flex-wrap gap-1">
                                                {ver.game_versions.slice(0, 3).map(gv => (
                                                    <span key={gv} className="px-1.5 py-0.5 bg-slate-900 rounded text-xs text-slate-400">{gv}</span>
                                                ))}
                                                {ver.game_versions.length > 3 && <span className="text-xs text-slate-500">+{ver.game_versions.length - 3}</span>}
                                            </div>
                                            <div className="col-span-2 flex flex-wrap gap-1">
                                                {ver.loaders.map(l => (
                                                    <span key={l} className="px-1.5 py-0.5 bg-emerald-900/30 text-emerald-400 rounded text-xs uppercase">{l}</span>
                                                ))}
                                            </div>
                                            <div className="col-span-3 flex justify-end">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); if (!verInstalled) handleInstall(selectedProject, ver); }}
                                                    disabled={verInstalled}
                                                    className={`p-2 rounded-lg transition-colors ${verInstalled ? 'text-emerald-500 bg-emerald-900/20 cursor-default' : 'hover:bg-emerald-600 text-slate-400 hover:text-white'}`}
                                                    title={verInstalled ? "Installed" : "Quick Install"}
                                                >
                                                    {verInstalled ? <Check size={16} /> : <Download size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Dependencies Tab (Modpack only) */}
                        {activeTab === 'dependencies' && (
                            <div>
                                <div className="mb-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-500 text-sm flex items-center gap-2">
                                    <Info size={16} />
                                    <span>Showing dependencies for the latest version.</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {dependencies.length === 0 && <p className="col-span-full text-center text-slate-500 py-10">No dependencies found or info unavailable.</p>}
                                    {dependencies.map(dep => (
                                        <div key={dep.id} className="bg-slate-800/50 border border-white/5 p-3 rounded-xl flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-900 rounded-lg overflow-hidden flex-shrink-0">
                                                {dep.icon_url ? <img src={dep.icon_url} className="w-full h-full object-cover" /> : <Box className="p-2 text-slate-600" />}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-medium text-slate-200 truncate">{dep.title}</div>
                                                <div className="text-xs text-slate-500 truncate">{dep.description}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
