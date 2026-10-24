import test from 'node:test';import assert from 'node:assert';import fs from 'node:fs';
const css=fs.readFileSync(new URL('../../wg-spook.css',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../../wg-spook.js',import.meta.url),'utf8');
const rule=(css.match(/\.wg-spook \.sp-ghostv \{[^}]*\}/)||[''])[0];
test('ghost clip is a masked sprite, never full-frame',()=>{assert.ok(rule);assert.doesNotMatch(rule,/inset:\s*0/);assert.match(rule,/mask-image/);assert.doesNotMatch(rule,/width:\s*100%/);assert.match(rule,/contrast\(/)});
test('spook js never touches plate or scene background',()=>{assert.doesNotMatch(js,/backgroundImage|\.wg-plate|night52|__fire|ENV\.|weather/i)});
test('fog band has a masked soft top edge',()=>{const f=fs.readFileSync(new URL('../../livinghouse/amb-fog-soft.css',import.meta.url),'utf8');assert.match(f,/mask-image: linear-gradient\(to top/);assert.match(f,/blur\(/);assert.ok((f.match(/radial-gradient/g)||[]).length>=4)});
