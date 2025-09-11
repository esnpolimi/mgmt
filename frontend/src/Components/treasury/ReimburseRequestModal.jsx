import {useEffect, useState} from 'react';
import {Modal, Box, Grid, Button, FormControl, InputLabel, Select, MenuItem, TextField, CircularProgress, Typography} from '@mui/material';
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import {fetchCustom, defaultErrorHandler} from '../../api/api';
import Popup from "../Popup";
import ConfirmDialog from "../ConfirmDialog";


export default function ReimburseRequestModal({open, onClose, requestData, onReimbursed}) {
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [receiptLink, setReceiptLink] = useState('');
    const [loading, setLoading] = useState(false);
    const [popup, setPopup] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({open: false, action: null, message: ''});
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (open) {
            // Reset to avoid out-of-range value while options are empty
            setSelectedAccount('');
            fetchCustom('GET', '/accounts/', {
                onSuccess: (data) => {
                    setAccounts(data);
                    // Set only after options are available and id exists
                    if (requestData?.account?.id && data.some(a => a.id === requestData.account.id)) {
                        setSelectedAccount(requestData.account.id);
                    }
                },
                onError: () => setAccounts([]),
            });
            // Keep other field initializations
            setDescription(requestData?.description || '');
            setAmount(requestData?.amount || '');
            setReceiptLink(requestData?.receipt_link || '');
        }
    }, [open, requestData]);

    const handleSubmit = () => {
        const originalAccountId = requestData?.account?.id;
        // If no cassa selected OR unchanged, skip confirm dialog
        if (!selectedAccount || selectedAccount === originalAccountId) {
            return doSubmit();
        }
        const accName = accounts.find(acc => acc.id === selectedAccount)?.name || '';
        setConfirmDialog({
            open: true,
            action: () => doSubmit(),
            message: `Confermi di voler effettuare un pagamento di €${amount} dalla cassa ${accName}?`
        });
    };

    const doSubmit = () => {
        setConfirmDialog({open: false, action: null, message: ''});
        setLoading(true);
        const payload = {
            account: selectedAccount,
            description: description,
            receipt_link: receiptLink,
        };
        if (amount && !isNaN(parseFloat(amount))) {
            payload.amount = parseFloat(amount);
        }
        fetchCustom('PATCH', `/reimbursement_request/${requestData.id}/`, {
            body: payload,
            onSuccess: () => {
                onReimbursed();
                onClose(true);
            },
            onError: (err) => defaultErrorHandler(err, setPopup),
            onFinally: () => setLoading(false)
        });
    };

    const doDelete = () => {
        setConfirmDialog({open: false, action: null, message: ''});
        setDeleting(true);
        fetchCustom('DELETE', `/reimbursement_request/${requestData.id}/`, {
            onSuccess: () => {
                onReimbursed?.();
                onClose(true);
            },
            onError: (err) => defaultErrorHandler(err, setPopup),
            onFinally: () => setDeleting(false)
        });
    };

    return (
        <Modal open={open} onClose={() => onClose(false)} aria-labelledby="reimburse-modal-title">
            <Box sx={style}>
                <Box sx={{display: "flex", justifyContent: "flex-end", mb: 0}}>
                    <IconButton onClick={() => onClose(false)}><CloseIcon/></IconButton>
                </Box>
                <Typography variant="h4" gutterBottom align="center">
                    Modifica / Rimborsa Richiesta
                </Typography>
                <Typography variant="subtitle1" gutterBottom align="center" sx={{mt: 1, mb: 2}}>
                    Stato: <b>
                    {requestData?.is_reimbursed
                        ? <>Rimborsata{requestData?.account?.name ? ` (${requestData.account.name})` : ""}</>
                        : "Non Rimborsata"}
                </b>
                </Typography>
                <Grid container spacing={2} direction="column" sx={{mt: 2}}>
                    <Grid size={{xs: 12}}>
                        <TextField label="Importo in € (decimali con punto)"
                                   type="number"
                                   value={amount}
                                   onChange={e => setAmount(e.target.value)}
                                   required
                                   fullWidth
                                   slotProps={{htmlInput: {min: "0.01", step: "0.01"}}}/>
                    </Grid>
                    <Grid size={{xs: 12}}>
                        <FormControl fullWidth sx={{mt: 0}}>
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
                        <TextField label="Link ricevuta"
                                   fullWidth
                                   value={receiptLink}
                                   onChange={e => setReceiptLink(e.target.value)}/>
                    </Grid>
                    <Grid size={{xs: 12}}>
                        <TextField label="Descrizione"
                                   fullWidth
                                   value={description}
                                   onChange={e => setDescription(e.target.value)}/>
                    </Grid>

                </Grid>
                <Button onClick={handleSubmit}
                        variant="contained"
                        disabled={loading || deleting}
                        sx={{mt: 2, bgcolor: "#1976d2", "&:hover": {bgcolor: "#1565c0"}}}>
                    {loading ? (<CircularProgress size={24} color="inherit"/>) : (
                        "Modifica / Rimborsa"
                    )}
                </Button>
                {!!requestData?.id && (
                    <Button
                        variant="outlined"
                        color="error"
                        disabled={deleting || loading}
                        sx={{mt: 1}}
                        onClick={() => setConfirmDialog({
                            open: true,
                            action: () => doDelete(),
                            message: "Confermi di voler eliminare questa richiesta di rimborso?"
                        })}
                    >
                        {deleting ? <CircularProgress size={24} color="inherit"/> : "Elimina richiesta"}
                    </Button>
                )}
                <ConfirmDialog
                    open={confirmDialog.open}
                    message={confirmDialog.message}
                    onConfirm={confirmDialog.action}
                    onClose={() => setConfirmDialog({open: false, action: null, message: ''})}
                />
                {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
            </Box>
        </Modal>
    );
}
