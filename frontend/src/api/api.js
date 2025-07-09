export const fetchCustom = async (method, path, body = null, options = {}, auth = true) => {
    const accessToken = localStorage.getItem("accessToken");
    const API_HOST = import.meta.env.VITE_API_HOST;
    const url = `${API_HOST}${path}`;
    // console.log('Url', url.toString());

    if (auth && !accessToken) {
        throw new Error("No access token available");
    }

    // Set default headers
    let headers = {
        ...(auth && {Authorization: `Bearer ${accessToken}`}),
        ...options.headers,
    };

    // If body is FormData, do not set Content-Type (browser will set it)
    const isFormData = body instanceof FormData;
    if (!isFormData) {
        headers["Content-Type"] = "application/json";
    }

    // Configure fetch options
    const fetchOptions = {
        method,
        headers,
        credentials: "include", // Include cookies if required
        ...options,
    };

    // Add body for POST, PUT, or PATCH methods
    if (body) {
        fetchOptions.body = isFormData ? body : (typeof body === "string" ? body : JSON.stringify(body));
    }

    // Execute the request
    const response = await fetch(url, fetchOptions);

    if (response.status === 401) {
        throw new Error("Non autorizzato.");
    }

    return response;
};