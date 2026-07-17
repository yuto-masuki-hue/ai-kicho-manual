import React from 'react';
import Link from '@docusaurus/Link';
import BlogLayout from '@theme-original/BlogLayout';

export default function BlogLayoutWrapper(props) {
  const newProps = {
    ...props,
    children: (
      <>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: 16,
          }}
        >
          <Link
            to="/changelog-new"
            className="button button--primary button--sm"
          >
            ＋ 更新履歴を追加
          </Link>
        </div>
        {props.children}
      </>
    ),
  };
  return <BlogLayout {...newProps} />;
}
