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
    Alert,
    MenuItem,
    InputLabel,
    Select
} from "@mui/material";
import {CircularProgress} from "@mui/material";
import {useLocation, useParams, useNavigate} from "react-router-dom";
import logo from "../../assets/esnpolimi-logo.png";
import {useState, useEffect} from "react";
import {
    Euro as EuroIcon,
    CalendarToday as CalendarTodayIcon,
    AddCard as AddCardIcon, // added import
} from "@mui/icons-material";
import {fetchCustom} from "../../api/api";
import {LocalizationProvider, DatePicker} from "@mui/x-date-pickers";
import {AdapterDayjs} from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);
import countryCodes from "../../data/countryCodes.json";
import ReceiptFileUpload from "../../Components/common/ReceiptFileUpload";

export default function EventForm() {
    const {id} = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const eventData = location.state?.eventData || {};
    const userEmail = location.state?.email || ""; // email passed from login
    const profileEsncardNumber = location.state?.esncardNumber || ""; // ESNcard from profile if available
    const formFields = eventData.form_fields || [];
    const linkFields = formFields.filter(f => f.type === 'l');
    const formNote = eventData.form_note || "";
    const eventServices = Array.isArray(eventData.services) ? eventData.services : [];

    // Redirect if missing essentials
    useEffect(() => {
        if (!eventData.id) {
            navigate(`/event/${id}/formlogin`);
            return;
        }
        if (!userEmail && !eventData.is_allow_external) {
            navigate(`/event/${id}/formlogin`);

        }
    }, [eventData, id, navigate, userEmail]);

    // Initialize form state
    const [formValues, setFormValues] = useState(() =>
        Object.fromEntries(formFields.map(f => {
            if (f.type === "m") return [f.name, []];
            if (f.type === "b") return [f.name, null];
            if (f.type === "e" && profileEsncardNumber) return [f.name, profileEsncardNumber];
            if (f.type === "l") return [f.name, ""]; // link placeholder (backend will fill after upload)
            return [f.name, ""];
        }))
    );
    const [selectedServices, setSelectedServices] = useState([]);
    // Track files for link fields separately
    const [linkFiles, setLinkFiles] = useState(() =>
        Object.fromEntries(linkFields.map(f => [f.name, null]))
    );
    const handleLinkFileChange = (field, file) => {
        setLinkFiles(prev => ({...prev, [field]: file}));
    };

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

    const toggleService = (svc) => {
        const serviceId = svc.id || svc.name;
        setSelectedServices(prev => {
            const existing = prev.find(x => (x.service_id || x.name) === serviceId);
            if (existing) {
                return prev.filter(x => (x.service_id || x.name) !== serviceId);
            }
            return [...prev, {service_id: serviceId, name: svc.name, quantity: 1}];
        });
    };

    const updateServiceQty = (svc, qtyRaw) => {
        const serviceId = svc.id || svc.name;
        const qty = Math.max(1, Number.parseInt(qtyRaw || 1, 10) || 1);
        setSelectedServices(prev => prev.map(x => {
            const key = (x.service_id || x.name);
            if (key !== serviceId) return x;
            return {...x, quantity: qty};
        }));
    };

    const getServicesTotal = () => {
        return selectedServices.reduce((sum, s) => {
            const svc = eventServices.find(es => (es.id || es.name) === (s.service_id || s.name));
            const price = Number.parseFloat(svc?.price || 0) || 0;
            const qty = Math.max(1, Number.parseInt(s.quantity || 1, 10) || 1);
            return sum + (price * qty);
        }, 0);
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
        if (fieldObj.type === "e" && !profileEsncardNumber) {
            // No ESNcard returned; field is intentionally disabled & considered filled
            return true;
        }
        if (fieldObj.type === "l") {
            // Must have a file selected; value stored in linkFiles
            return !!linkFiles[field];
        }
        return formValues[field] !== undefined && formValues[field] !== null && formValues[field] !== "";
    };

    const scrollToTop = () => window.scrollTo({top: 0, behavior: "smooth"});

    // Notes
    const [formNotes, setFormNotes] = useState("");
    const [submitLoading, setSubmitLoading] = useState(false);

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
        setSubmitLoading(true);
        const selectedPayload = selectedServices.map(s => ({
            service_id: s.service_id,
            name: s.name,
            quantity: s.quantity
        }));
        // Build multipart if any link file selected
        const useMultipart = linkFields.length > 0;
        let bodyPayload;
        if (useMultipart) {
            const fd = new FormData();
            fd.append('email', userEmail);
            // Only send non-link fields inside form_data JSON
            const nonLinkData = {...formValues};
            linkFields.forEach(f => delete nonLinkData[f.name]);
            fd.append('form_data', JSON.stringify(nonLinkData));
            fd.append('form_notes', formNotes);
            fd.append('selected_services', JSON.stringify(selectedPayload));
            // Append files (field name must match backend expectation)
            linkFields.forEach(f => {
                const fileObj = linkFiles[f.name];
                if (fileObj) fd.append(f.name, fileObj, fileObj.name);
            });
            bodyPayload = fd;
        } else {
            bodyPayload = {
                email: userEmail,
                form_data: formValues,
                form_notes: formNotes,
                selected_services: selectedPayload
            };
        }
        fetchCustom("POST", `/event/${eventData.id}/formsubmit/`, {
            body: bodyPayload,
            auth: false,
            // NOTE: fetchCustom should detect FormData and avoid JSON stringify / set content-type
            onSuccess: (data) => {
                if (data.payment_error) {
                    const offlineMsg = "Online payment currently unavailable. Your subscription is recorded; please contact us for payment.";
                    navigate(`/event/${eventData.id}/formresult`, {
                        state: {
                            subscriptionId: data.subscription_id,
                            assignedList: data.assigned_list,
                            noPayment: false,
                            paymentError: true,
                            paymentErrorMessage: offlineMsg
                        }
                    });
                    return;
                }
                if (data.payment_required && data.checkout_id) {
                    // Do NOT redirect to widget now; user will use email link
                    navigate(`/event/${eventData.id}/formresult`, {
                        state: {
                            subscriptionId: data.subscription_id,
                            assignedList: data.assigned_list,
                            paymentRequired: true
                        }
                    });
                    return;
                }
                // No payment required at all
                navigate(`/event/${eventData.id}/formresult`, {
                    state: {
                        subscriptionId: data.subscription_id,
                        assignedList: data.assigned_list,
                        noPayment: true
                    }
                });
            },
            onError: async (err) => {
                // Try to get a parsed body
                let body = err;
                if (typeof err.json === 'function') {
                    try {
                        body = await err.json();
                        // eslint-disable-next-line no-unused-vars
                    } catch (_) { /* empty */
                    }
                }
                const fields = body?.fields;
                const errorMsg =
                    body?.error ||
                    body?.detail ||
                    (Array.isArray(fields) ? 'Missing required fields' : 'Submission failed');

                if (Array.isArray(fields)) {
                    setMissingFields(fields);
                    setShowMissingAlert(true);
                    setBackendError('');
                } else {
                    setBackendError('Error: ' + errorMsg);
                    setShowMissingAlert(false);
                }
                scrollToTop();
            },
            onFinally: () => setSubmitLoading(false)
        });
    };

    const formatDate = (dt) => {
        if (!dt) return '-';
        const d = new Date(dt);
        return d.toLocaleDateString('it-IT');
    };


    // Helper to split / join phone (stored as single string)
    const parsePhone = (val) => {
        if (!val) return {prefix: '', number: ''};
        const parts = val.trim().split(/\s+/);
        if (parts[0].startsWith('+')) {
            return {prefix: parts[0], number: parts.slice(1).join(' ')};
        }
        return {prefix: '', number: val};
    };
    const setPhoneValue = (fieldName, prefix, number) => {
        const combined = prefix ? (number ? `${prefix} ${number}` : prefix) : number;
        handleChange(fieldName, combined);
    };

    return (
        <Container component="main" maxWidth="sm">
            <CssBaseline/>
            <Box sx={{marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                <img src={logo} alt='ESN Polimi Logo' style={{height: '20vh', marginBottom: "4px"}}/>
                <Typography variant="h5" gutterBottom align="center">
                    Event Subscription Form
                </Typography>
                <Typography variant="h4" gutterBottom align="center" component="div">
                    <i>{eventData.name}</i>
                </Typography>
                {formNote && (
                    <Paper elevation={3} style={{ padding: '20px', marginBottom: '25px', backgroundColor: '#fffbe6', border: '1px solid #ffe58f' }}>
                      <Typography variant="h6" style={{ color: '#ad8b00', fontWeight: 'bold' }}>
                        Notes for participants:
                      </Typography>
                      <Typography variant="body1" style={{ marginTop: '10px', whiteSpace: 'pre-line' }}>
                        {formNote}
                      </Typography>
                    </Paper>
                )}
                <Alert severity="info" sx={{mb: 2}}>
                    {eventData.allow_online_payment
                        ? "Reminder: Your position in Main/Waiting List will be assigned when your online payment succeeds. Earlier payment = higher priority."
                        : "Reminder: Your position in Main/Waiting List will be assigned when you pay at the office. Order of in‑office payments decides priority."}
                </Alert>
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
                {/* Optional services */}
                {eventServices.length > 0 && (
                    <Paper elevation={2} sx={{p: 2, mt: 2, width: '100%'}}>
                        <Typography variant="h6" gutterBottom>
                            Additional Services
                        </Typography>
                        {eventServices.map((svc) => {
                            const key = svc.id || svc.name;
                            const selected = selectedServices.find(s => (s.service_id || s.name) === key);
                            return (
                                <Box key={key} sx={{mb: 2}}>
                                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 0.5}}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={!!selected}
                                                    onChange={() => toggleService(svc)}
                                                />
                                            }
                                            label={`${svc.name} (€${Number(svc.price || 0).toFixed(2)})`}
                                        />
                                        <TextField
                                            label="Qty"
                                            type="number"
                                            size="small"
                                            sx={{width: 90}}
                                            value={selected?.quantity || 1}
                                            onChange={(e) => updateServiceQty(svc, e.target.value)}
                                            disabled={!selected}
                                            slotProps={{htmlInput: {min: 1, step: 1}}}
                                        />
                                    </Box>
                                    {svc.description && (
                                        <Typography variant="body2" color="text.secondary" sx={{ml: 4, fontStyle: 'italic'}}>
                                            {svc.description}
                                        </Typography>
                                    )}
                                </Box>
                            );
                        })}
                        <Typography variant="body2" sx={{mt: 1}}>
                            Services Total: €{getServicesTotal().toFixed(2)}
                        </Typography>
                        <Typography variant="subtitle2" sx={{mt: 1}}>
                            Grand Total: €{(Number(eventData.cost || 0) + Number(eventData.deposit || 0) + getServicesTotal()).toFixed(2)}
                        </Typography>
                    </Paper>
                )}
                <Box component="form" onSubmit={handleSubmit} sx={{mt: 3, width: '100%'}}>
                    {/* Added subscription email display */}
                    <Paper elevation={1} sx={{p: 2, mb: 3}}>
                        <Typography variant="subtitle2" color="text.secondary">Subscription Email</Typography>
                        <Typography variant="body1" sx={{mt: 0.5}}>{userEmail}</Typography>
                    </Paper>
                    {/* Only form fields section now */}
                    {formFields.length > 0 && (
                        <Paper elevation={3} sx={{p: 2, mb: 3}}>
                            <Typography variant="h6" gutterBottom>
                                Event Form Data
                            </Typography>
                            {formFields.map(field => {
                                switch (field.type) {
                                    case "l":
                                        return (
                                            <Box key={field.name} sx={{mt: 1}}>
                                                <Typography variant="subtitle1" color="text.secondary" sx={{mb: 0.5}}>
                                                    {field.name}{field.required && ' *'}
                                                </Typography>
                                                <ReceiptFileUpload
                                                    file={linkFiles[field.name]}
                                                    onFileChange={(f) => handleLinkFileChange(field.name, f)}
                                                    label={`Upload File`}
                                                    dense={false}
                                                    helperText="Accepted: PDF or image files"
                                                />
                                            </Box>
                                        );
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
                                    case "s":
                                        return (
                                            <FormControl key={field.name} required={field.required} margin="normal" fullWidth>
                                                <InputLabel>{field.name}</InputLabel>
                                                <Select
                                                    value={formValues[field.name] || ""}
                                                    onChange={e => handleChange(field.name, e.target.value)}
                                                    label={field.name}
                                                >
                                                    {field.choices?.map(choice => (
                                                        <MenuItem key={choice} value={choice}>
                                                            {choice}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
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
                                    case "d":
                                        return (
                                            <LocalizationProvider key={field.name} dateAdapter={AdapterDayjs}
                                                                  adapterLocale='en-gb'>
                                                <DatePicker
                                                    label={field.name}
                                                    format="DD-MM-YYYY"
                                                    value={
                                                        formValues[field.name]
                                                            ? dayjs(formValues[field.name], "DD-MM-YYYY")
                                                            : null
                                                    }
                                                    onChange={val =>
                                                        handleChange(
                                                            field.name,
                                                            val && val.isValid() ? val.format('DD-MM-YYYY') : ''
                                                        )
                                                    }
                                                    slotProps={{
                                                        textField: {
                                                            fullWidth: true,
                                                            margin: "normal",
                                                            required: field.required
                                                        }
                                                    }}
                                                />
                                            </LocalizationProvider>
                                        );
                                    case "e": {
                                        const locked = !!profileEsncardNumber;
                                        if (locked) {
                                            return (
                                                <Box key={field.name} sx={{mt: 2}}>
                                                    <TextField
                                                        label={field.name}
                                                        fullWidth
                                                        margin="normal"
                                                        value={formValues[field.name] || ""}
                                                        disabled
                                                        required={field.required}
                                                    />
                                                    <Typography variant="caption" sx={{display: 'block', ml: 1}}>
                                                        ESNcard retrieved from your profile
                                                    </Typography>
                                                </Box>
                                            );
                                        }
                                        // No ESNcard available: user cannot fill it, must type manually in notes
                                        return (
                                            <Box key={field.name} sx={{mt: 1}}>
                                                <TextField
                                                    label={field.name}
                                                    fullWidth
                                                    margin="normal"
                                                    value=""
                                                    disabled
                                                />
                                                <Typography variant="caption"
                                                            sx={{display: 'block', ml: 1, color: 'error.main'}}>
                                                    {eventData.is_allow_external
                                                        ? 'No ESNcard found, type it manually in the Notes below (not strictly needed)'
                                                        : 'No ESNcard found, type it manually in the Notes below or buy one before the day of the event at our ESN offices'}
                                                </Typography>
                                            </Box>
                                        );
                                    }
                                    case "p": {
                                        const {prefix, number} = parsePhone(formValues[field.name]);
                                        // Build unique dial code entries (first occurrence keeps the country name)
                                        const dialEntries = [];
                                        const seen = new Set();
                                        countryCodes.forEach(c => {
                                            if (c.dial && !seen.has(c.dial)) {
                                                seen.add(c.dial);
                                                dialEntries.push(c);
                                            }
                                        });
                                        return (
                                            <Box key={field.name} sx={{mt: 2}}>
                                                <Typography variant="subtitle2"
                                                            sx={{mb: 2}}>{field.name}{field.required && ' *'}</Typography>
                                                <Box sx={{display: 'flex', gap: 1}}>
                                                    <TextField
                                                        select
                                                        label="Prefix"
                                                        value={prefix}
                                                        onChange={e => setPhoneValue(field.name, e.target.value, number)}
                                                        sx={{width: 140}}
                                                        required={field.required}
                                                    >
                                                        {dialEntries.map(entry => (
                                                            <MenuItem key={entry.dial} value={entry.dial}>
                                                                {entry.dial}
                                                            </MenuItem>
                                                        ))}
                                                    </TextField>
                                                    <TextField
                                                        label="Number"
                                                        value={number}
                                                        onChange={e => setPhoneValue(field.name, prefix, e.target.value)}
                                                        fullWidth
                                                        required={field.required}
                                                    />
                                                </Box>
                                            </Box>
                                        );
                                    }
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
                    <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        fullWidth
                        disabled={submitLoading}
                        startIcon={submitLoading ? <CircularProgress size={18}/> : null}
                    >
                        {submitLoading
                            ? "Processing..."
                            : ((eventData.allow_online_payment && (Number(eventData.cost) + Number(eventData.deposit)) > 0)
                                ? "Submit Registration"
                                : "Submit")}
                    </Button>
                </Box>
            </Box>
        </Container>
    );
}
