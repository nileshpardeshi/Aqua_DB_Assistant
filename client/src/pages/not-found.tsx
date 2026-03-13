import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, SearchX } from 'lucide-react';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-56px)] p-6">
      <div className="flex flex-col items-center text-center max-w-md">
        {/* Illustration */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-aqua-100 to-aqua-200 flex items-center justify-center">
            <SearchX className="w-12 h-12 text-aqua-600" />
          </div>
          <div className="absolute -bottom-2 -right-2 text-5xl font-black text-aqua-200 select-none">
            404
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Page Not Found</h1>
        <p className="text-sm text-muted-foreground mb-8">
          The page you are looking for does not exist or may have been moved.
          Check the URL or navigate back to the dashboard.
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground bg-secondary rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-aqua-600 rounded-lg hover:bg-aqua-700 transition-colors shadow-sm"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
