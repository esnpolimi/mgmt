import React from "react";
import {Button} from "@mui/material";
import {useAuth} from "../Context/AuthContext";
import {useNavigate} from "react-router-dom";

const Logout = () => {
    const {logout} = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <Button
            variant="contained"
            sx={{backgroundColor: "black", color: "white", marginTop: 2}}
            onClick={handleLogout}
        >
            Logout
        </Button>
    );
};

export default Logout;
