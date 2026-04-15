import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { App } from './App';
import { ThemeProvider } from './context/ThemeContext';
import { seedDatabase } from './db/seed';
import { db } from './db/database';
import { DashboardPage } from './pages/DashboardPage';
import { WorkoutPage } from './pages/WorkoutPage';
import { HistoryPage } from './pages/HistoryPage';
import { ExercisesPage } from './pages/ExercisesPage';
import { CalculatorPage } from './pages/CalculatorPage';
import { SettingsPage } from './pages/SettingsPage';
import './index.css';

// Recover IndexedDB connection when iOS brings the PWA back from background
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !db.isOpen()) {
    db.open();
  }
});

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'workout', element: <WorkoutPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'exercises', element: <ExercisesPage /> },
      { path: 'calculator', element: <CalculatorPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);

// Seed database BEFORE rendering — prevents race condition where
// React queries IndexedDB while migrations are still deleting/updating sessions
seedDatabase().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </StrictMode>,
  );
});
