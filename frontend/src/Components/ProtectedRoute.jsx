import {useAuth} from "../Context/AuthContext";
import {useNavigate} from "react-router-dom";
import {useEffect, useState} from "react";

const ProtectedRoute = ({children}) => {
    const {accessToken} = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!accessToken) {
            console.log("PR: Redirecting to login...");
            navigate("/login");
        }
        // else console.log("PR: Token is valid");
    }, [accessToken, navigate]);

    return accessToken ? children : null;
};

export default ProtectedRoute;

