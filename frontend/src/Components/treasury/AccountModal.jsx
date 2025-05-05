import React, {useState} from 'react';
import {Modal, Box, TextField, Button, Typography, Grid, IconButton} from '@mui/material';
import {styleESNcardModal as style} from '../../utils/sharedStyles';
import Loader from '../Loader';
import {fetchCustom} from '../../api/api';
import {extractErrorMessage} from '../../utils/errorHandling';
import CloseIcon from '@mui/icons-material/Close';
import Popup from "../Popup";

export default function AccountCreationModal({open, onClose}) {
    const [isLoading, setLoading] = useState(false);
    const [successPopup, setSuccessPopup] = useState(null);
    const [data, setData] = useState({name: ''});
    const [errors, setErrors] = useState({name: [false, '']});

    const handleInputChange = (event) => {
        const {name, value} = event.target;
        setData({...data, [name]: value});
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!data.name.trim()) {
            setErrors({name: [true, 'Il nome è obbligatorio']});
            setSuccessPopup({message: 'Errore: Il nome è obbligatorio', state: 'error'});
            return;
        }

        setLoading(true);
        try {
            const response = await fetchCustom('POST', '/account/', {name: data.name});

            if (!response.ok) {
                const errorMessage = await extractErrorMessage(response);
                setSuccessPopup({message: `Errore creazione cassa: ${errorMessage}`, state: 'error'});
            } else {
                onClose(true);
            }
        } catch (error) {
            console.error('Error creating account:', error);
            const errorMessage = await extractErrorMessage(error);
            setSuccessPopup({message: `Errore generale: ${errorMessage}`, state: 'error'});
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        onClose(false);
    };

    return (
        <Modal open={open} onClose={handleClose}>
            <Box sx={style} component="form" onSubmit={handleSubmit} noValidate>
                {isLoading ? <Loader/> : (<>
                        <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: -2}}>
                            <IconButton onClick={() => onClose(false)} sx={{minWidth: 0}}><CloseIcon/></IconButton>
                        </Box>
                        <Typography variant="h5" gutterBottom align="center">Crea Cassa</Typography>
                        {successPopup && <Popup message={successPopup.message} state={successPopup.state}/>}

                        <Grid container spacing={2}>
                            <Grid size={{xs: 12}}>
                                <TextField
                                    fullWidth
                                    label="Nome della Cassa"
                                    name="name"
                                    value={data.name}
                                    onChange={handleInputChange}
                                    required
                                    error={errors.name[0]}
                                    helperText={errors.name[0] ? errors.name[1] : ''}
                                />
                            </Grid>
                        </Grid>

                        <Box mt={2}>
                            <Button variant="contained" color="primary" type="submit">Crea</Button>
                        </Box>
                    </>
                )}
            </Box>
        </Modal>
    );
}