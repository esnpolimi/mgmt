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
    Grid,
    Select,
    MenuItem,
    InputLabel
} from "@mui/material";
import {useLocation, useParams, useNavigate} from "react-router-dom";
import logo from "../../assets/esnpolimi-logo.png";
import {useState, useEffect} from "react";
import {
    Euro as EuroIcon,
    CalendarToday as CalendarTodayIcon,
} from "@mui/icons-material";
import AddCardIcon from '@mui/icons-material/AddCard';
import {LocalizationProvider, DatePicker} from '@mui/x-date-pickers';
import {AdapterDayjs} from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import countryCodes from "../../data/countryCodes.json";
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import {fetchCustom} from "../../api/api";
import Alert from '@mui/material/Alert';

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
        //console.log(profileData);
        //console.log(eventData);
        if (!eventData.id && !profileData.email) {
            navigate(`/event/${id}/formlogin`);
        } else if (profileFields.includes("latest_esncard") && !value) {
            handleEsncardNumberChange(profileData.latest_esncard?.number || "");
        }
    }, [eventData, id, navigate]);


    // Define the canonical order for profile fields (same as ErasmusForm)
    const canonicalProfileOrder = [
        "name",
        "surname",
        "birthdate",
        "email",
        "latest_esncard",
        "country",
        "domicile",
        "phone_prefix",
        "phone_number",
        "whatsapp_prefix",
        "whatsapp_number",
        "latest_document",
        "course",
        "matricola_expiration",
        "person_code",
        "matricola_number",
    ];

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

    // Alert state for missing fields and backend errors
    const [missingFields, setMissingFields] = useState([]);
    const [showMissingAlert, setShowMissingAlert] = useState(false);
    const [backendError, setBackendError] = useState("");

    // Helper to get required fields for form
    const requiredFormFields = formFields.filter(f => f.required).map(f => f.name);

    // Helper to get required profile fields (all in canonicalProfileOrder that are present)
    const requiredProfileFields = canonicalProfileOrder.filter(field => profileFields.includes(field));

    // Helper to check if a profile field is filled
    const isProfileFieldFilled = (field) => {
        if (field === "latest_esncard") {
            if (noEsncard) return true;
            return !!(profileValues.latest_esncard && profileValues.latest_esncard.number && profileValues.latest_esncard.number !== "");
        }
        if (field === "latest_document") {
            return !!(profileValues.latest_document && profileValues.latest_document.number && profileValues.latest_document.number !== "");
        }
        return profileValues[field] !== undefined && profileValues[field] !== null && profileValues[field] !== "";
    };

    // Helper to check if a form field is filled
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

    // Scroll to top helper
    const scrollToTop = () => {
        window.scrollTo({top: 0, behavior: "smooth"});
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

    // Helper to get field type for profile fields
    const profileFieldType = (field) => {
        // Map field names to types
        if (["birthdate", "matricola_expiration"].includes(field)) return "date";
        if (["phone_number", "whatsapp_number", "matricola_number", "person_code"].includes(field)) return "number";
        if (["country"].includes(field)) return "select_country";
        if (["course"].includes(field)) return "select_course";
        if (["phone_prefix", "whatsapp_prefix"].includes(field)) return "select_prefix";
        return "text";
    };

    // Helper for course choices
    const courseChoices = [
        {value: "Engineering", label: "Engineering"},
        {value: "Design", label: "Design"},
        {value: "Architecture", label: "Architecture"}
    ];

    // ESNcard existence check state
    const [esncardExists, setEsncardExists] = useState(null);
    const [checkingEsncard, setCheckingEsncard] = useState(true);
    const [noEsncard, setNoEsncard] = useState(false);

    // Handler for ESNcard number change
    const handleEsncardNumberChange = (value) => {
        setProfileValues(prev => ({
            ...prev,
            latest_esncard: {...(prev.latest_esncard || {}), number: value}
        }));
        setCheckingEsncard(true);
        setEsncardExists(null);
        if (value && value.length > 5) {
            fetchCustom("GET", `/esncard_exists/?number=${encodeURIComponent(value)}`, {
                auth: false,
                onSuccess: (data) => {
                    setEsncardExists(data.exists);
                    setCheckingEsncard(false);
                },
                onError: () => {
                    setEsncardExists(null);
                    setCheckingEsncard(false);
                }
            });
        } else {
            setEsncardExists(null);
            setCheckingEsncard(false);
        }
    };

    // Add formNotes state
    const [formNotes, setFormNotes] = useState("");

    // Submit handler with validation
    const handleSubmit = (e) => {
        e.preventDefault();
        let missing = [];

        // Check profile fields
        requiredProfileFields.forEach(field => {
            if (!isProfileFieldFilled(field)) {
                missing.push(profileFieldLabel(field));
            }
        });

        // Check form fields
        requiredFormFields.forEach(field => {
            if (!isFormFieldFilled(field)) {
                missing.push(field);
            }
        });

        if (missing.length > 0) {
            setMissingFields(missing);
            setShowMissingAlert(true);
            setBackendError("");
            scrollToTop();
            return;
        }

        // Prepare profile data: only send number for latest_esncard and latest_document
        let profileToSubmit = {...profileValues};
        if (noEsncard) {
            profileToSubmit.latest_esncard = "0";
        } else if (profileToSubmit.latest_esncard && typeof profileToSubmit.latest_esncard === "object") {
            profileToSubmit.latest_esncard = profileToSubmit.latest_esncard.number || "";
        }
        if (profileToSubmit.latest_document && typeof profileToSubmit.latest_document === "object") {
            profileToSubmit.latest_document = profileToSubmit.latest_document.number || "";
        }

        setShowMissingAlert(false);
        setBackendError("");

        // Submit to backend
        fetchCustom("POST", `/event/${eventData.id}/formsubmit/`, {
            body: {
                email: profileData.email,
                profile_data: profileToSubmit,
                form_data: formValues,
                form_notes: formNotes
            },
            auth: false,
            onSuccess: (data) => {
                // handle success, e.g. navigate or show confirmation
                console.log("Form submitted:", data);
                navigate(`/event/${eventData.id}/formsuccess`);
            },
            onError: async (err) => {
                // If backend returns missing fields, show as missingFields alert
                if (err?.fields && Array.isArray(err.fields)) {
                    setMissingFields(err.fields);
                    setShowMissingAlert(true);
                    setBackendError("");
                } else if (err instanceof Response) {
                    // Try to parse error message from response body
                    try {
                        const data = await err.json();
                        setBackendError("Error: " + data?.error || "Submission failed");
                    } catch {
                        setBackendError("Submission failed");
                    }
                    setShowMissingAlert(false);
                } else {
                    setBackendError("Error: " + err?.error || "Submission failed");
                    setShowMissingAlert(false);
                }
                scrollToTop();
            }
        });
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
                                {eventData.date ? formatDate(eventData.date) : '-'}
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
                    {profileFields.length > 0 && (
                        <Paper elevation={3} sx={{p: 2, mb: 3}}>
                            <Typography variant="h6" gutterBottom>
                                Profile Data
                            </Typography>
                            <Grid container spacing={2} sx={{mt: 2}}>
                                {canonicalProfileOrder
                                    .filter(field => profileFields.includes(field))
                                    .map(field => {
                                        const type = profileFieldType(field);

                                        // ESNcard field with check and checkbox
                                        if (field === "latest_esncard") {
                                            // If user checks "no ESNcard", show checkbox only
                                            if (noEsncard) {
                                                return (
                                                    <Grid size={{xs: 12}} key="no-esncard">
                                                        <FormControlLabel
                                                            control={
                                                                <Checkbox
                                                                    checked={noEsncard}
                                                                    onChange={e => setNoEsncard(e.target.checked)}
                                                                />
                                                            }
                                                            label="I don't have an ESNcard yet (you can buy one at our ESN offices)"
                                                        />
                                                    </Grid>
                                                );
                                            }
                                            // Otherwise, show ESNcard number field, then check/cross, then checkbox
                                            return (
                                                <Grid size={{xs: 12}} key={field}>
                                                    <TextField
                                                        label="ESNcard Number"
                                                        value={profileValues.latest_esncard?.number || ""}
                                                        onChange={e => handleEsncardNumberChange(e.target.value)}
                                                        fullWidth
                                                        required={!noEsncard}
                                                        disabled={noEsncard}
                                                    />
                                                    {/* ESNcard check/cross below the field */}
                                                    <Box sx={{mt: 1}}>
                                                        {checkingEsncard ? (
                                                            <Typography variant="body2"
                                                                        color="text.secondary">Checking...</Typography>
                                                        ) : esncardExists === true ? (
                                                            <Box sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                color: 'success.main'
                                                            }}>
                                                                <CheckIcon fontSize="small" sx={{mr: 0.5}}/>
                                                                <Typography variant="body2">ESNcard exists</Typography>
                                                            </Box>
                                                        ) : esncardExists === false ? (
                                                            <Box sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                color: 'error.main'
                                                            }}>
                                                                <CloseIcon fontSize="small" sx={{mr: 0.5}}/>
                                                                <Typography variant="body2">ESNcard not
                                                                    found</Typography>
                                                            </Box>
                                                        ) : null}
                                                    </Box>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={noEsncard}
                                                                onChange={e => setNoEsncard(e.target.checked)}
                                                            />
                                                        }
                                                        label="I don't have an ESNcard yet (you can buy one at our ESN offices)"
                                                        sx={{mt: 1}}
                                                    />
                                                </Grid>
                                            );
                                        }

                                        if (field === "latest_document" && profileValues[field] && typeof profileValues[field] === "object") {
                                            return (
                                                <Grid size={{xs: 12}} key={field}>
                                                    <TextField
                                                        label="Document Number"
                                                        value={profileValues[field].number || ""}
                                                        fullWidth
                                                        required
                                                    />
                                                </Grid>
                                            );
                                        }

                                        if (type === "date") {
                                            return (
                                                <Grid size={{xs: 12}} key={field}>
                                                    <LocalizationProvider dateAdapter={AdapterDayjs}
                                                                          adapterLocale='en-gb'>
                                                        <DatePicker
                                                            label={profileFieldLabel(field)}
                                                            value={profileValues[field] ? dayjs(profileValues[field]) : null}
                                                            onChange={date => handleProfileChange(field, date)}
                                                            slotProps={{
                                                                textField: {
                                                                    fullWidth: true,
                                                                    required: true,
                                                                    disabled: field === "email"
                                                                }
                                                            }}
                                                            maxDate={field === "birthdate" ? dayjs() : undefined}
                                                        />
                                                    </LocalizationProvider>
                                                </Grid>
                                            );
                                        }
                                        if (type === "number") {
                                            return (
                                                <Grid size={{xs: 12}} key={field}>
                                                    <TextField
                                                        label={profileFieldLabel(field)}
                                                        type="number"
                                                        value={profileValues[field] || ""}
                                                        onChange={e => handleProfileChange(field, e.target.value)}
                                                        fullWidth
                                                        required
                                                        disabled={field === "email"}
                                                        slotProps={{htmlInput: {step: "0.01"}}}
                                                    />
                                                </Grid>
                                            );
                                        }
                                        if (type === "select_country") {
                                            return (
                                                <Grid size={{xs: 12}} key={field}>
                                                    <FormControl fullWidth required>
                                                        <InputLabel id={`${field}-label`}>Home University
                                                            Country</InputLabel>
                                                        <Select
                                                            labelId={`${field}-label`}
                                                            variant="outlined"
                                                            value={profileValues[field] || ""}
                                                            onChange={e => handleProfileChange(field, e.target.value)}
                                                            label="Home University Country"
                                                            disabled={field === "email"}
                                                        >
                                                            {countryCodes.map((country) => (
                                                                <MenuItem key={country.code} value={country.code}>
                                                                    {country.name}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                </Grid>
                                            );
                                        }
                                        if (type === "select_course") {
                                            return (
                                                <Grid size={{xs: 12}} key={field}>
                                                    <FormControl fullWidth required>
                                                        <InputLabel id={`${field}-label`}>Field of Study</InputLabel>
                                                        <Select
                                                            labelId={`${field}-label`}
                                                            variant="outlined"
                                                            value={profileValues[field] || ""}
                                                            onChange={e => handleProfileChange(field, e.target.value)}
                                                            label="Field of Study"
                                                            disabled={field === "email"}
                                                        >
                                                            {courseChoices.map(choice => (
                                                                <MenuItem key={choice.value} value={choice.value}>
                                                                    {choice.label}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                </Grid>
                                            );
                                        }
                                        if (type === "select_prefix") {
                                            return (
                                                <Grid size={{xs: 12}} key={field}>
                                                    <FormControl fullWidth required>
                                                        <InputLabel
                                                            id={`${field}-label`}>{field === 'phone_prefix' ? 'Phone Prefix' : 'WhatsApp Prefix'}</InputLabel>
                                                        <Select
                                                            labelId={`${field}-label`}
                                                            variant="outlined"
                                                            value={profileValues[field] || ""}
                                                            onChange={e => handleProfileChange(field, e.target.value)}
                                                            label={field === 'phone_prefix' ? 'Phone Prefix' : 'WhatsApp Prefix'}
                                                            disabled={field === "email"}
                                                        >
                                                            {countryCodes.map((country) => (
                                                                <MenuItem key={country.code} value={country.dial}>
                                                                    {country.dial} ({country.name})
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                </Grid>
                                            );
                                        }
                                        // Default: text field
                                        return (
                                            <Grid size={{xs: 12}} key={field}>
                                                <TextField
                                                    label={profileFieldLabel(field)}
                                                    value={profileValues[field] || ""}
                                                    onChange={e => handleProfileChange(field, e.target.value)}
                                                    fullWidth
                                                    required
                                                    disabled={field === "email"}
                                                />
                                            </Grid>
                                        );
                                    })}
                            </Grid>
                        </Paper>
                    )}
                    <Divider sx={{mb: 3}}/>
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
                                                    <FormHelperText>Select one option at least</FormHelperText>
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
                    )}
                    <Divider sx={{mb: 3}}/>
                    {/* Always show form_notes textbox at the end */}
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
                        {eventData.allow_online_payment ? "Proceed to Checkout" : "Submit"}
                    </Button>
                </Box>
            </Box>
        </Container>
    );
}
