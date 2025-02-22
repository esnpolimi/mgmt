import React, {useEffect, useState, useMemo} from 'react';
import {Box, Typography, IconButton} from '@mui/material';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import EditIcon from '@mui/icons-material/Edit';
import {fetchCustom} from '../api/api';
import Sidebar from './Sidebar.jsx';
import ProfileModal from './ProfileModal.jsx';
import {MRT_Localization_IT} from "material-react-table/locales/it";

export default function ProfileList({apiEndpoint, columns, columnVisibility, icon: Icon, title}) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, toggleModal] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetchCustom('GET', apiEndpoint);
                const json = await response.json();
                if (apiEndpoint === '/user_profiles/') {
                    const formattedData = json.results.map(({profile, ...rest}) => ({
                        ...rest,
                        ...profile,
                        id: profile.id,
                    }));
                    setData(formattedData);
                }
                else setData(json.results);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching data:', error);
                setLoading(false);
            }
        };

        fetchData().then();
    }, [apiEndpoint]);

    const table = useMaterialReactTable({
        columns,
        data,
        enableStickyHeader: true,
        enableStickyFooter: true,
        enableColumnFilterModes: true,
        enableColumnOrdering: true,
        enableGrouping: true,
        enableColumnPinning: true,
        enableFacetedValues: true,
        enableRowActions: true,
        enableRowSelection: false,
        enableRowPinning: true,
        enableExpandAll: false,
        initialState: {
            showColumnFilters: false,
            showGlobalFilter: true,
            columnPinning: {
                left: ['mrt-row-expand', 'mrt-row-select'],
                right: ['mrt-row-actions'],
            },
            columnVisibility
        },
        paginationDisplayMode: 'pages',
        positionToolbarAlertBanner: 'bottom',
        muiSearchTextFieldProps: {
            size: 'small',
            variant: 'outlined',
        },
        muiPaginationProps: {
            color: 'secondary',
            rowsPerPageOptions: [10, 20, 30],
            shape: 'rounded',
            variant: 'outlined',
        },
        localization: MRT_Localization_IT,

        renderRowActions: ({row}) => {
            return (
                <IconButton variant='contained' onClick={() => {
                    setSelectedProfile(row.original);
                    toggleModal(true);
                }}>
                    <EditIcon/>
                </IconButton>
            )
        },
    });

    const updateProfile = (newData) => {
        setData((prevProfiles) =>
            prevProfiles.map((profile) =>
                profile.id === newData.id ? newData : profile
            )
        );
    };

    const handleProfileClose = () => {
        toggleModal(false);
    };

    return (
        <Box>
            <Sidebar/>
            <Box sx={{mx: '5%'}}>
                <Box sx={{display: 'flex', alignItems: 'center', marginBottom: '20px'}}>
                    {Icon && <Icon sx={{marginRight: '10px'}}/>}
                    <Typography variant="h4">Profili {title}</Typography>
                </Box>
                <MaterialReactTable table={table}/>
            </Box>
            {modalOpen && (
                <ProfileModal
                    profile={selectedProfile}
                    profileType={title}
                    open={modalOpen}
                    handleClose={handleProfileClose}
                    updateProfile={updateProfile}
                />
            )}
        </Box>
    );
}