import React from 'react';
import {Link} from 'react-router-dom';
import {Box, Drawer, List, ListItem, ListItemIcon, ListItemText, ListItemButton, IconButton, Collapse} from '@mui/material';
import {
    Menu as MenuIcon,
    Home as HomeIcon,
    AccountBalance as AccountBalanceIcon,
    Event as EventIcon,
    Person as PersonIcon,
    Snowboarding as SnowboardingIcon,
    BabyChangingStation as BabyChangingStationIcon,
    ExpandLess,
    ExpandMore,
} from "@mui/icons-material";
import ProfileSidebarBox from './profiles/ProfileSidebarBox';
import {useAuth} from "../Context/AuthContext";
import {useSidebar} from "../Context/SidebarContext";


export default function Sidebar() {
    const {isDrawerOpen, toggleDrawer, expandedSection, handleExpand} = useSidebar();
    const {user} = useAuth();

    // Helper function to check permissions
    const hasPermission = (permission) => {
        return user?.permissions?.includes(permission) || false;
    };

    const menuItems = [
        {text: "Home", icon: <HomeIcon/>, path: "/"},
        {
            text: "Tesoreria",
            icon: <AccountBalanceIcon/>,
            path: "/treasury",
            requiredPermission: "change_account"
        },
        {text: "Eventi", icon: <EventIcon/>, path: "/events"},
        {
            text: "Profili",
            icon: <PersonIcon/>,
            children: [
                {text: 'Erasmus', icon: <SnowboardingIcon/>, path: '/profiles/erasmus'},
                {text: 'ESNers', icon: <BabyChangingStationIcon/>, path: '/profiles/esners'},
            ],
        },
    ].filter(item => !item.requiredPermission || hasPermission(item.requiredPermission));

    const drawer = (
        <Box
            sx={{
                width: 250,
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
            }}
            role="presentation"
            onClick={toggleDrawer(false)}
            onKeyDown={toggleDrawer(false)}
        >
            <Box sx={{flexGrow: 1}}>
                {menuItems.map((item) => (
                    <React.Fragment key={item.text}>
                        {!item.children ? (
                            <ListItem component={Link} to={item.path} key={item.text}>
                                <ListItemIcon>{item.icon}</ListItemIcon>
                                <ListItemText
                                    primary={item.text}
                                    slotProps={{primary: {style: {color: "black"},}}}
                                />
                            </ListItem>
                        ) : (
                            <React.Fragment key={item.text}>
                                <ListItemButton onClick={(e) => {
                                    e.stopPropagation(); // Prevent drawer from closing
                                    handleExpand(item.text);
                                }}>
                                    <ListItemIcon>{item.icon}</ListItemIcon>
                                    <ListItemText
                                        primary={item.text}
                                        slotProps={{primary: {style: {color: "black"},}}}
                                    />
                                    {expandedSection === item.text ? <ExpandLess/> : <ExpandMore/>}
                                </ListItemButton>
                                <Collapse
                                    in={expandedSection === item.text}
                                    timeout="auto"
                                    unmountOnExit
                                >
                                    <List component="div" disablePadding>
                                        {item.children?.map((child) => (
                                            <ListItem
                                                component={Link}
                                                to={child.path}
                                                key={child.text}
                                                sx={{pl: 4}}
                                            >
                                                <ListItemIcon>{child.icon}</ListItemIcon>
                                                <ListItemText
                                                    primary={child.text}
                                                    slotProps={{primary: {style: {color: "black"},}}}
                                                />
                                            </ListItem>
                                        )) || []}
                                    </List>
                                </Collapse>
                            </React.Fragment>
                        )}
                    </React.Fragment>
                ))}
            </Box>
            {user && (
                <Box sx={{mt: 'auto', mb: 2}}>
                    <ProfileSidebarBox user={user}/>
                </Box>
            )}
        </Box>
    );

    return (
        <Box sx={{display: "flex"}}>
            <IconButton
                edge="start"
                color="inherit"
                aria-label="menu"
                onClick={toggleDrawer(true)}
                sx={{margin: "10px"}}
            >
                <MenuIcon/>
            </IconButton>
            <Drawer anchor="left" open={isDrawerOpen} onClose={toggleDrawer(false)}>
                {drawer}
            </Drawer>
        </Box>
    );
}

