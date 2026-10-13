<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import DocSourceCard from '../components/DocSourceCard.vue';
import DocTable, { type DocHeader } from '../components/DocTable.vue';
import type { PageContext } from '../types';

const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';

export default defineComponent({
  name: 'SourcesPage',
  components: { DocSourceCard, DocTable },
  props: { ctx: { type: Object as PropType<PageContext>, required: true } },
  computed: {
    sources(): NonNullable<PageContext['data']['sources']> {
      return this.ctx.data.sources ?? [];
    },
    licenceHeaders(): DocHeader[] {
      return [
        { label: this.$t('pages.sources.licenceHead.source') },
        { label: this.$t('pages.sources.licenceHead.licence') },
        { label: this.$t('pages.sources.licenceHead.note') },
      ];
    },
    links(): Record<string, string> {
      return {
        cc: CC_BY,
        dwd: 'https://www.dwd.de/copyright',
        bkg: 'https://www.govdata.de/dl-de/by-2-0',
        bkgSources: 'https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf',
        geonames: 'https://www.geonames.org',
      };
    },
  },
});
</script>

<template>
  <article class="space-y-2">
    <h1 class="text-2xl font-bold">{{ $t('pages.sources.heading') }}</h1>
    <p>{{ $t('pages.sources.intro') }}</p>

    <section aria-labelledby="sources-cards">
      <h2 id="sources-cards" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.sources.cardsHeading') }}</h2>
      <ul v-if="sources.length" class="grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
        <li v-for="s in sources" :key="s.id" class="min-w-0">
          <DocSourceCard :source="s" :locale="ctx.locale" />
        </li>
      </ul>
      <p v-else class="cf-card cf-muted">{{ $t('pages.sources.cardsFallback') }}</p>
    </section>

    <section aria-labelledby="sources-notice">
      <h2 id="sources-notice" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.sources.noticeHeading') }}</h2>
      <p class="cf-card">{{ $t('pages.sources.notice') }}</p>
    </section>

    <section aria-labelledby="sources-licences">
      <h2 id="sources-licences" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.sources.licenceHeading') }}</h2>
      <DocTable :caption="$t('pages.sources.licenceCaption')" :headers="licenceHeaders" :source="$t('pages.sources.licenceSource')">
        <tr>
          <th scope="row">{{ $t('pages.sources.rows.rki.name') }}</th>
          <td>
            <a :href="links.cc" class="underline">{{ $t('pages.sources.rows.rki.licence') }}</a>
          </td>
          <td>{{ $t('pages.sources.rows.rki.note') }}</td>
        </tr>
        <tr>
          <th scope="row">{{ $t('pages.sources.rows.amelag.name') }}</th>
          <td>
            <a :href="links.cc" class="underline">{{ $t('pages.sources.rows.amelag.licence') }}</a>
          </td>
          <td>{{ $t('pages.sources.rows.amelag.note') }}</td>
        </tr>
        <tr>
          <th scope="row">{{ $t('pages.sources.rows.dwd.name') }}</th>
          <td>
            <a :href="links.dwd" class="underline">{{ $t('pages.sources.rows.dwd.licence') }}</a>
          </td>
          <td>{{ $t('pages.sources.rows.dwd.note') }}</td>
        </tr>
        <tr>
          <th scope="row">{{ $t('pages.sources.rows.bkg.name') }}</th>
          <td>
            <a :href="links.bkg" class="underline">{{ $t('pages.sources.rows.bkg.licence') }}</a>
          </td>
          <td>
            {{ $t('pages.sources.rows.bkg.note') }}
            <a :href="links.bkgSources" class="underline">{{ $t('pages.sources.rows.bkg.link') }}</a>
          </td>
        </tr>
        <tr>
          <th scope="row">{{ $t('pages.sources.rows.geonames.name') }}</th>
          <td>
            <a :href="links.cc" class="underline">{{ $t('pages.sources.rows.geonames.licence') }}</a>
          </td>
          <td>
            {{ $t('pages.sources.rows.geonames.note') }}
            <a :href="links.geonames" class="underline">{{ $t('pages.sources.rows.geonames.link') }}</a>
          </td>
        </tr>
        <tr>
          <th scope="row">{{ $t('pages.sources.rows.holidays.name') }}</th>
          <td>{{ $t('pages.sources.rows.holidays.licence') }}</td>
          <td>{{ $t('pages.sources.rows.holidays.note') }}</td>
        </tr>
      </DocTable>
    </section>

    <section aria-labelledby="sources-not-used">
      <h2 id="sources-not-used" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.sources.notUsedHeading') }}</h2>
      <p>{{ $t('pages.sources.notUsedIntro') }}</p>
      <ul class="list-disc space-y-2 pl-6">
        <li>{{ $t('pages.sources.notUsed.sharealike') }}</li>
        <li>{{ $t('pages.sources.notUsed.search') }}</li>
      </ul>
    </section>

    <section aria-labelledby="sources-caveats">
      <h2 id="sources-caveats" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.sources.caveatsHeading') }}</h2>
      <ul class="list-disc space-y-2 pl-6">
        <li>{{ $t('pages.sources.caveats.retro') }}</li>
        <li>{{ $t('pages.sources.caveats.wastewater') }}</li>
        <li>{{ $t('pages.sources.caveats.withoutWastewater') }}</li>
      </ul>
    </section>
  </article>
</template>
