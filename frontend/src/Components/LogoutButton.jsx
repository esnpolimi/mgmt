import React from "react";
import {IconButton} from "@mui/material";
import {useAuth} from "../Context/AuthContext";
import {useNavigate} from "react-router-dom";
import LogoutIcon from '@mui/icons-material/Logout';

const LogoutButton = () => {
    const {logout} = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <IconButton
            variant="contained"
            sx={{backgroundColor: "black", color: "white"}}
            onClick={handleLogout}>
            <LogoutIcon/>
        </IconButton>
    );
};

export default LogoutButton;
