import { useState, useEffect } from 'react';

/**
 * Opens a single SSE connection to the backend maintenance stream.
 * Returns the notification object { message, triggered_at } when a
 * 'maintenance' event is received, or null while idle.
 *
 * @param {string|null} accessToken - Current JWT access token from AuthContext.
 *   The token is passed as a query parameter because native EventSource cannot
 *   send Authorization headers.  Pass null / undefined when the user is not
 *   logged in; no connection will be opened in that case.
 *   The effect reruns whenever the token changes (e.g. after a token rotation)
 *   so the EventSource is always opened with a fresh credential.
 */
const useMaintenanceNotification = (accessToken) => {
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        if (!accessToken) {
            // Not logged in – skip opening the connection entirely.
            setNotification(null);
            return;
        }

        const apiHost = window.API_HOST || '';
        // Native EventSource cannot send an Authorization header, so the JWT
        // access token is passed as a query parameter instead.  The backend
        // validates it server-side with simplejwt before opening the stream.
        // The effect declares `accessToken` as a dependency so the connection
        // is automatically recreated after every token rotation.
        const url = `${apiHost}/maintenance/stream/?token=${encodeURIComponent(accessToken)}`;

        const es = new EventSource(url);

        es.addEventListener('maintenance', (event) => {
            try {
                const data = JSON.parse(event.data);
                setNotification(data);
            } catch (e) {
                console.error('[MaintenanceSSE] Failed to parse event data', e);
            }
        });

        es.onerror = () => {
            if (es.readyState === EventSource.CLOSED) {
                console.warn('[MaintenanceSSE] Connection closed permanently.');
                return;
            }
            // Transient errors (e.g. server restart): browser will retry automatically.
            console.warn('[MaintenanceSSE] Connection error – browser will retry automatically.');
        };
        return () => {
            es.close();
        };
    }, [accessToken]);  // rerun whenever the token rotates

    const dismiss = () => setNotification(null);

    return { notification, dismiss };
};

export default useMaintenanceNotification;
