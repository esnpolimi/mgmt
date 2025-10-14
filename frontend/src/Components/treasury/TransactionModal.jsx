import {useEffect, useState} from 'react';
import {Box, Button, FormControl, FormHelperText, Grid, IconButton, InputLabel, MenuItem, Modal, OutlinedInput, Select, TextField, Typography} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {styleESNcardModal as style} from '../../utils/sharedStyles';
import Loader from '../Loader';
import Popup from '../Popup';
import {defaultErrorHandler, fetchCustom} from '../../api/api';
import {transactionDisplayNames as names} from '../../utils/displayAttributes';
import ProfileSearch from '../ProfileSearch';
import CircularProgress from '@mui/material/CircularProgress';
import ConfirmDialog from '../ConfirmDialog';
import ReceiptFileUpload from '../common/ReceiptFileUpload';
import {ToggleButton, ToggleButtonGroup} from '@mui/material';

// List of transaction types that can be deleted
const deletableTranTypes = ['rimborso_cauzione', 'rimborso_quota', 'reimbursement', 'deposit', 'withdrawal'];

export default function TransactionModal({open, onClose, transaction}) {
    const [isLoading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState([]);
    const [popup, setPopup] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({open: false, action: null, message: ''});
    const negative_types = ['withdrawal', 'rimborso_cauzione', 'rimborso_quota', 'reimbursement'];

    const [data, setData] = useState({
        executor: null,
        account: '',
        amount: '',
        description: '',
        type: '',
    });

    const [errors, setErrors] = useState({
        executor: [false, ''],
        account: [false, ''],
        amount: [false, ''],
        description: [false, ''],
    });

    const [receiptFile, setReceiptFile] = useState(null);
    const [removeReceipt, setRemoveReceipt] = useState(false);

    useEffect(() => {
        setLoading(true);
        fetchCustom('GET', '/accounts/', {
            onSuccess: (results) => {
                setAccounts(results);
                if (transaction) {
                    let amount = transaction.amount || 0;
                    if (transaction.type && negative_types.includes(transaction.type))
                        amount = -amount;
                    setData({
                        executor: transaction.executor || null,
                        account: transaction.account?.id || '',
                        amount: amount,
                        description: transaction.description || '',
                        type: transaction.type || '',
                    });
                }
            },
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
            onFinally: () => setLoading(false)
        });
    }, [open, transaction]);

    useEffect(() => {
        if (transaction) {
            setReceiptFile(null);
            setRemoveReceipt(false);
        }
    }, [open, transaction]);

    const handleInputChange = (e) => {
        const {name, value} = e.target;
        setData(prev => ({...prev, [name]: value}));
    };

    const validate = () => {
        let hasError = false;
        const newErrors = {...errors};
        if (!data.executor) {
            newErrors.executor = [true, 'Seleziona un Esecutore'];
            hasError = true;
        } else newErrors.executor = [false, ''];
        if (!data.account) {
            newErrors.account = [true, 'Seleziona una Cassa'];
            hasError = true;
        } else newErrors.account = [false, ''];
        if (!data.amount || isNaN(Number(data.amount))) {
            newErrors.amount = [true, 'Inserisci un importo valido'];
            hasError = true;
        } else newErrors.amount = [false, ''];
        setErrors(newErrors);
        return !hasError;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;
        // Confirm dialog for account amount change
        let amount = data.amount;
        if (negative_types.includes(data.type) && parseFloat(amount) > 0)
            amount = -amount;
        const payload = {
            executor: data.executor.id || data.executor.email,
            account: data.account,
            amount: amount,
            description: data.description,
            type: data.type,
        };

        if (transaction && (amount !== parseFloat(transaction.amount) || data.account !== (transaction.account?.id || transaction.account))) {
            const accName = accounts.find(acc => acc.id === data.account)?.name || '';
            setConfirmDialog({
                open: true,
                action: () => doSubmit(payload),
                message: `Stai modificando l'importo o la cassa (${accName}). Confermi di voler salvare le modifiche?`
            });
        } else doSubmit(payload);
    };

    const doSubmit = (payload) => {
        setConfirmDialog({open: false, action: null, message: ''});
        setSubmitting(true);
        setLoading(true);
        let methodBody = payload;
        // If we touch the receipt, use FormData
        const wantsReceiptChange = !!receiptFile || removeReceipt;
        if (wantsReceiptChange) {
            const fd = new FormData();
            Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
            if (receiptFile) fd.append('receiptFile', receiptFile);
            if (removeReceipt) fd.append('remove_receipt', 'true');
            methodBody = fd;
        }
        fetchCustom('PATCH', `/transaction/${transaction.id}/`, {
            body: methodBody,
            onSuccess: () => onClose(true),
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
            onFinally: () => {
                setLoading(false);
                setSubmitting(false);
            }
        });
    };

    const handleDelete = () => {
        if (!transaction || !deletableTranTypes.includes(transaction.type)) {
            setPopup({message: 'Transazione non eliminabile', state: 'error', id: Date.now()});
            return;
        }
        // Confirm dialog for delete
        setConfirmDialog({
            open: true,
            action: () => doDelete(),
            message: "Sei sicuro di voler eliminare questa transazione? L'importo verrà rimosso dalla cassa."
        });
    };

    const doDelete = () => {
        setConfirmDialog({open: false, action: null, message: ''});
        setDeleting(true);
        setLoading(true);
        fetchCustom('DELETE', `/transaction/${transaction.id}/`, {
            onSuccess: () => onClose(true),
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
            onFinally: () => {
                setLoading(false);
                setDeleting(false);
            }
        });
    };

    return (
        <Modal open={open} onClose={() => onClose(false)}>
            <Box sx={style} component="form" onSubmit={handleSubmit} noValidate>
                {isLoading ? <Loader/> : (<>
                    <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: -2}}>
                        <IconButton onClick={() => onClose(false)} sx={{minWidth: 0}}><CloseIcon/></IconButton>
                    </Box>
                    <Typography variant="h5" gutterBottom align="center" sx={{mb: 2}}>
                        Modifica Transazione
                    </Typography>
                    {popup && <Popup key={popup.id} message={popup.message} state={popup.state}/>}
                    <Grid container spacing={2} sx={{mt: 2}}>
                        {['deposit', 'withdrawal'].includes(data.type) ? (
                            <Grid size={{xs: 12}} sx={{display: 'flex', alignItems: 'center'}}>
                                <Typography variant="subtitle1" gutterBottom sx={{mr: 1}}>
                                    <b>Tipo:</b>
                                </Typography>
                                <ToggleButtonGroup
                                    sx={{mb: 0.5}}
                                    color="primary"
                                    exclusive
                                    value={data.type}
                                    onChange={(e, newType) => {
                                        if (!newType || newType === data.type) return;
                                        setData(prev => ({
                                            ...prev,
                                            type: newType,
                                        }));
                                    }}
                                    size="small"
                                >
                                    <ToggleButton value="deposit">Deposito</ToggleButton>
                                    <ToggleButton value="withdrawal">Prelievo</ToggleButton>
                                </ToggleButtonGroup>
                            </Grid>
                        ) : (
                            <Typography variant="subtitle1" gutterBottom>
                                <b>Tipo:</b> {names.tran_type[data.type] || 'Non specificato'}
                            </Typography>
                        )}
                        <Grid size={{xs: 12}}>
                            <ProfileSearch
                                value={data.executor}
                                onChange={(event, newValue) => {
                                    setData({...data, executor: newValue});
                                }}
                                error={errors.executor[0]}
                                helperText={errors.executor[0] ? errors.executor[1] : 'Cerca per nome o numero ESNcard'}
                                label={names.executor}
                                esner_only={true}
                                required
                            />
                        </Grid>
                        <Grid size={{xs: 12}}>
                            <FormControl fullWidth required error={errors.account[0]}>
                                <InputLabel id="account-label">{names.account}</InputLabel>
                                <Select
                                    labelId="account-label"
                                    name="account"
                                    variant="outlined"
                                    value={data.account}
                                    onChange={handleInputChange}
                                    input={<OutlinedInput label={names.account}/>}>
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
                                {errors.account[0] && <FormHelperText>{errors.account[1]}</FormHelperText>}
                            </FormControl>
                        </Grid>
                        <Grid size={{xs: 12}}>
                            <TextField
                                label={names.amount + " in € (decimali con punto)"}
                                name="amount"
                                value={data.amount}
                                onChange={handleInputChange}
                                required
                                fullWidth
                                error={errors.amount[0]}
                                type="number"
                                slotProps={{htmlInput: {min: "0.00", step: "0.01"}}}
                            />
                        </Grid>
                        <Grid size={{xs: 12}}>
                            <TextField
                                label="Descrizione"
                                name="description"
                                value={data.description}
                                onChange={handleInputChange}
                                fullWidth
                            />
                        </Grid>
                        <Grid size={{xs: 12}}>
                            {/* Receipt section */}
                            {transaction?.receipt_link && !removeReceipt && !receiptFile && (
                                <Box>
                                    <Typography variant="subtitle2" sx={{mb: 1}}>
                                        <b>Ricevuta:</b>{' '}
                                        <Button
                                            variant="text"
                                            color="primary"
                                            sx={{textTransform: 'none', p: 0, minWidth: 0}}
                                            onClick={() => window.open(transaction.receipt_link, '_blank', 'noopener,noreferrer')}>
                                            Link Drive
                                        </Button>
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        size="small"
                                        onClick={() => {
                                            setRemoveReceipt(true);
                                            setReceiptFile(null);
                                        }}>
                                        Rimuovi ricevuta
                                    </Button>
                                </Box>
                            )}
                            {(!transaction?.receipt_link || removeReceipt || receiptFile) && (
                                <Box sx={{mt: 1}}>
                                    <ReceiptFileUpload
                                        file={receiptFile}
                                        onFileChange={(f) => {
                                            setReceiptFile(f);
                                            if (f) setRemoveReceipt(false);
                                        }}
                                        label={transaction?.receipt_link && removeReceipt ? "Carica nuova ricevuta" : "Carica ricevuta"}
                                    />
                                    {removeReceipt && !receiptFile && (
                                        <Typography variant="caption" color="warning.main">
                                            La ricevuta esistente verrà rimossa al salvataggio.
                                        </Typography>
                                    )}
                                    {transaction?.receipt_link && (removeReceipt || receiptFile) && (
                                        <Button
                                            variant="text"
                                            size="small"
                                            onClick={() => {
                                                setRemoveReceipt(false);
                                                setReceiptFile(null);
                                            }}
                                            sx={{mt: 1}}>
                                            Annulla modifica ricevuta
                                        </Button>
                                    )}
                                </Box>
                            )}
                        </Grid>
                    </Grid>
                    <Box mt={2}>
                        <Button fullWidth
                                variant="contained"
                                color="primary"
                                type="submit"
                                disabled={submitting || deleting}>
                            {submitting ? <CircularProgress size={24} color="inherit"/> : "Salva Modifiche"}
                        </Button>
                        {transaction && deletableTranTypes.includes(transaction.type) && (
                            <Button fullWidth
                                    variant="outlined"
                                    color="error"
                                    onClick={handleDelete}
                                    disabled={deleting || submitting || isLoading}
                                    sx={{mt: 1}}>
                                {deleting ? <CircularProgress size={24} color="inherit"/> : "Elimina Transazione"}
                            </Button>
                        )}
                    </Box>
                    <ConfirmDialog
                        open={confirmDialog.open}
                        message={confirmDialog.message}
                        onConfirm={confirmDialog.action}
                        onClose={() => setConfirmDialog({open: false, action: null, message: ''})}
                    />
                </>)}
            </Box>
        </Modal>
    );
}
