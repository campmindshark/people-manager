import React, { useEffect, useState } from 'react';
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
import User from 'backend/user/user';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Login from './pages/Login';
// import useFetch from './hooks/useFetch';

const mdTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const loadUser = async () => {
  const response = await fetch('http://localhost:3001/auth/login/success', {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Access-Control-Allow-Credentials': 'true',
    },
  });

  if (response.status !== 200) {
    if (window.location.href !== 'http://localhost:3000/login') {
      window.location.href = 'http://localhost:3000/login';
      return null;
    }
  }

  const responseData = await response.json();
  return responseData.user;
};

const router = createBrowserRouter([
  {
    path: '/',
    loader: async () => ({
      user: await loadUser(),
    }),
    Component() {
      const data = useLoaderData() as { user: User };
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
  const [user, setUser] = useState(null);

  useEffect(() => {
    console.log(user);
    const getUser = () => {
      fetch('http://localhost:3001/auth/login/success', {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Access-Control-Allow-Credentials': 'true',
        },
      })
        .then((response) => {
          if (response.status === 200) return response.json();

          if (window.location.href !== 'http://localhost:3000/login') {
            window.location.href = 'http://localhost:3000/login';
          }

          throw new Error('authentication has been failed!');
        })
        .then((resObject) => {
          console.log(resObject);
          setUser(resObject.user);
        })
        .catch((err) => {
          console.log(err);
        });
    };
    getUser();
  }, []);

  return (
    <ThemeProvider theme={mdTheme}>
      <CssBaseline />
      <RouterProvider router={router} fallbackElement={<p>Loading...</p>} />
    </ThemeProvider>
  );
}
