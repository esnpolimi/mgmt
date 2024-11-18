import React, {createContext, useContext, useEffect, useState} from "react";
import {fetchWithAuth} from "../api/api";
import {jwtDecode} from "jwt-decode";

const AuthContext = createContext(null);

export const AuthProvider = ({children}) => {
        const [accessToken, setAccessToken] = useState(localStorage.getItem("accessToken"));

        useEffect(() => {
            const scheduleTokenRefresh = () => {
                if (accessToken) {
                    const {exp} = jwtDecode(accessToken);
                    const now = Math.floor(Date.now() / 1000);
                    const refreshTime = (exp - now - 30) * 1000 * 2; // Refresh 30 seconds before expiry (2 minutes)

                    if (refreshTime > 0) {
                        const timer = setTimeout(refreshAccessToken, refreshTime);
                        return () => clearTimeout(timer); // Clear on unmount
                    }
                }
            };

            scheduleTokenRefresh();
        }, [accessToken]);

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
                    return true;
                } else {
                    throw new Error("Invalid credentials");
                }
            } catch (error) {
                console.error("Login error:", error);
                return false;
            }
        };

        const logout = async () => {
            console.log("Logout function called");
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
        };

        const refreshAccessToken = async () => {
            try {
                const response = await fetch("http://localhost:8000/api/token/refresh/", {
                    method: "POST",
                    credentials: "include",
                });
                if (response.ok) {
                    const data = await response.json();
                    localStorage.setItem("accessToken", data.access);
                    setAccessToken(data.access);
                    console.log("Token refreshed successfully");
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
        };

        return (
            <AuthContext.Provider value={{accessToken, refreshAccessToken, login, logout}}>
                {children}
            </AuthContext.Provider>
        );
    }
;

export const useAuth = () => useContext(AuthContext);
