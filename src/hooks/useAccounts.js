import { useState, useEffect, useRef } from 'react';

export const useAccounts = () => {
    const [accounts, setAccounts] = useState(() => {
        try {
            const saved = localStorage.getItem('craftcorps_accounts');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error("Failed to load accounts", e);
            return [];
        }
    });

    const [activeAccount, setActiveAccount] = useState(() => {
        try {
            const saved = localStorage.getItem('craftcorps_active_account');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    });

    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Track active account ID to prevent race conditions during async refresh
    const activeAccountIdRef = useRef(activeAccount?.id);
    const hasRefreshedRef = useRef(false); // Ref to prevent double execution in Strict Mode

    useEffect(() => {
        activeAccountIdRef.current = activeAccount?.id;
    }, [activeAccount]);

    // Auto-refresh tokens on startup
    useEffect(() => {
        const refreshTokens = async () => {
            // Prevent double refresh (Strict Mode)
            if (hasRefreshedRef.current || !window.electronAPI?.microsoftRefresh) return;

            const accountsToRefresh = accounts.filter(a => a.type === 'Microsoft' && a.refreshToken);
            if (accountsToRefresh.length === 0) return;

            // Mark as running
            hasRefreshedRef.current = true;
            setIsRefreshing(true);
            console.log(`[Auth] Attempting to refresh ${accountsToRefresh.length} accounts sequentially...`);

            let updatesMade = false;
            let currentAccounts = [...accounts]; // Local copy to update incrementally if needed

            // Sequential Loop
            for (const acc of accountsToRefresh) {
                try {
                    console.log(`[Auth] Refreshing: ${acc.name}`);
                    const result = await window.electronAPI.microsoftRefresh(acc.refreshToken);

                    if (result.success && result.account) {
                        console.log(`[Auth] Success: ${acc.name}`);
                        // Update local copy
                        const idx = currentAccounts.findIndex(a => a.id === acc.id);
                        if (idx !== -1) {
                            currentAccounts[idx] = { ...currentAccounts[idx], ...result.account };
                            updatesMade = true;
                        }
                    } else {
                        console.warn(`[Auth] Failed to refresh ${acc.name}:`, result.error);
                    }

                    // Delay between requests to avoid Rate Limiting (TOO_MANY_REQUESTS)
                    if (accountsToRefresh.length > 1) {
                        await new Promise(r => setTimeout(r, 1500));
                    }
                } catch (e) {
                    console.error(`[Auth] Error refreshing ${acc.name}:`, e);
                }
            }

            if (updatesMade) {
                setAccounts(currentAccounts);
                localStorage.setItem('craftcorps_accounts', JSON.stringify(currentAccounts));

                // Update active account if matches ref
                if (activeAccountIdRef.current) {
                    const updatedActive = currentAccounts.find(a => a.id === activeAccountIdRef.current);
                    if (updatedActive) {
                        setActiveAccount(updatedActive);
                        localStorage.setItem('craftcorps_active_account', JSON.stringify(updatedActive));
                    }
                }
                console.log(`[Auth] Refresh cycle complete. Updates made.`);
            } else {
                console.log(`[Auth] Refresh cycle complete. No updates.`);
            }

            // Keep visible briefly
            setTimeout(() => setIsRefreshing(false), 500);
        };

        refreshTokens();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount

    const handleAccountSwitch = (account) => {
        setActiveAccount(account);
        localStorage.setItem('craftcorps_active_account', JSON.stringify(account));
        setShowProfileMenu(false);
    };

    const handleAddAccount = (newAccount) => {
        const updatedAccounts = [...accounts, { ...newAccount, id: `acc_${Date.now()}` }];
        setAccounts(updatedAccounts);
        localStorage.setItem('craftcorps_accounts', JSON.stringify(updatedAccounts));

        // Auto-select if first account
        if (updatedAccounts.length === 1 || !activeAccount) {
            setActiveAccount(updatedAccounts[0]);
            localStorage.setItem('craftcorps_active_account', JSON.stringify(updatedAccounts[0]));
        } else {
            setActiveAccount(updatedAccounts[updatedAccounts.length - 1]);
            localStorage.setItem('craftcorps_active_account', JSON.stringify(updatedAccounts[updatedAccounts.length - 1]));
        }
        setShowLoginModal(false);
    };

    const handleLogout = () => {
        if (!activeAccount) return;
        const newAccounts = accounts.filter(a => a.id !== activeAccount.id);
        setAccounts(newAccounts);
        localStorage.setItem('craftcorps_accounts', JSON.stringify(newAccounts));

        const nextAccount = newAccounts.length > 0 ? newAccounts[0] : null;
        setActiveAccount(nextAccount);
        if (nextAccount) {
            localStorage.setItem('craftcorps_active_account', JSON.stringify(nextAccount));
        } else {
            localStorage.removeItem('craftcorps_active_account');
        }
        setShowProfileMenu(false);
    };

    return {
        accounts,
        activeAccount,
        setActiveAccount,
        showProfileMenu,
        setShowProfileMenu,
        showLoginModal,
        setShowLoginModal,
        handleAccountSwitch,
        handleAddAccount,
        handleLogout,
        isRefreshing
    };
};
