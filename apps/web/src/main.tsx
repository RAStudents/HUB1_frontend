// apps/web/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { router } from './router';
import './index.css';
import './styles/app-shell.css';
import './styles/dashboard.css';
import './styles/dataset-form.css';
import './styles/members.css';
import './styles/gallery.css';
import './styles/profile.css';
import './styles/notifications.css';
import './styles/review.css';
import './styles/annotation-editor.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AuthProvider>
            <RouterProvider router={router} />
        </AuthProvider>
    </React.StrictMode>
);