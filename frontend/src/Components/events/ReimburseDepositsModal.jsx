import React, {useEffect, useState} from 'react';
import {
    Modal, Box, Typography, Button, IconButton, Grid, Checkbox, TextField, MenuItem, Paper, CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Loader from "../Loader";
import ConfirmDialog from "../ConfirmDialog";
import Popup from "../Popup";
import {fetchCustom, defaultErrorHandler} from "../../api/api";
import {styleESNcardModal as style} from "../../utils/sharedStyles";


export default function ReimburseDepositsModal({open, onClose, event, listId, subscription}) {
    const [isLoading, setLoading] = useState(true);
    const [subscriptions, setSubscriptions] = useState([]);
    const [selectedSubs, setSelectedSubs] = useState([]);
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
        setSelectedSubs([]);
        setSelectedAccount('');
        setNotes('');
        setPopup(null);

        const fetchAccounts = () => {
            fetchCustom("GET", "/accounts/", {
                onSuccess: (data) => setAccounts(data.results || []),
                onError: (err) => defaultErrorHandler(err, setPopup),
            });
        };

        if (subscription) {
            setSubscriptions([subscription]);
            setSelectedSubs([subscription.id]);
            setLoading(false);
            fetchAccounts();
            return;
        }

        fetchCustom("GET", `/reimbursable_deposits/?event=${event.id}&list=${listId}`, {
            onSuccess: (json) => {
                setSubscriptions(json);
                setSelectedSubs(json.map(s => s.id));
            },
            onError: (err) => defaultErrorHandler(err, setPopup),
            onFinally: () => setLoading(false)
        });

        fetchAccounts();
    }, [open, event.id, listId, subscription]);

    const handleSelectAll = (e) => {
        setSelectedSubs(e.target.checked ? subscriptions.map(s => s.id) : []);
    };

    const handleSelectSub = (id) => {
        setSelectedSubs(selectedSubs.includes(id)
            ? selectedSubs.filter(sid => sid !== id)
            : [...selectedSubs, id]);
    };

    const handleSubmit = () => {
        setPopup(null);
        if (!selectedAccount) {
            setPopup({message: "Seleziona una cassa.", state: "error"});
            return;
        }
        if (selectedSubs.length === 0) {
            setPopup({message: "Seleziona almeno una iscrizione.", state: "error"});
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

    const doSubmit = () => {
        setConfirmDialog({open: false, action: null, message: ''});
        setSubmitting(true);
        fetchCustom("POST", "/reimburse_deposits/", {
            body: {
                event: event.id,
                subscription_ids: selectedSubs,
                account: selectedAccount,
                notes
            },
            onSuccess: () => onClose(true, `${subscription ? 'Rimborso effettuato con successo' : 'Rimborsi effettuati con successo!'}`),
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
                            Rimborsa Cauzion{subscription ? 'e' : 'i'}
                        </Typography>
                        <Grid container spacing={2} sx={{mt: 1}}>
                            <Typography>
                                <b>Importo Cauzione:</b> €{Number(event.deposit || 0).toFixed(2)}
                            </Typography>
                            {subscription ? (
                                <>
                                    <Typography>
                                        <b>Ricevente:</b> {subscription.profile_name}
                                    </Typography>
                                    <Typography>
                                        <b>Cassa di pagamento:</b> {subscription.account_name ? subscription.account_name : "-"}
                                    </Typography>
                                </>
                            ) : (
                                <>
                                    <Grid size={{xs: 12}}>
                                        <Typography variant="subtitle1" sx={{mb: 1}}>
                                            Iscrizioni con pagamento cauzione trovate: {subscriptions.length}
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
                                                    Nessuna iscrizione da rimborsare.
                                                </Typography>
                                            )}
                                        </Paper>
                                    </Grid>
                                </>
                            )}
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
