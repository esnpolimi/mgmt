import React, {createContext, useCallback, useContext, useEffect, useState, useRef} from "react";
import {fetchCustom} from "../api/api";
import {jwtDecode} from "jwt-decode";

const AuthContext = createContext(null);
const ACCESS_TOKEN_LIFETIME_MINUTES = import.meta.env.VITE_ACCESS_TOKEN_LIFETIME_MINUTES;

export const AuthProvider = ({children}) => {
        const [accessToken, setAccessToken] = useState(localStorage.getItem("accessToken"));
        const refreshTimer = useRef(null);

        const logout = useCallback(async () => {
            console.log("Logout function called");

            if (refreshTimer.current) {
                console.log("Aborting refresh timer...");
                clearTimeout(refreshTimer.current);
                refreshTimer.current = null;
            }

            try {
                await fetchCustom("POST", "/logout/").then(
                    () => {
                        localStorage.removeItem("accessToken");
                        setAccessToken(null);
                        console.log("Logged out successfully");
                    }
                )
            } catch (error) {
                console.error("Logout error:", error);
            }
        }, []);

        const refreshAccessToken = useCallback(async () => {
            if (accessToken) {
                try {
                    const response = await fetchCustom("POST", "/api/token/refresh/", null, {}, false);
                    if (response.ok) {
                        const data = await response.json();
                        localStorage.setItem("accessToken", data.access);
                        setAccessToken(data.access);
                        return true;
                    } else {
                        console.warn("Token refresh failed. Logging out...");
                        await logout();
                        return false;
                    }
                } catch (error) {
                    console.error("Refresh token error:", error);
                    await logout();
                    return false;
                }
            } else {
                console.log("Skipping token refresh, user is not logged in");
                return false;
            }
        }, [logout]);

        const login = async (username, password) => {
            try {
                const response = await fetchCustom("POST", "/login/",
                    {username, password}, {}, false
                );
                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem("accessToken", data.access);
                    setAccessToken(data.access);
                    return true;
                } else {
                    console.error("Invalid credentials");
                }
            } catch (error) {
                console.error("Login error:", error);
                return false;
            }
        };

        useEffect(() => {
            const scheduleTokenRefresh = () => {
                if (accessToken) {
                    const {exp} = jwtDecode(accessToken);
                    const now = Math.floor(Date.now() / 1000);
                    const refreshTime = (exp - now - 30) * 1000 * ACCESS_TOKEN_LIFETIME_MINUTES; // Refresh 30 seconds before expiry
                    const expDate = new Date(exp * 1000);
                    const nowDate = new Date(now * 1000);
                    console.log(`Token expires at: ${expDate.getHours()}:${expDate.getMinutes()}, current time: ${nowDate.getHours()}:${nowDate.getMinutes()}, refresh time in s: ${refreshTime / 1000}`);

                    if (refreshTime > 0) {
                        if (refreshTimer.current) {
                            clearTimeout(refreshTimer.current);
                            refreshTimer.current = null;
                        }
                        refreshTimer.current = setTimeout(() => {
                            console.log("Refreshing access token...");
                            refreshAccessToken().then();
                        }, refreshTime);

                        return () => {
                            console.log("Clearing refresh timer");
                            if (refreshTimer.current) {
                                clearTimeout(refreshTimer.current);
                                refreshTimer.current = null;
                            }
                        };
                    } else {
                        console.log("Refresh time is not valid, no timer set");
                        setAccessToken(null);
                    }
                } else {
                    console.log("No access token found, skipping refresh scheduling");
                }
            };

            scheduleTokenRefresh();
        }, [accessToken, refreshAccessToken]);

        return (
            <AuthContext.Provider value={{accessToken, refreshAccessToken, logout, login}}>
                {children}
            </AuthContext.Provider>
        );
    }
;

export const useAuth = () => useContext(AuthContext);
