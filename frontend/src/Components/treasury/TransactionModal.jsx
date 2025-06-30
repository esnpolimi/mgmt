import {useState, useEffect} from 'react';
import {
    Modal, Box, Typography, Grid, IconButton, TextField, Button,
    FormControl, InputLabel, Select, MenuItem, OutlinedInput, FormHelperText
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {styleESNcardModal as style} from '../../utils/sharedStyles';
import Loader from '../Loader';
import Popup from '../Popup';
import {fetchCustom} from '../../api/api';
import {extractErrorMessage} from '../../utils/errorHandling';
import {transactionDisplayNames as names} from '../../utils/displayAttributes';
import ProfileSearch from '../ProfileSearch';
import * as Sentry from "@sentry/react";

export default function TransactionModal({open, onClose, transaction}) {
    const [isLoading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState([]);
    const [successPopup, setSuccessPopup] = useState(null);

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

    useEffect(() => {
        console.log('TransactionModal useEffect', transaction);
        setLoading(true);
        Promise.all([fetchCustom('GET', '/accounts/')])
            .then(async ([accRes]) => {
                const accJson = accRes.ok ? await accRes.json() : {results: []};
                setAccounts(accJson.results || []);
                if (transaction) {
                    setData({
                        executor: transaction.executor || null,
                        account: transaction.account?.id || '',
                        amount: transaction.amount || '',
                        description: transaction.description || '',
                        type: transaction.type || '',
                    });
                }
            }).finally(() => setLoading(false));
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setLoading(true);
        try {
            const payload = {
                executor: data.executor.id || data.executor.email,
                account: data.account,
                amount: parseFloat(data.amount),
                description: data.description,
            };
            const response = await fetchCustom('PATCH', `/transaction/${transaction.id}/`, payload);
            if (!response.ok) {
                const json = await response.json();
                const errorMessage = await extractErrorMessage(json, response.status);
                setSuccessPopup({message: `Errore: ${errorMessage}`, state: 'error'});
            } else onClose(true);
        } catch (error) {
            Sentry.captureException(error);
            setSuccessPopup({message: `Errore generale: ${error}`, state: 'error'});
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => onClose(false);

    return (
        <Modal open={open} onClose={handleClose}>
            <Box sx={style} component="form" onSubmit={handleSubmit} noValidate>
                {isLoading ? <Loader/> : (<>
                    <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: -2}}>
                        <IconButton onClick={handleClose} sx={{minWidth: 0}}><CloseIcon/></IconButton>
                    </Box>
                    <Typography variant="h5" gutterBottom align="center" sx={{mb: 2}}>
                        Modifica Transazione
                    </Typography>
                    {successPopup && <Popup message={successPopup.message} state={successPopup.state}/>}
                    <Grid container spacing={2} sx={{mt: 2}}>
                        <Typography variant="subtitle1" gutterBottom>
                            <b>Tipo:</b> {names.tran_type[data.type] || 'Non specificato'}
                        </Typography>
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
                                        <MenuItem key={acc.id} value={acc.id}>{acc.name}</MenuItem>
                                    ))}
                                </Select>
                                {errors.account[0] && <FormHelperText>{errors.account[1]}</FormHelperText>}
                            </FormControl>
                        </Grid>
                        <Grid size={{xs: 12}}>
                            <TextField
                                label={names.amount}
                                name="amount"
                                value={data.amount}
                                onChange={handleInputChange}
                                required
                                fullWidth
                                error={errors.amount[0]}
                                type="number"
                                slotProps={{htmlInput: {min: "0.01", step: "0.01"}}}
                            />
                        </Grid>
                        <Grid size={{xs: 12}}>
                            <TextField
                                label="Descrizione"
                                name="description"
                                value={data.description}
                                onChange={handleInputChange}
                                fullWidth
                                multiline
                                rows={3}
                            />
                        </Grid>
                    </Grid>
                    <Box mt={2}>
                        <Button fullWidth variant="contained" color="primary" type="submit">
                            Salva Modifiche
                        </Button>
                    </Box>
                </>)}
            </Box>
        </Modal>
    );
}