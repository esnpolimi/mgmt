import {useEffect} from 'react';


const SuccessPopup = ({message, state, duration = 2000}) => {
    useEffect(() => {
        const popup = document.createElement('div');
        popup.innerText = message;
        popup.style.position = 'fixed';
        popup.style.top = '20px';
        popup.style.left = '50%';
        popup.style.transform = 'translateX(-50%)';
        popup.style.backgroundColor = state === 'success' ? 'green' : 'red';
        popup.style.color = 'white';
        popup.style.padding = '10px';
        popup.style.borderRadius = '5px';
        popup.style.zIndex = '9999'; // Ensure the popup is in front of any layer/modal
        popup.style.opacity = '1';
        popup.style.transition = 'opacity 0.5s ease-in-out';
        popup.style.userSelect = 'text'; // Make text selectable
        document.body.appendChild(popup);

        let timer;
        const handleMouseEnter = () => {
            clearTimeout(timer);
            popup.style.opacity = '1';
        };
        const handleMouseLeave = () => {
            timer = setTimeout(() => {
                popup.style.opacity = '0';
                setTimeout(() => {
                    document.body.removeChild(popup);
                }, 500); // Match the transition duration
            }, duration);
        };

        popup.addEventListener('mouseenter', handleMouseEnter);
        popup.addEventListener('mouseleave', handleMouseLeave);

        handleMouseLeave();

        return () => {
            clearTimeout(timer);
            popup.removeEventListener('mouseenter', handleMouseEnter);
            popup.removeEventListener('mouseleave', handleMouseLeave);
            document.body.removeChild(popup);
        };
    }, [message, state, duration]);

    return null;
};

export default SuccessPopup;