import React, {useEffect} from 'react';
import ReactDOM from 'react-dom/client';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const Popup = ({message, state, duration = 2000}) => {

    useEffect(() => {
        const popup = document.createElement('div');
        const copyButton = document.createElement('button');

        // Render the icon inside the button if we're in "error" state
        if (state === 'error') {
            copyButton.style.marginRight = '10px';
            copyButton.style.cursor = 'pointer';
            copyButton.style.border = 'none';
            copyButton.style.color = 'white';
            copyButton.style.backgroundColor = 'transparent';
            const root = ReactDOM.createRoot(copyButton);
            root.render(<ContentCopyIcon/>);
            const textSpan = document.createElement('span');
            textSpan.innerText = message;
            popup.appendChild(copyButton);
            popup.appendChild(textSpan);
        }
        else popup.innerText = message;


        popup.style.display = 'flex';
        popup.style.alignItems = 'center';
        popup.style.position = 'fixed';
        popup.style.top = '-100px'; // Start off-screen
        popup.style.left = '50%';
        popup.style.transform = 'translateX(-50%)';
        popup.style.backgroundColor = state === 'success' ? 'green' : 'red';
        popup.style.color = 'white';
        popup.style.padding = '10px';
        popup.style.borderRadius = '5px';
        popup.style.cursor = 'pointer';
        popup.style.zIndex = '9999'; // Ensure the popup is in front of any layer/modal
        popup.style.transition = 'opacity 0.5s ease-in-out, top 0.5s ease-in-out';
        document.body.appendChild(popup);

        const copyToClipboard = () => {
            navigator.clipboard.writeText(message).then();
        };

        if (state === 'error') {
            copyButton.addEventListener('click', copyToClipboard);
        }

        let timer;
        requestAnimationFrame(() => {
            popup.style.top = '20px';
        });

        const animateOut = () => {
            popup.style.top = '-100px';
            setTimeout(() => {
                popup.removeEventListener('mouseenter', handleMouseEnter);
                popup.removeEventListener('mouseleave', handleMouseLeave);
                copyButton.removeEventListener('click', copyToClipboard);
                if (document.body.contains(popup)) document.body.removeChild(popup);
            }, duration / 4);
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
    }, [message, state, duration]);
    return null;
};

export default Popup;