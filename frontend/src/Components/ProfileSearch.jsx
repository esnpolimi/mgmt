import {useState, useEffect} from 'react';
import {Grid, Typography, Autocomplete, TextField} from '@mui/material';
import {fetchCustom} from '../api/api';

export default function ProfileSearch({
                                          value,
                                          onChange,
                                          error,
                                          helperText,
                                          label = "Cerca profilo",
                                          required = false,
                                          disabled = false,
                                          valid_only = true,
                                          esner_only = false
                                      }) {
    const [profiles, setProfiles] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);

    useEffect(() => {
        if (searchQuery.length < 3) {
            setProfiles([]);
            return;
        }
        setSearchLoading(true);
        const timer = setTimeout(() => {
            fetchCustom('GET', `/profiles/search/?q=${encodeURIComponent(searchQuery)}&valid_only=${valid_only}&esner_only=${esner_only}`, {
                onSuccess: (data) => setProfiles(data.results || []),
                onError: () => setProfiles([]),
                onFinally: () => setSearchLoading(false)
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const renderOption = (props, option) => {
        const {key, ...otherProps} = props;
        const hasEsncard = option.latest_esncard && option.latest_esncard.number;
        const esnCardExpired = hasEsncard && !option.latest_esncard.is_valid;

        return (
            <li key={key} {...otherProps}>
                <Grid container spacing={1} sx={{width: '100%'}}>
                    <Grid size={{xs: 4}}>
                        <Typography>{option.name} {option.surname}</Typography>
                    </Grid>
                    <Grid size={{xs: 4}}>
                        <Typography
                            component="span"
                            sx={{color: hasEsncard ? (esnCardExpired ? 'error.main' : 'text.primary') : 'error.main'}}>
                            {hasEsncard
                                ? (esnCardExpired ? `${option.latest_esncard.number} (Scaduta)` : option.latest_esncard.number)
                                : 'No ESNcard'}
                        </Typography>
                    </Grid>
                    <Grid size={{xs: 4}}>
                        <Typography
                            component="span"
                            sx={{
                                color: option.is_esner ? 'primary.main' : 'success.main',
                                fontWeight: 'bold',
                                textAlign: 'right',
                                display: 'block'
                            }}>
                            {option.is_esner ? 'ESNer' : 'Erasmus'}
                        </Typography>
                    </Grid>
                </Grid>
            </li>
        );
    };

    return (
        <Autocomplete
            options={profiles}
            loading={searchLoading}
            getOptionLabel={option => `${option.name}${option.surname ? ` ${option.surname}` : ''}${option.latest_esncard ? ` (${option.latest_esncard.number})` : ''}`}
            renderOption={renderOption}
            value={value}
            onChange={onChange}
            onInputChange={(event, newInputValue) => setSearchQuery(newInputValue)}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    required={required}
                    error={error}
                    helperText={helperText}
                />
            )}
            noOptionsText="Nessun profilo trovato"
            loadingText="Caricamento..."
            disabled={disabled}
        />
    );
}