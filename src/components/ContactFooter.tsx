export function ContactFooter() {
  return (
    <footer className="w-full bg-primary text-primary-foreground border-t border-primary-foreground/20 py-3 px-4">
      <div className="mx-auto flex flex-col items-center gap-1 text-center text-xs sm:flex-row sm:justify-center sm:gap-4">
        <span>Created by Miranda S Grato</span>
        <span className="hidden sm:inline text-primary-foreground/40">|</span>
        <a href="mailto:msgrato@outlook.com" className="hover:underline underline-offset-2">
          Email: msgrato@outlook.com
        </a>
        <span className="hidden sm:inline text-primary-foreground/40">|</span>
        <a
          href="https://www.linkedin.com/in/mirandagrato"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline underline-offset-2"
        >
          LinkedIn: www.linkedin.com/in/mirandagrato
        </a>
      </div>
    </footer>
  );
}
