import {useAuth} from "../Context/AuthContext";
import {useNavigate} from "react-router-dom";
import {useEffect, useState} from "react";

const ProtectedRoute = ({children}) => {
    const {accessToken, refreshAccessToken} = useAuth();
    const navigate = useNavigate();

    //Avoid displaying content before token is checked
    const [displayContent, setDisplayContent] = useState(false)

    useEffect(() => {
        const checkAccessToken = async () => {
            if (!accessToken) {
                console.log("Access token is missing or expired!");
                const refreshed = await refreshAccessToken();
                if (!refreshed) {
                    navigate("/login");
                }
            } else {
                console.log("Token not expired");
            }
            setDisplayContent(true);
        };
        (async () => await checkAccessToken())();
    }, [accessToken, refreshAccessToken, navigate]);

    return displayContent ? children : <></>
};

export default ProtectedRoute;

