import React, {useState} from 'react';
import {Box, Button, FormControl, InputLabel, MenuItem, Select, TextField, Typography} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {LocalizationProvider, DatePicker} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {Checkbox, FormControlLabel} from '@mui/material';
import 'dayjs/locale/en-gb';
import {green} from '@mui/material/colors';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {fetchCustom} from "../api/api";
import countryCodes from "../data/countryCodes";
import {profileDisplayNames} from "../utils/displayAttributes";
import StatusBanner from "../Components/StatusBanner";

export default function ESNerForm() {
    const [isSubmitted, setSubmitted] = React.useState(false)
    const [formStatus, setFormStatus] = useState(null); // null, 'loading', 'success', or 'error'
    const [statusMessage, setStatusMessage] = useState('');
    const names = profileDisplayNames;

    const [formData, setFormData] = React.useState({
        'email': '',
        'email_confirm': '',
        'password': '',
        'password_confirm': '',
        'name': '',
        'surname': '',
        'birthdate': dayjs(),
        'country': 'IT',
        'phone_prefix': '+39',
        'phone_number': '',
        'person_code': '',
        'domicile': '',
        'document-type': '',
        'document-number': '',
        'document-expiration': dayjs(),
        'matricola_number': '',
        'is_esner': true
    });

    const [formErrors, setFormErrors] = React.useState({
        'email': [false, ''],
        'email_confirm': [false, ''],
        'password': [false, ''],
        'password_confirm': [false, ''],
        'name': [false, ''],
        'surname': [false, ''],
        'birthdate': [false, ''],
        'country': [false, ''],
        'phone_prefix': [false, ''],
        'phone_number': [false, ''],
        'person_code': [false, ''],
        'domicile': [false, ''],
        'document-type': [false, ''],
        'document-number': [false, ''],
        'document-expiration': [false, ''],
        'matricola_number': [false, ''],
        'is_esner': [false, '']
    })

    const validateForm = () => {
        let valid = true;
        const newErrors = {...formErrors};

        // Validate matricola (exactly 6 digits)
        const matricolaRegex = /^\d{6}$/;
        if (!matricolaRegex.test(formData['matricola_number'])) {
            newErrors['matricola_number'] = [true, 'Matricola must be exactly 6 digits'];
            valid = false;
        } else newErrors['matricola_number'] = [false, ''];

        // Validate person code (exactly 8 digits)
        const personCodeRegex = /^\d{8}$/;
        if (!personCodeRegex.test(formData['person_code'])) {
            newErrors['person_code'] = [true, 'Person Code must be exactly 8 digits'];
            valid = false;
        } else newErrors['person_code'] = [false, ''];

        // Validate emails equality
        if (formData['email'] !== formData['email_confirm']) {
            newErrors['email_confirm'] = [true, 'Emails do not match'];
            valid = false;
        } else newErrors['email_confirm'] = [false, ''];

        // Validate passwords equality
        if (formData['password'] !== formData['password_confirm']) {
            newErrors['password_confirm'] = [true, 'Passwords not corresponding'];
            valid = false;
        } else newErrors['password_confirm'] = [false, ''];

        setFormErrors(newErrors);
        return valid;
    };

    const scrollUp = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    const formatDateString = (date) => {
        return dayjs(date).format('YYYY-MM-DD');
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleDateChange = (name, date) => {
        setFormData({
            ...formData,
            [name]: date,
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!validateForm()) {
            scrollUp();
            return;
        }

        let body = {
            ...formData,
            'birthdate': formatDateString(formData['birthdate']),
            'document-expiration': formatDateString(formData['document-expiration']),
            'matricola_expiration': formatDateString(formData['matricola_expiration']),
        }

        const submit = async () => {
            try {
                const response = await fetchCustom("POST", '/profile/initiate-creation/', body, {}, false);
                const data = await response.json();
                if (response.ok) {
                    setSubmitted(true);
                } else if (response.status === 400) {
                    setFormStatus('error');
                    setStatusMessage('Failed to submit application: see errors below');
                    const newErrors = {...formErrors};
                    Object.entries(data).forEach(([field, message]) => {
                        if (newErrors[field]) newErrors[field] = [true, message];
                    });
                    setFormErrors(newErrors);
                } else {
                    setFormStatus('error');
                    setStatusMessage('Internal error (please contact us): ' + data.error);
                }
            } catch (error) {
                setFormStatus('error');
                setStatusMessage('Internal error (please contact us): ' + error.message);
            }
        };
        submit().then();
        scrollUp();
    };

    if (isSubmitted) {
        return (
            <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                height="100vh"
                bgcolor="#fff"
            >
                <CheckCircleOutlineIcon style={{fontSize: 100, color: green[500]}}/>
                <Typography variant="h4" align="center" gutterBottom>
                    Your response has been sent.
                </Typography>
                <Typography variant="subtitle1" align="center">
                    Check your inbox to verify your e-mail.
                </Typography>
            </Box>
        );
    }

    return (
        <Box
            component="form"
            sx={{maxWidth: 800, margin: 'auto', mt: 5, mb: 5, px: 4}}
            onSubmit={handleSubmit}
        >
            <Typography variant="h4" align="center" gutterBottom mb={5}>ESN Polimi - Registrazione ESNer</Typography>

            {formStatus && (<StatusBanner status={formStatus} message={statusMessage}/>)}

            <Typography variant="h5" align="center" gutterBottom sx={{my: 4}}>Informazioni Personali</Typography>

            <Grid container spacing={2}>
                <Grid size={{xs: 12, sm: 4}}>
                    <TextField
                        label={names.name}
                        variant="outlined"
                        name="name"
                        value={formData['name']}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors['name'][0]}
                    />
                </Grid>
                <Grid size={{xs: 12, sm: 4}}>
                    <TextField
                        label={names.surname}
                        variant="outlined"
                        name="surname"
                        value={formData['surname']}
                        onChange={handleChange}
                        fullWidth
                        required
                    />
                </Grid>
                <Grid size={{xs: 12, sm: 4}}>
                    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                        <DatePicker
                            label={names.birthdate}
                            value={formData.birthdate}
                            onChange={(date) => handleDateChange('birthdate', date)}
                            renderInput={(params) => <TextField {...params}
                                                                fullWidth
                                                                required
                            />}
                        />
                    </LocalizationProvider>
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                        label={names.email}
                        variant="outlined"
                        name="email"
                        type="email"
                        value={formData['email']}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors['email'][0]}
                        helperText={formErrors['email'][1]}
                    />
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                        label="Conferma Email"
                        variant="outlined"
                        name="email_confirm"
                        type="email"
                        value={formData['email_confirm']}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors['email_confirm'][0]}
                        helperText={formErrors['email_confirm'][1]}
                    />
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                        type="password"
                        label="Password"
                        variant="outlined"
                        name="password"
                        value={formData['password']}
                        onChange={handleChange}
                        fullWidth
                        required
                    />
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                        type="password"
                        label="Conferma Password"
                        variant="outlined"
                        name="password_confirm"
                        value={formData['password_confirm']}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors['password_confirm'][0]}
                        helperText={formErrors['password_confirm'][1]}
                    />
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <FormControl fullWidth required>
                        <InputLabel id="country-label">{names.country}</InputLabel>
                        <Select
                            variant="outlined"
                            labelId="country-label"
                            name="country"
                            value={formData['country']}
                            onChange={handleChange}
                            label={names.country}
                            error={formErrors['country'][0]}
                        >
                            <MenuItem value="">
                                <em>None</em>
                            </MenuItem>
                            {countryCodes.map((country) => (
                                <MenuItem key={country.code} value={country.code}>
                                    {country.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                        label={names.domicile}
                        variant="outlined"
                        name="domicile"
                        value={formData['domicile']}
                        onChange={handleChange}
                        fullWidth
                        required
                    />
                </Grid>
                <Grid size={{xs: 4, sm: 2}}>
                    <FormControl fullWidth>
                        <InputLabel id="phone-prefix-label">{names.phone_prefix}</InputLabel>
                        <Select
                            variant="outlined"
                            labelId="phone-prefix-label"
                            id="phone-prefix"
                            name="phone_prefix"
                            value={formData.phone_prefix}
                            onChange={handleChange}
                            label={names.phone_prefix}
                            renderValue={(value) => value}
                        >
                            {countryCodes.map((country) => (
                                <MenuItem key={country.code} value={country.dial}>
                                    {country.dial} ({country.name})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid size={{xs: 8, sm: 4}}>
                    <TextField
                        label={names.phone_number}
                        variant="outlined"
                        name="phone_number"
                        type="number"
                        value={formData.phone_number}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors.phone_number[0]}
                        helperText={formErrors.phone_number[1]}
                    />
                </Grid>
            </Grid>

            <Typography variant="h5" align="center" gutterBottom my={4}>Informazioni Documento</Typography>
            <Grid container spacing={3}>
                <Grid size={{xs: 12, sm: 4}}>
                    <FormControl fullWidth required>
                        <InputLabel id="idType-label">Tipo</InputLabel>
                        <Select
                            variant="outlined"
                            labelId="document-type-label"
                            name="document-type"
                            value={formData['document-type']}
                            onChange={handleChange}
                            label="Tipo"
                            required
                            error={formErrors['document-type'][0]}
                        >
                            <MenuItem value="Passport">Passport</MenuItem>
                            <MenuItem value="National ID Card">National ID Card</MenuItem>
                            <MenuItem value="Driving License">Driving License</MenuItem>
                            <MenuItem value="Residency Permit">Residency Permit</MenuItem>
                            <MenuItem value="Other">Other</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid size={{xs: 12, sm: 4}}>
                    <TextField
                        label="Numero"
                        variant="outlined"
                        name="document-number"
                        value={formData['document-number']}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors['document-number'][0]}
                        helperText={formErrors['document-number'][1]}
                    />
                </Grid>
                <Grid size={{xs: 12, sm: 4}}>
                    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                        <DatePicker
                            label="Data di Scadenza"
                            value={formData['document-expiration']}
                            onChange={(date) => handleDateChange('document-expiration', date)}
                            renderInput={(params) => <TextField {...params} fullWidth required/>}
                        />
                    </LocalizationProvider>
                </Grid>
            </Grid>

            <Typography variant="h5" align="center" gutterBottom my={4}>Informazioni Studente</Typography>
            <Grid container spacing={3}>
                <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                        label={names.person_code}
                        variant="outlined"
                        name="person_code"
                        type="number"
                        value={formData['person_code']}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors['person_code'][0]}
                        helperText={formErrors['person_code'][1]}
                    />
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                        label={names.matricola_number}
                        variant="outlined"
                        name="matricola_number"
                        type="number"
                        value={formData['matricola_number']}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors['matricola_number'][0]}
                        helperText={formErrors['matricola_number'][1]}
                    />
                </Grid>
            </Grid>

            <Grid container spacing={2} mt={3}>
                <Grid size={{xs: 12}}>
                    <FormControlLabel
                        control={<Checkbox name="acceptTerms" required/>}
                        label="Dichiaro di aver letto e accettato lo Statuto di ESN Politecnico Milano"
                    />
                </Grid>
                <Grid size={{xs: 12}}>
                    <FormControlLabel
                        control={<Checkbox name="acceptPrivacyPolicy" required/>}
                        label="Dichiaro di condividere pienamente gli scopi dell'Associazione (rif. Articolo 2 dello Statuto)"
                    />
                </Grid>
                <Grid size={{xs: 12}}>
                    <FormControlLabel
                        control={<Checkbox name="acceptPrivacyPolicy" required/>}
                        label="Dichiaro di accettare tutti i termini indicati nello Statuto, nel Regolamento Interno e tutte le successive modifiche e integrazioni"
                    />
                </Grid>
                <Grid size={{xs: 12}}>
                    <FormControlLabel
                        control={<Checkbox name="acceptPrivacyPolicy" required/>}
                        label="Dichiaro di aver letto l'informativa sulla Privacy allegata e di acconsentire al trattamento dei miei dati personali secondo il Regolamento UE 2016/679 (GDPR) e di essere consapevole dei miei diritti garantiti dalla suddetta legge"
                    />
                </Grid>
            </Grid>


            <Button type="submit" variant="contained" color="primary" fullWidth sx={{mt: 4}}>
                Conferma Dati
            </Button>
        </Box>
    );
}