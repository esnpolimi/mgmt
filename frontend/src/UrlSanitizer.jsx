import {useEffect} from "react";
import {useLocation, useNavigate} from "react-router-dom";

function UrlSanitizer() {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const cleanPath = decodeURIComponent(location.pathname)
            .replace(/\u00A0/g, "")
            .replace(/\s+$/, "")
            .trim();
        if (cleanPath !== location.pathname) {
            navigate(cleanPath, {replace: true});
        }
    }, [location, navigate]);

    return null;
}

export default UrlSanitizer;