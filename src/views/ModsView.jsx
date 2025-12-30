import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    HardDrive, Box, Download, Search, Filter, Loader2, Package,
    ArrowLeft, Calendar, Info, Layers, List, ExternalLink, Hash, Check, X
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ModsView = ({ selectedInstance, instances = [], onInstanceCreated }) => {
    const { t } = useTranslation();
    const { addToast } = useToast();

    // -- State: Search --
    const [searchQuery, setSearchQuery] = useState('');
    const [projectType, setProjectType] = useState('mod'); // 'mod' or 'modpack'
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);

    // -- State: Detail View --
    const [selectedProject, setSelectedProject] = useState(null); // The basic project info from search
    const [projectDetails, setProjectDetails] = useState(null); // Full details (body, etc)
    const [versions, setVersions] = useState([]);
    const [selectedVersion, setSelectedVersion] = useState(null); // State for user-selected version
    const [dependencies, setDependencies] = useState([]); // Resolved dependency projects
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [activeTab, setActiveTab] = useState('description'); // 'description', 'versions', or 'dependencies'

    // -- State: Installation --
    const [installingStates, setInstallingStates] = useState({});
    const [installProgress, setInstallProgress] = useState({}); // { projectId: { progress, step, downloaded, total, speed, remaining } }

    useEffect(() => {
        if (window.electronAPI && window.electronAPI.onInstallProgress) {
            window.electronAPI.onInstallProgress((data) => {
                setInstallProgress(prev => ({ ...prev, [data.projectId]: data }));
            });
        }
        return () => {
            if (window.electronAPI && window.electronAPI.removeInstallProgressListeners) {
                window.electronAPI.removeInstallProgressListeners();
            }
        };
    }, []);

    const formatBytes = (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    const formatTime = (ms) => {
        if (!ms) return '';
        const seconds = Math.ceil(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ${seconds % 60}s`;
    };

    // -- Effects: Search --
    useEffect(() => {
        const timer = setTimeout(() => {
            performSearch(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, projectType]);

    // -- Effects: Load Details --
    useEffect(() => {
        if (selectedProject) {
            loadProjectDetails(selectedProject);
        } else {
            setProjectDetails(null);
            setVersions([]);
            setSelectedVersion(null); // Reset
            setDependencies([]);
            setActiveTab('description');
        }
    }, [selectedProject]);


    // -- Actions --

    const performSearch = async (query) => {
        if (!window.electronAPI?.modrinthSearch) return;
        setIsSearching(true);
        setSearchError(null);
        try {
            const response = await window.electronAPI.modrinthSearch({
                query: query,
                type: projectType,
                limit: 24
            });
            if (response.success) {
                setResults(response.data.hits || []);
            } else {
                setSearchError(response.error);
            }
        } catch (e) {
            setSearchError(e.message);
        } finally {
            setIsSearching(false);
        }
    };

    const loadProjectDetails = async (project) => {
        setIsLoadingDetails(true);
        try {
            // 1. Get Full Project Details (Body, etc.)
            const detailsRes = await window.electronAPI.modrinthGetProject(project.project_id);
            if (detailsRes.success) setProjectDetails(detailsRes.data);

            // 2. Get Versions
            const versionsRes = await window.electronAPI.modrinthGetVersions({
                projectId: project.project_id,
                // If we have a selected instance, ideally we filter, but for "Available Versions" 
                // we probably want to show all, or at least let the user see them.
                // We'll fetch all for now and maybe filter in UI or highlight compatible ones.
                loaders: [],
                gameVersions: []
            });

            let fetchedVersions = [];
            if (versionsRes.success) {
                fetchedVersions = versionsRes.data;
                setVersions(fetchedVersions);

                // Auto-select latest version
                if (fetchedVersions.length > 0) {
                    setSelectedVersion(fetchedVersions[0]);
                }
            }

            // 3. Resolve Dependencies (if modpack)
            // We'll take dependencies from the latest version (first in list)
            if (projectType === 'modpack' && fetchedVersions.length > 0) {
                const latest = fetchedVersions[0];
                const deps = latest.dependencies || [];
                // Collect project IDs
                const depProjectIds = deps.map(d => d.project_id).filter(Boolean);

                if (depProjectIds.length > 0) {
                    const depsRes = await window.electronAPI.modrinthGetProjects(depProjectIds);
                    if (depsRes.success) {
                        setDependencies(depsRes.data);
                    }
                }
            }
        } catch (e) {
            console.error("Failed to load details", e);
            addToast("Failed to load project details", 'error');
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const handleInstall = async (project, version = null) => {
        if (!selectedInstance && project.project_type !== 'modpack') {
            addToast("Please select an instance in the Home tab first!", 'error');
            return;
        }

        const targetVersion = version || selectedVersion;
        const versionId = targetVersion ? targetVersion.id : null;
        const versionName = targetVersion ? targetVersion.name : 'Latest';
        const projectId = project.project_id;

        // CHECK IF ALREADY INSTALLED (Modpacks only)
        if (project.project_type === 'modpack' && instances) {
            const existing = instances.find(inst =>
                inst.modpackProjectId === projectId &&
                (inst.modpackVersionId === versionId || (!inst.modpackVersionId && !versionId))
            );

            if (existing) {
                addToast(`This version is already installed as "${existing.name}"`, 'warning');
                return;
            }
        }

        setInstallingStates(prev => ({ ...prev, [projectId]: true }));
        setInstallProgress(prev => ({ ...prev, [projectId]: { progress: 0, step: 'Starting...' } }));

        try {
            if (project.project_type === 'modpack') {
                const packName = project.title;
                addToast(`Downloading modpack ${packName}...`, 'info');

                const res = await window.electronAPI.modrinthInstallModpack({
                    project: project,
                    instanceName: packName,
                    versionId: versionId
                });

                if (res.success) {
                    addToast(`Modpack ${packName} installed successfully!`, 'success');

                    if (onInstanceCreated) {
                        const gradients = [
                            'from-emerald-900/40 to-slate-900',
                            'from-blue-900/40 to-slate-900',
                            'from-purple-900/40 to-slate-900',
                            'from-rose-900/40 to-slate-900',
                            'from-amber-900/40 to-slate-900'
                        ];
                        const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-rose-500', 'bg-amber-500'];
                        const idx = Math.floor(Math.random() * colors.length);

                        const newInstance = {
                            id: `inst_${Date.now()}`,
                            name: res.instanceName || packName,
                            version: res.version,
                            loader: res.loader || 'Fabric',
                            path: res.instancePath,
                            status: 'Ready',
                            lastPlayed: null,
                            iconColor: colors[idx],
                            bgGradient: gradients[idx],
                            autoConnect: false,
                            modpackProjectId: projectId,
                            modpackVersionId: versionId
                        };


                        onInstanceCreated(newInstance);

                        // Wait a moment for the new instance to be registered, then potentially switch view
                        // Assuming onInstanceCreated updates the parent state or re-fetches instances
                        // We can't force view switch here unless we have a prop for it, but the Toast confirms it.
                        // Actually, user probably wants to go to Home to play it.
                        addToast(`Redirecting to Home...`, 'info');
                        // Use a global event or prop if available, otherwise just rely on success toast
                        // If we have access to a "setView" prop we could use it.
                        // For now, let's trigger a reload of instances if needed.
                    }

                    // Optional: Switch to Home View if possible
                    if (window.electronAPI) {
                        // Maybe send an event to App.jsx to switch tab?
                        // Or just let user click it.
                    }
                } else {
                    addToast(`Failed: ${res.error}`, 'error');
                }
            } else {
                // Mod Installation
                const loader = selectedInstance.loader ? selectedInstance.loader.toLowerCase() : 'vanilla';
                if (loader === 'vanilla') {
                    addToast("Warning: Installing mods on Vanilla instances might not work properly.", 'warning');
                }
                const gameVersion = selectedInstance.version;

                addToast(`Installing ${project.title}...`, 'info');
                const res = await window.electronAPI.modrinthInstallMod({
                    project: project,
                    gameVersion: gameVersion,
                    loader: loader === 'vanilla' ? 'fabric' : loader,
                    versionId: versionId
                });

                if (res.success) {
                    addToast(`Installed ${res.file}`, 'success');
                } else {
                    addToast(`Failed: ${res.error}`, 'error');
                }
            }
        } catch (e) {
            addToast(`Error: ${e.message}`, 'error');
        } finally {
            setInstallingStates(prev => ({ ...prev, [projectId]: false }));
            setInstallProgress(prev => {
                const next = { ...prev };
                delete next[projectId];
                return next;
            });
        }
    };


    // -- Views --

    const handleCancel = async (projectId) => {
        if (!projectId) return;
        try {
            await window.electronAPI.modrinthCancelInstall(projectId);
            addToast("Cancelling installation...", "info");
            // The backend will error out the install promise, which updates state in handleInstall
        } catch (e) {
            console.error(e);
        }
    };

    const renderDetailView = () => {
        if (!selectedProject) return null;

        const isModpack = projectType === 'modpack';
        const projectId = selectedProject.project_id;
        const isInstalling = installingStates[projectId];
        const progress = installProgress[projectId];

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
                        <p className="text-slate-400 text-sm flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1.5"><Download size={14} /> {selectedProject.downloads.toLocaleString()} downloads</span>
                            <span className="flex items-center gap-1.5"><Calendar size={14} /> Updated {new Date(selectedProject.date_modified).toLocaleDateString()}</span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs border border-slate-700">{selectedProject.project_type}</span>
                        </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 min-w-[200px]">
                        <div className="flex items-center gap-2 w-full">
                            {/* Main Install Button (Selected Version) */}
                            <button
                                onClick={() => handleInstall(selectedProject, selectedVersion)}
                                disabled={isInstalling || !selectedVersion}
                                className={`flex-1 relative overflow-hidden bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-80 disabled:pointer-events-none`}
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
                                            {/* <Loader2 size={20} className="animate-spin" /> */}
                                            <span className="text-sm font-medium">
                                                {progress ? `${Math.round(progress.progress)}%` : 'installing...'}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <Download size={20} />
                                            <span>{selectedVersion ? `Install ${selectedVersion.version_number || selectedVersion.name}` : (isLoadingDetails ? 'Loading...' : 'Select Version')}</span>
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
                                        <div className="prose prose-invert prose-emerald max-w-none prose-img:rounded-xl prose-a:text-emerald-400 prose-headings:text-slate-200 break-words">
                                            <ReactMarkdown
                                                children={projectDetails.body}
                                                // remarkPlugins={[remarkGfm]} // Temporarily disabled to check if it fixes formatting
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
                                    {versions.map(ver => (
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
                                                    onClick={(e) => { e.stopPropagation(); handleInstall(selectedProject, ver); }}
                                                    className="p-2 hover:bg-emerald-600 rounded-lg text-slate-400 hover:text-white transition-colors"
                                                    title="Quick Install"
                                                >
                                                    <Download size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
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

    const renderGridView = () => (
        <>
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-white">{t('mods_title') || 'Marketplace'}</h2>
                <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
                    <button
                        onClick={() => { setProjectType('mod'); setSelectedProject(null); }}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${projectType === 'mod' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Box size={16} /> Mods
                    </button>
                    <button
                        onClick={() => { setProjectType('modpack'); setSelectedProject(null); }}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${projectType === 'modpack' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Package size={16} /> Modpacks
                    </button>
                </div>
            </div>

            <div className="flex gap-4 mb-6">
                <div className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3 focus-within:border-emerald-500/50 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                    <Search size={20} className="text-slate-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={`Search ${projectType}s for ${selectedInstance ? selectedInstance.version : 'Minecraft'}...`}
                        className="bg-transparent border-none focus:outline-none text-slate-200 w-full placeholder:text-slate-600"
                    />
                </div>
                {isSearching && (
                    <div className="flex items-center justify-center w-12 text-emerald-500 animate-spin">
                        <Loader2 size={24} />
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {searchError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center mb-4">
                        {searchError}
                    </div>
                )}

                {results.length === 0 && !isSearching ? (
                    <div className="text-center py-20 text-slate-500">
                        <Package size={64} className="mx-auto mb-4 opacity-20" />
                        <p>{searchQuery ? 'No results found.' : 'Start typing to search Modrinth.'}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {results.map((project) => (
                            <div
                                key={project.project_id}
                                onClick={() => setSelectedProject(project)}
                                className="group bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700/50 rounded-xl p-4 flex flex-col gap-3 transition-all hover:-translate-y-1 hover:shadow-xl cursor-pointer"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-16 h-16 bg-slate-950 rounded-lg flex-shrink-0 overflow-hidden border border-slate-800 group-hover:border-emerald-500/30 transition-colors">
                                        {project.icon_url ? (
                                            <img src={project.icon_url} alt={project.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-emerald-500/20">
                                                <Box size={32} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-base font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                                            {project.title}
                                        </h3>
                                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                                            {project.description}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-800/50 text-[10px] text-slate-500 font-mono">
                                    <span className="flex items-center gap-1"><Download size={12} /> {project.downloads.toLocaleString()}</span>
                                    <span className="flex items-center gap-1"><Layers size={12} /> {project.project_type}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );

    return (
        <div className="flex-1 p-8 flex flex-col h-full overflow-hidden select-none relative">
            {selectedProject ? renderDetailView() : renderGridView()}
        </div>
    );
};

export default ModsView;
