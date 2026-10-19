import * as pdfjs from '/assets/b53849a26298fd713aba/web/vendor/pdf.mjs';
import {CALENDAR_LIMITS} from '/assets/b53849a26298fd713aba/web/calendar-contract.js';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
export async function readCalendarPdf(bytes,signal){
 const job=pdfjs.getDocument({data:bytes,isEvalSupported:false,enableXfa:false,useSystemFonts:true,maxImageSize:CALENDAR_LIMITS.pixels,stopAtErrors:true});
 const abort=()=>void job.destroy();signal.addEventListener('abort',abort,{once:true});
 try{const pdf=await job.promise;if(pdf.numPages>CALENDAR_LIMITS.pages)throw Error('PDF 最多支援 8 頁；請按學期拆分。');const pages=[];let total=0;
  for(let p=1;p<=pdf.numPages;p++){signal.throwIfAborted();const page=await pdf.getPage(p),tc=await page.getTextContent(),items=tc.items.filter(i=>'str' in i&&i.str.trim()),lines=[];
   // Coordinates stay attached to every line: semantic extraction sees columns, not a flattened stream.
   for(const item of items.sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4])){let line=lines.find(l=>Math.abs(l.y-item.transform[5])<3);if(!line){line={y:item.transform[5],items:[]};lines.push(line);}line.items.push(item);}
   const text=lines.map((l,i)=>`L${i+1} `+l.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(x=>`[x=${Math.round(x.transform[4])}] ${x.str}`).join(' | ')).join('\n');total+=text.length;if(total>CALENDAR_LIMITS.text)throw Error('PDF 文字量超過限制，請按學期拆分。');
   let image;const ops=await page.getOperatorList(),hasImage=ops.fnArray.some(n=>[pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject].includes(n));if(text.replace(/L\d+|\[x=\d+\]|\s|\|/g,'').length<40||hasImage){const base=page.getViewport({scale:1}),scale=Math.min(2,Math.sqrt(CALENDAR_LIMITS.renderPixels/(base.width*base.height))),viewport=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),canvas,viewport}).promise;image=canvas.toDataURL('image/jpeg',0.85);canvas.width=canvas.height=0;if(image.length>1500000)throw Error('掃描頁面過大，請提供較小的清晰檔案。');}pages.push({page:p,text,...(image?{image}:{})});page.cleanup();
  }return pages;
 }catch(e){if(e.name==='PasswordException')throw Error('PDF 已加密；請提供可正常開啟的未加密校曆。');if(e.name==='InvalidPDFException')throw Error('PDF 已損壞，請重新匯出。');throw e;}finally{signal.removeEventListener('abort',abort);await job.destroy();}
}
