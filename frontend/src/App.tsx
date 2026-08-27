import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { TemplateDetailPage } from './pages/TemplateDetailPage';
import { ProcessDocumentPage } from './pages/ProcessDocumentPage';
import { GeneratedDocumentsPage } from './pages/GeneratedDocumentsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/templates/:id" element={<TemplateDetailPage />} />
        <Route path="/process" element={<ProcessDocumentPage />} />
        <Route path="/documents" element={<GeneratedDocumentsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
};

export default App;
