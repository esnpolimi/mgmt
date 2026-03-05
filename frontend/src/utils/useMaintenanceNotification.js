import { useState, useEffect } from 'react';

/**
 * Polls the backend maintenance status endpoint.
 * Returns the notification object { message, triggered_at } when a
 * maintenance event is active, or null while idle.
 *
 * @param {string|null} accessToken - Current JWT access token from AuthContext.
 */
const useMaintenanceNotification = (accessToken) => {
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        if (!accessToken) {
            setNotification(null);
            return;
        }

        const apiHost = window.API_HOST || '';
        const url = `${apiHost}/maintenance/status/`;

        let lastNotificationId = null;

        const checkStatus = async () => {
            try {
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (!response.ok) {
                    console.warn(`[MaintenancePoll] Server returned ${response.status}`);
                    return;
                }

                const data = await response.json();
                
                if (data.notification_id && data.notification_id !== lastNotificationId) {
                    lastNotificationId = data.notification_id;
                    setNotification({
                        message: data.message,
                        triggered_at: data.triggered_at
                    });
                }
            } catch (e) {
                console.error('[MaintenancePoll] Failed to fetch maintenance status', e);
            }
        };

        // Check immediately
        checkStatus();

        // Then poll every 30 seconds
        const intervalId = setInterval(checkStatus, 30000);

        return () => {
            clearInterval(intervalId);
        };
    }, [accessToken]);

    const dismiss = () => setNotification(null);

    return { notification, dismiss };
};

export default useMaintenanceNotification;
