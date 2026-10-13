<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { pageHref } from '../../scripts/pages';
import { REPO_URL } from '../site-config';
import type { PageContext } from '../types';

const GITHUB_PRIVACY = 'https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement';

export default defineComponent({
  name: 'LegalPage',
  props: { ctx: { type: Object as PropType<PageContext>, required: true } },
  computed: {
    sourcesHref(): string {
      return pageHref(this.ctx.entry.path, { page: 'sources', locale: this.ctx.locale });
    },
    repoUrl(): string {
      return REPO_URL;
    },
    privacyUrl(): string {
      return GITHUB_PRIVACY;
    },
  },
});
</script>

<template>
  <article class="space-y-2">
    <h1 class="text-2xl font-bold">{{ $t('pages.legal.heading') }}</h1>

    <section aria-labelledby="l-disclaimer">
      <h2 id="l-disclaimer" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.legal.disclaimerHeading') }}</h2>
      <ul class="list-disc space-y-2 pl-6">
        <li>{{ $t('pages.legal.disclaimer.notOfficial') }}</li>
        <li>{{ $t('pages.legal.disclaimer.estimate') }}</li>
        <li>{{ $t('pages.legal.disclaimer.thirdParty') }}</li>
      </ul>
    </section>

    <section aria-labelledby="l-medical">
      <h2 id="l-medical" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.legal.medicalHeading') }}</h2>
      <p>{{ $t('pages.legal.medicalText') }}</p>
    </section>

    <section aria-labelledby="l-privacy">
      <h2 id="l-privacy" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.legal.privacyHeading') }}</h2>
      <ul class="list-disc space-y-2 pl-6">
        <li>{{ $t('pages.legal.privacy.noCookies') }}</li>
        <li>{{ $t('pages.legal.privacy.local') }}</li>
        <li>
          {{ $t('pages.legal.privacy.host') }}
          <a :href="privacyUrl" class="underline">{{ $t('pages.legal.privacy.hostLink') }}</a>
        </li>
      </ul>
    </section>

    <section aria-labelledby="l-operator">
      <h2 id="l-operator" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.legal.operatorHeading') }}</h2>
      <p>
        {{ $t('pages.legal.operatorText') }}
        <a :href="repoUrl" class="underline">{{ $t('pages.legal.operatorLink') }}</a>
      </p>
    </section>

    <section aria-labelledby="l-licence">
      <h2 id="l-licence" class="mt-8 mb-3 text-xl font-semibold">{{ $t('pages.legal.licenceHeading') }}</h2>
      <p>
        {{ $t('pages.legal.licenceText') }}
        <a :href="sourcesHref" class="underline">{{ $t('pages.legal.licenceLink') }}</a>.
      </p>
    </section>
  </article>
</template>
