import {useAuth} from "../Context/AuthContext";
import {useNavigate} from "react-router-dom";
import {useEffect} from "react";

export default function ProtectedRoute({children, requiredPermission}) {
    const {accessToken, user, loading} = useAuth(); // assuming `loading` tracks auth check
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && (!accessToken || (requiredPermission && !user?.permissions.includes(requiredPermission)))) {
            console.log("Redirecting to login...");
            navigate("/login", {replace: true});
        }
    }, [loading, accessToken, user, requiredPermission, navigate]);

    if (loading) {
        return <div>Loading...</div>; // Prevent early rendering
    }

    if (!accessToken || (requiredPermission && !user?.permissions.includes(requiredPermission))) {
        return null; // Prevent rendering children during navigation
    }

    return children;
};