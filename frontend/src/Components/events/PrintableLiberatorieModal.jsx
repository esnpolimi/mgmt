import React, {useEffect, useState} from 'react';
import {
    Modal, Box, Typography, Button, IconButton, Grid, Checkbox, Paper, CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Loader from "../Loader";
import Popup from "../Popup";
import {fetchCustom, defaultErrorHandler} from "../../api/api";
import {styleESNcardModal as style} from "../../utils/sharedStyles";

export default function PrintableLiberatorieModal({open, onClose, event, listId}) {
    const [isLoading, setLoading] = useState(true);
    const [subscriptions, setSubscriptions] = useState([]);
    const [selectedSubs, setSelectedSubs] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [popup, setPopup] = useState(null);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        setPopup(null);
        setSelectedSubs([]);
        fetchCustom("GET", `/event/${event.id}/printable_liberatorie/?list=${listId}`, {
            onSuccess: (data) => {
                setSubscriptions(data);
                setSelectedSubs(data.map(s => s.id));
            },
            onError: (err) => defaultErrorHandler(err, setPopup),
            onFinally: () => setLoading(false)
        });
    }, [open, event.id, listId]);

    const handleSelectAll = (e) => {
        setSelectedSubs(e.target.checked ? subscriptions.map(s => s.id) : []);
    };

    const handleSelectSub = (id) => {
        setSelectedSubs(selectedSubs.includes(id)
            ? selectedSubs.filter(sid => sid !== id)
            : [...selectedSubs, id]);
    };

    const handleSubmit = () => {
        setSubmitting(true);
        setPopup(null);

        fetchCustom("POST", "/generate_liberatorie_pdf/", {
            body: {
                event_id: event.id,
                subscription_ids: selectedSubs
            },
            onSuccess: (response) => {
                response.blob().then(blob => {
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    const disposition = response.headers.get('Content-Disposition');
                    let filename = `ESNPolimi_Liberatoria_${event.name}.pdf`;
                    if (disposition && disposition.indexOf('attachment') !== -1) {
                        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                        const matches = filenameRegex.exec(disposition);
                        if (matches != null && matches[1]) {
                            filename = matches[1].replace(/['"]/g, '');
                        }
                    }
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                    onClose(true);
                });
            },
            onError: (err) => defaultErrorHandler(err, setPopup),
            onFinally: () => setSubmitting(false)
        });
    };

    return (
        <Modal open={open} onClose={() => onClose(false)}>
            <Box sx={style}>
                {isLoading ? <Loader/> : (
                    <>
                        <Box sx={{display: 'flex', justifyContent: 'flex-end', mt: -2}}>
                            <IconButton onClick={() => onClose(false)} sx={{minWidth: 0}}><CloseIcon/></IconButton>
                        </Box>
                        <Typography variant="h4" component="h2" gutterBottom align="center">
                            Stampa Liberatorie
                        </Typography>
                        <Grid container spacing={2} sx={{mt: 1}}>
                            <Grid size={{xs: 12}}>
                                <Typography variant="subtitle1" sx={{mb: 1}}>
                                    Iscrizioni con quota pagata trovate: {subscriptions.length}
                                </Typography>
                                <Paper elevation={1}
                                       sx={{
                                           maxHeight: 260,
                                           overflowY: 'auto',
                                           p: 1,
                                           mb: 0,
                                           background: "#fafbfc"
                                       }}>
                                    <Box sx={{display: 'flex', alignItems: 'center', mb: 1, pl: 0.5}}>
                                        <Checkbox size="small"
                                                  checked={selectedSubs.length === subscriptions.length && subscriptions.length > 0}
                                                  onChange={handleSelectAll}
                                                  disabled={subscriptions.length === 0}/>
                                        <Typography variant="body2" sx={{fontWeight: 500}}>
                                            Seleziona tutte
                                        </Typography>
                                    </Box>
                                    {subscriptions.map(sub => (
                                        <Box key={sub.id}
                                             sx={{
                                                 display: 'flex',
                                                 alignItems: 'center',
                                                 borderBottom: '1px solid #eee',
                                                 py: 0.5,
                                                 px: 0.5,
                                                 mb: 0.5
                                             }}>
                                            <Checkbox
                                                size="small"
                                                checked={selectedSubs.includes(sub.id)}
                                                onChange={() => handleSelectSub(sub.id)}
                                            />
                                            <Typography sx={{flex: 1, fontSize: 15}}>
                                                {sub.profile_name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ml: 2}}>
                                                {sub.account_name ? `Cassa: ${sub.account_name}` : "Cassa: -"}
                                            </Typography>
                                        </Box>
                                    ))}
                                    {subscriptions.length === 0 && (
                                        <Typography color="text.secondary" sx={{mt: 2}}>
                                            Nessuna iscrizione trovata.
                                        </Typography>
                                    )}
                                </Paper>
                            </Grid>
                            <Grid size={{xs: 12}}>
                                <Box sx={{display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2}}>
                                    <Button variant="contained"
                                            color="info"
                                            fullWidth
                                            onClick={handleSubmit}
                                            disabled={submitting || subscriptions.length === 0 || selectedSubs.length === 0}
                                            startIcon={submitting ? <CircularProgress size={20}/> : null}>
                                        Stampa Liberatorie Selezionate
                                    </Button>
                                </Box>
                            </Grid>
                        </Grid>
                        {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
                    </>
                )}
            </Box>
        </Modal>
    );
}
