import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AppContext } from './context/AppContext';
import Navbar from './components/Navbar';
import ComparePage from './pages/ComparePage';
import MappingsPage from './pages/MappingsPage';
import UsersPage from './pages/UsersPage';
import LoginPage from './pages/LoginPage';

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
            <Route path="/" element={<ComparePage />} />
            {user.role === 'admin' && <Route path="/mappings" element={<MappingsPage />} />}
            {user.role === 'admin' && <Route path="/users" element={<UsersPage />} />}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </>
      )}
    </Router>
  );
}

export default App;
