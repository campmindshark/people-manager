import { AxiosRequestConfig } from 'axios';

const defaultRequestConfig: AxiosRequestConfig = {
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Access-Control-Allow-Credentials': 'true',
  },
};

export default defaultRequestConfig;
