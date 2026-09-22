import {
  getSolidDataset,
  getContainedResourceUrlAll,
  getThing,
  getThingAll,
  getUrl,
  getStringNoLocale,
  getDatetime,
  getInteger,
  overwriteFile,
  deleteFile,
  createContainerAt,
  getFile,
  getResourceInfoWithAcl,
  hasResourceAcl,
  hasFallbackAcl,
  hasAccessibleAcl,
  createAclFromFallbackAcl,
  getResourceAcl,
  getFallbackAcl,
  setPublicResourceAccess,
  setAgentResourceAccess,
  saveAclFor,
} from '@inrupt/solid-client';
import { FOAF, VCARD } from '@inrupt/vocab-common-rdf';

const PIM_STORAGE    = 'http://www.w3.org/ns/pim/space#storage';
const DCTERMS_MODIFIED = 'http://purl.org/dc/terms/modified';
const POSIX_SIZE     = 'http://www.w3.org/ns/posix/stat#size';

// Derive a best-guess storage root from a WebID URL.
// e.g. https://privatedatapod.com/alice/profile/card#me  → https://privatedatapod.com/alice/
// e.g. https://solidcommunity.net/alice/profile/card#me  → https://solidcommunity.net/alice/
// Falls back to origin root only if the path has no meaningful segments.
function deriveStorageRoot(webId) {
  try {
    const u = new URL(webId);
    const segments = u.pathname.replace(/#.*$/, '').split('/').filter(Boolean);
    // First non-empty segment is typically the username — return origin/username/
    if (segments.length >= 1) {
      return `${u.origin}/${segments[0]}/`;
    }
  } catch { /* ignore */ }
  return new URL('/', webId).href;
}

// ─── Profile ────────────────────────────────────────────────────────────────

export async function fetchProfile(webId, fetchFn) {
  const dataset = await getSolidDataset(webId, { fetch: fetchFn });
  const profile = getThing(dataset, webId);
  if (!profile) throw new Error('Could not read WebID profile');

  const storageRoot =
    getUrl(profile, PIM_STORAGE) ||
    deriveStorageRoot(webId);

  const name =
    getStringNoLocale(profile, FOAF.name) ||
    getStringNoLocale(profile, VCARD.fn) ||
    getStringNoLocale(profile, 'http://xmlns.com/foaf/0.1/name') ||
    // Extract username from WebID path — e.g. https://example.com/alice/profile/card#me → "alice"
    new URL(webId).pathname.split('/').filter(Boolean)[0] ||
    'User';

  const avatar =
    getUrl(profile, FOAF.img) ||
    getUrl(profile, VCARD.hasPhoto) ||
    null;

  return { name, storageRoot, avatar };
}

// ─── Container listing ───────────────────────────────────────────────────────

// Pod-level system containers that should never appear in the file browser
const SYSTEM_CONTAINERS = new Set(['profile', 'inbox', '.well-known', '.oidc', '.acl', '.meta', 'tmp']);

function isSystemUrl(url) {
  const seg = url.replace(/\/$/, '').split('/').pop() ?? '';
  return (
    seg.startsWith('.') ||
    seg.endsWith('.acl') ||
    seg.endsWith('.meta') ||
    SYSTEM_CONTAINERS.has(seg)
  );
}

export async function listContainer(containerUrl, fetchFn) {
  const dataset = await getSolidDataset(containerUrl, { fetch: fetchFn });
  const contained = getContainedResourceUrlAll(dataset);

  return contained
    .filter(url => !isSystemUrl(url))
    .map(url => {
      const thing = getThing(dataset, url);
      const isFolder = url.endsWith('/');
      const rawSeg = isFolder
        ? url.replace(/\/$/, '').split('/').pop()
        : url.split('/').pop();
      const name = decodeURIComponent(rawSeg ?? url);

      let modified = null;
      let size = null;
      if (thing) {
        modified = getDatetime(thing, DCTERMS_MODIFIED);
        size = getInteger(thing, POSIX_SIZE);
      }
      return { url, name, isFolder, modified, size };
    })
    .sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
}

// ─── Folder creation ─────────────────────────────────────────────────────────

// POST to the parent container with a Slug header — the LDP way to create a
// child container. This works even when `containerUrl` doesn't exist yet because
// the parent container is always reachable and its CORS headers are served
// correctly. We use this as a fallback when the direct PUT approach is
// CORS-blocked (which happens on pods whose 404 handler omits CORS headers).
async function createContainerViaPost(containerUrl, fetchFn) {
  const withSlash = containerUrl.replace(/\/?$/, '/');
  const parentUrl = withSlash.replace(/[^/]+\/$/, '');
  const slug = withSlash.replace(/\/$/, '').split('/').pop();
  const resp = await fetchFn(parentUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/turtle',
      'Slug': slug,
      'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
    },
    body: '',
  });
  // 201 Created, 200 OK re-create, or 409 Conflict (already exists) are all fine
  if (!resp.ok && resp.status !== 409) {
    throw new Error(`Failed to create container via POST: ${resp.status}`);
  }
}

