import assert from 'node:assert/strict';
import {validateTreeUpdate,assertRefLease} from '../scripts/github-tree-guard.mjs';
const a='a'.repeat(40), b='b'.repeat(40), c='c'.repeat(40);
const e={path:'tests/test.json',mode:'100644',type:'blob',content:'{"ok":true}'};
const base={baseTreeSha:b,expectedHeadSha:a,actualHeadSha:a,entries:[e],allowedPaths:new Set([e.path])};
assert.equal(validateTreeUpdate(base).base_tree_sha,b);
assert.deepEqual(assertRefLease({expectedHeadSha:a,actualHeadSha:a,newCommitParentSha:a}),{expected_sha:a,force:false});
for (const bad of [{actualHeadSha:c},{baseTreeSha:'bad'},{entries:[]},{entries:[e,e]},{allowedPaths:new Set()},
  {entries:[{...e,path:'../bad'}]},{entries:[{...e,path:'/bad'}]},{entries:[{...e,path:'a//b'}]},
  {entries:[{...e,path:'other'}]},{entries:[{...e,mode:'160000'}]},{entries:[{...e,type:'tree'}]},
  {entries:[{...e,sha:c}]},{entries:[{...e,content:null}]},{entries:[{...e,extra:1}]}])
  assert.throws(()=>validateTreeUpdate({...base,...bad}));
for (const bad of [{actualHeadSha:c},{newCommitParentSha:c},{force:true}])
  assert.throws(()=>assertRefLease({expectedHeadSha:a,actualHeadSha:a,newCommitParentSha:a,...bad}));
console.log('Git tree and HEAD/CAS guard tests passed');
