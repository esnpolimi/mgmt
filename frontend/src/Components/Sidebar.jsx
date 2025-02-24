import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import {Box, Drawer, List, ListItem, ListItemIcon, ListItemText, IconButton, Collapse} from '@mui/material';
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
import ProfileSidebarBox from './ProfileSidebarBox';
import {useAuth} from "../Context/AuthContext";


export default function Sidebar() {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [expandedSection, setExpandedSection] = useState(null);
    const {user} = useAuth();

    const toggleDrawer = (open) => () => {
        setIsDrawerOpen(open);
    };

    const menuItems = [
        {text: "Home", icon: <HomeIcon/>, path: "/"},
        {text: "Tesoreria", icon: <AccountBalanceIcon/>, path: "/treasury"},
        {text: "Eventi", icon: <EventIcon/>, path: "/events"},
        {
            text: "Profili",
            icon: <PersonIcon/>,
            children: [
                {text: 'Erasmus', icon: <SnowboardingIcon/>, path: '/erasmus_profiles'},
                {text: 'ESNers', icon: <BabyChangingStationIcon/>, path: '/esners_profiles'},
            ],
        },
    ];

    const handleExpand = (section) => {
        setExpandedSection((prevSection) =>
            prevSection === section ? null : section
        );
    };


    const drawer = (
        <Box
            sx={{
                width: 250,
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
            }}
            role="presentation"
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
                                <ListItem button="true" onClick={() => handleExpand(item.text)}>
                                    <ListItemIcon>{item.icon}</ListItemIcon>
                                    <ListItemText
                                        primary={item.text}
                                        slotProps={{primary: {style: {color: "black"},}}}
                                    />
                                    {/* Expand/Collapse Icon */}
                                    {expandedSection === item.text ? <ExpandLess/> : <ExpandMore/>}
                                </ListItem>
                                {/* Subsections (e.g., Erasmus, Aspirants, ESNers) */}
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
                                                sx={{pl: 4}} // Ensure padding for hierarchy
                                            >
                                                <ListItemIcon>{child.icon}</ListItemIcon> {/* Add Icon */}
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
            <Box sx={{mt: 'auto', mb: 2}}>
                <ProfileSidebarBox user={user}/>
            </Box>
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
