import { Firestore } from '@google-cloud/firestore';
import { COLLECTIONS } from '@bounty-system/core';
import type { Bounty, Domain, LedgerEntry, Proof } from '@bounty-system/core';

let db: Firestore | null = null;

export function getFirestore(): Firestore {
  if (!db) {
    db = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT || 'bounty-system-prod'
    });
  }
  return db;
}

// Bounties
export async function getBounties(options: {
  status?: string;
  domainId?: string;
  limit?: number;
} = {}): Promise<Bounty[]> {
  const db = getFirestore();
  let query = db.collection(COLLECTIONS.BOUNTIES)
    .orderBy('createdAt', 'desc');

  if (options.status) {
    query = query.where('status', '==', options.status);
  }
  if (options.domainId) {
    query = query.where('domainId', '==', options.domainId);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bounty));
}

export async function getBounty(id: string): Promise<Bounty | null> {
  const db = getFirestore();
  const doc = await db.collection(COLLECTIONS.BOUNTIES).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Bounty;
}

export async function createBounty(data: Omit<Bounty, 'id'>): Promise<Bounty> {
  const db = getFirestore();
  const ref = db.collection(COLLECTIONS.BOUNTIES).doc();
  const bounty = { id: ref.id, ...data };
  await ref.set(bounty);
  return bounty;
}

export async function updateBounty(id: string, data: Partial<Bounty>): Promise<void> {
  const db = getFirestore();
  await db.collection(COLLECTIONS.BOUNTIES).doc(id).update({
    ...data,
    updatedAt: new Date().toISOString()
  });
}

// Domains
export async function getDomains(): Promise<Domain[]> {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTIONS.DOMAINS).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Domain));
}

export async function getDomain(idOrSlug: string): Promise<Domain | null> {
  const db = getFirestore();

  // Try by ID first
  let doc = await db.collection(COLLECTIONS.DOMAINS).doc(idOrSlug).get();
  if (doc.exists) {
    return { id: doc.id, ...doc.data() } as Domain;
  }

  // Try by slug
  const snapshot = await db.collection(COLLECTIONS.DOMAINS)
    .where('slug', '==', idOrSlug)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const first = snapshot.docs[0];
  return { id: first.id, ...first.data() } as Domain;
}

// Ledger
export async function getLedgerEntries(options: {
  domainId?: string;
  type?: string;
  limit?: number;
} = {}): Promise<LedgerEntry[]> {
  const db = getFirestore();
  let query = db.collection(COLLECTIONS.LEDGER)
    .orderBy('date', 'desc');

  if (options.domainId) {
    query = query.where('domainId', '==', options.domainId);
  }
  if (options.type) {
    query = query.where('type', '==', options.type);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerEntry));
}

// Proofs
export async function getProof(bountyId: string): Promise<Proof | null> {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTIONS.PROOFS)
    .where('bountyId', '==', bountyId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const first = snapshot.docs[0];
  return { id: first.id, ...first.data() } as Proof;
}

export async function createProof(data: Proof): Promise<Proof> {
  const db = getFirestore();
  await db.collection(COLLECTIONS.PROOFS).doc(data.id).set(data);
  return data;
}

// Sessions
export interface WorkSession {
  id: string;
  bountyId: string;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'completed' | 'cancelled';
  checkpoints: Array<{
    timestamp: string;
    message: string;
    hasScreenshot?: boolean;
  }>;
  recordings: Array<{
    sessionId: string;
    filename: string;
    duration: number;
    url?: string;
  }>;
}

export async function getActiveSession(bountyId?: string): Promise<WorkSession | null> {
  const db = getFirestore();
  let query = db.collection(COLLECTIONS.SESSIONS)
    .where('status', '==', 'active');

  if (bountyId) {
    query = query.where('bountyId', '==', bountyId);
  }

  const snapshot = await query.limit(1).get();
  if (snapshot.empty) return null;

  const first = snapshot.docs[0];
  return { id: first.id, ...first.data() } as WorkSession;
}

export async function getSessions(bountyId: string): Promise<WorkSession[]> {
  const db = getFirestore();
  const snapshot = await db.collection(COLLECTIONS.SESSIONS)
    .where('bountyId', '==', bountyId)
    .orderBy('startedAt', 'desc')
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkSession));
}

export async function saveSession(session: WorkSession): Promise<void> {
  const db = getFirestore();
  await db.collection(COLLECTIONS.SESSIONS).doc(session.id).set(session, { merge: true });
}
