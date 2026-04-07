import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './LandingPage';
import StaffLogin from './StaffLogin';
import AdminLogin from './AdminLogin';
import StaffDashboard from './StaffDashboard';
import AdminDashboard from './AdminDashboard';  
import ManagementPage from './ManagementPage';
import ChatPopup from './ChatPopup';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/staff-login" element={<StaffLogin />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/staff-dashboard" element={<StaffDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/management" element={<ManagementPage />} />
      </Routes>
      <ChatPopup />
    </BrowserRouter>
  );
}

export default App;