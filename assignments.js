/* Assignment changes are local, immutable, and independent of financial values. */
(function(root,f){const api=f();if(typeof module==='object'&&module.exports)module.exports=api;else root.SalesAssignments=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const fields=['owner','maker'];
function list(data,f={}){let out=[],query=String(f.search||'').trim().toLocaleLowerCase();for(const kind of ['quotes','orders']){if(f.kind&&f.kind!==kind)continue;data[kind].forEach((row,index)=>{if(f.year&&row.date.slice(0,4)!==String(f.year))return;if(['customer','owner','maker'].some(k=>f[k]&&row[k]!==f[k]))return;if(query&&![row.id,row.customer,row.partNo,row.item,row.owner,row.maker].some(v=>String(v||'').toLocaleLowerCase().includes(query)))return;out.push({kind,index,key:kind+':'+index,row});});}return out;}
function change(data,keys,values,at=new Date().toISOString()){
 const patch={};for(const f of fields){if(!Object.hasOwn(values,f))continue;let v=String(values[f]??'').trim().replace(/\s+/g,' ').normalize('NFC');if(!v||v.length>100)throw Error('담당자·메이커는 1~100자로 입력해 주세요.');patch[f]=f==='maker'?v.toUpperCase():v;}
 if(!Object.keys(patch).length)throw Error('변경할 담당자 또는 메이커를 입력해 주세요.');
 const targets=new Map();for(const key of new Set(keys)){const m=/^(quotes|orders):(\d+)$/.exec(key);if(!m||!data[m[1]][+m[2]])throw Error('선택한 행을 찾지 못했습니다. 다시 선택해 주세요.');targets.set(key,{kind:m[1],index:+m[2]});}
 let next={...data,quotes:[...data.quotes],orders:[...data.orders]},count=0;
 for(const {kind,index} of targets.values()){const row=data[kind][index];if(Object.entries(patch).every(([f,v])=>row[f]===v))continue;next[kind][index]={...row,assignmentOriginal:row.assignmentOriginal?{owner:row.assignmentOriginal.owner,maker:row.assignmentOriginal.maker}:{owner:row.owner,maker:row.maker},...patch,assignmentModifiedAt:at};count++;}
 return {data:count?next:data,count};
}
return {list,change};
});
