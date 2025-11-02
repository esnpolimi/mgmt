import {useAuth} from "../Context/AuthContext";
import {useNavigate} from "react-router-dom";
import {useEffect} from "react";

export default function ProtectedRoute({children, requiredPermission, requiredGroup}) {
    const {accessToken, user, loading} = useAuth(); // assuming `loading` tracks auth check
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !accessToken) {
            console.log("Redirecting to login...");
            navigate("/login", {replace: true});
            return;
        }

        if (!loading && accessToken) {
            // Check permission
            if (requiredPermission && !user?.permissions.includes(requiredPermission)) {
                console.log("Missing required permission, redirecting to login...");
                navigate("/login", {replace: true});
                return;
            }

            // Check group
            if (requiredGroup && !user?.groups.includes(requiredGroup)) {
                console.log("Missing required group, redirecting to login...");
                navigate("/login", {replace: true});
                return;
            }
        }
    }, [loading, accessToken, user, requiredPermission, requiredGroup, navigate]);

    if (loading) {
        return <div>Loading...</div>; // Prevent early rendering
    }

    if (!accessToken || 
        (requiredPermission && !user?.permissions.includes(requiredPermission)) ||
        (requiredGroup && !user?.groups.includes(requiredGroup))) {
        return null; // Prevent rendering children during navigation
    }

    return children;
};