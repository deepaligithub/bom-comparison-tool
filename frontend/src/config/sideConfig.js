export const SIDE_A = {
  id: 'A',
  key: 'tc', // internal key for API/columns (BOM_A_*)
  label: 'Source BOM',
  description: 'Reference BOM file (e.g. CSV, XLSX, JSON, PLMXML)',
};

export const SIDE_B = {
  id: 'B',
  key: 'sap', // internal key for API/columns (BOM_B_*)
  label: 'Target BOM',
  description: 'BOM file to compare against the source',
};

export const STATUS_DISPLAY_LABELS = {
  Matched: 'Matched',
  Different: 'Different',
  'TC Only': `${SIDE_A.label} only`,
  'SAP Only': `${SIDE_B.label} only`,
};

