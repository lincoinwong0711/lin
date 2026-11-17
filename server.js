'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const ADMIN_TOKEN = process.env.SURVEY_ADMIN_TOKEN || crypto.randomBytes(18).toString('hex');
const DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR || DIR;
fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, 'responses.json');
const questions = {
  q1:['22:00 前','22:00–22:59','23:00–23:59','00:00–00:59','01:00–01:59','02:00 及以后','每天差异较大'],
  q2:['22:00 前','22:00–22:59','23:00–23:59','00:00–00:59','01:00–01:59','02:00 及以后','每天差异较大','不确定'],
  q3:['15 分钟以内','16–30 分钟','31–60 分钟','超过 60 分钟','不确定'],
  q4:['06:00 前','06:00–06:59','07:00–07:59','08:00–08:59','09:00–09:59','10:00 及以后','每天差异较大'],
  q5:['少于 5 小时','5–不足 6 小时','6–不足 7 小时','7–不足 8 小时','8 小时及以上','不确定'],
  q6:['通常相差不超过 30 分钟','通常相差 31 分钟至 1 小时','通常相差超过 1 小时','每天都不太一样'],
  q7:['学习或完成作业','课程、社团、兼职等安排较晚','使用手机、电脑或平板','看视频、浏览社交媒体','玩游戏','与朋友、室友聊天或参加活动','白天睡眠较多','到了晚上还不困','躺下后难以入睡','情绪、压力或担忧影响休息','通常不会晚于预期','其他'],
  q8:['学习或处理事务','看视频或浏览社交媒体','玩游戏','聊天或通话','洗漱、整理物品','阅读或听音乐','已经躺床休息','其他'],
  q9:['学习或作业','课程、社团、兼职等安排','手机、电脑或平板使用','视频、社交媒体或游戏','社交活动','白天补觉','晚上不困','入睡困难','情绪或压力','其他'],
  q11:['非常不满意','不满意','一般','满意','非常满意'],
  q12:['完全没有影响','影响较小','有一些影响','影响较大','影响非常大','不确定'],
  q13:['希望提前','希望推迟','暂时不想改变','不确定'],
  q14:['课业或其他安排占用晚间时间','睡前容易继续使用手机或电脑','到了计划时间仍不困','躺下后不容易入睡','早晨没有固定安排','室友或宿舍环境影响','不知道如何调整','其他','暂时没有明显困难'],
  q15:['固定起床时间','减少睡前使用手机或电脑','提前完成学习任务','减少晚间活动','改善宿舍休息环境','与室友协商作息','其他','暂时不需要帮助']
};
const multi = new Set(['q7','q8','q9','q14','q15']);
const required = ['q1','q2','q3','q4','q5','q6','q7','q8','q9','q11','q12','q13','q15','q10_a','q10_b','q10_c','q10_d'];
const json = (res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
function readBody(req){return new Promise((resolve,reject)=>{let data='',size=0;req.on('data',chunk=>{size+=chunk.length;if(size>50000){reject(new Error('too_large'));req.destroy();return}data+=chunk});req.on('end',()=>{try{resolve(JSON.parse(data))}catch{reject(new Error('invalid_json'))}});req.on('error',reject)});}
function validAnswer(body){
 if(!body||body.schema!=='bedtime-survey-v1')return false;
 for(const key of required){const v=body[key];if(key.startsWith('q10_')){if(!Number.isInteger(v)||v<1||v>5)return false}else if(multi.has(key)){if(!Array.isArray(v)||v.length<1||v.some(x=>!Number.isInteger(x)||x<1||x>questions[key].length))return false}else if(!Number.isInteger(v)||v<1||v>questions[key].length)return false}
 if(body.q9.length>3||body.q15.length>3)return false;
 if(body.q13===3){if(body.q14!==null&&body.q14!==undefined&&body.q14.length)return false}else if(!Array.isArray(body.q14)||!body.q14.length||body.q14.some(x=>!Number.isInteger(x)||x<1||x>questions.q14.length))return false;
 for(const key of ['q7_other','q8_other','q9_other','q14_other','q15_other','q16'])if(typeof body[key]!=='string'||body[key].length>2000)return false;
 return true;
}
const flatten = r=>{
 const row={提交时间:r.submittedAt};
 for(const [key,options] of Object.entries(questions)){
   if(multi.has(key)){const selected=Array.isArray(r[key])?r[key]:[];options.forEach((label,i)=>row[key+'_'+(i+1)]=selected.includes(i+1)?1:0)}
   else row[key]=r[key]?options[r[key]-1]:'';
 }
 for(const c of 'abcd')row['q10_'+c]=r['q10_'+c]||'';
 for(const key of ['q7_other','q8_other','q9_other','q14_other','q15_other','q16'])row[key]=r[key]||'';
 return row;
};
const csvCell=value=>{let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
function exportCsv(rows){const flattened=rows.map(flatten);const headers=flattened.length?Object.keys(flattened[0]):['提交时间',...Object.keys(questions).flatMap(k=>multi.has(k)?questions[k].map((_,i)=>k+'_'+(i+1)):[k]),'q10_a','q10_b','q10_c','q10_d','q7_other','q8_other','q9_other','q14_other','q15_other','q16'];return '\ufeff'+[headers.map(csvCell).join(','),...flattened.map(row=>headers.map(h=>csvCell(row[h])).join(','))].join('\r\n');}
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return fs.createReadStream(path.join(DIR,'index.html')).pipe(res)}
 if(req.method==='GET'&&url.pathname==='/admin'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return fs.createReadStream(path.join(DIR,'admin.html')).pipe(res)}
 if(req.method==='POST'&&url.pathname==='/api/responses'){
   try{const body=await readBody(req);if(!validAnswer(body))return json(res,400,{error:'请检查必答题、选项数量或答案格式。'});let rows=[];try{rows=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}const entry={...body,submittedAt:new Date().toISOString()};rows.push(entry);fs.writeFileSync(DATA_FILE,JSON.stringify(rows,null,2),'utf8');return json(res,201,{ok:true})}catch(e){return json(res,e.message==='too_large'?413:400,{error:e.message==='too_large'?'提交内容过大。':'无法保存答卷，请重试。'})}
 }
 if(req.method==='POST'&&url.pathname==='/api/export'){
   const supplied=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
   const expected=Buffer.from(ADMIN_TOKEN),actual=Buffer.from(supplied);
   if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))return json(res,403,{error:'管理口令不正确。'});
   let rows=[];try{rows=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'))}catch(e){if(e.code!=='ENOENT')return json(res,500,{error:'无法读取答卷数据。'})}
   res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="bedtime_survey_responses.csv"','Cache-Control':'no-store'});return res.end(exportCsv(rows));
 }
 res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');
});
server.listen(PORT,HOST,()=>{console.log(`问卷填写页：http://localhost:${PORT}`);console.log(`答卷导出页：http://localhost:${PORT}/admin`);console.log(`管理口令：${ADMIN_TOKEN}`);console.log(`答卷保存位置：${DATA_FILE}`);console.log('服务绑定所有网络接口；同一局域网可通过本机 IP 访问。');});

