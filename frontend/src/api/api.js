export const fetchCustom = async (method, path, body = null, options = {}, auth = true) => {
    const accessToken = localStorage.getItem("accessToken");
    const API_HOST = import.meta.env.VITE_API_HOST;
    const url = `${API_HOST}${path}`;
    //console.log('Url', url);

    if (auth && !accessToken) {
        throw new Error("No access token available");
    }

    // Set default headers
    const headers = {
        "Content-Type": "application/json", // Default content type for JSON requests
        ...(auth && {Authorization: `Bearer ${accessToken}`}), // Include Authorization header only when auth is true
        ...options.headers, // Merge with additional headers if provided
    };

    // Configure fetch options
    const fetchOptions = {
        method,
        headers,
        credentials: "include", // Include cookies if required
        ...options,
    };

    // Add body for POST, PUT, or PATCH methods
    if (body) {
        fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    // Execute the request
    const response = await fetch(url, fetchOptions);

    if (response.status === 401) {
        throw new Error("Unauthorized: Access token may have expired");
    }

    return response;
};