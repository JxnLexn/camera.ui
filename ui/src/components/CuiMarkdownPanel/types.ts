export interface CuiMarkdownPanelProps {
  title: string;
  placeholder: string;
  content?: string | null;
  loading?: boolean;
  collapsedHeight?: number;
}

export const CUI_MARKDOWN_PANEL_DEFAULTS = {
  content: null,
  loading: false,
  collapsedHeight: 420,
} satisfies Partial<CuiMarkdownPanelProps>;
