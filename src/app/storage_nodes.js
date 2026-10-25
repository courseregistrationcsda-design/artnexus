export const MAX_STORAGE_NODES_PER_WORK = 8;

const CID_V0_PATTERN = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
const CID_V1_BASE32_PATTERN = /^b[a-z2-7]{10,118}$/;
const ARWEAVE_TX_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const LOCAL_HANDSHAKE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const STORAGE_PROTOCOLS = new Set(['ipfs', 'arweave', 'local-handshake']);

function invalidPointer(message) {
  return { isValid: false, message };
}

/**
 * Validate pointer syntax only. This does not verify content, pinning, ownership,
 * privacy, persistence, or reachability, and never resolves a network address.
 */
export function validateStoragePointer(protocolInput, addressInput) {
  const protocol = String(protocolInput || '').trim().toLowerCase();
  let address = String(addressInput || '').trim();
  if (!STORAGE_PROTOCOLS.has(protocol)) return invalidPointer('Choose IPFS, Arweave, or a local-handshake note.');
  if (!address || address.length > 160) return invalidPointer('Enter a storage identifier no longer than 160 characters.');

  if (protocol === 'ipfs') {
    if (address.startsWith('ipfs://')) address = address.slice('ipfs://'.length);
    if (address.includes('/') || address.includes('?') || address.includes('#') || address.includes(':')) {
      return invalidPointer('Enter an IPFS CID only; paths and gateway URLs are not accepted.');
    }
    if (!CID_V0_PATTERN.test(address) && !CID_V1_BASE32_PATTERN.test(address)) {
      return invalidPointer('Enter a CIDv0 or base32 CIDv1. This check validates syntax only, not the content hash.');
    }
    return {
      isValid: true,
      protocol,
      address,
      uri: `ipfs://${address}`,
      resource: 'master',
      syntax_validated: true,
      verified: false,
      is_local_reference: false
    };
  }

  if (protocol === 'arweave') {
    if (address.startsWith('arweave://')) address = address.slice('arweave://'.length);
    if (address.includes('/') || address.includes('?') || address.includes('#') || address.includes(':')
      || !ARWEAVE_TX_PATTERN.test(address)) {
      return invalidPointer('Enter a 43-character Arweave transaction ID only, not a gateway URL.');
    }
    return {
      isValid: true,
      protocol,
      address,
      uri: `arweave://${address}`,
      resource: 'master',
      syntax_validated: true,
      verified: false,
      is_local_reference: false
    };
  }

  if (address.startsWith('local-handshake://')) address = address.slice('local-handshake://'.length);
  if (address.includes('/') || address.includes('?') || address.includes('#') || address.includes('://')
    || !LOCAL_HANDSHAKE_PATTERN.test(address)) {
    return invalidPointer('Use a short device-local label, not a network address or URL.');
  }
  return {
    isValid: true,
    protocol,
    address,
    uri: null,
    resource: 'master',
    syntax_validated: true,
    verified: false,
    is_local_reference: true
  };
}

