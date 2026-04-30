import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'
import type { Components } from 'react-markdown'

interface Props {
  content: string
}

const components: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '')
    const codeString = String(children).replace(/\n$/, '')

    // Inline code
    if (!match && !codeString.includes('\n')) {
      return (
        <code className="bg-[#1c2333] px-1.5 py-0.5 rounded text-[13px] text-[#e6edf3]" {...props}>
          {children}
        </code>
      )
    }

    // Block code
    return <CodeBlock code={codeString} language={match?.[1]} />
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault()
          if (href) window.api.openExternal(href)
        }}
        className="text-[#58a6ff] hover:underline"
      >
        {children}
      </a>
    )
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="border-collapse border border-[#30363d] w-full text-sm">
          {children}
        </table>
      </div>
    )
  },
  th({ children }) {
    return (
      <th className="border border-[#30363d] px-3 py-1.5 bg-[#161b22] text-left font-medium">
        {children}
      </th>
    )
  },
  td({ children }) {
    return (
      <td className="border border-[#30363d] px-3 py-1.5">{children}</td>
    )
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-3 border-[#30363d] pl-3 my-2 text-gray-400">
        {children}
      </blockquote>
    )
  }
}

export function MarkdownRenderer({ content }: Props) {
  return (
    <div className="prose prose-invert prose-sm max-w-none leading-relaxed [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>h1]:mt-4 [&>h1]:mb-2 [&>h2]:mt-3 [&>h2]:mb-1 [&>h3]:mt-2 [&>h3]:mb-1">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
