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
    Grid,
    Alert
} from "@mui/material";
import {useLocation, useParams, useNavigate} from "react-router-dom";
import logo from "../../assets/esnpolimi-logo.png";
import {useState, useEffect} from "react";
import {
    Euro as EuroIcon,
    CalendarToday as CalendarTodayIcon,
    AddCard as AddCardIcon, // added import
} from "@mui/icons-material";
import {fetchCustom} from "../../api/api";

export default function EventForm() {
    const {id} = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const eventData = location.state?.eventData || {};
    const userEmail = location.state?.email || ""; // email passed from login
    const formFields = eventData.form_fields || [];

    // Redirect if missing essentials
    useEffect(() => {
        if (!eventData.id) {
            navigate(`/event/${id}/formlogin`);
            return;
        }
        if (!userEmail && !eventData.is_allow_external) {
            navigate(`/event/${id}/formlogin`);
            return;
        }
    }, [eventData, id, navigate, userEmail]);

    // Initialize form state
    const [formValues, setFormValues] = useState(() =>
        Object.fromEntries(formFields.map(f => [f.name, f.type === "m" ? [] : (f.type === "b" ? null : "")]))
    );

    const handleChange = (field, value) => {
        setFormValues(prev => ({...prev, [field]: value}));
    };
    const handleCheckboxChange = (field, choice) => {
        setFormValues(prev => {
            const arr = prev[field] || [];
            return arr.includes(choice)
                ? {...prev, [field]: arr.filter(v => v !== choice)}
                : {...prev, [field]: [...arr, choice]};
        });
    };

    // Validation states
    const [missingFields, setMissingFields] = useState([]);
    const [showMissingAlert, setShowMissingAlert] = useState(false);
    const [backendError, setBackendError] = useState("");

    // Required form fields
    const requiredFormFields = formFields.filter(f => f.required).map(f => f.name);

    const isFormFieldFilled = (field) => {
        const fieldObj = formFields.find(f => f.name === field);
        if (!fieldObj) return true;
        if (fieldObj.type === "m") {
            return Array.isArray(formValues[field]) && formValues[field].length > 0;
        }
        if (fieldObj.type === "b") {
            return typeof formValues[field] === "boolean";
        }
        return formValues[field] !== undefined && formValues[field] !== null && formValues[field] !== "";
    };

    const scrollToTop = () => window.scrollTo({top: 0, behavior: "smooth"});

    // Notes
    const [formNotes, setFormNotes] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        let missing = [];
        requiredFormFields.forEach(f => {
            if (!isFormFieldFilled(f)) missing.push(f);
        });
        if (missing.length > 0) {
            setMissingFields(missing);
            setShowMissingAlert(true);
            setBackendError("");
            scrollToTop();
            return;
        }
        setShowMissingAlert(false);
        setBackendError("");

        fetchCustom("POST", `/event/${eventData.id}/formsubmit/`, {
            body: {
                email: userEmail,
                form_data: formValues,
                form_notes: formNotes
            },
            auth: false,
            onSuccess: (data) => {
                navigate(`/event/${eventData.id}/formsuccess`, {state: {assignedList: data.assigned_list}});
            },
            onError: async (err) => {
                if (err?.fields && Array.isArray(err.fields)) {
                    setMissingFields(err.fields);
                    setShowMissingAlert(true);
                    setBackendError("");
                } else if (err?.error) {
                    setBackendError("Error: " + err.error);
                    setShowMissingAlert(false);
                } else {
                    setBackendError("Submission failed");
                    setShowMissingAlert(false);
                }
                scrollToTop();
            }
        });
    };

    const formatDate = (dt) => {
        if (!dt) return '-';
        const d = new Date(dt);
        return d.toLocaleDateString('en-GB');
    };

    return (
        <Container component="main" maxWidth="sm">
            <CssBaseline/>
            <Box sx={{marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                <img src={logo} alt='ESN Polimi Logo' style={{height: '25vh', marginBottom: "4px"}}/>
                <Typography variant="h4" gutterBottom>
                    Event Subscription Form - {eventData.name}
                </Typography>
                {/* Alert for missing fields */}
                {showMissingAlert && !backendError && (
                    <Alert severity="warning" sx={{mb: 2}}>
                        {missingFields.length > 0 && `Please fill in all required fields: ${missingFields.join(', ')}`}
                    </Alert>
                )}
                {/* Alert for backend errors */}
                {backendError && (
                    <Alert severity="error" sx={{mb: 2}}>
                        {backendError}
                    </Alert>
                )}
                {/* Event InfoSet */}
                <Paper elevation={2} sx={{p: 2, mt: 1, width: '100%', backgroundColor: '#f5f5f5'}}>
                    <Grid container spacing={3}>
                        <Grid size={{xs: 12, sm: 4}}>
                            <Box sx={{display: 'flex', alignItems: 'center'}}>
                                <CalendarTodayIcon sx={{color: 'primary.main', mr: 1}}/>
                                <Typography variant="subtitle2" color="text.secondary">Date</Typography>
                            </Box>
                            <Typography variant="body1" sx={{mt: 1}}>
                                {formatDate(eventData.date)}
                            </Typography>
                        </Grid>
                        <Grid size={{xs: 12, sm: 4}}>
                            <Box sx={{display: 'flex', alignItems: 'center'}}>
                                <EuroIcon sx={{color: 'primary.main', mr: 1}}/>
                                <Typography variant="subtitle2" color="text.secondary">Cost</Typography>
                            </Box>
                            <Typography variant="body1" sx={{mt: 1}}>
                                {eventData.cost > 0
                                    ? `€ ${Number(eventData.cost).toLocaleString('en-GB', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                    })}`
                                    : 'Free'}
                            </Typography>
                        </Grid>
                        <Grid size={{xs: 12, sm: 4}}>
                            <Box sx={{display: 'flex', alignItems: 'center'}}>
                                <AddCardIcon sx={{color: 'primary.main', mr: 1}}/>
                                <Typography variant="subtitle2" color="text.secondary">Deposit</Typography>
                            </Box>
                            <Typography variant="body1" sx={{mt: 1}}>
                                {eventData.deposit > 0
                                    ? `€ ${Number(eventData.deposit).toLocaleString('en-GB', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                    })}`
                                    : 'Free'}
                            </Typography>
                        </Grid>
                    </Grid>
                </Paper>
                <Box component="form" onSubmit={handleSubmit} sx={{mt: 3, width: '100%'}}>
                    {/* Only form fields section now */}
                    {formFields.length > 0 && (
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
                                                slotProps={{htmlInput: {step: "0.01"}}}
                                            />
                                        );
                                    case "c":
                                        return (
                                            <FormControl key={field.name} required={field.required} margin="normal" fullWidth>
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
                                            <FormControl key={field.name} required={field.required} margin="normal" fullWidth>
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
                                                    <FormHelperText>Select one option at least</FormHelperText>
                                                )}
                                            </FormControl>
                                        );
                                    case "b":
                                        return (
                                            <FormControl key={field.name} required={field.required} margin="normal" fullWidth>
                                                <FormLabel>{field.name}</FormLabel>
                                                <RadioGroup
                                                    row
                                                    value={
                                                        formValues[field.name] === true
                                                            ? "yes"
                                                            : formValues[field.name] === false
                                                                ? "no"
                                                                : ""
                                                    }
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
                    )}
                    <Paper elevation={3} sx={{p: 2, mb: 3}}>
                        <Typography variant="h6" gutterBottom>
                            Additional Notes
                        </Typography>
                        <TextField
                            label="Notes for organizers (optional)"
                            value={formNotes}
                            onChange={e => setFormNotes(e.target.value)}
                            fullWidth
                            multiline
                            minRows={2}
                            maxRows={6}
                            margin="normal"
                        />
                    </Paper>
                    <Button type="submit" variant="contained" color="primary" fullWidth>
                        {eventData.allow_online_payment ? "Proceed to Checkout (Work In Progress)" : "Submit (Work In Progress)"}
                    </Button>
                </Box>
            </Box>
        </Container>
    );
}
