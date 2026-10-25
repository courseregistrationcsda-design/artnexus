import test from 'node:test';
import assert from 'node:assert/strict';
import {
  injectStoragePointerToForm,
  MAX_STORAGE_NODES_PER_WORK,
  normalizeStorageNodes,
  validateStoragePointer
} from '../src/app/storage_nodes.js';

const CID_V1 = `b${'a'.repeat(58)}`;
const CID_V0 = `Qm${'1'.repeat(44)}`;
const ARWEAVE_ID = 'A'.repeat(43);

test('IPFS and Arweave pointers accept identifier syntax only and are marked unverified', () => {
  const ipfs = validateStoragePointer('ipfs', `ipfs://${CID_V1}`);
  assert.equal(ipfs.isValid, true);
  assert.equal(ipfs.protocol, 'ipfs');
  assert.equal(ipfs.address, CID_V1);
  assert.equal(ipfs.uri, `ipfs://${CID_V1}`);
  assert.equal(ipfs.verified, false);
  assert.equal(ipfs.syntax_validated, true);

  const legacyCid = validateStoragePointer('ipfs', CID_V0);
  assert.equal(legacyCid.isValid, true);
  assert.equal(legacyCid.address, CID_V0);

  const arweave = validateStoragePointer('arweave', `arweave://${ARWEAVE_ID}`);
  assert.equal(arweave.isValid, true);
  assert.equal(arweave.protocol, 'arweave');
  assert.equal(arweave.address, ARWEAVE_ID);
  assert.equal(arweave.verified, false);
  assert.equal(arweave.is_local_reference, false);
});

test('pointer syntax rejects gateway paths, malformed identifiers, and network-shaped local notes', () => {
  assert.equal(validateStoragePointer('ipfs', `ipfs://${CID_V1}/private/master.png`).isValid, false);
  assert.equal(validateStoragePointer('ipfs', 'https://gateway.example/ipfs/bafy...').isValid, false);
  assert.equal(validateStoragePointer('ipfs', 'not-a-cid').isValid, false);
  assert.equal(validateStoragePointer('arweave', 'A'.repeat(42)).isValid, false);
  assert.equal(validateStoragePointer('arweave', `https://arweave.net/${ARWEAVE_ID}`).isValid, false);
  assert.equal(validateStoragePointer('local-handshake', 'https://drive.google.com/').isValid, false);
  assert.equal(validateStoragePointer('local-handshake', 'device/secret').isValid, false);
});

test('local-handshake remains a device-local note rather than a network URI', () => {
  const result = validateStoragePointer('local-handshake', 'local-drive-01');
  assert.equal(result.isValid, true);
  assert.equal(result.address, 'local-drive-01');
  assert.equal(result.uri, null);
  assert.equal(result.is_local_reference, true);
  assert.equal(result.verified, false);
});

test('storage-node arrays deduplicate, drop invalid entries, and cap their size', () => {
  const nodes = normalizeStorageNodes([
    { protocol: 'ipfs', address: CID_V1 },
    { protocol: 'ipfs', address: `ipfs://${CID_V1}` },
    ...Array.from({ length: MAX_STORAGE_NODES_PER_WORK + 2 }, (_, index) => ({ protocol: 'arweave', address: `${index}`.padStart(43, 'A') })),
    { protocol: 'local-handshake', address: 'bad/path' }
  ]);
  assert.equal(nodes.length, MAX_STORAGE_NODES_PER_WORK);
  assert.equal(nodes[0].protocol, 'ipfs');
  assert.equal(nodes.filter(node => node.address === CID_V1).length, 1);
  assert.ok(nodes.every(node => node.verified === false));
});

test('pointer form uses text nodes, exposes a controller, and resets without resolving anything', t => {
  class MockElement {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.attributes = new Map();
      this.dataset = {};
      this.listeners = new Map();
      this.value = '';
      this.textContent = '';
      this.innerHTML = '';
    }
    appendChild(child) { this.children.push(child); return child; }
    replaceChildren(...children) { this.children = children; }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    focus() { this.focused = true; }
  }
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  globalThis.document = { createElement: tagName => new MockElement(tagName) };
  t.after(() => {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
  });

  const root = new MockElement('div');
  const controller = injectStoragePointerToForm(root);
  assert.ok(controller);
  const added = controller.add('ipfs', CID_V1);
  assert.equal(added.isValid, true);
  assert.equal(controller.getValues().length, 1);
  assert.equal(controller.getValues()[0].uri, `ipfs://${CID_V1}`);
  const fieldset = root.children[0];
  assert.match(fieldset.children[1].textContent, /never resolves or fetches/);
  assert.equal(fieldset.children[1].innerHTML, '', 'user-controlled pointer text is never inserted as HTML');
  controller.reset();
  assert.deepEqual(controller.getValues(), []);
});
