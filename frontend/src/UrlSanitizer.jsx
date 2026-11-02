import {useEffect} from "react";
import {useLocation, useNavigate} from "react-router-dom";

function UrlSanitizer() {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        let decodedPath;
        try {
            decodedPath = decodeURIComponent(location.pathname);
        } catch {
            return;
        }
        const cleanPath = decodedPath
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