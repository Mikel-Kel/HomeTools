import {
  TO_FILE_FOLDER,
  type ArchiveItem,
} from "@/contracts/archive";

/* =========================
   Nom physique d'un document d'archives

   Grammaire (CLAUDE.md, « Nom d'un document archivé ») :
     AAAA/<Folder>/P<PartyID sur 5 chiffres>/<AAAA-MM-JJ>
       [-DTA<AAAAMMJJ>][-IF1<Info1>][-IF2<Info2>]
       [-TAG<id>[_<id>…]][-AMT<centimes>].<extension>
   Document resté dans « A Classer » :
     <AAAA-MM-JJ>-<libellé de la partie>[-IF1…][-IF2…]
       [-TAG…][-AMT…].<extension>

   Le backend reconstruit archivetoc et les tags à partir de
   ces noms (scripts/python/archive_reconcile.py) : ne pas
   changer cette grammaire sans adapter le script.
========================= */

function formatPartyID(
  partyID: number
): string {
  return (
    "P" +
    String(partyID)
      .padStart(5, "0")
  );
}

/*
  Nom des nouveaux documents en Unicode NFC (contrat §6) :
  Info1, Info2 ou le libellé du tiers peuvent arriver en NFD.
*/
export function buildPhysicalName(
  item: ArchiveItem,
  partyLabel: (partyID: number) => string
): string {
  const documentDate =
    item.documentDate;

  const dta =
    item.dtaDate
      ? `-DTA${item.dtaDate.replace(
          /-/g,
          ""
        )}`
      : "";

  const info1 =
    item.info1
      ? `-IF1${item.info1}`
      : "";

  const info2 =
    item.info2
      ? `-IF2${item.info2}`
      : "";

  const tags =
    item.tagIDs?.length
      ? `-TAG${item.tagIDs.join(
          "_"
        )}`
      : "";

  const amount =
    item.refAmount
      ? `-AMT${Math.round(
          item.refAmount * 100
        )}`
      : "";

  /*
    Extension du fichier d’origine (.pdf, .docx, .jpg…),
    conservée au classement.
  */
  const extension =
    /\.[A-Za-z0-9]+$/.exec(
      item.physicalName
    )?.[0] ?? ".pdf";

  if (
    item.folder ===
    TO_FILE_FOLDER
  ) {
    const label =
      partyLabel(
        item.partyID
      ) ||
      `${item.partyID}`;

    return (
      `${documentDate}-` +
      `${label}` +
      `${info1}` +
      `${info2}` +
      `${tags}` +
      `${amount}` +
      `${extension}`
    ).normalize("NFC");
  }

  const year =
    item.documentDate.slice(
      0,
      4
    );

  const party =
    formatPartyID(
      item.partyID
    );

  return (
    `${year}/` +
    `${item.folder}/` +
    `${party}/` +
    `${documentDate}` +
    `${dta}` +
    `${info1}` +
    `${info2}` +
    `${tags}` +
    `${amount}` +
    `${extension}`
  ).normalize("NFC");
}
