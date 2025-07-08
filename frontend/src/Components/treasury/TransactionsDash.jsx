import {useEffect, useState, useMemo} from 'react';
import {MRT_Table, useMaterialReactTable} from 'material-react-table';
import {transactionDisplayNames as names} from '../../utils/displayAttributes';
import {fetchCustom} from '../../api/api';
import {MRT_Localization_IT} from 'material-react-table/locales/it';
import Loader from '../Loader';
import {Box, Chip} from "@mui/material";
import * as Sentry from "@sentry/react";
import {TRANSACTION_CONFIGS} from "../../data/transactionConfigs";

export default function TransactionsDash({limit = 3}) {
    const [data, setData] = useState([]);
    const [isLoading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetchCustom("GET", `/transactions/?limit=${limit}`);
                if (response.ok) {
                    const json = await response.json();
                    setData(json.results);
                    console.log("Transactions data:", json.results);
                }
            } catch (e) {
                Sentry.captureException(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData().then();
    }, [limit]);

    const columns = useMemo(() => [
        {
            accessorKey: 'created_at', header: names.date, size: 100,
            Cell: ({cell}) => {
                const date = new Date(cell.getValue());
                return (
                    <Box>
                        {new Intl.DateTimeFormat('it-IT', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                        }).format(date)}
                    </Box>
                );
            },
        },
        {
            accessorKey: 'type', header: names.type, size: 100,
            Cell: ({cell}) => {
                const type = cell.getValue();
                const config = TRANSACTION_CONFIGS[type] || {label: 'Sconosciuto', color: 'default'};
                return (
                    <Chip
                        label={config.label}
                        color={config.color}
                        variant="outlined"
                    />
                );
            }
        },
        {accessorKey: 'executor.name', header: names.executor, size: 150},
        {
            accessorKey: 'account.name',
            header: names.account,
            size: 100,
            Cell: ({cell}) => (
                <Box component="span" fontWeight="bold">
                    {cell.getValue()}
                </Box>
            ),
        },
        {
            accessorKey: 'amount', header: names.amount, size: 100,
            Cell: ({cell}) => (
                <Box>
                    {cell.getValue() !== null ? (
                        <Chip label={`€${cell.getValue()}`} color="primary"/>) : (
                        <Chip label="N/A" color="warning"/>)}
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
        enableSorting: true,
        initialState: {
            showColumnFilters: false,
            showGlobalFilter: false,
            sorting: [{id: 'created_at', desc: true}],
        },
        paginationDisplayMode: 'default',
        muiTableBodyRowProps: {hover: false},
        localization: MRT_Localization_IT,
    });

    return isLoading ? <Loader/> : <MRT_Table table={table}/>;
}
