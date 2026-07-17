import React, {useEffect, useState} from 'react';
import Layout from '@theme/Layout';
import {onAuthStateChanged, signInWithPopup, signOut} from 'firebase/auth';
import {httpsCallable} from 'firebase/functions';
import {auth, provider, functions} from '@site/src/firebaseClient';

export default function NewChangelogPage() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  const handleLogin = async () => {
    setMessage('');
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      setMessage('ログインに失敗しました: ' + e.message);
    }
  };

  const submit = async () => {
    if (!title || !body) {
      setMessage('タイトルと本文を入力してください');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const fn = httpsCallable(functions, 'addChangelogEntry');
      await fn({title, body});
      setMessage('✅ 追加しました。1〜2分後に更新履歴ページに反映されます。');
      setTitle('');
      setBody('');
    } catch (e) {
      setMessage('❌ 追加に失敗しました: ' + e.message);
    }
    setBusy(false);
  };

  return (
    <Layout title="更新履歴を追加" description="更新履歴の新規投稿">
      <div style={{maxWidth: 720, margin: '40px auto', padding: '0 20px'}}>
        <h1>更新履歴を追加</h1>
        <p style={{color: '#666'}}>
          ページの編集以外で、お知らせしたい更新内容を手動で投稿できます。
        </p>

        {authLoading ? (
          <p>読み込み中...</p>
        ) : !user ? (
          <button onClick={handleLogin} className="button button--primary">
            ログインして投稿する
          </button>
        ) : (
          <>
            <p>
              ログイン中: <strong>{user.email}</strong>{' '}
              <button
                onClick={() => signOut(auth)}
                className="button button--sm button--secondary"
              >
                ログアウト
              </button>
            </p>

            <div style={{marginBottom: 12}}>
              <label>タイトル</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: 8,
                  marginTop: 4,
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{marginBottom: 12}}>
              <label>内容</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                style={{
                  width: '100%',
                  padding: 8,
                  marginTop: 4,
                  fontFamily: 'inherit',
                  border: '1px solid #ccc',
                  borderRadius: 4,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              onClick={submit}
              disabled={busy}
              className="button button--primary"
            >
              {busy ? '投稿中...' : '投稿する'}
            </button>

            {message && <p style={{marginTop: 16}}>{message}</p>}
          </>
        )}
      </div>
    </Layout>
  );
}
