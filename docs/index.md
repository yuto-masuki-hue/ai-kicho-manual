
---
slug: /
title: マニュアル目次
---

# AI記帳ツール マニュアル

証憑の読み取りからMoneyForwardへの連携まで、AI記帳ツールの操作手順をまとめています。左のメニュー、または以下の目次からご覧ください。

## ツールの初期設定
- [Googleドライブの初期設定](./initial-setup/m1-google-drive)
- [MoneyForward連携の初期設定（Client ID/Secret発行）](./initial-setup/m2-mf-client-setup)
- [Gemini APIキーの設定](./initial-setup/m3-gemini-api-key)

## 担当者・ユーザー管理
- [担当者（ユーザー）を登録する](./user-management/m10-register-user)
- [担当者ごとのAPIキー・MF認証情報を保存する](./user-management/m11-save-credentials)
- [担当顧問先の一覧を確認する](./user-management/m12-check-clients)

## 顧問先管理
- [顧問先（事業所リスト）を新規登録する](./client-management/m20-register-client)
- [顧問先フォルダを一括作成する（5階層構成）](./client-management/m21-create-folders)
- [MoneyForwardと顧問先を連携する（OAuth認可）](./client-management/m22-mf-oauth)
- [顧問先別の決済手段（登録サービス）を設定する](./client-management/m23-payment-methods)

![画像](/img/uploads/favicon-180.png)

## 証憑回収（Webアップローダー）
- [顧問先用アップロードURLを発行する](./web-uploader/m30-issue-url)
- [顧問先がWebから証憑をアップロードする](./web-uploader/m31-client-upload)
- [事務所が証憑をアップロードする（カテゴリ・支払方法を指定）](./web-uploader/m32-office-upload)
- [アップロード履歴を確認する](./web-uploader/m33-upload-history)

## AI証憑読取（OCR実行）
- [領収書を一括でAI読み取りする](./ocr-execution/m40-batch-ocr)
- [AI読み取りの処理フロー（フォルダ移動ルール）を理解する](./ocr-execution/m41-folder-flow)
- [読み取りエラーを確認・再処理する](./ocr-execution/m42-error-retry)

## 読取結果（明細）管理
- [明細登録シートの見方](./detail-management/m50-sheet-overview)
- [明細を確認・修正する](./detail-management/m51-edit-details)
- [元ファイル（証憑画像）を確認する](./detail-management/m52-check-original)

## MoneyForwardとの連携
- [選択した顧問先の明細をMFへ送信する](./mf-integration/m60-send-selected)
- [未送信明細を一括送信する](./mf-integration/m61-send-all)
- [MFの接続アカウントと支払方法の紐付け仕様を理解する](./mf-integration/m62-account-mapping)

## ツールの機能
- [担当者別進捗ダッシュボードを確認する](./tool-features/m70-dashboard)
- [メニューからAI読み取りを実行する](./tool-features/m71-menu-ocr)