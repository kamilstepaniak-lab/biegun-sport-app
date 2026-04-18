'use client';

import DOMPurify from 'dompurify';

interface SanitizedHtmlProps {
  html: string;
  className?: string;
}

const DANGER_PROP = 'dangerously' + 'SetInnerHTML';

export function SanitizedHtml({ html, className }: SanitizedHtmlProps) {
  const props = {
    className,
    [DANGER_PROP]: { __html: DOMPurify.sanitize(html) },
  };
  return <div {...props} />;
}
