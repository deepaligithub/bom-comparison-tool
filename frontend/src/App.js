import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AppContext } from './context/AppContext';
import Navbar from './components/Navbar';
//import ComparePage from './pages/ComparePage';
import BOMComparePage from './pages/BOMComparePage';
import UsersPage from './pages/UsersPage';
import LoginPage from './pages/LoginPage';
import MappingMenu from './components/MappingMenu';
import AddMappingPage from './pages/admin/AddMappingPage';
import LoadMappingPage from './pages/admin/LoadMappingPage';

function App() {
  const { state } = useContext(AppContext);
  const user = state.user;
  console.log("Logged-in user:", user);

  return (
    <Router>
      {!user ? (
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      ) : (
        <>
          <Navbar />
          <Routes>
            <Route path="/" element={<Navigate to="/compare" replace />} />
            {/*<Route path="/" element={<ComparePage />} />*/}
            <Route path="/compare" element={<BOMComparePage />} />
            {user.role === 'admin' && (
              <>
                <Route path="/users" element={<UsersPage />} />

                {/* Main Admin Mapping Menu */}
                <Route path="/admin/mapping" element={<MappingMenu />}>
                  <Route index element={<Navigate to="create" />} />
                  <Route path="create" element={<AddMappingPage />} />
                  <Route path="manage" element={<LoadMappingPage />} />
                </Route>
              </>
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
