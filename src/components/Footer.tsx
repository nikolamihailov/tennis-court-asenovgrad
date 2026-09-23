export default function Footer() {
  // Read at render rather than hardcoded, so the notice does not silently go stale
  // every January. The footer is inside a dynamic route, so this is evaluated per request.
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/5 bg-navy-950">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 text-xs text-white/50 sm:flex-row">
        <p>Тенис клуб Асеновград</p>
        <p>© {year} Тенис клуб Асеновград. Всички права запазени.</p>
        <div className="flex items-center gap-4">
          <a href="#" aria-label="Facebook" className="hover:text-white">
            <FacebookIcon />
          </a>
          <a href="#" aria-label="Instagram" className="hover:text-white">
            <InstagramIcon />
          </a>
        </div>
      </div>
    </footer>
  );
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22 12.06C22 6.51 17.52 2 12 2S2 6.51 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.79c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
