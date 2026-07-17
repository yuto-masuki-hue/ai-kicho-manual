import React, {useState, useEffect} from 'react';
import Content from '@theme-original/DocItem/Content';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import {signInWithPopup, onAuthStateChanged, signOut} from 'firebase/auth';
import {httpsCallable} from 'firebase/functions';
import {auth, provider, functions} from '@site/src/firebaseClient';

const REPO_OWNER = 'yuto-masuki-hue';
const REPO_NAME = 'ai-kicho-manual';
const BRANCH = 'main';

export default function ContentWrapper(props) {
  const {metadata} = useDoc();
  // metadata.source は "@site/docs/xxx.md" の形なので "@site/" を除去
  const filePath = metadata.source.replace(/^@site\//, '');

  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [loadingText, setLoadingText] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const handleLogin = async () => {
    setMessage('');
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      setMessage('ログインに失敗しました: ' + e.message);
    }
  };

  const startEdit = async () => {
    setLoadingText(true);
    setMessage('');
    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${filePath}`
      );
      if (!res.ok) throw new Error('元ファイルの取得に失敗しました');
      const raw = await res.text();
      setText(raw);
      setEditing(true);
    } catch (e) {
      setMessage('読み込みに失敗しました: ' + e.message);
    }
    setLoadingText(false);
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const saveEdit = httpsCallable(functions, 'saveEdit');
      await saveEdit({
        filePath,
        content: text,
        pageTitle: metadata.title,
      });
      setMessage('✅ 保存しました。1〜2分後にサイトに反映されます。');
      setEditing(false);
    } catch (e) {
      setMessage('❌ 保存に失敗しました: ' + e.message);
    }
    setSaving(false);
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        }}
      >
        {!user && (
          <button
            onClick={handleLogin}
            className="button button--sm button--outline button--primary"
          >
            ログインして編集
          </button>
        )}
        {user && !editing && (
          <button
            onClick={startEdit}
            disabled={loadingText}
            className="button button--sm button--primary"
          >
            {loadingText ? '読み込み中...' : '✏️ このページを編集'}
          </button>
        )}
        {user && (
          <button
            onClick={() => signOut(auth)}
            className="button button--sm button--secondary"
          >
            {user.email} をログアウト
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={24}
            style={{
              width: '100%',
              fontFamily: 'monospace',
              fontSize: 14,
              padding: 12,
              boxSizing: 'border-box',
            }}
          />
          <div style={{marginTop: 8, display: 'flex', gap: 8}}>
            <button
              onClick={save}
              disabled={saving}
              className="button button--primary"
            >
              {saving ? '保存中...' : '保存する'}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setMessage('');
              }}
              className="button button--secondary"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <Content {...props} />
      )}

      {message && <p style={{marginTop: 12}}>{message}</p>}
    </div>
  );
}
