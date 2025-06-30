import {useState} from 'react';
import {CircularProgress, IconButton, Box} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import * as Sentry from "@sentry/react";

const EditButton = ({onEdit, onCancel, onSave, saving}) => {
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const handleEditClick = () => {
        setIsEditing(true);
        if (onEdit) onEdit();
    };

    const handleCancelClick = () => {
        if (!saving) {
            setIsEditing(false);
            if (onCancel) onCancel();
        }
    };

    const handleSaveClick = async () => {
        setLoading(true);
        try {
            if (onSave) {
                const result = await onSave();
                if (result !== false) setIsEditing(false);
            } else setIsEditing(false);
        } catch (error) {
            Sentry.captureException(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            {isEditing ? (
                <Box sx={{display: 'inline-flex'}}>
                    <IconButton onClick={handleCancelClick} aria-label="Cancel" disabled={saving || loading}>
                        <CancelIcon/>
                    </IconButton>
                    {saving || loading ? (
                        <IconButton disabled>
                            <CircularProgress size='1rem'/>
                        </IconButton>
                    ) : (
                        <IconButton onClick={handleSaveClick} aria-label="Save" sx={{color: '#0288d1'}}>
                            <SaveIcon/>
                        </IconButton>
                    )}
                </Box>
            ) : (
                <IconButton onClick={handleEditClick} aria-label="Edit">
                    <EditIcon/>
                </IconButton>
            )}
        </div>
    );
};

export default EditButton;
