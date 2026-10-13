import { renderToString } from 'vue/server-renderer';
import { createCfApp } from './app';
import { allMessages } from './i18n/setup';
import type { PageContext } from './types';

export interface Rendered {
  html: string;
  title: string;
  description: string;
}

/** Render one page to an HTML fragment plus its title and description. */
export async function render(ctx: PageContext): Promise<Rendered> {
  const html = await renderToString(createCfApp(ctx));
  const msgs = allMessages[ctx.locale].pages[ctx.entry.page] as { title: string; description: string };
  const brand = allMessages[ctx.locale].brand;
  const title = ctx.entry.page === 'index' ? `${brand} – ${msgs.title}` : `${msgs.title} – ${brand}`;
  return { html, title, description: msgs.description };
}
