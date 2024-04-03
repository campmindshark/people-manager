import { atom } from 'recoil';

const DrawerOpen = atom<boolean>({
  key: 'drawerOpen',
  default: window.innerWidth > 600,
});

export default DrawerOpen;
