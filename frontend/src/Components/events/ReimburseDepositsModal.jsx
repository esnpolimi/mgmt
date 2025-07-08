import React, {useEffect, useState} from 'react';
import {
    Modal, Box, Typography, Button, IconButton, Grid, Checkbox, FormControlLabel, TextField, MenuItem, Paper, CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Loader from "../Loader";
import StatusBanner from "../StatusBanner";
import ConfirmDialog from "../ConfirmDialog";
import Popup from "../Popup";
import {fetchCustom} from "../../api/api";
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import * as Sentry from "@sentry/react";


export default function ReimburseDepositsModal({open, onClose, event, listId, subscription}) {
    const [isLoading, setLoading] = useState(true);
    const [subscriptions, setSubscriptions] = useState([]);
    const [selectedSubs, setSelectedSubs] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [notes, setNotes] = useState('');
    const [statusMessage, setStatusMessage] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({open: false, action: null, message: ''});
    const [popup, setPopup] = useState(null);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        setStatusMessage(null);
        setSelectedSubs([]);
        setSelectedAccount('');
        setNotes('');
        setPopup(null);

        const fetchAccounts = async () => {
            try {
                const accResp = await fetchCustom("GET", "/accounts/");
                const accJson = await accResp.json();
                setAccounts(accJson.results || []);
            } catch (e) {
                Sentry.captureException(e);
                setStatusMessage({message: "Errore nel caricamento casse: " + e, state: "error"});
            }
        };

        if (subscription) {
            // Single-subscription mode: no need to fetch reimbursable subscriptions
            setSubscriptions([subscription]);
            setSelectedSubs([subscription.id]);
            setLoading(false);
            fetchAccounts().then();
            return;
        }

        const fetchData = async () => {
            try {
                // Fetch reimbursable deposits for this event/list
                const resp = await fetchCustom("GET", `/reimbursable_deposits/?event=${event.id}&list=${listId}`);
                const subs = resp.ok ? await resp.json() : [];
                setSubscriptions(subs);
                setSelectedSubs(subs.map(s => s.id));
                await fetchAccounts();
            } catch (e) {
                Sentry.captureException(e);
                setStatusMessage({message: "Errore nel caricamento dati: " + e, state: "error"});
            } finally {
                setLoading(false);
            }
        };
        fetchData().then();
    }, [open, event.id, listId, subscription]);

    const handleSelectAll = (e) => {
        setSelectedSubs(e.target.checked ? subscriptions.map(s => s.id) : []);
    };

    const handleSelectSub = (id) => {
        setSelectedSubs(selectedSubs.includes(id)
            ? selectedSubs.filter(sid => sid !== id)
            : [...selectedSubs, id]);
    };

    const handleSubmit = async () => {
        setStatusMessage(null);
        if (!selectedAccount) {
            setStatusMessage({message: "Seleziona una cassa.", state: "error"});
            return;
        }
        if (selectedSubs.length === 0) {
            setStatusMessage({message: "Seleziona almeno una iscrizione.", state: "error"});
            return;
        }
        const depositAmount = Number(event.deposit || 0);
        const totalAmount = depositAmount * selectedSubs.length;
        const message = subscription
            ? `Confermi di voler rimborsare €${depositAmount.toFixed(2)} a ${subscription.profile_name} dalla cassa ${accounts.find(acc => acc.id === selectedAccount)?.name || "N/A"}?`
            : `Confermi di voler rimborsare un totale di €${totalAmount.toFixed(2)} (${selectedSubs.length} x €${depositAmount.toFixed(2)}) dalla cassa ${accounts.find(acc => acc.id === selectedAccount)?.name || "N/A"}?`;
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
            const resp = await fetchCustom("POST", "/reimburse_deposits/", {
                event: event.id,
                subscription_ids: selectedSubs,
                account: selectedAccount,
                notes
            });
            const json = await resp.json();
            if (!resp.ok) {
                setStatusMessage({message: json.error || "Errore nel rimborso", state: "error"});
            } else {
                onClose(true, `Rimbors${subscription ? 'o' : 'i'} effettuati con successo!`);
            }
        } catch (e) {
            Sentry.captureException(e);
            setStatusMessage({message: "Errore nel rimborso: " + e, state: "error"});
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
                            Rimborsa Cauzion{subscription ? 'e' : 'i'}
                        </Typography>
                        {statusMessage && <StatusBanner message={statusMessage.message} state={statusMessage.state}/>}
                        <Grid container spacing={2} sx={{mt: 1}}>
                            {subscription ? (
                                <Grid size={{xs: 12}}>
                                    <Typography>
                                        <b>Ricevente:</b> {subscription.profile_name}
                                    </Typography>
                                </Grid>
                            ) : (
                                <>
                                    <Grid size={{xs: 12}}>
                                        <Typography variant="subtitle1" sx={{mb: 1}}>
                                            Iscrizioni con pagamento cauzione trovate: {subscriptions.length}
                                        </Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={selectedSubs.length === subscriptions.length && subscriptions.length > 0}
                                                    onChange={handleSelectAll}
                                                    disabled={subscriptions.length === 0}
                                                />
                                            }
                                            label="Seleziona tutte"
                                        />
                                    </Grid>
                                    <Grid size={{xs: 12}}>
                                        <Box sx={{maxHeight: 200, overflowY: 'auto', mb: 2}}>
                                            {subscriptions.map(sub => (
                                                <Paper key={sub.id} sx={{
                                                    display: 'flex', alignItems: 'center', borderBottom: '1px solid #eee', py: 1, px: 1, mb: 1
                                                }}>
                                                    <Checkbox
                                                        checked={selectedSubs.includes(sub.id)}
                                                        onChange={() => handleSelectSub(sub.id)}
                                                    />
                                                    <Typography sx={{flex: 1}}>
                                                        {sub.profile_name}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ml: 2}}>
                                                        {sub.account_name ? `Cassa: ${sub.account_name}` : "Cassa: -"}
                                                    </Typography>
                                                </Paper>
                                            ))}
                                            {subscriptions.length === 0 && (
                                                <Typography color="text.secondary" sx={{mt: 2}}>
                                                    Nessuna iscrizione da rimborsare in questa lista.
                                                </Typography>
                                            )}
                                        </Box>
                                    </Grid>
                                </>
                            )}
                            <Grid size={{xs: 12}}>
                                <TextField select
                                           fullWidth
                                           label="Cassa"
                                           value={selectedAccount}
                                           onChange={e => setSelectedAccount(e.target.value)}
                                           sx={{mb: 2}}>
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
                                            disabled={submitting || (!subscription && subscriptions.length === 0)}
                                            startIcon={submitting ? <CircularProgress size={20}/> : null}>
                                        {subscription ? 'Rimborsa Cauzione' : 'Rimborsa Cauzioni Selezionate'}
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
