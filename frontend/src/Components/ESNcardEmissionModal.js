import React, { useEffect, useState } from "react";
import Cookies from 'js-cookie';
import { Button, Box, Divider, FormControl, InputLabel, MenuItem, Modal, Select, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export default function ESNCardEmissionModal({ open, profile, onClose }) {

    const style = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400,
        bgcolor: 'background.paper',
        boxShadow: 24,
        p: 4,
        outline: 'none',
        display: 'flex',
        flexDirection: 'column',
    };

    const [accounts, setAccounts] = useState([]);
    const [latestESNcard, setLatestESNcard] = useState({});
    const [amount, setAmount] = useState(0);
    const [selectedAccount, setSelectedAccount] = useState('');

    const handleAccountChange = (event) => {
        setSelectedAccount(event.target.value);
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const accountsResponse = await fetch('http://localhost:8000/accounts/', {
                    credentials: 'include',
                    headers: { 'X-CSRFToken': Cookies.get('csrftoken') },
                });
                if (!accountsResponse.ok) {
                    throw new Error('Error while fetching accounts');
                }
                const accountsJson = await accountsResponse.json();
                console.log('mannaggiaaddio')
                setAccounts(accountsJson.results);
                console.log(accounts)

                const profileResponse = await fetch(`http://localhost:8000/profile/${profile.id}/`, {
                    credentials: 'include',
                    headers: { 'X-CSRFToken': Cookies.get('csrftoken') },
                });
                if (!profileResponse.ok) {
                    throw new Error('Error while fetching profile');
                }
                const profileJson = await profileResponse.json();
                setLatestESNcard(profileJson.esncards.slice(-1)[0]); // Use slice(-1)[0] to get the last element

                if (latestESNcard && latestESNcard.is_valid) {
                    setAmount(2.5);
                } else {
                    setAmount(10.0);
                }
            } catch (error) {
                console.error('Error in fetching data:', error);
            }
        };

        fetchData();
    }, [profile, latestESNcard]); // Ensure dependencies are included in the dependency array

    return (
        <Modal
            open={open}
            onClose={() => { }} // Close modal function
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
        >

            <Box sx={style}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: -2 }}>
                    <Button onClick={onClose} sx={{ minWidth: 0 }}>
                        <CloseIcon />
                    </Button>
                </Box>
                <Typography variant="h4" component="h2" gutterBottom>
                    ESNcard Emission
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle1" gutterBottom>
                    <b>To:</b> {profile.name} {profile.surname}
                </Typography>
                <Typography variant="subtitle1" gutterBottom>
                    <b>Amount:</b> {amount}€
                </Typography>
                <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel htmlFor="account-selector" sx={{ mb: 2 }}>Select Account</InputLabel>
                    <Select
                        labelId="account-selector-label"
                        id="account-selector"
                        value={selectedAccount}
                        onChange={handleAccountChange}
                    >
                        {accounts.map((account) => (
                            <MenuItem key={account.id} value={account.id}>
                                {account.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Button variant="contained" fullWidth sx={{ mt: 2 }} onClick={() => {
                    fetch('http://localhost:8000/esncard_emission/', {
                        credentials: 'include',
                        headers: { 'X-CSRFToken': Cookies.get('csrftoken') },
                    }).then()
                }}>
                    Confirm
                </Button>
            </Box>

        </Modal>
    );
}
