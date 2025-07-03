import {Box} from '@mui/material';
import logo from '../assets/spinLogo.png';

const rotateStyle = {
    animation: 'spin 2s linear infinite'
};

export default function Loader({size = 40, fullScreen = false}) {
    return (
        <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: fullScreen ? '100vh' : '100%',
            width: '100%',
            position: fullScreen ? 'fixed' : 'relative',
            top: 0,
            left: 0,
            zIndex: fullScreen ? 1300 : 1,
            backgroundColor: fullScreen ? 'rgba(255, 255, 255, 0.7)' : 'transparent'
        }}>
            <img src={logo}
                 alt="Loading..."
                 width={size}
                 height={size}
                 style={rotateStyle}/>
            <style>{`@keyframes spin {100% { transform: rotate(360deg); }}`}</style>
        </Box>
    );
}