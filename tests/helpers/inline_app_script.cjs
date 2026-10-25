const fs = require('fs');
const path = require('path');

module.exports = function inlineAppScript(html, projectRoot) {
  const match = String(html || '').match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) throw new Error('Inline app script was not found.');
  let script = match[1];
  const modules = [
    ['/*__MEDIA_PIPELINE__*/', path.join(projectRoot, 'src', 'media', 'pipeline.js')],
    ['/*__STORAGE_NODES__*/', path.join(projectRoot, 'src', 'app', 'storage_nodes.js')]
  ];
  for (const [marker, filename] of modules) {
    if (script.split(marker).length !== 2) throw new Error(`Expected one ${marker} placeholder in the app script.`);
    const source = fs.readFileSync(filename, 'utf8').replace(/^[ \t]*export[ \t]+/gm, '');
    script = script.replace(marker, source);
  }
  return script;
};
