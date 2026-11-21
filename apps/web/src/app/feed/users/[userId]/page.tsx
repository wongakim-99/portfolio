import { ProfilePage } from '@views/profile';

export default async function Page({ params }: PageProps<'/feed/users/[userId]'>) {
  const { userId } = await params;
  return <ProfilePage key={userId} userId={userId} />;
}
