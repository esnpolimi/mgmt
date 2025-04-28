import React from "react";
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

export default function ConfirmDialog({open, message, onConfirm, onClose}) {
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>Conferma Azione</DialogTitle>
            <DialogContent>
                <Typography>{message}</Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="secondary">Annulla</Button>
                <Button onClick={onConfirm} color="primary" autoFocus>Conferma</Button>
            </DialogActions>
        </Dialog>
    );
}