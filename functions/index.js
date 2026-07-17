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

function githubHeaders(token) {
  return {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "User-Agent": "ai-kicho-manual-editor",
    "Content-Type": "application/json",
  };
}

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
title: "${(pageTitle || filePath).replace(/"/g, "'")} を更新しました"
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
title: "${title.replace(/"/g, "'")}"
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
