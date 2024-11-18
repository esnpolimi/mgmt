export const fetchWithAuth = async (method, url, body = null, options = {}) => {
    const accessToken = localStorage.getItem("accessToken");

    if (!accessToken) {
        throw new Error("No access token available");
    }

    // Set default headers
    const headers = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json", // Default content type for JSON requests
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
        fetchOptions.body = JSON.stringify(body);
    }

    // Execute the request
    const response = await fetch(url, fetchOptions);

    if (response.status === 401) {
        throw new Error("Unauthorized: Access token may have expired");
    }

    return response;
};

