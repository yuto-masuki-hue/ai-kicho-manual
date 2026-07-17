import React, {useEffect, useState} from 'react';
import Layout from '@theme/Layout';
import {onAuthStateChanged, signInWithPopup, signOut} from 'firebase/auth';
import {httpsCallable} from 'firebase/functions';
import {auth, provider, functions} from '@site/src/firebaseClient';

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [editors, setEditors] = useState([]);
  const [masterAdmins, setMasterAdmins] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  const loadEditors = async () => {
    setLoadError('');
    try {
      const listEditors = httpsCallable(functions, 'listEditors');
      const res = await listEditors();
      setEditors(res.data.editors);
      setMasterAdmins(res.data.masterAdmins);
    } catch (e) {
      setLoadError('取得に失敗しました: ' + e.message);
    }
  };

  useEffect(() => {
    if (user) loadEditors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleLogin = async () => {
    setMessage('');
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      setMessage('ログインに失敗しました: ' + e.message);
    }
  };

  const addEditor = async () => {
    if (!newEmail) return;
    setBusy(true);
    setMessage('');
    try {
      const fn = httpsCallable(functions, 'addEditor');
      await fn({newEmail: newEmail.trim()});
      setNewEmail('');
      await loadEditors();
      setMessage('✅ 追加しました');
    } catch (e) {
      setMessage('❌ 追加に失敗しました: ' + e.message);
    }
    setBusy(false);
  };

  const removeEditor = async (targetEmail) => {
    if (!window.confirm(`${targetEmail} を編集権限から外しますか？`)) return;
    setBusy(true);
    setMessage('');
    try {
      const fn = httpsCallable(functions, 'removeEditor');
      await fn({targetEmail});
      await loadEditors();
      setMessage('✅ 削除しました');
    } catch (e) {
      setMessage('❌ 削除に失敗しました: ' + e.message);
    }
    setBusy(false);
  };

  return (
    <Layout title="設定" description="編集権限の管理">
      <div style={{maxWidth: 720, margin: '40px auto', padding: '0 20px'}}>
        <h1>設定</h1>
        <p style={{color: '#666'}}>
          このマニュアルサイトを編集できるメンバー（Googleアカウント）を管理します。
        </p>

        {authLoading ? (
          <p>読み込み中...</p>
        ) : !user ? (
          <button onClick={handleLogin} className="button button--primary">
            ログインして設定を開く
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

            {loadError && (
              <p style={{color: '#c0392b'}}>
                {loadError}（編集権限が無い可能性があります）
              </p>
            )}

            {!loadError && (
              <>
                <h2>編集権限を持つメンバー</h2>
                <ul>
                  {editors.map((email) => (
                    <li key={email} style={{marginBottom: 8}}>
                      {email}
                      {masterAdmins.includes(email) ? (
                        <span style={{marginLeft: 8, color: '#888'}}>
                          （マスター管理者）
                        </span>
                      ) : (
                        <button
                          onClick={() => removeEditor(email)}
                          disabled={busy}
                          className="button button--sm button--outline button--secondary"
                          style={{marginLeft: 8}}
                        >
                          削除
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                <h3>新しいメンバーを追加</h3>
                <div style={{display: 'flex', gap: 8}}>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="example@yourcompany.com"
                    style={{
                      flex: 1,
                      padding: 8,
                      border: '1px solid #ccc',
                      borderRadius: 4,
                    }}
                  />
                  <button
                    onClick={addEditor}
                    disabled={busy}
                    className="button button--primary"
                  >
                    追加
                  </button>
                </div>
              </>
            )}

            {message && <p style={{marginTop: 16}}>{message}</p>}
          </>
        )}
      </div>
    </Layout>
  );
}
