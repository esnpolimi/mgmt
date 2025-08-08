import {useState} from "react";
import {Modal, Box, Typography, TextField, Button, Select, MenuItem, InputLabel, FormControl, FormHelperText, Grid} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import {useAuth} from "../../Context/AuthContext";
import {fetchCustom, defaultErrorHandler} from "../../api/api";
import Popup from "../Popup";
import CircularProgress from "@mui/material/CircularProgress";
import ConfirmDialog from "../ConfirmDialog";

const paymentOptions = [
    {value: "cash", label: "Contanti"},
    {value: "paypal", label: "PayPal"},
    {value: "bonifico", label: "Bonifico"}
];

export default function ReimbursementRequestModal({open, onClose}) {
    const {user} = useAuth();
    const [data, setData] = useState({
        amount: "",
        payment: "",
        description: ""
    });
    const [receiptFile, setReceiptFile] = useState(null);
    const [errors, setErrors] = useState({});
    const [popup, setPopup] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState({open: false, action: null, message: ''});

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

    const handleSubmit = (e) => {
        e.preventDefault();
        resetErrors();
        if (!validate()) return;

        // Confirm dialog for amount or payment method change
        setConfirmDialog({
            open: true,
            action: () => doSubmit(),
            message: `Confermi di voler inviare la richiesta di rimborso di €${data.amount} tramite ${paymentOptions.find(opt => opt.value === data.payment)?.label || data.payment}?`
        });
    };

    const doSubmit = () => {
        setConfirmDialog({open: false, action: null, message: ''});
        setSubmitting(true);

        let body;

        if (receiptFile) {
            body = new FormData();
            body.append('amount', data.amount);
            body.append('payment', data.payment);
            body.append('description', data.description);
            body.append('receiptFile', receiptFile);
        } else {
            body = {
                amount: parseFloat(data.amount),
                payment: data.payment,
                description: data.description,
            };
        }

        fetchCustom('POST', '/reimbursement_request/', {
            body,
            onSuccess: () => onClose(true),
            onError: (err) => defaultErrorHandler(err, setPopup),
            onFinally: () => setSubmitting(false)
        });
    };

    return (
        <Modal open={open} onClose={() => onClose(false)} aria-labelledby="reimbursement-modal-title">
            <Box sx={style}>
                <Box sx={{display: "flex", justifyContent: "flex-end", mb: 0}}>
                    <IconButton onClick={() => onClose(false)}><CloseIcon/></IconButton>
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
                        {receiptFile && (
                            <Button variant="text"
                                    color="error"
                                    fullWidth
                                    sx={{mb: 1}}
                                    onClick={() => setReceiptFile(null)}>
                                Rimuovi file
                            </Button>
                        )}
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
                                   fullWidth/>
                    </Grid>
                </Grid>
                <Button variant="contained"
                        fullWidth
                        sx={{mt: 2, bgcolor: "#1976d2", "&:hover": {bgcolor: "#1565c0"}}}
                        onClick={handleSubmit}
                        disabled={submitting}>
                    {submitting ? <CircularProgress size={24} color="inherit"/> : "Invia Richiesta"}
                </Button>
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