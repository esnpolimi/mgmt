import {useEffect, useState} from 'react';
import {Modal, Box, Grid, Button, FormControl, InputLabel, Select, MenuItem, TextField, CircularProgress, Typography} from '@mui/material';
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import {fetchCustom} from '../../api/api';
import {extractErrorMessage} from "../../utils/errorHandling";
import Popup from "../Popup";
import * as Sentry from "@sentry/react";


export default function ReimburseModal({open, onClose, requestData, onReimbursed, onSuccess}) {
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [description, setDescription] = useState('');
    const [receiptLink, setReceiptLink] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorPopup, setErrorPopup] = useState(null);

    useEffect(() => {
        if (open) {
            fetchCustom('GET', '/accounts/').then(async res => {
                if (res.ok) {
                    const json = await res.json();
                    setAccounts(json.results || []);
                }
            });
            setSelectedAccount(requestData?.account?.id || '');
            setDescription(requestData?.description || '');
            setReceiptLink(requestData?.receipt_link || '');
        }
    }, [open, requestData]);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const response = await fetchCustom('PATCH', `/reimbursement_request/${requestData.id}/`, {
                account: selectedAccount,
                description: description,
                receipt_link: receiptLink,
                is_reimbursed: true
            });

            if (response.ok) {
                onReimbursed && onReimbursed();
                onSuccess && onSuccess("Rimborso aggiornato con successo!", "success");
                onClose && onClose();
            } else {
                const json = await response.json();
                const error = await extractErrorMessage(json, response.status);
                setErrorPopup({message: `Errore: ${error}`, state: "error"});
            }
        } catch (error) {
            Sentry.captureException(error);
            setErrorPopup({message: `Errore generale: ${error.message}`, state: "error"});
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} aria-labelledby="reimburse-modal-title" fullWidth>
            <Box sx={style}>
                <Box sx={{display: "flex", justifyContent: "flex-end", mb: 0}}>
                    <IconButton onClick={onClose}><CloseIcon/></IconButton>
                </Box>
                <Typography variant="h4" gutterBottom align="center">
                    Modifica / Rimborsa Richiesta
                </Typography>
                <Typography variant="subtitle1" gutterBottom align="center" sx={{mt: 1}}>
                    Stato: <b>
                        {requestData?.is_reimbursed
                            ? <>Rimborsata{requestData?.account?.name ? ` (${requestData.account.name})` : ""}</>
                            : "Non Rimborsata"}
                    </b>
                </Typography>
                <Typography variant="subtitle1" gutterBottom align="center" sx={{mb: 2}}>
                    Importo: <b>€{requestData?.amount}</b>
                </Typography>
                <Grid container spacing={2} direction="column" sx={{mt: 0}}>
                    <Grid size={{xs: 12}}>
                        <FormControl fullWidth sx={{mt: 2}}>
                            <InputLabel id="account-label">Cassa</InputLabel>
                            <Select labelId="account-label"
                                    variant="outlined"
                                    value={selectedAccount}
                                    label="Cassa"
                                    onChange={e => setSelectedAccount(e.target.value)}>
                                {accounts.map(acc => (
                                    <MenuItem key={acc.id}
                                              value={acc.id}
                                              disabled={acc.status === 'closed'}
                                              style={{color: acc.status === 'closed' ? 'grey' : 'inherit'}}>
                                        {acc.name} {acc.status === 'closed' ? '(Chiusa)' : ''}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{xs: 12}}>
                        <TextField label="Descrizione"
                                   fullWidth
                                   value={description}
                                   onChange={e => setDescription(e.target.value)}/>
                    </Grid>
                    <Grid size={{xs: 12}}>
                        <TextField label="Link ricevuta"
                                   fullWidth
                                   value={receiptLink}
                                   onChange={e => setReceiptLink(e.target.value)}/>
                    </Grid>
                </Grid>
                <Button onClick={handleSubmit}
                        variant="contained"
                        disabled={loading}
                        sx={{mt: 2, bgcolor: "#1976d2", "&:hover": {bgcolor: "#1565c0"}}}>
                    {loading ? (<CircularProgress size={24} color="inherit"/>) : (
                        "Modifica / Rimborsa"
                    )}
                </Button>
                {errorPopup && <Popup message={errorPopup.message} state={errorPopup.state}/>}
            </Box>
        </Modal>
    );
}
