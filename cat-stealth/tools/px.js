"use strict";
/* px — 도트 픽셀맵 → PNG/base64 변환기.
   사용법:
     node tools/px.js <src.js> [out.png]   PNG 파일로 렌더 (기본: src 옆에 같은 이름.png)
     node tools/px.js --b64 <src.js>       base64만 출력 (assets.js TILESPR/CATSPR 임베드용)
     node tools/px.js --view <src.js>      콘솔 미리보기(글자 ×2 확대)
   소스 형식 (tools/px/<name>.js):
     module.exports={
       w:16,h:16,
       pal:{ ".":null, K:"#26221f", W:"#f4f1ea" },   // null=투명
       rows:["....KKKK........", ...]                // h줄, 각 w글자, pal 키만 사용
     }; */
const fs=require("fs"),path=require("path"),zlib=require("zlib");

function crc32(buf){
  var t=crc32.t; if(!t){ t=crc32.t=[];
    for(var n=0;n<256;n++){ var c=n;
      for(var k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
      t[n]=c>>>0; } }
  var c=0xFFFFFFFF;
  for(var i=0;i<buf.length;i++) c=t[(c^buf[i])&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;
}
function chunk(type,data){
  var len=Buffer.alloc(4); len.writeUInt32BE(data.length);
  var td=Buffer.concat([Buffer.from(type),data]);
  var crc=Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len,td,crc]);
}
function toPNG(w,h,rgba){
  var ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4);
  ihdr[8]=8; ihdr[9]=6;               /* 8bit RGBA */
  var raw=Buffer.alloc((w*4+1)*h);
  for(var y=0;y<h;y++){ raw[y*(w*4+1)]=0; rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4); }
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
    chunk("IHDR",ihdr),
    chunk("IDAT",zlib.deflateSync(raw,{level:9})),
    chunk("IEND",Buffer.alloc(0))]);
}
function hexRGB(hex){
  hex=hex.replace("#","");
  if(hex.length===3) hex=hex.split("").map(function(c){return c+c}).join("");
  if(hex.length===8) return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),
    parseInt(hex.slice(4,6),16),parseInt(hex.slice(6,8),16)];
  return [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16),255];
}
function load(fp){
  var s=require(path.resolve(fp));
  if(!s.w||!s.h||!s.pal||!Array.isArray(s.rows)) throw new Error("w/h/pal/rows 필요");
  if(s.rows.length!==s.h) throw new Error("rows가 "+s.rows.length+"줄 — h="+s.h+" 여야 해요");
  var rgba=Buffer.alloc(s.w*s.h*4);
  for(var y=0;y<s.h;y++){
    var row=s.rows[y];
    if(row.length!==s.w) throw new Error((y+1)+"줄 길이 "+row.length+" — w="+s.w+" 여야 해요");
    for(var x=0;x<s.w;x++){
      var k=row[x], c=s.pal[k];
      if(c===undefined) throw new Error("팔레트에 없는 문자 '"+k+"' ("+x+","+y+")");
      if(c==null) continue;
      var v=hexRGB(c), o=(y*s.w+x)*4;
      rgba[o]=v[0]; rgba[o+1]=v[1]; rgba[o+2]=v[2]; rgba[o+3]=v[3];
    }
  }
  return {s:s,rgba:rgba};
}
var args=process.argv.slice(2), mode=args[0];
if(mode==="--b64"){
  var d=load(args[1]);
  console.log(toPNG(d.s.w,d.s.h,d.rgba).toString("base64"));
}else if(mode==="--view"){
  var d2=load(args[1]);
  d2.s.rows.forEach(function(r){ console.log(r.split("").map(function(c){return c+c}).join("")); });
}else{
  var d3=load(args[0]);
  var out=args[1]||args[0].replace(/\.js$/,"")+".png";
  fs.writeFileSync(out,toPNG(d3.s.w,d3.s.h,d3.rgba));
  console.log(out,d3.s.w+"x"+d3.s.h);
}
