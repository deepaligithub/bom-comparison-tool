import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useContext, useState, useEffect } from 'react';
import { AppContext } from './context/AppContext';
import Navbar from './components/Navbar';
import AppFooter from './components/AppFooter';
import DashboardPage from './pages/DashboardPage';
import BOMComparePage from './pages/BOMComparePage';
import HelpPage from './pages/HelpPage';
import UsersPage from './pages/UsersPage';
import UtilitiesPage from './pages/UtilitiesPage';
import LoginPage from './pages/LoginPage';
import MappingMenu from './components/MappingMenu';
import AddMappingPage from './pages/admin/AddMappingPage';
import LoadMappingPage from './pages/admin/LoadMappingPage';
import UpgradePrompt from './components/UpgradePrompt';
import { set402Handler } from './api/client';

function App() {
  const { state } = useContext(AppContext);
  const user = state.user;
  const [globalUpgradeMessage, setGlobalUpgradeMessage] = useState(null);

  useEffect(() => {
    set402Handler((message) => setGlobalUpgradeMessage(message || 'This feature is not available in your current version.'));
    return () => set402Handler(null);
  }, []);

  return (
    <Router>
      {!user ? (
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      ) : (
        <>
          <Navbar />
          <AppFooter />
          {globalUpgradeMessage && (
            <UpgradePrompt
              open={true}
              message={globalUpgradeMessage}
              onClose={() => setGlobalUpgradeMessage(null)}
            />
          )}
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/compare" element={<BOMComparePage />} />
            <Route path="/help" element={<HelpPage />} />
            {(user.role === 'admin' || user.features?.users_page) && <Route path="/users" element={<UsersPage />} />}
            {user.role === 'admin' && <Route path="/admin/utilities" element={<UtilitiesPage />} />}
            {(user.features?.mapping_manager || user.role === 'admin') && (
              <Route path="/admin/mapping" element={<MappingMenu />}>
                <Route index element={<Navigate to="create" />} />
                <Route path="create" element={<AddMappingPage />} />
                <Route path="manage" element={<LoadMappingPage />} />
              </Route>
            )}
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </>
      )}
    </Router>
  );
}

export default App;
