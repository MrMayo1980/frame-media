import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
import {isIP} from 'node:net';
import {createHmac,timingSafeEqual} from 'node:crypto';
export function isPublicAddress(address){
 if(isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51)||a===203&&b===0)}
 if(isIP(address)===6){const ip=address.toLowerCase();return /^2[0-9a-f]{3}:/.test(ip)&&!ip.startsWith('2001:db8:')&&!ip.startsWith('2001:0:')&&!ip.startsWith('2002:')}
 return false;
}
export function publicURL(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')throw Error('Разрешены только публичные HTTPS-адреса');const host=url.hostname.replace(/^\[|\]$/g,'');if(host==='localhost'||/\.(local|internal|localhost)$/i.test(host)||isIP(host)&&!isPublicAddress(host))throw Error('Локальные адреса запрещены');return url}
export async function safeRequest(value,redirects=0){
 const url=publicURL(value);const host=url.hostname.replace(/^\[|\]$/g,'');const records=await lookup(host,{all:true});if(!records.length||records.some(x=>!isPublicAddress(x.address)))throw Error('Источник использует непубличный сетевой адрес');
 const record=records[0];const response=await new Promise((resolve,reject)=>{const req=request(url,{headers:{'User-Agent':'FrameMedia/2.0 (+https://github.com/MrMayo1980/frame-media)','Accept':'text/html,image/*,video/*;q=0.9,*/*;q=0.1'},lookup:(_hostname,options,cb)=>options.all?cb(null,[record]):cb(null,record.address,record.family),timeout:20000},resolve);req.on('timeout',()=>req.destroy(Error('Источник не ответил за 20 секунд')));req.on('error',reject);req.end()});
 if([301,302,303,307,308].includes(response.statusCode)){response.resume();if(redirects>=4||!response.headers.location)throw Error('Слишком много перенаправлений');return safeRequest(new URL(response.headers.location,url).href,redirects+1)}
 if(response.statusCode<200||response.statusCode>=300){response.resume();throw Error('Источник вернул HTTP '+response.statusCode)}return {response,url:url.href};
}
export async function readPage(url){const {response,url:finalURL}=await safeRequest(url);if(!/text\/html|application\/xhtml/i.test(response.headers['content-type']||'')){response.destroy();throw Error('Страница не является HTML')}const chunks=[];let length=0;try{for await(const c of response){length+=c.length;if(length>2*1024*1024)throw Error('HTML превышает 2 МБ');chunks.push(c)}}finally{response.destroy()}return {html:Buffer.concat(chunks).toString('utf8'),url:finalURL}}
export function sign(data,secret,ttl=3600000){const body=Buffer.from(JSON.stringify({...data,expires:Date.now()+ttl})).toString('base64url');return body+'.'+createHmac('sha256',secret).update(body).digest('base64url')}
export function verify(token,secret){if(typeof token!=='string'||token.length>100000)throw Error('Некорректный токен');const [body,signature,...extra]=token.split('.');if(!body||!signature||extra.length)throw Error('Некорректный токен');const expected=createHmac('sha256',secret).update(body).digest(),actual=Buffer.from(signature,'base64url');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error('Недействительная подпись');const data=JSON.parse(Buffer.from(body,'base64url').toString());if(!Number.isFinite(data.expires)||data.expires<Date.now())throw Error('Результаты устарели. Повторите поиск.');return data}
