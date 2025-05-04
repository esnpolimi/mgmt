import React, {useEffect, useState, useMemo} from 'react';
import {MRT_Table, useMaterialReactTable} from 'material-react-table';
import {accountDisplayNames as names} from '../../utils/displayAttributes';
import {fetchCustom} from '../../api/api';
import {MRT_Localization_IT} from 'material-react-table/locales/it';
import Loader from '../Loader';
import {Box, Chip} from "@mui/material";

export default function AccountsDash({limit = 5}) {
    const [data, setData] = useState([]);
    const [isLoading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetchCustom("GET", '/accounts_full/');
                if (response.ok) {
                    const json = await response.json();
                    setData(json.results);
                }
            } catch (e) {
                // Optionally handle error
            } finally {
                setLoading(false);
            }
        };
        fetchData().then();
    }, []);

    const columns = useMemo(() => [
        {accessorKey: 'name', header: names.name, size: 100},
        {accessorKey: 'balance', header: names.balance, size: 100},
        {
            accessorKey: 'status', header: names.status, size: 100,
            Cell: ({cell}) => (
                <Box sx={{}}>
                    {cell.getValue() !== null ? (
                        <Chip
                            label={cell.getValue() === 'open' ? "Aperta" : "Chiusa"}
                            color={cell.getValue() === 'open' ? "success" : "error"}/>
                    ) : (
                        <Chip label="Stato ignoto" color="warning"/>
                    )}
                </Box>
            ),
        },
    ], []);

    const table = useMaterialReactTable({
        columns,
        data: data.slice(0, limit),
        enableKeyboardShortcuts: false,
        enableColumnActions: false,
        enableColumnFilters: false,
        enablePagination: false,
        enableSorting: false,
        initialState: {showColumnFilters: false, showGlobalFilter: false},
        paginationDisplayMode: 'default',
        muiTableBodyRowProps: {hover: false},
        localization: MRT_Localization_IT,
    });

    return isLoading ? <Loader/> : <MRT_Table table={table}/>;
}