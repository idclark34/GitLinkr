interface Props {
  repo: {
    html_url: string;
    name: string;
    description: string;
    stargazers_count: number;
    forks_count: number;
    language?: string;
  };
  key?: any;
}

export default function RepoCard({ repo }: Props) {
  return (
    <a
      href={repo.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block border rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
    >
      <h3 className="text-lg font-bold mb-1">{repo.name}</h3>
      <p className="text-sm text-gray-600 line-clamp-2 mb-2">{repo.description}</p>
      <div className="flex text-xs gap-4 text-gray-500">
        <span>⭐ {repo.stargazers_count}</span>
        <span>🍴 {repo.forks_count}</span>
        {repo.language && <span>{repo.language}</span>}
      </div>
    </a>
  );
}
