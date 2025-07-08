import {useEffect, useState} from 'react';
import {Modal, Box, Button, Typography, FormControl, InputLabel, Select, MenuItem, IconButton} from '@mui/material';
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import {fetchCustom} from "../../api/api";
import {extractErrorMessage} from "../../utils/errorHandling";
import Popup from "../Popup";
import CloseIcon from "@mui/icons-material/Close";
import * as Sentry from "@sentry/react";

export default function MoveToListModal({open, onClose, selectedRows, event, listId}) {
    const [popup, setPopup] = useState(null);
    const [lists, setLists] = useState([]);
    const [selectedListId, setSelectedListId] = useState('');
    const listName = event.lists.find(list => list.id === listId)?.name || 'Lista non trovata';

    useEffect(() => {
        if (event?.lists) {
            // Filter out the current list to avoid moving to the same list
            const availableLists = event.lists.filter(list => list.id !== listId);
            setLists(availableLists);
        }
    }, [event, listId]);

    const handleSubmit = async () => {
        if (!selectedListId) return;
        try {
            const response = await fetchCustom("POST", '/move-subscriptions/', {
                subscriptionIds: selectedRows.map(row => row.original.id),
                targetListId: selectedListId,
            });
            if (!response.ok) {
                const json = await response.json();
                const errorMessage = await extractErrorMessage(json, response.status);
                setPopup({message: `Errore: ${errorMessage}`, state: 'error'});
            } else onClose(true);
        } catch (error) {
            Sentry.captureException(error);
            setPopup({message: `Errore generale: ${error}`, state: "error"});
        }
    };

    return (
        <Modal
            open={open}
            onClose={() => onClose(false)}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
        >
            <Box sx={style}>
                <Box sx={{display: 'flex', justifyContent: 'flex-end'}}>
                    <IconButton onClick={() => onClose(false)} sx={{minWidth: 0}}>
                        <CloseIcon/>
                    </IconButton>
                </Box>
                <Typography variant="h4" component="h3" gutterBottom>
                    Sposta {selectedRows.length} {selectedRows.length === 1 ? "iscrizione" : "iscrizioni"}
                </Typography>
                <Typography variant="body1" id="modal-modal-description" gutterBottom>
                    Lista di origine: {listName}
                </Typography>
                <FormControl fullWidth sx={{mt: 1}}>
                    <InputLabel id="list-select-label">Lista di destinazione</InputLabel>
                    <Select
                        labelId="list-select-label"
                        label="Lista di destinazione"
                        value={selectedListId}
                        onChange={(e) => setSelectedListId(e.target.value)}
                        variant="outlined">
                        {lists.map(list => (
                            <MenuItem key={list.id} value={list.id}>
                                {list.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Button
                    variant="contained"
                    fullWidth
                    sx={{
                        mt: 2,
                        bgcolor: selectedListId ? '#1976d2' : '#9e9e9e',
                        '&:hover': {
                            bgcolor: selectedListId ? '#1565c0' : '#757575',
                        },
                    }}
                    onClick={handleSubmit}
                    disabled={!selectedListId}
                >
                    Conferma
                </Button>
                {popup && <Popup message={popup.message} state={popup.state}/>}
            </Box>
        </Modal>
    );
}