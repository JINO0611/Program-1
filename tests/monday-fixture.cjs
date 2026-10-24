const board={id:'123',name:'Test quotes',columns:[['doc','문서번호','text'],['date','날짜','date'],['amount','금액','numbers'],['customer','거래처','text'],['owner','담당자','text'],['maker','메이커','text'],['external','외부연동키','text'],['part','품번','text']].map(([id,title,type])=>({id,title,type})),groups:[{id:'g1',title:'Test'}]};
const config={kind:'quotes',boardId:'123',groupId:'g1',map:{id:'doc',date:'date',amount:'amount',customer:'customer',owner:'owner',maker:'maker',key:'external',partNo:'part'},ownerMap:{}};
const cell=(id,text,value=JSON.stringify(text))=>({id,text,value});
const item={id:'9001',name:'Test',column_values:[cell('doc','Q-001'),cell('date','2026-09-30',JSON.stringify({date:'2026-09-30'})),cell('amount','1,200','"1200"'),cell('customer','Test Co'),cell('owner','Author'),cell('maker','OLD'),cell('part','PN1'),cell('external','')]};
const row={id:'Q-002',date:'2026-09-30',amount:500,customer:'Test Co',owner:'Owner',maker:'MAKER',source:'xlsx-123',sourceRow:2,partNo:'PN2'};
module.exports={board,config,item,row,cell};
