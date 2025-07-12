export const defaultErrorHandler = (responseOrError, setPopup) => {
    const extractErrorMessage = (data, status) => {
        if (!data) return `Server error (${status}) with empty response`;
        if (typeof data === 'string') return data;
        if (data.detail) return data.detail;
        if (data.message) return data.message;
        if (data.non_field_errors) return data.non_field_errors.join(', ');
        if (data.lists?.non_field_errors) return `Error in lists format: ${data.lists.non_field_errors.join(', ')}`;
        for (const [, errors] of Object.entries(data)) {
            if (errors) return Array.isArray(errors) ? errors.join(', ') : errors.toString();
        }
        return JSON.stringify(data);
    };

    let errorMessage;
    const popupData = {message: '', state: 'error'};

    if (responseOrError?.json) {
        responseOrError.json().then(json => {
            errorMessage = extractErrorMessage(json, responseOrError.status);
            popupData.message = `Errore: ${errorMessage}`;
            if (typeof setPopup === 'function') {
                setPopup(popupData);
            }
        });
    } else {
        errorMessage = responseOrError?.message || responseOrError?.toString();
        popupData.message = `Errore: ${errorMessage}`;

        // Simplified - just set the popup directly
        if (typeof setPopup === 'function') {
            setPopup(popupData);
        }
    }
    return Promise.resolve();
};

export const fetchCustom = (method, path, options = {}) => {
    const {
        body = null,
        headers = {},
        auth = true,
        parseJson = false,
        isFormData = false,
        onSuccess,
        onError,
        onFinally
    } = options;

    const accessToken = localStorage.getItem("accessToken");
    const API_HOST = import.meta.env.VITE_API_HOST;
    const url = `${API_HOST}${path}`;

    if (auth && !accessToken) {
        const error = new Error("No access token available");
        if (onError) onError(error);
        if (onFinally) onFinally();
        return Promise.resolve();
    }

    let mergedHeaders = {
        ...(auth && {Authorization: `Bearer ${accessToken}`}),
        ...headers,
    };

    if (!isFormData && body && !(body instanceof FormData)) mergedHeaders["Content-Type"] = "application/json";

    const fetchOptions = {
        method,
        headers: mergedHeaders,
        credentials: "include",
    };

    if (body) fetchOptions.body = isFormData || body instanceof FormData ? body : (typeof body === "string" ? body : JSON.stringify(body));

    return fetch(url, fetchOptions)
        .then(response => {
            if (response.status === 401) {
                const error = new Error("Non autorizzato.");
                if (onError) onError(error, response);
                return;
            }
            if (response.ok) {
                if (parseJson && response.headers.get('content-type')?.includes('application/json')) {
                    return response.json().then(jsonData => {
                        const data = (jsonData && jsonData.results !== undefined) ? jsonData.results : jsonData;
                        if (onSuccess) onSuccess(data, response);
                    });
                } else if (onSuccess) {
                    onSuccess(response);
                }
            } else if (onError) onError(response);
        })
        .catch(error => {
            if (onError) onError(error);
        })
        .finally(() => {
            if (onFinally) onFinally();
        });
};