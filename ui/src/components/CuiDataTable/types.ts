import { TABLE_PAGE_SIZE, TABLE_PAGINATOR_TEMPLATE } from '@/common/constants.js';

export interface CuiDataTableProps {
  value?: unknown[] | null;
  rows?: number;
  paginator?: boolean;
  paginatorTemplate?: string;
}

export const CUI_DATA_TABLE_DEFAULTS = {
  rows: TABLE_PAGE_SIZE,
  paginatorTemplate: TABLE_PAGINATOR_TEMPLATE,
} satisfies Partial<CuiDataTableProps>;
