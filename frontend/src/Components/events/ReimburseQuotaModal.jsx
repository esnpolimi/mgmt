import React, {useEffect, useState} from 'react';
import {
    Modal, Box, Typography, Button, IconButton, Grid, TextField, MenuItem, CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Loader from "../Loader";
import ConfirmDialog from "../ConfirmDialog";
import Popup from "../Popup";
import {fetchCustom} from "../../api/api";
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import * as Sentry from "@sentry/react";
import {extractErrorMessage} from "../../utils/errorHandling";

export default function ReimburseQuotaModal({open, onClose, event, subscription}) {
    const [isLoading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({open: false, action: null, message: ''});
    const [popup, setPopup] = useState(null);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        setPopup(null);
        setSelectedAccount('');
        setNotes('');
        const fetchAccounts = async () => {
            try {
                const accResp = await fetchCustom("GET", "/accounts/");
                const accJson = await accResp.json();
                setAccounts(accJson.results || []);
            } catch (e) {
                Sentry.captureException(e);
                setPopup({message: "Errore nel caricamento casse: " + e, state: "error"});
            } finally {
                setLoading(false);
            }
        };
        fetchAccounts().then();
    }, [open]);

    const handleSubmit = async () => {
        setPopup(null);
        if (!selectedAccount) {
            setPopup({message: "Seleziona una cassa.", state: "error"});
            return;
        }
        if (!subscription) {
            setPopup({message: "Iscrizione non trovata.", state: "error"});
            return;
        }
        const quotaAmount = Number(event.cost || 0);
        const message = `Confermi di voler rimborsare €${quotaAmount.toFixed(2)} a ${subscription.profile_name} dalla cassa ${accounts.find(acc => acc.id === selectedAccount)?.name || "N/A"}?`;
        setConfirmDialog({
            open: true,
            action: () => doSubmit(),
            message
        });
    };

    const doSubmit = async () => {
        setConfirmDialog({open: false, action: null, message: ''});
        setSubmitting(true);
        try {
            const response = await fetchCustom("POST", "/reimburse_quota/", {
                event: event.id,
                subscription_id: subscription.id,
                account: selectedAccount,
                notes
            });
            const json = await response.json();
            if (!response.ok) {
                const errorMessage = extractErrorMessage(json, response.status);
                setPopup({message: `Errore nel rimborso: ${errorMessage}`, state: "error"});
            } else {
                onClose(true, 'Rimborso quota effettuato con successo');
            }
        } catch (e) {
            Sentry.captureException(e);
            setPopup({message: "Errore nel rimborso: " + e, state: "error"});
        } finally {
            setSubmitting(false);
        }
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
                            Rimborsa Quota
                        </Typography>
                        <Grid container spacing={1} sx={{mt: 1}}>
                            <Grid size={{xs: 12}}>
                                <Typography>
                                    <b>Importo Quota:</b> €{Number(event.cost || 0).toFixed(2)}
                                </Typography>
                            </Grid>
                            <Grid size={{xs: 12}}>
                                <Typography>
                                    <b>Ricevente:</b> {subscription?.profile_name}
                                </Typography>
                            </Grid>
                            <Grid size={{xs: 12}}>
                                <Typography>
                                    <b>Cassa di pagamento:</b> {subscription?.account_name ? subscription.account_name : "-"}
                                </Typography>
                            </Grid>
                            <Grid size={{xs: 12}}>
                                <TextField select
                                           fullWidth
                                           label="Cassa"
                                           value={selectedAccount}
                                           onChange={e => setSelectedAccount(e.target.value)}
                                           sx={{mt: 1}}>
                                    {accounts.map(acc => (
                                        <MenuItem key={acc.id}
                                                  value={acc.id}
                                                  disabled={acc.status === "closed"}
                                                  style={acc.status === "closed" ? {color: "#aaa"} : {}}>
                                            {acc.name} {acc.status === "closed" ? "(chiusa)" : ""}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid size={{xs: 12}}>
                                <TextField fullWidth
                                           label="Note (opzionale)"
                                           value={notes}
                                           onChange={e => setNotes(e.target.value)}
                                           sx={{mb: 2}}/>
                            </Grid>
                            <Grid size={{xs: 12}}>
                                <Box sx={{display: 'flex', justifyContent: 'flex-end', gap: 2}}>
                                    <Button variant="contained"
                                            color="primary"
                                            fullWidth
                                            onClick={handleSubmit}
                                            disabled={submitting}
                                            startIcon={submitting ? <CircularProgress size={20}/> : null}>
                                        Rimborsa Quota
                                    </Button>
                                </Box>
                            </Grid>
                        </Grid>
                        <ConfirmDialog
                            open={confirmDialog.open}
                            message={confirmDialog.message}
                            onConfirm={confirmDialog.action}
                            onClose={() => setConfirmDialog({open: false, action: null, message: ''})}
                        />
                        {popup && <Popup message={popup.message} state={popup.state}/>}
                    </>
                )}
            </Box>
        </Modal>
    );
}
