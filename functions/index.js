const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const GITHUB_TOKEN = defineSecret("GITHUB_TOKEN");

// このメールアドレスは常に編集・設定変更権限を持つ「マスター管理者」です。
// 万が一Firestoreの設定を全員消してしまっても、ここに書かれた人はロックアウトされません。
const MASTER_ADMINS = [
  "yuto-masuki@funaisoken.co.jp",
];

const REPO_OWNER = "yuto-masuki-hue";
const REPO_NAME = "ai-kicho-manual";
const BRANCH = "main";

// フォルダ名(スラッグ)として許可する形式。英小文字・数字・ハイフンのみ。
const FOLDER_SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * 指定したメールアドレスが編集権限を持つか判定する
 * @param {string} email 判定したいメールアドレス
 * @return {Promise<boolean>} 権限があればtrue
 */
async function isEditor(email) {
  if (MASTER_ADMINS.includes(email)) return true;
  const doc = await db.collection("editors").doc(email).get();
  return doc.exists;
}

/**
 * GitHub APIリクエスト用の共通ヘッダーを作成する
 * @param {string} token GitHubのアクセストークン
 * @return {object} リクエストヘッダー
 */

function githubHeaders(token) {
  return {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "User-Agent": "ai-kicho-manual-editor",
    "Content-Type": "application/json",
  };
}

/**
 * YAMLのダブルクォート文字列として安全な形にエスケープする。
 * バックスラッシュを先にエスケープしないと、ダブルクォートのエスケープと
 * 衝突して不正なエスケープシーケンスになってしまう。
 * @param {string} str エスケープしたい文字列
 * @return {string} YAML内で安全な文字列
 */
function escapeYamlString(str) {
  return String(str)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, " ");
}

const SIDEBAR_ORDER_PATH = "data/sidebar-order.json";

/**
 * data/sidebar-order.json を取得する（カテゴリ一覧の「正」データ）
 * @param {string} token GitHubのアクセストークン
 * @return {Promise<{order: string[], sha: string}>} 現在の並び順とファイルのsha
 */
async function getSidebarOrder(token) {
  const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
  const headers = githubHeaders(token);
  const res = await fetch(
      `${apiBase}/contents/${SIDEBAR_ORDER_PATH}?ref=${BRANCH}`,
      {headers, cache: "no-store"},
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new HttpsError(
        "internal", `並び順ファイルの取得に失敗しました: ${errText}`,
    );
  }
  const fileData = await res.json();
  const order = JSON.parse(
      Buffer.from(fileData.content, "base64").toString("utf-8"),
  );
  return {order, sha: fileData.sha};
}

/**
 * data/sidebar-order.json を書き換える
 * @param {string} token GitHubのアクセストークン
 * @param {string[]} order 新しい並び順
 * @param {string} sha 更新前のファイルのsha
 * @param {string} message コミットメッセージ
 * @return {Promise<void>}
 */
