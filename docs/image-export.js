// Render at the chosen pixel density in bounded tiles. A single 16K canvas exceeds
// the backing-store limits on many phones, so feed PNG scanlines to a deflater.
globalThis.createOrbitImageExport=function(capture){
  'use strict';
  const el=id=>document.getElementById(id);
  const dialog=el('export-view'),status=el('export-status'),progress=el('export-progress'),save=el('export-save'),close=el('export-close');
  const longEdge=16384,threshold=512,tileWidth=2048;
  let current=null,url='';
  const crcTable=Uint32Array.from({length:256},(_,i)=>{
    for(let b=0;b<8;b++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0;
  });
  function uint32(bytes,offset,value){new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).setUint32(offset,value);}
  function chunk(type,data){
    const head=new Uint8Array(8),tail=new Uint8Array(4);uint32(head,0,data.length);
    let crc=0xffffffff;
    for(let i=0;i<4;i++){head[i+4]=type.charCodeAt(i);crc=crcTable[(crc^head[i+4])&255]^(crc>>>8);}
    for(let i=0;i<data.length;i++)crc=crcTable[(crc^data[i])&255]^(crc>>>8);
    uint32(tail,0,(crc^0xffffffff)>>>0);return [head,data,tail];
  }
  function tick(){return new Promise(resolve=>setTimeout(resolve,0));}
  async function encode(scene,width,height,scale,abort,report){
    if(typeof CompressionStream==='undefined')throw Error('이 브라우저에서는 PNG 압축을 지원하지 않습니다. 최신 브라우저에서 열어 주세요.');
    const header=new Uint8Array(13);uint32(header,0,width);uint32(header,4,height);header[8]=8;header[9]=2;
    const dpi=new Uint8Array(9);uint32(dpi,0,11811);uint32(dpi,4,11811);dpi[8]=1;
    const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),...chunk('IHDR',header),...chunk('pHYs',dpi)];
    const zipped=new CompressionStream('deflate'),writer=zipped.writable.getWriter(),reader=zipped.readable.getReader();
    const collect=(async()=>{for(;;){const {value,done}=await reader.read();if(done)return;parts.push(...chunk('IDAT',value));}})();
    collect.catch(()=>{});
    const tile=document.createElement('canvas'),g=tile.getContext('2d',{alpha:false,willReadFrequently:true});
    try{
      for(let y=0;y<height;y+=threshold){
        const rows=Math.min(threshold,height-y),pieces=[];
        for(let x=0;x<width;x+=tileWidth){
          abort.throwIfAborted();const w=Math.min(tileWidth,width-x);
          if(tile.width!==w)tile.width=w;if(tile.height!==rows)tile.height=rows;
          scene.tile(g,{x,y,w,h:rows},scale);
          pieces.push(g.getImageData(0,0,w,rows));await tick();
        }
        const stride=1+3*width;
        for(let start=0;start<rows;start+=32){
          abort.throwIfAborted();const n=Math.min(32,rows-start),packet=new Uint8Array(stride*n);
          for(let j=0;j<n;j++){
            let destination=j*stride;packet[destination++]=1; // PNG Sub filter, continued across tile boundaries.
            let r=0,g=0,b=0;
            for(const piece of pieces){
              const src=piece.data,from=(j+start)*piece.width*4,end=from+piece.width*4;
              for(let i=from;i<end;i+=4){
                packet[destination++]=src[i]-r;packet[destination++]=src[i+1]-g;packet[destination++]=src[i+2]-b;
                r=src[i];g=src[i+1];b=src[i+2];
              }
            }
          }
          await writer.write(packet);
        }
        report((y+rows)/height);
      }
      await writer.close();await collect;parts.push(...chunk('IEND',new Uint8Array()));
      return new Blob(parts,{type:'image/png'});
    }catch(err){await writer.abort(err).catch(()=>{});await collect.catch(()=>{});throw err;}
    finally{tile.width=tile.height=1;}
  }
  async function start(){
    if(dialog.open)return;
    if(url){URL.revokeObjectURL(url);url='';}
    current=new AbortController();const signal=current.signal;
    save.hidden=true;save.removeAttribute('href');progress.hidden=false;progress.value=0;
    status.textContent='현재 시점의 관측 자료를 불러오는 중…';close.textContent='취소';dialog.showModal();
    try{
      const scene=capture(),scale=longEdge/Math.max(scene.width,scene.height);
      const w=Math.max(1,Math.round(scene.width*scale)),h=Math.max(1,Math.round(scene.height*scale));
      const dimensions=w.toLocaleString('ko-KR')+' × '+h.toLocaleString('ko-KR')+' 픽셀';
      await scene.prepare();signal.throwIfAborted();
      status.textContent=dimensions+' · 이미지 생성 중';
      const blob=await encode(scene,w,h,scale,signal,v=>{progress.value=v;status.textContent=dimensions+' · '+Math.round(v*100)+'%';});
      signal.throwIfAborted();url=URL.createObjectURL(blob);save.href=url;save.download='태양계-'+w+'x'+h+'.png';save.hidden=false;
      status.textContent=dimensions+' · PNG '+(blob.size/1048576).toFixed(1)+' MB';progress.hidden=true;close.textContent='닫기';
    }catch(err){
      if(signal.aborted)return;
      progress.hidden=true;status.textContent=err.message||'이미지를 만들지 못했습니다. 다시 열어 주세요.';close.textContent='닫기';
    }
  }
  el('export-open').onclick=start;close.onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{current?.abort();current=null;});
};
