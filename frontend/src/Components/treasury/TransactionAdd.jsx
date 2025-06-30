import {useState} from 'react';
import {Button, TextField, FormControl, InputLabel, Select, MenuItem, Typography, IconButton, Box, Modal, Grid} from '@mui/material';
import {fetchCustom} from '../../api/api';
import CloseIcon from "@mui/icons-material/Close";
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import {useAuth} from "../../Context/AuthContext";
import * as Sentry from "@sentry/react";

export default function TransactionAdd({open, onClose, account, onSuccess}) {
    const {user} = useAuth();
    const [formData, setFormData] = useState({
        amount: '',
        type: 'deposit',
        description: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetchCustom('POST', '/transaction/', {
                account: account.id,
                amount: formData.type === 'deposit' ? Math.abs(formData.amount) : -Math.abs(formData.amount),
                description: formData.description,
                type: formData.type,
                executor: user.profile.email
            });
            if (response.ok) {
                onSuccess('Transazione registrata con successo');
                onClose();
            } else {
                const error = await response.json();
                onSuccess('Errore durante la registrazione: ' + JSON.stringify(error), 'error');
            }
        } catch (error) {
            Sentry.captureException(error);
            onSuccess('Errore durante la registrazione: ' + error.message, 'error');
        }
    };

    const handleClose = () => onClose(false);

    return (
        <Modal open={open} onClose={handleClose}>
            <Box sx={style} component="form" onSubmit={handleSubmit} noValidate>
                <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: -2}}>
                    <IconButton onClick={handleClose} sx={{minWidth: 0}}> <CloseIcon/> </IconButton>
                </Box>
                <Typography variant="h5" gutterBottom align="center" sx={{mt: 2}}>
                    Transazione Manuale - Cassa {account?.name}
                </Typography>
                <Grid container spacing={2} sx={{mt: 2}}>
                    <FormControl fullWidth>
                        <InputLabel>Tipo</InputLabel>
                        <Select
                            variant="outlined"
                            value={formData.type}
                            label="Tipo"
                            onChange={(e) => setFormData({...formData, type: e.target.value})}>
                            <MenuItem value="deposit">Deposito</MenuItem>
                            <MenuItem value="withdrawal">Prelievo</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        margin="dense"
                        label="Importo"
                        type="number"
                        fullWidth
                        value={formData.amount}
                        slotProps={{htmlInput: {min: "0.01", step: "0.01"}}}
                        onChange={(e) => setFormData({...formData, amount: e.target.value})}/>
                    <TextField
                        margin="dense"
                        label="Descrizione"
                        type="text"
                        fullWidth
                        multiline
                        rows={2}
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}/>
                </Grid>
                <Box mt={2}>
                    <Button fullWidth onClick={onClose}>Annulla</Button>
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        type="submit"
                        disabled={!formData.amount || formData.amount <= 0}>
                        Conferma
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
}
