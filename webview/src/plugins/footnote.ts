import { $remark } from '@milkdown/utils';
import remarkFootnotes from 'remark-footnotes';

export const footnote = $remark('footnote', () => remarkFootnotes);
