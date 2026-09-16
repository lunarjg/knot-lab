'use strict';
importScripts('./invariants.js');
self.onmessage=({data})=>{
 try {self.postMessage({id:data.id,result:KnotInvariants.calculate(data.analysis)});}
 catch(error){self.postMessage({id:data.id,error:error.message||'Could not calculate invariants.'});}
};
