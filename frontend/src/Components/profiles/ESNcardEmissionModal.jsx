import React, {useEffect, useState} from "react";
import {Button, Box, Divider, FormControl, InputLabel, MenuItem, Modal, Select, Typography, TextField, FormHelperText} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {fetchCustom} from "../../api/api";
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import Grid from '@mui/material/Grid2';
import Popup from "../Popup";

export default function ESNcardEmissionModal({open, profile, onClose}) {
    const [accounts, setAccounts] = useState([]);
    const [amount, setAmount] = useState(0);
    const [showSuccessPopup, setShowSuccessPopup] = useState(null);

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
        const fetchAccounts = async () => {
            try {
                const response = await fetchCustom("GET", '/accounts/');
                const json = await response.json();
                console.log('ESNcardEmissionModal accounts json:', json);
                setAccounts(json.results);
                const feeKey = profile.latest_esncard ? 'esncard_renewal_fee' : 'esncard_release_fee';
                const feeAmount = json.esncard_fees[feeKey];
                setAmount(parseFloat(feeAmount.replace('€', '')));
            } catch (error) {
                console.error('Error in fetching data:', error);
                setShowSuccessPopup({message: "Errore durante il recupero dei dati", state: "error"});
            }
        };
        fetchAccounts().then();
    }, []);

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

        try {
            const response = await fetchCustom("POST", '/esncard_emission/', {
                profile_id: profile.id,
                account_id: data.account_id,
                esncard_number: data.esncard_number,
                amount: amount
            });

            if (!response.ok) {
                const text = await response.text();
                if (text) {
                    try {
                        const errorData = JSON.parse(text);
                        setShowSuccessPopup({message: "Errore durante l\'emissione della ESNcard (" + errorData.message + ")", state: "error"});
                    } catch (parseError) {
                        setShowSuccessPopup({message: "Errore server (" + response.status + "): " + text || 'Nessun dettaglio fornito', state: "error"});
                    }
                } else setShowSuccessPopup({message: "Errore server (" + response.status + ") con risposta vuota", state: "error"});

            } else onClose(true);

        } catch (error) {
            setShowSuccessPopup({message: "Errore durante l\'emissione della ESNcard (" + error.message + ")", state: "error"});
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
            }}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
        >
            <Box sx={style}>
                <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: -2}}>
                    <Button onClick={() => onClose(false)} sx={{minWidth: 0}}>
                        <CloseIcon/>
                    </Button>
                </Box>
                <Typography variant="h4" component="h2" gutterBottom>
                    {!profile.latest_esncard ? 'Emissione' : 'Rinnovo'} ESNcard
                </Typography>
                <Divider sx={{mb: 2}}/>
                <Typography variant="subtitle1" gutterBottom>
                    <b>A:</b> {profile.name} {profile.surname}
                </Typography>
                <Typography variant="subtitle1" gutterBottom>
                    <b>Importo:</b> {amount}€
                </Typography>

                <Grid container spacing={2} direction="column">
                    <Grid xs={12}>
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
                    <Grid xs={12}>
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
                                    <MenuItem key={account.id} value={account.id}>
                                        {account.name}
                                    </MenuItem>
                                ))}
                            </Select>
                            {errors.account_id[0] && <FormHelperText>{errors.account_id[1]}</FormHelperText>}
                        </FormControl>
                    </Grid>
                </Grid>

                <Button variant="contained" fullWidth sx={{mt: 2}} onClick={handleSubmit}>
                    Conferma
                </Button>
                {showSuccessPopup && <Popup message={showSuccessPopup.message} state={showSuccessPopup.state}/>}
            </Box>
        </Modal>
    );
}
