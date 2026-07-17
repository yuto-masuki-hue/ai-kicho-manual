const sidebars = {
  manualSidebar: [
    {
      type: 'doc',
      id: 'index',
      label: '📖 マニュアル目次',
    },
    {
      type: 'category',
      label: 'ツールの初期設定',
      link: { type: 'generated-index' },
      items: ['initial-setup/m1-google-drive', 'initial-setup/m2-mf-client-setup', 'initial-setup/m3-gemini-api-key'],
    },
    {
      type: 'category',
      label: '担当者・ユーザー管理',
      link: { type: 'generated-index' },
      items: ['user-management/m10-register-user', 'user-management/m11-save-credentials', 'user-management/m12-check-clients'],
    },
    {
      type: 'category',
      label: '顧問先管理',
      link: { type: 'generated-index' },
      items: ['client-management/m20-register-client', 'client-management/m21-create-folders', 'client-management/m22-mf-oauth', 'client-management/m23-payment-methods'],
    },
    {
      type: 'category',
      label: '証憑回収（Webアップローダー）',
      link: { type: 'generated-index' },
      items: ['web-uploader/m30-issue-url', 'web-uploader/m31-client-upload', 'web-uploader/m32-office-upload', 'web-uploader/m33-upload-history'],
    },
    {
      type: 'category',
      label: 'AI証憑読取（OCR実行）',
      link: { type: 'generated-index' },
      items: ['ocr-execution/m40-batch-ocr', 'ocr-execution/m41-folder-flow', 'ocr-execution/m42-error-retry'],
    },
    {
      type: 'category',
      label: '読取結果（明細）管理',
      link: { type: 'generated-index' },
      items: ['detail-management/m50-sheet-overview', 'detail-management/m51-edit-details', 'detail-management/m52-check-original'],
    },
    {
      type: 'category',
      label: 'MoneyForwardとの連携',
      link: { type: 'generated-index' },
      items: ['mf-integration/m60-send-selected', 'mf-integration/m61-send-all', 'mf-integration/m62-account-mapping'],
    },
    {
      type: 'category',
      label: 'ツールの機能',
      link: { type: 'generated-index' },
      items: ['tool-features/m70-dashboard', 'tool-features/m71-menu-ocr'],
    },
  ],
};

export default sidebars;