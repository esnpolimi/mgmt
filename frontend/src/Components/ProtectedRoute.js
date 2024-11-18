import {useAuth} from "../Context/AuthContext";
import {useNavigate} from "react-router-dom";
import {useEffect} from "react";

const ProtectedRoute = ({children}) => {
    const {accessToken, refreshAccessToken} = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const checkAccessToken = async () => {
            if (!accessToken) {
                console.log("Access token is missing or expired!!");
                const refreshed = await refreshAccessToken();
                if (!refreshed) {
                    navigate("/login");
                }
            } else {
                console.log("Token not expired");
            }
        };
        (async () => await checkAccessToken())();
    }, [accessToken, refreshAccessToken, navigate]);

    return children;
};

export default ProtectedRoute;

