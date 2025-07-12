import {useEffect, useMemo, useState} from "react";
import {Button, Box, Divider, FormControl, InputLabel, MenuItem, Modal, Select, Typography, TextField, FormHelperText, CircularProgress, Alert} from "@mui/material";
import {Switch, FormControlLabel, Paper, IconButton, Grid} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {defaultErrorHandler, fetchCustom} from "../../api/api";
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import Loader from "../Loader";
import ConfirmDialog from "../ConfirmDialog";
import ProfileSearch from "../ProfileSearch";
import Popup from "../Popup";

export default function SubscriptionModal({open, onClose, event, listId, subscription, isEdit, profileId, profileName}) {
    const [isLoading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState([]);
    const [confirmDialog, setConfirmDialog] = useState({open: false, action: null, message: ''});
    const [popup, setPopup] = useState(null);
    const title = isEdit ? 'Modifica Iscrizione' : 'Iscrizione Evento';
    const originalAccountId = isEdit ? subscription.account_id || null : null; // 'paid' to 'pending' status needs the original account_id

    const [data, setData] = useState({
        id: '',
        account_id: '',
        account_name: '',
        profile_id: '',
        profile_name: '',
        list_id: listId || '',
        list_name: (event.selectedList ? event.selectedList.name : (event.lists && listId ? (event.lists.find(list => list.id === listId)?.name || 'Lista non trovata') : 'Lista non trovata')),
        notes: '',
        status_quota: subscription?.status_quota || 'pending',
        status_cauzione: subscription?.status_cauzione || 'pending'
    });

    const [errors, setErrors] = useState({
        account_id: [false, ''],
        account_name: [false, ''],
        profile_id: [false, ''],
        profile_name: [false, ''],
        status: [false, ''],
        list_id: [false, ''],
        list_name: [false, ''],
        notes: [false, ''],
    });

    const fieldsToValidate = useMemo(() => [
        {field: 'profile_id', value: data?.profile_id, message: "Selezionare un Profilo"},
        ...(data?.status === 'paid' ? [{field: 'account_id', value: data?.account_id, message: "Selezionare una Cassa"}] : [])
    ], [data]);

    const [submitLoading, setSubmitLoading] = useState(false);

    useEffect(() => {
        if (isEdit) {
            setData(subscription)
        } else {
            if (profileId) {
                setData(d => ({
                    ...d,
                    profile_id: profileId,
                    profile_name: profileName || ''
                }));
            }
            if (event.selectedList) {
                setData(d => ({
                    ...d,
                    list_id: event.selectedList.id,
                    list_name: event.selectedList.name
                }));
            }
        }
        setLoading(false);
        fetchAccounts();
    }, [isEdit, profileId, profileName, event])

    const fetchAccounts = () => {
        fetchCustom("GET", "/accounts/", {
            parseJson: true,
            onSuccess: (results) => setAccounts(results),
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
        });
    }

    const resetErrors = () => {
        const resetObj = {};
        Object.keys(errors).forEach(key => {
            resetObj[key] = [false, ''];
        });
        setErrors(resetObj);
        return resetObj;
    };

    const getQuotaImport = () => Number(event.cost || 0);
    const getCauzioneImport = () => Number(event.deposit || 0);

    // Helper to compute total import
    const getTotalImport = () => {
        let total = 0;
        if (data.status_quota === 'paid') total += getQuotaImport();
        if (event.deposit > 0 && data.status_cauzione === 'paid') total += getCauzioneImport();
        return total;
    };

    // Helper to show confirm dialog message for payment changes
    const getConfirmMessage = () => {
        // Detect status changes for quota/cauzione
        const quotaChangedToPaid = data.status_quota === 'paid' && (!isEdit || subscription?.status_quota !== 'paid');
        const quotaChangedToPending = isEdit && subscription?.status_quota === 'paid' && data.status_quota === 'pending';
        const cauzioneChangedToPaid = event.deposit > 0 && data.status_cauzione === 'paid' && (!isEdit || subscription?.status_cauzione !== 'paid');
        const cauzioneChangedToPending = isEdit && subscription?.status_cauzione === 'paid' && data.status_cauzione === 'pending';

        const accountObj = accounts.find(acc => acc.id === data.account_id);
        const accountName = accountObj ? accountObj.name : 'N/A';

        if (quotaChangedToPaid) {
            return `Confermi il pagamento della quota di €${getQuotaImport().toFixed(2)} in cassa ${accountName}?`;
        }
        if (cauzioneChangedToPaid) {
            return `Confermi il pagamento della cauzione di €${getCauzioneImport().toFixed(2)} in cassa ${accountName}?`;
        }
        if (quotaChangedToPending) {
            return `Confermi la rimozione del pagamento della quota di €${getQuotaImport().toFixed(2)}? Verrà stornato dalla cassa.`;
        }
        if (cauzioneChangedToPending) {
            return `Confermi la rimozione del pagamento della cauzione di €${getCauzioneImport().toFixed(2)}? Verrà stornato dalla cassa.`;
        }
        // If both are newly paid
        if (quotaChangedToPaid && cauzioneChangedToPaid) {
            return `Confermi un pagamento totale di €${getTotalImport().toFixed(2)} in cassa ${accountName}?`;
        }
        // If both are being removed
        if (quotaChangedToPending && cauzioneChangedToPending) {
            return `Confermi la rimozione di entrambi i pagamenti (quota + cauzione) per un totale di €${getTotalImport().toFixed(2)}? Verranno stornati dalla cassa.`;
        }
        // Default: if either is paid
        if (data.status_quota === 'paid' || (event.deposit > 0 && data.status_cauzione === 'paid')) {
            return `Confermi un pagamento totale di €${getTotalImport().toFixed(2)} in cassa ${accountName}?`;
        }
        return '';
    };

    const handleSubmit = () => {
        let hasErrors = false;
        const newErrors = resetErrors();
        fieldsToValidate.forEach(item => {
            if (!item.value) {
                newErrors[item.field] = [true, item.message];
                hasErrors = true;
            }
        });
        if (hasErrors) {
            setErrors(newErrors);
            return;
        }

        // Show confirm dialog if status changes from paid to pending or pending to paid
        const quotaChangedToPaid = data.status_quota === 'paid' && (!isEdit || subscription?.status_quota !== 'paid');
        const quotaChangedToPending = isEdit && subscription?.status_quota === 'paid' && data.status_quota === 'pending';
        const cauzioneChangedToPaid = event.deposit > 0 && data.status_cauzione === 'paid' && (!isEdit || subscription?.status_cauzione !== 'paid');
        const cauzioneChangedToPending = isEdit && subscription?.status_cauzione === 'paid' && data.status_cauzione === 'pending';

        if (quotaChangedToPaid || quotaChangedToPending || cauzioneChangedToPaid || cauzioneChangedToPending) {
            setConfirmDialog({
                open: true,
                action: () => doSubmit(),
                message: getConfirmMessage()
            });
            return;
        }
        // Also show confirm if either is paid (for new subscriptions)
        if (data.status_quota === 'paid' || (event.deposit > 0 && data.status_cauzione === 'paid')) {
            setConfirmDialog({
                open: true,
                action: () => doSubmit(),
                message: getConfirmMessage()
            });
            return;
        }
        doSubmit();
    };

    const doSubmit = () => {
        setConfirmDialog({open: false, action: null, message: ''});
        setSubmitLoading(true);
        fetchCustom(isEdit ? "PATCH" : "POST", `/subscription/${isEdit ? data.id + '/' : ''}`, {
            body: {
                profile: data.profile_id,
                event: event.id,
                list: data.list_id,
                account_id: data.account_id || originalAccountId,
                notes: data.notes,
                status_quota: data.status_quota,
                status_cauzione: data.status_cauzione
            },
            onSuccess: () => {
                onClose(true, (isEdit ? 'Modifica Iscrizione' : 'Iscrizione') + ' completata con successo!');
            },
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
            onFinally: () => setSubmitLoading(false)
        });
    };

    const handleDelete = () => {
        // Only confirm if paid
        if (data.status_quota === 'paid' || data.status_cauzione === 'paid') {
            let message;
            if (data.status_quota === 'paid' && data.status_cauzione !== 'paid') {
                message = `Confermi di voler eliminare un pagamento quota di €${getQuotaImport().toFixed(2)}?`;
            } else if (data.status_cauzione === 'paid' && data.status_quota !== 'paid') {
                message = `Confermi di voler eliminare un pagamento cauzione di €${getCauzioneImport().toFixed(2)}?`;
            } else {
                message = `Confermi di voler eliminare un pagamento totale di €${getTotalImport().toFixed(2)}?`;
            }
            setConfirmDialog({
                open: true,
                action: () => doDelete(),
                message
            });
            return;
        }
        doDelete();
    };

    const doDelete = () => {
        setConfirmDialog({open: false, action: null, message: ''});
        if (!isEdit || !data.id) return;
        fetchCustom("DELETE", `/subscription/${data.id}/`, {
            onSuccess: () => onClose(true, "Eliminazione avvenuta con successo"),
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup)
        });
    };

    const handleChange = (e) => {
        setData({
            ...data,
            [e.target.name]: e.target.value,
        });
    };

    // Helper to check if either quota or cauzione is reimbursed
    const isReimbursed = data.status_quota === 'reimbursed' || data.status_cauzione === 'reimbursed';

    return (
        <Modal open={open}
               onClose={() => onClose(false)}
               aria-labelledby="modal-modal-title"
               aria-describedby="modal-modal-description">
            <Box sx={style}>
                {isLoading ? <Loader/> : (<>
                    <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: -2}}>
                        <IconButton onClick={() => onClose(false)} sx={{minWidth: 0}}><CloseIcon/></IconButton>
                    </Box>
                    <Typography variant="h4" component="h2" gutterBottom align="center">{title}</Typography>
                    <Divider sx={{mb: 2}}/>
                    {/* Show warning if reimbursed */}
                    {isReimbursed && (
                        <Alert severity="warning" sx={{mb: 2}}>
                            Attenzione: la quota o la cauzione sono state rimborsate. Non è possibile efettuare modifiche.
                        </Alert>
                    )}
                    <Typography variant="subtitle1" gutterBottom>
                        <b>Nome Evento:</b> {event.name}
                    </Typography>
                    <Typography variant="subtitle1" gutterBottom>
                        <b>Lista:</b> {data.list_name}
                    </Typography>
                    <Grid container spacing={2} direction="column">
                        <Grid size={{xs: 12}} sx={{mt: 2}}>
                            <ProfileSearch
                                value={data.profile_id ? {
                                    id: data.profile_id,
                                    name: data.profile_name
                                } : null}
                                onChange={(event, newValue) => {
                                    setData({
                                        ...data,
                                        profile_id: newValue?.id,
                                        profile_name: newValue ? `${newValue.name} ${newValue.surname}` : ''
                                    });
                                }}
                                error={errors.profile_id && errors.profile_id[0]}
                                helperText={errors.profile_id && errors.profile_id[1] || 'Cerca per nome o numero ESNcard'}
                                label={isEdit ? data.profile_name : "Cerca profilo"}
                                required
                                disabled={isEdit || !!profileId || isReimbursed}
                            />
                        </Grid>
                        {/* Quota status toggle */}
                        {event.quota > 0 && (
                            <Grid size={{xs: 12}}>
                                <Paper
                                    elevation={1}
                                    sx={{
                                        p: 1.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        bgcolor: data.status_quota === 'paid' ? '#e3f2fd' : 'inherit',
                                        transition: 'background-color 0.8s',
                                        mb: 0
                                    }}
                                >
                                    <Typography variant="subtitle2" sx={{ml: 1}}>Stato Quota</Typography>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={data.status_quota === 'paid'}
                                                onChange={() => setData(d => ({
                                                    ...d,
                                                    status_quota: d.status_quota === 'paid' ? 'pending' : 'paid'
                                                }))}
                                                color="primary"
                                                disabled={isReimbursed}
                                                size="small"
                                            />
                                        }
                                        label={data.status_quota === 'paid' ? "Pagata" : data.status_quota === 'reimbursed' ? "Rimborsata" : "In attesa"}
                                        labelPlacement="start"
                                        sx={{mr: 1}}
                                    />
                                </Paper>
                            </Grid>
                        )}
                        {/* Cauzione status toggle */}
                        {event.deposit > 0 && (
                            <Grid size={{xs: 12}}>
                                <Paper
                                    elevation={1}
                                    sx={{
                                        p: 1.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        bgcolor: data.status_cauzione === 'paid' ? '#e3f2fd' : 'inherit',
                                        transition: 'background-color 0.8s',
                                        mb: 0
                                    }}
                                >
                                    <Typography variant="subtitle2" sx={{ml: 1}}>Stato Cauzione</Typography>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={data.status_cauzione === 'paid'}
                                                onChange={() => setData(d => ({
                                                    ...d,
                                                    status_cauzione: d.status_cauzione === 'paid' ? 'pending' : 'paid'
                                                }))}
                                                color="primary"
                                                disabled={isReimbursed}
                                                size="small"
                                            />
                                        }
                                        label={data.status_cauzione === 'paid' ? "Pagata" : data.status_cauzione === 'reimbursed' ? "Rimborsata" : "In attesa"}
                                        labelPlacement="start"
                                        sx={{mr: 1}}
                                    />
                                </Paper>
                            </Grid>
                        )}
                        {/* Show total import and cassa select if either is paid */}
                        {(data.status_quota === 'paid' || (event.deposit > 0 && data.status_cauzione === 'paid')) && (
                            <>
                                <Grid size={{xs: 12}} sx={{mt: 0}}>
                                    <Typography variant="subtitle1" gutterBottom>
                                        <b>Importo totale:</b> €{getTotalImport().toFixed(2)}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12}}>
                                    <FormControl fullWidth required error={errors.account_id && errors.account_id[0]}>
                                        <InputLabel htmlFor="account-selector" sx={{mb: 2}}>Seleziona Cassa</InputLabel>
                                        <Select
                                            variant="outlined"
                                            label="Seleziona Cassa"
                                            labelId="account-selector-label"
                                            id="account-selector"
                                            name="account_id"
                                            value={data.account_id || ''}
                                            error={errors.account_id && errors.account_id[0]}
                                            onChange={handleChange}
                                            disabled={isReimbursed}
                                        >
                                            {accounts.map((account) => (
                                                <MenuItem key={account.id}
                                                          value={account.id}
                                                          disabled={account.status === 'closed'}
                                                          style={{color: account.status === 'closed' ? 'grey' : 'inherit'}}>
                                                    {account.name} {account.status === 'closed' ? '(Chiusa)' : ''}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                        {errors.account_id && errors.account_id[0] && <FormHelperText>{errors.account_id[1]}</FormHelperText>}
                                    </FormControl>
                                </Grid>
                            </>
                        )}
                        <Grid size={{xs: 12}}>
                            <TextField
                                label="Note"
                                name="notes"
                                value={data.notes}
                                onChange={handleChange}
                                fullWidth
                                disabled={isReimbursed}
                            />
                        </Grid>
                    </Grid>
                    <Button variant="contained"
                            fullWidth
                            sx={{
                                mt: 2,
                                bgcolor: data.profile_id ? '#1976d2' : '#9e9e9e',
                                '&:hover': {bgcolor: data.profile_id ? '#1565c0' : '#757575'}
                            }}
                            onClick={handleSubmit}
                            disabled={submitLoading || isReimbursed}
                            startIcon={submitLoading ? <CircularProgress size={18}/> : null}>
                        {isEdit ? 'Salva Modifiche' : 'Conferma'}
                    </Button>
                    {isEdit && (
                        <Button variant="contained"
                                fullWidth
                                sx={{
                                    mt: 1,
                                    bgcolor: '#d32f2f',
                                    '&:hover': {bgcolor: '#b71c1c'}
                                }}
                                onClick={handleDelete}
                                disabled={isReimbursed}>
                            Elimina Iscrizione
                        </Button>
                    )}
                    {popup && <Popup message={popup.message} state={popup.state}/>}
                </>)}
                <ConfirmDialog
                    open={confirmDialog.open}
                    message={confirmDialog.message}
                    onConfirm={confirmDialog.action}
                    onClose={() => setConfirmDialog({open: false, action: null, message: ''})}
                />
            </Box>
        </Modal>
    );
}
