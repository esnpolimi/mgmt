import React, {useState} from 'react';
import {Box, Button, FormControl, InputLabel, MenuItem, Select, TextField, Typography, Grid} from '@mui/material';
import {LocalizationProvider, DatePicker} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {Checkbox, FormControlLabel} from '@mui/material';
import {ToggleButton, ToggleButtonGroup} from '@mui/material';
import FormLabel from '@mui/material/FormLabel';
import 'dayjs/locale/en-gb';
import {green} from '@mui/material/colors';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {defaultErrorHandler, fetchCustom} from "../api/api";
import countryCodes from "../data/countryCodes.json";
import StatusBanner from '../Components/StatusBanner';
import Link from '@mui/material/Link';
import CircularProgress from '@mui/material/CircularProgress';
import LoginIcon from '@mui/icons-material/Login';
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import logo from '../assets/esnpolimi-logo.png';

export default function ErasmusForm() {
    const [isSubmitted, setSubmitted] = React.useState(false)
    const [sameWAasPhone, setSameWAasPhone] = React.useState(true);
    const [statusMessage, setStatusMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Add checkbox state and error state
    const [checkboxes, setCheckboxes] = useState({
        acceptStatute: false,
        acceptPurposes: false,
        acceptRegulation: false,
        acceptPrivacy: false,
    });
    const [checkboxErrors, setCheckboxErrors] = useState({
        acceptStatute: false,
        acceptPurposes: false,
        acceptRegulation: false,
        acceptPrivacy: false,
    });

    const links = {
        statute: "https://drive.google.com/file/d/1b0gpA3x9yRuAcdEWQyc9KvrnZzm0l-dB/view?usp=sharing", // In English
        regulation: "https://drive.google.com/file/d/1_s0uBvqfOLRz5rQp1EEeNgtxRjs7Pgxy/view?usp=sharing", // In English
        privacy: "https://drive.google.com/file/d/12LY0y49cCyjqdF0RotsO6srHrGkinNln/view?usp=sharing" // In English
    };

    const [formData, setFormData] = React.useState({
        name: '',
        surname: '',
        email: '',
        email_confirm: '',
        birthdate: dayjs(),
        country: '',
        phone_prefix: '+39',
        phone_number: '',
        whatsapp_prefix: '+39',
        whatsapp_number: '',
        person_code: '',
        domicile: '',
        course: '',
        document_type: 'ID Card',
        document_number: '',
        document_expiration: dayjs(),
        matricola_number: '',
        matricola_expiration: dayjs(),
        is_esner: false,
        mobility_semesters: 1
    });

    /*const [formData, setFormData] = React.useState({
        'name': 'Giampiero',
        'surname': 'Bassini',
        'email': 'informatica@esnpolimi.it',
        'email_confirm': 'informatica@esnpolimi.it',
        'birthdate': dayjs(),
        'country': 'IT',
        'phone_prefix': '+39',
        'phone_number': '111111112',
        'whatsapp_prefix': '+39',
        'whatsapp_number': '',
        'person_code': '65432101',
        'domicile': 'via bassini 1, Milano',
        'course': 'Design',
        'document_type': 'ID Card',
        'document_number': '324153gfd3',
        'document_expiration': dayjs(),
        'matricola_number': '653463',
        'matricola_expiration': dayjs(),
        'is_esner': false,
        mobility_semesters: 1
    });*/


    const initialFormErrors = {
        email: [false, ''],
        email_confirm: [false, ''],
        name: [false, ''],
        surname: [false, ''],
        birthdate: [false, ''],
        country: [false, ''],
        phone_prefix: [false, ''],
        phone_number: [false, ''],
        whatsapp_prefix: [false, ''],
        whatsapp_number: [false, ''],
        person_code: [false, ''],
        domicile: [false, ''],
        course: [false, ''],
        document_type: [false, ''],
        document_number: [false, ''],
        document_expiration: [false, ''],
        matricola_number: [false, ''],
        matricola_expiration: [false, ''],
        is_esner: [false, '']
    };

    const [formErrors, setFormErrors] = React.useState(initialFormErrors);

    const validateForm = () => {
        let valid = true;
        const newErrors = {...formErrors};
        const newCheckboxErrors = {...checkboxErrors};

        // Required fields
        const requiredFields = [
            'email', 'email_confirm', 'name', 'surname', 'birthdate', 'country', 'phone_prefix',
            'phone_number', 'person_code', 'domicile', 'course', 'document_type',
            'document_number', 'document_expiration', 'matricola_number', 'matricola_expiration'
        ];
        requiredFields.forEach(field => {
            if (!formData[field] || (typeof formData[field] === 'string' && formData[field].trim() === '')) {
                newErrors[field] = [true, 'This field is required'];
                valid = false;
            } else {
                newErrors[field] = [false, ''];
            }
        });

        // Validate matricola (exactly 6 digits)
        const matricolaRegex = /^\d{6}$/;
        if (!matricolaRegex.test(formData.matricola_number)) {
            newErrors.matricola_number = [true, 'Matricola must be exactly 6 digits'];
            valid = false;
        } else newErrors.matricola_number = [false, ''];

        // Validate person code (exactly 8 digits)
        const personCodeRegex = /^\d{8}$/;
        if (!personCodeRegex.test(formData.person_code)) {
            newErrors.person_code = [true, 'Person Code must be exactly 8 digits'];
            valid = false;
        } else newErrors.person_code = [false, ''];

        // Email format regex (simple version)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (formData.email && !emailRegex.test(formData.email)) {
            newErrors.email = [true, 'Invalid email format'];
            valid = false;
        }

        // Validate emails equality
        if (formData.email !== formData.email_confirm) {
            newErrors.email_confirm = [true, 'Emails do not match'];
            valid = false;
        } else newErrors.email_confirm = [false, ''];

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
        if (!valid) setStatusMessage({message: "Error in form submission, check the errors below", state: 'error'});
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
        let { name, value } = e.target;
        // Preserve leading zeros and enforce length for codes
        if (name === 'person_code' || name === 'matricola_number') {
            value = value.replace(/\D/g, '');
            const maxLen = name === 'person_code' ? 8 : 6;
            if (value.length > maxLen) value = value.slice(0, maxLen);
        }
        setFormData({
            ...formData,
            [name]: value,
        });
        if (formErrors[name]) {
            setFormErrors({
                ...formErrors,
                [name]: [false, '']
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
    };

    const handleSameNumberChange = (e) => {
        setSameWAasPhone(e.target.checked);
        if (e.target.checked) {
            setFormData({
                ...formData,
                whatsapp_prefix: formData.phone_prefix,
                whatsapp_number: formData.phone_number
            });
        }
    };

    // Compute exchange end date based on academic anchor dates (Feb 15, Jul 15)
    const computeExchangeEndDate = (semesters) => {
        const s = Number(semesters);
        const anchorCount = Math.min(s, 3); // 3 or more -> third anchor
        const now = dayjs();

        // Pre-build anchor dates (Feb 15, Jul 15) for current and next 2 years
        const anchors = [];
        for (let y = now.year(); y <= now.year() + 2; y++) {
            anchors.push(dayjs(`${y}-02-15`));
            anchors.push(dayjs(`${y}-07-15`));
        }

        const futureAnchors = anchors
            .filter(d => d.isAfter(now))
            .sort((a, b) => a.valueOf() - b.valueOf());

        return futureAnchors[anchorCount - 1] || futureAnchors[futureAnchors.length - 1];
    };

    const handleSemestersChange = (_e, value) => {
        if (!value) return;
        const semesters = value === 'more' ? 4 : value; // 4 for backend; logic caps at 3
        const computed = computeExchangeEndDate(semesters);
        setFormData(prev => ({
            ...prev,
            mobility_semesters: semesters,
            matricola_expiration: computed
        }));
        setFormErrors(prev => ({...prev, matricola_expiration: [false, '']}));
    };

    // Initialize computed date if not yet aligned
    React.useEffect(() => {
        setFormData(prev => ({
            ...prev,
            matricola_expiration: computeExchangeEndDate(prev.mobility_semesters || 1)
        }));
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        const computedEnd = computeExchangeEndDate(formData.mobility_semesters);
        if (!formData.matricola_expiration || !dayjs(formData.matricola_expiration).isSame(computedEnd, 'day')) {
            setFormData(prev => ({...prev, matricola_expiration: computedEnd}));
        }
        if (!validateForm()) {
            scrollUp();
            return;
        }
        setStatusMessage(null);
        setIsLoading(true);

        // Removed zero-to-empty sanitization: backend now handles zero placeholders
        let body = {
            ...formData,
            whatsapp_prefix: sameWAasPhone ? formData.phone_prefix : formData.whatsapp_prefix,
            whatsapp_number: sameWAasPhone ? formData.phone_number : formData.whatsapp_number,
            birthdate: formatDateString(formData.birthdate),
            document_expiration: formatDateString(formData.document_expiration),
            matricola_expiration: formatDateString(computedEnd),
        };

        fetchCustom("POST", '/profile/initiate-creation/', {
            body,
            auth: false,
            onSuccess: () => {
                setFormErrors(initialFormErrors);
                setSubmitted(true);
            },
            onError: (responseOrError) => {
                defaultErrorHandler(responseOrError, (msgObj) => {
                    setStatusMessage(msgObj);
                    if (msgObj.fieldErrors) {
                        const newErrors = {...formErrors};
                        Object.entries(msgObj.fieldErrors).forEach(([field, message]) => {
                            if (newErrors[field]) newErrors[field] = [true, Array.isArray(message) ? message.join(', ') : message];
                        });
                        setFormErrors(newErrors);
                    } else setFormErrors(initialFormErrors);
                    scrollUp();
                });
            },
            onFinally: () => setIsLoading(false)
        });
    }

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
                    Your response has been sent.
                </Typography>
                <Typography variant="subtitle1" align="center">
                    Check your inbox to verify your email (validity of link: 24 hours).
                </Typography>
                <Typography variant="body2" align="center" sx={{mt: 2}}>
                    In case you do not receive an email, please check your spam folder or contact us on our channels.
                </Typography>
            </Box>
        );
    }

    return (
        <Box component="form" noValidate sx={{maxWidth: 800, margin: 'auto', mt: 5, mb: 5, px: 4}}
             onSubmit={handleSubmit}>
            <img
                src={logo}
                alt='ESN Polimi Logo'
                style={{
                    height: '20vh',
                    marginBottom: "4px",
                    display: 'block',
                    marginLeft: 'auto',
                    marginRight: 'auto'
                }}
            />
            <Typography variant="h4" align="center" gutterBottom mb={5}>ESN Polimi Registration - International
                Student</Typography>

            {statusMessage && (<StatusBanner message={statusMessage.message} state={statusMessage.state}/>)}

            <Typography variant="h5" align="center" gutterBottom sx={{my: 3}}>Personal Information</Typography>
            <Typography
                variant="caption"
                align="right"
                display="block"
                sx={{mb: 1, color: 'text.secondary'}}>
                * required field
            </Typography>
            <Grid container spacing={3}>
                <Grid size={{xs: 12, sm: 4}}>
                    <TextField
                        label="Name"
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
                        label="Surname"
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
                            label="Birthdate *"
                            value={formData.birthdate}
                            onChange={(date) => handleDateChange('birthdate', date)}
                            maxDate={dayjs()}
                            slotProps={{textField: {variant: 'outlined'}}}/>
                    </LocalizationProvider>
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                        label="Email"
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
                        label="Confirm Email"
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
                            <Typography variant="caption" sx={{
                                display: 'flex',
                                alignItems: 'center',
                                color: formData.email === formData.email_confirm ? 'green' : 'grey'
                            }}>
                                {formData.email === formData.email_confirm
                                    ? <CheckIcon fontSize="small" sx={{mr: 0.5}}/>
                                    : <CloseIcon fontSize="small" sx={{mr: 0.5}}/>
                                }
                                {formData.email === formData.email_confirm
                                    ? "The emails match"
                                    : "The emails do not match"}
                            </Typography>
                        )}
                    </Box>
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <FormControl fullWidth required>
                        <InputLabel id="country-label">Nationality</InputLabel>
                        <Select
                            variant="outlined"
                            labelId="country-label"
                            name="country"
                            value={formData.country}
                            onChange={handleChange}
                            label="Nationality"
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
                        label="Home Domicile Address"
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
                    <FormControl fullWidth required>
                        <InputLabel id="phone-prefix-label">Prefix</InputLabel>
                        <Select
                            variant="outlined"
                            labelId="phone-prefix-label"
                            id="phone-prefix"
                            name="phone_prefix"
                            value={formData.phone_prefix}
                            onChange={handleChange}
                            label="Prefix"
                            required
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
                        label="Phone Number"
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
                <Grid size={{xs: 12, sm: 6}}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={sameWAasPhone}
                                onChange={handleSameNumberChange}
                                name="sameAsPhone"
                                color="primary"/>
                        }
                        label="Same number for WhatsApp"
                    />
                </Grid>
                {!sameWAasPhone && (<>
                    <Grid size={{xs: 4, sm: 2}}>
                        <FormControl fullWidth required>
                            <InputLabel id="whatsapp-prefix-label">Prefix</InputLabel>
                            <Select
                                variant="outlined"
                                labelId="whatsapp-prefix-label"
                                id="whatsapp-prefix"
                                name="whatsapp_prefix"
                                value={formData.whatsapp_prefix}
                                onChange={handleChange}
                                label="Prefix"
                                required
                                renderValue={(value) => value}
                                error={formErrors.whatsapp_prefix[0]}>
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
                            label="Whatsapp Number"
                            variant="outlined"
                            name="whatsapp_number"
                            type="number"
                            value={formData.whatsapp_number}
                            onChange={handleChange}
                            fullWidth
                            required
                            error={formErrors.whatsapp_number[0]}
                            helperText={formErrors.whatsapp_number[1]}/>
                    </Grid>
                </>)}
            </Grid>

            <Typography variant="h5" align="center" gutterBottom my={4}>Document Information</Typography>
            <Grid container spacing={3}>
                <Grid size={{xs: 12, sm: 4}}>
                    <FormControl fullWidth required>
                        <InputLabel id="idType-label">Type</InputLabel>
                        <Select
                            variant="outlined"
                            labelId="document-type-label"
                            name="document_type"
                            value={formData.document_type}
                            onChange={handleChange}
                            label="Type"
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
                        label="Number"
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
                            label="Expiration Date *"
                            value={formData.document_expiration}
                            onChange={(date) => handleDateChange('document_expiration', date)}
                            slotProps={{textField: {variant: 'outlined'}}}/>
                    </LocalizationProvider>
                </Grid>
            </Grid>

            <Typography variant="h5" align="center" gutterBottom my={4}>Exchange Information</Typography>
            <Grid container spacing={3}>
                <Grid size={{xs: 12, sm: 6}}>
                    <FormControl fullWidth required>
                        <InputLabel id="course-label">Field of Study</InputLabel>
                        <Select
                            variant="outlined"
                            labelId="course-label"
                            name="course"
                            value={formData.course}
                            onChange={handleChange}
                            label="Field of Study"
                            error={formErrors.course[0]}>
                            <MenuItem value="Engineering">Engineering</MenuItem>
                            <MenuItem value="Design">Design</MenuItem>
                            <MenuItem value="Architecture">Architecture</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                {/* Compact semester selector aligned with Field of Study */}
                <Grid size={{xs: 12, sm: 6}} sx={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <FormControl component="fieldset"
                                 sx={{width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                        <FormLabel
                            component="legend"
                            sx={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                letterSpacing: '0.5px',
                                textTransform: 'uppercase',
                                color: 'text.secondary',
                                mb: 0.5,
                                textAlign: 'center',
                                width: '100%'
                            }}>
                            Semesters of Mobility (including the current) *
                        </FormLabel>
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={formData.mobility_semesters >= 4 ? 'more' : formData.mobility_semesters}
                            onChange={handleSemestersChange}
                            aria-label="mobility semesters"
                            sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                width: '100%',
                                '& .MuiToggleButton-root': {
                                    px: 2,
                                    py: 0.6,
                                    fontSize: '0.8rem'
                                }
                            }}>
                            <ToggleButton value={1}>1</ToggleButton>
                            <ToggleButton value={2}>2</ToggleButton>
                            <ToggleButton value="more">3+</ToggleButton>
                        </ToggleButtonGroup>
                    </FormControl>
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                        label="Person Code (8 digits)"
                        variant="outlined"
                        name="person_code"
                        type="text"
                        inputMode="numeric"
                        value={formData.person_code}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors.person_code[0]}
                        helperText={formErrors.person_code[1]}/>
                </Grid>
                <Grid size={{xs: 12, sm: 6}}>
                    <TextField
                        label="Matricola (6 digits)"
                        variant="outlined"
                        name="matricola_number"
                        type="text"
                        inputMode="numeric"
                        value={formData.matricola_number}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors.matricola_number[0]}
                        helperText={formErrors.matricola_number[1]}/>
                </Grid>
                <Grid size={{xs: 12}}>
                    <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
                        You can find your Person Code and Matricola in the Polimi App under your profile section, or
                        from the Online Services.
                        <br/> In case the university has not provided you a Person Code or Matricola yet, you can fill the field with 8 or 6
                        0s.
                    </Typography>
                </Grid>
            </Grid>

            <Grid container spacing={3} mt={3}>
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
                                I declare that I have read and accepted the{' '}
                                <Link href={links.statute} target="_blank" rel="noopener noreferrer" underline="always">
                                    ESN Politecnico Milano Charter
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
                        label="I declare that I fully share the aims of the Association (ref. Article 2 of the Charter)"
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
                                I declare that I accept all the terms stated in the{' '}
                                <Link href={links.regulation} target="_blank" rel="noopener noreferrer"
                                      underline="always">
                                    Internal Rules
                                </Link>
                                {' '}and all subsequent changes and additions
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
                                I declare that I have read the attached{' '}
                                <Link href={links.privacy} target="_blank" rel="noopener noreferrer" underline="always">
                                    Privacy Disclaimer
                                </Link>
                                {' '}and that I agree to the usage of my personal data according to the Regulation EU 2016/679 (GDPR) and to be aware of my guaranteed rights by the afore-mentioned law
                            </span>
                        }/>
                </Grid>
            </Grid>

            <Button type="submit"
                    variant="contained"
                    color="primary"
                    fullWidth
                    sx={{mt: 4}}
                    startIcon={!isLoading && <LoginIcon/>}
                    disabled={isLoading}>
                {isLoading ? <CircularProgress size={24} color="inherit"/> : "Submit"}
            </Button>
        </Box>
    );
}
