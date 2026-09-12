// Byte ranges keep local WebM seeking accurate in the private review harnesses.
export function mediaResponse(req,res,data,type){
 res.setHeader('Content-Type',type);res.setHeader('Accept-Ranges','bytes');
 if(!req.headers.range){res.setHeader('Content-Length',data.length);res.end(data);return}
 const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
 if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${data.length}`});res.end();return}
 let start=match[1]?Number(match[1]):Math.max(0,data.length-Number(match[2]));let end=match[1]?(match[2]?Number(match[2]):data.length-1):data.length-1;end=Math.min(end,data.length-1);
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=data.length){res.writeHead(416,{'Content-Range':`bytes */${data.length}`});res.end();return}
 res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':end-start+1});res.end(data.subarray(start,end+1));
}
