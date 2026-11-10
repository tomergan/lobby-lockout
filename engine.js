(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Puzzle = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const BASE = [10, 12, 6, 6, 9, 5, 3, 10, 9];
  const INITIAL = [1, 1, 2, 2, 1, 1, 3, 1, 2];
  const CODE = '182432';
  const fresh = () => ({version: 2, mat: false, coin: false, screws: [false, false],
    hatch: false, rotations: [...INITIAL], power: false, card: false,
    scanned: false, code: '', unlocked: false, complete: false, moves: 0});
  function mask(i, rotation) {
    let m = BASE[i];
    for (let n = 0; n < rotation % 4; n++) m = ((m << 1) & 15) | (m >> 3);
    return m;
  }
  function circuit(rotations) {
    const masks = rotations.map((r, i) => mask(i, r));
    const live = new Set();
    if (masks[0] & 8) live.add(0);
    const queue = [...live];
    const delta = [-3, 1, 3, -1];
    for (let k = 0; k < queue.length; k++) {
      const i = queue[k];
      for (let d = 0; d < 4; d++) {
        if (!(masks[i] & (1 << d))) continue;
        if ((d === 0 && i < 3) || (d === 1 && i % 3 === 2) ||
            (d === 2 && i > 5) || (d === 3 && i % 3 === 0)) continue;
        const j = i + delta[d];
        if ((masks[j] & (1 << ((d + 2) % 4))) && !live.has(j)) {
          live.add(j); queue.push(j);
        }
      }
    }
    return {masks, live: [...live], solved: live.has(2) && !!(masks[2] & 2)};
  }
  function act(s, action, value) {
    const next = JSON.parse(JSON.stringify(s));
    let message = '', effect = 'tap', changed = true;
    const reject = text => { changed = false; message = text; effect = 'deny'; };
    switch (action) {
      case 'mat': next.mat = !s.mat; message = s.mat ? '' : 'Something caught the light.'; effect = 'slide'; break;
      case 'coin':
        if (!s.mat || s.coin || s.hatch) reject('');
        else { next.coin = true; message = 'A brass token.'; effect = 'pickup'; }
        break;
      case 'screw':
        if (!s.coin) reject('Two slotted screws hold the reader cover.');
        else if (s.screws[value]) reject('This screw is already loose.');
        else {
          next.screws[value] = true; effect = 'screw';
          if (next.screws.every(Boolean)) {
            next.hatch = true; next.coin = false; message = 'The reader cover comes away.';
          } else message = 'One screw left.';
        }
        break;
      case 'rotate':
        if (!s.hatch || s.power || !Number.isInteger(value) || value < 0 || value > 8) reject('');
        else {
          next.rotations[value] = (s.rotations[value] + 1) % 4;
          next.power = circuit(next.rotations).solved;
          if (next.power) { message = 'Reader power restored.'; effect = 'power'; }
        }
        break;
      case 'card':
        if (!s.hatch || s.card) reject('');
        else { next.card = true; message = 'A staff card. There are marks on the back.'; effect = 'pickup'; }
        break;
      case 'scan':
        if (!s.power) reject('The reader is silent. Its indicator is dark.');
        else if (!s.card) reject('Present an access card.');
        else { next.scanned = true; message = 'Staff card accepted.'; effect = 'scan'; }
        break;
      case 'digit':
        if (!s.power) reject('The access reader has no power.');
        else if (!s.scanned) reject('Present an access card.');
        else if (!s.unlocked && /^\d$/.test(value)) {
          next.code = (s.code + value).slice(-6);
          if (next.code.length === 6) {
            if (next.code === CODE) {
              next.unlocked = true; message = 'Go to elevator C.'; effect = 'unlock';
            } else { next.code = ''; message = 'Code not recognised.'; effect = 'deny'; }
          }
        } else changed = false;
        break;
      case 'clear': next.code = ''; break;
      case 'backspace': next.code = s.code.slice(0, -1); break;
      case 'enter':
        if (!s.unlocked) reject('The elevator is locked.');
        else { next.complete = true; effect = 'win'; }
        break;
      default: changed = false;
    }
    if (changed) next.moves++;
    return {state: next, message, effect, changed};
  }
  function restore(input) {
    const s = fresh();
    if (!input || input.version !== 2) return s;
    for (const key of ['mat','coin','hatch','card','scanned','complete']) s[key] = input[key] === true;
    if (Array.isArray(input.screws) && input.screws.length === 2) s.screws = input.screws.map(v => v === true);
    s.hatch = s.screws.every(Boolean);
    if (Array.isArray(input.rotations) && input.rotations.length === 9 && input.rotations.every(v => Number.isInteger(v) && v >= 0 && v < 4)) s.rotations = input.rotations;
    s.power = s.hatch && circuit(s.rotations).solved;
    s.card = s.card && s.hatch;
    s.scanned = s.scanned && s.card && s.power;
    s.code = typeof input.code === 'string' && /^\d{0,6}$/.test(input.code) ? input.code : '';
    s.unlocked = s.scanned && s.code === CODE;
    s.complete = s.complete && s.unlocked;
    s.coin = s.coin && !s.hatch;
    s.moves = Number.isInteger(input.moves) && input.moves >= 0 ? input.moves : 0;
    return s;
  }
  return {fresh, act, circuit, mask, restore};
});
