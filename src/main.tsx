import {createRoot} from 'react-dom/client';
import { installApiFetchInterceptor } from './lib/apiClient';
installApiFetchInterceptor();
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
