import {useAuth} from "../Context/AuthContext";
import {useNavigate} from "react-router-dom";
import {useEffect} from "react";

const ProtectedRoute = ({children, requiredPermission}) => {
    const {accessToken, user} = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!accessToken || (requiredPermission && !user?.permissions.includes(requiredPermission))) {
            console.log("PR: Redirecting to login or insufficient permissions...");
            navigate("/login");
        }
    }, [accessToken, user, requiredPermission, navigate]);

    return accessToken && (!requiredPermission || user?.permissions.includes(requiredPermission)) ? children : null;
};

export default ProtectedRoute;