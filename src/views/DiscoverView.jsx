
import React from "react";
import { useDiscover } from "../hooks/useDiscover";
import DiscoverHeader from "../components/discover/DiscoverHeader";
import DiscoverGrid from "../components/discover/DiscoverGrid";

const DiscoverView = ({ selectedInstance, activeAccount }) => {
    const {
        servers,
        loading,
        loadingMore,
        hasMore,
        query,
        setQuery,
        activeFilters,
        setActiveFilters,
        metadata,
        sections,
        loadServers,
        handleJoin,
        handleCopy,
        joiningServers,
        playingServerIp,
        isBusy,
        handleStop
    } = useDiscover(selectedInstance, activeAccount);

    return (
        <div className="flex-1 bg-slate-900 overflow-hidden relative flex flex-col select-none">
            <DiscoverHeader
                query={query}
                setQuery={setQuery}
                activeFilters={activeFilters}
                setActiveFilters={setActiveFilters}
                metadata={metadata}
            />
            <DiscoverGrid
                loading={loading}
                servers={servers}
                sections={sections}
                hasMore={hasMore}
                loadingMore={loadingMore}
                loadServers={loadServers}
                handleJoin={handleJoin}
                handleCopy={handleCopy}
                handleStop={handleStop}
                joiningServers={joiningServers}
                playingServerIp={playingServerIp}
                isBusy={isBusy}
            />
        </div>
    );
};

export default DiscoverView;
