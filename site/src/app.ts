import { createSSRApp, defineComponent, h, type App } from 'vue';
import Layout from './components/Layout.vue';
import { createCfI18n } from './i18n/setup';
import ApiPage from './pages/ApiPage.vue';
import CheckPage from './pages/CheckPage.vue';
import IndexPage from './pages/IndexPage.vue';
import LegalPage from './pages/LegalPage.vue';
import MethodPage from './pages/MethodPage.vue';
import RegionPage from './pages/RegionPage.vue';
import SourcesPage from './pages/SourcesPage.vue';
import type { PageContext } from './types';

const PAGES = { index: IndexPage, region: RegionPage, check: CheckPage, sources: SourcesPage, api: ApiPage, method: MethodPage, legal: LegalPage } as const;

/** Same app factory for the prerender (server) and the client hydration. */
export function createCfApp(ctx: PageContext): App {
  const Page = PAGES[ctx.entry.page];
  const Root = defineComponent({ name: 'CfApp', render: () => h(Layout, { ctx }, { default: () => h(Page, { ctx }) }) });
  const app = createSSRApp(Root);
  app.use(createCfI18n(ctx.locale));
  return app;
}
