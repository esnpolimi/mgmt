import { useState, useEffect, useRef } from 'react';

/**
 * Opens a single SSE connection to the backend maintenance stream.
 * Returns the notification object { message, triggered_at } when a
 * 'maintenance' event is received, or null while idle.
 *
 * The connection is established as soon as the hook mounts and is
 * automatically closed on unmount. No periodic polling from the client.
 */
const useMaintenanceNotification = () => {
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        const apiHost = window.API_HOST || '';
        const url = `${apiHost}/maintenance/stream/`;

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
    }, []);  // runs once on mount

    const dismiss = () => setNotification(null);

    return { notification, dismiss };
};

export default useMaintenanceNotification;
