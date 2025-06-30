import {createContext, useContext, useState, useEffect} from 'react';

const SidebarContext = createContext(undefined);

export function SidebarProvider({children}) {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [expandedSection, setExpandedSection] = useState(null);

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

    const closeDrawer = () => setIsDrawerOpen(false);

    return (
        <SidebarContext.Provider value={{
            isDrawerOpen,
            toggleDrawer,
            closeDrawer,
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