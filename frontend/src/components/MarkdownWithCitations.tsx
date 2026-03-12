import React, {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { FiExternalLink } from "react-icons/fi";
import type { DiscoveryReference } from "@/types/discovery";

interface MarkdownWithCitationsProps {
  content: string;
  references: DiscoveryReference[];
}

const citationPattern = /\[(\d+)\]/g;

function CitationMark({
  index,
  reference,
}: {
  index: number;
  reference?: DiscoveryReference;
}) {
  if (!reference) {
    return <span className="text-amber-700">[{index}]</span>;
  }

  return (
    <span className="group relative mx-0.5 inline-flex align-baseline">
      <a
        href={reference.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 transition-colors hover:border-amber-300 hover:bg-amber-100"
      >
        [{index}]
      </a>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-3 hidden w-72 -translate-x-1/2 rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-[0_16px_42px_-24px_rgba(28,25,23,0.45)] group-hover:block group-focus-within:block">
        <span className="flex items-start gap-3">
          <Image
            src={reference.favicon_url}
            alt=""
            width={20}
            height={20}
            unoptimized
            className="mt-0.5 h-5 w-5 rounded-sm border border-stone-200"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              {reference.source_name || reference.domain}
            </span>
            <span className="mt-1 block text-sm font-semibold leading-5 text-stone-900">
              {reference.title}
            </span>
            {reference.excerpt && (
              <span className="mt-2 block text-xs leading-5 text-stone-600">
                {reference.excerpt}
              </span>
            )}
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700">
              開啟來源 <FiExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}

function replaceCitations(node: ReactNode, references: DiscoveryReference[]): ReactNode {
  if (typeof node === "string") {
    const segments: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    citationPattern.lastIndex = 0;
    while ((match = citationPattern.exec(node)) !== null) {
      if (match.index > lastIndex) {
        segments.push(node.slice(lastIndex, match.index));
      }

      const citationIndex = Number(match[1]);
      segments.push(
        <CitationMark
          key={`${citationIndex}-${match.index}`}
          index={citationIndex}
          reference={references.find((reference) => reference.id === citationIndex)}
        />
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < node.length) {
      segments.push(node.slice(lastIndex));
    }

    return segments;
  }

  if (Array.isArray(node)) {
    return Children.toArray(node).map((child) => replaceCitations(child, references));
  }

  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    if (element.props.children === undefined) {
      return element;
    }

    return cloneElement(element, {
      children: replaceCitations(element.props.children, references),
    });
  }

  return node;
}

export default function MarkdownWithCitations({
  content,
  references,
}: MarkdownWithCitationsProps) {
  return (
    <div className="prose prose-stone max-w-none prose-headings:font-bold prose-headings:text-stone-900 prose-p:text-[1.03rem] prose-p:leading-8 prose-li:text-[1.03rem] prose-li:leading-8 prose-strong:text-stone-900 prose-a:text-amber-700">
      <ReactMarkdown
        components={{
          h2: ({ children }) => (
            <h2 className="mt-10 text-2xl font-bold tracking-tight text-stone-900">
              {replaceCitations(children, references)}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-8 text-xl font-semibold text-stone-900">
              {replaceCitations(children, references)}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-5 text-[1.03rem] leading-8 text-stone-700">
              {replaceCitations(children, references)}
            </p>
          ),
          li: ({ children }) => (
            <li className="mb-2 text-[1.03rem] leading-8 text-stone-700">
              {replaceCitations(children, references)}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="rounded-r-2xl border-l-4 border-amber-400 bg-amber-50/70 px-5 py-1 text-stone-700">
              {replaceCitations(children, references)}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-amber-700 underline decoration-amber-300 underline-offset-4"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}