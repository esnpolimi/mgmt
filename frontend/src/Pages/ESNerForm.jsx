import React, {useState} from 'react';
import {Box, Button, FormControl, InputLabel, MenuItem, Select, TextField, Typography, Grid} from '@mui/material';
import {LocalizationProvider, DatePicker} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {Checkbox, FormControlLabel} from '@mui/material';
import 'dayjs/locale/en-gb';
import {green} from '@mui/material/colors';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {fetchCustom} from "../api/api";
import countryCodes from "../data/countryCodes.json";
import {profileDisplayNames} from "../utils/displayAttributes";
import StatusBanner from "../Components/StatusBanner";
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import LoginIcon from '@mui/icons-material/Login';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import * as Sentry from "@sentry/react";

export default function ESNerForm() {
    const [isSubmitted, setSubmitted] = React.useState(false)
    const [statusMessage, setStatusMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [capsLockActive, setCapsLockActive] = useState({password: false, password_confirm: false});
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
        'document_type': 'ID Card',
        'document_number': '',
        'document_expiration': dayjs(),
        'matricola_number': '',
        'is_esner': true
    });

    /*const [formData, setFormData] = React.useState({
        email: 'teopompil@gmail.com',
        email_confirm: 'teopompil@gmail.com',
        password: '1Unoduetrequattro',
        password_confirm: '1Unoduetrequattro',
        name: 'Giampiero',
        surname: 'Bassini',
        birthdate: dayjs(),
        country: 'IT',
        phone_prefix: '+39',
        phone_number: '11111111',
        person_code: '11223344',
        domicile: 'via bassini 1, Milano',
        document_type: 'ID Card',
        document_number: '343536gffgdg',
        document_expiration: dayjs(),
        matricola_number: '263544',
        is_esner: true
    });*/

    const initialFormErrors = {
        email: [false, ''],
        email_confirm: [false, ''],
        password: [false, ''],
        password_confirm: [false, ''],
        name: [false, ''],
        surname: [false, ''],
        birthdate: [false, ''],
        country: [false, ''],
        phone_prefix: [false, ''],
        phone_number: [false, ''],
        person_code: [false, ''],
        domicile: [false, ''],
        document_type: [false, ''],
        document_number: [false, ''],
        document_expiration: [false, ''],
        matricola_number: [false, ''],
        is_esner: [false, '']
    };

    const [formErrors, setFormErrors] = React.useState(initialFormErrors);

    // Add state for checkboxes
    const [checkboxes, setCheckboxes] = useState({
        acceptStatute: false,
        acceptPurposes: false,
        acceptRegulation: false,
        acceptPrivacy: false,
    });

    // Track checkbox errors
    const [checkboxErrors, setCheckboxErrors] = useState({
        acceptStatute: false,
        acceptPurposes: false,
        acceptRegulation: false,
        acceptPrivacy: false,
    });

    // Example links (replace with your actual URLs)
    const links = {
        statute: "https://drive.google.com/file/d/1rYtF01hrvQDIYHPebn1nNTDUOazS0kK2/view?usp=sharing", // In Italian
        regulation: "https://drive.google.com/file/d/1ZuPfEshihDJ3lvoKyiQ_1L1BpsxBuZdq/view?usp=sharing", // In Italian
        privacy: "https://drive.google.com/file/d/12LY0y49cCyjqdF0RotsO6srHrGkinNln/view?usp=sharing" // In English
    };

    const passwordRequirements = [
        {
            label: "Almeno 10 caratteri",
            test: (pw) => pw.length >= 10
        },
        {
            label: "Almeno 1 numero",
            test: (pw) => /\d/.test(pw)
        },
        {
            label: "Almeno 1 lettera maiuscola",
            test: (pw) => /[A-Z]/.test(pw)
        }
    ];

    const validateForm = () => {
        let valid = true;
        const newErrors = {...formErrors};
        const newCheckboxErrors = {...checkboxErrors};

        const requiredFields = [
            'email', 'email_confirm', 'password', 'password_confirm',
            'name', 'surname', 'birthdate', 'country', 'phone_prefix',
            'phone_number', 'person_code', 'domicile', 'document_type',
            'document_number', 'document_expiration', 'matricola_number'
        ];

        requiredFields.forEach(field => {
            if (!formData[field] || (typeof formData[field] === 'string' && formData[field].trim() === '')) {
                newErrors[field] = [true, 'Questo campo è obbligatorio'];
                valid = false;
            } else {
                newErrors[field] = [false, ''];
            }
        });

        // Validate matricola (exactly 6 digits)
        const matricolaRegex = /^\d{6}$/;
        if (!matricolaRegex.test(formData.matricola_number)) {
            newErrors.matricola_number = [true, 'La Matricola deve essere di 6 cifre'];
            valid = false;
        } else newErrors.matricola_number = [false, ''];

        // Validate person code (exactly 8 digits)
        const personCodeRegex = /^\d{8}$/;
        if (!personCodeRegex.test(formData.person_code)) {
            newErrors.person_code = [true, 'Il Codice Persona deve essere di 8 cifre'];
            valid = false;
        } else newErrors.person_code = [false, ''];

        // Email format regex (simple version)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (formData.email && !emailRegex.test(formData.email)) {
            newErrors.email = [true, 'Formato email non valido'];
            valid = false;
        }

        // Validate emails equality
        if (formData.email !== formData.email_confirm) {
            newErrors.email_confirm = [true, 'Le email non corrispondono'];
            valid = false;
        } else newErrors.email_confirm = [false, ''];

        // Validate passwords equality
        if (formData.password !== formData.password_confirm) {
            newErrors.password_confirm = [true, 'Le password non corrispondono'];
            valid = false;
        } else newErrors.password_confirm = [false, ''];

        // Checkbox validation
        Object.entries(checkboxes).forEach(([key, value]) => {
            if (!value) {
                newCheckboxErrors[key] = true;
                valid = false;
            } else {
                newCheckboxErrors[key] = false;
            }
        });

        setFormErrors(newErrors);
        setCheckboxErrors(newCheckboxErrors);
        if (!valid) setStatusMessage({message: "Errore nella compilazione del form, controlla i campi evidenziati.", state: "error"});
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
        // Reset error for this field
        if (formErrors[e.target.name]) {
            setFormErrors({
                ...formErrors,
                [e.target.name]: [false, '']
            });
        }
    };

    const handleDateChange = (name, date) => {
        setFormData({
            ...formData,
            [name]: date,
        });
    };

    const handleCheckboxChange = (e) => {
        const {name, checked} = e.target;
        setCheckboxes({
            ...checkboxes,
            [name]: checked
        });

        // Reset checkbox error when checked
        if (checked) {
            setCheckboxErrors({
                ...checkboxErrors,
                [name]: false
            });
        }
    }

    const handlePasswordKeyDown = (field) => (e) => {
        setCapsLockActive((prev) => ({
            ...prev,
            [field]: e.getModifierState && e.getModifierState('CapsLock')
        }));
    };

    const handlePasswordKeyUp = (field) => (e) => {
        setCapsLockActive((prev) => ({
            ...prev,
            [field]: e.getModifierState && e.getModifierState('CapsLock')
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!validateForm()) {
            // Banner is already set in validateForm
            scrollUp();
            return;
        }

        setStatusMessage(null);
        setIsLoading(true);

        let body = {
            ...formData,
            birthdate: formatDateString(formData.birthdate),
            document_expiration: formatDateString(formData.document_expiration),
            matricola_expiration: formatDateString(formData.matricola_expiration),
        }

        const submit = async () => {
            try {
                const response = await fetchCustom("POST", '/profile/initiate-creation/', body, {}, false);
                const data = await response.json();
                setFormErrors(initialFormErrors);
                if (!response.ok) {
                    setStatusMessage({message: 'Errore nell\'invio dati, guarda gli errori sotto', state: 'error'});
                    const newErrors = {...formErrors};
                    Object.entries(data).forEach(([field, message]) => {
                        if (newErrors[field]) newErrors[field] = [true, message];
                    });
                    setFormErrors(newErrors);
                } else {
                    setSubmitted(true);
                }
            } catch (error) {
                Sentry.captureException(error);
                setStatusMessage({message: 'Internal error (please contact us): ' + error.message, state: 'error'});
            } finally {
                setIsLoading(false);
            }
        };
        submit().then();
    };

    if (isSubmitted) {
        return (
            <Box display="flex"
                 flexDirection="column"
                 alignItems="center"
                 justifyContent="center"
                 height="100vh"
                 bgcolor="#fff">
                <CheckCircleOutlineIcon style={{fontSize: 100, color: green[500]}}/>
                <Typography variant="h4" align="center" gutterBottom>
                    La tua richiesta di registrazione è stata inviata con successo!
                </Typography>
                <Typography variant="subtitle1" align="center">
                    Controlla la tua email per ulteriori istruzioni.
                </Typography>
                <Typography variant="body2" align="center" sx={{mt: 2}}>
                    In caso non avessi ricevuto nulla, controlla la cartella spam o contattaci all&apos;indirizzo <Link href="mailto: informatica@esnpolimi.it">informatica@esnpolimi.it</Link>
                </Typography>
                <Link href="/login" underline="always" sx={{mt: 3}}>
                    Torna al Login
                </Link>
            </Box>
        );
    }

    return (
        <Box component="form" noValidate sx={{maxWidth: 800, margin: 'auto', mt: 5, mb: 5, px: 4}} onSubmit={handleSubmit}>
            <Typography variant="h4" align="center" gutterBottom mb={5}>ESN Polimi - Registrazione ESNer</Typography>

            {statusMessage && (<StatusBanner message={statusMessage.message} state={statusMessage.state}/>)}

            <Typography variant="h5" align="center" gutterBottom sx={{my: 4}}>Informazioni Personali</Typography>

            <Grid container spacing={2}>
                <Grid size={{xs: 12, sm: 4}}>
                    <TextField
                        label={names.name}
                        variant="outlined"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors.name[0]}
                        helperText={formErrors.name[1]}/>
                </Grid>
                <Grid size={{xs: 12, sm: 4}}>
                    <TextField
                        label={names.surname}
                        variant="outlined"
                        name="surname"
                        value={formData.surname}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors.surname[0]}
                        helperText={formErrors.surname[1]}/>
                </Grid>
                <Grid size={{xs: 12, sm: 4}}>
                    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                        <DatePicker
                            label={names.birthdate}
                            value={formData.birthdate}
                            onChange={(date) => handleDateChange('birthdate', date)}
                            maxDate={dayjs()}
                            required
                            slotProps={{textField: {variant: 'outlined'}}}/>
                    </LocalizationProvider>
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                        label={names.email}
                        variant="outlined"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors.email[0]}
                        helperText={formErrors.email[1]}/>
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                        label="Conferma Email"
                        variant="outlined"
                        name="email_confirm"
                        type="email"
                        value={formData.email_confirm}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors.email_confirm[0]}
                        helperText={formErrors.email_confirm[1]}/>
                    <Box sx={{mt: 1}}>
                        {formData.email_confirm && (
                            <Typography variant="caption" sx={{display: 'flex', alignItems: 'center', color: formData.email === formData.email_confirm ? 'green' : 'grey'}}>
                                {formData.email === formData.email_confirm
                                    ? <CheckIcon fontSize="small" sx={{mr: 0.5}}/>
                                    : <CloseIcon fontSize="small" sx={{mr: 0.5}}/>
                                }
                                {formData.email === formData.email_confirm
                                    ? "Le due email coincidono"
                                    : "Le email non corrispondono"}
                            </Typography>
                        )}
                    </Box>
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                        type="password"
                        label="Password"
                        variant="outlined"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        onKeyDown={handlePasswordKeyDown('password')}
                        onKeyUp={handlePasswordKeyUp('password')}
                        fullWidth
                        required
                        error={formErrors.password[0]}
                        helperText={formErrors.password[1]}/>
                    {/* Caps Lock warning */}
                    {capsLockActive.password && (
                        <Box sx={{display: 'flex', alignItems: 'center', color: 'orange', mt: 0.5}}>
                            <WarningAmberIcon fontSize="small" sx={{mr: 0.5}}/>
                            <Typography variant="caption">Attenzione: il tasto Bloc Maiusc è attivo</Typography>
                        </Box>
                    )}
                    <Box sx={{mt: 1, mb: 2}}>
                        <Typography variant="caption" color="text.secondary">
                            La password deve contenere:
                        </Typography>
                        <ul style={{margin: 0, paddingLeft: 20}}>
                            {passwordRequirements.map((req, idx) => {
                                const passed = req.test(formData.password);
                                return (
                                    <li key={idx} style={{color: passed ? 'green' : 'grey', display: 'flex', alignItems: 'center', mb: 2}}>
                                        {passed ? <CheckIcon fontSize="small" sx={{mr: 0.5}}/> : <CloseIcon fontSize="small" sx={{mr: 0.5}}/>}
                                        <span>{req.label}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </Box>
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                        type="password"
                        label="Conferma Password"
                        variant="outlined"
                        name="password_confirm"
                        value={formData.password_confirm}
                        onChange={handleChange}
                        onKeyDown={handlePasswordKeyDown('password_confirm')}
                        onKeyUp={handlePasswordKeyUp('password_confirm')}
                        fullWidth
                        required
                        error={formErrors.password_confirm[0]}
                        helperText={formErrors.password_confirm[1]}/>
                    {capsLockActive.password_confirm && (
                        <Box sx={{display: 'flex', alignItems: 'center', color: 'orange', mt: 0.5}}>
                            <WarningAmberIcon fontSize="small" sx={{mr: 0.5}}/>
                            <Typography variant="caption">Attenzione: il tasto Bloc Maiusc è attivo</Typography>
                        </Box>
                    )}
                    <Box sx={{mt: 1}}>
                        {formData.password_confirm && (
                            <Typography variant="caption" sx={{display: 'flex', alignItems: 'center', color: formData.password === formData.password_confirm ? 'green' : 'grey'}}>
                                {formData.password === formData.password_confirm
                                    ? <CheckIcon fontSize="small" sx={{mr: 0.5}}/>
                                    : <CloseIcon fontSize="small" sx={{mr: 0.5}}/>
                                }
                                {formData.password === formData.password_confirm
                                    ? "Le password corrispondono"
                                    : "Le password non corrispondono"}
                            </Typography>
                        )}
                    </Box>
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <FormControl fullWidth required>
                        <InputLabel id="country-label">{names.country}</InputLabel>
                        <Select variant="outlined"
                                labelId="country-label"
                                name="country"
                                value={formData.country}
                                onChange={handleChange}
                                label={names.country}
                                error={formErrors.country[0]}>
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
                        value={formData.domicile}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors.domicile[0]}
                        helperText={formErrors.domicile[1]}/>
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
                            error={formErrors.phone_prefix[0]}>
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
                        helperText={formErrors.phone_number[1]}/>
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
                            name="document_type"
                            value={formData.document_type}
                            onChange={handleChange}
                            label="Tipo"
                            required
                            error={formErrors.document_type[0]}>
                            <MenuItem value="Passport">Passport</MenuItem>
                            <MenuItem value="ID Card">ID Card</MenuItem>
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
                        name="document_number"
                        value={formData.document_number}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors.document_number[0]}
                        helperText={formErrors.document_number[1]}/>
                </Grid>
                <Grid size={{xs: 12, sm: 4}}>
                    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                        <DatePicker
                            label="Data di Scadenza"
                            value={formData.document_expiration}
                            onChange={(date) => handleDateChange('document_expiration', date)}
                            slotProps={{textField: {variant: 'outlined'}}}/>
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
                        value={formData.person_code}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors.person_code[0]}
                        helperText={formErrors.person_code[1]}/>
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                        label={names.matricola_number}
                        variant="outlined"
                        name="matricola_number"
                        type="number"
                        value={formData.matricola_number}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors.matricola_number[0]}
                        helperText={formErrors.matricola_number[1]}/>
                </Grid>
            </Grid>

            <Grid container spacing={2} mt={3}>
                <Grid size={{xs: 12}}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                name="acceptStatute"
                                checked={checkboxes.acceptStatute}
                                onChange={handleCheckboxChange}
                                required
                                sx={{
                                    color: checkboxErrors.acceptStatute ? 'red' : undefined,
                                    '&.Mui-checked': {color: checkboxErrors.acceptStatute ? 'red' : undefined}
                                }}/>
                        }
                        label={
                            <span>
                                Dichiaro di aver letto e accettato lo{' '}
                                <Link href={links.statute} target="_blank" rel="noopener noreferrer" underline="always">
                                    Statuto di ESN Politecnico Milano
                                </Link>
                            </span>
                        }/>
                </Grid>
                <Grid size={{xs: 12}}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                name="acceptPurposes"
                                checked={checkboxes.acceptPurposes}
                                onChange={handleCheckboxChange}
                                required
                                sx={{
                                    color: checkboxErrors.acceptPurposes ? 'red' : undefined,
                                    '&.Mui-checked': {color: checkboxErrors.acceptPurposes ? 'red' : undefined}
                                }}/>
                        }
                        label="Dichiaro di condividere pienamente gli scopi dell'Associazione (rif. Articolo 2 dello Statuto)"
                    />
                </Grid>
                <Grid size={{xs: 12}}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                name="acceptRegulation"
                                checked={checkboxes.acceptRegulation}
                                onChange={handleCheckboxChange}
                                required
                                sx={{
                                    color: checkboxErrors.acceptRegulation ? 'red' : undefined,
                                    '&.Mui-checked': {color: checkboxErrors.acceptRegulation ? 'red' : undefined}
                                }}/>
                        }
                        label={
                            <span>
                                Dichiaro di accettare tutti i termini indicati nello{' '}
                                <Link href={links.regulation} target="_blank" rel="noopener noreferrer" underline="always">
                                    Regolamento Interno
                                </Link>
                                {' '}e tutte le successive modifiche e integrazioni
                            </span>
                        }/>
                </Grid>
                <Grid size={{xs: 12}}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                name="acceptPrivacy"
                                checked={checkboxes.acceptPrivacy}
                                onChange={handleCheckboxChange}
                                required
                                sx={{
                                    color: checkboxErrors.acceptPrivacy ? 'red' : undefined,
                                    '&.Mui-checked': {color: checkboxErrors.acceptPrivacy ? 'red' : undefined}
                                }}/>
                        }
                        label={
                            <span>
                                Dichiaro di aver letto l&apos;
                                <Link href={links.privacy} target="_blank" rel="noopener noreferrer" underline="always">
                                    Informativa sulla Privacy
                                </Link>
                                {' '}e di acconsentire al trattamento dei miei dati personali secondo il Regolamento UE 2016/679 (GDPR) e di essere consapevole dei miei diritti garantiti dalla suddetta legge
                            </span>
                        }/>
                </Grid>
            </Grid>

            <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                sx={{mt: 4}}
                startIcon={!isLoading && <LoginIcon/>}
                disabled={isLoading}>
                {isLoading ? <CircularProgress size={24} color="inherit"/> : "Conferma Dati"}
            </Button>
        </Box>
    );
}