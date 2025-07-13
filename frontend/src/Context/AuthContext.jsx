import {createContext, useCallback, useContext, useEffect, useState, useRef} from "react";
import {fetchCustom, defaultErrorHandler} from "../api/api";
import {jwtDecode} from "jwt-decode";
import * as Sentry from "@sentry/react";

const AuthContext = createContext(null);

export const AuthProvider = ({children}) => {
    const refreshTimer = useRef(null);
    const [accessToken, setAccessToken] = useState(localStorage.getItem("accessToken"));
    const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
    const [loading, setLoading] = useState(true);

    const parseUserFromToken = (token) => {
        try {
            const {user} = jwtDecode(token);
            return user;
        } catch (e) {
            Sentry.captureException(e);
            console.error("Invalid JWT token", e);
            return null;
        }
    };

    const login = (email, password) => {
        return new Promise((resolve) => {
            fetchCustom("POST", "/login/", {
                body: {email, password},
                auth: false,
                                onSuccess: (results) => {
                    const user = parseUserFromToken(results.access);
                    console.log("Login successful");
                    setAccessToken(results.access) // Fetch access token
                    // Fetch user data
                    console.log("Decoded access token:", user);
                    setUser(user);
                    // Store data in localStorage
                    localStorage.setItem("accessToken", results.access);
                    localStorage.setItem("user", JSON.stringify(user));
                    resolve(true);
                },
                onError: (responseOrError) => defaultErrorHandler(responseOrError, (msgObj) => resolve(msgObj.message)),
            });
        });
    };

    const logout = useCallback(({skipApiCall = false} = {}) => {
        console.log("Logout function called");

        if (refreshTimer.current) {
            console.log("Aborting refresh timer...");
            clearTimeout(refreshTimer.current);
            refreshTimer.current = null;
        }

        if (!skipApiCall) {
            fetchCustom("POST", "/logout/", {auth: false});
        }

        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        setAccessToken(null);
        setUser(null);
        console.log("Logged out successfully");
    }, []);


    const refreshAccessToken = useCallback(() => {
        if (accessToken) {
            const email = user?.profile?.email;
            fetchCustom("POST", "/api/token/refresh/", {
                body: {email},
                auth: false,
                                onSuccess: (results) => {
                    const user = parseUserFromToken(results.access);
                    setAccessToken(results.access);
                    setUser(user);
                    localStorage.setItem("accessToken", results.access);
                    localStorage.setItem("user", JSON.stringify(user));
                },
                onError: () => {
                    logout();
                }
            });
        }
    }, [user, accessToken, logout]);


    useEffect(() => {
        const clearRefreshTimer = () => {
            if (refreshTimer.current) {
                clearTimeout(refreshTimer.current);
                refreshTimer.current = null;
            }
        };

        if (!accessToken) {
            console.log("No access token found, skipping refresh scheduling");
            return;
        }

        const {exp} = jwtDecode(accessToken);
        const now = Math.floor(Date.now() / 1000);
        const refreshTime = (exp - now - 30) * 1000; // Refresh 30s before expiration

        const expDate = new Date(exp * 1000);
        const nowDate = new Date(now * 1000);
        console.log(`Token expires at: ${expDate.getHours()}:${expDate.getMinutes()}, current time: ${nowDate.getHours()}:${nowDate.getMinutes()}, refresh time in s: ${refreshTime / 1000}`);

        if (refreshTime <= 0) {
            console.log("Refresh time is not valid, no timer set");
            setAccessToken(null);
            return;
        }

        clearRefreshTimer();

        refreshTimer.current = setTimeout(() => {
            console.log("Refreshing access token...");
            refreshAccessToken();
        }, refreshTime);

        return () => {
            console.log("Clearing refresh timer");
            clearRefreshTimer();
        };
    }, [accessToken, refreshAccessToken]);

    useEffect(() => {
        const initializeAuth = () => {
            const storedToken = localStorage.getItem("accessToken");
            const storedUser = localStorage.getItem("user");

            if (storedToken && storedUser) {
                try {
                    const decodedToken = jwtDecode(storedToken);
                    const now = Math.floor(Date.now() / 1000);

                    if (decodedToken.exp > now) {
                        setAccessToken(storedToken);
                        setUser(JSON.parse(storedUser));
                    } else {
                        logout({skipApiCall: true}); // token expired
                    }
                } catch (e) {
                    Sentry.captureException(e);
                    console.error("Token decode error", e);
                    logout({skipApiCall: true}); // invalid token
                }
            }

            setLoading(false);
        };
        initializeAuth();
    }, [logout]);

    return (
        <AuthContext.Provider value={{user, accessToken, refreshAccessToken, logout, login, loading}}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
