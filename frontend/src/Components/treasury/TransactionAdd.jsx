import React, {useState, useEffect} from 'react';
import {Button, TextField, FormControl, InputLabel, Select, MenuItem, Typography, IconButton, Box, Modal, Grid, Checkbox, FormControlLabel, FormHelperText} from '@mui/material';
import {defaultErrorHandler, fetchCustom} from '../../api/api';
import CloseIcon from "@mui/icons-material/Close";
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import {useAuth} from "../../Context/AuthContext";
import Popup from "../Popup";
import CircularProgress from "@mui/material/CircularProgress";
import ReceiptFileUpload from "../common/ReceiptFileUpload";

export default function TransactionAdd({open, onClose, account, eventId = null, eventName = null}) {
    const {user} = useAuth();
    const [popup, setPopup] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [receiptFile, setReceiptFile] = useState(null);
    const [isEventRelated, setIsEventRelated] = useState(false);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [events, setEvents] = useState([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [eventError, setEventError] = useState('');

    const [formData, setFormData] = useState({
        amount: '',
        type: 'deposit',
        description: '',
        created_at: ''
    });

    // Fetch events when isEventRelated is checked (only when no eventId prop)
    useEffect(() => {
        if (isEventRelated && !eventId && events.length === 0) {
            setLoadingEvents(true);
            fetchCustom('GET', '/events/', {
                onSuccess: (response) => setEvents(response.results || response || []),
                onError: (err) => defaultErrorHandler(err, setPopup),
                onFinally: () => setLoadingEvents(false)
            });
        }
    }, [isEventRelated]);

    useEffect(() => {
        if (open) {
            setFormData({
                amount: '',
                type: 'deposit',
                description: `${eventId ? 'Transazione manuale - ' + eventName : ''}`,
                created_at: ''
            });
            setReceiptFile(null);
            setIsEventRelated(false);
            setSelectedEventId('');
            setEvents([]);
            setEventError('');
            if (account) {
                setSelectedAccount(account.id);
            } else {
                setSelectedAccount('');
                fetchCustom('GET', '/accounts/', {
                    onSuccess: (data) => setAccounts(data),
                    onError: () => setAccounts([]),
                });
            }
        }
    }, [open, account]);

    const handleSubmit = (e) => {
        e.preventDefault();
        // Validate event selection if checkbox is checked
        if (isEventRelated && !eventId && !selectedEventId) {
            setEventError('Devi selezionare un evento');
            return;
        }
        setSubmitting(true);
        const manualAmount = formData.type === 'deposit' ? Math.abs(formData.amount) : -Math.abs(formData.amount);
        const resolvedEventId = eventId || (isEventRelated ? selectedEventId : null);

        let body;
        if (receiptFile) {
            body = new FormData();
            body.append('account', selectedAccount);
            body.append('amount', manualAmount);
            body.append('description', formData.description);
            body.append('type', formData.type);
            body.append('executor', user.profile.email);
            if (resolvedEventId) body.append('event_reference_manual', resolvedEventId);
            if (formData.created_at) body.append('created_at', new Date(formData.created_at).toISOString());
            body.append('receiptFile', receiptFile);
        } else {
            body = {
                account: selectedAccount,
                amount: manualAmount,
                description: formData.description,
                type: formData.type,
                executor: user.profile.email,
                event_reference_manual: resolvedEventId || null
            };
            if (formData.created_at) body.created_at = new Date(formData.created_at).toISOString();
        }

        fetchCustom('POST', '/transaction/', {
            body,
            onSuccess: () => onClose(true),
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
            onFinally: () => setSubmitting(false)
        });
    };

    return (
        <Modal open={open} onClose={() => onClose(false)}>
            <Box sx={style} component="form" onSubmit={handleSubmit} noValidate>
                <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: -2}}>
                    <IconButton onClick={() => onClose(false)} sx={{minWidth: 0}}> <CloseIcon/> </IconButton>
                </Box>
                <Typography variant="h5" gutterBottom align="center" sx={{mt: 2}}>
                    Transazione Manuale
                </Typography>
                {eventId && (
                    <Typography variant="body1" sx={{mt: 1, fontWeight: 'bold'}}>
                        Evento: <span style={{fontWeight: 'normal'}}>{eventName || `#${eventId}`}</span>
                    </Typography>
                )}
                <Grid container spacing={2} sx={{mt: 2}}>
                    <Grid size={{xs: 12}}>
                        {account ? (
                            <Typography variant="subtitle1">
                                <b>Cassa:</b> {account.name}
                            </Typography>
                        ) : (
                            <FormControl fullWidth>
                                <InputLabel id="account-label">Cassa</InputLabel>
                                <Select
                                    variant="outlined"
                                    labelId="account-label"
                                    value={selectedAccount}
                                    label="Cassa"
                                    onChange={e => setSelectedAccount(e.target.value)}
                                    required
                                >
                                    {accounts.map(acc => (
                                        <MenuItem
                                            key={acc.id}
                                            value={acc.id}
                                            disabled={acc.status === 'closed'}
                                            style={{color: acc.status === 'closed' ? 'grey' : 'inherit'}}
                                        >
                                            {acc.name} {acc.status === 'closed' ? '(Chiusa)' : ''}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                    </Grid>
                    <FormControl fullWidth>
                        <InputLabel>Tipo</InputLabel>
                        <Select
                            variant="outlined"
                            value={formData.type}
                            label="Tipo"
                            onChange={(e) => setFormData({...formData, type: e.target.value})}>
                            <MenuItem value="deposit">Deposito</MenuItem>
                            <MenuItem value="withdrawal">Prelievo</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        margin="dense"
                        label="Importo in € (decimali con punto)"
                        type="number"
                        fullWidth
                        required
                        value={formData.amount}
                        slotProps={{htmlInput: {min: "0.01", step: "0.01"}}}
                        onChange={(e) => setFormData({...formData, amount: e.target.value})}/>
                    <TextField
                        margin="dense"
                        label="Descrizione"
                        type="text"
                        fullWidth
                        required
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}/>
                    <TextField
                        margin="dense"
                        label="Data e Ora (opzionale)"
                        type="datetime-local"
                        fullWidth
                        value={formData.created_at}
                        onChange={(e) => setFormData({...formData, created_at: e.target.value})}
                        slotProps={{
                            inputLabel: {shrink: true}
                        }}
                    />
                    {!eventId && (
                        <>
                            <Grid size={{xs: 12}}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={isEventRelated}
                                            onChange={(e) => {
                                                setIsEventRelated(e.target.checked);
                                                setEventError('');
                                                if (!e.target.checked) setSelectedEventId('');
                                            }}
                                        />
                                    }
                                    label="Transazione relativa a un evento?"
                                />
                            </Grid>
                            {isEventRelated && (
                                <Grid size={{xs: 12}}>
                                    <FormControl fullWidth required error={!!eventError}>
                                        <InputLabel id="event-add-label">Seleziona Evento</InputLabel>
                                        <Select
                                            labelId="event-add-label"
                                            variant="outlined"
                                            value={selectedEventId}
                                            label="Seleziona Evento"
                                            onChange={(e) => {
                                                setSelectedEventId(e.target.value);
                                                setEventError('');
                                            }}
                                            disabled={loadingEvents}
                                        >
                                            {loadingEvents ? (
                                                <MenuItem disabled><CircularProgress size={20}/></MenuItem>
                                            ) : (
                                                events.map((event) => (
                                                    <MenuItem key={event.id} value={event.id}>
                                                        {event.name}{event.date ? ` - ${new Date(event.date).toLocaleDateString('it-IT')}` : ''}
                                                    </MenuItem>
                                                ))
                                            )}
                                        </Select>
                                        {eventError && <FormHelperText>{eventError}</FormHelperText>}
                                    </FormControl>
                                </Grid>
                            )}
                        </>
                    )}
                    <Grid size={{xs: 12}}>
                        <ReceiptFileUpload
                            file={receiptFile}
                            onFileChange={setReceiptFile}
                            label="Carica ricevuta (opzionale)"
                        />
                    </Grid>
                </Grid>
                <Box mt={2}>
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        type="submit"
                        disabled={submitting || !formData.amount || formData.amount <= 0 || !selectedAccount}>
                        {submitting ? <CircularProgress size={24} color="inherit"/> : "Conferma"}
                    </Button>
                </Box>
                {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
            </Box>
        </Modal>
    );
}
