import { AlertCircle, Check } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react'; // Ensure React and other hooks are imported
import { useTranslation } from 'react-i18next';
import { useToast } from '../contexts/ToastContext';
import { ModsDetailView } from './mods/ModsDetailView'; // Named export
import { ModsGridView } from './mods/ModsGridView'; // Named export

const ShaderDependencyModal = ({ isOpen, onClose, onConfirm, loader }) => {
    if (!isOpen) return null;

    const recommended = (loader === 'fabric' || loader === 'quilt') ? 'Iris & Sodium' : 'Oculus';
    const description = (loader === 'fabric' || loader === 'quilt')
        ? "To use shaders on Fabric/Quilt, you need the Iris mod (and Sodium). We can install these for you automatically."
        : "To use shaders on Forge/NeoForge, you need the Oculus mod. We can install it for you automatically.";

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 mb-4 text-amber-500">
                    <AlertCircle size={32} />
                    <h3 className="text-xl font-bold text-white">Shader Support Required</h3>
                </div>

                <p className="text-slate-300 mb-6 leading-relaxed">
                    {description}
                </p>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-95 flex items-center gap-2"
                    >
                        <Check size={18} />
                        Install {recommended} & Shader
                    </button>
                </div>
            </div>
        </div>
    );
};

const ModsView = ({ selectedInstance, instances = [], onInstanceCreated, onSwitchInstance, projectType = 'mod', setProjectType }) => {
    const { t } = useTranslation();
    const { addToast } = useToast();

    // -- State: Search --
    const [searchQuery, setSearchQuery] = useState('');

    // -- State: Selection & Details --
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectDetails, setProjectDetails] = useState(null);
    const [versions, setVersions] = useState([]);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [dependencies, setDependencies] = useState([]);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [activeTab, setActiveTab] = useState('description');

    // -- State: Installation --
    const [installingStates, setInstallingStates] = useState({});
    const [installProgress, setInstallProgress] = useState({});

    // -- State: Filters & Search --
    const [filterVersion, setFilterVersion] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [availableVersions, setAvailableVersions] = useState([]);
    const [availableCategories, setAvailableCategories] = useState([]);
    const [isLoadingFilters, setIsLoadingFilters] = useState(false);

    // -- State: Search Results --
    const [isSearching, setIsSearching] = useState(true); // Start loading immediately
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [results, setResults] = useState([]);

    const [installedMods, setInstalledMods] = useState([]);
    const [installedShaders, setInstalledShaders] = useState([]);

    // -- State: Shader Warning --
    const [showShaderWarning, setShowShaderWarning] = useState(false);
    const [pendingShaderProject, setPendingShaderProject] = useState(null);
    const [pendingShaderVersion, setPendingShaderVersion] = useState(null);

    // -- Cache --
    const searchCache = useRef({});

    useEffect(() => {
        // Reset filters when project type changes
        setFilterCategory('');
        setSearchQuery('');
        setSearchError(null);

        // Caching Logic
        const cached = searchCache.current[projectType];
        // Validate cache context (loader match for mods)
        let isValid = !!cached;
        if (isValid && projectType === 'mod' && selectedInstance && selectedInstance.loader && selectedInstance.loader !== 'Vanilla') {
            if (cached.loader !== selectedInstance.loader.toLowerCase()) isValid = false;
        }

        if (isValid) {
            setResults(cached.data);
            setIsSearching(false);
        } else {
            setResults([]);
            setIsSearching(true); // Show shimmer while waiting for debounce/fetch
        }
    }, [projectType, selectedInstance?.id]);

    useEffect(() => {
        loadInstalledMods();
        loadInstalledShaders();
    }, [selectedInstance]);

    // Load metadata (versions, categories) on mount
    useEffect(() => {
        // ... existing metadata load ...
        const loadMetadata = async () => {
            if (!window.electronAPI) return;
            try {
                // Load Game Versions
                const vRes = await window.electronAPI.modrinthGetTags('game_version');
                if (vRes.success && Array.isArray(vRes.data)) {
                    const vers = vRes.data
                        .map(v => v.version)
                        .filter(v => v && v.match(/^\d+\.\d+(\.\d+)?$/))
                        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
                    setAvailableVersions(vers.slice(0, 50));
                }

                // Load Categories
                const cRes = await window.electronAPI.modrinthGetTags('category');
                if (cRes.success && Array.isArray(cRes.data)) {
                    setAvailableCategories(cRes.data.map(c => ({ value: c.name, label: c.header || c.name })));
                }
            } catch (e) {
                console.error("Failed to load tags", e);
            }
        };
        loadMetadata();
    }, []);

    // ... (omitted Load Project Details & Versions and Load Dependencies for brevity if unchanged, but I need to be careful with range)
    // Actually I should only replace the relevant blocks to make it cleaner.

    // I will use multiple chunks.


    // Load Project Details & Versions when Selected
    useEffect(() => {
        if (!selectedProject || !window.electronAPI) return;

        const loadDetails = async () => {
            setIsLoadingDetails(true);
            setProjectDetails(null);
            setVersions([]);
            setDependencies([]);
            // Don't reset activeTab here so user can stay on 'versions' if browsing multiple mods? 
            // Actually usually better to reset to description.
            setActiveTab('description');

            try {
                const projectId = selectedProject.project_id;

                // 1. Fetch Project Body/Details
                const pRes = await window.electronAPI.modrinthGetProject(projectId);
                if (pRes.success) {
                    setProjectDetails(pRes.data);
                }

                // 2. Fetch Versions
                // We fetch all versions to ensure the table isn't empty. 
                // Filters can be applied client-side or we can just highlight compatible ones.
                const vRes = await window.electronAPI.modrinthGetVersions({ projectId });

                if (vRes.success) {
                    const allVersions = vRes.data;
                    setVersions(allVersions);

                    // Auto-select best version for current instance
                    if (allVersions.length > 0) {
                        let bestVer = allVersions[0];

                        if (selectedInstance && selectedInstance.version) {
                            const exactMatch = allVersions.find(v =>
                                v.game_versions.includes(selectedInstance.version) &&
                                (selectedInstance.loader === 'Vanilla' || !selectedInstance.loader || v.loaders.includes(selectedInstance.loader.toLowerCase()))
                            );
                            if (exactMatch) bestVer = exactMatch;
                        }
                        setSelectedVersion(bestVer);
                    }
                }
            } catch (e) {
                console.error("Failed to load details", e);
                addToast("Failed to load project details", 'error');
            } finally {
                setIsLoadingDetails(false);
            }
        };

        loadDetails();
    }, [selectedProject]);

    // Load Dependencies when Version Changes
    useEffect(() => {
        if (!selectedVersion || !window.electronAPI) {
            setDependencies([]);
            return;
        }

        const loadDependencies = async () => {
            // Dependencies are in the version object
            if (selectedVersion.dependencies && selectedVersion.dependencies.length > 0) {
                const depIds = selectedVersion.dependencies
                    .map(d => d.project_id)
                    .filter(id => id); // Filter out nulls

                if (depIds.length > 0) {
                    // Dedup IDs just in case
                    const uniqueIds = [...new Set(depIds)];
                    const depRes = await window.electronAPI.modrinthGetProjects(uniqueIds);
                    if (depRes.success) {
                        setDependencies(depRes.data);
                    }
                } else {
                    setDependencies([]);
                }
            } else {
                setDependencies([]);
            }
        };
        loadDependencies();
    }, [selectedVersion]);

    // Search Trigger (Debounced)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            performSearch(searchQuery);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, filterVersion, filterCategory, projectType, selectedInstance]);

    const performSearch = async (query = searchQuery, append = false) => {
        if (!window.electronAPI) return;

        // Context check for cache
        const isDefaultSearch = !query && !filterVersion && !filterCategory && !append;
        let currentLoader = null;
        if (projectType === 'mod' && selectedInstance && selectedInstance.loader && selectedInstance.loader !== 'Vanilla') {
            currentLoader = selectedInstance.loader.toLowerCase();
        }

        // Cache Hit Check (Idempotency)
        if (isDefaultSearch) {
            const cached = searchCache.current[projectType];
            let isValid = !!cached;
            if (isValid && projectType === 'mod' && currentLoader) {
                if (cached.loader !== currentLoader) isValid = false;
            }

            if (isValid) {
                // Even though effect handles this, debounce timer might still fire. 
                // Ensure we don't re-fetch or re-render unnecessarily.
                setResults(cached.data);
                setIsSearching(false);
                return;
            }
        }

        if (!append) {
            setIsSearching(true);
            setSearchError(null);
        } else {
            setIsLoadingMore(true);
        }

        try {
            const offset = append ? results.length : 0;

            const params = {
                query: query,
                type: projectType,
                offset: offset,
                limit: 20
            };

            if (filterVersion) params.version = filterVersion;
            if (filterCategory) params.category = filterCategory;

            if (currentLoader) {
                params.loader = currentLoader;
            }

            const res = await window.electronAPI.modrinthSearch(params);

            if (res.success) {
                if (append) {
                    setResults(prev => [...prev, ...res.data.hits]);
                } else {
                    setResults(res.data.hits);
                    // Cache Write
                    if (isDefaultSearch) {
                        searchCache.current[projectType] = {
                            data: res.data.hits,
                            loader: currentLoader
                        };
                    }
                }
            } else {
                setSearchError(res.error || "Failed to fetch results");
            }

        } catch (e) {
            console.error(e);
            setSearchError(e.message || "Search failed");
        } finally {
            setIsSearching(false);
            setIsLoadingMore(false);
        }
    };

    const handleVersionChange = (val) => {
        setFilterVersion(val);
    };

    const formatBytes = (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    }

    const loadInstalledMods = async () => {
        if (!selectedInstance || !window.electronAPI) return;
        try {
            const mods = await window.electronAPI.getInstanceMods(selectedInstance.path);
            setInstalledMods(mods || []);
        } catch (e) {
            console.error("Failed to load mods", e);
        }
    }

    const loadInstalledShaders = async () => {
        if (!selectedInstance || !window.electronAPI) return;
        try {
            const shaders = await window.electronAPI.getInstanceShaders(selectedInstance.path);
            setInstalledShaders(shaders || []);
        } catch (e) {
            console.error("Failed to load shaders", e);
        }
    }

    const handleInstall = async (project, version = null) => {
        if (!selectedInstance && project.project_type !== 'modpack') {
            addToast("Please select an instance in the Home tab first!", 'error');
            return;
        }

        const targetVersion = version || selectedVersion;
        const versionId = targetVersion ? targetVersion.id : null;
        const projectId = project.project_id;


        // SHADER CHECK
        if (project.project_type === 'shader') {
            const status = getInstallStatus(project);
            if (status.installed) {
                addToast(`Shader "${project.title}" is already installed as ${status.fileName}`, 'warning');
                return;
            }

            const hasIris = installedMods.some(m => m.modId === 'iris' || (m.fileName && m.fileName.toLowerCase().includes('iris')));
            const hasOculus = installedMods.some(m => m.modId === 'oculus' || (m.fileName && m.fileName.toLowerCase().includes('oculus')));
            const hasOptifine = installedMods.some(m => (m.fileName && m.fileName.toLowerCase().includes('optifine')));

            let needsDependency = false;
            const loader = selectedInstance?.loader?.toLowerCase();

            if (loader === 'fabric' || loader === 'quilt') {
                if (!hasIris && !hasOptifine) needsDependency = true;
            } else if (loader === 'forge' || loader === 'neoforge') {
                if (!hasOculus && !hasOptifine) needsDependency = true;
            }

            if (needsDependency) {
                setPendingShaderProject(project);
                setPendingShaderVersion(version);
                setShowShaderWarning(true);
                return;
            }
        }

        performInstall(project, versionId);
    };

    const performInstall = async (project, versionId, options = {}) => {
        const projectId = project.project_id;
        const { silent = false } = options;

        // CHECK IF ALREADY INSTALLED (Modpacks only)
        if (project.project_type === 'modpack' && instances) {
            const existing = instances.find(inst =>
                inst.modpackProjectId === projectId &&
                (inst.modpackVersionId === versionId || (!inst.modpackVersionId && !versionId))
            );

            if (existing) {
                if (!silent) addToast(`This version is already installed as "${existing.name}"`, 'warning');
                return;
            }
        }

        setInstallingStates(prev => ({ ...prev, [projectId]: true }));
        setInstallProgress(prev => ({ ...prev, [projectId]: { progress: 0, step: 'Starting...' } }));

        try {
            if (project.project_type === 'modpack') {
                // ... modpack install logic ...
                const packName = project.title;
                if (!silent) addToast(`Downloading modpack ${packName}...`, 'info');

                const res = await window.electronAPI.modrinthInstallModpack({
                    project: project,
                    instanceName: packName,
                    versionId: versionId
                });

                if (res.success) {
                    if (!silent) addToast(`Modpack ${packName} installed successfully!`, 'success');

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
                            icon: res.icon,
                            bgGradient: gradients[idx],
                            autoConnect: false,
                            modpackProjectId: projectId,
                            modpackVersionId: versionId
                        };

                        onInstanceCreated(newInstance);
                        if (!silent) addToast(`Redirecting to Home...`, 'info');
                    }
                } else {
                    addToast(`Failed: ${res.error}`, 'error');
                }

            } else {
                // Mod Installation
                const loader = selectedInstance.loader ? selectedInstance.loader.toLowerCase() : 'vanilla';
                if (loader === 'vanilla' && !silent) {
                    addToast("Warning: Installing mods on Vanilla instances might not work properly.", 'warning');
                }
                const gameVersion = selectedInstance.version;

                if (!silent) addToast(`Installing ${project.title}...`, 'info');
                const res = await window.electronAPI.modrinthInstallMod({
                    project: project,
                    gameVersion: gameVersion,
                    loader: loader === 'vanilla' ? 'fabric' : loader,
                    versionId: versionId,
                    instancePath: selectedInstance.path // Pass instance path
                });

                if (res.success) {
                    if (!silent) addToast(`Installed ${res.file}`, 'success');
                    if (project.project_type === 'shader') {
                        loadInstalledShaders();
                    } else {
                        loadInstalledMods();
                    }
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
    }

    const confirmShaderInstall = async () => {
        setShowShaderWarning(false);
        const loader = selectedInstance?.loader?.toLowerCase();

        // Auto-install dependencies
        try {
            if (loader === 'fabric' || loader === 'quilt') {
                addToast("Installing Iris & Sodium...", "info");
                // Iris (project_id: iris)
                await performInstall({ project_id: 'iris', title: 'Iris Shaders', project_type: 'mod' }, null, { silent: true });
                // Sodium (project_id: sodium) - Iris usually needs Sodium
                await performInstall({ project_id: 'sodium', title: 'Sodium', project_type: 'mod' }, null, { silent: true });
                addToast("Installed shader dependencies (Iris & Sodium)", "success");
            } else if (loader === 'forge' || loader === 'neoforge') {
                addToast("Installing Oculus...", "info");
                // Oculus (project_id: oculus)
                await performInstall({ project_id: 'oculus', title: 'Oculus', project_type: 'mod' }, null, { silent: true });
                addToast("Installed shader dependency (Oculus)", "success");
            }
        } catch (e) {
            console.error(e);
            addToast("Failed to install dependencies, proceeding with shader...", "warning");
        }

        // Install the original shader
        const targetVersionId = pendingShaderVersion ? pendingShaderVersion.id : null;
        performInstall(pendingShaderProject, targetVersionId);

        setPendingShaderProject(null);
        setPendingShaderVersion(null);
    };

    const handleCancel = async (projectId) => {
        if (!projectId) return;
        try {
            await window.electronAPI.modrinthCancelInstall(projectId);
            addToast("Cancelling installation...", "info");
        } catch (e) {
            console.error(e);
        }
    };

    // Helper to check if a specific version (or project generally) is installed
    const getInstallStatus = (project, version = null) => {
        if (project.project_type === 'modpack') {
            if (!instances) return { installed: false };
            const projectId = project.project_id;
            const versionId = version ? version.id : null;

            if (versionId) {
                const exactMatch = instances.find(inst => inst.modpackProjectId === projectId && inst.modpackVersionId === versionId);
                if (exactMatch) return { installed: true, instanceName: exactMatch.name };
            }
        } else if (project.project_type === 'mod') {
            // Check against installed mods in selected instance
            if (!installedMods) return { installed: false };
            const slug = project.slug; // Modrinth Slug usually matches internal modId (e.g. 'fabric-api')

            // Check by modId (from metadata) or fallback to slug in filename (less reliable)
            const found = installedMods.find(m => m.modId === slug);
            if (found) return { installed: true, fileName: found.fileName };
        } else if (project.project_type === 'shader') {
            if (!installedShaders) return { installed: false };
            // Heuristic match for shaders
            const cleanSlug = project.slug.replace(/[-_]/g, '').toLowerCase();
            const cleanTitle = project.title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

            const found = installedShaders.find(s => {
                const cleanName = s.name.replace(/[-_ .]/g, '').toLowerCase();
                return cleanName.includes(cleanSlug) || cleanName.includes(cleanTitle);
            });
            if (found) return { installed: true, fileName: found.name };
        }

        return { installed: false };
    };

    return (
        <div
            className="flex-1 p-8 flex flex-col h-full overflow-y-auto custom-scrollbar select-none relative"
            style={{
                backgroundImage: `
                    repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(148, 163, 184, 0.04) 39px, rgba(148, 163, 184, 0.04) 40px),
                    repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(148, 163, 184, 0.04) 39px, rgba(148, 163, 184, 0.04) 40px),
                    repeating-linear-gradient(0deg, transparent, transparent 59px, rgba(100, 116, 139, 0.03) 59px, rgba(100, 116, 139, 0.03) 60px),
                    repeating-linear-gradient(90deg, transparent, transparent 59px, rgba(100, 116, 139, 0.03) 59px, rgba(100, 116, 139, 0.03) 60px),
                    repeating-linear-gradient(0deg, transparent, transparent 79px, rgba(148, 163, 184, 0.025) 79px, rgba(148, 163, 184, 0.025) 80px),
                    repeating-linear-gradient(90deg, transparent, transparent 79px, rgba(148, 163, 184, 0.025) 79px, rgba(148, 163, 184, 0.025) 80px)
                `,
                backgroundSize: '40px 40px, 40px 40px, 60px 60px, 60px 60px, 80px 80px, 80px 80px',
                backgroundPosition: '0 0, 0 0, 7px 13px, 7px 13px, 15px 22px, 15px 22px'
            }}
        >
            <ShaderDependencyModal
                isOpen={showShaderWarning}
                onClose={() => setShowShaderWarning(false)}
                onConfirm={confirmShaderInstall}
                loader={selectedInstance?.loader?.toLowerCase()}
            />

            {selectedProject ? (
                <ModsDetailView
                    selectedProject={selectedProject}
                    setSelectedProject={setSelectedProject}
                    projectType={projectType}
                    projectDetails={projectDetails}
                    versions={versions}
                    selectedVersion={selectedVersion}
                    setSelectedVersion={setSelectedVersion}
                    dependencies={dependencies}
                    isLoadingDetails={isLoadingDetails}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    installingStates={installingStates}
                    installProgress={installProgress}
                    handleInstall={handleInstall}
                    handleCancel={handleCancel}
                    getInstallStatus={getInstallStatus}
                    formatBytes={formatBytes}
                    isModpack={projectType === 'modpack'}
                />
            ) : (
                <ModsGridView
                    projectType={projectType}
                    setProjectType={setProjectType}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    filterVersion={filterVersion}
                    setFilterVersion={handleVersionChange}
                    filterCategory={filterCategory}
                    setFilterCategory={setFilterCategory}
                    availableVersions={availableVersions}
                    availableCategories={availableCategories}
                    isLoadingFilters={isLoadingFilters}
                    isSearching={isSearching}
                    isLoadingMore={isLoadingMore}
                    searchError={searchError}
                    results={results}
                    onProjectSelect={setSelectedProject}
                    setSelectedProject={setSelectedProject}
                    selectedInstance={selectedInstance}
                    onLoadMore={() => performSearch(searchQuery, true)}
                    onSwitchInstance={onSwitchInstance}
                />
            )}
        </div>
    );
};

export default ModsView;
