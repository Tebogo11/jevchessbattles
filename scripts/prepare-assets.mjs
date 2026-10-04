import { copyFile, mkdir } from "node:fs/promises";

await mkdir("public/vendor", { recursive: true });
await mkdir("src/app/fonts", { recursive: true });
for (const [from, to] of [
  ["node_modules/jquery/dist/jquery.min.js", "public/vendor/jquery.min.js"],
  ["node_modules/@chrisoakman/chessboardjs/dist/chessboard-1.0.0.min.js", "public/vendor/chessboard.min.js"],
  ["node_modules/@chrisoakman/chessboardjs/LICENSE.md", "public/vendor/chessboard-LICENSE.md"],
  ["node_modules/jquery/LICENSE.txt", "public/vendor/jquery-LICENSE.txt"],
  ["node_modules/@fontsource/rajdhani/files/rajdhani-latin-600-normal.woff2", "src/app/fonts/rajdhani.woff2"],
  ["node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2", "src/app/fonts/space-grotesk.woff2"],
]) await copyFile(from, to);
