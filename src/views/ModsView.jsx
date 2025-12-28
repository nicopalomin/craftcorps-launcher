import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive, Box, Download, Search, Filter, Loader2, Package } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

const ModsView = ({ selectedInstance }) => {
    const { t } = useTranslation();
    const { addToast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [projectType, setProjectType] = useState('mod'); // 'mod' or 'modpack'
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [installingStates, setInstallingStates] = useState({});

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            performSearch(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, projectType]);

    const performSearch = async (query) => {
        if (!window.electronAPI?.modrinthSearch) return;

        setIsLoading(true);
        setError(null);
        try {
            const response = await window.electronAPI.modrinthSearch({
                query: query,
                type: projectType,
                limit: 20
            });

            if (response.success) {
                setResults(response.data.hits || []);
            } else {
                setError(response.error);
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInstall = async (project) => {
        if (projectType === 'modpack') {
            addToast("Modpack installation is coming next!", 'info');
            return;
        }

        if (!selectedInstance) {
            addToast("Please select an instance in the Home tab first!", 'error');
            return;
        }

        // Check if loader is standard
        const loader = selectedInstance.loader ? selectedInstance.loader.toLowerCase() : 'vanilla';
        if (loader === 'vanilla') {
            addToast("Warning: Installing mods on Vanilla instance might not work. Please switch to Fabric/Forge.", 'warning');
            // Proceed anyway? Or stop? Let's proceed but warn.
        }

        const gameVersion = selectedInstance.version;

        // Optimistic UI
        setInstallingStates(prev => ({ ...prev, [project.project_id]: true }));
        addToast(`Installing ${project.title} for ${gameVersion}...`, 'info');

        try {
            const res = await window.electronAPI.modrinthInstallMod({
                project: project,
                // instancePath: null, // Let backend decide or we pass if we knew it. 
                // Currently backend defaults to standard .minecraft if null.
                // TODO: In future, pass selectedInstance.path if we utilize isolated instances
                gameVersion: gameVersion,
                loader: loader === 'vanilla' ? 'fabric' : loader // Default to fabric/quilt search if vanilla
            });

            if (res.success) {
                addToast(`Successfully installed ${res.file}!`, 'success');
            } else {
                addToast(`Failed: ${res.error}`, 'error');
            }
        } catch (e) {
            addToast(`Error: ${e.message}`, 'error');
        } finally {
            setInstallingStates(prev => ({ ...prev, [project.project_id]: false }));
        }
    };

    return (
        <div className="flex-1 p-8 animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col h-full overflow-hidden select-none">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-white">{t('mods_title') || 'Marketplace'}</h2>

                {/* Type Toggle */}
                <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
                    <button
                        onClick={() => setProjectType('mod')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${projectType === 'mod' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Box size={16} /> Mods
                    </button>
                    <button
                        onClick={() => setProjectType('modpack')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${projectType === 'modpack' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        <Package size={16} /> Modpacks
                    </button>
                </div>
            </div>

            {/* Search Bar */}
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
                {isLoading && (
                    <div className="flex items-center justify-center w-12 text-emerald-500 animate-spin">
                        <Loader2 size={24} />
                    </div>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center mb-4">
                        {error}
                    </div>
                )}

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-emerald-500">
                        <Loader2 size={48} className="animate-spin mb-4" />
                        <p className="text-slate-400 text-sm">Loading {projectType}s...</p>
                    </div>
                ) : results.length === 0 ? (
                    <div className="text-center py-20 text-slate-500">
                        <Package size={64} className="mx-auto mb-4 opacity-20" />
                        <p>{searchQuery ? 'No results found.' : 'Start typing to search Modrinth.'}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {results.map((project) => (
                            <div key={project.project_id} className="group bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700/50 rounded-xl p-4 flex flex-col gap-3 transition-all hover:-translate-y-1 hover:shadow-xl">
                                <div className="flex items-start gap-3">
                                    <div className="w-16 h-16 bg-slate-950 rounded-lg flex-shrink-0 overflow-hidden border border-slate-800">
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

                                <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-800/50">
                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                        <Download size={12} />
                                        {project.downloads.toLocaleString()}
                                    </div>
                                    <button
                                        onClick={() => handleInstall(project)}
                                        disabled={installingStates[project.project_id]}
                                        className={`p-2 rounded-lg transition-all ${installingStates[project.project_id] ? 'bg-slate-800 text-emerald-500 animate-pulse' : 'bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-400'}`}
                                        title={projectType === 'mod' ? "Install to selected instance" : "Create Instance"}
                                    >
                                        {installingStates[project.project_id] ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModsView;
