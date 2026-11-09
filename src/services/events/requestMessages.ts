/* =========================
   Messages de suivi des demandes

   Textes affichés pendant qu'un événement attend ou subit
   son traitement par le serveur de l'environnement (le Mac),
   communs à toutes les pages : un seul endroit pour les
   modifier.
========================= */

const SERVER =
  "the server";

/*
  Demande écrite, pas encore prise en charge (phase
  « requested ») : « Sent », « Requested »…
*/
export function pendingMessage(
  label: string,
  noAnswerYet: boolean
): string {
  return noAnswerYet
    ? `${label} — no answer from ${SERVER} yet. Check that it is on and reachable.`
    : `${label} — waiting for ${SERVER}…`;
}

/* Demande prise en charge (phase « started ») : « Saving » → « Saving on the server… ». */
export function processingMessage(
  action: string
): string {
  return `${action} on ${SERVER}…`;
}

/* Autre demande encore en attente : « A change of this tag » → « … is waiting for the server. » */
export function waitingElsewhereMessage(
  subject: string
): string {
  return `${subject} is waiting for ${SERVER}.`;
}

/* Traitement en cours, lancé ailleurs : « A housekeeping » → « … is running on the server. » */
export function runningElsewhereMessage(
  subject: string
): string {
  return `${subject} is running on ${SERVER}.`;
}

export function noAnswerAfterMessage(
  minutes: number
): string {
  return `No answer from ${SERVER} after ${minutes} minutes`;
}

export const REJECTED_BY_SERVER =
  `Request rejected by ${SERVER}`;

/* Sous-titre d'une fiche en création : l'identifiant est attribué par le serveur. */
export const CREATED_ON_SERVER =
  `Created on ${SERVER}`;

export const AGGREGATES_REBUILT_BY_SERVER =
  `The follow-up aggregates are rebuilt by ${SERVER} after this change.`;

export const SERVER_NOT_ANSWERING =
  "The server does not answer. Check that it is on and connected.";
