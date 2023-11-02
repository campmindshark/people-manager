import { atom } from 'recoil';

interface PageData {
  title: string
  index: string
}

const PageState = atom<PageData>({
  key: 'pageState',
  default: {
    title: 'Home',
    index: 'home',
  },
});

export default PageState;
