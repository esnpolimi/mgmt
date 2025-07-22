import {useState} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {Container, TextField, Button, Box, Typography, Link} from '@mui/material';
import StatusBanner from '../Components/StatusBanner';
import logo from '../assets/esnpolimi-logo.png';
import {defaultErrorHandler, fetchCustom} from "../api/api";
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function ResetPassword() {
    const {uid, token} = useParams();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [statusMessage, setStatusMessage] = useState(null);
    const [isSubmitted, setSubmitted] = useState(false);
    const [capsLockActive, setCapsLockActive] = useState({password: false, confirmPassword: false});

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

    const handleResetPassword = () => {
        if (password !== confirmPassword) {
            setStatusMessage({message: 'Le password non coincidono.', state: 'error'});
            return;
        }

        fetchCustom("POST", `/api/reset-password/${uid}/${token}/`, {
            body: {
                password: password,
                confirm_password: confirmPassword
            },
            auth: false,
            onSuccess: () => {
                setSubmitted(true);
                setStatusMessage({message: 'Password reimpostata con successo!', state: 'success'});
            },
            onError: (responseOrError) => defaultErrorHandler(responseOrError, (msgObj) => setStatusMessage(msgObj))
        });
    };

    return (
        <Container maxWidth="xs">
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}>
                <img alt='' src={logo || ''} style={{height: '25vh'}}/>
                <Typography style={{marginTop: 10}} variant="h5">Reimposta Password</Typography>
                {statusMessage && <StatusBanner message={statusMessage.message} state={statusMessage.state}/>}
                {!isSubmitted && (<>
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        label="Nuova Password"
                        type="password"
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handlePasswordKeyDown('password')}
                        onKeyUp={handlePasswordKeyUp('password')}
                    />
                    {/* Caps Lock warning */}
                    {capsLockActive.password && (
                        <Box sx={{display: 'flex', alignItems: 'center', color: 'orange', mt: 0.5}}>
                            <WarningAmberIcon fontSize="small" sx={{mr: 0.5}}/>
                            <Typography variant="caption">Attenzione: il tasto Bloc Maiusc è attivo</Typography>
                        </Box>
                    )}
                    <Box sx={{mt: 1, mb: 2, width: '100%'}}>
                        <Typography variant="caption" color="text.secondary">
                            La password deve contenere:
                        </Typography>
                        <ul style={{margin: 0, paddingLeft: 20}}>
                            {passwordRequirements.map((req, idx) => {
                                const passed = req.test(password);
                                return (
                                    <li key={idx} style={{color: passed ? 'green' : 'grey', display: 'flex', alignItems: 'center', mb: 2}}>
                                        {passed ? <CheckIcon fontSize="small" sx={{mr: 0.5}}/> : <CloseIcon fontSize="small" sx={{mr: 0.5}}/>}
                                        <span>{req.label}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    </Box>
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        label="Conferma Password"
                        type="password"
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyDown={handlePasswordKeyDown('confirmPassword')}
                        onKeyUp={handlePasswordKeyUp('confirmPassword')}
                    />
                    {capsLockActive.confirmPassword && (
                        <Box sx={{display: 'flex', alignItems: 'center', color: 'orange', mt: 0.5}}>
                            <WarningAmberIcon fontSize="small" sx={{mr: 0.5}}/>
                            <Typography variant="caption">Attenzione: il tasto Bloc Maiusc è attivo</Typography>
                        </Box>
                    )}
                    <Box sx={{mt: 1, width: '100%'}}>
                        {confirmPassword && (
                            <Typography variant="caption" sx={{display: 'flex', alignItems: 'center', color: password === confirmPassword ? 'green' : 'grey'}}>
                                {password === confirmPassword
                                    ? <CheckIcon fontSize="small" sx={{mr: 0.5}}/>
                                    : <CloseIcon fontSize="small" sx={{mr: 0.5}}/>
                                }
                                {password === confirmPassword
                                    ? "Le password corrispondono"
                                    : "Le password non corrispondono"}
                            </Typography>
                        )}
                    </Box>
                    <Button
                        fullWidth
                        variant="contained"
                        sx={{mt: 3, mb: 2}}
                        onClick={handleResetPassword}>
                        Reimposta Password
                    </Button>
                </>)}
                {isSubmitted && (
                    <Link
                        component="button"
                        variant="body2"
                        sx={{textAlign: 'center'}}
                        onClick={() => navigate('/login')}>
                        Vai al Login
                    </Link>
                )}
            </Box>
        </Container>
    );
}
