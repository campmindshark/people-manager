import React, { useEffect, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Typography from '@mui/material/Typography';
import { getFrontendConfig } from '../config/config';

const frontendConfig = getFrontendConfig();

export default function Login() {
  const [devAuthAvailable, setDevAuthAvailable] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.open(`${frontendConfig.BackendURL}/api/auth/google`, '_self');
  };

  useEffect(() => {
    document.title = 'MindShark Portal - Log In';
  });

  useEffect(() => {
    fetch(`${frontendConfig.BackendURL}/api/auth/dev/status`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => setDevAuthAvailable(data.available === true))
      .catch(() => {});
  }, []);

  return (
    <Grid container component="main" sx={{ height: '100vh' }}>
      <CssBaseline />
      <Grid
        item
        xs={false}
        sm={4}
        md={7}
        sx={{
          backgroundImage: 'url(https://source.unsplash.com/random?wallpapers)',
          backgroundRepeat: 'no-repeat',
          backgroundColor: (t) =>
            t.palette.mode === 'light'
              ? t.palette.grey[50]
              : t.palette.grey[900],
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <Grid item xs={12} sm={8} md={5} component={Paper} elevation={6} square>
        <Box
          sx={{
            my: 8,
            mx: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Avatar sx={{ m: 1, bgcolor: 'secondary.main' }}>
            <LockOutlinedIcon />
          </Avatar>
          <Typography component="h1" variant="h5">
            Log In
          </Typography>
          <Box
            component="form"
            noValidate
            onSubmit={handleSubmit}
            sx={{ mt: 1 }}
          >
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
            >
              Log In With Google
            </Button>
          </Box>
          {devAuthAvailable && (
            <Box sx={{ width: '100%', mt: 2 }}>
              <Divider sx={{ mb: 2 }}>Dev Login</Divider>
              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                sx={{ mb: 1 }}
                onClick={() =>
                  window.open(
                    `${frontendConfig.BackendURL}/api/auth/dev/login/admin`,
                    '_self',
                  )
                }
              >
                Dev Login (Admin)
              </Button>
              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                onClick={() =>
                  window.open(
                    `${frontendConfig.BackendURL}/api/auth/dev/login/standard`,
                    '_self',
                  )
                }
              >
                Dev Login (Standard User)
              </Button>
            </Box>
          )}
        </Box>
      </Grid>
    </Grid>
  );
}
