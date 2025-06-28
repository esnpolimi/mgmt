export const extractErrorMessage = (data, status) => {
    if (!data) return `Server error (${status}) with empty response`;
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;
    if (data.message) return data.message;
    if (data.non_field_errors) return data.non_field_errors.join(', ');
    if (data.lists?.non_field_errors) return `Error in lists format: ${data.lists.non_field_errors.join(', ')}`;
    for (const [_, errors] of Object.entries(data)) {
        if (errors) return Array.isArray(errors) ? errors.join(', ') : errors.toString();
    }
    return JSON.stringify(data);
};