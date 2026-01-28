import React, {useEffect, useState} from 'react';
import {
    Modal, Box, Typography, Button, IconButton, Grid, TextField, MenuItem, CircularProgress, FormControlLabel, Checkbox
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Loader from "../Loader";
import ConfirmDialog from "../ConfirmDialog";
import Popup from "../Popup";
import {fetchCustom, defaultErrorHandler} from "../../api/api";
import {styleESNcardModal as style} from "../../utils/sharedStyles";

export default function ReimburseQuotaModal({open, onClose, event, subscription}) {
    const [isLoading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({open: false, action: null, message: ''});
    const [popup, setPopup] = useState(null);
    const [includeServices, setIncludeServices] = useState(false);
    const quotaAlreadyReimbursed = subscription?.status_quota === 'reimbursed';

    const servicesTotal = (subscription?.selected_services || []).reduce((sum, s) => {
        const price = Number(s?.price_at_purchase ?? s?.price ?? 0);
        const qty = Number(s?.quantity ?? 1);
        if (!Number.isFinite(price) || !Number.isFinite(qty) || qty <= 0) return sum;
        return sum + (price * qty);
    }, 0);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        setPopup(null);
        setSelectedAccount('');
        setNotes('');
        setIncludeServices(quotaAlreadyReimbursed ? servicesTotal > 0 : false);
        fetchCustom("GET", "/accounts/", {
            onSuccess: (results) => setAccounts(results || []),
            onError: (err) => defaultErrorHandler(err, setPopup),
            onFinally: () => setLoading(false)
        });
    }, [open, quotaAlreadyReimbursed, servicesTotal]);

    const handleSubmit = () => {
        setPopup(null);
        if (!selectedAccount) {
            setPopup({message: "Seleziona una cassa.", state: "error", id: Date.now()});
            return;
        }
        if (!subscription) {
            setPopup({message: "Iscrizione non trovata.", state: "error", id: Date.now()});
            return;
        }
        const quotaAmount = quotaAlreadyReimbursed ? 0 : Number(event.cost || 0);
        const extraServices = includeServices && servicesTotal > 0 ? servicesTotal : 0;
        const totalAmount = quotaAmount + extraServices;
        const message = `Confermi di voler rimborsare €${totalAmount.toFixed(2)} a ${subscription.profile_name} dalla cassa ${accounts.find(acc => acc.id === selectedAccount)?.name || "N/A"}?`;
        setConfirmDialog({
            open: true,
            action: () => doSubmit(),
            message
        });
    };

    const doSubmit = () => {
        setConfirmDialog({open: false, action: null, message: ''});
        setSubmitting(true);
        fetchCustom("POST", "/reimburse_quota/", {
            body: {
                event: event.id,
                subscription_id: subscription.id,
                account: selectedAccount,
                notes,
                include_services: includeServices
            },
            onSuccess: () => onClose(true, 'Rimborso quota effettuato con successo'),
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
                            Rimborsa Quota
                        </Typography>
                        <Grid container spacing={1} sx={{mt: 1}}>
                            <Grid size={{xs: 12}}>
                                <Typography>
                                    <b>Importo Quota:</b> €{(quotaAlreadyReimbursed ? 0 : Number(event.cost || 0)).toFixed(2)}
                                </Typography>
                                {quotaAlreadyReimbursed && (
                                    <Typography variant="body2" color="text.secondary">
                                        Quota già rimborsata
                                    </Typography>
                                )}
                            </Grid>
                            {servicesTotal > 0 && (
                                <Grid size={{xs: 12}}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={includeServices}
                                                onChange={(e) => setIncludeServices(e.target.checked)}
                                                color="primary"
                                                disabled={quotaAlreadyReimbursed}
                                            />
                                        }
                                        label={`Rimborsa anche servizi (+€${servicesTotal.toFixed(2)})`}
                                    />
                                </Grid>
                            )}
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
                                           sx={{mb: 2, mt: 1}}/>
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
                        {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
                    </>
                )}
            </Box>
        </Modal>
    );
}
