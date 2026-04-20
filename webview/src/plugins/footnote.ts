import { $remark } from '@milkdown/utils';
import remarkGfm from 'remark-gfm';

export const footnote = $remark('gfm', () => remarkGfm);
