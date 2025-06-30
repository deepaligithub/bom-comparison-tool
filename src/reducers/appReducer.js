export const initialState = {
  user: null,           // { username, role }
  tab: 'All',
  search: '',
  columns: {
    id: true,
    desc: true,
    tcQty: true,
    sapQty: true,
    status: true,
    actions: true,
  },
  currentPage: 1,
  rowsPerPage: 10,
  tcFile: null,
  sapFile: null,
};

export function appReducer(state, action) {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'LOGOUT':
      return { ...state, user: null };
    case 'SET_TAB':
      return { ...state, tab: action.payload };
    case 'SET_SEARCH':
      return { ...state, search: action.payload };
    case 'TOGGLE_COLUMN':
      return {
        ...state,
        columns: {
          ...state.columns,
          [action.payload]: !state.columns[action.payload],
        },
      };
    case 'SET_PAGE':
      return { ...state, currentPage: action.payload };
    case 'SET_ROWS_PER_PAGE':
      return { ...state, rowsPerPage: action.payload };
          case 'SET_TC_FILE':
      return { ...state, tcFile: action.payload };
    case 'SET_SAP_FILE':
      return { ...state, sapFile: action.payload };
    default:
      return state;
  }
}
