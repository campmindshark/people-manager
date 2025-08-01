import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import './App.css';
import Admin from './pages/Admin';
import AdminUserManagement from './pages/AdminUserManagement';
import Dues from './pages/Dues';
import Home from './pages/Home';
import ProfileEdit from './pages/ProfileEdit';
import Login from './pages/Login';
import AuthenticatedPage from './components/AuthenticatedPage';
import Roster from './pages/Roster';
import Shifts from './pages/Shifts';

const mdTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4285f4',
    },
    secondary: {
      main: '#ffdf00',
    },
    error: {
      main: '#db4437',
    },
    info: {
      main: '#00bcd4',
    },
    success: {
      main: '#1A85FF',
    },
  },
});

const router = createBrowserRouter([
  {
    path: '/',
    Component() {
      return (
        <AuthenticatedPage>
          <Home />
        </AuthenticatedPage>
      );
    },
  },
  {
    path: '/admin',
    Component() {
      return (
        <AuthenticatedPage>
          <Admin />
        </AuthenticatedPage>
      );
    },
  },
  {
    path: '/admin/manage-users',
    Component() {
      return (
        <AuthenticatedPage>
          <AdminUserManagement />
        </AuthenticatedPage>
      );
    },
  },
  {
    path: '/admin/dues',
    Component() {
      return (
        <AuthenticatedPage>
          <Dues />
        </AuthenticatedPage>
      );
    },
  },
  {
    path: '/login',
    Component() {
      return <Login />;
    },
  },
  {
    path: '/roster',
    Component() {
      return (
        <AuthenticatedPage>
          <Roster />
        </AuthenticatedPage>
      );
    },
  },
  {
    path: '/profile-edit',
    Component() {
      return (
        <AuthenticatedPage>
          <ProfileEdit />
        </AuthenticatedPage>
      );
    },
  },
  {
    path: '/shifts',
    Component() {
      return (
        <AuthenticatedPage>
          <Shifts />
        </AuthenticatedPage>
      );
    },
  },
]);

export default function App() {
  return (
    <ThemeProvider theme={mdTheme}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <CssBaseline />
        <RouterProvider router={router} fallbackElement={<p>Loading...</p>} />
      </LocalizationProvider>
    </ThemeProvider>
  );
}
