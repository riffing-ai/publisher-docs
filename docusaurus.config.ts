import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Autobind API Documentation',
  tagline: 'Lead & Call Acquisition API',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://riffing-ai.github.io',
  baseUrl: '/publisher-docs/',

  organizationName: 'riffing-ai',
  projectName: 'publisher-docs',

  onBrokenLinks: 'warn',

  // Block all crawlers
  noIndex: true,

  headTags: [
    {
      tagName: 'meta',
      attributes: {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    },
  ],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Autobind API',
      items: [],
    },
    footer: {
      style: 'dark',
      copyright: `© ${new Date().getFullYear()} Autobind`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
