import {useState} from "react";
import {Modal, Box, Typography, TextField, Button, Select, MenuItem, InputLabel, FormControl, FormHelperText, Grid} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import {useAuth} from "../../Context/AuthContext";
import {fetchCustom} from "../../api/api";
import * as Sentry from "@sentry/react";

const paymentOptions = [
    {value: "cash", label: "Contanti"},
    {value: "paypal", label: "PayPal"},
    {value: "bonifico", label: "Bonifico Bancario"}
];

export default function ReimbursementRequestModal({open, onClose, onSuccess}) {
    const {user} = useAuth();
    const [data, setData] = useState({
        amount: "",
        payment: "",
        description: ""
    });
    const [receiptFile, setReceiptFile] = useState(null);
    const [errors, setErrors] = useState({});

    const resetErrors = () => setErrors({});

    const validate = () => {
        const newErrors = {};
        if (!data.amount) newErrors.amount = "Importo richiesto obbligatorio";
        if (!data.payment) newErrors.payment = "Metodo di rimborso obbligatorio";
        if (!data.description) newErrors.description = "Descrizione obbligatoria";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        setData({...data, [e.target.name]: e.target.value});
    };

    const handleFileChange = (e) => {
        setReceiptFile(e.target.files && e.target.files[0] ? e.target.files[0] : null);
    };

    const handlePaymentChange = (e) => {
        setData({
            ...data,
            payment: e.target.value,
            paypalEmail: "",
            iban: "",
            bank: "",
            accountHolder: ""
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        resetErrors();
        if (!validate()) return;

        try {
            const response = await fetchCustom('POST', '/reimbursement_request/', {
                amount: parseFloat(data.amount),
                payment: data.payment,
                description: data.description,
                receiptFile: receiptFile ? receiptFile : null,
                user: user.profile.email
            });
            if (response.ok) {
                onSuccess('Richiesta inviata!');
                onClose();
            } else {
                const error = await response.json();
                onSuccess('Errore durante la richiesta: ' + JSON.stringify(error), 'error');
            }
        } catch (error) {
            Sentry.captureException(error);
            onSuccess('Errore generale: ' + error.message, 'error');
        }
    };

    return (
        <Modal open={open} onClose={onClose} aria-labelledby="reimbursement-modal-title">
            <Box sx={style}>
                <Box sx={{display: "flex", justifyContent: "flex-end", mb: 0}}>
                    <IconButton onClick={onClose}><CloseIcon/></IconButton>
                </Box>
                <Typography variant="h4" gutterBottom align="center">
                    Richiesta Rimborso
                </Typography>
                <Typography variant="subtitle1" gutterBottom sx={{mt: 2}}>
                    <b>Richiedente:</b> {user.profile.name} {user.profile.surname}
                </Typography>
                <Grid container spacing={2} direction="column" sx={{mt: 2}}>
                    <Grid size={{xs: 12}}>
                        <TextField label="Importo in € (decimali con punto)"
                                   name="amount"
                                   type="number"
                                   value={data.amount}
                                   onChange={handleChange}
                                   required
                                   slotProps={{htmlInput: {min: "0.01", step: "0.01"}}}
                                   error={!!errors.amount}
                                   helperText={errors.amount}
                                   fullWidth/>
                    </Grid>
                    <Grid size={{xs: 12}}>
                        <FormControl fullWidth required error={!!errors.payment}>
                            <InputLabel id="payment-label">Metodo di rimborso</InputLabel>
                            <Select labelId="payment-label"
                                    variant="outlined"
                                    name="payment"
                                    value={data.payment}
                                    label="Metodo di rimborso"
                                    onChange={handlePaymentChange}>
                                {paymentOptions.map(opt => (
                                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                ))}
                            </Select>
                            {errors.payment && <FormHelperText>{errors.payment}</FormHelperText>}
                        </FormControl>
                    </Grid>
                    <Grid size={{xs: 12}}>
                        <Button variant={receiptFile ? "outlined" : "text"}
                                component="label"
                                fullWidth
                                sx={{mb: 1}}>
                            {receiptFile ? `File selezionato: ${receiptFile.name}` : "Carica ricevuta"}
                            <input type="file"
                                   accept="application/pdf,image/*"
                                   hidden
                                   onChange={handleFileChange}/>
                        </Button>
                        {/* Optionally show error if receipt is required */}
                        {/* <FormHelperText error={!!errors.receiptFile}>{errors.receiptFile}</FormHelperText> */}
                    </Grid>
                    {(data.payment === "paypal" || data.payment === "bonifico") && (
                        <Grid size={{xs: 12}}>
                            <Typography variant="body2" color="warning.main" sx={{mb: 1}}>
                                {data.payment === "paypal"
                                    ? "⚠️ Ricordati di inserire nella descrizione anche l'email PayPal a cui inviare il rimborso."
                                    : "⚠️ Ricordati di inserire nella descrizione anche i dati bancari (IBAN, banca, intestatario) a cui inviare il rimborso."}
                            </Typography>
                        </Grid>
                    )}
                    <Grid size={{xs: 12}}>
                        <TextField label="Descrizione"
                                   name="description"
                                   value={data.description}
                                   onChange={handleChange}
                                   required
                                   error={!!errors.description}
                                   helperText={errors.description}
                                   multiline
                                   rows={2}
                                   fullWidth/>
                    </Grid>
                </Grid>
                <Button variant="contained"
                        fullWidth
                        sx={{mt: 2, bgcolor: "#1976d2", "&:hover": {bgcolor: "#1565c0"}}}
                        onClick={handleSubmit}>
                    Invia Richiesta
                </Button>
            </Box>
        </Modal>
    );
}