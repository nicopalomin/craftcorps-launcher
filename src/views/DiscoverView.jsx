
import React from "react";
import { useDiscover } from "../hooks/useDiscover";
import DiscoverHeader from "../components/discover/DiscoverHeader";
import DiscoverGrid from "../components/discover/DiscoverGrid";

const DiscoverView = () => {
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
        handleCopy
    } = useDiscover();

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
            />
        </div>
    );
};

export default DiscoverView;
