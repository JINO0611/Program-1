'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {MondayClient}=require('./monday-api.cjs'),Core=require('./monday-core.cjs');
const PUBLIC=['index.html','style.css','app.js','model.js','workbook.js','erp-model.js','assignments.js','monday-ui.js','private-data.js','vendor/jszip.min.js'];
function createApp({clientFactory=token=>new MondayClient(token),initialToken=process.env.MONDAY_API_TOKEN||''}={}){
 const localKey=crypto.randomBytes(32).toString('hex');let client=initialToken?clientFactory(initialToken):null,plans=new Map(),locked=false;
 const json=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));};
 async function body(req){if(!/^application\/json\b/.test(req.headers['content-type']||''))throw Error('JSON 요청만 허용합니다.');let buf=[],size=0;for await(const part of req){size+=part.length;if(size>10*1024*1024)throw Error('요청 크기가 10MB를 초과합니다.');buf.push(part);}return JSON.parse(Buffer.concat(buf).toString('utf8'));}
 const id=v=>{if(!/^\d+$/.test(String(v||'')))throw Error('보드 ID를 확인하세요.');return String(v);};
 const config=v=>{if(!v||!['quotes','orders'].includes(v.kind))throw Error('자료 종류를 확인하세요.');return {...v,boardId:id(v.boardId)};};
 async function handle(req,res){const port=req.socket.localPort,allowed=new Set(['127.0.0.1:'+port,'localhost:'+port]),host=req.headers.host;if(!allowed.has(host))return json(res,403,{error:'허용되지 않은 호스트입니다.'});let url=new URL(req.url,'http://'+host);if(req.headers.origin&&req.headers.origin!=='http://'+host)return json(res,403,{error:'다른 사이트의 요청을 허용하지 않습니다.'});
 try{
 if(url.pathname==='/api/session'&&req.method==='GET')return json(res,200,{localKey,connected:!!client});
 if(url.pathname.startsWith('/api/')){
 if(req.method!=='POST'||req.headers['x-local-key']!==localKey)return json(res,403,{error:'프로그램 화면에서 다시 연결하세요.'});const b=await body(req);
 if(locked)return json(res,409,{error:'전송 중입니다. 완료 후 다시 시도하세요.'});
 if(url.pathname==='/api/monday/connect'){if(typeof b.token!=='string'||!b.token.trim()||b.token.length>16384)throw Error('API 토큰을 입력하세요.');const next=clientFactory(b.token.trim()),me=await next.me();client=next;plans.clear();return json(res,200,{me});}
 if(url.pathname==='/api/monday/disconnect'){client=null;plans.clear();return json(res,200,{disconnected:true});}
 if(!client)return json(res,401,{error:'monday.com API 토큰을 연결하세요.'});
 if(url.pathname==='/api/monday/boards')return json(res,200,{boards:await client.boards(Math.max(1,Number(b.page)||1))});
 if(url.pathname==='/api/monday/users')return json(res,200,{users:await client.users(Math.max(1,Number(b.page)||1))});
 if(url.pathname==='/api/monday/board')return json(res,200,{board:await client.board(id(b.boardId))});
 if(url.pathname==='/api/monday/pull'){const c=config(b.config),board=await client.board(c.boardId);return json(res,200,{...Core.normalize(await client.items(c.boardId),c,board),board,kind:c.kind});}
 if(url.pathname==='/api/monday/plan'){
 const c=config(b.config);if(!Array.isArray(b.rows)||!b.rows.length||b.rows.length>50)throw Error('1~50개 품목 행을 선택하세요.');const board=await client.board(c.boardId);if(c.groupId&&!board.groups.some(g=>g.id===c.groupId))throw Error('대상 그룹을 확인하세요.');const ops=Core.plan(b.rows,c,board,await client.items(c.boardId)),planId=crypto.randomUUID();plans.clear();plans.set(planId,{config:c,ops,expires:Date.now()+5*60*1000});return json(res,200,{planId,board:{id:board.id,name:board.name},expiresIn:300,ops:ops.map(o=>({action:o.action,index:o.index,itemId:o.itemId,id:o.row.id,date:o.row.date,customer:o.row.customer,owner:o.row.owner,maker:o.row.maker,amount:o.row.amount,changedFields:Object.keys(o.values).map(col=>Object.keys(c.map).find(k=>c.map[k]===col))}))});}
 if(url.pathname==='/api/monday/apply'){
 const plan=plans.get(b.planId);if(!plan||plan.expires<Date.now())throw Error('전송 검토가 만료됐습니다. 다시 검토하세요.');plans.delete(b.planId);locked=true;let done=[];try{
 const board=await client.board(plan.config.boardId),fresh=Core.plan(plan.ops.map(o=>o.row),plan.config,board,await client.items(plan.config.boardId));const fingerprint=ops=>JSON.stringify(ops.map(o=>({action:o.action,itemId:o.itemId,values:o.values})));if(fingerprint(fresh)!==fingerprint(plan.ops))throw Error('검토 후 원격 데이터가 바뀌었습니다. 다시 검토하세요.');
 for(const op of fresh){try{let itemId=op.itemId;if(op.action==='create')itemId=(await client.create(plan.config.boardId,plan.config.groupId,op.row.id+' · '+(op.row.partNo||op.row.customer),op.values)).id;else if(op.action==='update')await client.update(plan.config.boardId,op.itemId,op.values);done.push({index:op.index,itemId:String(itemId),action:op.action});}catch(e){return json(res,200,{done,error:e.message,stopped:true});}}
 return json(res,200,{done,stopped:false});}finally{locked=false;}}
 return json(res,404,{error:'지원하지 않는 요청입니다.'});}
 if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'허용되지 않은 요청입니다.'});const file=url.pathname==='/'?'index.html':url.pathname.slice(1);if(!PUBLIC.includes(file))return json(res,404,{error:'파일이 없습니다.'});const p=path.join(__dirname,file);if(!fs.existsSync(p))return json(res,404,{error:'파일이 없습니다.'});const ext=path.extname(file),mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8'}[ext];res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});if(req.method==='HEAD')return res.end();fs.createReadStream(p).pipe(res);
 }catch(e){json(res,400,{error:e instanceof SyntaxError?'요청 형식을 확인하세요.':e.message});}}
 return http.createServer((req,res)=>{handle(req,res).catch(()=>{if(!res.headersSent)json(res,500,{error:'처리 중 오류가 발생했습니다.'});else res.end();});});
}
if(require.main===module){if(Number(process.versions.node.split('.')[0])<22)throw Error('Node.js 22 이상이 필요합니다.');const port=Number(process.env.PORT||8731);const server=createApp();server.listen(port,'127.0.0.1',()=>console.log('REVODIX V3: http://127.0.0.1:'+server.address().port+' (종료: Ctrl+C)'));server.on('error',()=>{console.error('실행할 수 없습니다. 다른 프로그램이 같은 포트를 쓰는지 확인하세요.');process.exitCode=1;});}
module.exports={createApp};