async function putSidebarOrder(token, order, sha, message) {
  const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
  const headers = githubHeaders(token);
  const content = JSON.stringify(order, null, 2) + "\n";
  const res = await fetch(`${apiBase}/contents/${SIDEBAR_ORDER_PATH}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf-8").toString("base64"),
      sha,
      branch: BRANCH,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new HttpsError("internal", `並び順の更新に失敗しました: ${errText}`);
  }
}

// ========================================
// サイドバーのカテゴリ名一覧を取得
// ========================================
exports.getSidebarCategories = onCall(
    {secrets: [GITHUB_TOKEN], region: "asia-northeast1"},
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "ログインが必要です");
      }
      const email = request.auth.token.email;
      if (!(await isEditor(email))) {
        throw new HttpsError("permission-denied", "編集権限がありません");
      }

      const token = GITHUB_TOKEN.value();
      const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
      const headers = githubHeaders(token);

      const {order} = await getSidebarOrder(token);

      const categories = await Promise.all(
          order.map(async (folder) => {
            const filePath = `docs/${folder}/_category_.json`;
            const res = await fetch(
                `${apiBase}/contents/${filePath}?ref=${BRANCH}`,
                {headers, cache: "no-store"},
            );
            if (!res.ok) {
              return {folder, label: "(取得失敗)"};
            }
            const fileData = await res.json();
            const content = Buffer.from(
                fileData.content, "base64",
            ).toString("utf-8");
            const json = JSON.parse(content);
            return {folder, label: json.label || ""};
          }),
      );

      return {categories};
    },
);

// ========================================
// サイドバーのカテゴリ名を更新
// ========================================
exports.updateSidebarCategoryLabel = onCall(
    {secrets: [GITHUB_TOKEN], region: "asia-northeast1"},
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "ログインが必要です");
      }
      const email = request.auth.token.email;
      if (!(await isEditor(email))) {
        throw new HttpsError("permission-denied", "編集権限がありません");
      }

      const {folder, label} = request.data;
      if (!folder || !label || typeof label !== "string") {
        throw new HttpsError("invalid-argument", "パラメータが不正です");
      }

      const token = GITHUB_TOKEN.value();
      const {order} = await getSidebarOrder(token);
      if (!order.includes(folder)) {
        throw new HttpsError("invalid-argument", "不正なカテゴリです");
      }

      const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
      const headers = githubHeaders(token);
      const filePath = `docs/${folder}/_category_.json`;

      const getRes = await fetch(
          `${apiBase}/contents/${filePath}?ref=${BRANCH}`,
          {headers, cache: "no-store"},
      );
      if (!getRes.ok) {
        const errText = await getRes.text();
        throw new HttpsError(
            "internal", `元ファイルの取得に失敗しました: ${errText}`,
        );
      }
      const fileData = await getRes.json();
      const currentJson = JSON.parse(
          Buffer.from(fileData.content, "base64").toString("utf-8"),
      );

      // labelだけを書き換え、position・linkなど他の項目はそのまま保持する
      const updatedJson = {...currentJson, label};
      const newContent = JSON.stringify(updatedJson, null, 2) + "\n";

      const putRes = await fetch(`${apiBase}/contents/${filePath}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `docs: ${folder} のカテゴリ名を「${label}」に変更 (by ${email})`,
          content: Buffer.from(newContent, "utf-8").toString("base64"),
          sha: fileData.sha,
          branch: BRANCH,
        }),
      });
      if (!putRes.ok) {
        const errText = await putRes.text();
        throw new HttpsError("internal", `更新に失敗しました: ${errText}`);
      }

      return {success: true};
    },
);

// ========================================
// サイドバーのカテゴリ並び順を変更
// ========================================
exports.updateSidebarOrder = onCall(
    {secrets: [GITHUB_TOKEN], region: "asia-northeast1"},
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "ログインが必要です");
      }
      const email = request.auth.token.email;
      if (!(await isEditor(email))) {
        throw new HttpsError("permission-denied", "編集権限がありません");
      }

      const {order: newOrder} = request.data;
      if (!Array.isArray(newOrder) || newOrder.length === 0) {
        throw new HttpsError("invalid-argument", "パラメータが不正です");
      }

      const token = GITHUB_TOKEN.value();
      const {order: currentOrder, sha} = await getSidebarOrder(token);

      // 中身の集合が現在と完全に一致する場合のみ許可する
      // (追加・削除は別の関数で行う。並び替えのみここで許可)
      const sortedCurrent = [...currentOrder].sort();
      const sortedNew = [...newOrder].sort();
      const isSameSet =
        sortedCurrent.length === sortedNew.length &&
        sortedCurrent.every((v, i) => v === sortedNew[i]);
      if (!isSameSet) {
        throw new HttpsError(
            "invalid-argument",
            "カテゴリの構成が変わっています（追加・削除はできません）",
        );
      }

      await putSidebarOrder(
          token, newOrder, sha,
          `docs: サイドバーのカテゴリ並び順を変更 (by ${email})`,
      );

      return {success: true};
    },
);

