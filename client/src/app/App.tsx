import { LandingPage } from '../pages/LandingPage';
import { UploadPage } from '../pages/UploadPage';
import { ReportPage } from '../pages/ReportPage';
import { TermsPage } from '../pages/TermsPage';
import { PrivacyPage } from '../pages/PrivacyPage';
import { RefundPage } from '../pages/RefundPage';
import { ContactPage } from '../pages/ContactPage';

export function App() {
  const path = window.location.pathname.toLowerCase();

  if (path.startsWith('/upload')) return <UploadPage />;
  if (path.startsWith('/report')) return <ReportPage />;
  if (path.startsWith('/terms')) return <TermsPage />;
  if (path.startsWith('/privacy')) return <PrivacyPage />;
  if (path.startsWith('/refund') || path.startsWith('/cancellation')) return <RefundPage />;
  if (path.startsWith('/contact') || path.startsWith('/support')) return <ContactPage />;

  return <LandingPage />;
}

