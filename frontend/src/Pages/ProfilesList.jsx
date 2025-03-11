import React, {useEffect, useState} from 'react';
import {Box} from '@mui/material';
import {MaterialReactTable, useMaterialReactTable} from 'material-react-table';
import {fetchCustom} from '../api/api';
import ProfileModal from '../Components/ProfileModal.jsx';
import {MRT_Localization_IT} from "material-react-table/locales/it";
import Loader from "../Components/Loader";

export default function ProfilesList({apiEndpoint, columns, columnVisibility, profileType}) {
    const [data, setData] = useState([]);
    const [isLoading, setLoading] = useState(true);
    const [modalOpen, toggleModal] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetchCustom('GET', apiEndpoint);
                const json = await response.json();
                if (profileType === 'ESNer') {
                    const formattedData = json.results.map(({profile, ...rest}) => ({
                        ...rest,
                        ...profile,
                        id: profile.id,
                    }));
                    setData(formattedData);
                } else setData(json.results);
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
        enableRowActions: false,
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
        muiTableBodyRowProps: ({row}) => ({
            onClick: () => {
                setSelectedProfile(row.original);
                toggleModal(true);
            },
        }),
    });

    const updateProfile = (newData) => {
        console.log("New data: ", newData);
        setData((prevProfiles) => {
            return prevProfiles.map((profile) => {
                if (profile.id === newData.id) {
                    // For ESNers, maintain the structure with profile as nested object
                    if (profileType === 'ESNer') {
                        return {
                            ...profile,
                            ...newData,
                            profile: {...profile.profile, ...newData}
                        };
                    }
                    return newData;
                }
                return profile;
            });
        });
    };

    const handleProfileClose = () => {
        toggleModal(false);
    };

    return (
        <Box sx={{mx: '5%'}}>
            {isLoading ? <Loader/> : <MaterialReactTable table={table}/>}
            {modalOpen && <ProfileModal
                open={modalOpen}
                profile={selectedProfile}
                profileType={profileType}
                handleClose={handleProfileClose}
                updateProfile={updateProfile}
            />}
        </Box>
    );
}