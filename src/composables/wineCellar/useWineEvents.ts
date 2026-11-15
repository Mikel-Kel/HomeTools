import {
  computed,
  ref,
} from "vue";

import { useEventRequest } from "@/composables/useEventRequest";

import {
  isReferenceEventSuffix,
  locationEventSuffix,
  referenceEventSuffix,
  WINE_EVENT_TRIGRAM,
  WINE_EVENT_VERSION,
  wineEventSuffix,
  type WineEventType,
  type WineLocationSave,
  type WineReferenceKind,
  type WineReferenceSave,
  WINE_SAVED_VERSION_2,
  type WineSave,
  type WineSaveV2,
  type WineStockChange,
  type WineTastingSave,
} from "@/contracts/wineCellar";

import { deviceName } from "@/services/environment/environmentState";
import { eventFilePattern } from "@/services/events/eventFiles";

import {
  pendingMessage,
  processingMessage,
  REJECTED_BY_SERVER,
} from "@/services/events/requestMessages";

/* =========================
   Saisies de la cave à vins (événements WIN)

   Contrat : ../Backend/docs/wine-cellar-contract.md, § 3.
   Une instance pour la page : elle émet les événements
   (emitEvent, demande de rapatriement habituelle en Object
   Storage) et suit la dernière demande envoyée
   (useEventRequest), dont le message de statut est affiché
   tel quel.

   « Pending » est déduit du stockage : un événement WIN du
   vin (ou de l'emplacement) attend dans events/, quel que
   soit l'appareil, ou la demande suivie est en cours. Le
   stock affiché vient toujours de wine/cellar.json,
   republié par le Mac.
========================= */

const NO_ANSWER_DELAY_MS =
  2 * 60 * 1000;

const eventPattern =
  eventFilePattern(WINE_EVENT_TRIGRAM);

