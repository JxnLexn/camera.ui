import { TABLE_PAGINATOR_TEMPLATE } from '@/common/constants.js';

export interface CuiDataTableProps {
  value?: unknown[] | null;
  rows?: number;
  paginator?: boolean;
  paginatorTemplate?: string;
}

export const CUI_DATA_TABLE_DEFAULTS = {
  paginatorTemplate: TABLE_PAGINATOR_TEMPLATE,
} satisfies Partial<CuiDataTableProps>;
