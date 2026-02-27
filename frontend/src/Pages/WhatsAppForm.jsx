import React, { useState } from 'react';
import {
    Box,
    Button,
    TextField,
    Typography,
    Grid,
    ToggleButton,
    ToggleButtonGroup,
    FormLabel,
    CircularProgress,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { green } from '@mui/material/colors';
import { defaultErrorHandler, fetchCustom } from '../api/api';
import StatusBanner from '../Components/StatusBanner';
import logo from '../assets/esnpolimi-logo.png';

export default function WhatsAppForm() {
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState(null);

    const [formData, setFormData] = useState({
        email: '',
        first_name: '',
        last_name: '',
        is_international: null,   // null = not selected, true/false
        home_university: '',
        course_of_study: '',
    });

    const [formErrors, setFormErrors] = useState({
        email: [false, ''],
        first_name: [false, ''],
        last_name: [false, ''],
        is_international: [false, ''],
        home_university: [false, ''],
        course_of_study: [false, ''],
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Always convert email to lowercase
        const sanitized = name === 'email' ? value.toLowerCase() : value;
        setFormData((prev) => ({ ...prev, [name]: sanitized }));
        // Clear error on typing
        setFormErrors((prev) => ({ ...prev, [name]: [false, ''] }));
    };

    const handleIsInternational = (_, newValue) => {
        if (newValue === null) return; // prevent deselection
        setFormData((prev) => ({ ...prev, is_international: newValue }));
        setFormErrors((prev) => ({ ...prev, is_international: [false, ''] }));
    };

    // Pattern: one or more lowercase letter-segments (letters, digits, hyphens, apostrophes) separated by dots, before @mail.polimi.it
    // Accepts: mario.rossi, mario2.rossi, jean-marie.dupont, maria.della.rocca2
    // Rejects: 12345678@mail.polimi.it (starts with digit), MARIO.ROSSI (capital)
    const POLIMI_EMAIL_PATTERN = /^[a-z][a-z0-9'-]*(\.[a-z][a-z0-9'-]*)+@mail\.polimi\.it$/;

    const validateEmail = (email) => {
        if (!email) return 'Email is required.';
        if (!POLIMI_EMAIL_PATTERN.test(email))
            return 'Email must follow the format name.surname@mail.polimi.it - no personal code (e.g. "12345678@mail.polimi.it" is not correct).';
        return '';
    };

    const validate = () => {
        const errors = { ...formErrors };
        let valid = true;

        const emailError = validateEmail(formData.email);
        if (emailError) {
            errors.email = [true, emailError];
            valid = false;
        }
        if (!formData.first_name.trim()) {
            errors.first_name = [true, 'First name is required.'];
            valid = false;
        }
        if (!formData.last_name.trim()) {
            errors.last_name = [true, 'Last name is required.'];
            valid = false;
        }
        if (formData.is_international === null) {
            errors.is_international = [true, 'Please select an option.'];
            valid = false;
        }
        if (!formData.home_university.trim()) {
            errors.home_university = [true, 'Home university is required.'];
            valid = false;
        }
        if (!formData.course_of_study.trim()) {
            errors.course_of_study = [true, 'Course of study is required.'];
            valid = false;
        }

        setFormErrors(errors);
        return valid;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!validate()) return;

        setIsLoading(true);
        setStatusMessage(null);

        fetchCustom('POST', '/content/whatsapp-register/', {
            auth: false,
            body: formData,
            onSuccess: (data) => {
                if (data?.warning) {
                    console.warn('WhatsApp log warning:', data.warning);
                }
                setIsSubmitted(true);
            },
            onError: (response) => {
                // 403 = not admitted (non-international) — show same confirmation screen
                if (response?.status === 403) {
                    setIsSubmitted(true);
                } else {
                    defaultErrorHandler(response, setStatusMessage);
                }
            },
            onFinally: () => setIsLoading(false),
        });
    };

    /* ── Result screen (shown after any successful submit) ── */
    if (isSubmitted) {
        return (
            <Box sx={{ maxWidth: 600, margin: 'auto', mt: 8, mb: 8, px: 4, textAlign: 'center' }}>
                <img
                    src={logo}
                    alt="ESN Polimi Logo"
                    style={{ height: '15vh', marginBottom: 16, display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
                />
                <CheckCircleOutlineIcon sx={{ fontSize: 80, color: green[500], mb: 2 }} />
                <Typography variant="h5" gutterBottom>
                    Form submitted successfully!
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                    The ESN Politecnico Milano team will review your request and send you the WhatsApp group link
                    via email at <strong>{formData.email}</strong>.
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                    If you do not receive anything within one day, please come to our office or
                    contact us on Instagram at{' '}
                    <strong>
                        <a
                            href="https://www.instagram.com/esnpolimi"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'inherit' }}
                        >
                            @esnpolimi
                        </a>
                    </strong>.
                </Typography>
            </Box>
        );
    }

    /* ── Form ── */
    return (
        <Box
            component="form"
            noValidate
            onSubmit={handleSubmit}
            sx={{ maxWidth: 800, margin: 'auto', mt: 5, mb: 5, px: 4 }}
        >
            {/* Logo */}
            <img
                src={logo}
                alt="ESN Polimi Logo"
                style={{
                    height: '20vh',
                    marginBottom: 8,
                    display: 'block',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                }}
            />

            {/* Title */}
            <Typography variant="h4" align="center" gutterBottom sx={{ mt: 2 }}>
                WhatsApp Group ESN Politecnico Milano
            </Typography>

            {/* Subtitle */}
            <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 4, whiteSpace: 'pre-line' }}>
                {`This is the form for admission to the official WhatsApp group of ESN Politecnico Milano.\n\nPlease answer these questions, or you won't be admitted to the group.\nAfter the form, you will receive an automatic email; for any issue contact @esnpolimi on Instagram`}
            </Typography>

            {statusMessage && (
                <StatusBanner message={statusMessage.message} state={statusMessage.state} />
            )}

            <Typography
                variant="caption"
                align="right"
                display="block"
                sx={{ mb: 1, color: 'text.secondary' }}
            >
                * all fields are required
            </Typography>

            <Grid container spacing={3}>

                {/* ── Email ── */}
                <Grid size={{ xs: 12 }}>
                    <TextField
                        label="Email *"
                        variant="outlined"
                        name="email"
                        type="email"
                        fullWidth
                        value={formData.email}
                        onChange={handleChange}
                        error={formErrors.email[0]}
                        helperText={formErrors.email[0] ? formErrors.email[1] : ''}
                    />
                    {/* Email format note */}
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Use your Polimi email (ends with &quot;mail.polimi.it&quot;) – NO PERSONAL CODE
                        (&quot;12345678@polimi.it&quot; is not correct).
                    </Typography>
                </Grid>

                {/* ── First name ── */}
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                        label="First Name *"
                        variant="outlined"
                        name="first_name"
                        fullWidth
                        value={formData.first_name}
                        onChange={handleChange}
                        error={formErrors.first_name[0]}
                        helperText={formErrors.first_name[0] ? formErrors.first_name[1] : ''}
                    />
                </Grid>

                {/* ── Last name ── */}
                <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                        label="Last Name *"
                        variant="outlined"
                        name="last_name"
                        fullWidth
                        value={formData.last_name}
                        onChange={handleChange}
                        error={formErrors.last_name[0]}
                        helperText={formErrors.last_name[0] ? formErrors.last_name[1] : ''}
                    />
                </Grid>

                {/* ── International student ── */}
                <Grid size={{ xs: 12 }}>
                    <FormLabel
                        component="legend"
                        error={formErrors.is_international[0]}
                        sx={{ mb: 1, display: 'block' }}
                    >
                        Are you an International Student / are you an Erasmus Student at Politecnico di Milano? *
                    </FormLabel>
                    <ToggleButtonGroup
                        value={formData.is_international}
                        exclusive
                        onChange={handleIsInternational}
                        color={formErrors.is_international[0] ? 'error' : 'primary'}
                    >
                        <ToggleButton value={true}>Yes</ToggleButton>
                        <ToggleButton value={false}>No</ToggleButton>
                    </ToggleButtonGroup>
                    {formErrors.is_international[0] && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                            {formErrors.is_international[1]}
                        </Typography>
                    )}
                </Grid>

                {/* ── Home university ── */}
                <Grid size={{ xs: 12 }}>
                    <TextField
                        label="What is your home university? *"
                        variant="outlined"
                        name="home_university"
                        fullWidth
                        value={formData.home_university}
                        onChange={handleChange}
                        error={formErrors.home_university[0]}
                        helperText={
                            formErrors.home_university[0]
                                ? formErrors.home_university[1]
                                : 'Use the full name'
                        }
                    />
                </Grid>

                {/* ── Course of study ── */}
                <Grid size={{ xs: 12 }}>
                    <TextField
                        label="Which is your course of study in Politecnico of Milan? *"
                        variant="outlined"
                        name="course_of_study"
                        fullWidth
                        value={formData.course_of_study}
                        onChange={handleChange}
                        error={formErrors.course_of_study[0]}
                        helperText={
                            formErrors.course_of_study[0]
                                ? formErrors.course_of_study[1]
                                : 'Use the full name'
                        }
                    />
                </Grid>

            </Grid>

            {/* Submit */}
            <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                sx={{ mt: 4 }}
                disabled={isLoading}
            >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Submit'}
            </Button>
        </Box>
    );
}
