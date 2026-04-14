import { useAuthSessionState } from '@/features/auth';
import { MyProfilePageContent } from '@/features/my-profile';

export function ProfilePage() {
  const authSession = useAuthSessionState();
  const snapshot = authSession.status === 'authenticated' ? authSession.snapshot : null;
  const disableChangeLoginEmail = snapshot?.primaryAccessGroup === 'GUEST';

  return <MyProfilePageContent disableChangeLoginEmail={disableChangeLoginEmail} />;
}
