import React, {createContext, useContext, useState, useEffect} from 'react';

const SidebarContext = createContext();

export function SidebarProvider({children}) {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [expandedSection, setExpandedSection] = useState(null);

    // Optional: Save state to localStorage
    useEffect(() => {
        const savedDrawerState = localStorage.getItem('sidebarDrawerState');
        if (savedDrawerState) {
            setIsDrawerOpen(JSON.parse(savedDrawerState));
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('sidebarDrawerState', JSON.stringify(isDrawerOpen));
    }, [isDrawerOpen]);

    const toggleDrawer = (open) => (event) => {
        if (event && event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
            return;
        }
        setIsDrawerOpen(open);
    };

    const handleExpand = (section) => {
        setExpandedSection((prevSection) => prevSection === section ? null : section);
    };

    return (
        <SidebarContext.Provider value={{
            isDrawerOpen,
            toggleDrawer,
            expandedSection,
            handleExpand
        }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    return useContext(SidebarContext);
}