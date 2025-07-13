import {useEffect, useRef, useState} from 'react';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

const popupStyle = {
    display: 'flex',
    alignItems: 'center',
    position: 'fixed',
    right: '20px',
    top: '20px',
    backgroundColor: '#f44336',
    color: 'white',
    padding: '12px 15px',
    borderRadius: '6px',
    cursor: 'pointer',
    zIndex: 10000,
    transition: 'opacity 2s ease-out',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    minWidth: '250px',
    maxWidth: '350px',
    fontWeight: 500,
    fontSize: '14px',
    opacity: 0,
};

const successColor = '#4caf50';

const Popup = ({message, state, duration = 4000}) => {
    const [visible, setVisible] = useState(false);
    const timerRef = useRef();
    const remainingRef = useRef(duration);
    const startTimeRef = useRef();

    useEffect(() => {
        if (!message) return;
        setVisible(true);
        startTimeRef.current = Date.now();
        timerRef.current = setTimeout(() => setVisible(false), duration);
        remainingRef.current = duration;
        return () => clearTimeout(timerRef.current);
    }, [message, state, duration]);

    const handleMouseEnter = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
            // Calculate remaining time
            const elapsed = Date.now() - startTimeRef.current;
            remainingRef.current = Math.max(duration - elapsed, 0);
        }
    };

    const handleMouseLeave = () => {
        if (!visible || timerRef.current) return;
        startTimeRef.current = Date.now();
        timerRef.current = setTimeout(() => setVisible(false), remainingRef.current);
    };

    if (!message) return null;

    return (
        <div
            style={{
                ...popupStyle,
                backgroundColor: state === 'success' ? successColor : popupStyle.backgroundColor,
                opacity: visible ? 1 : 0,
            }}
            role="alert"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}>
            {state === 'error' && (
                <button style={{
                    marginRight: '10px',
                    cursor: 'pointer',
                    border: 'none',
                    color: 'white',
                    backgroundColor: 'transparent',
                    padding: 0,
                }}
                        onClick={() => navigator.clipboard.writeText(message)}
                        aria-label="Copy error">
                    <ContentCopyIcon/>
                </button>
            )}
            <span>{message}</span>
        </div>
    );
};


export default Popup;