export function normalizeStorageNodes(value) {
  if (!Array.isArray(value)) return [];
  const normalized = [];
  const seen = new Set();
  for (const entry of value.slice(0, 64)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const validated = validateStoragePointer(entry.protocol, entry.address || entry.uri || '');
    if (!validated.isValid) continue;
    const key = `${validated.protocol}:${validated.address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      protocol: validated.protocol,
      address: validated.address,
      uri: validated.uri,
      resource: 'master',
      syntax_validated: true,
      verified: false,
      is_local_reference: validated.is_local_reference === true
    });
    if (normalized.length >= MAX_STORAGE_NODES_PER_WORK) break;
  }
  return normalized;
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

export function injectStoragePointerToForm(domFormElement) {
  if (!domFormElement || typeof domFormElement.appendChild !== 'function' || typeof document === 'undefined') return null;
  if (domFormElement.dataset && domFormElement.dataset.storageNodesReady === 'true') return domFormElement.storageNodesController || null;

  const fieldset = createElement('fieldset', 'creator-storage-node-form');
  fieldset.setAttribute('aria-describedby', 'creatorStorageNodesHelp');
  const legend = createElement('legend', 'creator-storage-node-title', 'Master storage pointers · optional');
  const help = createElement('p', 'creator-storage-node-help', 'Metadata only. IPFS/Arweave identifiers are public, untrusted references; syntax checks do not verify content. This app never resolves or fetches them. local-handshake is a device-local note, not a URL. No upload, pin, or share link is created.');
  help.id = 'creatorStorageNodesHelp';

  const controls = createElement('div', 'creator-storage-node-controls');
  const protocolLabel = createElement('label', 'creator-storage-node-label', 'Storage type');
  protocolLabel.htmlFor = 'creatorStorageProtocol';
  const protocolSelect = createElement('select', 'ob-input');
  protocolSelect.id = 'creatorStorageProtocol';
  [
    ['ipfs', 'IPFS CID'],
    ['arweave', 'Arweave transaction ID'],
    ['local-handshake', 'Local handshake note']
  ].forEach(([value, label]) => {
    const option = createElement('option', '', label);
    option.value = value;
    protocolSelect.appendChild(option);
  });
  protocolLabel.appendChild(protocolSelect);

  const addressLabel = createElement('label', 'creator-storage-node-label', 'CID, transaction ID, or local label');
  addressLabel.htmlFor = 'creatorStorageAddress';
  const addressInput = createElement('input', 'ob-input');
  addressInput.id = 'creatorStorageAddress';
  addressInput.type = 'text';
  addressInput.maxLength = 160;
  addressInput.autocomplete = 'off';
  addressInput.spellcheck = false;
  addressInput.placeholder = 'bafy… · 43-character transaction ID · local-drive-01';
  addressInput.setAttribute('aria-describedby', 'creatorStorageNodesHelp creatorStorageNodeStatus');
  addressLabel.appendChild(addressInput);

  const addButton = createElement('button', 'creator-storage-node-add', 'Add pointer');
  addButton.type = 'button';
  addButton.setAttribute('aria-label', 'Add validated master storage pointer');
  const status = createElement('p', 'creator-storage-node-status', 'No storage pointers added.');
  status.id = 'creatorStorageNodeStatus';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const list = createElement('ul', 'creator-storage-node-list');
  list.setAttribute('aria-label', 'Master storage pointers on this device');

  controls.appendChild(protocolLabel);
  controls.appendChild(addressLabel);
  controls.appendChild(addButton);
  fieldset.appendChild(legend);
  fieldset.appendChild(help);
  fieldset.appendChild(controls);
  fieldset.appendChild(status);
  fieldset.appendChild(list);
  domFormElement.appendChild(fieldset);

  let pointers = [];
  const render = () => {
    const rows = pointers.map((pointer, index) => {
      const item = createElement('li', 'creator-storage-node-item');
      const label = pointer.is_local_reference
        ? `Local note · ${pointer.address} (not a network URL)`
        : `${pointer.protocol === 'ipfs' ? 'IPFS' : 'Arweave'} · ${pointer.address} (not verified or fetched)`;
      item.appendChild(createElement('span', 'creator-storage-node-value', label));
      const removeButton = createElement('button', 'creator-storage-node-remove', 'Remove');
      removeButton.type = 'button';
      removeButton.setAttribute('aria-label', `Remove storage pointer ${index + 1}`);
      removeButton.addEventListener('click', () => {
        pointers = pointers.filter((_, pointerIndex) => pointerIndex !== index);
        render();
      });
      item.appendChild(removeButton);
      return item;
    });
    list.replaceChildren(...rows);
    status.textContent = pointers.length
      ? `${pointers.length} of ${MAX_STORAGE_NODES_PER_WORK} storage pointer${pointers.length === 1 ? '' : 's'} recorded locally. None were resolved or verified.`
      : 'No storage pointers added.';
  };
  const add = (protocol, address) => {
    const pointer = validateStoragePointer(protocol, address);
    if (!pointer.isValid) {
      status.textContent = pointer.message;
      addressInput.setAttribute('aria-invalid', 'true');
      addressInput.focus();
      return pointer;
    }
    if (pointers.some(item => item.protocol === pointer.protocol && item.address === pointer.address)) {
      status.textContent = 'That pointer is already in this draft.';
      addressInput.setAttribute('aria-invalid', 'true');
      addressInput.focus();
      return { isValid: false, message: 'That pointer is already in this draft.' };
    }
    if (pointers.length >= MAX_STORAGE_NODES_PER_WORK) {
      status.textContent = `A work can have up to ${MAX_STORAGE_NODES_PER_WORK} storage pointers.`;
      addressInput.setAttribute('aria-invalid', 'true');
      addressInput.focus();
      return { isValid: false, message: status.textContent };
    }
    pointers = [...pointers, pointer];
    addressInput.value = '';
    addressInput.removeAttribute('aria-invalid');
    render();
    addressInput.focus();
    return pointer;
  };
  addButton.addEventListener('click', () => add(protocolSelect.value, addressInput.value));
  addressInput.addEventListener('input', () => addressInput.removeAttribute('aria-invalid'));
  addressInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      if (event.preventDefault) event.preventDefault();
      add(protocolSelect.value, addressInput.value);
    }
  });

  const controller = {
    getValues: () => pointers.map(pointer => ({ ...pointer })),
    setValues(value) {
      pointers = normalizeStorageNodes(value);
      render();
    },
    add,
    reset() {
      pointers = [];
      addressInput.value = '';
      addressInput.removeAttribute('aria-invalid');
      protocolSelect.value = 'ipfs';
      render();
    }
  };
  if (domFormElement.dataset) domFormElement.dataset.storageNodesReady = 'true';
  domFormElement.storageNodesController = controller;
  render();
  return controller;
}
