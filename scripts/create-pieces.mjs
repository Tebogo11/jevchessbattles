import { mkdir, writeFile } from "node:fs/promises";

// Original vector set: familiar chess silhouettes cut into angular, neon-edged armor.
const forms = {
  P: '<path d="M34 14h12l5 7v10l-7 6 4 12 7 5v6H25v-6l7-5 4-12-7-6V21z"/><path class="detail" d="M35 23h10M35 31h10M35 44h10"/>',
  R: '<path d="M21 13h10v9h6v-9h6v9h6v-9h10v22l-9 7v12l6 5v3H24v-3l6-5V42l-9-7z"/><path class="detail" d="M30 33h20M36 40v12m8-12v12"/>',
  N: '<path d="m26 12 8 6 10-6 9 12 4 16-7 13 6 7v3H22l1-8 12-14-12 3-5-7 8-14z"/><path class="detail" d="m31 24 10 5-9 7m12-2 5 9-8 13"/><path class="eye" d="m31 25 7 2-4 4-4-1z"/>',
  B: '<path d="m40 9 12 15-1 12-7 8 4 9 7 5v5H25v-5l7-5 4-9-7-8-1-12z"/><path class="detail" d="m44 20-9 13m0 9h10M33 54h14"/>',
  Q: '<path d="m18 21 13 10 9-14 9 14 13-10-6 24-10 8 10 8v3H24v-3l10-8-10-8z"/><path class="detail" d="M26 42h28M33 49h14M32 57h16"/><path class="gem" d="m40 8 5 5-5 5-5-5zM16 13l5 5-5 5-5-5zM64 13l5 5-5 5-5-5z"/>',
  K: '<path d="M36 8h8v7h8v7h-8v7h11l5 11-10 10v5l7 6v3H23v-3l7-6v-5L20 40l5-11h11v-7h-8v-7h8z"/><path class="detail" d="M28 37h24M32 47h16M32 56h16"/>',
};
await mkdir("public/pieces", { recursive: true });
for (const side of ["w", "b"]) {
  const fill = side === "w" ? "#b7f8f0" : "#71384d";
  const line = side === "w" ? "#e2fff9" : "#ff9eae";
  const detail = side === "w" ? "#35726c" : "#ff829b";
  for (const [piece, form] of Object.entries(forms)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><style>.detail{fill:none;stroke:${detail};stroke-width:2.3;stroke-linecap:square}.eye{fill:${side === "w" ? "#133b39" : "#ffeecf"};stroke:none}.gem{fill:${line}}</style><ellipse cx="40" cy="70" rx="25" ry="4" fill="#070d18" opacity=".45"/><g fill="${fill}" stroke="${line}" stroke-width="1.8" stroke-linejoin="miter">${form}<path d="M24 64h32l5 7H19z"/></g></svg>`;
    await writeFile(`public/pieces/${side}${piece}.svg`, svg);
  }
}
