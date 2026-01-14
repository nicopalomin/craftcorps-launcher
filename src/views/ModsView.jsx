import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../contexts/ToastContext';
import { ModsGridView } from './mods/ModsGridView';
import { ModsDetailView } from './mods/ModsDetailView';

// Since we moved components, lucide-react etc are imported there or handled via props.

const ModsView = ({ selectedInstance, instances = [], onInstanceCreated, onSwitchInstance }) => {
    const { t } = useTranslation();
    const { addToast } = useToast();

    // -- State: Search --
    const [searchQuery, setSearchQuery] = useState('');
    const [projectType, setProjectType] = useState(selectedInstance ? 'mod' : 'modpack'); // Auto-select mod if instance selected

    const [filterVersion, setFilterVersion] = useState(selectedInstance ? selectedInstance.version : '');
    const [filterCategory, setFilterCategory] = useState('');
    const [results, setResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState(null);

    // Filter Options State
    const [availableVersions, setAvailableVersions] = useState([]);
    const [availableCategories, setAvailableCategories] = useState([]);
    const [isLoadingFilters, setIsLoadingFilters] = useState(false);

    // -- Mount Delay for Smooth Animation --
    const [isReady, setIsReady] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 350);
        return () => clearTimeout(timer);
    }, []);

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

    // Helper: Compare Versions (v1 >= v2)
    const isVersionAtLeast = (v1, v2) => {
        const p1 = v1.split('.').map(Number);
        const p2 = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const n1 = p1[i] || 0;
            const n2 = p2[i] || 0;
            if (n1 > n2) return true;
            if (n1 < n2) return false;
        }
        return true;
    };

    // Initial Filter Load
    useEffect(() => {
        const loadFilters = async () => {
            if (!isReady) return;
            if (!window.electronAPI?.modrinthGetTags) return;
            setIsLoadingFilters(true);
            try {
                // Fetch Versions
                const vRes = await window.electronAPI.modrinthGetTags('game_version');
                if (vRes.success) {
                    const releases = vRes.data
                        .filter(v => v.version_type === 'release')
                        .map(v => v.version)
                        .filter(v => isVersionAtLeast(v, '1.7.10')); // Limit to >= 1.7.10
                    setAvailableVersions(releases);
                }

                // Fetch Categories
                const cRes = await window.electronAPI.modrinthGetTags('category');
                if (cRes.success) {
                    console.log("Categories fetched:", cRes.data); // Debug log
                    // Map to {label, value}
                    // Relaxed filtering: just check if 'project_type' matches or is effectively generic
                    const cats = cRes.data
                        // .filter(c => !c.header) // Removed potential aggressive filter
                        .filter(c => {
                            // Some categories might be purely for display headers in Modrinth UI, but API usually returns flat list
                            // If 'header' exists, it might be a header item, but let's check name.
                            // We want items that are selectable categories.
                            // Modrinth categories usually have an icon too.
                            return c.project_type === projectType || !c.project_type || c.project_type === 'mod' || c.project_type === 'modpack';
                        })
                        .map(c => ({
                            label: c.name.charAt(0).toUpperCase() + c.name.slice(1),
                            value: c.name.toLowerCase()
                        }));

                    // Deduplicate just in case
                    const uniqueCats = [...new Map(cats.map(item => [item.value, item])).values()];
                    // Sort alphabetically
                    uniqueCats.sort((a, b) => a.label.localeCompare(b.label));

                    setAvailableCategories(uniqueCats);
                }

            } catch (e) {
                console.error("Failed to load filters", e);
            } finally {
                setIsLoadingFilters(false);
            }
        };
        loadFilters();
    }, [projectType, isReady]); // Reload categories if project type changes? Some categories are specific.

    // -- Effects: Search --
    const prevQueryRef = useRef(searchQuery);
    const userHasManuallySetVersion = useRef(false);

    const handleVersionChange = (val) => {
        setFilterVersion(val);
        userHasManuallySetVersion.current = true;
    };

    // Handle View Context Switching (Mods <-> Modpacks)
    useEffect(() => {
        if (projectType === 'modpack') {
            // When switching to Modpacks, default to "All Versions" if the user hasn't explicitly chosen one.
            // This prevents the filter from being stuck on the Instance's version.
            if (!userHasManuallySetVersion.current) {
                setFilterVersion('');
            }
        } else if (projectType === 'mod' && selectedInstance) {
            // When switching to Mods, we must lock to the instance version.
            // We consider this an "automatic" system set, so we reset the manual flag.
            setFilterVersion(selectedInstance.version);
            userHasManuallySetVersion.current = false;
        }
    }, [projectType, selectedInstance]);

    useEffect(() => {
        const isTextChange = prevQueryRef.current !== searchQuery;
        prevQueryRef.current = searchQuery;

        if (isTextChange) {
            // Debounce text search
            const timer = setTimeout(() => {
                if (isReady) performSearch(searchQuery);
            }, 300);
            return () => clearTimeout(timer);
        } else {
            // Immediate update for filters or mount
            if (!isSearching && isReady) {
                performSearch(searchQuery);
            }
        }
    }, [searchQuery, projectType, filterVersion, filterCategory, isReady]);

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

    const [offset, setOffset] = useState(0);

    // -- Actions --

    const performSearch = async (query, isLoadMore = false) => {
        if (!window.electronAPI?.modrinthSearch) return;
        setIsSearching(true);
        setSearchError(null);

        const currentOffset = isLoadMore ? offset : 0;
        const limit = 24;

        try {
            // Determine loader filter
            let loaderFilter = undefined;
            if (projectType === 'mod' && selectedInstance && selectedInstance.loader && selectedInstance.loader !== 'Vanilla') {
                loaderFilter = selectedInstance.loader.toLowerCase();
            }

            const response = await window.electronAPI.modrinthSearch({
                query: query,
                type: projectType,
                version: filterVersion || undefined,
                category: filterCategory || undefined,
                loader: loaderFilter,
                limit: limit,
                offset: currentOffset
            });
            if (response.success) {
                if (isLoadMore) {
                    setResults(prev => [...prev, ...(response.data.hits || [])]);
                    setOffset(prev => prev + limit);
                } else {
                    setResults(response.data.hits || []);
                    setOffset(limit);
                }
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
            let targetLoaders = [];
            let targetGameVersions = [];

            if (projectType === 'mod' && selectedInstance) {
                if (selectedInstance.loader && selectedInstance.loader !== 'Vanilla') {
                    targetLoaders.push(selectedInstance.loader.toLowerCase());
                }
                if (selectedInstance.version) {
                    targetGameVersions.push(selectedInstance.version);
                }
            }

            const versionsRes = await window.electronAPI.modrinthGetVersions({
                projectId: project.project_id,
                loaders: targetLoaders,
                gameVersions: targetGameVersions
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
                        addToast(`Redirecting to Home...`, 'info');
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
                    versionId: versionId,
                    instancePath: selectedInstance.path // Pass instance path
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
        if (!instances || project.project_type !== 'modpack') return false;

        const projectId = project.project_id;
        const versionId = version ? version.id : null;

        if (versionId) {
            const exactMatch = instances.find(inst => inst.modpackProjectId === projectId && inst.modpackVersionId === versionId);
            if (exactMatch) return { installed: true, instanceName: exactMatch.name };
        }
        return { installed: false };
    };

    return (
        <div className="flex-1 p-8 flex flex-col h-full overflow-y-auto custom-scrollbar select-none relative">
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
