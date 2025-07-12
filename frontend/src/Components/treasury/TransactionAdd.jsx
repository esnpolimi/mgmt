import {useState, useEffect} from 'react';
import {Button, TextField, FormControl, InputLabel, Select, MenuItem, Typography, IconButton, Box, Modal, Grid} from '@mui/material';
import {defaultErrorHandler, fetchCustom} from '../../api/api';
import CloseIcon from "@mui/icons-material/Close";
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import {useAuth} from "../../Context/AuthContext";
import Popup from "../Popup";
import CircularProgress from "@mui/material/CircularProgress";

export default function TransactionAdd({open, onClose, account}) {
    const {user} = useAuth();
    const [popup, setPopup] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        amount: '',
        type: 'deposit',
        description: ''
    });

    useEffect(() => {
        if (open) {
            setFormData({
                amount: '',
                type: 'deposit',
                description: ''
            });
        }
    }, [open]);


    const handleSubmit = (e) => {
        e.preventDefault();
        setSubmitting(true);
        fetchCustom('POST', '/transaction/', {
            body: {
                account: account.id,
                amount: formData.type === 'deposit' ? Math.abs(formData.amount) : -Math.abs(formData.amount),
                description: formData.description,
                type: formData.type,
                executor: user.profile.email
            },
            onSuccess: () => onClose(true),
            onError: (responseOrError) => defaultErrorHandler(responseOrError, setPopup),
            onFinally: () => setSubmitting(false)
        });
    };

    return (
        <Modal open={open} onClose={() => onClose(false)}>
            <Box sx={style} component="form" onSubmit={handleSubmit} noValidate>
                <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: -2}}>
                    <IconButton onClick={() => onClose(false)} sx={{minWidth: 0}}> <CloseIcon/> </IconButton>
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
                        label="Importo in € (decimali con punto)"
                        type="number"
                        fullWidth
                        required
                        value={formData.amount}
                        slotProps={{htmlInput: {min: "0.01", step: "0.01"}}}
                        onChange={(e) => setFormData({...formData, amount: e.target.value})}/>
                    <TextField
                        margin="dense"
                        label="Descrizione"
                        type="text"
                        fullWidth
                        required
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}/>
                </Grid>
                <Box mt={2}>
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        type="submit"
                        disabled={submitting || !formData.amount || formData.amount <= 0}>
                        {submitting ? <CircularProgress size={24} color="inherit"/> : "Conferma"}
                    </Button>
                </Box>
                {popup && <Popup message={popup.message} state={popup.state} />}
            </Box>
        </Modal>
    );
}
