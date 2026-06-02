import type { CodeHighlighterProps } from '@ant-design/x';
import type { CSSProperties } from 'react';

export type CodeHighlightThemeMode = 'dark' | 'light';

type PrismStyle = Record<string, CSSProperties>;
type SharedCodeHighlighterProps = Pick<
  CodeHighlighterProps,
  'highlightProps' | 'prismLightMode' | 'style' | 'styles'
>;

const sharedCodeTagStyle: CSSProperties = {
  background: 'transparent',
  overflowWrap: 'anywhere',
  whiteSpace: 'pre-wrap',
};

const sharedPreStyle: CSSProperties = {
  borderRadius: 'var(--ant-border-radius-sm)',
  margin: 0,
  overflow: 'auto',
  padding: 'var(--ant-padding-sm)',
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

const darkCodeSyntaxColor = {
  background: 'var(--color-code-syntax-dark-bg)',
  builtin: 'var(--color-code-syntax-dark-builtin)',
  comment: 'var(--color-code-syntax-dark-comment)',
  entity: 'var(--color-code-syntax-dark-entity)',
  foreground: 'var(--color-code-syntax-dark-fg)',
  function: 'var(--color-code-syntax-dark-function)',
  keyword: 'var(--color-code-syntax-dark-keyword)',
  muted: 'var(--color-code-syntax-dark-muted)',
  number: 'var(--color-code-syntax-dark-number)',
  property: 'var(--color-code-syntax-dark-property)',
  regex: 'var(--color-code-syntax-dark-regex)',
  selector: 'var(--color-code-syntax-dark-selector)',
  string: 'var(--color-code-syntax-dark-string)',
  tag: 'var(--color-code-syntax-dark-tag)',
} as const;

const darkCodeHighlightStyle: PrismStyle = {
  'pre[class*="language-"]': {
    background: darkCodeSyntaxColor.background,
    color: darkCodeSyntaxColor.foreground,
    margin: 0,
  },
  'code[class*="language-"]': {
    background: 'transparent',
    color: darkCodeSyntaxColor.foreground,
    textShadow: 'none',
  },
  comment: {
    color: darkCodeSyntaxColor.comment,
    fontStyle: 'italic',
  },
  prolog: {
    color: darkCodeSyntaxColor.muted,
  },
  doctype: {
    color: darkCodeSyntaxColor.muted,
  },
  cdata: {
    color: darkCodeSyntaxColor.muted,
  },
  punctuation: {
    color: darkCodeSyntaxColor.foreground,
  },
  property: {
    color: darkCodeSyntaxColor.property,
  },
  tag: {
    color: darkCodeSyntaxColor.tag,
  },
  boolean: {
    color: darkCodeSyntaxColor.tag,
  },
  number: {
    color: darkCodeSyntaxColor.number,
  },
  constant: {
    color: darkCodeSyntaxColor.entity,
  },
  symbol: {
    color: darkCodeSyntaxColor.number,
  },
  deleted: {
    color: darkCodeSyntaxColor.string,
  },
  selector: {
    color: darkCodeSyntaxColor.selector,
  },
  'attr-name': {
    color: darkCodeSyntaxColor.property,
  },
  string: {
    color: darkCodeSyntaxColor.string,
  },
  char: {
    color: darkCodeSyntaxColor.string,
  },
  builtin: {
    color: darkCodeSyntaxColor.builtin,
  },
  inserted: {
    color: darkCodeSyntaxColor.number,
  },
  operator: {
    color: darkCodeSyntaxColor.foreground,
  },
  entity: {
    color: darkCodeSyntaxColor.entity,
    cursor: 'help',
  },
  url: {
    color: darkCodeSyntaxColor.selector,
  },
  atrule: {
    color: darkCodeSyntaxColor.keyword,
  },
  'attr-value': {
    color: darkCodeSyntaxColor.string,
  },
  keyword: {
    color: darkCodeSyntaxColor.keyword,
  },
  function: {
    color: darkCodeSyntaxColor.function,
  },
  'class-name': {
    color: darkCodeSyntaxColor.builtin,
  },
  regex: {
    color: darkCodeSyntaxColor.regex,
  },
  important: {
    color: darkCodeSyntaxColor.keyword,
    fontWeight: 700,
  },
  variable: {
    color: darkCodeSyntaxColor.property,
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
    prismLightMode: false,
    style: sharedCodeHighlighterStyle,
    styles: sharedCodeHighlighterStyles,
  };
}
