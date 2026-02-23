'use client';

import { useState } from 'react';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';

interface GlobalDocumentReadonlyProps {
  title: string;
  content: string;
}

export function GlobalDocumentReadonly({ title, content }: GlobalDocumentReadonlyProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`bg-white rounded-2xl transition-all duration-200 ${
        isOpen
          ? 'shadow-lg ring-1 ring-blue-200'
          : 'shadow-sm ring-1 ring-gray-100 hover:shadow-md'
      }`}
    >
      <button
        className="w-full flex items-center justify-between p-4 text-left"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 shrink-0">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
          <p className="font-semibold text-gray-900">{title}</p>
        </div>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors shrink-0 ml-4 ${
            isOpen ? 'bg-gray-100' : 'bg-gray-50'
          }`}
        >
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4">
          <div className="h-px bg-gray-100 mb-4" />
          <div className="bg-gray-50 rounded-xl p-5 max-h-[600px] overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
              {content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
