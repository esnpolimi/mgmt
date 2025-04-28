import React, {useState, useCallback} from 'react';
import {Box, IconButton, Typography} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import LogoutButton from '../LogoutButton';
import ProfileModal from './ProfileModal';

export default function ProfileSidebarBox({user}) {
    const [modalOpen, setModalOpen] = useState(false);

    const handleProfileOpen = useCallback(() => {
        setModalOpen(true);
    }, []);

    const handleProfileClose = useCallback((e) => {
        setModalOpen(false);
    }, []);

    const updateProfile = useCallback((newData) => {
        user = {...user, profile: newData};
    }, [user]);

    return (
        <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px'}}>
            <IconButton onClick={handleProfileOpen} aria-label="Profile">
                <PersonIcon/>
            </IconButton>
            <Box sx={{flexGrow: 1, marginLeft: '10px'}}>
                <Typography variant="body2">
                    {user.profile.name} {user.profile.surname} ({user.groups[0]})
                </Typography>
                <LogoutButton/>
            </Box>
            <ProfileModal
                inProfile={user.profile}
                profileType={"ESNer - " + user.groups[0]}
                open={modalOpen}
                handleClose={handleProfileClose}
                updateProfile={updateProfile}
            />
        </Box>
    );
}