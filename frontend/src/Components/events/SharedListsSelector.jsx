import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Chip,
    Alert,
    CircularProgress,
    List,
    ListItem,
    ListItemText,
    Divider
} from '@mui/material';
import { ContentCopy as CopyIcon, Event as EventIcon } from '@mui/icons-material';
import { fetchCustom, defaultErrorHandler } from '../../api/api';

/**
 * Component to select an existing event and copy its lists to the current event
 * 
 * Props:
 * - open: Boolean - controls dialog visibility
 * - onClose: Function - called when dialog closes
 * - onSelectEvent: Function(eventId, eventName, lists) - called when event is confirmed
 */
export default function SharedListsSelector({ open, onClose, onSelectEvent }) {
    const [loading, setLoading] = useState(false);
    const [availableEvents, setAvailableEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [selectedEventData, setSelectedEventData] = useState(null);
    const [error, setError] = useState('');

    // Fetch available events when dialog opens
    useEffect(() => {
        if (open) {
            fetchAvailableEvents();
        }
    }, [open]);

    const fetchAvailableEvents = () => {
        setLoading(true);
        setError('');
        
        fetchCustom('GET', '/available-for-sharing/', {
            auth: true,
            onSuccess: (data) => {
                setAvailableEvents(data);
                setLoading(false);
            },
            onError: (error) => {
                console.error('Error loading events:', error);
                setError('Errore nel caricamento degli eventi disponibili');
                setLoading(false);
            }
        });
    };

    const handleEventSelect = (eventId) => {
        setSelectedEventId(eventId);
        
        // Find the selected event data
        const eventData = availableEvents.find(e => e.id === eventId);
        setSelectedEventData(eventData);
    };

    const handleConfirm = () => {
        if (selectedEventData) {
            onSelectEvent(
                selectedEventData.id,
                selectedEventData.name,
                selectedEventData.lists
            );
        }
        handleClose();
    };

    const handleClose = () => {
        setSelectedEventId('');
        setSelectedEventData(null);
        setError('');
        onClose();
    };

    const getTotalCapacity = (lists) => {
        return lists.reduce((sum, list) => sum + list.capacity, 0);
    };

    const getTotalSubscriptions = (lists) => {
        return lists.reduce((sum, list) => sum + list.subscription_count, 0);
    };

    return (
        <Dialog 
            open={open} 
            onClose={handleClose}
            maxWidth="md"
            fullWidth
        >
            <DialogTitle>
                <Box display="flex" alignItems="center">
                    <CopyIcon sx={{ mr: 1 }} />
                    Usa Liste da Evento Esistente
                </Box>
            </DialogTitle>

            <DialogContent>
                {loading ? (
                    <Box display="flex" justifyContent="center" p={3}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {error}
                            </Alert>
                        )}

                        <Alert severity="info" sx={{ mb: 2 }}>
                            <Typography variant="body2">
                                Seleziona un evento esistente per utilizzare le sue liste.
                                Le liste saranno <strong>condivise</strong>: modifiche e capacità 
                                saranno sincronizzate tra tutti gli eventi.
                            </Typography>
                        </Alert>

                        <FormControl fullWidth sx={{ mb: 3 }}>
                            <InputLabel>Seleziona Evento</InputLabel>
                            <Select
                                value={selectedEventId}
                                onChange={(e) => handleEventSelect(e.target.value)}
                                label="Seleziona Evento"
                            >
                                {availableEvents.map((event) => (
                                    <MenuItem key={event.id} value={event.id}>
                                        <Box display="flex" alignItems="center" width="100%">
                                            <EventIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
                                            <Typography variant="body1" sx={{ flexGrow: 1 }}>
                                                {event.name}
                                            </Typography>
                                            <Chip 
                                                label={`${event.lists_count} liste`} 
                                                size="small" 
                                                sx={{ ml: 1 }}
                                            />
                                        </Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {selectedEventData && (
                            <Box 
                                sx={{ 
                                    border: '1px solid #e0e0e0', 
                                    borderRadius: 1, 
                                    p: 2,
                                    backgroundColor: '#f9f9f9'
                                }}
                            >
                                <Typography variant="h6" gutterBottom>
                                    Preview Liste
                                </Typography>

                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Evento: <strong>{selectedEventData.name}</strong>
                                </Typography>

                                <Box sx={{ mb: 2 }}>
                                    <Chip 
                                        label={`${selectedEventData.lists_count} liste totali`}
                                        color="primary"
                                        size="small"
                                        sx={{ mr: 1 }}
                                    />
                                    <Chip 
                                        label={`${getTotalCapacity(selectedEventData.lists)} posti totali`}
                                        size="small"
                                        sx={{ mr: 1 }}
                                    />
                                    <Chip 
                                        label={`${getTotalSubscriptions(selectedEventData.lists)} iscrizioni`}
                                        size="small"
                                    />
                                </Box>

                                <Divider sx={{ my: 2 }} />

                                <List dense>
                                    {selectedEventData.lists.map((list, index) => (
                                        <ListItem key={list.id || index}>
                                            <ListItemText
                                                primary={
                                                    <Box display="flex" alignItems="center">
                                                        <Typography variant="body1">
                                                            {list.name}
                                                        </Typography>
                                                        {list.is_main_list && (
                                                            <Chip 
                                                                label="Main" 
                                                                size="small" 
                                                                color="success"
                                                                sx={{ ml: 1, height: 20 }}
                                                            />
                                                        )}
                                                        {list.is_waiting_list && (
                                                            <Chip 
                                                                label="Waiting" 
                                                                size="small" 
                                                                color="warning"
                                                                sx={{ ml: 1, height: 20 }}
                                                            />
                                                        )}
                                                    </Box>
                                                }
                                                secondary={
                                                    <Typography variant="body2" color="text.secondary">
                                                        Capacità: {list.capacity === 0 ? 'Illimitata' : `${list.subscription_count}/${list.capacity}`}
                                                        {' '}
                                                        (Disponibili: {list.available_capacity === null ? '∞' : list.available_capacity})
                                                    </Typography>
                                                }
                                            />
                                        </ListItem>
                                    ))}
                                </List>

                                <Alert severity="warning" sx={{ mt: 2 }}>
                                    <Typography variant="body2">
                                        ⚠️ Le liste saranno <strong>condivise</strong> tra gli eventi. 
                                        Le iscrizioni e la capacità saranno comuni.
                                    </Typography>
                                </Alert>
                            </Box>
                        )}
                    </>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose}>
                    Annulla
                </Button>
                <Button 
                    onClick={handleConfirm}
                    variant="contained"
                    disabled={!selectedEventId || loading}
                    startIcon={<CopyIcon />}
                >
                    Usa Queste Liste
                </Button>
            </DialogActions>
        </Dialog>
    );
}
