"""PREVIEW1 · check a built preview folder: no writes leave it, keys ignored, noindex, source chip, hint only on a portrait phone.
   python3 scripts/preview/check-preview.py /workspace/preview-out"""
import http.server, threading, functools, json, sys
from playwright.sync_api import sync_playwright
OUT=sys.argv[1] if len(sys.argv)>1 else '/workspace/preview-out'
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=OUT,))
http.server.SimpleHTTPRequestHandler.log_message=lambda *a:None
threading.Thread(target=srv.serve_forever,daemon=True).start()
L=f'http://127.0.0.1:{srv.server_port}/'
res={}
with sync_playwright() as p:
    b=p.chromium.launch()
    for name,vp,mobile in (("wall",(1920,1080),False),("phone",(390,844),True)):
        ctx=b.new_context(viewport={'width':vp[0],'height':vp[1]},is_mobile=mobile,has_touch=mobile)
        ctx.add_init_script("localStorage.setItem('wardos-lights-proxy-token','lights-ABCDEFGHIJKLMNOPQRST'); localStorage.setItem('wardos-lights-proxy','https://example.invalid')")
        pg=ctx.new_page(); reqs=[]
        def route(r, _req=None):
            u=r.request.url
            if not u.startswith(L): reqs.append(r.request.method+' '+u.split('?')[0]); return r.abort()
            if r.request.method!='GET': reqs.append(r.request.method+' '+u); 
            return r.continue_()
        pg.route('**/*',route)
        pg.goto(L+'wall.html',wait_until='load'); pg.wait_for_timeout(2500)
        for sel in ['[data-check]','#w-travel, [data-travel]','[data-kid-checkin]','.who [data-who], .who button','[data-timer-min="5"]']:
            loc=pg.locator(sel).first
            try: loc.click(timeout=1500, force=True); pg.wait_for_timeout(600)
            except Exception as e: pass
        pg.wait_for_timeout(2000)
        forced=pg.evaluate('''async()=>{const o=[];for(const [u,m] of [['/api/taps','POST'],['https://example.invalid/api/sensi/set','POST'],['/api/lights?x=1','GET']]){try{const r=await fetch(u,{method:m,body:m==='POST'?'{}':undefined});o.push(r.status)}catch(e){o.push('err')}}o.push(navigator.sendBeacon?navigator.sendBeacon('/api/taps','{}'):'none');return o}''')
        res[name]={'outbound':sorted(set(reqs)),'blocked':pg.evaluate('window.__previewBlocked||null'),
          'chip':pg.evaluate("(document.getElementById('pv-chip')||{}).textContent||null"),
          'turnVisible':pg.evaluate("(()=>{const t=document.getElementById('pv-turn');return !!t&&getComputedStyle(t).display!=='none'})()"),
          'tokenSeen':pg.evaluate("localStorage.getItem('wardos-lights-proxy-token')"),
          'robots':pg.evaluate("(document.querySelector('meta[name=robots]')||{}).content||null"),
          'needKey':pg.evaluate("/NEED (KEY|TOKEN)/.test(document.body.innerText)"),'forced':forced}
        ctx.close()
    b.close()
print(json.dumps(res,indent=1))
bad=[]
for n,r in res.items():
    for u in r['outbound']:
        if not u.startswith('GET https://dmward23-web.github.io/wardos-house-face/data/'): bad.append(f'{n}: outbound {u}')
    if r['blocked'] is None: bad.append(f'{n}: guard not loaded')
    if r['tokenSeen'] is not None: bad.append(f'{n}: hub key readable')
    if r['robots']!='noindex,nofollow': bad.append(f'{n}: robots meta')
    if not r['chip'] or 'read only' not in r['chip']: bad.append(f'{n}: no source chip')
    if r['needKey']: bad.append(f'{n}: NEED KEY painted')
    if r['forced'][:3]!=[403,403,403] or r['forced'][3] is not False: bad.append(f'{n}: forced writes not refused {r["forced"]}')
if res['wall']['turnVisible']: bad.append('wall: turn-sideways hint shows on a landscape wall')
if not res['phone']['turnVisible']: bad.append('phone: no turn-sideways hint in portrait')
print('PREVIEW CHECK ' + ('PASS' if not bad else 'FAIL\n  ' + '\n  '.join(bad)))
sys.exit(1 if bad else 0)