export async function createFolder(containerUrl, fetchFn) {
  // Always use POST with a Slug header rather than PUT (createContainerAt).
  // PUT to a non-existent path causes a 500 on this server without CORS headers,
  // which the browser blocks before JS can catch it — the fallback never fires.
  return createContainerViaPost(containerUrl, fetchFn);
}

// ─── File upload ─────────────────────────────────────────────────────────────

export async function uploadFile(targetUrl, file, fetchFn) {
  return overwriteFile(targetUrl, file, {
    contentType: file.type || 'application/octet-stream',
    fetch: fetchFn,
  });
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteResource(url, fetchFn) {
  if (url.endsWith('/')) {
    // List ALL resources in the container — including .acl, .meta, and other
    // hidden files that listContainer() filters out for the UI. The server
    // returns 409 Conflict if any child still exists when we DELETE the container.
    let childUrls = [];
    try {
      const dataset = await getSolidDataset(url, { fetch: fetchFn });
      childUrls = getContainedResourceUrlAll(dataset);
    } catch {
      // ignore listing errors — try direct delete anyway
    }
    for (const childUrl of childUrls) {
      await deleteResource(childUrl, fetchFn);
    }
    // deleteFile() strips trailing slashes before the HTTP request, causing a
    // 404 on Solid servers that distinguish containers by their trailing slash.
    // Use the authenticated fetch directly to preserve the exact URL.
    const resp = await fetchFn(url, { method: 'DELETE' });
    if (!resp.ok) throw new Error(`Failed to delete folder: ${resp.status} ${resp.statusText}`);
  } else {
    await deleteFile(url, { fetch: fetchFn });
  }
}

// ─── Copy / Move / Rename ────────────────────────────────────────────────────

export async function copyFile(sourceUrl, destUrl, fetchFn) {
  if (sourceUrl.endsWith('/')) {
    throw new Error('Copying folders is not supported.');
  }
  const blob = await getFile(sourceUrl, { fetch: fetchFn });
  return overwriteFile(destUrl, blob, {
    contentType: blob.type || 'application/octet-stream',
    fetch: fetchFn,
  });
}

export async function moveResource(sourceUrl, destUrl, fetchFn) {
  await copyFile(sourceUrl, destUrl, fetchFn);
  await deleteFile(sourceUrl, { fetch: fetchFn });
}

// ─── Download ────────────────────────────────────────────────────────────────

export async function getFileObjectUrl(url, fetchFn) {
  const file = await getFile(url, { fetch: fetchFn });
  return { objectUrl: URL.createObjectURL(file), mimeType: file.type };
}

// ─── Access Control (WAC) ────────────────────────────────────────────────────

export async function setPublicRead(resourceUrl, isPublic, fetchFn) {
  const info = await getResourceInfoWithAcl(resourceUrl, { fetch: fetchFn });
  if (!hasAccessibleAcl(info)) throw new Error('ACL not accessible for this resource');

  let acl;
  if (hasResourceAcl(info)) {
    acl = setPublicResourceAccess(getResourceAcl(info), {
      read: isPublic, write: false, append: false, control: false,
    });
  } else if (hasFallbackAcl(info)) {
    acl = setPublicResourceAccess(createAclFromFallbackAcl(info), {
      read: isPublic, write: false, append: false, control: false,
    });
  } else {
    throw new Error('No ACL found');
  }
  await saveAclFor(info, acl, { fetch: fetchFn });
}

// ─── Inbox / Sharing notifications ─────────────────────────────────────────

const LDP_INBOX = 'http://www.w3.org/ns/ldp#inbox';
const AS_NS    = 'https://www.w3.org/ns/activitystreams#';

async function getInboxUrl(webId, fetchFn) {
  // Try to read ldp:inbox from the profile first
  try {
    const ds = await getSolidDataset(webId, { fetch: fetchFn });
    const profile = getThing(ds, webId);
    const inboxUrl = profile ? getUrl(profile, LDP_INBOX) : null;
    if (inboxUrl) return inboxUrl;
  } catch { /* fall through to derived */ }
  // Fallback: derive inbox from WebID by convention (origin/username/inbox/)
  try {
    const u = new URL(webId);
    const seg = u.pathname.replace(/#.*$/, '').split('/').filter(Boolean)[0];
    if (seg) return `${u.origin}/${seg}/inbox/`;
  } catch { /* ignore */ }
  return null;
}

// Ensure the current user's inbox allows others to append (POST) notifications.
// Directly PUTs a WAC .acl document — more reliable than going through library helpers.
export async function ensureOwnInboxAppendable(webId, fetchFn) {
  try {
    const inboxUrl = await getInboxUrl(webId, fetchFn);
    if (!inboxUrl) return;

    // Ensure inbox container exists.
    // Pods may not include CORS headers on 404 responses, causing the browser
    // to block the response entirely (TypeError). Handle both cases.
    let headResp;
    try {
      headResp = await fetchFn(inboxUrl, { method: 'HEAD' });
    } catch {
      headResp = null; // CORS-blocked, likely a masked 404
    }
    if (!headResp || headResp.status === 404) {
      // Use POST-to-parent instead of PUT-to-new-path: the parent container
      // (/username/) always exists and returns correct CORS headers, whereas
      // a PUT to a non-existent /username/inbox/ is CORS-blocked on pods whose
      // 404 handler omits CORS headers (the OPTIONS preflight also fails).
      try {
        await createContainerViaPost(inboxUrl, fetchFn);
      } catch {
        return; // Can't create inbox — skip ACL setup (non-critical feature)
      }
      try {
        headResp = await fetchFn(inboxUrl, { method: 'HEAD' });
      } catch {
        return; // Can't resolve ACL URL without a successful HEAD
      }
    }
    if (!headResp.ok) return;

    // Resolve ACL URL from Link header
    const linkHeader = headResp.headers.get('Link') || '';
    const aclMatch = linkHeader.match(/<([^>]+)>;\s*rel="acl"/);
    if (!aclMatch) return;
    const aclUrl = new URL(aclMatch[1], inboxUrl).href;

    // PUT a WAC ACL: owner gets full access, foaf:Agent gets append
    const aclBody = [
      '@prefix acl: <http://www.w3.org/ns/auth/acl#> .',
      '@prefix foaf: <http://xmlns.com/foaf/0.1/> .',
      '',
      '<#owner>',
      '  a acl:Authorization ;',
      `  acl:agent <${webId}> ;`,
      `  acl:accessTo <${inboxUrl}> ;`,
      `  acl:default <${inboxUrl}> ;`,
      '  acl:mode acl:Read, acl:Write, acl:Control .',
      '',
      '<#public>',
      '  a acl:Authorization ;',
      '  acl:agentClass foaf:Agent ;',
      `  acl:accessTo <${inboxUrl}> ;`,
      `  acl:default <${inboxUrl}> ;`,
      '  acl:mode acl:Append .',
    ].join('\n');

    const putResp = await fetchFn(aclUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/turtle' },
      body: aclBody,
    });
    if (!putResp.ok) throw new Error(`ACL PUT failed: ${putResp.status}`);
  } catch (e) {
    console.warn('[SolidApp] ensureOwnInboxAppendable: failed', e);
  }
}

export async function sendShareNotification(recipientWebId, resourceUrl, resourceName, senderWebId, fetchFn) {
  const inboxUrl = await getInboxUrl(recipientWebId, fetchFn);
  if (!inboxUrl) throw new Error("Could not find recipient's inbox");

  const safeName = resourceName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const body = [
    '@prefix as: <https://www.w3.org/ns/activitystreams#> .',
    '<> a as:Offer ;',
    `  as:actor <${senderWebId}> ;`,
    `  as:object <${resourceUrl}> ;`,
    `  as:name "${safeName}" ;`,
    `  as:target <${recipientWebId}> .`,
  ].join('\n');

  const resp = await fetchFn(inboxUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/turtle' },
    body,
  });
  if (!resp.ok) throw new Error(`Inbox POST failed: ${resp.status}`);
}

