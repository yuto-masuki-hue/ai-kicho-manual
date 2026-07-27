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

  // サイドバーのカテゴリ名編集用
  const [categories, setCategories] = useState([]);
  const [categoryLoadError, setCategoryLoadError] = useState('');
  const [savingFolder, setSavingFolder] = useState('');
  const [categoryMessage, setCategoryMessage] = useState('');

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
    if (user) {
      loadEditors();
      loadCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadCategories = async () => {
    setCategoryLoadError('');
    try {
      const getSidebarCategories = httpsCallable(functions, 'getSidebarCategories');
      const res = await getSidebarCategories();
      setCategories(res.data.categories);
    } catch (e) {
      setCategoryLoadError('取得に失敗しました: ' + e.message);
    }
  };

  const handleCategoryLabelChange = (folder, newLabel) => {
    setCategories((prev) =>
      prev.map((c) => (c.folder === folder ? {...c, label: newLabel} : c))
    );
  };

  const saveCategoryLabel = async (folder, label) => {
    setSavingFolder(folder);
    setCategoryMessage('');
    try {
      const updateSidebarCategoryLabel = httpsCallable(functions, 'updateSidebarCategoryLabel');
      await updateSidebarCategoryLabel({folder, label});
      setCategoryMessage('✅ 保存しました。1〜2分後にサイトに反映されます。');
    } catch (e) {
      setCategoryMessage('❌ 保存に失敗しました: ' + e.message);
    }
    setSavingFolder('');
  };

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

                <hr style={{margin: '32px 0'}} />

                <h2>左メニューの項目名を編集</h2>
                <p style={{color: '#666'}}>
                  サイドバーに表示されているカテゴリ名を変更できます（ページの並び順や中身は変わりません）。
                </p>

                {categoryLoadError && (
                  <p style={{color: '#c0392b'}}>{categoryLoadError}</p>
                )}

                {!categoryLoadError && (
                  <ul style={{listStyle: 'none', padding: 0}}>
                    {categories.map(({folder, label}) => (
                      <li
                        key={folder}
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          marginBottom: 12,
                        }}
                      >
                        <input
                          type="text"
                          value={label}
                          onChange={(e) =>
                            handleCategoryLabelChange(folder, e.target.value)
                          }
                          style={{
                            flex: 1,
                            padding: 8,
                            border: '1px solid #ccc',
                            borderRadius: 4,
                          }}
                        />
                        <button
                          onClick={() => saveCategoryLabel(folder, label)}
                          disabled={savingFolder === folder}
                          className="button button--sm button--primary"
                        >
                          {savingFolder === folder ? '保存中...' : '保存'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {categoryMessage && <p style={{marginTop: 8}}>{categoryMessage}</p>}
              </>
            )}

            {message && <p style={{marginTop: 16}}>{message}</p>}
          </>
        )}
      </div>
    </Layout>
  );
}
