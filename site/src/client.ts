import './style.css';
import { createCfApp } from './app';
import type { Locale, PageContext, PageData, PageEntry } from './types';
import { EMPTY_DATA } from './types';

const el = document.documentElement;
const entry: PageEntry = {
  page: el.dataset.page as PageEntry['page'],
  locale: el.dataset.locale as Locale,
  region: el.dataset.region,
  path: el.dataset.path ?? '',
};
let data: PageData = EMPTY_DATA;
try {
  const raw = document.getElementById('cf-data')?.textContent;
  if (raw) data = JSON.parse(raw) as PageData;
} catch {
  /* fall through with empty data */
}
const ctx: PageContext = { entry, locale: entry.locale, data };
createCfApp(ctx).mount('#app');