export async function getSharedWithMe(webId, fetchFn) {
  const inboxUrl = await getInboxUrl(webId, fetchFn);
  if (!inboxUrl) return [];

  let inboxDs;
  try { inboxDs = await getSolidDataset(inboxUrl, { fetch: fetchFn }); }
  catch { return []; }

  const notifUrls = getContainedResourceUrlAll(inboxDs);
  const candidates = [];

  // Parse all notifications first
  await Promise.all(notifUrls.map(async notifUrl => {
    try {
      const ds = await getSolidDataset(notifUrl, { fetch: fetchFn });
      for (const thing of getThingAll(ds)) {
        const objectUrl = getUrl(thing, AS_NS + 'object');
        const actor     = getUrl(thing, AS_NS + 'actor');
        const name      = getStringNoLocale(thing, AS_NS + 'name');
        if (objectUrl) {
          candidates.push({
            url: objectUrl,
            name: name || decodeURIComponent(objectUrl.replace(/\/$/, '').split('/').pop() ?? objectUrl),
            sharedBy: actor ?? 'unknown',
            notifUrl,
          });
          break;
        }
      }
    } catch { /* skip malformed */ }
  }));

  // Validate each candidate — only include resources that are still accessible
  // and clean up stale notifications to avoid the check happening again on next login
  const results = [];
  await Promise.all(candidates.map(async item => {
    try {
      const resp = await fetchFn(item.url, { method: 'HEAD' });
      if (resp.ok) {
        results.push(item);
      } else {
        // Resource gone (404) or access revoked (403) — delete the stale notification
        try { await fetchFn(item.notifUrl, { method: 'DELETE' }); } catch { /* best-effort */ }
      }
    } catch {
      // Network/CORS error — exclude but leave notification in place (may be transient)
    }
  }));

  return results;
}

export async function setAgentAccess(resourceUrl, agentWebId, access, fetchFn) {
  const info = await getResourceInfoWithAcl(resourceUrl, { fetch: fetchFn });
  if (!hasAccessibleAcl(info)) throw new Error('ACL not accessible for this resource');

  let acl;
  if (hasResourceAcl(info)) {
    acl = setAgentResourceAccess(getResourceAcl(info), agentWebId, access);
  } else if (hasFallbackAcl(info)) {
    acl = setAgentResourceAccess(createAclFromFallbackAcl(info), agentWebId, access);
  } else {
    throw new Error('No ACL found');
  }
  await saveAclFor(info, acl, { fetch: fetchFn });
}
