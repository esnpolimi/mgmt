import {createContext, useCallback, useContext, useEffect, useState, useRef} from "react";
import {fetchCustom} from "../api/api";
import {jwtDecode} from "jwt-decode";
import {extractErrorMessage} from "../utils/errorHandling";
import * as Sentry from "@sentry/react";

const AuthContext = createContext(null);

export const AuthProvider = ({children}) => {
        const refreshTimer = useRef(null);
        const [accessToken, setAccessToken] = useState(localStorage.getItem("accessToken")); // localStorage needed for when refreshing pages
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

        const login = async (email, password) => {
            try {
                const response = await fetchCustom("POST", "/login/",
                    {email, password}, {}, false
                );
                const data = await response.json();
                if (response.ok) {
                    const user = parseUserFromToken(data.access);
                    console.log("Login successful");
                    setAccessToken(data.access) // Fetch access token
                    // Fetch user data
                    console.log("Decoded access token:", user);
                    setUser(user);
                    // Store data in localStorage
                    localStorage.setItem("accessToken", data.access);
                    localStorage.setItem("user", JSON.stringify(user));
                    return true;
                } else {
                    return await extractErrorMessage(data, response.status);
                }
            } catch (error) {
                Sentry.captureException(error);
                return error;
            }
        };

        const logout = useCallback(async ({skipApiCall = false} = {}) => {
            console.log("Logout function called");

            if (refreshTimer.current) {
                console.log("Aborting refresh timer...");
                clearTimeout(refreshTimer.current);
                refreshTimer.current = null;
            }

            if (!skipApiCall)
                await fetchCustom("POST", "/logout/");

            localStorage.removeItem("accessToken");
            localStorage.removeItem("user");
            setAccessToken(null);
            setUser(null);
            console.log("Logged out successfully");
        }, []);


        const refreshAccessToken = useCallback(async () => {
            if (accessToken) {
                try {
                    const email = user?.profile?.email;
                    const response = await fetchCustom("POST", "/api/token/refresh/",
                        {email}, {}, false);
                    if (response.ok) {
                        const data = await response.json();
                        const user = parseUserFromToken(data.access);
                        setAccessToken(data.access);
                        setUser(user);
                        localStorage.setItem("accessToken", data.access);
                        localStorage.setItem("user", JSON.stringify(user));
                        return true;
                    } else {
                        console.warn("Token refresh failed. Logging out...");
                        await logout();
                        return false;
                    }
                } catch (error) {
                    Sentry.captureException(error);
                    console.error("Refresh token error:", error);
                    await logout();
                    return false;
                }
            } else {
                console.log("Skipping token refresh, user is not logged in");
                return false;
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
            const refreshTime = (exp - now - 30) * 1000; // Refresh 30s before expiry

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
                refreshAccessToken().then();
            }, refreshTime);

            return () => {
                console.log("Clearing refresh timer");
                clearRefreshTimer();
            };
        }, [accessToken, refreshAccessToken]);

        useEffect(() => {
            const initializeAuth = async () => {
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
                            await logout({skipApiCall: true}); // token expired
                        }
                    } catch (e) {
                        Sentry.captureException(e);
                        console.error("Token decode error", e);
                        await logout({skipApiCall: true}); // invalid token
                    }
                }

                setLoading(false);
            };

            initializeAuth().then();
        }, [logout]);

        return (
            <AuthContext.Provider value={{user, accessToken, refreshAccessToken, logout, login, loading}}>
                {children}
            </AuthContext.Provider>
        );
    }
;

export const useAuth = () => useContext(AuthContext);
