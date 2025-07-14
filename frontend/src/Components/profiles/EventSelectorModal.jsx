import {Modal, Box, Typography, FormControl, InputLabel, Select, MenuItem, Button} from "@mui/material";
import {useState, useEffect} from "react";
import {fetchCustom, defaultErrorHandler} from "../../api/api";
import Popup from "../Popup";
import Loader from "../Loader";

export default function EventSelectorModal({open, onSelect, onClose}) {
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [selectedListId, setSelectedListId] = useState("");
    const [loading, setLoading] = useState(false);
    const [eventLoading, setEventLoading] = useState(false);
    const [error, setError] = useState(null);
    const [eventDetails, setEventDetails] = useState(null);

    useEffect(() => {
        if (open) {
            setLoading(true);
            setSelectedEventId("");
            setSelectedListId("");
            setEventDetails(null);
            setError(null);
            fetchCustom("GET", "/events/?status=open", {
                onSuccess: (results) => setEvents(results || []),
                onError: (err) => defaultErrorHandler(err, setError),
                onFinally: () => setLoading(false)
            });
        }
    }, [open]);

    // Fetch event details (with lists) when an event is selected
    useEffect(() => {
        if (selectedEventId) {
            setEventLoading(true);
            setEventDetails(null);
            setSelectedListId("");
            fetchCustom("GET", `/event/${selectedEventId}/`, {
                onSuccess: (json) => setEventDetails(json),
                onError: (err) => defaultErrorHandler(err, setError),
                onFinally: () => setEventLoading(false)
            });
        }
    }, [selectedEventId]);

    const handleEventChange = (e) => {
        setSelectedEventId(e.target.value);
    };

    const handleListChange = (e) => {
        setSelectedListId(e.target.value);
    };

    const handleConfirm = () => {
        if (eventDetails && selectedListId) {
            // Attach the selected list to the event object for SubscriptionModal
            const selectedList = eventDetails.lists.find(list => list.id === selectedListId);
            onSelect({
                ...eventDetails,
                selectedList: selectedList
            });
        }
    };

    return (
        <Modal open={open} onClose={onClose}>
            <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                bgcolor: 'background.paper',
                boxShadow: 24,
                p: 4,
                minWidth: 300,
                borderRadius: 2
            }}>
                <Typography variant="h6" align="center" sx={{mb: 2}}>Seleziona Evento</Typography>
                {loading ? (
                    <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 80}}>
                        <Loader/>
                    </Box>
                ) : error ? (<Popup message={error} state="error"/>) : (<>
                        <FormControl fullWidth sx={{mb: 2}}>
                            <InputLabel id="event-select-label">Evento</InputLabel>
                            <Select variant="outlined"
                                    labelId="event-select-label"
                                    value={selectedEventId}
                                    label="Evento"
                                    onChange={handleEventChange}>
                                {(events && typeof events.map === "function")
                                    ? events.map(ev => (
                                        <MenuItem key={ev.id} value={ev.id}>{ev.name}</MenuItem>
                                    ))
                                    : null}
                            </Select>
                        </FormControl>
                        {eventLoading && (
                            <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 60}}>
                                <Loader/>
                            </Box>
                        )}
                        {eventDetails && (
                            <FormControl fullWidth sx={{mb: 2}}>
                                <InputLabel id="list-select-label">Lista</InputLabel>
                                <Select variant="outlined"
                                        labelId="list-select-label"
                                        value={selectedListId}
                                        label="Lista"
                                        onChange={handleListChange}>
                                    {eventDetails.lists.map(list => {
                                        const isFull = list.capacity !== null && list.capacity > 0 && list.subscription_count >= list.capacity;
                                        return (
                                            <MenuItem key={list.id}
                                                      value={list.id}
                                                      disabled={isFull}
                                                      style={isFull ? {color: 'grey'} : {}}>
                                                {list.name} {isFull ? "(lista piena)" : ""}
                                            </MenuItem>
                                        );
                                    })}
                                </Select>
                            </FormControl>
                        )}
                        <Button sx={{mt: 2}}
                                fullWidth
                                variant="contained"
                                disabled={!selectedEventId || !selectedListId}
                                onClick={handleConfirm}>
                            Conferma
                        </Button>
                        <Button sx={{mt: 1}} fullWidth onClick={onClose}>
                            Annulla
                        </Button>
                    </>
                )}
            </Box>
        </Modal>
    );
}
