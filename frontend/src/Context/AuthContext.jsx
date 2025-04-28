import React, {createContext, useCallback, useContext, useEffect, useState, useRef} from "react";
import {fetchCustom} from "../api/api";
import {jwtDecode} from "jwt-decode";

const AuthContext = createContext(null);
const ACCESS_TOKEN_LIFETIME_MINUTES = import.meta.env.VITE_ACCESS_TOKEN_LIFETIME_MINUTES;

export const AuthProvider = ({children}) => {
        const [accessToken, setAccessToken] = useState(localStorage.getItem("accessToken")); // localStorage needed for when refreshing page
        const refreshTimer = useRef(null);

        const [accounts, setAccounts] = useState([]);
        const [user, setUser] = useState(() => {
            try {
                const storedUser = localStorage.getItem("user");
                //console.log("User from localStorage:", storedUser);
                return storedUser ? JSON.parse(storedUser) : null;
            } catch (error) {
                console.error("Failed to parse user from localStorage:", error);
                return null;
            }
        });

        const login = async (username, password) => {
            try {
                const response = await fetchCustom("POST", "/login/",
                    {username, password}, {}, false
                );
                if (response.ok) {
                    const data = await response.json();
                    const decodedToken = jwtDecode(data.access);
                    console.log("Login successful");
                    console.log("Decoded User token:", decodedToken.user);
                    setUser(decodedToken.user);
                    setAccessToken(data.access);
                    localStorage.setItem("accessToken", data.access);
                    localStorage.setItem("user", JSON.stringify(decodedToken.user));
                    // Fetch accounts after login
                    const accountsResp = await fetchCustom("GET", "/accounts/");
                    if (accountsResp.ok) {
                        const accountsJson = await accountsResp.json();
                        console.log("Accounts fetched successfully:", accountsJson);
                        setAccounts(accountsJson);
                    }
                    return true;
                } else {
                    console.error("Invalid credentials");
                }
            } catch (error) {
                console.error("Login error:", error);
                return false;
            }
        };

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
                        localStorage.removeItem("user");
                        setAccessToken(null);
                        setUser(null); // Clear user data on logout
                        console.log("Logged out successfully");
                    }
                )
            } catch (error) {
                console.error("Logout error:", error);
            }
        }, [refreshTimer]);

        const refreshAccessToken = useCallback(async () => {
            if (accessToken) {
                try {
                    const email = user.profile.email; // Include user email to retrieve updated user data
                    const response = await fetchCustom("POST", "/api/token/refresh/",
                        {email}, {}, false);
                    if (response.ok) {
                        const data = await response.json();
                        const decodedToken = jwtDecode(data.access);
                        //console.log("Decoded User token:", decodedToken.user);
                        setUser(decodedToken.user);
                        setAccessToken(data.access);
                        localStorage.setItem("accessToken", data.access);
                        localStorage.setItem("user", JSON.stringify(decodedToken.user));
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
        }, [user, accessToken, logout]);


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
                            //console.log("Refreshing access token...");
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
        }, [refreshTimer, accessToken, refreshAccessToken]);

        return (
            <AuthContext.Provider value={{user, accessToken, refreshAccessToken, logout, login, accounts}}>
                {children}
            </AuthContext.Provider>
        );
    }
;

export const useAuth = () => useContext(AuthContext);
