interface Props {
  user: {
    avatar_url: string;
    name: string;
    login: string;
    bio: string;
    location?: string;
  };
}

export default function ProfileHeader({ user }: Props) {
  return (
    <div className="flex items-center gap-6">
      <img
        src={user.avatar_url}
        alt="avatar"
        className="w-24 h-24 rounded-full border-2 border-brand-500"
      />
      <div>
        <h2 className="text-3xl font-semibold">{user.name}</h2>
        <p className="text-gray-500">@{user.login}</p>
        {user.bio && <p className="mt-2 max-w-prose">{user.bio}</p>}
        {user.location && <p className="text-sm text-gray-400 mt-1">📍 {user.location}</p>}
      </div>
    </div>
  );
}
