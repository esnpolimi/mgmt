import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import React, {useState} from 'react';
import {useNavigate} from "react-router-dom";
import {useAuth} from "../Context/AuthContext";
import logo from '../assets/esnpolimi-logo.png';

export default function Login() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const {login} = useAuth(); // Use login from AuthContext
    const navigate = useNavigate();  // Initialize navigate function from useNavigate

    const handleUsernameChange = (event) => {
        setUsername(event.target.value);
    };

    const handlePasswordChange = (event) => {
        setPassword(event.target.value);
    }

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            handleLogin().then();
        }
    };

    const handleLogin = async () => {
        try {
            const success = await login(username, password);
            if (success) {
                navigate("/");
            } else {
                alert("Invalid credentials. Please check your email and password.");
            }
        } catch (error) {
            console.error("Login error:", error);
            alert("An unexpected error occurred. Please try again later.");
        }
    };


    return (
        <Container component="main" maxWidth="xs">
            <CssBaseline/>
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <img alt='' src={logo} style={{height: '25vh'}}/>
                <Box>
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="email"
                        label="Email Address"
                        name="email"
                        autoComplete="email"
                        autoFocus
                        onChange={handleUsernameChange}
                        onKeyDown={handleKeyDown}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label="Password"
                        type="password"
                        id="password"
                        autoComplete="current-password"
                        onChange={handlePasswordChange}
                        onKeyDown={handleKeyDown}
                    />
                    <Button
                        fullWidth
                        variant="contained"
                        sx={{mt: 3, mb: 2, backgroundColor: 'black'}}
                        onClick={handleLogin}
                    >
                        Log In
                    </Button>
                </Box>
            </Box>
        </Container>
    )
}