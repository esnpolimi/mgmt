import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Cookies from 'js-cookie'
import { useState } from 'react';


export default function Login()  {

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')

    const handleUsernameChange = (event) => {
        setUsername(event.target.value);
    };

    const handlePasswordChange = (event) => {
        setPassword(event.target.value);
    }

    const attemptLogin = () => {
        const body = {
            username: username,
            password: password
        }
        fetch('http://localhost:8000/login/', {
                method: 'POST', 
                credentials: 'include',
                headers: {'Content-Type':'application/json', 'X-CSRFToken':Cookies.get('csrftoken')},
                body: JSON.stringify(body),
        }).then( (response) => {console.log(response)})
    }

    return(
        <Container component="main" maxWidth="xs">
            <CssBaseline />
            <Box
                sx={{
                marginTop: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}
            >
                <img alt='' src={require('../assets/esnpolimi-logo.png')} style={{height: '25vh'}}/>
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
                    />
                    <Button
                        fullWidth
                        variant="contained"
                        sx={{ mt: 3, mb: 2, backgroundColor: 'black'}}
                        onClick={attemptLogin}
                    >
                    Log In
                    </Button>
                </Box>
            </Box>  
        </Container>
    )
}