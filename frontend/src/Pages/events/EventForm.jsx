import {
    Box,
    Button,
    Container,
    CssBaseline,
    Typography,
    TextField,
    Checkbox,
    FormControlLabel,
    Radio,
    RadioGroup,
    FormControl,
    FormLabel,
    FormGroup,
    FormHelperText,
    Paper,
    Divider,
    Grid
} from "@mui/material";
import {useLocation, useParams, useNavigate} from "react-router-dom";
import logo from "../../assets/esnpolimi-logo.png";
import {useState, useEffect} from "react";
import {
    Euro as EuroIcon,
    CalendarToday as CalendarTodayIcon,
} from "@mui/icons-material";
import AddCardIcon from '@mui/icons-material/AddCard';

export default function EventForm() {
    const {id} = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const eventData = location.state?.eventData || {};
    const profileData = location.state?.profileData || {};
    const profileFields = eventData.profile_fields || [];
    const formFields = eventData.form_fields || [];

    // Redirect to form log-in if no eventData or profileData present
    useEffect(() => {
        if (!eventData || !profileData) {
            navigate(`/event/${id}/formlogin`);
        }
    }, [eventData, id, navigate]);

    // Initialize form state
    const [formValues, setFormValues] = useState(() =>
        Object.fromEntries(formFields.map(f => [f.name, f.type === "m" ? [] : ""]))
    );

    // Initialize profile state (pre-fill from profileData, except email is read-only)
    const [profileValues, setProfileValues] = useState(() => {
        const initial = {};
        profileFields.forEach(field => {
            initial[field] = profileData[field] ?? "";
        });
        return initial;
    });

    const handleChange = (field, value) => {
        setFormValues(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleProfileChange = (field, value) => {
        setProfileValues(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleCheckboxChange = (field, choice) => {
        setFormValues(prev => {
            const arr = prev[field] || [];
            if (arr.includes(choice)) {
                return {...prev, [field]: arr.filter(v => v !== choice)};
            } else {
                return {...prev, [field]: [...arr, choice]};
            }
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Submission logic will go here
    };

    // Helper to get a label for profile fields
    const profileFieldLabel = (field) => {
        const labels = {
            name: "Name",
            surname: "Surname",
            email: "Email",
            phone_prefix: "Phone Prefix",
            phone_number: "Phone Number",
            whatsapp_prefix: "WhatsApp Prefix",
            whatsapp_number: "WhatsApp Number",
            country: "Country",
            birthdate: "Birthdate",
            latest_esncard: "ESNcard Number",
            latest_document: "Document Number",
            matricola_number: "Matricola Number",
            matricola_expiration: "Matricola Expiration",
            course: "Course",
            person_code: "Person Code",
            domicile: "Domicile"
        };
        return labels[field] || field;
    };

    // Helper to format date
    const formatDate = (dt) => {
        if (!dt) return '';
        const date = new Date(dt);
        return date.toLocaleDateString('en-GB');
    };

    // Helper to format date/time
    const formatDateTime = (dt) => {
        if (!dt) return '';
        const date = new Date(dt);
        return date.toLocaleString('en-GB', {dateStyle: 'full', timeStyle: 'short'});
    };

    // Helper to format currency
    const formatCurrency = (amount) => {
        if (amount == null) return "-";
        return Number(amount).toLocaleString('en-GB', {style: 'currency', currency: 'EUR'});
    };

    return (
        <Container component="main" maxWidth="sm">
            <CssBaseline/>
            <Box sx={{marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                <img src={logo} alt='ESN Polimi Logo' style={{height: '25vh', marginBottom: "4px"}}/>
                <Typography variant="h4" gutterBottom>
                    Event Subscription Form - {eventData.name}
                </Typography>
                {/* Event InfoSet */}
                <Paper elevation={2} sx={{p: 2, mt: 1, width: '100%', backgroundColor: '#f5f5f5'}}>
                    <Grid container spacing={3}>
                        <Grid size={{xs:12, sm: 4}}>
                            <Box sx={{display: 'flex', alignItems: 'center'}}>
                                <CalendarTodayIcon sx={{color: 'primary.main', mr: 1}}/>
                                <Typography variant="subtitle2" color="text.secondary">Date</Typography>
                            </Box>
                            <Typography variant="body1" sx={{mt: 1}}>
                                {eventData.date ? formatDate(eventData.date) : '-'}
                            </Typography>
                        </Grid>
                        <Grid size={{xs:12, sm: 4}}>
                            <Box sx={{display: 'flex', alignItems: 'center'}}>
                                <EuroIcon sx={{color: 'primary.main', mr: 1}}/>
                                <Typography variant="subtitle2" color="text.secondary">Cost</Typography>
                            </Box>
                            <Typography variant="body1" sx={{mt: 1}}>
                                {eventData.cost > 0
                                    ? `€ ${Number(eventData.cost).toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                                    : 'Free'}
                            </Typography>
                        </Grid>
                        <Grid size={{xs:12, sm: 4}}>
                            <Box sx={{display: 'flex', alignItems: 'center'}}>
                                <AddCardIcon sx={{color: 'primary.main', mr: 1}}/>
                                <Typography variant="subtitle2" color="text.secondary">Deposit</Typography>
                            </Box>
                            <Typography variant="body1" sx={{mt: 1}}>
                                {eventData.deposit > 0
                                    ? `€ ${Number(eventData.deposit).toLocaleString('en-GB', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                                    : 'Free'}
                            </Typography>
                        </Grid>
                    </Grid>
                </Paper>
                <Box component="form" onSubmit={handleSubmit} sx={{mt: 3, width: '100%'}}>
                    <Paper elevation={3} sx={{p: 2, mb: 3}}>
                        <Typography variant="h6" gutterBottom>
                            Profile Data
                        </Typography>
                        <Grid container spacing={2} sx={{mt: 2}}>
                            {profileFields.map(field => (
                                <Grid size={{xs: 12}} key={field}>
                                    <TextField
                                        label={profileFieldLabel(field)}
                                        value={profileValues[field] || ""}
                                        onChange={e => handleProfileChange(field, e.target.value)}
                                        fullWidth
                                        disabled={field === "email"}
                                        required
                                    />
                                </Grid>
                            ))}
                        </Grid>
                    </Paper>
                    <Divider sx={{mb: 3}}/>
                    <Paper elevation={3} sx={{p: 2, mb: 3}}>
                        <Typography variant="h6" gutterBottom>
                            Event Form Data
                        </Typography>
                        {formFields.map(field => {
                            switch (field.type) {
                                case "t":
                                    return (
                                        <TextField
                                            key={field.name}
                                            label={field.name}
                                            required={field.required}
                                            fullWidth
                                            margin="normal"
                                            value={formValues[field.name] || ""}
                                            onChange={e => handleChange(field.name, e.target.value)}
                                        />
                                    );
                                case "n":
                                    return (
                                        <TextField
                                            key={field.name}
                                            label={field.name}
                                            required={field.required}
                                            fullWidth
                                            margin="normal"
                                            type="number"
                                            value={formValues[field.name] || ""}
                                            onChange={e => handleChange(field.name, e.target.value)}
                                        />
                                    );
                                case "c":
                                    return (
                                        <FormControl key={field.name} required={field.required} margin="normal"
                                                     fullWidth>
                                            <FormLabel>{field.name}</FormLabel>
                                            <RadioGroup
                                                value={formValues[field.name] || ""}
                                                onChange={e => handleChange(field.name, e.target.value)}
                                            >
                                                {field.choices?.map(choice => (
                                                    <FormControlLabel
                                                        key={choice}
                                                        value={choice}
                                                        control={<Radio/>}
                                                        label={choice}
                                                    />
                                                ))}
                                            </RadioGroup>
                                        </FormControl>
                                    );
                                case "m":
                                    return (
                                        <FormControl key={field.name} required={field.required} margin="normal"
                                                     fullWidth>
                                            <FormLabel>{field.name}</FormLabel>
                                            <FormGroup>
                                                {field.choices?.map(choice => (
                                                    <FormControlLabel
                                                        key={choice}
                                                        control={
                                                            <Checkbox
                                                                checked={formValues[field.name]?.includes(choice) || false}
                                                                onChange={() => handleCheckboxChange(field.name, choice)}
                                                            />
                                                        }
                                                        label={choice}
                                                    />
                                                ))}
                                            </FormGroup>
                                            {field.required && (
                                                <FormHelperText>Seleziona almeno una opzione</FormHelperText>
                                            )}
                                        </FormControl>
                                    );
                                case "b":
                                    return (
                                        <FormControl key={field.name} required={field.required} margin="normal"
                                                     fullWidth>
                                            <FormLabel>{field.name}</FormLabel>
                                            <RadioGroup
                                                row
                                                value={formValues[field.name] === true ? "yes" : formValues[field.name] === false ? "no" : ""}
                                                onChange={e => handleChange(field.name, e.target.value === "yes")}
                                            >
                                                <FormControlLabel value="yes" control={<Radio/>} label="Yes"/>
                                                <FormControlLabel value="no" control={<Radio/>} label="No"/>
                                            </RadioGroup>
                                        </FormControl>
                                    );
                                default:
                                    return null;
                            }
                        })}
                    </Paper>
                    <Button type="submit" variant="contained" color="primary" fullWidth>
                        {eventData.allow_online_payment ? "Proceed to Checkout" : "Submit"}
                    </Button>
                </Box>
            </Box>
        </Container>
    );
}
