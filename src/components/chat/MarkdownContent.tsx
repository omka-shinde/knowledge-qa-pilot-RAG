import ReactMarkdown from "react-markdown";

type MarkdownContentProps = {
  content: string;
  className?: string;
};

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => (
            <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 list-decimal space-y-1.5 pl-5 last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 opacity-90 hover:opacity-100"
            >
              {children}
            </a>
          ),
          code: ({ children, className: codeClassName }) => {
            const isBlock = Boolean(codeClassName);
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-lg bg-zinc-100 px-3 py-2 text-xs dark:bg-zinc-800">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-zinc-100 px-1 py-0.5 text-[0.85em] dark:bg-zinc-800">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="mb-2 last:mb-0">{children}</pre>,
          h1: ({ children }) => (
            <h1 className="mb-2 text-base font-semibold last:mb-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 text-sm font-semibold last:mb-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1.5 text-sm font-semibold last:mb-0">{children}</h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-2 border-l-2 border-zinc-300 pl-3 text-zinc-600 last:mb-0 dark:border-zinc-600 dark:text-zinc-300">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-zinc-200 dark:border-zinc-700" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
