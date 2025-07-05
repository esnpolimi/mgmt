import {useEffect, useState} from 'react';
import {Modal, Box, Grid, Button, FormControl, InputLabel, Select, MenuItem, TextField, CircularProgress, Typography} from '@mui/material';
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";
import {styleESNcardModal as style} from "../../utils/sharedStyles";
import {fetchCustom} from '../../api/api';

export default function ReimburseModal({open, onClose, requestData, onReimbursed}) {
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [description, setDescription] = useState('');
    const [receiptLink, setReceiptLink] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            fetchCustom('GET', '/accounts/?page_size=100').then(async res => {
                if (res.ok) {
                    const json = await res.json();
                    setAccounts(json.results || []);
                }
            });
            setSelectedAccount('');
            setDescription(requestData?.description || '');
            setReceiptLink(requestData?.receipt_link || '');
        }
    }, [open, requestData]);

    const handleSubmit = async () => {
        setLoading(true);
        await fetchCustom('PATCH', `/reimbursement_request/${requestData.id}/`, {
                reimbursed: true, // TODO: add reimbursed status
                account: selectedAccount,
                description: description,
                receipt_link: receiptLink
            }
        );
        setLoading(false);
        onReimbursed && onReimbursed();
        onClose();
    };

    return (
        <Modal open={open} onClose={onClose} aria-labelledby="reimburse-modal-title" fullWidth>
            <Box sx={style}>
                <Box sx={{display: "flex", justifyContent: "flex-end", mb: 0}}>
                    <IconButton onClick={onClose}><CloseIcon/></IconButton>
                </Box>
                <Typography variant="h4" gutterBottom align="center">
                    Rimborsa richiesta
                </Typography>
                <Grid container spacing={2} direction="column" sx={{mt: 2}}>
                    <Grid size={{xs: 12}}>
                        <FormControl fullWidth sx={{mt: 2}}>
                            <InputLabel id="account-label">Cassa</InputLabel>
                            <Select labelId="account-label"
                                    variant="outlined"
                                    value={selectedAccount}
                                    label="Cassa"
                                    onChange={e => setSelectedAccount(e.target.value)}>
                                {accounts.map(acc => (
                                    <MenuItem key={acc.id} value={acc.id}>{acc.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{xs: 12}}>
                        <TextField label="Descrizione"
                                   fullWidth
                                   value={description}
                                   onChange={e => setDescription(e.target.value)}/>
                    </Grid>
                    <Grid size={{xs: 12}}>
                        <TextField label="Link ricevuta"
                                   fullWidth
                                   value={receiptLink}
                                   onChange={e => setReceiptLink(e.target.value)}/>
                    </Grid>
                </Grid>
                <Button onClick={handleSubmit}
                        variant="contained"
                        fullWidth
                        sx={{mt: 2, bgcolor: "#1976d2", "&:hover": {bgcolor: "#1565c0"}}}
                        disabled={!selectedAccount || loading}
                        startIcon={loading ? <CircularProgress size={18}/> : null}>
                    Rimborsa
                </Button>
            </Box>
        </Modal>
    );
}

