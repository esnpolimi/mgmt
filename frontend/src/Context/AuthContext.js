import React, {createContext, useCallback, useContext, useEffect, useState, useRef} from "react";
import {fetchWithAuth} from "../api/api";
import {jwtDecode} from "jwt-decode";

const AuthContext = createContext(null);

export const AuthProvider = ({children}) => {
        const [accessToken, setAccessToken] = useState(localStorage.getItem("accessToken"));
        const [isLoggedOut, setIsLoggedOut] = useState(false);
        const refreshTimer = useRef(null);

        const logout = useCallback(async () => {
            console.log("Logout function called");
            setIsLoggedOut(true);

            if (refreshTimer.current) {
                console.log("Aborting refresh timer...");
                clearTimeout(refreshTimer.current);
                refreshTimer.current = null;
            }

            try {
                await fetchWithAuth("POST", "http://localhost:8000/logout/").then(
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
            try {
                const response = await fetch("http://localhost:8000/api/token/refresh/", {
                    method: "POST",
                    credentials: "include",
                });
                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem("accessToken", data.access);
                    setAccessToken(data.access);
                    setIsLoggedOut(false);
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
        }, [logout]);

        const login = async (username, password) => {
            try {
                const response = await fetch("http://localhost:8000/login/", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    credentials: "include", // Include cookies
                    body: JSON.stringify({username, password}),
                });
                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem("accessToken", data.access);
                    setAccessToken(data.access);
                    setIsLoggedOut(false);
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
                if (accessToken && !isLoggedOut) {
                    //console.log("Access token found, scheduling refresh...");
                    const {exp} = jwtDecode(accessToken);
                    const now = Math.floor(Date.now() / 1000);
                    const ACCESS_TOKEN_LIFETIME_MINUTES = 1;
                    const refreshTime = (exp - now - 30) * 1000 * ACCESS_TOKEN_LIFETIME_MINUTES; // Refresh 30 seconds before expiry

                    const expDate = new Date(exp * 1000);
                    const nowDate = new Date(now * 1000);
                    console.log(`Token expires at: ${expDate.getHours()}:${expDate.getMinutes()}, current time: ${nowDate.getHours()}:${nowDate.getMinutes()}, refresh time in s: ${refreshTime / 1000}`);

                    if (refreshTime > 0) {
                        if (refreshTimer.current) {
                            clearTimeout(refreshTimer.current);
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
                    }
                } else {
                    console.log("No access token found, skipping refresh scheduling");
                }
            };

            scheduleTokenRefresh();
        }, [accessToken, refreshAccessToken, isLoggedOut]);

        return (
            <AuthContext.Provider value={{accessToken, refreshAccessToken, login, logout}}>
                {children}
            </AuthContext.Provider>
        );
    }
;

export const useAuth = () => useContext(AuthContext);
