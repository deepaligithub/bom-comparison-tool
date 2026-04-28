import React, { createContext, useReducer, useEffect } from 'react';
import { appReducer, initialState } from '../reducers/appReducer';
import apiClient from '../api/client';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState, (init) => {
    const saved = localStorage.getItem('appState');
    return saved ? JSON.parse(saved) : init;
  });

  useEffect(() => {
    try {
      localStorage.setItem('appState', JSON.stringify(state));
    } catch (e) {
      // Ignore quota or disabled localStorage
    }
    if (state.user) {
      apiClient.defaults.headers.common['X-User-Plan'] = state.user.plan || 'free';
      apiClient.defaults.headers.common['X-User-Role'] = state.user.role || 'user';
    } else {
      delete apiClient.defaults.headers.common['X-User-Plan'];
      delete apiClient.defaults.headers.common['X-User-Role'];
    }
  }, [state]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};
