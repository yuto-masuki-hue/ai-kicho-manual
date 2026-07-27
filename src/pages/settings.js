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
  const [reordering, setReordering] = useState(false);

  // 新規カテゴリ追加用
  const [newFolder, setNewFolder] = useState('');
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

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

  const moveCategory = async (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= categories.length) return;

    const reordered = [...categories];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    setCategories(reordered);

    setReordering(true);
    setCategoryMessage('');
    try {
      const updateSidebarOrder = httpsCallable(functions, 'updateSidebarOrder');
      await updateSidebarOrder({order: reordered.map((c) => c.folder)});
      setCategoryMessage('✅ 並び順を保存しました。1〜2分後にサイトに反映されます。');
    } catch (e) {
      setCategoryMessage('❌ 並び順の保存に失敗しました: ' + e.message);
      await loadCategories();
    }
    setReordering(false);
  };

  const createCategory = async () => {
    if (!newFolder || !newCategoryLabel) return;
    setCreatingCategory(true);
    setCategoryMessage('');
    try {
      const createSidebarCategory = httpsCallable(functions, 'createSidebarCategory');
      await createSidebarCategory({folder: newFolder.trim(), label: newCategoryLabel.trim()});
      setNewFolder('');
      setNewCategoryLabel('');
      await loadCategories();
      setCategoryMessage('✅ カテゴリを追加しました。1〜2分後にサイトに反映されます。');
    } catch (e) {
      setCategoryMessage('❌ 追加に失敗しました: ' + e.message);
    }
    setCreatingCategory(false);
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
                    {categories.map(({folder, label}, index) => (
                      <li
                        key={folder}
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          marginBottom: 12,
                        }}
                      >
                        <div style={{display: 'flex', flexDirection: 'column', gap: 2}}>
                          <button
                            onClick={() => moveCategory(index, -1)}
                            disabled={reordering || index === 0}
                            className="button button--sm button--outline button--secondary"
                            title="上に移動"
                            style={{padding: '2px 8px', lineHeight: 1}}
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => moveCategory(index, 1)}
                            disabled={reordering || index === categories.length - 1}
                            className="button button--sm button--outline button--secondary"
                            title="下に移動"
                            style={{padding: '2px 8px', lineHeight: 1}}
                          >
                            ▼
                          </button>
                        </div>
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

                <h3 style={{marginTop: 24}}>新しいカテゴリを追加</h3>
                <p style={{color: '#666', fontSize: 14}}>
                  一覧の一番下に追加されます（追加後、並び替えボタンで位置は変更できます）。
                </p>
                <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
                  <input
                    type="text"
                    value={newFolder}
                    onChange={(e) => setNewFolder(e.target.value)}
                    placeholder="フォルダ名（例: new-category、半角英数字とハイフンのみ）"
                    style={{
                      flex: '1 1 260px',
                      padding: 8,
                      border: '1px solid #ccc',
                      borderRadius: 4,
                    }}
                  />
                  <input
                    type="text"
                    value={newCategoryLabel}
                    onChange={(e) => setNewCategoryLabel(e.target.value)}
                    placeholder="表示名（例: 新しいカテゴリ）"
                    style={{
                      flex: '1 1 200px',
                      padding: 8,
                      border: '1px solid #ccc',
                      borderRadius: 4,
                    }}
                  />
                  <button
                    onClick={createCategory}
                    disabled={creatingCategory || !newFolder || !newCategoryLabel}
                    className="button button--primary"
                  >
                    {creatingCategory ? '追加中...' : 'カテゴリを追加'}
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
