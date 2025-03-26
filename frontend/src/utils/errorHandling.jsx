export const extractErrorMessage = async (error) => {
    // Handle JavaScript errors (like network failures)
    if (error instanceof Error) {
        return error.message || 'Unknown error occurred';
    }

    // Handle HTTP response objects
    if (error && 'ok' in error && !error.ok) {
        try {
            const text = await error.text();
            if (!text) return `Errore server (${error.status}) con risposta vuota`;

            try {
                const data = JSON.parse(text);

                // Handle different error formats
                if (typeof data === 'string') return data;
                if (data.detail) return data.detail;
                if (data.message) return data.message;
                if (data.non_field_errors) return data.non_field_errors.join(', ');
                if (data.lists?.non_field_errors) return `Errore formato Liste: ${data.lists.non_field_errors.join(', ')}`;

                // Extract first error message from any field
                for (const [_, errors] of Object.entries(data)) {
                    if (errors) return Array.isArray(errors) ? errors.join(', ') : errors.toString();
                }

                return JSON.stringify(data);
            } catch (e) {
                return text; // Return raw text if JSON parsing fails
            }
        } catch (e) {
            return `Errore server (${error.status})`;
        }
    }

    // Default fallback
    return 'Errore server sconosciuto';
};