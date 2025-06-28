import React, {useCallback} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {Box, Drawer, List, ListItem, ListItemIcon, ListItemText, ListItemButton, IconButton, Collapse, Typography} from '@mui/material';
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
import LogoutButton from './LogoutButton';
import {useAuth} from "../Context/AuthContext";
import {useSidebar} from "../Context/SidebarContext";


export default function Sidebar() {
    const {isDrawerOpen, toggleDrawer, closeDrawer, expandedSection, handleExpand} = useSidebar();
    const {user} = useAuth();
    const navigate = useNavigate();

    // Helper function to check permissions
    const hasPermission = (permission) => {
        return user?.permissions?.includes(permission) || false;
    };

    const menuItems = [
        {text: "Home", icon: <HomeIcon/>, path: "/"},
        {text: "Tesoreria", icon: <AccountBalanceIcon/>, path: "/treasury", requiredPermission: "change_account"},
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

    // Inline ProfileSidebarBox logic here
    const handleProfileOpen = useCallback(() => {
        navigate(`/profile/${user.profile.id.toString()}`);
    }, [navigate, user?.profile?.id]);

    const handleNavClick = (e) => {
        if (e.button === 0 || e.button === 1) { // left or middle click
            closeDrawer();
        }
    };

    const drawer = (
        <Box sx={{
            width: 250,
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}
             role="presentation"
             onClick={toggleDrawer(false)}
             onKeyDown={toggleDrawer(false)}>
            <Box sx={{flexGrow: 1}}>
                {menuItems.map((item) => (
                    <React.Fragment key={item.text}>
                        {!item.children ? (
                            <ListItem component={Link}
                                      to={item.path}
                                      key={item.text}
                                      onClick={handleNavClick}
                                      onAuxClick={handleNavClick}>
                                <ListItemIcon>{item.icon}</ListItemIcon>
                                <ListItemText primary={item.text} slotProps={{primary: {style: {color: "black"},}}}/>
                            </ListItem>
                        ) : (
                            <React.Fragment key={item.text}>
                                <ListItemButton onClick={(e) => {
                                    e.stopPropagation(); // Prevent drawer from closing
                                    handleExpand(item.text);
                                }}>
                                    <ListItemIcon>{item.icon}</ListItemIcon>
                                    <ListItemText primary={item.text} slotProps={{primary: {style: {color: "black"},}}}/>
                                    {expandedSection === item.text ? <ExpandLess/> : <ExpandMore/>}
                                </ListItemButton>
                                <Collapse in={expandedSection === item.text} timeout="auto" unmountOnExit>
                                    <List component="div" disablePadding>
                                        {item.children?.map((child) => (
                                            <ListItem component={Link}
                                                      to={child.path}
                                                      key={child.text}
                                                      onClick={handleNavClick}
                                                      onAuxClick={handleNavClick}
                                                      sx={{pl: 4}}>
                                                <ListItemIcon>{child.icon}</ListItemIcon>
                                                <ListItemText primary={child.text} slotProps={{primary: {style: {color: "black"}}}}/>
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
                <Box sx={{mt: 'auto', mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px'}}>
                    <IconButton onClick={handleProfileOpen} aria-label="Profile">
                        <PersonIcon/>
                    </IconButton>
                    <Box sx={{flexGrow: 1, marginLeft: '10px'}}>
                        <Typography variant="body2">
                            {user.profile.name} {user.profile.surname} ({user.groups[0]})
                        </Typography>
                        <LogoutButton/>
                    </Box>
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
                sx={{margin: "10px"}}>
                <MenuIcon/>
            </IconButton>
            <Drawer anchor="left" open={isDrawerOpen} onClose={toggleDrawer(false)}>
                {drawer}
            </Drawer>
        </Box>
    );
}
