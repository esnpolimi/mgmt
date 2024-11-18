import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import {Box, Drawer, List, ListItem, ListItemIcon, ListItemText, IconButton, Typography, Button} from '@mui/material';
import {Menu as MenuIcon, Home as HomeIcon, AccountCircle as AccountCircleIcon, Settings as SettingsIcon} from '@mui/icons-material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'; // Treasury icon
import EventIcon from '@mui/icons-material/Event'; // Events icon
import PersonIcon from '@mui/icons-material/Person';
import Logout from "../Pages/Logout";
// ErasmusProfiles icon

export default function Sidebar() {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const toggleDrawer = (open) => () => {
        setIsDrawerOpen(open);
    };

    const menuItems = [
        {text: 'Home', icon: <HomeIcon/>, path: '/'},
        {text: 'Treasury', icon: <AccountBalanceIcon/>, path: '/treasury'},
        {text: 'Events', icon: <EventIcon/>, path: '/events'},
        {text: 'Erasmus Profiles', icon: <PersonIcon/>, path: '/erasmus_profiles'},
        {text: 'ESNers Profiles', icon: <PersonIcon/>, path: '/esners_profiles'},
    ];

    const drawer = (
            <Box
                sx={{width: 250}}
                role="presentation"
                onClick={toggleDrawer(false)}
                onKeyDown={toggleDrawer(false)}
            >
                <List>
                    {menuItems.map((item, index) => (
                        <ListItem component={Link} to={item.path} key={index}>
                            <ListItemIcon>
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText primary={item.text}/>
                        </ListItem>
                    ))}
                    <Box>
                        <Logout/>
                    </Box>
                </List>
            </Box>
        )
    ;

    return (
        <Box sx={{display: 'flex'}}>
            <IconButton
                edge="start"
                color="inherit"
                aria-label="menu"
                onClick={toggleDrawer(true)}
                sx={{margin: '10px'}}
            >
                <MenuIcon/>
            </IconButton>
            <Drawer anchor="left" open={isDrawerOpen} onClose={toggleDrawer(false)}>
                {drawer}
            </Drawer>
        </Box>
    );
}
