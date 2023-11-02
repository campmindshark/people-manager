import * as React from 'react';
// import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import {
  createBrowserRouter,
  RouterProvider,
  useLoaderData,
} from 'react-router-dom';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
// import Home from './pages/Home';
import './App.css';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Login from './pages/Login';

const mdTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const router = createBrowserRouter([
  {
    path: '/',
    loader: () => ({ message: 'Hello Data Router!' }),
    Component() {
      const data = useLoaderData() as { message: string };
      console.log(data);
      return <Home />;
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
      return <Settings />;
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
