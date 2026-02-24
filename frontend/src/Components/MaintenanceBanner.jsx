import { Box, Typography, IconButton, Button, Paper } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

/**
 * Centered, non-blocking maintenance warning banner.
 *
 * Props:
 *   message  {string}   – notification text
 *   onClose  {function} – called when the user dismisses the banner
 */
const MaintenanceBanner = ({ message, onClose }) => {
    return (
        /*
         * Overlay: covers the screen with a semi-transparent backdrop so
         * the banner stands out, but pointer-events on the backdrop are
         * disabled so the user can still interact with the app behind it.
         */
        <Box
            sx={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                pointerEvents: 'none',   // backdrop non-blocking
            }}
        >
            <Paper
                elevation={8}
                sx={{
                    pointerEvents: 'auto',  // banner itself is interactive
                    position: 'relative',
                    maxWidth: 520,
                    width: '90%',
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: '2px solid #e65100',
                }}
            >
                {/* Coloured header bar */}
                <Box
                    sx={{
                        bgcolor: '#ff6d00',
                        px: 3,
                        py: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WarningAmberRoundedIcon sx={{ color: '#fff', fontSize: 26 }} />
                        <Typography
                            variant="subtitle1"
                            sx={{ color: '#fff', fontWeight: 700, letterSpacing: 0.5 }}
                        >
                            System Maintenance Warning
                        </Typography>
                    </Box>

                </Box>

                {/* Body */}
                <Box sx={{ bgcolor: '#fff8f0', px: 3, py: 2.5 }}>
                    <Typography
                        variant="body1"
                        sx={{ color: '#4e2000', fontSize: '1.05rem', lineHeight: 1.6 }}
                    >
                        {message}
                    </Typography>
                </Box>

                {/* Footer with second dismiss button */}
                <Box
                    sx={{
                        bgcolor: '#fff8f0',
                        px: 3,
                        pb: 2,
                        display: 'flex',
                        justifyContent: 'flex-end',
                    }}
                >
                    {/* Second X / close – explicit dismiss button */}
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<CloseIcon />}
                        onClick={onClose}
                        sx={{
                            bgcolor: '#e65100',
                            color: '#fff',
                            fontWeight: 600,
                            textTransform: 'none',
                            '&:hover': { bgcolor: '#bf360c' },
                        }}
                    >
                        I understand, close this message
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
};

export default MaintenanceBanner;
