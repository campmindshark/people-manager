import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './App.css';
import Admin from './pages/Admin';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Login from './pages/Login';
import AuthenticatedPage from './components/AuthenticatedPage';
import Shifts from './pages/Shifts';

const mdTheme = createTheme({
  palette: {
    mode: 'dark',
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
    path: '/login',
    Component() {
      return <Login />;
    },
  },
  {
    path: '/settings',
    Component() {
      return (
        <AuthenticatedPage>
          <Settings />
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
      <CssBaseline />
      <RouterProvider router={router} fallbackElement={<p>Loading...</p>} />
    </ThemeProvider>
  );
}