// ========================================
// 新しいカテゴリを追加
// ========================================
exports.createSidebarCategory = onCall(
    {secrets: [GITHUB_TOKEN], region: "asia-northeast1"},
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "ログインが必要です");
      }
      const email = request.auth.token.email;
      if (!(await isEditor(email))) {
        throw new HttpsError("permission-denied", "編集権限がありません");
      }

      const {folder, label} = request.data;
      if (!folder || !label) {
        throw new HttpsError("invalid-argument", "パラメータが不正です");
      }
      if (!FOLDER_SLUG_RE.test(folder)) {
        throw new HttpsError(
            "invalid-argument",
            "フォルダ名は半角英小文字・数字・ハイフンのみ使用できます",
        );
      }

      const token = GITHUB_TOKEN.value();
      const {order: currentOrder, sha} = await getSidebarOrder(token);
      if (currentOrder.includes(folder)) {
        throw new HttpsError(
            "already-exists", "同じ名前のカテゴリが既にあります",
        );
      }

      const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
      const headers = githubHeaders(token);

      // 1. _category_.json を作成
      const categoryJson = {
        label,
        position: currentOrder.length + 1,
        link: {
          type: "generated-index",
          description: "",
        },
      };
      const categoryContent = JSON.stringify(categoryJson, null, 2) + "\n";
      const categoryRes = await fetch(
          `${apiBase}/contents/docs/${folder}/_category_.json`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify({
              message: `docs: 新しいカテゴリ「${label}」を追加 (by ${email})`,
              content: Buffer.from(categoryContent, "utf-8").toString(
                  "base64",
              ),
              branch: BRANCH,
            }),
          },
      );
      if (!categoryRes.ok) {
        const errText = await categoryRes.text();
        throw new HttpsError(
            "internal", `カテゴリの作成に失敗しました: ${errText}`,
        );
      }

      // 2. 空にならないよう、プレースホルダーのページを1つ作成
      const pageContent = `---
title: ${label}
sidebar_position: 1
---

# ${label}

ここに本文を書いてください。
`;
      const pageRes = await fetch(
          `${apiBase}/contents/docs/${folder}/getting-started.md`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify({
              message: `docs: ${label} に最初のページを追加 (by ${email})`,
              content: Buffer.from(pageContent, "utf-8").toString("base64"),
              branch: BRANCH,
            }),
          },
      );
      if (!pageRes.ok) {
        const errText = await pageRes.text();
        throw new HttpsError(
            "internal", `ページの作成に失敗しました: ${errText}`,
        );
      }

      // 3. 並び順の一覧に新しいカテゴリを追加(末尾)
      const newOrder = [...currentOrder, folder];
      await putSidebarOrder(
          token, newOrder, sha,
          `docs: サイドバーに「${label}」を追加 (by ${email})`,
      );

      return {success: true};
    },
);

// ========================================
// ページ本文の編集
// ========================================
exports.saveEdit = onCall(
    {secrets: [GITHUB_TOKEN], region: "asia-northeast1"},
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "ログインが必要です");
      }

      const email = request.auth.token.email;
      if (!(await isEditor(email))) {
        throw new HttpsError("permission-denied", "編集権限がありません");
      }

      const {filePath, content, pageTitle} = request.data;

      if (!filePath || typeof content !== "string") {
        throw new HttpsError("invalid-argument", "パラメータが不正です");
      }
      if (!filePath.startsWith("docs/") || filePath.includes("..")) {
        throw new HttpsError("invalid-argument", "不正なファイルパスです");
      }

      const token = GITHUB_TOKEN.value();
      const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
      const headers = githubHeaders(token);

      const getRes = await fetch(
          `${apiBase}/contents/${filePath}?ref=${BRANCH}`,
          {headers},
      );
      if (!getRes.ok) {
        const errText = await getRes.text();
        throw new HttpsError(
            "internal",
            `元ファイルの取得に失敗しました (status:${getRes.status}) ` +
            `path:${filePath} / ${errText}`,
        );
      }
      const fileData = await getRes.json();

      const putRes = await fetch(`${apiBase}/contents/${filePath}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `docs: ${filePath} を更新 (by ${email})`,
          content: Buffer.from(content, "utf-8").toString("base64"),
          sha: fileData.sha,
          branch: BRANCH,
        }),
      });
      if (!putRes.ok) {
        const errText = await putRes.text();
        throw new HttpsError("internal", `更新に失敗しました: ${errText}`);
      }

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const slug = filePath
          .replace("docs/", "")
          .replace(/\.mdx?$/, "")
          .replace(/\//g, "-");
      const changelogPath =
        `blog/${dateStr}-edit-${slug}-${now.getTime()}.md`;
      const changelogBody = `---
title: "${escapeYamlString(pageTitle || filePath)} を更新しました"
date: ${now.toISOString()}
authors: []
---

${email} が「${pageTitle || filePath}」を更新しました。
`;

      await fetch(`${apiBase}/contents/${changelogPath}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `changelog: ${pageTitle || filePath} の更新履歴を追加`,
          content: Buffer.from(changelogBody, "utf-8").toString("base64"),
          branch: BRANCH,
        }),
      });

      return {success: true};
    },
);

