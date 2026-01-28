import {transactionDisplayNames as names} from '../utils/displayAttributes';

export const TRANSACTION_CONFIGS = {
    subscription: {label: names.tran_type["subscription"], color: 'primary'},
    esncard: {label: names.tran_type["esncard"], color: 'secondary'},
    deposit: {label: names.tran_type["deposit"], color: 'success'},
    withdrawal: {label: names.tran_type["withdrawal"], color: 'error'},
    reimbursement: {label: names.tran_type["reimbursement"], color: 'info'},
    cauzione: {label: names.tran_type["cauzione"], color: 'warning'},
    rimborso_cauzione: {label: names.tran_type["rimborso_cauzione"], color: 'default'},
    rimborso_quota: {label: names.tran_type["rimborso_quota"], color: 'default'},
    service: {label: names.tran_type["service"], color: 'primary'},
    rimborso_service: {label: names.tran_type["rimborso_service"], color: 'default'},
};

