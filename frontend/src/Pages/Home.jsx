import Sidebar from "../Components/Sidebar";
import {Box, Typography} from "@mui/material"
import logo from '../assets/esnpolimi-logo.png';
import {useAuth} from "../Context/AuthContext";

const style = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh', // Ensures the content is centered vertically
};

export default function Home() {
    const {user} = useAuth(); // Access logged-in user info
    console.log(user);
    return (
        <Box>
            <Sidebar/>
            <Box sx={style}>
                <Typography variant="h3" gutterBottom>
                    Sistema di Gestione
                </Typography>
                <img src={logo} alt="ESN Polimi Logo" style={{height: '25vh', marginTop: '20px'}}/>
                <h1>Benvenuto, {user ? user.profile.name : "Sir"}!</h1>
            </Box>
        </Box>
    );
}