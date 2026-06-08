import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './i18n';

import { ThemeModeProvider, useThemeMode } from './contexts/ThemeContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Credentials from './pages/Credentials';
import PerformanceTest from './pages/PerformanceTest';
import CreateCognitiveLab from './pages/CreateCognitiveLab';
import ResolveCognitiveLab from './pages/ResolveCognitiveLab';
import ConnectWallet from './pages/ConnectWallet';
import Account from './pages/Account';
import Scanner from './pages/Scanner';
import Contracts from './pages/Contracts';
import VerifyCredential from './pages/VerifyCredential';
import Analytics from './pages/Analytics';

function AppContent() {
  const { theme, mode } = useThemeMode();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <div className="App">
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/credentials" element={<Credentials />} />
              <Route path="/performance-test" element={<PerformanceTest />} />
              <Route path="/create-cognitive-lab" element={<CreateCognitiveLab />} />
              <Route path="/resolve-cognitive-lab" element={<ResolveCognitiveLab />} />
              <Route path="/connect-wallet" element={<ConnectWallet />} />
              <Route path="/account" element={<Account />} />
              <Route path="/scanner" element={<Scanner />} />
              <Route path="/contracts" element={<Contracts />} />
              <Route path="/verify-credential" element={<VerifyCredential />} />
              <Route path="/analytics" element={<Analytics />} />
            </Routes>
          </main>
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme={mode === 'dark' ? 'dark' : 'light'}
          />
        </div>
      </Router>
    </ThemeProvider>
  );
}

function App() {
  return (
    <ThemeModeProvider>
      <AppContent />
    </ThemeModeProvider>
  );
}

export default App;