// ========================================
// 更新履歴の手動投稿
// ========================================
exports.addChangelogEntry = onCall(
    {secrets: [GITHUB_TOKEN], region: "asia-northeast1"},
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "ログインが必要です");
      }
      const email = request.auth.token.email;
      if (!(await isEditor(email))) {
        throw new HttpsError("permission-denied", "編集権限がありません");
      }

      const {title, body} = request.data;
      if (!title || !body) {
        throw new HttpsError("invalid-argument", "タイトルと本文は必須です");
      }

      const token = GITHUB_TOKEN.value();
      const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
      const headers = githubHeaders(token);

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const slug =
        title
            .replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龠ー\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-")
            .slice(0, 50) || "update";
      const changelogPath = `blog/${dateStr}-${slug}-${now.getTime()}.md`;
      const changelogBody = `---
title: "${escapeYamlString(title)}"
date: ${now.toISOString()}
authors: []
---

${body}
`;

      const putRes = await fetch(`${apiBase}/contents/${changelogPath}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `changelog: ${title} を追加 (by ${email})`,
          content: Buffer.from(changelogBody, "utf-8").toString("base64"),
          branch: BRANCH,
        }),
      });
      if (!putRes.ok) {
        const errText = await putRes.text();
        throw new HttpsError(
            "internal", `更新履歴の追加に失敗しました: ${errText}`,
        );
      }

      return {success: true};
    },
);

// ========================================
// 編集権限メンバーの一覧取得
// ========================================
exports.listEditors = onCall(
    {region: "asia-northeast1"},
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "ログインが必要です");
      }
      const email = request.auth.token.email;
      if (!(await isEditor(email))) {
        throw new HttpsError("permission-denied", "権限がありません");
      }

      const snapshot = await db.collection("editors").get();
      const emails = snapshot.docs.map((d) => d.id);
      const all = Array.from(new Set([...MASTER_ADMINS, ...emails])).sort();

      return {editors: all, masterAdmins: MASTER_ADMINS};
    },
);

// ========================================
// 編集権限メンバーの追加
// ========================================
exports.addEditor = onCall(
    {region: "asia-northeast1"},
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "ログインが必要です");
      }
      const email = request.auth.token.email;
      if (!(await isEditor(email))) {
        throw new HttpsError("permission-denied", "権限がありません");
      }

      const {newEmail} = request.data;
      if (
        !newEmail ||
        typeof newEmail !== "string" ||
        !newEmail.includes("@")
      ) {
        throw new HttpsError("invalid-argument", "メールアドレスが不正です");
      }

      await db.collection("editors").doc(newEmail.trim()).set({
        addedBy: email,
        addedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {success: true};
    },
);

// ========================================
// 編集権限メンバーの削除
// ========================================
exports.removeEditor = onCall(
    {region: "asia-northeast1"},
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "ログインが必要です");
      }
      const email = request.auth.token.email;
      if (!(await isEditor(email))) {
        throw new HttpsError("permission-denied", "権限がありません");
      }

      const {targetEmail} = request.data;
      if (!targetEmail) {
        throw new HttpsError("invalid-argument", "対象が指定されていません");
      }
      if (MASTER_ADMINS.includes(targetEmail)) {
        throw new HttpsError(
            "failed-precondition", "マスター管理者は削除できません",
        );
      }

      await db.collection("editors").doc(targetEmail).delete();
      return {success: true};
    },
);
// ========================================
// 画像のアップロード
// ========================================
exports.uploadImage = onCall(
    {secrets: [GITHUB_TOKEN], region: "asia-northeast1"},
    async (request) => {
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "ログインが必要です");
      }
      const email = request.auth.token.email;
      if (!(await isEditor(email))) {
        throw new HttpsError("permission-denied", "編集権限がありません");
      }

      const {fileName, base64Data} = request.data;
      if (!fileName || !base64Data) {
        throw new HttpsError("invalid-argument", "パラメータが不正です");
      }

      // ファイル名の安全化（英数字・.・-・_のみ許可）
      const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const uploadFileName = `${Date.now()}-${safeName}`;
      const path = `static/img/uploads/${uploadFileName}`;

      const token = GITHUB_TOKEN.value();
      const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
      const headers = githubHeaders(token);

      const putRes = await fetch(`${apiBase}/contents/${path}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `docs: 画像を追加 ${path} (by ${email})`,
          content: base64Data,
          branch: BRANCH,
        }),
      });

      if (!putRes.ok) {
        const errText = await putRes.text();
        throw new HttpsError(
            "internal", `画像のアップロードに失敗しました: ${errText}`,
        );
      }

      // Docusaurusのstatic配下は "/img/uploads/xxx" というURLで公開される
      const publicPath = `/img/uploads/${Date.now()}-${safeName}`;
      return {success: true, path: `/img/uploads/${safeName}`, fullPath: publicPath};
    },
);
