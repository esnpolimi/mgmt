// ESN Milano Unità sections for "Evento di coordinamento".
// Codes must match backend events.models.Section.
export const COORDINATION_SECTIONS = [
    {code: 'iulm', label: 'Iulm'},
    {code: 'statale', label: 'Statale'},
    {code: 'unicatt', label: 'Unicatt'},
    {code: 'polimi', label: 'Polimi'},
    {code: 'bocconi', label: 'Bocconi'},
    {code: 'bicocca', label: 'Bicocca'},
];

export const sectionLabel = (code) => COORDINATION_SECTIONS.find(s => s.code === code)?.label || code || '';
