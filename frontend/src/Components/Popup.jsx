import {useEffect} from 'react';
import ReactDOM from 'react-dom/client';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

// Maintain a global array of active popups for stacking
const activePopups = [];

const Popup = ({message, state, duration = 2000}) => {
    useEffect(() => {
        const popup = document.createElement('div');
        const copyButton = document.createElement('button');
        let root = null;

        // Prevent duplicate popups for the same message/state
        const duplicate = activePopups.find(p => p.message === message && p.state === state);
        if (duplicate) return;

        // Add to activePopups for stacking
        const popupObj = {popup, message, state};
        activePopups.push(popupObj);

        // Calculate vertical offset for stacking
        const index = activePopups.indexOf(popupObj);
        const verticalOffset = 20 + index * 60; // 60px per popup

        // Render the icon inside the button if we're in "error" state
        if (state === 'error') {
            copyButton.style.marginRight = '10px';
            copyButton.style.cursor = 'pointer';
            copyButton.style.border = 'none';
            copyButton.style.color = 'white';
            copyButton.style.backgroundColor = 'transparent';
            root = ReactDOM.createRoot(copyButton);
            root.render(<ContentCopyIcon/>);
            const textSpan = document.createElement('span');
            textSpan.innerText = message;
            popup.appendChild(copyButton);
            popup.appendChild(textSpan);
        } else {
            popup.innerText = message;
        }

        popup.style.display = 'flex';
        popup.style.alignItems = 'center';
        popup.style.position = 'fixed';
        popup.style.top = `-${verticalOffset + 100}px`; // Start off-screen
        popup.style.left = '50%';
        popup.style.transform = 'translateX(-50%)';
        popup.style.backgroundColor = state === 'success' ? 'green' : 'red';
        popup.style.color = 'white';
        popup.style.padding = '10px';
        popup.style.borderRadius = '5px';
        popup.style.cursor = 'pointer';
        popup.style.zIndex = '9999'; // Ensure the popup is in front of any layer/modal
        popup.style.transition = 'opacity 0.5s ease-in-out, top 0.5s ease-in-out';
        popup.setAttribute('role', 'alert');
        document.body.appendChild(popup);

        const copyToClipboard = () => {
            navigator.clipboard.writeText(message).then();
        };

        if (state === 'error') {
            copyButton.addEventListener('click', copyToClipboard);
        }

        let timer;
        requestAnimationFrame(() => {
            popup.style.top = `${verticalOffset}px`;
        });

        // --- CLEANUP FUNCTION ---
        const cleanup = () => {
            clearTimeout(timer);
            popup.removeEventListener('mouseenter', handleMouseEnter);
            popup.removeEventListener('mouseleave', handleMouseLeave);
            if (state === 'error') {
                copyButton.removeEventListener('click', copyToClipboard);
                if (root) root.unmount();
            }
            if (document.body.contains(popup)) document.body.removeChild(popup);
            const idx = activePopups.indexOf(popupObj);
            if (idx !== -1) activePopups.splice(idx, 1);
            // Update positions of remaining popups
            activePopups.forEach((p, i) => {
                p.popup.style.top = `${20 + i * 60}px`;
            });
        };

        const animateOut = () => {
            popup.style.top = `-${verticalOffset + 100}px`;
            setTimeout(cleanup, 500);
        };

        const handleMouseEnter = () => {
            clearTimeout(timer);
        };

        const handleMouseLeave = () => {
            timer = setTimeout(animateOut, duration);
        };

        popup.addEventListener('mouseenter', handleMouseEnter);
        popup.addEventListener('mouseleave', handleMouseLeave);

        handleMouseLeave();

        // Cleanup on unmount
        return cleanup;
    }, [message, state, duration]);
    return null;
};

export default Popup;