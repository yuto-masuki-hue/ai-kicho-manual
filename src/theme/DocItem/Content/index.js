import React, {useState, useEffect, useRef} from 'react';
import Content from '@theme-original/DocItem/Content';
import BrowserOnly from '@docusaurus/BrowserOnly';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import {signInWithPopup, onAuthStateChanged, signOut} from 'firebase/auth';
import {httpsCallable} from 'firebase/functions';
import {auth, provider, functions} from '@site/src/firebaseClient';

// Toast UI EditorはDOM(document)に直接依存するため、
// CSSだけここでトップレベルimportし、JS本体はBrowserOnly内でrequireする。
import '@toast-ui/editor/dist/toastui-editor.css';

const REPO_OWNER = 'yuto-masuki-hue';
const REPO_NAME = 'ai-kicho-manual';
const BRANCH = 'main';

// "---\ntitle: ...\n---\n" のようなfrontmatterブロックと本文を分離する正規表現
const FRONTMATTER_RE = /^(---\n[\s\S]*?\n---\n?)([\s\S]*)$/;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function ContentWrapper(props) {
  const {metadata} = useDoc();
  const filePath = metadata.source.replace(/^@site\//, '');

  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [initialBody, setInitialBody] = useState('');
  const [loadingText, setLoadingText] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const frontmatterRef = useRef('');
  const editorRef = useRef(null);

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
        `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${filePath}?t=${Date.now()}`,
        {cache: 'no-store'}
      );
      if (!res.ok) throw new Error('元ファイルの取得に失敗しました');
      const raw = await res.text();

      const match = raw.match(FRONTMATTER_RE);
      if (match) {
        frontmatterRef.current = match[1];
        setInitialBody(match[2]);
      } else {
        frontmatterRef.current = '';
        setInitialBody(raw);
      }
      setEditing(true);
    } catch (e) {
      setMessage('読み込みに失敗しました: ' + e.message);
    }
    setLoadingText(false);
  };

  const save = async () => {
    if (!editorRef.current) return;
    setSaving(true);
    setMessage('');
    try {
      const markdown = editorRef.current.getInstance().getMarkdown();
      const fullContent = frontmatterRef.current + markdown + '\n';

      const saveEdit = httpsCallable(functions, 'saveEdit');
      await saveEdit({
        filePath,
        content: fullContent,
        pageTitle: metadata.title,
      });
      setMessage('✅ 保存しました。1〜2分後にサイトに反映されます。');
      setEditing(false);
    } catch (e) {
      setMessage('❌ 保存に失敗しました: ' + e.message);
    }
    setSaving(false);
  };

  const addImageBlobHook = async (blob, callback) => {
    setMessage('');
    try {
      const base64 = await blobToBase64(blob);
      const uploadImage = httpsCallable(functions, 'uploadImage');
      const fileName = blob.name || `image-${Date.now()}.png`;
      const res = await uploadImage({fileName, base64Data: base64});
      callback(res.data.path, '画像');
    } catch (err) {
      setMessage('❌ 画像の追加に失敗しました: ' + err.message);
    }
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
          <BrowserOnly fallback={<div>エディタを読み込み中...</div>}>
            {() => {
              const {Editor} = require('@toast-ui/react-editor');
              return (
                <Editor
                  ref={editorRef}
                  initialValue={initialBody || ' '}
                  previewStyle="vertical"
                  height="600px"
                  initialEditType="wysiwyg"
                  useCommandShortcut={true}
                  language="ja-JP"
                  hooks={{addImageBlobHook}}
                  toolbarItems={[
                    ['heading', 'bold', 'italic', 'strike'],
                    ['hr', 'quote'],
                    ['ul', 'ol', 'task', 'indent', 'outdent'],
                    ['table', 'image', 'link'],
                    ['code', 'codeblock'],
                  ]}
                />
              );
            }}
          </BrowserOnly>
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
