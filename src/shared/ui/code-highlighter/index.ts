import type { CodeHighlighterProps } from '@ant-design/x';
import type { CSSProperties } from 'react';

export type CodeHighlightThemeMode = 'dark' | 'light';

type PrismStyle = Record<string, CSSProperties>;
type SharedCodeHighlighterProps = Pick<CodeHighlighterProps, 'highlightProps' | 'style' | 'styles'>;

const sharedCodeTagStyle: CSSProperties = {
  background: 'transparent',
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-wrap',
};

const sharedPreStyle: CSSProperties = {
  borderRadius: '0.3em',
  margin: 0,
  overflow: 'auto',
  padding: '1em',
};

const sharedCodeHighlighterStyle: CSSProperties = {
  width: '100%',
};

const sharedCodeHighlighterStyles: NonNullable<CodeHighlighterProps['styles']> = {
  code: {
    fontSize: 'var(--ant-font-size-sm)',
    lineHeight: 1.6,
  },
  root: {
    overflow: 'hidden',
  },
};

const darkCodeHighlightStyle: PrismStyle = {
  'pre[class*="language-"]': {
    background: '#1e1e1e',
    color: '#d4d4d4',
    margin: 0,
  },
  'code[class*="language-"]': {
    background: 'transparent',
    color: '#d4d4d4',
    textShadow: 'none',
  },
  comment: {
    color: '#6a9955',
    fontStyle: 'italic',
  },
  prolog: {
    color: '#808080',
  },
  doctype: {
    color: '#808080',
  },
  cdata: {
    color: '#808080',
  },
  punctuation: {
    color: '#d4d4d4',
  },
  property: {
    color: '#9cdcfe',
  },
  tag: {
    color: '#569cd6',
  },
  boolean: {
    color: '#569cd6',
  },
  number: {
    color: '#b5cea8',
  },
  constant: {
    color: '#4fc1ff',
  },
  symbol: {
    color: '#b5cea8',
  },
  deleted: {
    color: '#ce9178',
  },
  selector: {
    color: '#d7ba7d',
  },
  'attr-name': {
    color: '#9cdcfe',
  },
  string: {
    color: '#ce9178',
  },
  char: {
    color: '#ce9178',
  },
  builtin: {
    color: '#4ec9b0',
  },
  inserted: {
    color: '#b5cea8',
  },
  operator: {
    color: '#d4d4d4',
  },
  entity: {
    color: '#4fc1ff',
    cursor: 'help',
  },
  url: {
    color: '#d7ba7d',
  },
  atrule: {
    color: '#c586c0',
  },
  'attr-value': {
    color: '#ce9178',
  },
  keyword: {
    color: '#c586c0',
  },
  function: {
    color: '#dcdcaa',
  },
  'class-name': {
    color: '#4ec9b0',
  },
  regex: {
    color: '#d16969',
  },
  important: {
    color: '#c586c0',
    fontWeight: 700,
  },
  variable: {
    color: '#9cdcfe',
  },
  bold: {
    fontWeight: 700,
  },
  italic: {
    fontStyle: 'italic',
  },
};

export function createCodeHighlightProps(
  mode: CodeHighlightThemeMode,
): NonNullable<CodeHighlighterProps['highlightProps']> {
  return {
    customStyle: sharedPreStyle,
    codeTagProps: {
      style: sharedCodeTagStyle,
    },
    wrapLongLines: true,
    ...(mode === 'dark'
      ? {
          style: darkCodeHighlightStyle,
        }
      : null),
  };
}

export function createCodeHighlighterProps(
  mode: CodeHighlightThemeMode,
): SharedCodeHighlighterProps {
  return {
    highlightProps: createCodeHighlightProps(mode),
    style: sharedCodeHighlighterStyle,
    styles: sharedCodeHighlighterStyles,
  };
}
