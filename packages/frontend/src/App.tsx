import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import "./App.css";
import Home from "./pages/Home";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import AuthenticatedPage from "./components/AuthenticatedPage";

const mdTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

const router = createBrowserRouter([
  {
    path: "/",
    loader: async () => ({}),
    Component() {
      return (
        <AuthenticatedPage>
          <Home />
        </AuthenticatedPage>
      );
    },
  },
  {
    path: "/login",
    Component() {
      return <Login />;
    },
  },
  {
    path: "/settings",
    Component() {
      return (
        <AuthenticatedPage>
          <Settings />
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
