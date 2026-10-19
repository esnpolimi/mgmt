import {Box, Button, Card, CardContent, Typography, useMediaQuery} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import {QRCodeSVG} from 'qrcode.react';

const WHATSAPP_GREEN = '#25D366';

/**
 * Invite to the event WhatsApp group shown on the subscription result page.
 * `url` is the stable access URL (resolves to the event's current group link), never the raw invite.
 */
export default function WhatsAppGroupCard({url}) {
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

    return (
        <Card variant="outlined" sx={{width: '100%', borderColor: WHATSAPP_GREEN, borderWidth: 2}}>
            <CardContent>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 3, flexDirection: isDesktop ? 'row' : 'column'}}>
                    <Box sx={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5}}>
                        <WhatsAppIcon sx={{fontSize: 40, color: WHATSAPP_GREEN}}/>
                        <Typography variant="h6">Join the event WhatsApp group</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Stay updated with last-minute info from the organizers.
                        </Typography>
                        <Button
                            variant="contained"
                            size="large"
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            startIcon={<WhatsAppIcon/>}
                            sx={{bgcolor: WHATSAPP_GREEN, '&:hover': {bgcolor: '#1ebe5b'}}}
                        >
                            Join the group
                        </Button>
                    </Box>
                    {isDesktop && (
                        <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1}}>
                            <Box sx={{p: 1, bgcolor: '#fff', borderRadius: 1}}>
                                <QRCodeSVG value={url} size={140}/>
                            </Box>
                            <Typography variant="caption" color="text.secondary">Scan with your phone</Typography>
                        </Box>
                    )}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 2}}>
                    We also sent this link to your email.
                </Typography>
            </CardContent>
        </Card>
    );
}
