import {useState, useEffect} from 'react';
import {Modal, Box, TextField, Button, Typography, Grid, IconButton, Select, MenuItem, InputLabel, FormControl, Chip, OutlinedInput, FormHelperText} from '@mui/material';
import {styleESNcardModal as style} from '../../utils/sharedStyles';
import Loader from '../Loader';
import {fetchCustom} from '../../api/api';
import {extractErrorMessage} from '../../utils/errorHandling';
import CloseIcon from '@mui/icons-material/Close';
import Popup from "../Popup";
import {accountDisplayNames as names} from "../../utils/displayAttributes";
import * as Sentry from "@sentry/react";

export default function AccountModal({open, onClose, account = null}) {
    const isEdit = account !== null;
    const [isLoading, setLoading] = useState(true);
    const [popup, setPopup] = useState(null);
    const [data, setData] = useState({name: '', visible_to_groups: []});
    const [errors, setErrors] = useState({name: [false, ''], visible_to_groups: [false, '']});
    const [groups, setGroups] = useState([]);

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const response = await fetchCustom('GET', '/groups/');
                const json = await response.json();
                if (response.ok) {
                    setGroups(json);
                } else {
                    const errorMessage = await extractErrorMessage(json, response.status);
                    setPopup({message: `Errore nel recupero dei gruppi: ${errorMessage}`, state: 'error'});
                }
            } catch (e) {
                Sentry.captureException(e);
                setPopup({message: `Errore nel recupero dei gruppi: ${e}`, state: 'error'});
            }
        };
        fetchGroups().then();
    }, []);

    useEffect(() => {
        if (isEdit && account)
            setData({name: account.name || '', visible_to_groups: account.visible_to_groups?.map(g => g.id) || []});
        else
            setData({name: '', visible_to_groups: []});
        setLoading(false);
    }, [isEdit, account]);

    const handleInputChange = (event) => {
        const {name, value} = event.target;
        setData({...data, [name]: value});
    };

    const handleGroupsChange = (event) => {
        setData({...data, visible_to_groups: event.target.value});
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const newErrors = {...errors};

        if (!data.name.trim()) newErrors.name = [true, 'Il nome è obbligatorio'];
        else newErrors.name = [false, ''];

        if (data.visible_to_groups.length === 0) newErrors.visible_to_groups = [true, 'Seleziona almeno un gruppo'];
        else newErrors.visible_to_groups = [false, ''];

        setErrors(newErrors);
        if (newErrors.name[0] || newErrors.visible_to_groups[0]) return;


        setLoading(true);
        try {
            const payload = {name: data.name, visible_to_groups: data.visible_to_groups};
            let response;
            if (isEdit && account) response = await fetchCustom('PATCH', `/account/${account.id}/`, payload);
            else response = await fetchCustom('POST', '/account/', payload);
            if (!response.ok) {
                const json = await response.json();
                const errorMessage = await extractErrorMessage(json, response.status);
                setPopup({message: `Errore ${isEdit ? 'modifica' : 'creazione'} cassa: ${errorMessage}`, state: 'error'});
            } else {
                onClose(true);
            }
        } catch (error) {
            Sentry.captureException(error);
            setPopup({message: `Errore generale: ${error}`, state: 'error'});
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        onClose(false);
    };

    return (
        <Modal open={open} onClose={handleClose}>
            <Box sx={style} component="form" onSubmit={handleSubmit} noValidate>
                {isLoading ? <Loader/> : (<>
                    <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: -2}}>
                        <IconButton onClick={handleClose} sx={{minWidth: 0}}><CloseIcon/></IconButton>
                    </Box>
                    <Typography variant="h5" gutterBottom align="center" sx={{mb: 2}}>
                        {isEdit ? `Modifica Cassa - ${account?.name}` : 'Crea Cassa'}
                    </Typography>
                    {popup && <Popup message={popup.message} state={popup.state}/>}

                    <Grid container spacing={2}>
                        <Grid size={{xs: 12}}>
                            <TextField
                                fullWidth
                                label={names.name}
                                name="name"
                                value={data.name}
                                onChange={handleInputChange}
                                required
                                error={errors.name[0]}
                                helperText={errors.name[0] ? errors.name[1] : ''}/>
                        </Grid>
                        <Grid size={{xs: 12}}>
                            <FormControl fullWidth error={errors.visible_to_groups[0]}>
                                <InputLabel id="groups-label">{names.visible_to_groups}</InputLabel>
                                <Select
                                    variant="outlined"
                                    labelId="groups-label"
                                    multiple
                                    value={data.visible_to_groups}
                                    onChange={handleGroupsChange}
                                    input={<OutlinedInput label={names.visible_to_groups}/>}
                                    renderValue={(selected) => (
                                        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
                                            {selected.map((id) => {
                                                const group = groups.find(g => g.id === id);
                                                return <Chip key={id} label={group ? group.name : id}/>;
                                            })}
                                        </Box>
                                    )}>
                                    {groups.map((group) => (
                                        <MenuItem key={group.id} value={group.id}>
                                            {group.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                                {errors.visible_to_groups[0] && (
                                    <FormHelperText>{errors.visible_to_groups[1]}</FormHelperText>
                                )}
                            </FormControl>
                        </Grid>
                    </Grid>
                    <Box mt={2}>
                        <Button fullWidth variant="contained" color="primary" type="submit">
                            {isEdit ? 'Salva Modifiche' : 'Crea'}
                        </Button>
                    </Box>
                </>)}
            </Box>
        </Modal>
    );
}