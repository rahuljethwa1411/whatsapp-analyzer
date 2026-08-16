import { LandingPage } from '../pages/LandingPage';
import { UploadPage } from '../pages/UploadPage';
import { ReportPage } from '../pages/ReportPage';
export function App() {
  const path = window.location.pathname;
  return path.startsWith('/upload') ? (
    <UploadPage />
  ) : path.startsWith('/report') ? (
    <ReportPage />
  ) : (
    <LandingPage />
  );
}
