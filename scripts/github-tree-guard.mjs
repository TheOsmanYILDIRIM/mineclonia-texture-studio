/** Validate Git Trees API inputs before publishing. */
const SHA = /^[0-9a-f]{40}$/i;
const MODES = new Set(['100644','100755','120000']);
export function validateTreeUpdate({baseTreeSha,expectedHeadSha,actualHeadSha,entries,allowedPaths}) {
  if (![baseTreeSha,expectedHeadSha,actualHeadSha].every(s => typeof s === 'string' && SHA.test(s))) throw Error('invalid SHA');
  if (expectedHeadSha !== actualHeadSha) throw Error('HEAD changed; stop and compare');
  if (!Array.isArray(entries) || !entries.length || !(allowedPaths instanceof Set) || !allowedPaths.size) throw Error('missing scoped tree inputs');
  const seen = new Set();
  for (const e of entries) {
    if (!e || typeof e !== 'object' || Array.isArray(e) || Object.keys(e).some(k => !['path','mode','type','sha','content'].includes(k))) throw Error('invalid tree entry');
    if (typeof e.path !== 'string' || e.path.startsWith('/') || e.path.includes('\\') || e.path.split('/').some(p => !p || p === '.' || p === '..' || p.includes('\0'))) throw Error('unsafe path');
    if (!allowedPaths.has(e.path) || seen.has(e.path)) throw Error('unapproved or duplicate path');
    seen.add(e.path);
    if (!MODES.has(e.mode) || e.type !== 'blob' || (('sha' in e) === ('content' in e))) throw Error('unsupported Git object');
    if ('sha' in e && (typeof e.sha !== 'string' || !SHA.test(e.sha))) throw Error('invalid blob SHA');
    if ('content' in e && typeof e.content !== 'string') throw Error('invalid blob content');
  }
  return {base_tree_sha:baseTreeSha,tree_elements:entries};
}
export function assertRefLease({expectedHeadSha,actualHeadSha,newCommitParentSha,force=false}) {
  if (![expectedHeadSha,actualHeadSha,newCommitParentSha].every(s => typeof s==='string' && SHA.test(s))) throw Error('invalid SHA');
  if (force!==false || actualHeadSha!==expectedHeadSha || newCommitParentSha!==expectedHeadSha) throw Error('unsafe HEAD/CAS transition');
  return {expected_sha:expectedHeadSha,force:false};
}
