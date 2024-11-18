import React from 'react';
import {Box, Button, FormControl, Grid, InputLabel, MenuItem, Select, TextField, Typography} from '@mui/material';
import {LocalizationProvider, DatePicker} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import {Checkbox, FormControlLabel} from '@mui/material';
import 'dayjs/locale/en-gb';
import {green} from '@mui/material/colors';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {fetchWithAuth} from "../api/api";

const ErasmusForm = () => {
    const [formData, setFormData] = React.useState({
        'email': '',
        'email_confirm': '',
        'password': '',
        'password_confirm': '',
        'name': '',
        'surname': '',
        'gender': '',
        'birthdate': dayjs(),
        'country': '',
        'phone': '',
        'whatsapp': '',
        'person_code': '',
        'domicile': '',
        'residency': '',
        'course': '',
        'document-type': '',
        'document-number': '',
        'document-expiration': dayjs(),
        'matricola-number': '',
        'matricola-exchange_end': dayjs(),
        'is_esner': true
    });

    const [formErrors, setFormErrors] = React.useState({
        'email': [false, ''],
        'email_confirm': [false, ''],
        'password': [false, ''],
        'password_confirm': [false, ''],
        'name': [false, ''],
        'surname': [false, ''],
        'gender': [false, ''],
        'birthdate': [false, ''],
        'country': [false, ''],
        'phone': [false, ''],
        'whatsapp': [false, ''],
        'person_code': [false, ''],
        'domicile': [false, ''],
        'residency': [false, ''],
        'course': [false, ''],
        'document-type': [false, ''],
        'document-number': [false, ''],
        'document-expiration': [false, ''],
        'matricola-number': [false, ''],
        'matricola-exchange_end': [false, ''],
        'is_esner': [false, '']
    })

    const [isSubmitted, setSubmitted] = React.useState(false)

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

        if (formData['email'] !== formData['email_confirm']) {
            setFormErrors({
                ...formErrors,
                'email_confirm': [true, 'Email not corresponding'],
            });
            scrollUp();
            return;
        } else {
            setFormErrors({
                ...formErrors,
                'email_confirm': [false, ''],
            });
        }

        if (formData['password'] !== formData['password_confirm']) {
            setFormErrors({
                ...formErrors,
                'password_confirm': [true, 'Password not corresponding'],
            });
            scrollUp();
            return;
        } else {
            setFormErrors({
                ...formErrors,
                'password_confirm': [false, ''],
            });
        }

        let body = {
            ...formData,
            'birthdate': formatDateString(formData['birthdate']),
            'document-expiration': formatDateString(formData['document-expiration']),
            'matricola-exchange_end': formatDateString(formData['matricola-exchange_end']),
        }


        fetchWithAuth("POST", 'http://localhost:8000/profile/', JSON.stringify(body)).then(
            (response) => {
                if (response.ok) {
                    setSubmitted(true);
                } else if (response.status === 400) {
                    scrollUp();
                    response.json().then((json) => {
                        let errors = Object.fromEntries(Object.keys(formErrors).map(
                            (e) => {
                                if (e in json) return [e, [true, json[e]]];
                                else return [e, [false, '']];
                            }
                        ));
                        setFormErrors(errors);
                    })
                } else {
                    throw new Error('Error while fetching /profiles/');
                }
            }
        ).catch((error) => {
            console.log(error);
        })

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
            <Typography variant="h4" align="center" gutterBottom mb={5}>
                Registration - ESNer
            </Typography>
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="Name"
                        variant="outlined"
                        name="name"
                        value={formData['name']}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors['name'][0]}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="Surname"
                        variant="outlined"
                        name="surname"
                        value={formData['surname']}
                        onChange={handleChange}
                        fullWidth
                        required
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="Email"
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
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="Confirm Email"
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
                <Grid item xs={12} sm={6}>
                    <TextField
                        type="password"
                        label="Password"
                        variant="outlined"
                        name="password"
                        value={formData['password']}
                        onChange={handleChange}
                        fullWidth
                        required
                        margin="normal"
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        type="password"
                        label="Confirm password"
                        variant="outlined"
                        name="password_confirm"
                        value={formData['password_confirm']}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors['password_confirm'][0]}
                        helperText={formErrors['password_confirm'][1]}
                        margin="normal"
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required>
                        <InputLabel id="gender-label">Gender</InputLabel>
                        <Select
                            labelId="gender-label"
                            name="gender"
                            value={formData['gender']}
                            onChange={handleChange}
                            label="Gender"
                        >
                            <MenuItem value="M">Male</MenuItem>
                            <MenuItem value="F">Female</MenuItem>
                            <MenuItem value="O">Other</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                        <DatePicker
                            label="Birthdate"
                            value={formData.birthdate}
                            onChange={(date) => handleDateChange('birthdate', date)}
                            renderInput={(params) => <TextField {...params}
                                                                fullWidth
                                                                required
                            />}
                        />
                    </LocalizationProvider>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <FormControl
                        fullWidth
                        required
                    >
                        <InputLabel id="country-label">Country</InputLabel>
                        <Select
                            labelId="country-label"
                            name="country"
                            value={formData['country']}
                            onChange={handleChange}
                            label="Country"
                            error={formErrors['country'][0]}
                        >
                            <MenuItem value="">
                                <em>None</em>
                            </MenuItem>
                            <MenuItem value="US">USA</MenuItem>
                            <MenuItem value="Canada">Canada</MenuItem>
                            {/* Add more countries here */}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="Phone Number"
                        variant="outlined"
                        name="phone"
                        type="tel"
                        value={formData['phone']}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors['phone'][0]}
                        helperText={formErrors['phone'][1]}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="Whatsapp Number"
                        variant="outlined"
                        name="whatsapp"
                        type="tel"
                        value={formData['whatsapp']}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors['whatsapp'][0]}
                        helperText={formErrors['whatsapp'][1]}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="Person Code"
                        variant="outlined"
                        name="person_code"
                        type="number"
                        inputProps={{min: 0}}
                        value={formData['person_code']}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors['person_code'][0]}
                        helperText={formErrors['person_code'][1]}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="Matricola"
                        variant="outlined"
                        name="matricola-number"
                        type="number"
                        inputProps={{min: 0}}
                        value={formData['matricola-number']}
                        onChange={handleChange}
                        fullWidth
                        required
                        error={formErrors['matricola-number'][0]}
                        helperText={formErrors['matricola-number'][1]}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="Domicile"
                        variant="outlined"
                        name="domicile"
                        value={formData['domicile']}
                        onChange={handleChange}
                        fullWidth
                        required
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="Residency"
                        variant="outlined"
                        name="residency"
                        value={formData['residency']}
                        onChange={handleChange}
                        fullWidth
                        required
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required>
                        <InputLabel id="course-label">Course</InputLabel>
                        <Select
                            labelId="course-label"
                            name="course"
                            value={formData['course']}
                            onChange={handleChange}
                            label="Course"
                            error={formErrors['course'][0]}
                        >
                            <MenuItem value="Engineering">Engineering</MenuItem>
                            <MenuItem value="Design">Design</MenuItem>
                            <MenuItem value="Architecture">Architecture</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
            </Grid>
            <Typography variant="h5" align="center" gutterBottom my={4}>
                Document information
            </Typography>
            <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required>
                        <InputLabel id="idType-label">Type</InputLabel>
                        <Select
                            labelId="document-type-label"
                            name="document-type"
                            value={formData['document-type']}
                            onChange={handleChange}
                            label="Type"
                            required
                            error={formErrors['document-type'][0]}
                        >
                            <MenuItem value="Identity Card">Identity Card</MenuItem>
                            <MenuItem value="Passport">Passport</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        label="Number"
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
                <Grid item xs={12} sm={6}>
                    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='en-gb'>
                        <DatePicker
                            label="Expiration Date"
                            value={formData['document-expiration']}
                            onChange={(date) => handleDateChange('document-expiration', date)}
                            renderInput={(params) => <TextField {...params} fullWidth required/>}
                        />
                    </LocalizationProvider>
                </Grid>
            </Grid>
            <Grid container spacing={2} mt={3}>
                <Grid item xs={12}>
                    <FormControlLabel
                        control={<Checkbox name="acceptTerms" required/>}
                        label="I declare that I read and have accepted the ESN Politecnico Milano Charter"
                    />
                </Grid>
                <Grid item xs={12}>
                    <FormControlLabel
                        control={<Checkbox name="acceptPrivacyPolicy" required/>}
                        label="I declare that I fully share the aims of the Association (ref. Article 2 of the Charter)"
                    />
                </Grid>
                <Grid item xs={12}>
                    <FormControlLabel
                        control={<Checkbox name="acceptPrivacyPolicy" required/>}
                        label="I declare that I accept all the terms stated in the Charter, the Internal Rules and all subsequent changes and additions"
                    />
                </Grid>
                <Grid item xs={12}>
                    <FormControlLabel
                        control={<Checkbox name="acceptPrivacyPolicy" required/>}
                        label="I declare that I have read the attached disclaimer about Privacy and that I agree to the usage of my personal data according to the Regulation EU 2016/679 (GDPR) and to be aware of my guaranteed rights by the afore-mentioned law"
                    />
                </Grid>
            </Grid>


            <Button type="submit" variant="contained" color="primary" fullWidth sx={{mt: 4}}>
                Submit
            </Button>
        </Box>
    );
};

export default ErasmusForm;