export function useWineEvents() {

  const tracker =
    useEventRequest({
      trigram: WINE_EVENT_TRIGRAM,
      noAnswerDelayMs: NO_ANSWER_DELAY_MS,
    });

  /* Suffixe (W12, LNEW…) de la dernière demande envoyée. */
  const currentSuffix =
    ref<string | null>(null);

  /* Suffixes des événements WIN qui attendent dans events/. */
  const waitingSuffixes =
    computed(() =>
      new Set(
        tracker.waitingFiles.value
          .map(name => eventPattern.exec(name)?.[1])
          .filter((suffix): suffix is string => !!suffix)
      )
    );

  function isPending(
    suffix: string
  ): boolean {
    return (
      waitingSuffixes.value.has(suffix) ||
      (tracker.inProgress.value && currentSuffix.value === suffix)
    );
  }

  function isWinePending(
    wineId: number | null
  ): boolean {
    return isPending(wineEventSuffix(wineId));
  }

  function isLocationPending(
    locationId: number | null
  ): boolean {
    return isPending(locationEventSuffix(locationId));
  }

  /* La dernière demande porte sur ce vin (message à afficher dans sa fiche). */
  function concernsWine(
    wineId: number | null
  ): boolean {
    return (
      tracker.request.value !== null &&
      currentSuffix.value === wineEventSuffix(wineId)
    );
  }

  function isReferencePending(
    kind: WineReferenceKind,
    id: number | null
  ): boolean {
    return isPending(referenceEventSuffix(kind, id));
  }

  /* La dernière demande porte sur des données de base (section « Wine » de Master data). */
  const concernsReferences =
    computed(() =>
      tracker.request.value !== null &&
      !!currentSuffix.value &&
      isReferenceEventSuffix(currentSuffix.value)
    );

  /* La dernière demande porte sur un emplacement (écran des emplacements). */
  const concernsLocations =
    computed(() =>
      tracker.request.value !== null &&
      !!currentSuffix.value?.startsWith("L")
    );

  async function send(
    eventType: WineEventType,
    suffix: string,
    payload: object,
    version = WINE_EVENT_VERSION
  ): Promise<void> {
    currentSuffix.value = suffix;

    await tracker.send(
      {
        eventType,
        version,
        timestamp: new Date().toISOString(),
        payload: {
          ...payload,
          source: deviceName(),
        },
      },
      suffix
    );

    /* Pending visible tout de suite, sans attendre la surveillance. */
    await tracker.check().catch(
      err =>
        console.warn(
          "Unable to read events",
          err
        )
    );
  }

  /* wineId null : création d'un vin. */
  function sendWineEvent(
    eventType: WineEventType,
    wineId: number | null,
    payload: object,
    version?: number
  ): Promise<void> {
    return send(
      eventType,
      wineEventSuffix(wineId),
      payload,
      version
    );
  }

  /* locationId null : création d'un emplacement. */
  function sendLocationEvent(
    eventType: WineEventType,
    locationId: number | null,
    payload: object
  ): Promise<void> {
    return send(
      eventType,
      locationEventSuffix(locationId),
      payload
    );
  }

  /* Création (wineId null) ou modification de la fiche, version 1 (cellar.json version 1). */
  function saveWine(
    wine: WineSave
  ): Promise<void> {
    return sendWineEvent(
      "WINE_SAVED",
      wine.wineId,
      wine
    );
  }

  /* Même chose en version 2 (cellar.json version 2) : références et taille. */
  function saveWineV2(
    wine: WineSaveV2
  ): Promise<void> {
    return sendWineEvent(
      "WINE_SAVED",
      wine.wineId,
      wine,
      WINE_SAVED_VERSION_2
    );
  }

  /* Suppression définitive (après confirmation par la vue). */
  function deleteWine(
    wineId: number
  ): Promise<void> {
    return sendWineEvent(
      "WINE_DELETED",
      wineId,
      { wineId }
    );
  }

  /* Variation du stock (+1 purchase, -1 opened, correction). */
  function changeStock(
    change: WineStockChange
  ): Promise<void> {
    return sendWineEvent(
      "WINE_STOCK_CHANGED",
      change.wineId,
      change
    );
  }

  /* Ajout (tastingId null) ou modification d'une dégustation. */
  function saveTasting(
    tasting: WineTastingSave
  ): Promise<void> {
    return sendWineEvent(
      "WINE_TASTING_SAVED",
      tasting.wineId,
      tasting
    );
  }

  function deleteTasting(
    wineId: number,
    tastingId: number
  ): Promise<void> {
    return sendWineEvent(
      "WINE_TASTING_DELETED",
      wineId,
      { wineId, tastingId }
    );
  }

  /* Création (locationId null) ou modification d'un emplacement. */
  function saveLocation(
    location: WineLocationSave
  ): Promise<void> {
    return sendLocationEvent(
      "WINE_LOCATION_SAVED",
      location.locationId,
      location
    );
  }

  function deleteLocation(
    locationId: number
  ): Promise<void> {
    return sendLocationEvent(
      "WINE_LOCATION_DELETED",
      locationId,
      { locationId }
    );
  }

  /* Création (id null) ou modification d'un élément de données de base. */
  function saveReference(
    reference: WineReferenceSave
  ): Promise<void> {
    return send(
      "WINE_REFERENCE_SAVED",
      referenceEventSuffix(reference.kind, reference.id),
      reference
    );
  }

  function deleteReference(
    kind: WineReferenceKind,
    id: number
  ): Promise<void> {
    return send(
      "WINE_REFERENCE_DELETED",
      referenceEventSuffix(kind, id),
      { kind, id }
    );
  }

  /* Message de la dernière demande : attente, traitement, statut du Mac. */
  const message =
    computed(() => {
      const current =
        tracker.request.value;

      switch (current?.phase) {
        case "requested":
          return pendingMessage("Sent", tracker.noAnswerYet.value);

        case "started":
          return processingMessage("Saving");

        case "completed":
          return current.message || "Done.";

        case "error":
          return current.message || REJECTED_BY_SERVER;

        default:
          return "";
      }
    });

  const messageTone =
    computed(() =>
      tracker.request.value?.phase ?? ""
    );

  return {
    inProgress: tracker.inProgress,
    message,
    messageTone,
    isWinePending,
    isLocationPending,
    concernsWine,
    concernsLocations,
    concernsReferences,
    isReferencePending,
    sendWineEvent,
    sendLocationEvent,
    saveWine,
    saveWineV2,
    deleteWine,
    changeStock,
    saveTasting,
    deleteTasting,
    saveLocation,
    deleteLocation,
    saveReference,
    deleteReference,
  };

}

export type WineEvents =
  ReturnType<typeof useWineEvents>;
