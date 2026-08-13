import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PublicLayout } from './layouts/PublicLayout.js';
import { AuthenticatedLayoutPlaceholder } from './layouts/AuthenticatedLayoutPlaceholder.js';
import { AdminLayoutPlaceholder } from './layouts/AdminLayoutPlaceholder.js';
import { FoundationPage } from './pages/FoundationPage.js';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<FoundationPage />} />
        </Route>
        <Route path="/auth/placeholder" element={<AuthenticatedLayoutPlaceholder />} />
        <Route path="/admin/placeholder" element={<AdminLayoutPlaceholder />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
