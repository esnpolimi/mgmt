import {useEffect, useState} from "react";
import {Button, Box, Divider, FormControl, InputLabel, MenuItem, Modal, Select, Typography, TextField, FormHelperText, IconButton, Grid} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {fetchCustom} from "../../api/api";
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import Popup from "../Popup";
import ConfirmDialog from "../ConfirmDialog";
import {extractErrorMessage} from "../../utils/errorHandling";
import Loader from "../Loader";
import * as Sentry from "@sentry/react";

export default function ESNcardEmissionModal({open, profile, onClose}) {
    const [amount, setAmount] = useState(0);
    const [successPopup, setSuccessPopup] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({open: false, action: null, message: ''});
    const [isLoading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState([]);

    const [data, setData] = useState({  /* profile fields */
        esncard_number: '',
        account_id: ''
    });

    const [errors, setErrors] = useState({  /* validation errors */
        esncard_number: [false, ''],
        account_id: [false, '']
    });

    const fieldsToValidate = [
        {field: 'esncard_number', value: data.esncard_number, message: "Inserire il numero di ESNcard"},
        {field: 'account_id', value: data.account_id, message: "Selezionare una Cassa"}
    ];

    useEffect(() => {
        setLoading(true);
        fetchAccounts().then();
        retrieveFees().then();
    }, []);

    const retrieveFees = async () => {
        try {
            const response = await fetchCustom("GET", '/esncard_fees/');
            const json = await response.json();
            if (!response.ok) {
                const errorMessage = await extractErrorMessage(json, response.status);
                setSuccessPopup({message: `Errore fees ESNcard: ${errorMessage}`, state: 'error'});
            } else {
                console.log("ESNcard fees:", json);
                if (profile.latest_esncard && profile.latest_esncard?.is_valid)
                    setAmount(parseFloat(json.esncard_lost_fee.replace('€', '')));
                else
                    setAmount(parseFloat(json.esncard_release_fee.replace('€', '')));
            }
        } catch (error) {
    Sentry.captureException(error);
            setSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
        } finally {
            setLoading(false);
        }
    };

    const fetchAccounts = async () => {
        try {
            const response = await fetchCustom("GET", "/accounts/");
            const json = await response.json();
            if (response.ok) setAccounts(json.results);
            else {
                const errorMessage = await extractErrorMessage(json, response.status);
                setSuccessPopup({message: `Errore durante il recupero delle casse: ${errorMessage}`, state: "error"});
            }
        } catch (error) {
    Sentry.captureException(error);
            setSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
        }
    }

    const resetErrors = () => {
        const resetObj = {};
        Object.keys(errors).forEach(key => {
            resetObj[key] = [false, ''];
        });
        setErrors(resetObj);
        return resetObj;
    };

    const handleSubmit = async () => {
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

        let msg = 'Confermi un pagamento di ' + amount + '€ per l\'emissione della ESNcard?';
        setConfirmDialog({open: true, action: () => doSubmit(), message: msg});
    }

    const doSubmit = async () => {
        setConfirmDialog({open: false, action: null, message: ''});
        try {
            const response = await fetchCustom("POST", '/esncard_emission/', {
                profile_id: profile.id,
                account_id: data.account_id,
                esncard_number: data.esncard_number,
                amount: amount
            });
            if (!response.ok) {
                const json = await response.json();
                const errorMessage = await extractErrorMessage(json, response.status);
                setSuccessPopup({message: `Errore durante l'emissione della ESNcard: ${errorMessage}`, state: 'error'});
            } else onClose(true);
        } catch (error) {
    Sentry.captureException(error);
            setSuccessPopup({message: `Errore generale: ${error}`, state: "error"});
        }
    }

    const handleChange = (e) => {
        setData({
            ...data,
            [e.target.name]: e.target.value,
        });
    };

    return (
        <Modal
            open={open}
            onClose={() => {
                onClose(false);
            }}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description">
            <Box sx={style}>
                {isLoading ? <Loader/> : (<>
                        <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: -2}}>
                            <IconButton onClick={() => onClose(false)} sx={{minWidth: 0}}><CloseIcon/></IconButton>
                        </Box>
                        <Typography variant="h4" component="h2" gutterBottom>Emissione ESNcard</Typography>
                        <Divider sx={{mb: 2}}/>
                        <Typography variant="subtitle1" gutterBottom><b>A:</b> {profile.name} {profile.surname}</Typography>
                        <Typography variant="subtitle1" gutterBottom><b>Importo:</b> {amount}€</Typography>

                        <Grid container spacing={2} direction="column">
                            <Grid size={{xs: 12}} sx={{mt: 2}}>
                                <TextField
                                    required
                                    label='Numero ESNcard'
                                    name='esncard_number'
                                    value={data.esncard_number}
                                    error={errors.esncard_number[0]}
                                    helperText={errors.esncard_number[1]}
                                    onChange={handleChange}
                                    fullWidth/>
                            </Grid>
                            <Grid size={{xs: 12}} sx={{mt: 0}}>
                                <FormControl fullWidth required error={errors.account_id[0]}>
                                    <InputLabel htmlFor="account-selector" sx={{mb: 2}}>Seleziona Cassa</InputLabel>
                                    <Select
                                        variant="outlined"
                                        label="Seleziona Cassa"
                                        labelId="account-selector-label"
                                        id="account-selector"
                                        name="account_id"
                                        value={data.account_id}
                                        error={errors.account_id[0]}
                                        onChange={handleChange}>
                                        {accounts.map((account) => (
                                            <MenuItem
                                                key={account.id}
                                                value={account.id}
                                                disabled={account.status === 'closed'}
                                                style={{color: account.status === 'closed' ? 'grey' : 'inherit'}}>
                                                {account.name} {account.status === 'closed' ? '(Chiusa)' : ''}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    {errors.account_id[0] && <FormHelperText>{errors.account_id[1]}</FormHelperText>}
                                </FormControl>
                            </Grid>
                        </Grid>

                        <Button variant="contained" fullWidth sx={{mt: 2}} onClick={handleSubmit}>Conferma</Button>
                        {successPopup && <Popup message={successPopup.message} state={successPopup.state}/>}
                        <ConfirmDialog
                            open={confirmDialog.open}
                            message={confirmDialog.message}
                            onConfirm={confirmDialog.action}
                            onClose={() => setConfirmDialog({open: false, action: null, message: ''})}
                        />
                    </>
                )}
            </Box>
        </Modal>
    );
}
