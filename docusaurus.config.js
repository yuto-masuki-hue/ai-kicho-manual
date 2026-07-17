// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'AI記帳ツール マニュアル',
  tagline: '',
  favicon: 'img/logo.png',

  future: {
    v4: true,
  },

  url: 'https://your-project-id.web.app',
  baseUrl: '/',

  organizationName: 'your-org',
  projectName: 'manual-site',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'ja',
    locales: ['ja'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: '/', // マニュアルをそのままトップページにする
          editUrl: undefined, // 「このページを編集」リンクを非表示にする
        },
        blog: {
          routeBasePath: 'changelog', // URLを /changelog に変更
          blogTitle: '更新履歴',
          blogDescription: 'マニュアル・ツールの更新履歴',
          blogSidebarTitle: '更新履歴一覧',
          showReadingTime: false,
          editUrl: undefined,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  plugins: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['ja', 'en'],
        indexDocs: true,
        indexBlog: true,
        indexPages: false,
        docsRouteBasePath: '/',
        blogRouteBasePath: '/changelog',
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/docusaurus-social-card.jpg',
      colorMode: {
        respectPrefersColorScheme: true,
      },
      docs: {
        sidebar: {
          hideable: true, // サイドバーの開閉ボタンを表示
          autoCollapseCategories: true, // カテゴリを開いたら他は自動で閉じる
        },
      },
      navbar: {
        title: 'AI記帳ツール マニュアル',
        logo: {
          alt: 'フジ相続税理士法人',
          src: 'img/logo-440w.webp', // 後で自社ロゴ画像に差し替え可能
        },
        items: [
          {
            to: '/changelog',
            label: '更新履歴',
            position: 'left',
          },
           {
            to: '/settings',
            label: '設定',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [],
        copyright: `Copyright © ${new Date().getFullYear()} AI記帳ツール マニュアル.`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
    }),
};

export default config;