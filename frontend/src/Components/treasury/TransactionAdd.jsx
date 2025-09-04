import React, {useState, useEffect} from 'react';
import {Button, TextField, FormControl, InputLabel, Select, MenuItem, Typography, IconButton, Box, Modal, Grid} from '@mui/material';
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

    const [formData, setFormData] = useState({
        amount: '',
        type: 'deposit',
        description: ''
    });

    useEffect(() => {
        if (open) {
            setFormData({
                amount: '',
                type: 'deposit',
                description: `${eventId ? 'Transazione manuale - ' + eventName : ''}`
            });
            setReceiptFile(null);
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
        setSubmitting(true);
        const manualAmount = formData.type === 'deposit' ? Math.abs(formData.amount) : -Math.abs(formData.amount);

        let body;
        if (receiptFile) {
            body = new FormData();
            body.append('account', selectedAccount);
            body.append('amount', manualAmount);
            body.append('description', formData.description);
            body.append('type', formData.type);
            body.append('executor', user.profile.email);
            if (eventId) body.append('event_reference_manual', eventId);
            body.append('receiptFile', receiptFile);
        } else {
            body = {
                account: selectedAccount,
                amount: manualAmount,
                description: formData.description,
                type: formData.type,
                executor: user.profile.email,
                event_reference_manual: eventId || null
            };
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
