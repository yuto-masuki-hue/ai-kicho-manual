import React from 'react';
import Link from '@docusaurus/Link';
import BlogListPage from '@theme-original/BlogListPage';

export default function BlogListPageWrapper(props) {
  return (
    <>
      <div
        style={{
          maxWidth: 1140,
          margin: '20px auto 0',
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Link to="/changelog-new" className="button button--primary button--sm">
          ＋ 更新履歴を追加
        </Link>
      </div>
      <BlogListPage {...props} />
    </>
  );
}