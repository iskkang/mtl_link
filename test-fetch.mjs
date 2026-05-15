import { fetch } from 'undici';
fetch('https://my.fesco.com/api/v2/lk/user/login', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({usernameOrEmail:'mtlrus@mtlb.co.kr', password:'mtl@2019', safeDevice:false, personalData:false, sessionId:null, browser:'{"name":"chrome","version":"131.0.0","os":"Windows 10","type":"browser"}'}),
  dispatcher: new (await import('undici')).Agent({ connectTimeout: 30000 })
}).then(r=>r.text()).then(console.log).catch(e=>{ console.error('MESSAGE:', e.message); console.error('CAUSE:', e.cause); })
