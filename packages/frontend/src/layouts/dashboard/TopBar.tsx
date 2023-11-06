import * as React from 'react';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Badge from '@mui/material/Badge';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsIcon from '@mui/icons-material/Notifications';
import IconButton from '@mui/material/IconButton';
import { useRecoilValue } from 'recoil';
import AppBar from './AppBar';
import PageState from '../../state/store';

interface TopBarProps {
  open: boolean
  toggleDrawer: () => void
}

export default function TopBar({ open, toggleDrawer }: TopBarProps) {
  const pageState = useRecoilValue(PageState);

  const handleLogout = () => {
    console.log('logout');
    window.location.href = 'http://localhost:3001/auth/logout';
  }

  return (
    <AppBar position="absolute" open={open}>
      <Toolbar
        sx={{
          pr: '24px', // keep right padding when drawer closed
        }}
      >
        <IconButton
          edge="start"
          color="inherit"
          aria-label="open drawer"
          onClick={toggleDrawer}
          sx={{
            marginRight: '36px',
            ...(open && { display: 'none' }),
          }}
        >
          <MenuIcon />
        </IconButton>
        <Typography
          component="h1"
          variant="h6"
          color="inherit"
          noWrap
          sx={{ flexGrow: 1 }}
        >
          {pageState.title}
        </Typography>
        <IconButton color="inherit">
          <Badge badgeContent={4} color="secondary">
            <NotificationsIcon />
          </Badge>
        </IconButton>
        <IconButton color="inherit" onClick={handleLogout}>
            <LogoutIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
