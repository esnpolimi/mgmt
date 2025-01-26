import {useEffect} from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const SuccessPopup = ({message, state, duration = 2000}) => {
    useEffect(() => {
        const popup = document.createElement('div');
        const copyIcon = document.createElement('span');

        popup.innerText = message;
        copyIcon.innerHTML = state === 'error' ? ContentCopyIcon().props.children : null;
        copyIcon.style.marginLeft = '10px';
        popup.appendChild(copyIcon);

        popup.style.position = 'fixed';
        popup.style.top = '-100px'; // Start off-screen
        popup.style.left = '50%';
        popup.style.transform = 'translateX(-50%)';
        popup.style.backgroundColor = state === 'success' ? 'green' : 'red';
        popup.style.color = 'white';
        popup.style.padding = '10px';
        popup.style.borderRadius = '5px';
        popup.style.zIndex = '9999'; // Ensure the popup is in front of any layer/modal
        popup.style.transition = 'opacity 0.5s ease-in-out, top 0.5s ease-in-out';
        document.body.appendChild(popup);


        let timer;
        requestAnimationFrame(() => {
            popup.style.top = '20px';
        });

        const animateOut = () => {
            popup.style.top = '-100px';
            setTimeout(() => {
                popup.removeEventListener('mouseenter', handleMouseEnter);
                popup.removeEventListener('mouseleave', handleMouseLeave);
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

export default SuccessPopup;