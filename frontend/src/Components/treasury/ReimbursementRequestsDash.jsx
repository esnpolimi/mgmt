import {useEffect, useState, useMemo} from 'react';
import {MRT_Table, useMaterialReactTable} from 'material-react-table';
import {fetchCustom} from '../../api/api';
import {MRT_Localization_IT} from 'material-react-table/locales/it';
import Loader from '../Loader';
import {Box, Chip} from "@mui/material";
import * as Sentry from "@sentry/react";

const PAYMENT_CONFIGS = {
    cash: {label: "Contanti", color: 'success'},
    paypal: {label: "PayPal", color: 'info'},
    bonifico: {label: "Bonifico", color: 'warning'}
};

export default function ReimbursementRequestsDash({limit = 3}) {
    const [data, setData] = useState([]);
    const [isLoading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetchCustom("GET", `/reimbursement_requests/?limit=${limit}`);
                if (response.ok) {
                    const json = await response.json();
                    setData(json.results);
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
            accessorKey: 'created_at', header: "Data", size: 100,
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
            accessorKey: 'user.name',
            header: "Richiedente",
            size: 150,
            Cell: ({cell}) => cell.getValue() || "-"
        },
        {
            accessorKey: 'amount', header: "Importo", size: 100,
            Cell: ({cell}) => (
                <Box>
                    {cell.getValue() !== null ? (
                        <Chip label={`€${cell.getValue()}`} color="primary"/>) : (
                        <Chip label="N/A" color="warning"/>)}
                </Box>
            ),
        },
        {
            accessorKey: 'payment', header: "Metodo", size: 120,
            Cell: ({cell}) => {
                const payment = cell.getValue();
                const config = PAYMENT_CONFIGS[payment] || {label: payment, color: 'default'};
                return (
                    <Chip
                        label={config.label}
                        color={config.color}
                        variant="outlined"
                    />
                );
            }
        },
        {
            accessorKey: 'is_reimbursed',
            header: "Rimborsato",
            size: 50,
            Cell: ({cell}) => (
                <Chip
                    label={cell.getValue() ? "Sì" : "No"}
                    color={cell.getValue() ? "success" : "error"}
                    variant="outlined"
                />
            )
        }
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
