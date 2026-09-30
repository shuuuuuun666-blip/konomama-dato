# このままだと。

今の習慣を続けた未来と、今日から少し変えた未来の差を数字で見せるWebサービス(MVP)。

## 起動方法(ローカル確認)

ビルド不要。静的ファイルのみ。

```
python -m http.server 8000
```

を `konomama-dato` フォルダ内で実行し、ブラウザで `http://localhost:8000/index.html` を開く。
(ES Modulesを使っているため `file://` では動かない。必ずHTTPサーバー経由で開く)

## 公開方法

`konomama-dato` フォルダの中身をそのまま以下のような無料の静的ホスティングにアップロードするだけで公開できる。

- Cloudflare Pages
- Netlify(ドラッグ&ドロップ)
- GitHub Pages
- Vercel

サーバーサイドの処理は一切ないため、npm install・ビルドコマンドは不要。

## ファイル構成

```
index.html          画面(SPA、5画面をJSで切り替え)
styles.css           スタイル(白背景・大きい数字・装飾少なめ)
js/calc.js           計算ロジック(純粋関数。AI不使用)
js/format.js         表示用フォーマッタ
js/analytics.js      計測イベントのスタブ(console + window.__events)
js/app.js            画面遷移・状態管理・DOM描画
test/calc.test.mjs   Node用ユニットテスト(Node未インストール環境ではtest.htmlを使用)
test/test.html       ブラウザで開くだけで動くユニットテスト
```

## テストの実行

Node.jsがある場合:
```
node test/calc.test.mjs
```

Node.jsがない場合(このプロジェクトの開発機はNode未インストールだった):
`http://localhost:8000/test/test.html` をブラウザで開くと同じテストがページ上で実行され、合否が表示される。
