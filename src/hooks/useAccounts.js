import { useState } from 'react';

export const useAccounts = () => {
    const [accounts, setAccounts] = useState(() => {
        try {
            const saved = localStorage.getItem('craftcrops_accounts');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error("Failed to load accounts", e);
            return [];
        }
    });

    const [activeAccount, setActiveAccount] = useState(() => {
        try {
            const saved = localStorage.getItem('craftcrops_active_account');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    });

    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);

    const handleAccountSwitch = (account) => {
        setActiveAccount(account);
        localStorage.setItem('craftcrops_active_account', JSON.stringify(account));
        setShowProfileMenu(false);
    };

    const handleAddAccount = (newAccount) => {
        const updatedAccounts = [...accounts, { ...newAccount, id: `acc_${Date.now()}` }];
        setAccounts(updatedAccounts);
        localStorage.setItem('craftcrops_accounts', JSON.stringify(updatedAccounts));

        // Auto-select if first account
        if (updatedAccounts.length === 1 || !activeAccount) {
            setActiveAccount(updatedAccounts[0]);
            localStorage.setItem('craftcrops_active_account', JSON.stringify(updatedAccounts[0]));
        } else {
            setActiveAccount(updatedAccounts[updatedAccounts.length - 1]);
            localStorage.setItem('craftcrops_active_account', JSON.stringify(updatedAccounts[updatedAccounts.length - 1]));
        }
        setShowLoginModal(false);
    };

    const handleLogout = () => {
        if (!activeAccount) return;
        const newAccounts = accounts.filter(a => a.id !== activeAccount.id);
        setAccounts(newAccounts);
        localStorage.setItem('craftcrops_accounts', JSON.stringify(newAccounts));

        const nextAccount = newAccounts.length > 0 ? newAccounts[0] : null;
        setActiveAccount(nextAccount);
        if (nextAccount) {
            localStorage.setItem('craftcrops_active_account', JSON.stringify(nextAccount));
        } else {
            localStorage.removeItem('craftcrops_active_account');
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
        handleLogout
    };
};
