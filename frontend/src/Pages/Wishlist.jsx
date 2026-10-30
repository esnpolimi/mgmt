import {useState} from 'react';
import {Box, Button, Paper, TextField, Typography} from '@mui/material';
import {fetchCustom} from '../api/api';
import logo from '../assets/esnpolimi-logo.png';

export default function Wishlist() {
    const [email, setEmail] = useState('');
    const [known, setKnown] = useState(null);
    const [form, setForm] = useState({first_name: '', last_name: '', phone: '', country: '', message: ''});
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const lookup = (event) => {
        event.preventDefault();
        setError('');
        setIsLoading(true);
        fetchCustom('GET', `/content/wishlist-lookup/?email=${encodeURIComponent(email)}`, {
            auth: false,
            onSuccess: (data) => {
                setKnown(data.exists);
            },
            onError: () => setError('Unable to verify the email.'),
            onFinally: () => setIsLoading(false),
        });
    };

    const submit = (event) => {
        event.preventDefault();
        fetchCustom('POST', '/content/wishlist/', {
            auth: false,
            body: {email, ...form},
            onSuccess: () => setSubmitted(true),
            onError: () => setError('Unable to submit the request.'),
        });
    };

    if (submitted) return <Box sx={{maxWidth: 700, mx: 'auto', mt: 8, px: 3}}>
        <Paper elevation={3} sx={{p: {xs: 3, sm: 6}, textAlign: 'center', borderRadius: 3}}>
            <Typography variant="h3" color="primary" gutterBottom>Thank you!</Typography>
            <Typography variant="h6" sx={{mb: 2}}>Your idea has been sent to the association&apos;s coordinators.</Typography>
            <Typography color="text.secondary" sx={{mb: 3}}>
                We are reviewing it and will do our best to turn it into reality.
            </Typography>
            <Typography variant="h5" color="secondary" sx={{fontStyle: 'italic', mb: 1}}>
                &ldquo;Great ideas become great memories when people build them together.&rdquo;
            </Typography>
            <Typography variant="body2" color="text.secondary">— ESN Politecnico Milano</Typography>
        </Paper>
    </Box>;

    return <Box component="main" sx={{maxWidth: 700, mx: 'auto', mt: 5, mb: 6, px: 3}}>
        <img src={logo} alt="ESN Polimi" style={{height: '15vh', display: 'block', margin: '0 auto 20px'}} />
        <Typography variant="h4" align="center" gutterBottom>ESN Wishlist</Typography>
        <Typography align="center" sx={{mb: 3}}>Share your idea for a trip or a new activity.</Typography>
        {known === null && <Box component="form" onSubmit={lookup} sx={{display: 'grid', gap: 2}}>
            <TextField fullWidth required type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" variant="contained" disabled={isLoading}>{isLoading ? 'Checking...' : 'Continue'}</Button>
            {error && <Typography color="error">{error}</Typography>}
        </Box>}
        {known !== null && <Box component="form" onSubmit={submit} sx={{display: 'grid', gap: 2, mt: 3}}>
            {!known && <>
                <TextField required label="First name" value={form.first_name} onChange={(e) => setForm({...form, first_name: e.target.value})} />
                <TextField required label="Last name" value={form.last_name} onChange={(e) => setForm({...form, last_name: e.target.value})} />
                <TextField label="Phone" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} />
                <TextField label="Country" value={form.country} onChange={(e) => setForm({...form, country: e.target.value})} />
            </>}
            {known && <Typography color="text.secondary">Your email was found in the system.</Typography>}
            <TextField required multiline minRows={5} label="Your idea" value={form.message} onChange={(e) => setForm({...form, message: e.target.value})} />
            {error && <Typography color="error">{error}</Typography>}
            <Button type="submit" variant="contained">Submit idea</Button>
        </Box>}
    </Box>;
}
