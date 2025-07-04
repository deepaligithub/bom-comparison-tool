import React, { createContext, useReducer, useEffect } from 'react';
import { appReducer, initialState } from '../reducers/appReducer';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState, (init) => {
    const saved = localStorage.getItem('appState');
    return saved ? JSON.parse(saved) : init;
  });

  useEffect(() => {
    localStorage.setItem('appState', JSON.stringify(state));
    console.log("📦 AppContext state updated:", state);
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};
